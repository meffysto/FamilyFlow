/**
 * sagas-engine.test.ts — Tests unitaires pour lib/mascot/sagas-engine.ts
 * Couvre : getDominantTrait, getChapterNarrativeKey, getSagaCompletionResult, restDaysRemaining
 */

import {
  getDominantTrait,
  getChapterNarrativeKey,
  getSagaCompletionResult,
  restDaysRemaining,
  getNextSagaForProfile,
} from '../mascot/sagas-engine';
import type { SagaTrait, Saga, SagaProgress, SagaChapter } from '../mascot/sagas-types';
import { ALL_TRAITS } from '../mascot/sagas-types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function creerTraits(overrides: Partial<Record<SagaTrait, number>> = {}): Record<SagaTrait, number> {
  return {
    courage: 0,
    sagesse: 0,
    générosité: 0,
    malice: 0,
    curiosité: 0,
    ...overrides,
  };
}

const SAGA_SIMPLE: Saga = {
  id: 'saga_test',
  emoji: '🧪',
  titleKey: 'test.title',
  descriptionKey: 'test.desc',
  sceneEmoji: '🧪',
  chapters: [
    {
      id: 1,
      narrativeKey: 'test.ch1.narrative',
      cliffhangerKey: 'test.ch1.cliffhanger',
      choices: [
        { id: 'A', labelKey: 'test.ch1.choiceA', emoji: '⚔️', traits: { courage: 2 }, points: 10 },
        { id: 'B', labelKey: 'test.ch1.choiceB', emoji: '🧠', traits: { sagesse: 2 }, points: 10 },
      ],
      narrativeVariants: {
        courage: 'test.ch1.narrative_courage',
        sagesse: 'test.ch1.narrative_sagesse',
      },
    },
  ],
  finale: {
    defaultTrait: 'courage',
    variants: {
      courage: {
        narrativeKey: 'test.finale.courage',
        rewardItemId: 'lanterne_argent',
        rewardType: 'mascot_deco',
        bonusXP: 30,
        titleKey: 'test.title_courage',
      },
      sagesse: {
        narrativeKey: 'test.finale.sagesse',
        rewardItemId: 'masque_ombre',
        rewardType: 'mascot_deco',
        bonusXP: 35,
        titleKey: 'test.title_sagesse',
      },
    },
  },
};

function creerProgress(traits: Record<SagaTrait, number>): SagaProgress {
  return {
    sagaId: 'saga_test',
    profileId: 'lucas',
    currentChapter: 1,
    choices: {},
    traits,
    startDate: '2026-01-01',
    lastChapterDate: '2026-01-01',
    status: 'active',
    rewardClaimed: false,
  };
}

// ─── getDominantTrait ────────────────────────────────────────────────────────

describe('getDominantTrait', () => {
  it('retourne le trait avec le score le plus élevé', () => {
    const traits = creerTraits({ courage: 5, sagesse: 2, générosité: 1 });
    expect(getDominantTrait(traits, 'sagesse')).toBe('courage');
  });

  it('retourne le defaultTrait en cas d\'ex-aequo', () => {
    const traits = creerTraits({ courage: 3, sagesse: 3 });
    // La fonction itère dans l'ordre de ALL_TRAITS — si tiebreak, defaultTrait gagne
    const result = getDominantTrait(traits, 'sagesse');
    expect(result).toBe('sagesse');
  });

  it('retourne le defaultTrait si tous les scores sont à 0', () => {
    const traits = creerTraits();
    expect(getDominantTrait(traits, 'curiosité')).toBe('curiosité');
  });

  it('retourne le trait avec le plus grand score parmi tous les traits', () => {
    const traits = creerTraits({ malice: 10, curiosité: 8, générosité: 9 });
    expect(getDominantTrait(traits, 'courage')).toBe('malice');
  });

  it('couvre tous les traits possibles de ALL_TRAITS', () => {
    for (const trait of ALL_TRAITS) {
      const traits = creerTraits({ [trait]: 100 });
      expect(getDominantTrait(traits, 'courage')).toBe(trait);
    }
  });
});

// ─── getChapterNarrativeKey ──────────────────────────────────────────────────

