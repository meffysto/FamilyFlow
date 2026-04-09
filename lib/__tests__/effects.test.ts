// lib/__tests__/effects.test.ts
// Tests unitaires des 10 handlers d'effets sémantiques + mapping SEMANTIC-06.
// Phase 20 v1.3 Seed — couvre EFFECTS-01..10, SEMANTIC-06, edge cases no-op.

import { applyTaskEffect, EFFECT_GOLDEN_MULTIPLIER } from '../semantic/effects';
import type { EffectId } from '../semantic/effects';
import type { CategoryId, CategoryMatch } from '../semantic/categories';
import type { FarmProfileData } from '../types';
import type { WearEvent } from '../mascot/wear-engine';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** FarmProfileData minimale vide — aucun état ferme existant */
const emptyFarm = (): FarmProfileData => ({
  mascotDecorations: [],
  mascotInhabitants: [],
  mascotPlacements: {},
});

/** Factory CategoryMatch pour les tests */
const match = (id: CategoryId): CategoryMatch => ({
  id,
  matchedBy: 'tag',
  evidence: 'test',
});

/** Date fixe — reproductibilité garantie */
const fixedNow = new Date('2026-04-10T10:00:00Z');

/** Farm avec un weed event actif */
const farmWithWeeds = (): FarmProfileData => ({
  ...emptyFarm(),
  wearEvents: [
    { id: 'w1', type: 'weeds', targetId: '0', startedAt: '2026-04-09T08:00:00Z' },
  ] as WearEvent[],
});

/** Farm avec un broken_fence event actif */
const farmWithWear = (): FarmProfileData => ({
  ...emptyFarm(),
  wearEvents: [
    { id: 'bf1', type: 'broken_fence', targetId: '1', startedAt: '2026-04-09T08:00:00Z' },
  ] as WearEvent[],
});

/** Farm avec toutes les recettes EFFECTS-10 déjà débloquées */
const farmWithAllRecipes = (): FarmProfileData => ({
  ...emptyFarm(),
  unlockedEffectRecipes: ['confiture_truffee', 'gateau_dore', 'elixir_champignon'],
});

/** Farm avec cibles valides pour chaque effet (mapping SEMANTIC-06) */
const farmWithTargets = (): FarmProfileData => ({
  ...emptyFarm(),
  wearEvents: [
    { id: 'w1', type: 'weeds', targetId: '0', startedAt: '2026-04-09T08:00:00Z' },
    { id: 'bf1', type: 'broken_fence', targetId: '1', startedAt: '2026-04-09T08:00:00Z' },
  ] as WearEvent[],
});

// ── SEMANTIC-06 : mapping 1:1 CategoryId → EffectId ─────────────────────────

describe('SEMANTIC-06 — mapping 1:1 CategoryId → EffectId', () => {
  const pairs: [CategoryId, EffectId][] = [
    ['menage_quotidien', 'weeds_removed'],
    ['menage_hebdo',     'wear_repaired'],
    ['courses',          'building_turbo'],
    ['enfants_routines', 'companion_mood'],
    ['enfants_devoirs',  'growth_sprint'],
    ['rendez_vous',      'rare_seed_drop'],
    ['gratitude_famille','saga_trait_boost'],
    ['budget_admin',     'capacity_boost'],
    ['bebe_soins',       'golden_harvest'],
    ['cuisine_repas',    'recipe_unlock'],
  ];

  it.each(pairs)(
    '%s → %s',
    (categoryId, expectedEffectId) => {
      const result = applyTaskEffect(match(categoryId), farmWithTargets(), fixedNow);
      expect(result.effectApplied).toBe(expectedEffectId);
    },
  );
});

// ── EFFECTS-01 — weeds_removed ───────────────────────────────────────────────

describe('EFFECTS-01 — weeds_removed', () => {
  it('retire le weed event quand un weed actif existe', () => {
    const farm = farmWithWeeds();
    const result = applyTaskEffect(match('menage_quotidien'), farm, fixedNow);
    expect(result.effectApplied).toBe('weeds_removed');
    const weedEvent = result.farmData.wearEvents?.find(e => e.id === 'w1');
    expect(weedEvent?.repairedAt).toBeDefined();
  });

  it('retourne effectApplied=null (no-op) quand aucun weed actif', () => {
    const result = applyTaskEffect(match('menage_quotidien'), emptyFarm(), fixedNow);
    expect(result.effectApplied).toBeNull();
    // farmData doit rester identique
    expect(result.farmData).toEqual(emptyFarm());
  });

  it('ne touche pas les wear events non-weeds', () => {
    const farm = farmWithWear(); // broken_fence uniquement
    const result = applyTaskEffect(match('menage_quotidien'), farm, fixedNow);
    expect(result.effectApplied).toBeNull();
  });
});

