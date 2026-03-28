// ─────────────────────────────────────────────
// Sagas narratives — Moteur de progression
// ─────────────────────────────────────────────

import type {
  Saga,
  SagaProgress,
  SagaTrait,
  SagaChapter,
  SagaCompletionResult,
} from './sagas-types';
import { ALL_TRAITS } from './sagas-types';
import { SAGAS } from './sagas-content';
import { simpleHash } from './utils';

// Re-export pour les consommateurs existants
export { formatDateStr } from './utils';

// ── Traits ───────────────────────────────────

/**
 * Retourne le trait dominant.
 * En cas d'ex-aequo, utilise defaultTrait comme tiebreaker.
 */
export function getDominantTrait(
  traits: Record<SagaTrait, number>,
  defaultTrait: SagaTrait,
): SagaTrait {
  let maxVal = -1;
  let dominant: SagaTrait = defaultTrait;

  for (const trait of ALL_TRAITS) {
    const val = traits[trait] ?? 0;
    if (val > maxVal) {
      maxVal = val;
      dominant = trait;
    } else if (val === maxVal && trait === defaultTrait) {
      // Tiebreak en faveur du trait par défaut
      dominant = defaultTrait;
    }
  }

  return dominant;
}

// ── Résolution narrative ─────────────────────

/**
 * Retourne la clé i18n narrative à utiliser pour un chapitre,
 * en tenant compte des variantes selon le trait dominant.
 */
export function getChapterNarrativeKey(
  chapter: SagaChapter,
  traits: Record<SagaTrait, number>,
  defaultTrait: SagaTrait,
): string {
  if (!chapter.narrativeVariants) return chapter.narrativeKey;

  const dominant = getDominantTrait(traits, defaultTrait);
  return chapter.narrativeVariants[dominant] ?? chapter.narrativeKey;
}

// ── Complétion de saga ───────────────────────

/**
 * Calcule le résultat final d'une saga complétée.
 */
export function getSagaCompletionResult(
  saga: Saga,
  progress: SagaProgress,
): SagaCompletionResult {
  const dominant = getDominantTrait(progress.traits, saga.finale.defaultTrait);

  // Chercher la variante du trait dominant, sinon fallback sur le defaultTrait
  const variant =
    saga.finale.variants[dominant] ??
    saga.finale.variants[saga.finale.defaultTrait];

  if (!variant) {
    // Fallback absolu : première variante disponible
    const firstKey = Object.keys(saga.finale.variants)[0] as SagaTrait;
    const fallback = saga.finale.variants[firstKey]!;
    return {
      dominantTrait: firstKey,
      rewardItemId: fallback.rewardItemId,
      rewardType: fallback.rewardType,
      bonusXP: fallback.bonusXP,
      titleKey: fallback.titleKey,
      narrativeKey: fallback.narrativeKey,
    };
  }

  return {
    dominantTrait: dominant,
    rewardItemId: variant.rewardItemId,
    rewardType: variant.rewardType,
    bonusXP: variant.bonusXP,
    titleKey: variant.titleKey,
    narrativeKey: variant.narrativeKey,
  };
}

// ── Sélection quotidienne ────────────────────

/** Nombre de jours de repos entre deux sagas (0 = enchaînement direct) */
const REST_DAYS_BETWEEN_SAGAS = 0;

/**
 * Calcule le nombre de jours depuis une date de référence.
 */
function daysSince(fromStr: string, toDate: Date): number {
  const from = new Date(fromStr + 'T00:00:00');
  const to = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Détermine si aujourd'hui est un jour de saga ou un jour one-shot.
 *
 * Logique :
 * - Si une saga est en cours (active), on continue
 * - Sinon, après la dernière saga complétée + REST_DAYS, on en commence une nouvelle
 * - Sans historique, on commence la première saga dès le premier jour
 */
export function shouldStartSaga(
  profileId: string,
  completedSagas: string[],
  lastSagaCompletionDate: string | null,
  date: Date = new Date(),
): { start: boolean; sagaId?: string } {
  // S'il n'y a aucune saga de dispo, pas de saga
  if (SAGAS.length === 0) return { start: false };

  // Si aucune saga jamais terminée → démarrer maintenant
  if (completedSagas.length === 0 && !lastSagaCompletionDate) {
    const saga = getNextSagaForProfile(profileId, completedSagas);
    return saga ? { start: true, sagaId: saga.id } : { start: false };
  }

  // Vérifier les jours de repos
  if (lastSagaCompletionDate) {
    const restDays = daysSince(lastSagaCompletionDate, date);
    if (restDays <= REST_DAYS_BETWEEN_SAGAS) {
      return { start: false };
    }
  }

  const saga = getNextSagaForProfile(profileId, completedSagas);
  return saga ? { start: true, sagaId: saga.id } : { start: false };
}

/**
 * Sélectionne la prochaine saga pour un profil.
 * Parcourt les sagas dans l'ordre, saute celles déjà complétées.
 * Quand toutes sont faites, recommence le cycle.
 */
export function getNextSagaForProfile(
  profileId: string,
  completedSagas: string[],
): Saga | null {
  if (SAGAS.length === 0) return null;

  // Sagas non encore complétées
  const remaining = SAGAS.filter(s => !completedSagas.includes(s.id));

  if (remaining.length > 0) {
    // Sélection déterministe parmi les restantes
    const hash = simpleHash(`saga:${profileId}`);
    return remaining[hash % remaining.length];
  }

  // Toutes complétées → recommencer le cycle
  const hash = simpleHash(`saga_cycle:${profileId}:${completedSagas.length}`);
  return SAGAS[hash % SAGAS.length];
}

/**
 * Retourne la prochaine saga pour afficher un teaser (entre les sagas).
 */
export function getNextSagaTeaser(
  profileId: string,
  completedSagas: string[],
): Saga | null {
  return getNextSagaForProfile(profileId, completedSagas);
}

/**
 * Retourne la saga par son ID.
 */
export function getSagaById(sagaId: string): Saga | undefined {
  return SAGAS.find(s => s.id === sagaId);
}

/**
 * Calcule le nombre de jours de repos restants avant la prochaine saga.
 */
export function restDaysRemaining(
  lastSagaCompletionDate: string | null,
  date: Date = new Date(),
): number {
  if (!lastSagaCompletionDate) return 0;
  const elapsed = daysSince(lastSagaCompletionDate, date);
  return Math.max(0, REST_DAYS_BETWEEN_SAGAS - elapsed + 1);
}
