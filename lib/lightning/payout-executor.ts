/**
 * payout-executor — exécution effective du pay-out Lightning (Phase 53 Plan 02).
 *
 * Couvre :
 *   - Lock in-memory `Map<string, Promise<void>>` keyé par `taskId|completedDate`
 *     (Pitfall #2 RESEARCH) : évite le double pay-out sur double-toggle rapide.
 *   - FaceID/TouchID gate AVANT toute opération réseau (SPEC Constraint #4 —
 *     obligatoire pour chaque createInvoice/payInvoice, même en mode instant).
 *   - createInvoice côté MEMBER (X-Api-Key = member.invoiceKey) avec idempotency
 *     tag `extra` (REQ-6 ceinture+bretelles).
 *   - payInvoice côté FAMILY (X-Api-Key = family.adminKey).
 *   - Audit append + emit événement pour la UI (Plan 03).
 *
 * Gestion des erreurs :
 *   - Erreur réseau (TypeError fetch ou LnbitsError sans httpStatus) →
 *       si `source !== 'flush-offline'` : enqueue offline + audit `queued` +
 *       emit `failed/network`.
 *       si `source === 'flush-offline'` : re-throw (le caller flushQueue gère
 *       l'incrementAttempt — pas de re-enqueue).
 *   - LnbitsError avec httpStatus (4xx LNbits rejette) → audit `failed` +
 *       emit `failed/lnbits_error`. PAS d'enqueue (l'invoice est rejetée par
 *       le serveur, retenter ne sert à rien).
 *   - Autre erreur → audit `failed` + emit `failed/lnbits_error` (catch all).
 *
 * Tous les logs sous `if (__DEV__)`. JAMAIS de log de `adminKey`/`invoiceKey`.
 */

import type { Profile, Task } from '../types';
import { appendAudit } from './audit-log';
import { authenticatePayOut } from './biometric-gate';
import { emitPayoutFailed, emitPayoutSuccess } from './lightning-events';
import { LnbitsClient } from './lnbits-client';
import { enqueuePayout } from './payout-queue';
import { LnbitsError, type FamilyLightningConfig, type MemberWalletMapping } from './types';

const inFlightLocks: Map<string, Promise<void>> = new Map();

const PAYOUT_SATS = 100;

export interface ExecutePayoutInput {
  task: Task;
  recipient: {
    profileId: string;
    profile: Profile;
    wallet: MemberWalletMapping;
  };
  config: FamilyLightningConfig;
  /** Source de l'appel — pour décider du comportement d'enqueue en cas de network error. */
  source?: 'listener' | 'flush-offline' | 'flush-review';
  /**
   * D-08 (Plan 03b) — si `true`, SKIPPE le gate FaceID interne car le caller
   * (PayoutQueueModal lors d'une validation batch) a déjà gate UNE SEULE FOIS
   * avant la boucle for…of. Default `false` : tous les appels listener +
   * flush-offline + flush-review individuel passent par leur propre FaceID.
   *
   * Sécurité : ce flag est UNIQUEMENT propagé depuis PayoutQueueModal. Les
   * callers listener (instant) et flush-offline ne le passent JAMAIS.
   */
  bypassBiometric?: boolean;
}

function localTodayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Vrai si l'erreur indique un problème réseau (TypeError fetch failed,
 * timeout, ou LnbitsError sans httpStatus = erreur de connectivité construite
 * par le client).
 */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof LnbitsError) {
    return !err.cause || typeof err.cause.httpStatus !== 'number';
  }
  return false;
}

/**
 * Exécute un pay-out instant (member ← family) avec gate biométrique.
 *
 * Idempotence : le lock in-memory `inFlightLocks` (clé = `taskId|date`)
 * empêche le double-fire sur double-toggle rapide. Le 2ᵉ appel reçoit le
 * Promise du 1ᵉʳ et attend son résolution sans relancer createInvoice.
 *
 * NB : ce lock est intra-session uniquement. La vraie idempotence cross-session
 * est portée par `findPaidEntry(audit)` côté process-task-completion (REQ-6).
 */
export async function executePayout(input: ExecutePayoutInput): Promise<void> {
  const dateKey = input.task.completedDate ?? localTodayISO();
  const lockKey = `${input.task.id}|${dateKey}`;
  const existing = inFlightLocks.get(lockKey);
  if (existing) return existing;
  const promise = doExecute(input, dateKey);
  inFlightLocks.set(lockKey, promise);
  try {
    await promise;
  } finally {
    inFlightLocks.delete(lockKey);
  }
}

