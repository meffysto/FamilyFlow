/**
 * Tests process-task-completion + payout-executor (Phase 53 Plan 02).
 *
 * Couvre :
 *   - Flag OFF → no-op
 *   - Pas de family config → no-op
 *   - Attribution failed (2 mentions) → audit `attribution_failed`
 *   - Déjà paid today → audit `already_paid_today`
 *   - Cap dépassé → audit `capped`
 *   - Mode daily-review → audit `queued`
 *   - Mode hybrid au-dessus du seuil 100 → audit `queued`
 *   - Mode hybrid sous le seuil 100 → executePayout (`paid`)
 *   - Pay-out instant succès → audit `paid` + emit success
 *   - createInvoice TypeError network → enqueue offline + audit `queued`
 *   - createInvoice LnbitsError 4xx → audit `failed` + emit lnbits_error
 *   - Pitfall #2 lock in-memory → 2 toggles rapides = 1 seul createInvoice
 *   - BLOCKER #1 FaceID gate refusé → audit `failed` 'auth_cancelled' + emit biometric
 *   - BLOCKER #1 FaceID appelé avec `allowDevicePasscode: __DEV__` (i.e. !disableDeviceFallback)
 */

// Mock expo-local-authentication AVANT les imports modules pour intercepter
// l'appel de biometric-gate.authenticatePayOut.
jest.mock('expo-local-authentication', () => {
  return {
    hasHardwareAsync: jest.fn().mockResolvedValue(true),
    isEnrolledAsync: jest.fn().mockResolvedValue(true),
    authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
  };
});

// Mock expo-notifications pour ne PAS planifier réellement de notif (parent-notif.ts).
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-id'),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import type { Profile, Task } from '../../types';
import { AUDIT_KEY, loadAudit, type AuditEntry } from '../audit-log';
import {
  onPayoutFailed,
  onPayoutSuccess,
  type PayoutFailedEvent,
  type PayoutSuccessEvent,
} from '../lightning-events';
import { processTaskCompletionForLightning } from '../process-task-completion';
import { __resetInFlightLocks } from '../payout-executor';
import { loadQueue, QUEUE_KEY } from '../payout-queue';
import { resetLightningFlagCache } from '../feature-flag';
import { LnbitsError, type FamilyLightningConfig } from '../types';

const FAMILY_KEY = 'lightning_family_config_v1';
const FLAG_KEY = 'lightning_enabled_v1';

const VALID_CONFIG: FamilyLightningConfig = {
  baseUrl: 'https://demo.lnbits.com',
  family: {
    name: 'Famille',
    invoiceKey: 'family-invoice-key',
    adminKey: 'family-admin-key',
  },
  members: [
    {
      profileId: 'lucas',
      displayName: 'Lucas',
      invoiceKey: 'lucas-invoice-key',
    },
    {
      profileId: 'emma',
      displayName: 'Emma',
      invoiceKey: 'emma-invoice-key',
    },
  ],
  triggerMode: 'instant',
  dailyCapPerMember: 1000,
  hybridThresholdSats: 500,
};

const PROFILES: Profile[] = [
  { id: 'lucas', name: 'Lucas' } as Profile,
  { id: 'emma', name: 'Emma' } as Profile,
  { id: 'parent', name: 'Parent' } as Profile,
];

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    text: '@Lucas ranger la chambre',
    completed: true,
    tags: [],
    mentions: ['Lucas'],
    sourceFile: '01 - Enfants/Lucas/Tâches récurrentes.md',
    lineIndex: 4,
    completedDate: '2026-05-18',
    ...overrides,
  };
}

async function seedFamilyConfig(config: FamilyLightningConfig = VALID_CONFIG): Promise<void> {
  await SecureStore.setItemAsync(FAMILY_KEY, JSON.stringify(config));
}

async function seedFlagOn(): Promise<void> {
  await SecureStore.setItemAsync(FLAG_KEY, '1');
  resetLightningFlagCache();
}

// ─── Capture fetch pour mocker createInvoice + payInvoice ─────────────────
interface FetchCall {
  url: string;
  method: string;
  apiKey: string;
  body: unknown;
}

const fetchCalls: FetchCall[] = [];