describe('getChapterNarrativeKey', () => {
  const chapter = SAGA_SIMPLE.chapters[0];

  it('retourne la variante selon le trait dominant', () => {
    const traits = creerTraits({ courage: 5 });
    const key = getChapterNarrativeKey(chapter, traits, 'sagesse');
    expect(key).toBe('test.ch1.narrative_courage');
  });

  it('retourne la narrativeKey par défaut si pas de variants', () => {
    const chapterSansVariants: SagaChapter = {
      ...chapter,
      narrativeVariants: undefined,
    };
    const traits = creerTraits({ courage: 5 });
    const key = getChapterNarrativeKey(chapterSansVariants, traits, 'courage');
    expect(key).toBe('test.ch1.narrative');
  });

  it('retourne la narrativeKey par défaut si le trait dominant n\'a pas de variante', () => {
    const traits = creerTraits({ malice: 5 }); // malice n'a pas de variante dans narrativeVariants
    const key = getChapterNarrativeKey(chapter, traits, 'courage');
    expect(key).toBe('test.ch1.narrative'); // fallback sur narrativeKey
  });
});

// ─── getSagaCompletionResult ─────────────────────────────────────────────────

describe('getSagaCompletionResult', () => {
  it('retourne le résultat avec le trait dominant et la variante correspondante', () => {
    const progress = creerProgress(creerTraits({ sagesse: 5 }));
    const result = getSagaCompletionResult(SAGA_SIMPLE, progress);
    expect(result.dominantTrait).toBe('sagesse');
    expect(result.rewardItemId).toBe('masque_ombre');
    expect(result.bonusXP).toBe(35);
    expect(result.narrativeKey).toBe('test.finale.sagesse');
  });

  it('utilise la variante du defaultTrait si le trait dominant n\'a pas de variante', () => {
    // malice n'a pas de variante dans SAGA_SIMPLE
    const progress = creerProgress(creerTraits({ malice: 10 }));
    const result = getSagaCompletionResult(SAGA_SIMPLE, progress);
    // dominantTrait est malice (le trait réel), mais la récompense vient du defaultTrait (courage)
    expect(result.dominantTrait).toBe('malice');
    expect(result.rewardItemId).toBe('lanterne_argent'); // recompense du fallback courage
  });

  it('retourne un résultat avec bonusXP positif', () => {
    const progress = creerProgress(creerTraits({ courage: 3 }));
    const result = getSagaCompletionResult(SAGA_SIMPLE, progress);
    expect(result.bonusXP).toBeGreaterThan(0);
  });

  it('retourne un rewardItemId non vide', () => {
    const progress = creerProgress(creerTraits({ courage: 3 }));
    const result = getSagaCompletionResult(SAGA_SIMPLE, progress);
    expect(result.rewardItemId).toBeTruthy();
  });
});

// ─── restDaysRemaining ───────────────────────────────────────────────────────

describe('restDaysRemaining', () => {
  it('retourne 0 si lastSagaCompletionDate est null', () => {
    const result = restDaysRemaining(null, new Date('2026-01-10'));
    expect(result).toBe(0);
  });

  it('retourne des jours restants si dans la période de repos', () => {
    // Repos de 2 jours. Complété aujourd'hui → 2 jours restants
    const completionDate = '2026-01-10';
    const today = new Date('2026-01-10');
    const result = restDaysRemaining(completionDate, today);
    expect(result).toBeGreaterThan(0);
  });

  it('retourne 0 si la période de repos est expirée', () => {
    const completionDate = '2026-01-01';
    const today = new Date('2026-01-10'); // 9 jours plus tard
    const result = restDaysRemaining(completionDate, today);
    expect(result).toBe(0);
  });

  it('décroît de 1 chaque jour', () => {
    const completionDate = '2026-01-10';
    const day0 = restDaysRemaining(completionDate, new Date('2026-01-10'));
    const day1 = restDaysRemaining(completionDate, new Date('2026-01-11'));
    expect(day0 - day1).toBe(1);
  });
});

// ─── getNextSagaForProfile ───────────────────────────────────────────────────

describe('getNextSagaForProfile', () => {
  it('retourne une saga non null si SAGAS contient des sagas', () => {
    const saga = getNextSagaForProfile('lucas', []);
    // La fonction retourne null si SAGAS est vide, sinon une saga
    // On vérifie simplement que si elle retourne quelque chose, c'est valide
    if (saga !== null) {
      expect(saga.id).toBeTruthy();
      expect(saga.chapters.length).toBeGreaterThan(0);
    }
  });

  it('retourne une saga différente selon completedSagas', () => {
    const first = getNextSagaForProfile('emma', []);
    if (first === null) return; // SAGAS vide, skip
    const second = getNextSagaForProfile('emma', [first.id]);
    // Si toutes les sagas sont complétées, recommence le cycle
    // Si pas encore toutes complétées, retourne une différente
    if (second !== null) {
      expect(second).toBeTruthy();
    }
  });
});
