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
  isLightningEnabled,
  setLightningEnabled,
  resetLightningFlagCache,
} from './feature-flag';
export type {
  LnbitsConfig,
  WalletInfo,
  CreateInvoiceResult,
  PaymentStatus,
  PaymentStatusValue,
} from './types';
export { LnbitsError } from './types';
