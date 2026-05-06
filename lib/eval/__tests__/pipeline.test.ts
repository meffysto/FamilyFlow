/**
 * lib/eval/__tests__/pipeline.test.ts — Phase 52-02 (EVAL-02 + EVAL-07)
 *
 * Vérifie le contrat de runRubricAndMaybeReroll :
 *  - Flag off → no-op strict (zéro appel rubric, zéro appel regenerate, zéro champ quality_*)
 *  - Flag on + pas de hardFail → 1 seul appel rubric, pas de re-roll
 *  - Flag on + hardFail → 1 re-roll (callback appelé exactement 1×)
 *  - Cap strict : 2 hardFails consécutifs ⇒ regenerate appelé EXACTEMENT 1×
 *  - Hint passé à regenerate inclut le header + rerollPromptHint
 *  - regenerate qui throw ⇒ ship version originale + retried=true
 */

import type { BedtimeStory, Profile, StoryVoiceConfig } from '../../types';
import * as featureFlag from '../feature-flag';
import * as rubricModule from '../rubric';
import { runRubricAndMaybeReroll } from '../pipeline';
import { REROLL_INSTRUCTIONS_HEADER } from '../prompts';
import type { RubricResult } from '../types';

const baseVoice: StoryVoiceConfig = { engine: 'expo-speech', language: 'fr' };

const makeStory = (id: string, texte = 'Une histoire.'): BedtimeStory => ({
  id,
  titre: `Story ${id}`,
  enfant: 'Enfant 1',
  enfantId: 'enfant_1',
  univers: 'foret',
  texte,
  date: '2026-05-06',
  duree_lecture: 60,
  voice: baseVoice,
  version: 1,
  sourceFile: `${id}.md`,
});

const makeProfile = (): Profile => ({
  id: 'enfant_1',
  name: 'Enfant 1',
  role: 'enfant',
  avatar: '🐻',
  // Cast minimal — les champs gamification/farm ne sont pas lus par le rubric mocké
  mascotDecorations: [],
  mascotInhabitants: [],
  mascotPlacements: {},
  points: 0,
  coins: 0,
  level: 1,
  streak: 0,
  lootBoxesAvailable: 0,
  multiplier: 1,
  multiplierRemaining: 0,
  pityCounter: 0,
} as Profile);

const okRubric: RubricResult = {
  dimensions: [
    { id: 'longueur', score: 3 },
    { id: 'fin_paisible', score: 3 },
    { id: 'vocabulaire', score: 3 },
    { id: 'anti_clones', score: 3 },
    { id: 'tags_tts', score: 3 },
    { id: 'coherence_saga', score: 3 },
  ],
  hardFail: false,
  softWarnings: [],
  rerollPromptHint: '',
  qualityScore: 10,
};

const hardFailRubric: RubricResult = {
  dimensions: [
    { id: 'longueur', score: 1, reason: 'Trop court' },
    { id: 'fin_paisible', score: 3 },
    { id: 'vocabulaire', score: 2, reason: 'TTR limite' },
    { id: 'anti_clones', score: 3 },
    { id: 'tags_tts', score: 3 },
    { id: 'coherence_saga', score: 3 },
  ],
  hardFail: true,
  softWarnings: ['TTR limite'],
  rerollPromptHint: '- Allonge le texte de moitié.',
  qualityScore: 6.7,
};

