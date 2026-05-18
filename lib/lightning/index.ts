/**
 * lib/lightning — barrel
 *
 * Phase 53 Plan 04 (FINAL) — module Lightning family-only.
 * Le legacy single-wallet et les 2 playgrounds dev de la phase ont été
 * supprimés (REQ-12 acceptance). La migration `migrateSingleToFamily`
 * lit/écrit la clé legacy `lightning_lnbits_config_v1` directement via
 * SecureStore — voir `lib/lightning/migration.ts`.
 */

// Client REST + helpers unités
export { LnbitsClient, msatToSat, satToMsat } from './lnbits-client';

// Persistance creds family-only (Phase 53)
export {
  loadFamilyConfig,
  saveFamilyConfig,
  clearFamilyConfig,
} from './family-credentials';

// Feature flag + gate biométrique
export {
  isLightningEnabled,
  setLightningEnabled,
  resetLightningFlagCache,
} from './feature-flag';
export { authenticatePayOut } from './biometric-gate';
export type { AuthGateOptions, AuthGateResult } from './biometric-gate';

// Types partagés
export type {
  LnbitsConfig,
  WalletInfo,
  CreateInvoiceResult,
  PaymentStatus,
  PaymentStatusValue,
  FamilyLightningConfig,
  MemberWalletMapping,
} from './types';
export { LnbitsError } from './types';

// Phase 53 — résolution destinataire
export { resolveRecipient } from './resolve-recipient';
export type { ResolvedRecipient } from './resolve-recipient';

// Phase 53 — audit log AsyncStorage 90j
export {
  loadAudit,
  appendAudit,
  clearAudit,
  purgeOlderThan,
  findPaidEntry,
  AUDIT_KEY,
  RETENTION_DAYS,
} from './audit-log';
export type { AuditEntry, AuditStatus } from './audit-log';

// Phase 53 — daily cap
export { checkDailyCap, getCumulSatsToday } from './daily-cap';

// Phase 53 — trigger mode
export {
  DEFAULT_HYBRID_THRESHOLD_SATS,
  dispatchTrigger,
  HYBRID_THRESHOLD_MIN_SATS,
  HYBRID_THRESHOLD_SATS,
} from './trigger-mode';
export type { TriggerMode, TriggerDispatch } from './trigger-mode';

// Phase 53 — payout queue
export {
  loadQueue,
  enqueuePayout,
  removeFromQueue,
  incrementAttempt,
  clearQueue,
  QUEUE_KEY,
  MAX_ATTEMPTS,
} from './payout-queue';
export type { PayoutQueueItem, PayoutReason } from './payout-queue';

// Phase 53 — parent notif (D-10)
export { maybeSendParentNotif, buildBody, LAST_NOTIF_KEY } from './parent-notif';
export type { DailySummary, NotifResult } from './parent-notif';

// Phase 53 — migration single→family (REQ-11)
export { migrateSingleToFamily } from './migration';
export type { MigrationOutcome } from './migration';

// Phase 53 — bus d'événements local
export {
  onPayoutSuccess,
  emitPayoutSuccess,
  onPayoutFailed,
  emitPayoutFailed,
} from './lightning-events';
export type {
  PayoutSuccessEvent,
  PayoutFailedEvent,
  PayoutFailedReason,
} from './lightning-events';

// Phase 53 Plan 02 — orchestrateurs runtime (consommés par hooks/useVault.ts)
export { processTaskCompletionForLightning } from './process-task-completion';
export type { ProcessTaskDeps } from './process-task-completion';
export { executePayout, isNetworkError } from './payout-executor';
export type { ExecutePayoutInput } from './payout-executor';
export { flushOfflineQueue } from './flush-queue';
export type { FlushQueueDeps, FlushQueueResult } from './flush-queue';
