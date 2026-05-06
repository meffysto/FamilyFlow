/**
 * lib/eval/feature-flag.ts — Phase 52-01 (EVAL-07)
 *
 * Feature flag pipeline d'évaluation auto des stories.
 * OFF par défaut : comportement strictement identique au commit baseline.
 * Activation : passer FEATURE_EVAL_ENABLED à true ici, OU exposer un toggle
 * settings (Plan 52-04 — non-régression CI).
 */

export const FEATURE_EVAL_ENABLED = false;

export function isEvalEnabled(): boolean {
  return FEATURE_EVAL_ENABLED;
}
