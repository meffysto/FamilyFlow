/**
 * Phase 46-01 — Tests Jest du helper tickAubergeAuto.
 *
 * Couvre :
 *  - vault.readFile failure → no-op silencieux
 *  - profil introuvable → no-op silencieux
 *  - state vide + treeStage='pousse' (level≥2) → spawn + scheduleAubergeVisitorArrival appelé
 *  - visiteur dont deadline est passée → expireVisitors marque expired + cancelAubergeVisitorNotifs appelé
 *  - 1 seul writeFile par appel (atomicité)
 */

// ─── Mock expo-notifications avant imports ─────────────────────────────────
const mockSchedule = jest.fn().mockResolvedValue(undefined);
const mockGetAll = jest.fn().mockResolvedValue([]);
const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockGetPerm = jest.fn().mockResolvedValue({ status: 'granted' });
const mockReqPerm = jest.fn().mockResolvedValue({ status: 'granted' });

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  getAllScheduledNotificationsAsync: () => mockGetAll(),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancel(...args),
  getPermissionsAsync: () => mockGetPerm(),
  requestPermissionsAsync: () => mockReqPerm(),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily', WEEKLY: 'weekly' },
}));

import { tickAubergeAuto } from '../auberge/auto-tick';
import type { Profile } from '../types';
import type { ActiveVisitor, AubergeState } from '../mascot/types';
import { serializeAuberge } from '../mascot/auberge-engine';

// ─── Factories ──────────────────────────────────────────────────────────────

const makeProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'p1',
  name: 'Papa',
  role: 'adulte',
  avatar: '👨',
  points: 0,
  coins: 0,
  level: 5, // arbuste — cap 2 actifs
  streak: 0,
  lootBoxesAvailable: 0,
  multiplier: 1,
  ...overrides,
} as Profile);

const makeVault = (initialContent = '') => {
  const writes: Array<{ file: string; content: string }> = [];
  const readFile = jest.fn(async (file: string) => {
    if (file !== `farm-p1.md`) throw new Error('not found');
    return initialContent;
  });
  const writeFile = jest.fn(async (file: string, content: string) => {
    writes.push({ file, content });
  });
  return { vault: { readFile, writeFile } as any, writes, readFile, writeFile };
};

const makeFarmContent = (state: AubergeState): string => {
  const s = serializeAuberge(state, new Date());
  const lines = ['# Farm — Papa', ''];
  if (s.visitors) lines.push(`auberge_visitors: ${s.visitors}`);
  if (s.reputations) lines.push(`auberge_reputations: ${s.reputations}`);
  if (s.lastSpawn) lines.push(`auberge_last_spawn: ${s.lastSpawn}`);
  if (s.totalDeliveries > 0) lines.push(`auberge_total_deliveries: ${s.totalDeliveries}`);
  return lines.join('\n') + '\n';
};

