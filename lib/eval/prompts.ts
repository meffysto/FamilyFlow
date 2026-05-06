/**
 * lib/eval/prompts.ts — Phase 52-01 (placeholders)
 *
 * Constantes de prompts réservées au LLM-judge (Plan 52-03).
 * Définies ici pour stabiliser les imports — implémentations en 52-03.
 */

// Système : remplit en 52-03 (Haiku 4.5, temp 0, JSON strict).
export const LLM_EVAL_SYSTEM_PROMPT = '';

// Retry durci si premier passage retourne du JSON invalide.
export const LLM_EVAL_RETRY_PROMPT = '';

// Header injecté en haut du prompt de génération en cas de re-roll (Plan 52-02).
export const REROLL_INSTRUCTIONS_HEADER =
  '\n\n## Instructions de correction (re-roll Phase 52)\n\nLa version précédente présentait ces problèmes — corrige-les :\n';
