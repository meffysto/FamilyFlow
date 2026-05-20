/**
 * flush-queue — drain de la queue offline pay-outs (Phase 53 Plan 02 / REQ-5).
 *
 * Appelé depuis le 3ᵉ `useEffect` Lightning de `hooks/useVault.ts` :
 *   - 1 fois ~1s après le boot du hook (laisse le réseau se réveiller).
 *   - À chaque AppState 'active' (retour foreground).
 *
 * Comportement :
 *   - Gate `isLightningEnabled()` strict + `loadFamilyConfig()` non null.
 *   - Filtre `reason === 'offline'` UNIQUEMENT. Les items `'review'` (mode
 *     daily-review / hybrid au-dessus du seuil) restent en queue — ils sont
 *     consommés par `PayoutQueueModal` (Plan 03b), pas par le flush auto.
 *   - Pour chaque item offline :
 *       a. Re-resolve wallet (config.members) + profile (deps.profiles).
 *          Manquant → removeFromQueue + audit `'failed'` (cleanup).
 *       b. `executePayout` avec `source: 'flush-offline'` :
 *            - Succès : removeFromQueue + paid++.
 *            - Network error : re-throw par executePayout → ici on
 *              incrementAttempt. Si attemptCount >= 5 → removeFromQueue +
 *              audit `'failed'` + failed++.
 *            - LnbitsError 4xx : executePayout audit déjà `failed` ; on
 *              removeFromQueue (pas de retry sur 4xx) + failed++.
 *   - Retourne `{ paid, remaining, failed }` pour observabilité.
 *
 * Note : `executePayout(source='flush-offline')` ne ré-enqueue PAS sur network
 * error — il re-throw, permettant à flush-queue de gérer incrementAttempt
 * sans doubler la queue. Cf. payout-executor.ts handleError.
 *
 * Errors silencieuses côté caller (useVault AppState handler `.catch(() => {})`).
 */

import type { Profile } from '../types';
import { appendAudit } from './audit-log';
import { loadFamilyConfig } from './family-credentials';
import { isLightningEnabled } from './feature-flag';
import { executePayout, isNetworkError } from './payout-executor';
import { incrementAttempt, loadQueue, MAX_ATTEMPTS, removeFromQueue } from './payout-queue';

export interface FlushQueueDeps {
  profiles: Profile[];
}

export interface FlushQueueResult {
  paid: number;
  remaining: number;
  failed: number;
}

export async function flushOfflineQueue(
  deps: FlushQueueDeps,
): Promise<FlushQueueResult> {
  if (!(await isLightningEnabled())) {
    return { paid: 0, remaining: 0, failed: 0 };
  }
  const config = await loadFamilyConfig();
  if (!config) {
    return { paid: 0, remaining: 0, failed: 0 };
  }

  const queue = await loadQueue();
  const offlineItems = queue.filter((q) => q.reason === 'offline');
  if (offlineItems.length === 0) {
    return { paid: 0, remaining: queue.length, failed: 0 };
  }

  let paid = 0;
  let failed = 0;

  for (const item of offlineItems) {
    const wallet = config.members.find((m) => m.profileId === item.profileId);
    const profile = deps.profiles.find((p) => p.id === item.profileId);

    if (!wallet || !profile) {
      // Wallet ou profil disparu entre l'enqueue et le flush — cleanup.
      await removeFromQueue(item.taskId, item.profileId);
      await appendAudit({
        ts: new Date().toISOString(),
        profileId: item.profileId,
        taskId: item.taskId,
        sats: item.sats,
        status: 'failed',
        error: 'wallet_or_profile_missing',
      });
      failed += 1;
      continue;
    }

    try {
      await executePayout({
        task: {
          id: item.taskId,
          text: '(retry offline)',
          completed: true,
          tags: [],
          mentions: [],
          sourceFile: '',
          lineIndex: -1,
        },
        recipient: { profileId: item.profileId, profile, wallet },
        config,
        source: 'flush-offline',
      });
      await removeFromQueue(item.taskId, item.profileId);
      paid += 1;
    } catch (err) {
      if (isNetworkError(err)) {
        // Toujours offline — incrémenter le compteur d'attempts.
        const updated = await incrementAttempt(
          item.taskId,
          item.profileId,
          err instanceof Error ? err.message : String(err),
        );
        if (updated && updated.attemptCount >= MAX_ATTEMPTS) {
          await removeFromQueue(item.taskId, item.profileId);
          await appendAudit({
            ts: new Date().toISOString(),
            profileId: item.profileId,
            taskId: item.taskId,
            sats: item.sats,
            status: 'failed',
            error: 'max_attempts',
          });
          failed += 1;
        }
      } else {
        // 4xx LNbits ou autre : executePayout a déjà fait appendAudit failed.
        // On retire de la queue (retenter ne sert à rien sur 4xx).
        await removeFromQueue(item.taskId, item.profileId);
        failed += 1;
      }
    }
  }

  const after = await loadQueue();
  return { paid, remaining: after.length, failed };
}