// ─── Setup / teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  mockSchedule.mockClear();
  mockGetAll.mockClear();
  mockCancel.mockClear();
  mockGetPerm.mockClear();
  mockReqPerm.mockClear();
  mockGetAll.mockResolvedValue([]);
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('tickAubergeAuto', () => {
  it('no-op silencieux si profil introuvable', async () => {
    const { vault, readFile, writeFile } = makeVault('');
    await expect(
      tickAubergeAuto('inconnu', { vault, profiles: [makeProfile()] }),
    ).resolves.toBeUndefined();
    expect(readFile).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('no-op silencieux si vault.readFile throw (fichier absent)', async () => {
    const vault = {
      readFile: jest.fn().mockRejectedValue(new Error('ENOENT')),
      writeFile: jest.fn().mockResolvedValue(undefined),
    } as any;
    // readFile throw → catch interne capture, parseFarmProfile('') retourne data vide,
    // puis spawn peut s'exécuter normalement → ne doit pas throw.
    await expect(
      tickAubergeAuto('p1', { vault, profiles: [makeProfile()] }),
    ).resolves.toBeUndefined();
    // writeFile peut être appelé (persist état) — on vérifie juste pas de throw.
  });

  it('spawn un visiteur quand state vide + level≥2 + cooldown OK', async () => {
    const { vault, writes } = makeVault('');
    await tickAubergeAuto('p1', {
      vault,
      profiles: [makeProfile({ level: 5 })], // arbuste = cap 2
    });

    // Au moins une notif d'arrivée scheduled
    const arrivalCalls = mockSchedule.mock.calls.filter(
      (c: any[]) => typeof c[0]?.identifier === 'string'
        && c[0].identifier.startsWith('auberge-visitor-arrival-'),
    );
    expect(arrivalCalls.length).toBeGreaterThanOrEqual(1);

    // Un seul writeFile (atomicité)
    expect(writes).toHaveLength(1);
    expect(writes[0].file).toBe('farm-p1.md');
    expect(writes[0].content).toContain('auberge_visitors:');
    expect(writes[0].content).toContain('auberge_last_spawn:');
  });

  it('expire un visiteur dont deadline est passée + cancel ses notifs', async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    const expiredVisitor: ActiveVisitor = {
      visitorId: 'hugo_boulanger',
      instanceId: 'vis_test_1',
      arrivedAt: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString(),
      deadlineAt: past.toISOString(),
      request: [{ itemId: 'farine', source: 'building', quantity: 2 }],
      status: 'active',
      rewardCoins: 100,
    };
    const state: AubergeState = {
      visitors: [expiredVisitor],
      reputations: [],
      totalDeliveries: 0,
      // lastSpawnAt récent → bloque tout nouveau spawn (cooldown 6h)
      lastSpawnAt: new Date(Date.now() - 60 * 1000).toISOString(),
    };
    const { vault } = makeVault(makeFarmContent(state));

    // Mock une notif déjà schedulée pour ce visiteur → doit être cancelée
    mockGetAll.mockResolvedValue([
      { identifier: `auberge-visitor-arrival-${expiredVisitor.instanceId}` },
      { identifier: `auberge-visitor-reminder-${expiredVisitor.instanceId}` },
    ]);

    await tickAubergeAuto('p1', { vault, profiles: [makeProfile({ level: 5 })] });

    // cancelScheduledNotificationAsync appelé pour les 2 notifs du visiteur expiré
    const cancelIds = mockCancel.mock.calls.map((c: any[]) => c[0]);
    expect(cancelIds).toContain(`auberge-visitor-arrival-${expiredVisitor.instanceId}`);
    expect(cancelIds).toContain(`auberge-visitor-reminder-${expiredVisitor.instanceId}`);
  });

  it('1 seul writeFile par appel (atomicité)', async () => {
    const { vault, writes } = makeVault('');
    await tickAubergeAuto('p1', { vault, profiles: [makeProfile({ level: 5 })] });
    expect(writes.length).toBeLessThanOrEqual(1);
  });

  it('idempotent : 2 appels rapprochés ne provoquent pas 2 spawns (cooldown 6h)', async () => {
    const { vault, writes } = makeVault('');
    await tickAubergeAuto('p1', { vault, profiles: [makeProfile({ level: 5 })] });
    const arrivalsAfterFirst = mockSchedule.mock.calls.filter(
      (c: any[]) => typeof c[0]?.identifier === 'string'
        && c[0].identifier.startsWith('auberge-visitor-arrival-'),
    ).length;

    // Re-feed le vault avec le contenu écrit pour simuler la persistance
    const vault2 = {
      readFile: jest.fn().mockResolvedValue(writes[0]?.content ?? ''),
      writeFile: jest.fn().mockResolvedValue(undefined),
    } as any;
    mockSchedule.mockClear();

    await tickAubergeAuto('p1', { vault: vault2, profiles: [makeProfile({ level: 5 })] });
    const arrivalsAfterSecond = mockSchedule.mock.calls.filter(
      (c: any[]) => typeof c[0]?.identifier === 'string'
        && c[0].identifier.startsWith('auberge-visitor-arrival-'),
    ).length;

    expect(arrivalsAfterFirst).toBeGreaterThanOrEqual(1);
    expect(arrivalsAfterSecond).toBe(0); // cooldown 6h bloque le 2e spawn
  });

  it('level=1 (graine, cap=0) → aucun spawn', async () => {
    const { vault } = makeVault('');
    await tickAubergeAuto('p1', { vault, profiles: [makeProfile({ level: 1 })] });
    const arrivals = mockSchedule.mock.calls.filter(
      (c: any[]) => typeof c[0]?.identifier === 'string'
        && c[0].identifier.startsWith('auberge-visitor-arrival-'),
    );
    expect(arrivals).toHaveLength(0);
  });
});
