/**
 * lib/eval/rubric.ts — Phase 52-01
 *
 * Rubric déterministe d'évaluation d'une histoire du soir.
 * Pure synchrone, zéro I/O, zéro réseau — testable offline (golden set Jest).
 *
 * 6 dimensions (cf. .planning/quick/260506-stories-eval-baseline/ANALYSIS.md §122) :
 *   D1 longueur — écart |actual - target| / target vs STORY_LENGTHS[length].words
 *   D2 fin_paisible — dernier paragraphe contient marqueur apaisant ET 0 marqueur d'agitation
 *   D3 vocabulaire — type-token ratio + occurrences "doucement" + clichés FR
 *   D4 anti_clones — n-gram (3-grams) overlap vs 5 dernières stories
 *   D5 tags_tts — leak `[tags]` quand voice.elevenLabsModel ≠ 'eleven_v3'
 *   D6 coherence_saga — placeholder (vraie logique en phase ultérieure)
 *
 * Doit reproduire (en CI Jest) le verdict humain du golden set à ±1 dim près
 * (cf. EVAL-04 — distribution baseline 6 🟢 / 10 🟡 / 4 🔴, soit 14/20 flagged).
 *
 * NOTE corrections vs AI-SPEC :
 *   - `STORY_LENGTHS[length].words` (l'AI-SPEC dit `.targetWords` qui n'existe pas)
 *   - `voice.elevenLabsModel === 'eleven_v3'` (l'AI-SPEC dit `voice.engine === 'eleven_v3'`,
 *     mais StoryVoiceEngine = 'expo-speech' | 'elevenlabs' | 'fish-audio' —
 *     la version v3 est dans elevenLabsModel)
 *   - `child.name` (le projet n'a ni `prenom` ni `nom`, juste `name`)
 */

import type { BedtimeStory, Profile } from '../types';
import { STORY_LENGTHS } from '../stories';
import {
  typeTokenRatio,
  ngramOverlap,
  countOccurrences,
} from './rubric-helpers';
import type {
  RubricDimension,
  RubricResult,
  DimensionScore,
} from './types';

/**
 * Formules-cliché FR repérées dans le golden set baseline (P2 ANALYSIS.md).
 * Présence de ≥2 ⇒ vocabulaire hard fail. Présence de ≥1 ⇒ soft warning.
 */
const CLICHE_FORMULAS: RegExp[] = [
  /tout doucement,\s*tout doucement/i,
  /un pas\.\s*deux pas\.\s*trois pas\./i,
  /petits pieds dans l['']herbe/i,
];

/**
 * Convertit un score de dimension en score 0-10 pour la moyenne qualityScore.
 * 3 → 10 (OK) ; 2 → 6 (limite) ; 1 → 2 (hard fail).
 */
function dimToTen(score: DimensionScore): number {
  return score === 3 ? 10 : score === 2 ? 6 : 2;
}

/**
 * Évalue une story en pure synchrone — pas d'I/O, pas de réseau.
 *
 * @param story — la story à évaluer
 * @param child — le profil enfant (utilisé pour anti-clones via prénom)
 * @param recentStories — 5 dernières stories de l'enfant (pour D4 anti-clones)
 */
