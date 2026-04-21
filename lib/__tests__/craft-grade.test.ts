/**
 * craft-grade.test.ts — Phase B : craft avec règle maillon faible + grade par ingrédient
 *
 * Couvre :
 *  - getDefaultGradeSelection : grade le plus faible possédé suffisant
 *  - canCraftAtGrade : validation par ingrédient+grade
 *  - getCraftOutputGrade : min des grades sélectionnés
 *  - craftItemWithSelection : retrait strict du grade + output au grade maillon faible
 */

import {
  getDefaultGradeSelection,
  canCraftAtGrade,
  getCraftOutputGrade,
  craftItemWithSelection,
} from '../mascot/craft-engine';
import type { CraftRecipe, HarvestInventory, FarmInventory } from '../mascot/types';
import type { HarvestGrade } from '../mascot/grade-engine';

// ── Fixtures ──────────────────────────────────────────────────────────────

const recipeConfiture: CraftRecipe = {
  id: 'confiture',
  labelKey: 'craft.recipe.confiture',
  emoji: '🍓',
  ingredients: [{ itemId: 'strawberry', quantity: 2, source: 'crop' }],
  xpBonus: 20,
  sellValue: 460,
  minTreeStage: 'arbre',
};

const recipeGateau: CraftRecipe = {
  id: 'gateau',
  labelKey: 'craft.recipe.gateau',
  emoji: '🎂',
  ingredients: [
    { itemId: 'wheat', quantity: 1, source: 'crop' },
    { itemId: 'oeuf', quantity: 1, source: 'building' },
  ],
  xpBonus: 30,
  sellValue: 540,
  minTreeStage: 'arbre',
};

const emptyFarmInv: FarmInventory = { oeuf: 10, lait: 10, farine: 10, miel: 10 };

// ── getCraftOutputGrade (maillon faible) ─────────────────────────────────

describe('getCraftOutputGrade — règle maillon faible', () => {
  it('single ingredient : output = grade sélectionné', () => {
    expect(getCraftOutputGrade({ strawberry: 'beau' })).toBe('beau');
    expect(getCraftOutputGrade({ strawberry: 'parfait' })).toBe('parfait');
    expect(getCraftOutputGrade({ strawberry: 'ordinaire' })).toBe('ordinaire');
  });

  it('multi-ingredients : output = grade le plus faible', () => {
    expect(getCraftOutputGrade({ wheat: 'parfait', oeuf: 'ordinaire' })).toBe('ordinaire');
    expect(getCraftOutputGrade({ wheat: 'beau', oeuf: 'superbe' })).toBe('beau');
    expect(getCraftOutputGrade({ wheat: 'superbe', oeuf: 'parfait' })).toBe('superbe');
  });

  it('tous mêmes grades → output identique', () => {
    expect(getCraftOutputGrade({ a: 'beau', b: 'beau', c: 'beau' })).toBe('beau');
  });
});

// ── getDefaultGradeSelection ─────────────────────────────────────────────

describe('getDefaultGradeSelection — default grade le plus faible possédé suffisant', () => {
  it('recette mono-ingrédient : choisit ordinaire si suffisant', () => {
    const inv: HarvestInventory = { strawberry: { ordinaire: 10, beau: 3 } };
    const sel = getDefaultGradeSelection(inv, recipeConfiture);
    expect(sel.strawberry).toBe('ordinaire');
  });

  it('ordinaire insuffisant → remonte à beau', () => {
    const inv: HarvestInventory = { strawberry: { ordinaire: 1, beau: 3 } };
    const sel = getDefaultGradeSelection(inv, recipeConfiture);
    expect(sel.strawberry).toBe('beau');
  });

  it('seul parfait possédé en qty suffisante', () => {
    const inv: HarvestInventory = { strawberry: { parfait: 5 } };
    const sel = getDefaultGradeSelection(inv, recipeConfiture);
    expect(sel.strawberry).toBe('parfait');
  });

  it('fallback ordinaire si aucun grade suffisant', () => {
    const inv: HarvestInventory = { strawberry: { beau: 1 } };
    const sel = getDefaultGradeSelection(inv, recipeConfiture);
    // 1 beau < 2 requis ET pas d'ordinaire → fallback 'ordinaire' (UI grisera)
    expect(sel.strawberry).toBe('ordinaire');
  });

  it('multi-ingrédients : sélection indépendante par ingrédient', () => {
    const inv: HarvestInventory = {
      wheat: { ordinaire: 5 },
      // oeuf est source building, ne doit pas être dans selection
    };
    const sel = getDefaultGradeSelection(inv, recipeGateau);
    expect(sel.wheat).toBe('ordinaire');
    expect(sel.oeuf).toBeUndefined();
  });

  it('multiplier affecte le seuil : recette ×2 double qty requise', () => {
    const inv: HarvestInventory = { strawberry: { ordinaire: 3, beau: 4 } };
    // ×1 : besoin 2 → ordinaire (3 suffit)
    expect(getDefaultGradeSelection(inv, recipeConfiture, 1).strawberry).toBe('ordinaire');
    // ×2 : besoin 4 → ordinaire (3 insuffit) → beau (4 suffit)
    expect(getDefaultGradeSelection(inv, recipeConfiture, 2).strawberry).toBe('beau');
  });
});

