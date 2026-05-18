/**
 * process-task-completion — orchestrateur pay-out Lightning (Phase 53 Plan 02).
 *
 * Appelé depuis le 3ᵉ subscriber `subscribeTaskComplete` de `hooks/useVault.ts`
 * sur transition false→true d'une tâche. Exécute le flow complet :
 *
 *   1. Gate flag `isLightningEnabled()` (SPEC Constraint #1 — strict).
 *   2. loadFamilyConfig() — no-op si null.
 *   3. resolveRecipient (mentions / activeProfile fallback — REQ-2).
 *      - null → audit `attribution_failed` + emit `attribution` failed.
 *   4. loadAudit + findPaidEntry — idempotence REQ-6.
 *      - true → audit `already_paid_today`.
 *   5. checkDailyCap atomic (REQ-4).
 *      - capped → audit `capped` + maybeSendParentNotif.
 *   6. dispatchTrigger (instant / queue / hybrid seuil 100 strict — REQ-3).
 *      - 'queue' → enqueuePayout reason='review' + audit `queued`.
 *      - 'instant' → executePayout (gère FaceID + LNbits + audit).
 *
 * Erreurs : le caller (listener useVault) catch globalement. Ici on `await`
 * tout pour garantir l'ordre des écritures audit, mais on n'attrape pas —
 * les erreurs réseau côté `executePayout` sont déjà transformées en
 * `enqueued/failed` audit + emit.
 *
 * Note REQ-6 partial : Plan 02 couvre `paid` / `queued` / `failed` /
 * `already_paid_today` / `capped` / `attribution_failed`. Le statut
 * `undone` (toggle true→false sur tâche déjà payée) est **DEFERRED Plan 04**.
 * Le mécanisme anti-double-payout (`findPaidEntry`) protège déjà contre la
 * re-coche le même jour, donc l'absence de `undone` ne casse pas le SPEC.
 */

import type { Profile, Task } from '../types';
import { appendAudit, findPaidEntry, loadAudit } from './audit-log';
import { checkDailyCap, getCumulSatsToday } from './daily-cap';
import { loadFamilyConfig } from './family-credentials';
import { isLightningEnabled } from './feature-flag';
import { emitPayoutFailed } from './lightning-events';
import { maybeSendParentNotif } from './parent-notif';
import { executePayout } from './payout-executor';
import { enqueuePayout, loadQueue } from './payout-queue';
import { resolveRecipient } from './resolve-recipient';
import { dispatchTrigger } from './trigger-mode';

const PAYOUT_SATS = 100;

export interface ProcessTaskDeps {
  profiles: Profile[];
  activeProfileId: string | null;
}

function localTodayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function processTaskCompletionForLightning(
  task: Task,
  deps: ProcessTaskDeps,
): Promise<void> {
  // 1. Gate flag strict (SPEC Constraint #1).
  if (!(await isLightningEnabled())) return;

  // 2. Family config requise.
  const config = await loadFamilyConfig();
  if (!config) return;

  // 3. Résolution destinataire (REQ-2).
  const recipient = resolveRecipient(
    task,
    deps.profiles,
    config.members,
    deps.activeProfileId,
  );
  if (!recipient) {
    await appendAudit({
      ts: new Date().toISOString(),
      profileId: '',
      taskId: task.id,
      sats: 0,
      status: 'attribution_failed',
    });
    emitPayoutFailed({
      profileId: '',
      taskId: task.id,
      reason: 'attribution',
    });
    return;
  }

  // 4. Idempotence REQ-6 — taskId + completedDate locale.
  const audit = await loadAudit();
  const dateKey = task.completedDate ?? localTodayISO();
  if (findPaidEntry(audit, task.id, dateKey)) {
    await appendAudit({
      ts: new Date().toISOString(),
      profileId: recipient.profileId,
      taskId: task.id,
      sats: 0,
      status: 'already_paid_today',
    });
    return;
  }

  // 5. Daily cap atomic (REQ-4).
  const capDecision = checkDailyCap(
    recipient.profileId,
    PAYOUT_SATS,
    audit,
    config.dailyCapPerMember,
  );
  if (capDecision === 'capped') {
    await appendAudit({
      ts: new Date().toISOString(),
      profileId: recipient.profileId,
      taskId: task.id,
      sats: 0,
      status: 'capped',
    });
    emitPayoutFailed({
      profileId: recipient.profileId,
      taskId: task.id,
      reason: 'capped',
    });
    // Notif parent agrégée D-10 (silencieuse hors plages valides).
    try {
      const queue = await loadQueue();
      await maybeSendParentNotif({
        paidCount: 0,
        cappedProfileNames: [recipient.profile.name],
        failedCount: 0,
        pendingCount: queue.length,
      });
    } catch {
      /* Lightning — non-critical, parent-notif est best-effort */
    }
    return;
  }

  // 6. Dispatch trigger (REQ-3 — instant / queue / hybrid seuil 100 strict).
  const cumul = getCumulSatsToday(recipient.profileId, audit);
  const decision = dispatchTrigger(cumul, config.triggerMode, PAYOUT_SATS);

  if (decision === 'queue') {
    await enqueuePayout(
      {
        taskId: task.id,
        profileId: recipient.profileId,
        sats: PAYOUT_SATS,
      },
      'review',
    );
    await appendAudit({
      ts: new Date().toISOString(),
      profileId: recipient.profileId,
      taskId: task.id,
      sats: PAYOUT_SATS,
      status: 'queued',
    });
    return;
  }

  // decision === 'instant' → pay-out effectif (FaceID + LNbits + audit `paid`/`failed`).
  await executePayout({
    task,
    recipient,
    config,
    source: 'listener',
  });
}
