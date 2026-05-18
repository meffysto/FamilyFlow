/**
 * Tests payout-queue — REQ-5 (Phase 53).
 *
 * Couvre :
 *   - enqueue → load retrouve l'item avec attemptCount=0
 *   - incrementAttempt → load retourne attemptCount=1 + lastError
 *   - 5 incrementAttempt successifs → item toujours présent (caller décide du remove)
 *   - removeFromQueue → load ne retourne plus l'item
 *   - 2 items avec reason 'offline' et 'review' → load retourne les 2
 *   - JSON corrompu → load retourne []
 *   - MAX_ATTEMPTS = 5
 */

import * as SecureStore from 'expo-secure-store';
import {
  QUEUE_KEY,
  MAX_ATTEMPTS,
  loadQueue,
  enqueuePayout,
  removeFromQueue,
  incrementAttempt,
  clearQueue,
} from '../payout-queue';

beforeEach(async () => {
  await SecureStore.deleteItemAsync(QUEUE_KEY);
});

describe('enqueuePayout / loadQueue — round-trip', () => {
  it('enqueue puis load retrouve l\'item avec attemptCount=0 et queuedAt ISO', async () => {
    await enqueuePayout({ taskId: 't1', profileId: 'lucas', sats: 100 }, 'offline');
    const queue = await loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      taskId: 't1',
      profileId: 'lucas',
      sats: 100,
      attemptCount: 0,
      reason: 'offline',
    });
    expect(queue[0].queuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('2 items avec reason offline + review → load retourne les 2', async () => {
    await enqueuePayout({ taskId: 't1', profileId: 'lucas', sats: 100 }, 'offline');
    await enqueuePayout({ taskId: 't2', profileId: 'emma', sats: 200 }, 'review');
    const queue = await loadQueue();
    expect(queue).toHaveLength(2);
    expect(queue[0].reason).toBe('offline');
    expect(queue[1].reason).toBe('review');
  });

  it('loadQueue retourne [] si clé absente', async () => {
    expect(await loadQueue()).toEqual([]);
  });

  it('loadQueue retourne [] sur JSON corrompu', async () => {
    await SecureStore.setItemAsync(QUEUE_KEY, '{not json');
    expect(await loadQueue()).toEqual([]);
  });

  it('loadQueue filtre les shapes invalides', async () => {
    await SecureStore.setItemAsync(
      QUEUE_KEY,
      JSON.stringify([
        { taskId: 't1', profileId: 'p', sats: 100, attemptCount: 0, queuedAt: '2026-05-18T08:00:00Z', reason: 'offline' },
        { taskId: 'bad' }, // incomplet
        { taskId: 't2', profileId: 'p', sats: 100, attemptCount: 0, queuedAt: '2026-05-18T08:00:00Z', reason: 'wrong_reason' },
      ]),
    );
    const queue = await loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].taskId).toBe('t1');
  });
});

describe('incrementAttempt', () => {
  it('incrémente attemptCount + écrit lastError', async () => {
    await enqueuePayout({ taskId: 't1', profileId: 'lucas', sats: 100 }, 'offline');
    const updated = await incrementAttempt('t1', 'lucas', 'Network error');
    expect(updated).not.toBeNull();
    expect(updated!.attemptCount).toBe(1);
    expect(updated!.lastError).toBe('Network error');

    const reread = (await loadQueue())[0];
    expect(reread.attemptCount).toBe(1);
    expect(reread.lastError).toBe('Network error');
  });

  it('retourne null si item non trouvé', async () => {
    const result = await incrementAttempt('nonexistent', 'p', 'err');
    expect(result).toBeNull();
  });

  it('5 incrementAttempt successifs → item toujours présent (caller decide remove)', async () => {
    await enqueuePayout({ taskId: 't1', profileId: 'lucas', sats: 100 }, 'offline');
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await incrementAttempt('t1', 'lucas', `try ${i + 1}`);
    }
    const queue = await loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].attemptCount).toBe(MAX_ATTEMPTS);
    expect(queue[0].lastError).toBe('try 5');
  });
});

describe('removeFromQueue', () => {
  it('retire un item par taskId+profileId', async () => {
    await enqueuePayout({ taskId: 't1', profileId: 'lucas', sats: 100 }, 'offline');
    await enqueuePayout({ taskId: 't2', profileId: 'emma', sats: 200 }, 'review');
    await removeFromQueue('t1', 'lucas');
    const queue = await loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].taskId).toBe('t2');
  });

  it('no-op si pas trouvé', async () => {
    await enqueuePayout({ taskId: 't1', profileId: 'lucas', sats: 100 }, 'offline');
    await removeFromQueue('nope', 'no-one');
    expect(await loadQueue()).toHaveLength(1);
  });

  it('même taskId mais profileId différent → ne retire pas', async () => {
    await enqueuePayout({ taskId: 't1', profileId: 'lucas', sats: 100 }, 'offline');
    await enqueuePayout({ taskId: 't1', profileId: 'emma', sats: 100 }, 'offline');
    await removeFromQueue('t1', 'lucas');
    const queue = await loadQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].profileId).toBe('emma');
  });
});

describe('clearQueue', () => {
  it('vide la queue', async () => {
    await enqueuePayout({ taskId: 't1', profileId: 'lucas', sats: 100 }, 'offline');
    await clearQueue();
    expect(await loadQueue()).toEqual([]);
  });
});

describe('MAX_ATTEMPTS', () => {
  it('MAX_ATTEMPTS exporté = 5', () => {
    expect(MAX_ATTEMPTS).toBe(5);
  });
});
