/**
 * craft-engine.test.ts — Tests unitaires pour lib/mascot/craft-engine.ts
 * Couvre : CRAFT_RECIPES, craftItem, sellCraftedItem, sellRawHarvest,
 *          serializeHarvestInventory/parseHarvestInventory,
 *          serializeCraftedItems/parseCraftedItems, canCraft
 */

import {
  CRAFT_RECIPES,
  BUILDING_RESOURCE_VALUE,
  canCraft,
  craftItem,
  sellCraftedItem,
  sellRawHarvest,
  serializeHarvestInventory,
  parseHarvestInventory,
  serializeCraftedItems,
  parseCraftedItems,
} from '../mascot/craft-engine';
import type { HarvestInventory, FarmInventory, CraftRecipe } from '../mascot/types';

// ─── CRAFT_RECIPES ────────────────────────────────────────────────────────────

describe('CRAFT_RECIPES', () => {
  it('contient exactement 4 recettes', () => {
    expect(CRAFT_RECIPES).toHaveLength(4);
  });

  it('contient confiture, gateau, omelette, bouquet', () => {
    const ids = CRAFT_RECIPES.map(r => r.id);
    expect(ids).toContain('confiture');
    expect(ids).toContain('gateau');
    expect(ids).toContain('omelette');
    expect(ids).toContain('bouquet');
  });

  it('chaque recette a un sellValue positif', () => {
    for (const recipe of CRAFT_RECIPES) {
      expect(recipe.sellValue).toBeGreaterThan(0);
    }
  });
});

// ─── canCraft ─────────────────────────────────────────────────────────────────

describe('canCraft', () => {
  it('retourne true si ingredients suffisants (confiture = 2 strawberry)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'confiture')!;
    const harvestInv: HarvestInventory = { strawberry: 2 };
    const farmInv: FarmInventory = { oeuf: 0, lait: 0, farine: 0 };
    expect(canCraft(recipe, harvestInv, farmInv)).toBe(true);
  });

  it('retourne false si ingredients insuffisants', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'confiture')!;
    const harvestInv: HarvestInventory = { strawberry: 1 };
    const farmInv: FarmInventory = { oeuf: 0, lait: 0, farine: 0 };
    expect(canCraft(recipe, harvestInv, farmInv)).toBe(false);
  });

  it('verifie les ressources building (gateau a besoin de farine + oeuf)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'gateau')!;
    const harvestInv: HarvestInventory = { strawberry: 1 };
    const farmInv: FarmInventory = { oeuf: 1, lait: 0, farine: 1 };
    expect(canCraft(recipe, harvestInv, farmInv)).toBe(true);
  });

  it('retourne false si ressource building manquante', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'gateau')!;
    const harvestInv: HarvestInventory = { strawberry: 1 };
    const farmInv: FarmInventory = { oeuf: 0, lait: 0, farine: 1 };
    expect(canCraft(recipe, harvestInv, farmInv)).toBe(false);
  });
});

// ─── craftItem ────────────────────────────────────────────────────────────────

describe('craftItem', () => {
  it('retourne item crafte + deduit ingredients (confiture)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'confiture')!;
    const harvestInv: HarvestInventory = { strawberry: 3 };
    const farmInv: FarmInventory = { oeuf: 0, lait: 0, farine: 0 };

    const result = craftItem(recipe, harvestInv, farmInv);
    expect(result).not.toBeNull();
    expect(result!.harvestInv.strawberry).toBe(1); // 3 - 2
    expect(result!.item.recipeId).toBe('confiture');
    expect(result!.item.craftedAt).toBeTruthy();
  });

  it('retourne null si ingredients insuffisants', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'confiture')!;
    const harvestInv: HarvestInventory = { strawberry: 1 };
    const farmInv: FarmInventory = { oeuf: 0, lait: 0, farine: 0 };

    const result = craftItem(recipe, harvestInv, farmInv);
    expect(result).toBeNull();
  });

  it('ne modifie pas les inventaires si ingredients insuffisants', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'confiture')!;
    const harvestInv: HarvestInventory = { strawberry: 1 };
    const farmInv: FarmInventory = { oeuf: 2, lait: 3, farine: 1 };

    craftItem(recipe, harvestInv, farmInv);
    // Originaux non mutes
    expect(harvestInv.strawberry).toBe(1);
    expect(farmInv.oeuf).toBe(2);
  });

  it('deduit les ressources building (gateau)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'gateau')!;
    const harvestInv: HarvestInventory = { strawberry: 2 };
    const farmInv: FarmInventory = { oeuf: 3, lait: 0, farine: 2 };

    const result = craftItem(recipe, harvestInv, farmInv);
    expect(result).not.toBeNull();
    expect(result!.harvestInv.strawberry).toBe(1);
    expect(result!.farmInv.oeuf).toBe(2);
    expect(result!.farmInv.farine).toBe(1);
    expect(result!.item.recipeId).toBe('gateau');
  });

  it('deduit les ingredients crop et building (omelette)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'omelette')!;
    const harvestInv: HarvestInventory = { tomato: 1 };
    const farmInv: FarmInventory = { oeuf: 2, lait: 0, farine: 0 };

    const result = craftItem(recipe, harvestInv, farmInv);
    expect(result).not.toBeNull();
    expect(result!.harvestInv.tomato).toBe(0);
    expect(result!.farmInv.oeuf).toBe(0);
  });
});