// ── EFFECTS-02 — wear_repaired ───────────────────────────────────────────────

describe('EFFECTS-02 — wear_repaired', () => {
  it('répare broken_fence en priorité', () => {
    const farm = farmWithWear();
    const result = applyTaskEffect(match('menage_hebdo'), farm, fixedNow);
    expect(result.effectApplied).toBe('wear_repaired');
    const fenceEvent = result.farmData.wearEvents?.find(e => e.id === 'bf1');
    expect(fenceEvent?.repairedAt).toBeDefined();
  });

  it('retourne effectApplied=null (no-op) quand aucun wear event actif', () => {
    const result = applyTaskEffect(match('menage_hebdo'), emptyFarm(), fixedNow);
    expect(result.effectApplied).toBeNull();
  });

  it('ne touche pas les weeds (priorité broken_fence > damaged_roof > pests)', () => {
    const farm = farmWithWeeds(); // weeds uniquement, pas broken_fence
    const result = applyTaskEffect(match('menage_hebdo'), farm, fixedNow);
    expect(result.effectApplied).toBeNull();
  });
});

// ── EFFECTS-03 — building_turbo ──────────────────────────────────────────────

describe('EFFECTS-03 — building_turbo', () => {
  it('définit buildingTurboUntil exactement +24h après fixedNow', () => {
    const result = applyTaskEffect(match('courses'), emptyFarm(), fixedNow);
    expect(result.effectApplied).toBe('building_turbo');
    const until = new Date(result.farmData.buildingTurboUntil!);
    expect(until.getTime() - fixedNow.getTime()).toBe(24 * 3600 * 1000);
  });

  it('retourne farmData avec buildingTurboUntil ISO string', () => {
    const result = applyTaskEffect(match('courses'), emptyFarm(), fixedNow);
    expect(typeof result.farmData.buildingTurboUntil).toBe('string');
  });
});

// ── EFFECTS-04 — companion_mood ──────────────────────────────────────────────

describe('EFFECTS-04 — companion_mood', () => {
  it('retourne companionEvent="task_completed"', () => {
    const result = applyTaskEffect(match('enfants_routines'), emptyFarm(), fixedNow);
    expect(result.effectApplied).toBe('companion_mood');
    expect(result.companionEvent).toBe('task_completed');
  });

  it('ne modifie pas farmData', () => {
    const farm = emptyFarm();
    const result = applyTaskEffect(match('enfants_routines'), farm, fixedNow);
    expect(result.farmData).toEqual(farm);
  });
});

// ── EFFECTS-05 — growth_sprint ───────────────────────────────────────────────

describe('EFFECTS-05 — growth_sprint', () => {
  it('définit growthSprintUntil exactement +24h après fixedNow', () => {
    const result = applyTaskEffect(match('enfants_devoirs'), emptyFarm(), fixedNow);
    expect(result.effectApplied).toBe('growth_sprint');
    const until = new Date(result.farmData.growthSprintUntil!);
    expect(until.getTime() - fixedNow.getTime()).toBe(24 * 3600 * 1000);
  });
});

// ── EFFECTS-06 — rare_seed_drop ──────────────────────────────────────────────

describe('EFFECTS-06 — rare_seed_drop', () => {
  it('incrémente farmRareSeeds avec une graine de la liste', () => {
    const validSeeds = ['orchidee', 'rose_doree', 'truffe'];
    const result = applyTaskEffect(match('rendez_vous'), emptyFarm(), fixedNow);
    expect(result.effectApplied).toBe('rare_seed_drop');
    const seeds = result.farmData.farmRareSeeds as Record<string, number>;
    const addedSeed = Object.keys(seeds)[0];
    expect(validSeeds).toContain(addedSeed);
    expect(seeds[addedSeed]).toBe(1);
  });

  it('message est la graine ajoutée (dans le pool valide)', () => {
    const validSeeds = ['orchidee', 'rose_doree', 'truffe'];
    const result = applyTaskEffect(match('rendez_vous'), emptyFarm(), fixedNow);
    expect(validSeeds).toContain(result.message);
  });

  it('incrémente une graine déjà présente en stock', () => {
    const farm: FarmProfileData = {
      ...emptyFarm(),
      farmRareSeeds: { orchidee: 2 } as Record<string, number>,
    };
    // Forcer le résultat aléatoire en exécutant plusieurs fois — on teste juste
    // que le compteur augmente ou qu'une nouvelle graine est ajoutée
    const result = applyTaskEffect(match('rendez_vous'), farm, fixedNow);
    const totalSeeds = Object.values(result.farmData.farmRareSeeds as Record<string, number>)
      .reduce((a, b) => a + b, 0);
    // Stock avant = 2, après doit être ≥ 3 (au moins +1)
    expect(totalSeeds).toBeGreaterThanOrEqual(3);
  });
});

