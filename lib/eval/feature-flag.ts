/**
 * lib/eval/feature-flag.ts — Phase 52 (EVAL-07)
 *
 * Feature flag pipeline d'évaluation auto des stories.
 * OFF par défaut : comportement strictement identique au commit baseline.
 *
 * Activation Phase 52 (3 méthodes) :
 *   1. Modifier DEFAULT_FEATURE_EVAL_ENABLED = true ici + rebuild app
 *      (recommandé production une fois le pipeline validé sur device dev)
 *   2. Appeler setEvalEnabledOverride(true) au boot dans app/_layout.tsx
 *      (test temporaire — l'override vit en mémoire jusqu'à kill de l'app)
 *   3. Brancher un toggle dans le dev menu (more.tsx) qui appelle
 *      setEvalEnabledOverride — chantier futur, persistance expo-secure-store
 *
 * L'override mémoire est utilisé par les tests (setEvalEnabledOverride(true)
 * dans beforeAll) — pas de hack process.env, pas de magic.
 */

const DEFAULT_FEATURE_EVAL_ENABLED = false;

let runtimeOverride: boolean | null = null;

/**
 * Active/désactive le pipeline eval en runtime (settings dev, tests, hot toggle).
 * Passer `null` pour retomber sur le défaut (DEFAULT_FEATURE_EVAL_ENABLED).
 */
export function setEvalEnabledOverride(enabled: boolean | null): void {
  runtimeOverride = enabled;
}

export function isEvalEnabled(): boolean {
  if (runtimeOverride !== null) return runtimeOverride;
  return DEFAULT_FEATURE_EVAL_ENABLED;
}

/**
 * Compat — conserve l'export de la constante pour le code Plan 52-01/02/03
 * qui pourrait l'importer directement. La source de vérité reste isEvalEnabled().
 */
export const FEATURE_EVAL_ENABLED = DEFAULT_FEATURE_EVAL_ENABLED;
