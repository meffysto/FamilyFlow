/**
 * lib/eval/pipeline.ts — Phase 52-02 (EVAL-02)
 *
 * Orchestre le rubric déterministe + 1 re-roll cap.
 *
 * Contrat :
 *  - Si isEvalEnabled() === false → no-op (returns story tel quel, rubric:null).
 *  - Sinon, évalue le rubric ; si hardFail, déclenche 1 re-roll via callback,
 *    réévalue, puis ship la 2ème version (cap strict, pas de 3ème tentative).
 *  - La story retournée porte les champs quality_* persistés dans le frontmatter.
 *
 * Garde-fou DoS (T-52-02-01) : `regenerate` est appelée AU MAXIMUM 1 fois par invocation.
 */

import type { BedtimeStory, Profile } from '../types';
import { evaluateStoryDeterministic } from './rubric';
import type { RubricResult } from './types';
import { isEvalEnabled } from './feature-flag';
import { REROLL_INSTRUCTIONS_HEADER } from './prompts';

/**
 * Callback de re-génération injecté par le call site (stories.tsx).
 * Reçoit le hint à append au prompt système, retourne une nouvelle story.
 */
export type RegenerateFn = (rerollHint: string) => Promise<BedtimeStory>;

export interface RubricAndRerollResult {
  /** Story finale (1ère ou 2ème selon re-roll). Inclut les champs quality_*. */
  story: BedtimeStory;
  /** null si flag eval off. Sinon le résultat de la dernière évaluation. */
  rubric: RubricResult | null;
  /** True si un re-roll a effectivement eu lieu. */
  retried: boolean;
}

/**
 * Phase 52 — Évalue le rubric, déclenche 1 re-roll si hardFail, persiste les
 * champs quality_* dans la story retournée.
 *
 * Cap strict : 1 retry. Si la 2ème échoue encore, on ship la 2ème version
 * (par hypothèse au moins aussi bonne — le hint l'a poussée à corriger).
 *
 * - Si isEvalEnabled() === false : retourne `{ story, rubric: null, retried: false }`
 *   immédiatement (EVAL-07 — zéro divergence comportementale).
 * - Si regenerate() throw : ship la 1ère version avec quality_retried=true (le
 *   parent voit qu'un re-roll a été tenté mais a foiré — pas de perte d'info).
 */
export async function runRubricAndMaybeReroll(
  story: BedtimeStory,
  child: Profile,
  recentStories: BedtimeStory[],
  regenerate: RegenerateFn,
): Promise<RubricAndRerollResult> {
  if (!isEvalEnabled()) {
    return { story, rubric: null, retried: false };
  }

  const rubric1 = evaluateStoryDeterministic(story, child, recentStories);
  if (!rubric1.hardFail) {
    return {
      story: applyRubricToStory(story, rubric1, /* retried */ false),
      rubric: rubric1,
      retried: false,
    };
  }

  // Hard fail → 1 re-roll cap (T-52-02-01)
  if (__DEV__) {
    console.log('[eval] hard fail détecté → re-roll', {
      issues: rubric1.softWarnings,
      hint: rubric1.rerollPromptHint,
    });
  }
  const hint = REROLL_INSTRUCTIONS_HEADER + rubric1.rerollPromptHint;
  let story2: BedtimeStory;
  try {
    story2 = await regenerate(hint);
  } catch (e) {
    if (__DEV__) console.warn('[eval] re-roll a échoué, ship version originale', e);
    return {
      story: applyRubricToStory(story, rubric1, /* retried */ true),
      rubric: rubric1,
      retried: true,
    };
  }

  const rubric2 = evaluateStoryDeterministic(story2, child, recentStories);
  // Cap strict : on ship story2 quoi qu'il arrive (pas de 3ème tentative).
  return {
    story: applyRubricToStory(story2, rubric2, /* retried */ true),
    rubric: rubric2,
    retried: true,
  };
}

/**
 * Helper interne : merge les résultats du rubric dans la story (champs quality_*).
 * Pas exporté — usage uniquement par runRubricAndMaybeReroll.
 */
function applyRubricToStory(
  story: BedtimeStory,
  rubric: RubricResult,
  retried: boolean,
): BedtimeStory {
  const dims: NonNullable<BedtimeStory['quality_dimensions']> = {};
  for (const d of rubric.dimensions) {
    dims[d.id] = d.score;
  }
  // Issues persistées : softWarnings si présents, sinon les reasons des dim hardFail.
  const issues = rubric.softWarnings.length > 0
    ? rubric.softWarnings
    : rubric.dimensions.filter((d) => d.score === 1 && d.reason).map((d) => d.reason!);
  return {
    ...story,
    quality_score: Math.round(rubric.qualityScore * 10) / 10,
    quality_dimensions: dims,
    quality_issues: issues.length > 0 ? issues : undefined,
    quality_retried: retried,
    quality_evaluated_at: new Date().toISOString(),
  };
}