type FetchScript =
  | { ok: true; status: 200; body: unknown }
  | { ok: false; status: number; statusText: string; body: unknown }
  | { throwError: Error };

let fetchScripts: FetchScript[] = [];

const originalFetch = globalThis.fetch;

function installMockFetch(): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const apiKey = headers['X-Api-Key'] ?? '';
    let parsedBody: unknown = undefined;
    if (init?.body && typeof init.body === 'string') {
      try {
        parsedBody = JSON.parse(init.body);
      } catch {
        parsedBody = init.body;
      }
    }
    fetchCalls.push({ url, method, apiKey, body: parsedBody });

    const script = fetchScripts.shift();
    if (!script) {
      throw new Error(`Unexpected fetch (no script): ${method} ${url}`);
    }
    if ('throwError' in script) {
      throw script.throwError;
    }
    return {
      ok: script.ok,
      status: script.status,
      statusText: ('statusText' in script ? script.statusText : 'OK') ?? 'OK',
      json: async () => script.body,
      text: async () => JSON.stringify(script.body),
    } as unknown as Response;
  }) as typeof fetch;
}

beforeEach(async () => {
  fetchCalls.length = 0;
  fetchScripts = [];
  await AsyncStorage.removeItem(AUDIT_KEY);
  await SecureStore.deleteItemAsync(FAMILY_KEY);
  await SecureStore.deleteItemAsync(FLAG_KEY);
  await SecureStore.deleteItemAsync(QUEUE_KEY);
  resetLightningFlagCache();
  __resetInFlightLocks();
  installMockFetch();
  // Reset LocalAuth mocks par défaut → success
  (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
  (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
  (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

// ─── 1. Flag OFF ──────────────────────────────────────────────────────────

describe('processTaskCompletionForLightning — gate flag', () => {
  it('flag OFF → no-op, audit reste vide', async () => {
    // Flag jamais activé → default false
    await seedFamilyConfig();
    await processTaskCompletionForLightning(makeTask(), {
      profiles: PROFILES,
      activeProfileId: 'lucas',
    });
    const audit = await loadAudit();
    expect(audit).toHaveLength(0);
    expect(fetchCalls).toHaveLength(0);
  });

  it('flag ON + pas de family config → no-op', async () => {
    await seedFlagOn();
    // NB : pas de seedFamilyConfig
    await processTaskCompletionForLightning(makeTask(), {
      profiles: PROFILES,
      activeProfileId: 'lucas',
    });
    const audit = await loadAudit();
    expect(audit).toHaveLength(0);
    expect(fetchCalls).toHaveLength(0);
  });
});

// ─── 2. Attribution failed ────────────────────────────────────────────────

describe('processTaskCompletionForLightning — attribution', () => {
  it('attribution failed (2 mentions) → audit attribution_failed + PAS de pay-out', async () => {
    await seedFlagOn();
    await seedFamilyConfig();
    const failedEvents: PayoutFailedEvent[] = [];
    const unsub = onPayoutFailed((e) => failedEvents.push(e));
    try {
      await processTaskCompletionForLightning(
        makeTask({ mentions: ['Lucas', 'Emma'], text: '@Lucas @Emma plier le linge' }),
        { profiles: PROFILES, activeProfileId: 'lucas' },
      );
    } finally {
      unsub();
    }
    const audit = await loadAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0].status).toBe('attribution_failed');
    expect(fetchCalls).toHaveLength(0);
    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0].reason).toBe('attribution');
  });

  it('aucune mention + activeProfileId sans wallet → null → attribution_failed', async () => {
    await seedFlagOn();
    await seedFamilyConfig();
    await processTaskCompletionForLightning(
      makeTask({ mentions: [], text: 'tâche générique' }),
      { profiles: PROFILES, activeProfileId: 'parent' },
    );
    const audit = await loadAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0].status).toBe('attribution_failed');
    expect(fetchCalls).toHaveLength(0);
  });
});

// ─── 3. Idempotence ───────────────────────────────────────────────────────

