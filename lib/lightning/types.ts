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

/**
 * Configuration multi-wallet famille — Phase 53.
 *
 * Modèle : le parent crée manuellement N+1 wallets dans son instance LNbits
 * (1 famille + N membres). L'app consomme les keys.
 *
 * - `family.adminKey` : nécessaire UNIQUEMENT pour le pay-out (envoi).
 *   Gardée derrière un gate biométrique (`biometric-gate.ts`).
 * - `family.invoiceKey` : lecture balance famille.
 * - `members[].invoiceKey` : lecture balance membre + création invoice
 *   entrante (la famille paye cette invoice).
 * - `members[].adminKey?` : OPTIONNELLE — si fournie, permet l'encaissement
 *   out depuis le wallet du membre (REQ-10). Gated FaceID en prod.
 *
 * Sans admin key, le membre ne peut que recevoir.
 *
 * Phase 53 — REQ-3 / REQ-4 :
 * - `triggerMode` : mode de déclenchement du pay-out auto (default 'instant').
 * - `dailyCapPerMember` : plafond quotidien par membre, clampé 100-10000
 *   (default 1000). Le check du cap est in-process atomic AVANT tout appel
 *   réseau (SPEC Constraint #6 — plafonnage par construction).
 *
 * REQ-12 : le rename `Child*` → `Member*` est effectif. La rétro-compat
 * pour les utilisateurs déjà configurés se fait au niveau du PARSER
 * (`loadFamilyConfig`) qui accepte les deux shapes en lecture.
 */
export interface FamilyLightningConfig {
  /** URL d'instance LNbits partagée par tous les wallets famille */
  baseUrl: string;
  family: {
    name: string;
    invoiceKey: string;
    adminKey: string;
  };
  members: MemberWalletMapping[];
  /** Mode de déclenchement du pay-out auto (REQ-3) */
  triggerMode: 'instant' | 'daily-review' | 'hybrid';
  /** Plafond quotidien par membre en sats (REQ-4, clamp 100-10000) */
  dailyCapPerMember: number;
}

export interface MemberWalletMapping {
  /** ID du profil dans le vault (correspond à profile.id) */
  profileId: string;
  /** Nom affiché — copié du profil, peut diverger si renommé */
  displayName: string;
  /** Invoice/read key du wallet membre */
  invoiceKey: string;
  /**
   * REQ-10 — Admin key OPTIONNELLE du wallet membre.
   * Sans valeur : encaissement out désactivé pour ce membre.
   * Avec valeur : encaissement out disponible derrière FaceID.
   * Jamais loggée même en `__DEV__`.
   */
  adminKey?: string;
}
