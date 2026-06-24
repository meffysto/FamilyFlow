/**
 * entitlement-engine.ts — Logique PURE des entitlements (Phase 54).
 *
 * Zéro dépendance React, zéro RevenueCat, zéro I/O. Uniquement des fonctions pures.
 * C'est ici que la règle d'or IA se vérifie (D-06, D-08, D-09, SC-7) :
 * aucun chemin n'autorise une génération sans slot/crédit/lifetime.
 *
 * Analogue : lib/elevenlabs-quota.ts (cap quotidien, reset au changement de jour LOCAL).
 */

import { format } from 'date-fns';
import type { QuotaData } from './types';

/** Cap dur free tier : 3 histoires/mois (D-08 / SC-4). */
export const FREE_STORIES_PER_MONTH = 3;

/**
 * Mois LOCAL courant au format "YYYY-MM".
 * IMPORTANT : heure locale (date-fns format), jamais de conversion UTC (Piège 7) —
 * sinon décalage de mois en fin de mois sur les timezones négatives.
 */
export function currentLocalMonth(): string {
  return format(new Date(), 'yyyy-MM');
}

/** True si le mois stocké diffère du mois local courant (reset requis). */
export function shouldResetMonth(storedMonth: string): boolean {
  return storedMonth !== currentLocalMonth();
}

/**
 * Peut-on générer une histoire ?
 * LIFETIME : toujours (les crédits illimités côté lifetime ne décomptent pas — D-06).
 * Free tier : true tant qu'il reste un slot gratuit ce mois (après reset éventuel)
 * OU au moins un crédit Pack Histoires. False sinon (règle d'or — SC-7).
 */
export function canGenerateStory(quota: QuotaData, hasLifetime: boolean): boolean {
  if (hasLifetime) return true;
  const used = shouldResetMonth(quota.storyResetMonth) ? 0 : quota.storyUsedThisMonth;
  const freeSlots = Math.max(0, FREE_STORIES_PER_MONTH - used);
  return freeSlots > 0 || quota.storyCredits > 0;
}

/**
 * Décrémente le quota APRÈS un succès de génération (Piège 6 — jamais avant).
 * LIFETIME : quota inchangé (pas de décompte — D-06).
 * Free tier : applique d'abord le reset mensuel si nécessaire, puis épuise les
 * crédits Pack EN PRIORITÉ (D-07), sinon incrémente le compteur mensuel.
 * Immutable (spread).
 */
export function decrementQuota(quota: QuotaData, hasLifetime: boolean): QuotaData {
  if (hasLifetime) return quota;

  const base: QuotaData = shouldResetMonth(quota.storyResetMonth)
    ? { ...quota, storyUsedThisMonth: 0, storyResetMonth: currentLocalMonth() }
    : quota;

  // Priorité : épuiser les crédits Pack avant les slots gratuits.
  if (base.storyCredits > 0) {
    return { ...base, storyCredits: base.storyCredits - 1 };
  }
  return { ...base, storyUsedThisMonth: base.storyUsedThisMonth + 1 };
}

/**
 * Détecte l'éligibilité grandfather (D-05) : true ssi le vault contient déjà du
 * contenu créé avant la version payante. À évaluer une seule fois au premier
 * lancement payant (Pattern 7 — éviter les faux positifs en rejouant la détection).
 */
export function detectGrandfatherEligibility(vaultState: {
  tasks: unknown[];
  meals: unknown[];
  profiles: unknown[];
  memories: unknown[];
}): boolean {
  return (
    vaultState.tasks.length > 0 ||
    vaultState.meals.length > 0 ||
    vaultState.profiles.length > 0 ||
    vaultState.memories.length > 0
  );
}

/** Message d'erreur user-facing (FR) quand le quota est épuisé. */
export function quotaExceededMessage(): string {
  return "Tu as utilisé tes 3 histoires du mois. Recharge avec un Pack Histoires ou passe à FamilyFlow à Vie pour continuer.";
}
