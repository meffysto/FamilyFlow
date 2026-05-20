/**
 * Queue offline pay-outs Lightning (REQ-5).
 *
 * Persistance SecureStore (clé `lightning_payout_queue_v1`). La queue
 * reste petite (~5-10 items max en régime — un humain qui complète des
 * tâches ne sature pas un wallet), bien sous la limite SecureStore 2 KB.
 *
 * Deux raisons d'enqueue (A6 RESEARCH — 1 seule clé, champ `reason`) :
 *   - `offline` : réseau indisponible au moment du pay-out
 *   - `review`  : mode 'daily-review' ou hybrid au-dessus du seuil (REQ-3)
 *
 * Cap d'attempts = 5 (SPEC #5 acceptance). Au-delà, le caller (Plan 02
 * flushQueue) doit `removeFromQueue` + écrire audit `'failed'` + notif
 * parent.
 *
 * Validation défensive au load — JSON corrompu retourne [].
 * Logs `__DEV__` only.
 */

import * as SecureStore from 'expo-secure-store';

export const QUEUE_KEY = 'lightning_payout_queue_v1';
export const MAX_ATTEMPTS = 5;

export type PayoutReason = 'offline' | 'review';

export interface PayoutQueueItem {
  taskId: string;
  profileId: string;
  sats: number;
  attemptCount: number;
  lastError?: string;
  /** ISO timestamp */
  queuedAt: string;
  reason: PayoutReason;
}

function isQueueItem(value: unknown): value is PayoutQueueItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.taskId === 'string' &&
    typeof v.profileId === 'string' &&
    typeof v.sats === 'number' &&
    typeof v.attemptCount === 'number' &&
    typeof v.queuedAt === 'string' &&
    (v.reason === 'offline' || v.reason === 'review') &&
    (v.lastError === undefined || typeof v.lastError === 'string')
  );
}

async function writeQueue(items: PayoutQueueItem[]): Promise<void> {
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(items));
}

export async function loadQueue(): Promise<PayoutQueueItem[]> {
  try {
    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQueueItem);
  } catch (err) {
    if (__DEV__) console.warn('[lightning] loadQueue failed:', err);
    return [];
  }
}

export async function enqueuePayout(
  item: Omit<PayoutQueueItem, 'attemptCount' | 'queuedAt' | 'reason'>,
  reason: PayoutReason,
): Promise<void> {
  try {
    const current = await loadQueue();
    const newItem: PayoutQueueItem = {
      taskId: item.taskId,
      profileId: item.profileId,
      sats: item.sats,
      attemptCount: 0,
      queuedAt: new Date().toISOString(),
      reason,
      lastError: item.lastError,
    };
    current.push(newItem);
    await writeQueue(current);
  } catch (err) {
    if (__DEV__) console.warn('[lightning] enqueuePayout failed:', err);
  }
}

export async function removeFromQueue(
  taskId: string,
  profileId: string,
): Promise<void> {
  try {
    const current = await loadQueue();
    const filtered = current.filter(
      (i) => !(i.taskId === taskId && i.profileId === profileId),
    );
    await writeQueue(filtered);
  } catch (err) {
    if (__DEV__) console.warn('[lightning] removeFromQueue failed:', err);
  }
}

/**
 * Incrémente le compteur d'attempts pour un item donné et écrit `lastError`.
 * Retourne l'item mis à jour ou null si pas trouvé.
 *
 * Le caller doit lui-même décider de `removeFromQueue` quand
 * `attemptCount >= MAX_ATTEMPTS` (la fonction ne fait pas le retrait
 * pour permettre au caller d'écrire l'audit 'failed' juste avant).
 */
export async function incrementAttempt(
  taskId: string,
  profileId: string,
  lastError: string,
): Promise<PayoutQueueItem | null> {
  try {
    const current = await loadQueue();
    const idx = current.findIndex(
      (i) => i.taskId === taskId && i.profileId === profileId,
    );
    if (idx === -1) return null;
    const updated: PayoutQueueItem = {
      ...current[idx],
      attemptCount: current[idx].attemptCount + 1,
      lastError,
    };
    current[idx] = updated;
    await writeQueue(current);
    return updated;
  } catch (err) {
    if (__DEV__) console.warn('[lightning] incrementAttempt failed:', err);
    return null;
  }
}

export async function clearQueue(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(QUEUE_KEY);
  } catch (err) {
    if (__DEV__) console.warn('[lightning] clearQueue failed:', err);
  }
}