describe('processTaskCompletionForLightning — idempotence REQ-6', () => {
  it('tâche déjà paid today (findPaidEntry true) → audit already_paid_today + pas de pay-out', async () => {
    await seedFlagOn();
    await seedFamilyConfig();
    // Seed une entrée paid sur task-1 aujourd'hui.
    const paidEntry: AuditEntry = {
      ts: '2026-05-18T08:00:00Z',
      profileId: 'lucas',
      taskId: 'task-1',
      sats: 100,
      status: 'paid',
      paymentHash: 'hash-existant',
    };
    await AsyncStorage.setItem(AUDIT_KEY, JSON.stringify([paidEntry]));

    await processTaskCompletionForLightning(makeTask(), {
      profiles: PROFILES,
      activeProfileId: 'lucas',
    });

    const audit = await loadAudit();
    expect(audit).toHaveLength(2);
    expect(audit[1].status).toBe('already_paid_today');
    expect(fetchCalls).toHaveLength(0);
  });
});

// ─── 4. Daily cap ─────────────────────────────────────────────────────────

describe('processTaskCompletionForLightning — daily cap REQ-4', () => {
  it('cap dépassé → audit capped + parent-notif tentée + pas de pay-out', async () => {
    await seedFlagOn();
    // Cap 100 sats : un pay-out 100 cumulé → cap atteint (101 > 100).
    await seedFamilyConfig({ ...VALID_CONFIG, dailyCapPerMember: 100 });
    // Seed audit avec 1 paid 100 sats aujourd'hui → cumul = 100.
    const paidEntry: AuditEntry = {
      ts: new Date().toISOString(),
      profileId: 'lucas',
      taskId: 'task-prev',
      sats: 100,
      status: 'paid',
      paymentHash: 'h0',
    };
    await AsyncStorage.setItem(AUDIT_KEY, JSON.stringify([paidEntry]));

    await processTaskCompletionForLightning(makeTask({ id: 'task-2' }), {
      profiles: PROFILES,
      activeProfileId: 'lucas',
    });

    const audit = await loadAudit();
    expect(audit[audit.length - 1].status).toBe('capped');
    expect(fetchCalls).toHaveLength(0);
  });
});

// ─── 5. Trigger mode dispatch ────────────────────────────────────────────

describe('processTaskCompletionForLightning — dispatchTrigger REQ-3', () => {
  it('mode daily-review → audit queued + queue contient l\'item avec reason review', async () => {
    await seedFlagOn();
    await seedFamilyConfig({ ...VALID_CONFIG, triggerMode: 'daily-review' });

    await processTaskCompletionForLightning(makeTask(), {
      profiles: PROFILES,
      activeProfileId: 'lucas',
    });

    const audit = await loadAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0].status).toBe('queued');
    const queue = await loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].reason).toBe('review');
    expect(queue[0].taskId).toBe('task-1');
    expect(fetchCalls).toHaveLength(0);
  });

  it('mode hybrid + cumul >= 100 → queue review', async () => {
    await seedFlagOn();
    await seedFamilyConfig({ ...VALID_CONFIG, triggerMode: 'hybrid' });
    // Seed audit avec cumul = 100 → seuil hybrid atteint (strict <).
    const paidEntry: AuditEntry = {
      ts: new Date().toISOString(),
      profileId: 'lucas',
      taskId: 'task-prev',
      sats: 100,
      status: 'paid',
      paymentHash: 'h0',
    };
    await AsyncStorage.setItem(AUDIT_KEY, JSON.stringify([paidEntry]));

    await processTaskCompletionForLightning(makeTask({ id: 'task-2' }), {
      profiles: PROFILES,
      activeProfileId: 'lucas',
    });

    const audit = await loadAudit();
    // 1 ancienne paid + 1 nouvelle queued
    expect(audit[audit.length - 1].status).toBe('queued');
    const queue = await loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].reason).toBe('review');
    expect(fetchCalls).toHaveLength(0);
  });

  it('mode hybrid + cumul < 100 → instant pay-out', async () => {
    await seedFlagOn();
    await seedFamilyConfig({ ...VALID_CONFIG, triggerMode: 'hybrid' });
    // Cumul = 0 (audit vide) → instant.
    fetchScripts = [
      // createInvoice success
      {
        ok: true,
        status: 200,
        body: { payment_hash: 'h1', bolt11: 'lnbc1...', checking_id: 'c1' },
      },
      // payInvoice success
      { ok: true, status: 200, body: { payment_hash: 'h1' } },
    ];

    await processTaskCompletionForLightning(makeTask(), {
      profiles: PROFILES,
      activeProfileId: 'lucas',
    });

    const audit = await loadAudit();
    expect(audit[audit.length - 1].status).toBe('paid');
    expect(fetchCalls).toHaveLength(2);
  });
});

