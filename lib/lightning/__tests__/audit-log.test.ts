/**
 * Tests audit-log (Phase 53 — REQ-7).
 *
 * Couvre :
 *   - append → load round-trip preserve les entrées
 *   - purgeOlderThan(90) via fake timers
 *   - clearAudit → loadAudit returns []
 *   - JSON corrompu → return [] silencieux
 *   - validation défensive : filter shape invalide
 *   - findPaidEntry — REQ-6 idempotence
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AUDIT_KEY,
  RETENTION_DAYS,
  loadAudit,
  appendAudit,
  clearAudit,
  purgeOlderThan,
  findPaidEntry,
} from '../audit-log';
import type { AuditEntry } from '../audit-log';

beforeEach(async () => {
  await AsyncStorage.removeItem(AUDIT_KEY);
  jest.useRealTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

function entry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    ts: new Date().toISOString(),
    profileId: 'lucas',
    taskId: 't1',
    sats: 100,
    status: 'paid',
    ...overrides,
  };
}

describe('appendAudit / loadAudit — round-trip', () => {
  it('append puis load retourne les entrées', async () => {
    await appendAudit(entry({ taskId: 't1' }));
    await appendAudit(entry({ taskId: 't2' }));
    const audit = await loadAudit();
    expect(audit).toHaveLength(2);
    expect(audit[0].taskId).toBe('t1');
    expect(audit[1].taskId).toBe('t2');
  });

  it('loadAudit retourne [] si clé absente', async () => {
    expect(await loadAudit()).toEqual([]);
  });

  it('loadAudit retourne [] sur JSON corrompu', async () => {
    await AsyncStorage.setItem(AUDIT_KEY, '{not json');
    expect(await loadAudit()).toEqual([]);
  });

  it('loadAudit retourne [] si non-array (JSON valide mais shape invalide)', async () => {
    await AsyncStorage.setItem(AUDIT_KEY, JSON.stringify({ ts: 'x' }));
    expect(await loadAudit()).toEqual([]);
  });

  it('filtre les entrées invalides (validation défensive)', async () => {
    await AsyncStorage.setItem(
      AUDIT_KEY,
      JSON.stringify([
        { ts: '2026-05-18T10:00:00Z', profileId: 'p', taskId: 't', sats: 100, status: 'paid' },
        { ts: 'x' }, // incomplet
        null,
        { status: 'unknown_status_xyz', ts: '2026-05-18T10:00:00Z', profileId: 'p', taskId: 't', sats: 100 },
      ]),
    );
    const audit = await loadAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0].taskId).toBe('t');
  });
});

describe('purgeOlderThan — REQ-7 (90 jours glissants)', () => {
  it('purgeOlderThan(90) garde today, drop > 90j', () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const entries: AuditEntry[] = [
      entry({ taskId: 'today', ts: new Date(now - 1 * day).toISOString() }),
      entry({ taskId: 'd80', ts: new Date(now - 80 * day).toISOString() }),
      entry({ taskId: 'd100', ts: new Date(now - 100 * day).toISOString() }),
    ];
    const result = purgeOlderThan(entries, 90);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.taskId).sort()).toEqual(['d80', 'today']);
  });

  it('loadAudit applique la purge automatiquement', async () => {
    const now = new Date('2026-05-18T12:00:00Z').getTime();
    jest.useFakeTimers();
    jest.setSystemTime(now);

    const day = 24 * 60 * 60 * 1000;
    const oldEntry = entry({ taskId: 'old', ts: new Date(now - 100 * day).toISOString() });
    const recentEntry = entry({ taskId: 'recent', ts: new Date(now - 5 * day).toISOString() });
    await AsyncStorage.setItem(AUDIT_KEY, JSON.stringify([oldEntry, recentEntry]));

    const audit = await loadAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0].taskId).toBe('recent');
  });

  it('purgeOlderThan filtre les ts invalides', () => {
    const entries: AuditEntry[] = [
      entry({ taskId: 'ok', ts: new Date().toISOString() }),
      entry({ taskId: 'bad', ts: 'not-a-date' }),
    ];
    const result = purgeOlderThan(entries, 90);
    expect(result.map((e) => e.taskId)).toEqual(['ok']);
  });

  it('RETENTION_DAYS exporté est 90', () => {
    expect(RETENTION_DAYS).toBe(90);
  });
});

describe('clearAudit', () => {
  it('clearAudit puis loadAudit retourne []', async () => {
    await appendAudit(entry());
    await clearAudit();
    expect(await loadAudit()).toEqual([]);
  });
});

describe('findPaidEntry — REQ-6 idempotence', () => {
  it('retourne true si une entrée paid existe pour ce taskId+date', () => {
    const audit: AuditEntry[] = [
      entry({ status: 'paid', taskId: 'T1', ts: '2026-05-18T08:00:00Z' }),
    ];
    expect(findPaidEntry(audit, 'T1', '2026-05-18')).toBe(true);
  });

  it('retourne false si taskId différent', () => {
    const audit: AuditEntry[] = [
      entry({ status: 'paid', taskId: 'T1', ts: '2026-05-18T08:00:00Z' }),
    ];
    expect(findPaidEntry(audit, 'T2', '2026-05-18')).toBe(false);
  });

  it('retourne false si date différente', () => {
    const audit: AuditEntry[] = [
      entry({ status: 'paid', taskId: 'T1', ts: '2026-05-18T08:00:00Z' }),
    ];
    expect(findPaidEntry(audit, 'T1', '2026-05-19')).toBe(false);
  });

  it("retourne false si entrée existe mais status n'est pas 'paid'", () => {
    const audit: AuditEntry[] = [
      entry({ status: 'capped', taskId: 'T1', ts: '2026-05-18T08:00:00Z' }),
    ];
    expect(findPaidEntry(audit, 'T1', '2026-05-18')).toBe(false);
  });

  it('paid + undone même taskId+date → toujours true (REQ-6 — undone n\'efface pas paid)', () => {
    const audit: AuditEntry[] = [
      entry({ status: 'paid', taskId: 'T1', ts: '2026-05-18T08:00:00Z' }),
      entry({ status: 'undone', taskId: 'T1', ts: '2026-05-18T09:00:00Z' }),
    ];
    expect(findPaidEntry(audit, 'T1', '2026-05-18')).toBe(true);
  });
});
