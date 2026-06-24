/**
 * entitlements/types.ts — Types partagés du système d'entitlements (Phase 54).
 *
 * Fichier de types purs, zéro import runtime. Convention : union string literals
 * pour les statuts, interfaces pour les objets état.
 */

/** Statut d'achat de l'utilisateur (source de vérité : RevenueCat — D-03). */
export type EntitlementStatus = 'FREE' | 'LIFETIME';

/**
 * Données de quota persistées dans le vault (D-07 — fichier frontmatter dédié).
 * Suit l'iCloud, survit à la réinstall, synchro entre appareils famille.
 */
export interface QuotaData {
  /** Flag grandfather posé une fois au premier lancement payant (D-05). */
  grandfather: boolean;
  /** Date ISO de détection grandfather, ou "" si jamais détecté. */
  grandfatherDetectedAt: string;
  /** Solde du Pack Histoires (crédits IA achetés — D-07). */
  storyCredits: number;
  /** Histoires générées ce mois-ci (cap free tier — D-08). */
  storyUsedThisMonth: number;
  /** Mois LOCAL du dernier reset au format "YYYY-MM" (D-08, Piège 7). */
  storyResetMonth: string;
}

/** État exposé par EntitlementContext (Wave 2, Plan 54-03). */
export interface EntitlementState {
  status: EntitlementStatus;
  isGrandfathered: boolean;
  quota: QuotaData;
  /** Init async terminée (pattern AuthContext). */
  isReady: boolean;
  /** Spinner pendant un achat RevenueCat. */
  isLoadingPurchase: boolean;
}