// ── EFFECTS-07 — saga_trait_boost ────────────────────────────────────────────

describe('EFFECTS-07 — saga_trait_boost', () => {
  it('retourne sagaTraitDelta = { trait: "générosité", amount: 1 }', () => {
    const result = applyTaskEffect(match('gratitude_famille'), emptyFarm(), fixedNow);
    expect(result.effectApplied).toBe('saga_trait_boost');
    expect(result.sagaTraitDelta).toEqual({ trait: 'générosité', amount: 1 });
  });

  it('trait est "générosité" (pas "joy" ou autre)', () => {
    const result = applyTaskEffect(match('gratitude_famille'), emptyFarm(), fixedNow);
    expect(result.sagaTraitDelta?.trait).toBe('générosité');
  });
});

// ── EFFECTS-08 — capacity_boost ──────────────────────────────────────────────

describe('EFFECTS-08 — capacity_boost', () => {
  it('définit capacityBoostUntil exactement +24h après fixedNow', () => {
    const result = applyTaskEffect(match('budget_admin'), emptyFarm(), fixedNow);
    expect(result.effectApplied).toBe('capacity_boost');
    const until = new Date(result.farmData.capacityBoostUntil!);
    expect(until.getTime() - fixedNow.getTime()).toBe(24 * 3600 * 1000);
  });
});

// ── EFFECTS-09 — golden_harvest ──────────────────────────────────────────────

describe('EFFECTS-09 — golden_harvest', () => {
  it('marque nextHarvestGolden = true', () => {
    const result = applyTaskEffect(match('bebe_soins'), emptyFarm(), fixedNow);
    expect(result.effectApplied).toBe('golden_harvest');
    expect(result.farmData.nextHarvestGolden).toBe(true);
  });

  it('EFFECT_GOLDEN_MULTIPLIER vaut 3', () => {
    expect(EFFECT_GOLDEN_MULTIPLIER).toBe(3);
  });
});

// ── EFFECTS-10 — recipe_unlock ───────────────────────────────────────────────

describe('EFFECTS-10 — recipe_unlock', () => {
  const validRecipes = ['confiture_truffee', 'gateau_dore', 'elixir_champignon'];

  it('débloque une recette dans la liste des recettes d\'effet', () => {
    const result = applyTaskEffect(match('cuisine_repas'), emptyFarm(), fixedNow);
    expect(result.effectApplied).toBe('recipe_unlock');
    const unlocked = result.farmData.unlockedEffectRecipes ?? [];
    expect(unlocked).toHaveLength(1);
    expect(validRecipes).toContain(unlocked[0]);
  });

  it('ajoute une nouvelle recette à un stock existant partiel', () => {
    const farm: FarmProfileData = {
      ...emptyFarm(),
      unlockedEffectRecipes: ['confiture_truffee'],
    };
    const result = applyTaskEffect(match('cuisine_repas'), farm, fixedNow);
    expect(result.effectApplied).toBe('recipe_unlock');
    expect(result.farmData.unlockedEffectRecipes).toHaveLength(2);
  });

  it('retourne effectApplied=null (no-op) quand toutes les recettes sont débloquées', () => {
    const result = applyTaskEffect(match('cuisine_repas'), farmWithAllRecipes(), fixedNow);
    expect(result.effectApplied).toBeNull();
    // farmData doit rester identique au stock complet
    expect(result.farmData.unlockedEffectRecipes).toEqual(validRecipes);
  });
});

// ── Immutabilité — aucun handler ne mute farmData ───────────────────────────

describe('Immutabilité — applyTaskEffect retourne un nouvel objet farmData', () => {
  it('ne mute pas farmData original (EFFECTS-03)', () => {
    const farm = emptyFarm();
    const original = { ...farm };
    applyTaskEffect(match('courses'), farm, fixedNow);
    expect(farm).toEqual(original);
  });

  it('ne mute pas farmData original (EFFECTS-09)', () => {
    const farm = emptyFarm();
    applyTaskEffect(match('bebe_soins'), farm, fixedNow);
    expect(farm.nextHarvestGolden).toBeUndefined();
  });
});