// ─── sellCraftedItem ──────────────────────────────────────────────────────────

describe('sellCraftedItem', () => {
  it('retourne sellValue de la recette confiture (480)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'confiture')!;
    expect(sellCraftedItem(recipe)).toBe(recipe.sellValue);
    expect(sellCraftedItem(recipe)).toBe(480);
  });

  it('retourne sellValue de la recette gateau (380)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'gateau')!;
    expect(sellCraftedItem(recipe)).toBe(380);
  });

  it('retourne sellValue de la recette omelette (280)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'omelette')!;
    expect(sellCraftedItem(recipe)).toBe(280);
  });

  it('retourne sellValue de la recette bouquet (190)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'bouquet')!;
    expect(sellCraftedItem(recipe)).toBe(190);
  });
});

// ─── sellRawHarvest ───────────────────────────────────────────────────────────

describe('sellRawHarvest', () => {
  it('retourne harvestReward pour une culture (strawberry = 120)', () => {
    expect(sellRawHarvest('strawberry')).toBe(120);
  });

  it('retourne harvestReward x5 si golden', () => {
    expect(sellRawHarvest('strawberry', true)).toBe(600);
  });

  it('retourne 0 pour un cropId inconnu', () => {
    expect(sellRawHarvest('unknown')).toBe(0);
  });

  it('retourne harvestReward pour carrot (25)', () => {
    expect(sellRawHarvest('carrot')).toBe(25);
  });
});

// ─── serializeHarvestInventory / parseHarvestInventory ────────────────────────

describe('serializeHarvestInventory / parseHarvestInventory', () => {
  it('round-trip correct', () => {
    const inv: HarvestInventory = { strawberry: 3, wheat: 1, carrot: 0 };
    const csv = serializeHarvestInventory(inv);
    const parsed = parseHarvestInventory(csv);
    // carrot:0 devrait etre filtre ou conserve selon l'impl
    expect(parsed.strawberry).toBe(3);
    expect(parsed.wheat).toBe(1);
  });

  it('parse une chaine vide retourne objet vide', () => {
    const parsed = parseHarvestInventory('');
    expect(Object.keys(parsed)).toHaveLength(0);
  });

  it('parse undefined retourne objet vide', () => {
    const parsed = parseHarvestInventory(undefined);
    expect(Object.keys(parsed)).toHaveLength(0);
  });

  it('serialise un inventaire vide en chaine vide', () => {
    const csv = serializeHarvestInventory({});
    expect(csv).toBe('');
  });
});

// ─── serializeCraftedItems / parseCraftedItems ────────────────────────────────

describe('serializeCraftedItems / parseCraftedItems', () => {
  it('round-trip correct', () => {
    const items = [
      { recipeId: 'confiture', craftedAt: '2024-01-01T00:00:00.000Z' },
      { recipeId: 'gateau', craftedAt: '2024-02-01T12:30:00.000Z' },
    ];
    const csv = serializeCraftedItems(items);
    const parsed = parseCraftedItems(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].recipeId).toBe('confiture');
    expect(parsed[0].craftedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(parsed[1].recipeId).toBe('gateau');
    expect(parsed[1].craftedAt).toBe('2024-02-01T12:30:00.000Z');
  });

  it('parse une chaine vide retourne tableau vide', () => {
    expect(parseCraftedItems('')).toEqual([]);
  });

  it('parse undefined retourne tableau vide', () => {
    expect(parseCraftedItems(undefined)).toEqual([]);
  });

  it('serialise un tableau vide en chaine vide', () => {
    expect(serializeCraftedItems([])).toBe('');
  });
});