export function evaluateStoryDeterministic(
  story: BedtimeStory,
  child: Profile,
  recentStories: BedtimeStory[],
): RubricResult {
  const dims: RubricDimension[] = [];
  const texte = story.texte ?? '';

  // ── D1 — Longueur (cf. ANALYSIS.md §122) ─────────────────────────────
  const lengthKey = story.length ?? 'moyenne';
  const target = STORY_LENGTHS[lengthKey].words;
  const actual = texte.split(/\s+/).filter(Boolean).length;
  const deviation = target > 0 ? Math.abs(actual - target) / target : 0;
  const longueurScore: DimensionScore =
    deviation > 0.35 ? 1 : deviation > 0.20 ? 2 : 3;
  dims.push({
    id: 'longueur',
    score: longueurScore,
    reason:
      longueurScore < 3
        ? `Longueur ${actual} mots vs cible ${target} (écart ${Math.round(deviation * 100)}%)`
        : undefined,
  });

  // ── D2 — Fin paisible ───────────────────────────────────────────────
  const lastPara = texte.split(/\n\n+/).slice(-1)[0] ?? '';
  const hasCalm =
    /(s['']endor|ferme.*yeux|paisible|sommeil|rêve|bonne nuit|en paix|tout en paix|câline?|veillent|veille|nuit toute|nuit (?:est )?(?:toute )?câline|tranquille|berc[eé])/i.test(
      lastPara,
    );
  const hasAgitation = /(crie|cours|peur|frayeur|monstre|sursaute|hurle)/i.test(
    lastPara,
  );
  const finScore: DimensionScore = hasCalm && !hasAgitation ? 3 : 1;
  dims.push({
    id: 'fin_paisible',
    score: finScore,
    reason:
      finScore === 1
        ? hasAgitation
          ? "Marqueur d'agitation dans la fin"
          : 'Fin pas clairement apaisée'
        : undefined,
  });

  // ── D3 — Vocabulaire (TTR + "doucement" + clichés) ───────────────────
  const ttr = typeTokenRatio(texte);
  const doucementCount = countOccurrences(texte, /\bdoucement\b/gi);
  const clicheHits = CLICHE_FORMULAS.filter((re) => re.test(texte)).length;
  const vocabFail = ttr < 0.40 || doucementCount > 7 || clicheHits >= 2;
  const vocabWarn = ttr < 0.45 || doucementCount > 4 || clicheHits >= 1;
  const vocabScore: DimensionScore = vocabFail ? 1 : vocabWarn ? 2 : 3;
  dims.push({
    id: 'vocabulaire',
    score: vocabScore,
    reason:
      vocabScore < 3
        ? `TTR ${ttr.toFixed(2)}, "doucement" ×${doucementCount}, ${clicheHits} cliché(s)`
        : undefined,
  });

  // ── D4 — Anti-clones (n-gram overlap vs 5 dernières) ─────────────────
  const knownNames: string[] = [
    child?.name ?? '',
    ...recentStories.map((s) => s.enfant ?? ''),
  ].filter((s): s is string => Boolean(s));
  const overlaps = recentStories
    .slice(0, 5)
    .map((s) => ngramOverlap(texte, s.texte ?? '', 3, knownNames));
  const maxOverlap = overlaps.length > 0 ? Math.max(...overlaps) : 0;
  const cloneScore: DimensionScore =
    maxOverlap > 0.35 ? 1 : maxOverlap > 0.25 ? 2 : 3;
  dims.push({
    id: 'anti_clones',
    score: cloneScore,
    reason:
      cloneScore < 3
        ? `Overlap 3-grams ${Math.round(maxOverlap * 100)}% avec une story récente`
        : undefined,
  });

  // ── D5 — Tags TTS (hard fail si tags présents et modèle ≠ eleven_v3) ─
  const hasTags = /\[[a-z\s]+\]/i.test(texte);
  const tagsAllowed = story.voice?.elevenLabsModel === 'eleven_v3';
  const tagsScore: DimensionScore = hasTags && !tagsAllowed ? 1 : 3;
  dims.push({
    id: 'tags_tts',
    score: tagsScore,
    reason:
      tagsScore === 1
        ? 'Tags TTS [..] présents alors que modèle ≠ eleven_v3'
        : undefined,
  });

  // ── D6 — Cohérence saga (placeholder — vraie logique en phase ultérieure) ─
  dims.push({ id: 'coherence_saga', score: 3 });

  // ── Agrégation ───────────────────────────────────────────────────────
  const hardFail = dims.some((d) => d.score === 1);
  const softWarnings = dims
    .filter((d) => d.score === 2 && d.reason)
    .map((d) => d.reason!);
  const rerollPromptHint = dims
    .filter((d) => d.score === 1 && d.reason)
    .map((d) => `- ${d.reason}`)
    .join('\n');
  const qualityScore =
    dims.reduce((sum, d) => sum + dimToTen(d.score), 0) / dims.length;

  return {
    dimensions: dims,
    hardFail,
    softWarnings,
    rerollPromptHint,
    qualityScore,
  };
}
