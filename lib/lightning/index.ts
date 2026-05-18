/**
 * lib/lightning — barrel
 *
 * Phase 53 — module pur Lightning (Plan 01).
 * Le `lib/lightning/credentials.ts` legacy et les playgrounds spike sont
 * retirés en Plan 04 ; ils restent exportés temporairement pour permettre
 * à la migration (Plan 02) et au playground existant de compiler.
 */

// Client REST + helpers unités
export { LnbitsClient, msatToSat, satToMsat } from './lnbits-client';

// Persistance creds (legacy + family)
export {
  loadLnbitsConfig,
  saveLnbitsConfig,
  clearLnbitsConfig,
} from './credentials';
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
export { dispatchTrigger, HYBRID_THRESHOLD_SATS } from './trigger-mode';
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
