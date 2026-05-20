/**
 * Tests flushOfflineQueue — Phase 53 Plan 02 / REQ-5.
 *
 * Couvre :
 *   - Flag OFF → { paid:0, remaining:0, failed:0 }
 *   - Pas de family config → { paid:0, remaining:0, failed:0 }
 *   - Queue vide → no-op
 *   - 1 item offline + mock success → paid=1, remaining=0
 *   - 1 item review + mock success → review pas drainé (remaining=1)
 *   - 1 item offline + 5 échecs successifs → item retiré + audit failed
 *   - 1 item offline + wallet supprimé entre-temps → item retiré + audit failed
 */

jest.mock('expo-local-authentication', () => {
  return {
    hasHardwareAsync: jest.fn().mockResolvedValue(true),
    isEnrolledAsync: jest.fn().mockResolvedValue(true),
    authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
  };
});

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-id'),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { Profile } from '../../types';
import { AUDIT_KEY, loadAudit } from '../audit-log';
import { resetLightningFlagCache } from '../feature-flag';
import { flushOfflineQueue } from '../flush-queue';
import { __resetInFlightLocks } from '../payout-executor';
import { enqueuePayout, loadQueue, MAX_ATTEMPTS, QUEUE_KEY } from '../payout-queue';
import { type FamilyLightningConfig } from '../types';

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
  ],
  triggerMode: 'instant',
  dailyCapPerMember: 1000,
  hybridThresholdSats: 500,
};

const PROFILES: Profile[] = [{ id: 'lucas', name: 'Lucas' } as Profile];

async function seedFamilyConfig(config: FamilyLightningConfig = VALID_CONFIG): Promise<void> {
  await SecureStore.setItemAsync(FAMILY_KEY, JSON.stringify(config));
}

async function seedFlagOn(): Promise<void> {
  await SecureStore.setItemAsync(FLAG_KEY, '1');
  resetLightningFlagCache();
}

// Fetch mock
interface FetchCall {
  url: string;
  method: string;
  apiKey: string;
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
    fetchCalls.push({ url, method, apiKey });

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
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('flushOfflineQueue — gates', () => {
  it('flag OFF → { paid:0, remaining:0, failed:0 }', async () => {
    // Pas de seedFlagOn
    await seedFamilyConfig();
    await enqueuePayout({ taskId: 't1', profileId: 'lucas', sats: 100 }, 'offline');
    const result = await flushOfflineQueue({ profiles: PROFILES });
    expect(result).toEqual({ paid: 0, remaining: 0, failed: 0 });
    expect(fetchCalls).toHaveLength(0);
  });

  it('flag ON + pas de family config → { paid:0, remaining:0, failed:0 }', async () => {
    await seedFlagOn();
    // Pas de seedFamilyConfig
    await enqueuePayout({ taskId: 't1', profileId: 'lucas', sats: 100 }, 'offline');
    const result = await flushOfflineQueue({ profiles: PROFILES });
    expect(result).toEqual({ paid: 0, remaining: 0, failed: 0 });
    expect(fetchCalls).toHaveLength(0);
  });

  it('queue vide → { paid:0, remaining:0, failed:0 }', async () => {
    await seedFlagOn();
    await seedFamilyConfig();
    const result = await flushOfflineQueue({ profiles: PROFILES });
    expect(result).toEqual({ paid: 0, remaining: 0, failed: 0 });
    expect(fetchCalls).toHaveLength(0);
  });
});

describe('flushOfflineQueue — drain offline items', () => {
  it('1 item offline + mock success → paid=1, remaining=0', async () => {
    await seedFlagOn();
    await seedFamilyConfig();
    await enqueuePayout({ taskId: 't1', profileId: 'lucas', sats: 100 }, 'offline');
    fetchScripts = [
      { ok: true, status: 200, body: { payment_hash: 'h1', bolt11: 'lnbc1...' } },
      { ok: true, status: 200, body: { payment_hash: 'h1' } },
    ];

    const result = await flushOfflineQueue({ profiles: PROFILES });

    expect(result.paid).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.remaining).toBe(0);

    const queue = await loadQueue();
    expect(queue).toHaveLength(0);

    const audit = await loadAudit();
    expect(audit.some((e) => e.status === 'paid')).toBe(true);
  });

  it('1 item review (mode daily-review) + mock success → review pas drainé (remaining=1)', async () => {
    await seedFlagOn();
    await seedFamilyConfig();
    await enqueuePayout({ taskId: 't-review', profileId: 'lucas', sats: 100 }, 'review');

    const result = await flushOfflineQueue({ profiles: PROFILES });

    expect(result.paid).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.remaining).toBe(1);
    expect(fetchCalls).toHaveLength(0);

    const queue = await loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].reason).toBe('review');
  });
});

describe('flushOfflineQueue — retry cap MAX_ATTEMPTS', () => {
  it('5 échecs réseau successifs → item retiré + audit failed + failed=1', async () => {
    await seedFlagOn();
    await seedFamilyConfig();
    await enqueuePayout({ taskId: 't-fail', profileId: 'lucas', sats: 100 }, 'offline');

    // On va appeler flushOfflineQueue 5 fois, à chaque fois avec un TypeError.
    // Au 5ᵉ appel, l'item devrait être retiré.
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      fetchScripts = [{ throwError: new TypeError('fetch failed') }];
      const result = await flushOfflineQueue({ profiles: PROFILES });
      // Avant le 5ᵉ tour : pas encore failed, l'item reste en queue.
      expect(result.paid).toBe(0);
      expect(result.remaining).toBe(1);
    }

    // 5ᵉ tour (le 5ᵉ incrementAttempt fait passer attemptCount à 5 → cap atteint).
    fetchScripts = [{ throwError: new TypeError('fetch failed') }];
    const final = await flushOfflineQueue({ profiles: PROFILES });

    expect(final.paid).toBe(0);
    expect(final.failed).toBe(1);
    expect(final.remaining).toBe(0);

    const queue = await loadQueue();
    expect(queue).toHaveLength(0);

    const audit = await loadAudit();
    const failedEntry = audit.find((e) => e.status === 'failed' && e.error === 'max_attempts');
    expect(failedEntry).toBeTruthy();
    expect(failedEntry?.taskId).toBe('t-fail');
  });
});

describe('flushOfflineQueue — wallet or profile missing', () => {
  it('wallet supprimé entre-temps → item retiré + audit failed', async () => {
    await seedFlagOn();
    // Family sans le membre lucas.
    await seedFamilyConfig({ ...VALID_CONFIG, members: [] });
    await enqueuePayout({ taskId: 't-orphan', profileId: 'lucas', sats: 100 }, 'offline');

    const result = await flushOfflineQueue({ profiles: PROFILES });

    expect(result.paid).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.remaining).toBe(0);

    const queue = await loadQueue();
    expect(queue).toHaveLength(0);

    const audit = await loadAudit();
    const failedEntry = audit.find((e) => e.status === 'failed');
    expect(failedEntry).toBeTruthy();
    expect(failedEntry?.error).toBe('wallet_or_profile_missing');
  });

  it('profile supprimé entre-temps → item retiré + audit failed', async () => {
    await seedFlagOn();
    await seedFamilyConfig(); // a un member lucas
    await enqueuePayout({ taskId: 't-no-prof', profileId: 'lucas', sats: 100 }, 'offline');

    // deps.profiles vide → resolveProfile = undefined
    const result = await flushOfflineQueue({ profiles: [] });

    expect(result.paid).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.remaining).toBe(0);
  });
});
