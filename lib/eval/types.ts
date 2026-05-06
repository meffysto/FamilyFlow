/**
 * lib/eval/types.ts — Phase 52-01
 *
 * Types partagés du pipeline d'évaluation auto des histoires du soir.
 * Pure types, zéro logique, zéro I/O.
 */

import type { BedtimeStory, Profile } from '../types';

/** Score d'une dimension : 1 = hard fail, 2 = soft warning, 3 = OK. */
export type DimensionScore = 1 | 2 | 3;

export type DimensionId =
  | 'longueur'
  | 'fin_paisible'
  | 'vocabulaire'
  | 'anti_clones'
  | 'tags_tts'
  | 'coherence_saga';

export interface RubricDimension {
  id: DimensionId;
  score: DimensionScore;
  /** Raison en français — injectable dans prompt re-roll (Plan 52-02). */
  reason?: string;
}

export interface RubricResult {
  dimensions: RubricDimension[];
  /** ≥1 dimension à 1 ⇒ candidat re-roll (Plan 52-02). */
  hardFail: boolean;
  /** Raisons des dim à 2 — loggées au frontmatter. */
  softWarnings: string[];
  /** Texte FR à injecter dans le prompt si re-roll (joining des reasons des dim à 1). */
  rerollPromptHint: string;
  /**
   * Moyenne pondérée 0-10 pour persistence quality_score (EVAL-03).
   * Conversion : score 3 → 10 ; 2 → 6 ; 1 → 2. Moyenne sur les N dimensions.
   */
  qualityScore: number;
}

/**
 * Contexte d'évaluation passé à evaluateStoryDeterministic.
 * `recentStories` : 5 dernières stories de l'enfant (pour D4 anti-clones).
 */
export interface PipelineContext {
  story: BedtimeStory;
  child: Profile;
  recentStories: BedtimeStory[];
}