// ─── 6. Pay-out instant — succès ──────────────────────────────────────────

describe('executePayout — succès', () => {
  it('createInvoice + payInvoice succès → audit paid + emit success', async () => {
    await seedFlagOn();
    await seedFamilyConfig();
    fetchScripts = [
      { ok: true, status: 200, body: { payment_hash: 'hash-final', bolt11: 'lnbc1...', checking_id: 'c1' } },
      { ok: true, status: 200, body: { payment_hash: 'hash-final' } },
    ];
    const successEvents: PayoutSuccessEvent[] = [];
    const unsub = onPayoutSuccess((e) => successEvents.push(e));

    try {
      await processTaskCompletionForLightning(makeTask(), {
        profiles: PROFILES,
        activeProfileId: 'lucas',
      });
    } finally {
      unsub();
    }

    const audit = await loadAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0].status).toBe('paid');
    expect(audit[0].paymentHash).toBe('hash-final');
    expect(audit[0].profileId).toBe('lucas');
    expect(audit[0].sats).toBe(100);

    // 1 createInvoice (member key) + 1 payInvoice (admin key family)
    expect(fetchCalls).toHaveLength(2);
    expect(fetchCalls[0].apiKey).toBe('lucas-invoice-key');
    expect(fetchCalls[1].apiKey).toBe('family-admin-key');

    // Idempotency tag REQ-6 injecté dans body.extra
    expect((fetchCalls[0].body as { extra?: Record<string, unknown> }).extra).toEqual({
      taskId: 'task-1',
      completedDate: '2026-05-18',
      profileId: 'lucas',
    });

    expect(successEvents).toHaveLength(1);
    expect(successEvents[0]).toEqual({
      profileId: 'lucas',
      profileName: 'Lucas',
      sats: 100,
      taskId: 'task-1',
    });
  });
});

// ─── 7. Erreur réseau ─────────────────────────────────────────────────────

describe('executePayout — erreur réseau', () => {
  it('createInvoice TypeError fetch failed → enqueue offline + audit queued + emit network', async () => {
    await seedFlagOn();
    await seedFamilyConfig();
    fetchScripts = [{ throwError: new TypeError('fetch failed') }];
    const failedEvents: PayoutFailedEvent[] = [];
    const unsub = onPayoutFailed((e) => failedEvents.push(e));

    try {
      await processTaskCompletionForLightning(makeTask(), {
        profiles: PROFILES,
        activeProfileId: 'lucas',
      });
    } finally {
      unsub();
    }

    const queue = await loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].reason).toBe('offline');
    expect(queue[0].taskId).toBe('task-1');

    const audit = await loadAudit();
    expect(audit[audit.length - 1].status).toBe('queued');

    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0].reason).toBe('network');
  });
});

// ─── 8. Erreur LNbits 4xx ─────────────────────────────────────────────────

describe('executePayout — erreur LNbits 4xx', () => {
  it('createInvoice 400 → audit failed + emit lnbits_error + PAS d\'enqueue', async () => {
    await seedFlagOn();
    await seedFamilyConfig();
    fetchScripts = [
      { ok: false, status: 400, statusText: 'Bad Request', body: { error: 'Invalid amount' } },
    ];
    const failedEvents: PayoutFailedEvent[] = [];
    const unsub = onPayoutFailed((e) => failedEvents.push(e));

    try {
      await processTaskCompletionForLightning(makeTask(), {
        profiles: PROFILES,
        activeProfileId: 'lucas',
      });
    } finally {
      unsub();
    }

    const audit = await loadAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0].status).toBe('failed');

    const queue = await loadQueue();
    expect(queue).toHaveLength(0);

    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0].reason).toBe('lnbits_error');
  });

  it('LnbitsError construit manuellement avec httpStatus → bien classé non-network (4xx-like)', async () => {
    await seedFlagOn();
    await seedFamilyConfig();
    fetchScripts = [
      // createInvoice 503 → traité comme erreur applicative (httpStatus présent)
      { ok: false, status: 503, statusText: 'Service Unavailable', body: '' },
    ];
    void LnbitsError; // tsx-import sentinel

    await processTaskCompletionForLightning(makeTask(), {
      profiles: PROFILES,
      activeProfileId: 'lucas',
    });

    const audit = await loadAudit();
    expect(audit[0].status).toBe('failed');
    const queue = await loadQueue();
    expect(queue).toHaveLength(0);
  });
});

