/**
 * lib/lightning — barrel
 * Spike feat/lightning-farm. Voir .planning/spikes/001-lnbits-end-to-end/
 */

export { LnbitsClient, msatToSat, satToMsat } from './lnbits-client';
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
export {
  isLightningEnabled,
  setLightningEnabled,
  resetLightningFlagCache,
} from './feature-flag';
export { authenticatePayOut } from './biometric-gate';
export type { AuthGateOptions, AuthGateResult } from './biometric-gate';
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