async function doExecute(input: ExecutePayoutInput, dateKey: string): Promise<void> {
  const { task, recipient, config, source = 'listener', bypassBiometric = false } = input;

  // 1. FaceID gate AVANT toute opération réseau (SPEC Constraint #4).
  //    `disableDeviceFallback: !__DEV__` → strict en prod (FaceID/TouchID
  //    exclusivement, pas de fallback PIN). En dev (__DEV__=true), fallback
  //    autorisé pour faciliter les tests sur simulateur.
  //    Note : `biometric-gate.ts` utilise un param nommé `allowDevicePasscode`
  //    (inverse logique de `disableDeviceFallback`). On passe `__DEV__` qui
  //    équivaut à `allowDevicePasscode: __DEV__`, soit `disableDeviceFallback: !__DEV__`.
  //
  // D-08 (Plan 03b) — si `bypassBiometric === true`, le caller (PayoutQueueModal
  // batch) a déjà gate FaceID UNE SEULE FOIS avant la boucle for…of. On
  // SKIPPE le gate interne pour éviter N prompts FaceID dans la boucle.
  // Sécurité : ce bypass est UNIQUEMENT autorisé depuis le batch (1 consentement
  // explicite pour N pay-outs simultanés). Le listener (instant) et le flush
  // offline ne propagent JAMAIS bypassBiometric.
  if (!bypassBiometric) {
    const auth = await authenticatePayOut({
      reason: `Pay-out Lightning automatique → ${recipient.profile.name}`,
      allowDevicePasscode: __DEV__,
    });
    if (!auth.success) {
      await appendAudit({
        ts: new Date().toISOString(),
        profileId: recipient.profileId,
        taskId: task.id,
        sats: PAYOUT_SATS,
        status: 'failed',
        error: 'auth_cancelled',
      });
      emitPayoutFailed({
        profileId: recipient.profileId,
        taskId: task.id,
        reason: 'biometric',
      });
      return; // PAS d'enqueue — l'utilisateur a explicitement refusé l'auth.
    }
  }

  // 2. createInvoice côté MEMBER avec idempotency tag (REQ-6 ceinture+bretelles).
  const memberClient = new LnbitsClient({
    baseUrl: config.baseUrl,
    invoiceKey: recipient.wallet.invoiceKey,
  });

  let invoice: { paymentHash: string; bolt11: string };
  try {
    invoice = await memberClient.createInvoice(
      PAYOUT_SATS,
      `Tâche : ${task.text}`,
      {
        taskId: task.id,
        completedDate: dateKey,
        profileId: recipient.profileId,
      },
    );
  } catch (err) {
    await handleError(err, input, dateKey, 'createInvoice');
    return;
  }

  // 3. payInvoice côté FAMILY (admin key). Le client est instancié avec
  //    family.invoiceKey pour la cohérence du constructeur (qui exige
  //    invoiceKey non vide) ; `payInvoice` reçoit l'adminKey en argument
  //    explicite (cf. lnbits-client.ts:172).
  const familyClient = new LnbitsClient({
    baseUrl: config.baseUrl,
    invoiceKey: config.family.invoiceKey || 'unused-for-payInvoice',
  });

  try {
    const paid = await familyClient.payInvoice(invoice.bolt11, config.family.adminKey);
    await appendAudit({
      ts: new Date().toISOString(),
      profileId: recipient.profileId,
      taskId: task.id,
      sats: PAYOUT_SATS,
      status: 'paid',
      paymentHash: paid.paymentHash,
    });
    emitPayoutSuccess({
      profileId: recipient.profileId,
      profileName: recipient.profile.name,
      sats: PAYOUT_SATS,
      taskId: task.id,
    });
  } catch (err) {
    await handleError(err, input, dateKey, 'payInvoice');
    return;
  }
}

/**
 * Gestion centralisée des erreurs : network → enqueue (sauf si on est déjà
 * en train de drainer la queue offline) ; LNbits 4xx → audit failed.
 */
async function handleError(
  err: unknown,
  input: ExecutePayoutInput,
  _dateKey: string,
  _stage: 'createInvoice' | 'payInvoice',
): Promise<void> {
  const { task, recipient, source = 'listener' } = input;
  const errMessage = err instanceof Error ? err.message : String(err);

  if (isNetworkError(err)) {
    if (source === 'flush-offline') {
      // Le caller flushQueue gère incrementAttempt + cap 5.
      throw err instanceof Error ? err : new Error(errMessage);
    }
    // Listener / flush-review → enqueue offline.
    await enqueuePayout(
      {
        taskId: task.id,
        profileId: recipient.profileId,
        sats: PAYOUT_SATS,
        lastError: errMessage,
      },
      'offline',
    );
    await appendAudit({
      ts: new Date().toISOString(),
      profileId: recipient.profileId,
      taskId: task.id,
      sats: PAYOUT_SATS,
      status: 'queued',
      error: errMessage,
    });
    emitPayoutFailed({
      profileId: recipient.profileId,
      taskId: task.id,
      reason: 'network',
      message: errMessage,
    });
    return;
  }

  // LNbits 4xx ou autre erreur applicative : pas d'enqueue, audit failed.
  await appendAudit({
    ts: new Date().toISOString(),
    profileId: recipient.profileId,
    taskId: task.id,
    sats: PAYOUT_SATS,
    status: 'failed',
    error: errMessage,
  });
  emitPayoutFailed({
    profileId: recipient.profileId,
    taskId: task.id,
    reason: 'lnbits_error',
    message: errMessage,
  });
}

/** Test helper — purge le lock map. NE PAS exporter dans le barrel. */
export function __resetInFlightLocks(): void {
  inFlightLocks.clear();
}