// ── canCraftAtGrade ──────────────────────────────────────────────────────

describe('canCraftAtGrade — validation stricte par grade', () => {
  it('canCraft=true quand qty suffisante au grade sélectionné', () => {
    const inv: HarvestInventory = { strawberry: { beau: 5 } };
    const result = canCraftAtGrade(inv, recipeConfiture, { strawberry: 'beau' }, emptyFarmInv);
    expect(result.canCraft).toBe(true);
  });

  it('canCraft=false quand qty insuffisante au grade', () => {
    const inv: HarvestInventory = { strawberry: { beau: 1 } };
    const result = canCraftAtGrade(inv, recipeConfiture, { strawberry: 'beau' }, emptyFarmInv);
    expect(result.canCraft).toBe(false);
    expect(result.missing).toEqual({ itemId: 'strawberry', grade: 'beau', have: 1, need: 2 });
  });

  it('multiplier multiplie le seuil', () => {
    const inv: HarvestInventory = { strawberry: { beau: 3 } };
    // ×2 : besoin 4, have 3 → false
    const r = canCraftAtGrade(inv, recipeConfiture, { strawberry: 'beau' }, emptyFarmInv, 2);
    expect(r.canCraft).toBe(false);
    expect(r.missing?.need).toBe(4);
  });

  it('farm resource manquante → canCraft=false sans grade', () => {
    const inv: HarvestInventory = { wheat: { ordinaire: 5 } };
    const farmEmpty: FarmInventory = { oeuf: 0, lait: 0, farine: 0, miel: 0 };
    const r = canCraftAtGrade(inv, recipeGateau, { wheat: 'ordinaire' }, farmEmpty);
    expect(r.canCraft).toBe(false);
    expect(r.missing?.itemId).toBe('oeuf');
    expect(r.missing?.grade).toBeUndefined();
  });
});

// ── craftItemWithSelection ───────────────────────────────────────────────

describe('craftItemWithSelection — retrait strict grade + output maillon faible', () => {
  it('retire exactement du grade sélectionné', () => {
    const inv: HarvestInventory = { strawberry: { ordinaire: 5, beau: 5 } };
    const result = craftItemWithSelection(recipeConfiture, inv, emptyFarmInv, { strawberry: 'beau' }, 1);
    expect(result).not.toBeNull();
    expect(result!.harvestInv.strawberry).toEqual({ ordinaire: 5, beau: 3 });
  });

  it('output grade = maillon faible des ingrédients', () => {
    const inv: HarvestInventory = {
      wheat: { parfait: 5 },
    };
    const farm: FarmInventory = { oeuf: 5, lait: 0, farine: 0, miel: 0 };
    // wheat parfait + oeuf (source building, pas de grade) → crafted.grade = parfait (seul grade sélectionné)
    const result = craftItemWithSelection(recipeGateau, inv, farm, { wheat: 'parfait' }, 1);
    expect(result).not.toBeNull();
    expect(result!.items[0].grade).toBe('parfait');
  });

  it('retourne null si insuffisant', () => {
    const inv: HarvestInventory = { strawberry: { beau: 1 } };
    const result = craftItemWithSelection(recipeConfiture, inv, emptyFarmInv, { strawberry: 'beau' }, 1);
    expect(result).toBeNull();
  });

  it('craft N items décale les qty N fois', () => {
    const inv: HarvestInventory = { strawberry: { beau: 10 } };
    const result = craftItemWithSelection(recipeConfiture, inv, emptyFarmInv, { strawberry: 'beau' }, 3);
    expect(result).not.toBeNull();
    // 3 items craftés × 2 strawberry = 6 consommés
    expect(result!.harvestInv.strawberry).toEqual({ beau: 4 });
    expect(result!.items).toHaveLength(3);
    expect(result!.items.every(i => i.grade === 'beau')).toBe(true);
  });

  it('ne mute pas les inventaires originaux', () => {
    const inv: HarvestInventory = { strawberry: { beau: 5 } };
    const farm = { ...emptyFarmInv };
    const before = JSON.stringify(inv);
    craftItemWithSelection(recipeConfiture, inv, farm, { strawberry: 'beau' }, 1);
    expect(JSON.stringify(inv)).toBe(before);
  });
});