describe('Phase 52 — runRubricAndMaybeReroll (EVAL-02, EVAL-07)', () => {
  let isEvalEnabledSpy: jest.SpyInstance;
  let evaluateSpy: jest.SpyInstance;
  let regenerate: jest.Mock<Promise<BedtimeStory>, [string]>;

  beforeEach(() => {
    isEvalEnabledSpy = jest.spyOn(featureFlag, 'isEvalEnabled');
    evaluateSpy = jest.spyOn(rubricModule, 'evaluateStoryDeterministic');
    regenerate = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('flag off : retourne la story telle quelle, zéro champ quality_*, zéro appel rubric/regenerate', async () => {
    isEvalEnabledSpy.mockReturnValue(false);
    const story = makeStory('s1');
    const result = await runRubricAndMaybeReroll(story, makeProfile(), [], regenerate);

    expect(result.story).toBe(story); // même référence
    expect(result.rubric).toBeNull();
    expect(result.retried).toBe(false);
    expect(evaluateSpy).not.toHaveBeenCalled();
    expect(regenerate).not.toHaveBeenCalled();
    // Aucun champ quality_* ajouté
    expect(result.story.quality_score).toBeUndefined();
    expect(result.story.quality_dimensions).toBeUndefined();
    expect(result.story.quality_retried).toBeUndefined();
  });

  it('flag on + pas de hardFail : 1 seul appel rubric, pas de re-roll, champs quality_* persistés', async () => {
    isEvalEnabledSpy.mockReturnValue(true);
    evaluateSpy.mockReturnValue(okRubric);
    const story = makeStory('s2');
    const result = await runRubricAndMaybeReroll(story, makeProfile(), [], regenerate);

    expect(evaluateSpy).toHaveBeenCalledTimes(1);
    expect(regenerate).not.toHaveBeenCalled();
    expect(result.retried).toBe(false);
    expect(result.rubric).toBe(okRubric);
    expect(result.story.quality_score).toBe(10);
    expect(result.story.quality_retried).toBe(false);
    expect(result.story.quality_dimensions).toEqual({
      longueur: 3, fin_paisible: 3, vocabulaire: 3,
      anti_clones: 3, tags_tts: 3, coherence_saga: 3,
    });
    expect(result.story.quality_evaluated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('flag on + hardFail puis ok : 1 re-roll, ship la 2ème version, retried=true', async () => {
    isEvalEnabledSpy.mockReturnValue(true);
    evaluateSpy.mockReturnValueOnce(hardFailRubric).mockReturnValueOnce(okRubric);
    const story1 = makeStory('s1');
    const story2 = makeStory('s2');
    regenerate.mockResolvedValue(story2);

    const result = await runRubricAndMaybeReroll(story1, makeProfile(), [], regenerate);

    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(evaluateSpy).toHaveBeenCalledTimes(2);
    expect(result.retried).toBe(true);
    expect(result.story.id).toBe('s2');
    expect(result.story.quality_retried).toBe(true);
    expect(result.story.quality_score).toBe(10);
  });

  it('cap strict : 2 hardFails ⇒ regenerate appelé EXACTEMENT 1× (pas de 3ème tentative — T-52-02-01)', async () => {
    isEvalEnabledSpy.mockReturnValue(true);
    evaluateSpy.mockReturnValue(hardFailRubric);
    const story1 = makeStory('s1');
    const story2 = makeStory('s2');
    regenerate.mockResolvedValue(story2);

    const result = await runRubricAndMaybeReroll(story1, makeProfile(), [], regenerate);

    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(evaluateSpy).toHaveBeenCalledTimes(2);
    expect(result.retried).toBe(true);
    expect(result.story.id).toBe('s2'); // ship la 2ème même si hardFail
    expect(result.story.quality_retried).toBe(true);
    expect(result.story.quality_issues).toEqual(['TTR limite']);
  });

  it('hint passé à regenerate = REROLL_INSTRUCTIONS_HEADER + rerollPromptHint', async () => {
    isEvalEnabledSpy.mockReturnValue(true);
    evaluateSpy.mockReturnValueOnce(hardFailRubric).mockReturnValueOnce(okRubric);
    regenerate.mockResolvedValue(makeStory('s2'));

    await runRubricAndMaybeReroll(makeStory('s1'), makeProfile(), [], regenerate);

    expect(regenerate).toHaveBeenCalledTimes(1);
    const hintArg = regenerate.mock.calls[0][0];
    expect(hintArg).toContain(REROLL_INSTRUCTIONS_HEADER);
    expect(hintArg).toContain('Allonge le texte de moitié');
  });

  it('regenerate qui throw : ship version originale, retried=true, rubric initial conservé', async () => {
    isEvalEnabledSpy.mockReturnValue(true);
    evaluateSpy.mockReturnValue(hardFailRubric);
    regenerate.mockRejectedValue(new Error('Network error'));
    const story1 = makeStory('s1');

    const result = await runRubricAndMaybeReroll(story1, makeProfile(), [], regenerate);

    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(evaluateSpy).toHaveBeenCalledTimes(1); // pas de 2ème éval (re-roll a foiré)
    expect(result.retried).toBe(true);
    expect(result.story.id).toBe('s1'); // version originale
    expect(result.story.quality_retried).toBe(true);
    expect(result.rubric).toBe(hardFailRubric);
  });

  it('quality_score arrondi à 1 décimale', async () => {
    isEvalEnabledSpy.mockReturnValue(true);
    const oddScoreRubric: RubricResult = { ...okRubric, qualityScore: 8.6666666 };
    evaluateSpy.mockReturnValue(oddScoreRubric);
    const result = await runRubricAndMaybeReroll(makeStory('s1'), makeProfile(), [], regenerate);
    expect(result.story.quality_score).toBe(8.7);
  });
});