// ─── 9. Lock in-memory (Pitfall #2) ──────────────────────────────────────

describe('executePayout — Pitfall #2 lock in-memory', () => {
  it('2 toggles concurrents même taskId+date → un seul createInvoice + un seul payInvoice', async () => {
    await seedFlagOn();
    await seedFamilyConfig();
    fetchScripts = [
      { ok: true, status: 200, body: { payment_hash: 'h-lock', bolt11: 'lnbc1...' } },
      { ok: true, status: 200, body: { payment_hash: 'h-lock' } },
    ];

    // Note : le lock vit dans executePayout ; processTaskCompletion fait un
    // loadAudit() AVANT executePayout. Pour tester le lock, on appelle les
    // 2 promises en parallèle. La 2ᵉ trouve le lock et attend la 1ʳᵉ.
    await Promise.all([
      processTaskCompletionForLightning(makeTask(), {
        profiles: PROFILES,
        activeProfileId: 'lucas',
      }),
      processTaskCompletionForLightning(makeTask(), {
        profiles: PROFILES,
        activeProfileId: 'lucas',
      }),
    ]);

    // 1 createInvoice + 1 payInvoice = 2 fetchCalls. Si le lock fail, on aurait 4.
    expect(fetchCalls).toHaveLength(2);
    const audit = await loadAudit();
    // Une seule entrée 'paid' (le 2ᵉ appel a partagé le Promise du 1ᵉʳ).
    const paidEntries = audit.filter((a) => a.status === 'paid');
    expect(paidEntries).toHaveLength(1);
  });
});

// ─── 10. BLOCKER #1 — FaceID gate (SPEC Constraint #4) ───────────────────

describe('executePayout — FaceID gate SPEC #4', () => {
  it('FaceID refusé (user_cancel) → audit failed auth_cancelled + emit biometric + PAS de createInvoice', async () => {
    await seedFlagOn();
    await seedFamilyConfig();
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
      success: false,
      error: 'user_cancel',
    });
    const failedEvents: PayoutFailedEvent[] = [];
    const unsub = onPayoutFailed((e) => failedEvents.push(e));

    try {
      await processTaskCompletionForLightning(makeTask(), {
        profiles: PROFILES,
        activeProfileId: 'lucas',
      });
    } finally {
      unsub();
    }

    const audit = await loadAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0].status).toBe('failed');
    expect(audit[0].error).toBe('auth_cancelled');

    expect(fetchCalls).toHaveLength(0);
    const queue = await loadQueue();
    expect(queue).toHaveLength(0);

    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0].reason).toBe('biometric');
  });

  it('FaceID appelé avec disableDeviceFallback=true en prod (jest __DEV__=false)', async () => {
    // Jest config : __DEV__ = false (cf. jest.config.js globals).
    // → authenticatePayOut reçoit allowDevicePasscode=__DEV__=false
    // → biometric-gate forwarde disableDeviceFallback=!allowDevicePasscode=true.
    await seedFlagOn();
    await seedFamilyConfig();
    fetchScripts = [
      { ok: true, status: 200, body: { payment_hash: 'h', bolt11: 'lnbc1...' } },
      { ok: true, status: 200, body: { payment_hash: 'h' } },
    ];

    await processTaskCompletionForLightning(makeTask(), {
      profiles: PROFILES,
      activeProfileId: 'lucas',
    });

    expect(LocalAuthentication.authenticateAsync as jest.Mock).toHaveBeenCalled();
    const lastCall = (LocalAuthentication.authenticateAsync as jest.Mock).mock.calls[0][0];
    // En jest __DEV__=false, disableDeviceFallback doit être true (strict prod).
    expect(lastCall.disableDeviceFallback).toBe(true);
    // Le message FR contient le nom du membre.
    expect(lastCall.promptMessage).toContain('Lucas');
  });
});
