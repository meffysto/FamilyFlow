/**
 * Lightning / LNbits — types partagés
 *
 * Spike feat/lightning-farm — voir .planning/spikes/001-lnbits-end-to-end/README.md
 *
 * Note unités : LNbits renvoie la balance en **millisatoshis** (msat).
 * Convention interne : on stocke et on expose en **sats** côté UI.
 * Helpers `msatToSat` / `satToMsat` dans `lnbits-client.ts`.
 */

export interface LnbitsConfig {
  /** URL complète de l'instance LNbits, sans slash final. Ex: https://demo.lnbits.com */
  baseUrl: string;
  /**
   * Invoice/Read key du wallet (PAS l'admin key).
   * Permet : lire balance, créer invoices entrantes.
   * Ne permet PAS : payer une invoice sortante. Surface réduite en cas de fuite.
   */
  invoiceKey: string;
}

export interface WalletInfo {
  /** Nom du wallet côté LNbits */
  name: string;
  /** Balance en **sats** (converti depuis msat) */
  balanceSats: number;
}

export interface CreateInvoiceResult {
  /** Hash de paiement, sert à poller le statut */
  paymentHash: string;
  /** Invoice bolt11 (string lnbc...) à afficher en QR */
  bolt11: string;
  /** ID de checking côté LNbits (utile debug, non utilisé pour le polling) */
  checkingId?: string;
}

export type PaymentStatusValue = 'pending' | 'paid' | 'failed';

export interface PaymentStatus {
  status: PaymentStatusValue;
  /** Présent uniquement si paid */
  preimage?: string;
}

export class LnbitsError extends Error {
  constructor(
    message: string,
    public readonly cause?: { httpStatus?: number; body?: string },
  ) {
    super(message);
    this.name = 'LnbitsError';
  }
}
