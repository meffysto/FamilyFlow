/**
 * lib/eval/feature-flag.ts — Phase 52 (EVAL-07)
 *
 * Feature flag pipeline d'évaluation auto des stories.
 * ON par défaut depuis activation Phase 52 (rubric + re-roll + LLM-judge async).
 *
 * Désactivation runtime : setEvalEnabledOverride(false) (mémoire jusqu'à kill app).
 * Désactivation permanente : DEFAULT_FEATURE_EVAL_ENABLED = false ici + rebuild.
 *
 * L'override mémoire est utilisé par les tests (setEvalEnabledOverride(true)
 * dans beforeAll) — pas de hack process.env, pas de magic.
 */

const DEFAULT_FEATURE_EVAL_ENABLED = true;

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
