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
  maxCraftableQty,
  sellCraftedItem,
  sellRawHarvest,
  serializeHarvestInventory,
  parseHarvestInventory,
  serializeCraftedItems,
  parseCraftedItems,
} from '../mascot/craft-engine';
import type { HarvestInventory, FarmInventory, CraftRecipe } from '../mascot/types';
import { countItemByGrade } from '../mascot/grade-engine';

// ─── CRAFT_RECIPES ────────────────────────────────────────────────────────────

describe('CRAFT_RECIPES', () => {
  it('contient au moins 20 recettes', () => {
    expect(CRAFT_RECIPES.length).toBeGreaterThanOrEqual(20);
  });

  it('contient toutes les recettes de base', () => {
    const ids = CRAFT_RECIPES.map(r => r.id);
    expect(ids).toContain('soupe');
    expect(ids).toContain('bouquet');
    expect(ids).toContain('crepe');
    expect(ids).toContain('fromage');
    expect(ids).toContain('gratin');
    expect(ids).toContain('omelette');
    expect(ids).toContain('pain');
    expect(ids).toContain('confiture');
    expect(ids).toContain('popcorn');
    expect(ids).toContain('gateau');
    expect(ids).toContain('soupe_citrouille');
    expect(ids).toContain('tarte_citrouille');
    // Recettes ajoutées
    expect(ids).toContain('hydromel');
    expect(ids).toContain('nougat');
    expect(ids).toContain('pain_epices');
    expect(ids).toContain('brioche_tournesol');
    expect(ids).toContain('confiture_royale');
    expect(ids).toContain('risotto_truffe');
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
    const farmInv: FarmInventory = { oeuf: 0, lait: 0, farine: 0, miel: 0 };
    expect(canCraft(recipe, harvestInv, farmInv)).toBe(true);
  });

  it('retourne false si ingredients insuffisants', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'confiture')!;
    const harvestInv: HarvestInventory = { strawberry: 1 };
    const farmInv: FarmInventory = { oeuf: 0, lait: 0, farine: 0, miel: 0 };
    expect(canCraft(recipe, harvestInv, farmInv)).toBe(false);
  });

  it('verifie les ressources building (gateau a besoin de farine + oeuf)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'gateau')!;
    const harvestInv: HarvestInventory = { strawberry: 1 };
    const farmInv: FarmInventory = { oeuf: 1, lait: 0, farine: 1, miel: 0 };
    expect(canCraft(recipe, harvestInv, farmInv)).toBe(true);
  });

  it('retourne false si ressource building manquante', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'gateau')!;
    const harvestInv: HarvestInventory = { strawberry: 1 };
    const farmInv: FarmInventory = { oeuf: 0, lait: 0, farine: 1, miel: 0 };
    expect(canCraft(recipe, harvestInv, farmInv)).toBe(false);
  });
});

// ─── craftItem ────────────────────────────────────────────────────────────────

describe('craftItem', () => {
  it('retourne items crafte + deduit ingredients (confiture)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'confiture')!;
    const harvestInv: HarvestInventory = { strawberry: { ordinaire: 3 } };
    const farmInv: FarmInventory = { oeuf: 0, lait: 0, farine: 0, miel: 0 };

    const result = craftItem(recipe, harvestInv, farmInv);
    expect(result).not.toBeNull();
    expect(countItemByGrade(result!.harvestInv, 'strawberry', 'ordinaire')).toBe(1); // 3 - 2
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].recipeId).toBe('confiture');
    expect(result!.items[0].craftedAt).toBeTruthy();
  });

  it('retourne null si ingredients insuffisants', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'confiture')!;
    const harvestInv: HarvestInventory = { strawberry: 1 };
    const farmInv: FarmInventory = { oeuf: 0, lait: 0, farine: 0, miel: 0 };

    const result = craftItem(recipe, harvestInv, farmInv);
    expect(result).toBeNull();
  });

  it('ne modifie pas les inventaires si ingredients insuffisants', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'confiture')!;
    const harvestInv: HarvestInventory = { strawberry: { ordinaire: 1 } };
    const farmInv: FarmInventory = { oeuf: 2, lait: 3, farine: 1, miel: 0 };

    craftItem(recipe, harvestInv, farmInv);
    // Originaux non mutes
    expect(countItemByGrade(harvestInv, 'strawberry', 'ordinaire')).toBe(1);
    expect(farmInv.oeuf).toBe(2);
  });

  it('deduit les ressources building (gateau)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'gateau')!;
    const harvestInv: HarvestInventory = { strawberry: { ordinaire: 2 } };
    const farmInv: FarmInventory = { oeuf: 3, lait: 0, farine: 2, miel: 0 };

    const result = craftItem(recipe, harvestInv, farmInv);
    expect(result).not.toBeNull();
    expect(countItemByGrade(result!.harvestInv, 'strawberry', 'ordinaire')).toBe(1);
    expect(result!.farmInv.oeuf).toBe(2);
    expect(result!.farmInv.farine).toBe(1);
    expect(result!.items[0].recipeId).toBe('gateau');
  });

  it('deduit les ingredients crop et building (omelette)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'omelette')!;
    const harvestInv: HarvestInventory = { tomato: { ordinaire: 1 } };
    const farmInv: FarmInventory = { oeuf: 2, lait: 0, farine: 0, miel: 0 };

    const result = craftItem(recipe, harvestInv, farmInv);
    expect(result).not.toBeNull();
    expect(countItemByGrade(result!.harvestInv, 'tomato', 'ordinaire')).toBe(0);
    expect(result!.farmInv.oeuf).toBe(0);
  });

  it('crafte N items en une fois (qty=3) — deduit qty × ingredients', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'confiture')!; // 2 strawberry / craft
    const harvestInv: HarvestInventory = { strawberry: { ordinaire: 8 } };
    const farmInv: FarmInventory = { oeuf: 0, lait: 0, farine: 0, miel: 0 };

    const result = craftItem(recipe, harvestInv, farmInv, 3);
    expect(result).not.toBeNull();
    expect(countItemByGrade(result!.harvestInv, 'strawberry', 'ordinaire')).toBe(2); // 8 - 2*3
    expect(result!.items).toHaveLength(3);
    expect(result!.items.every(i => i.recipeId === 'confiture')).toBe(true);
  });

  it('retourne null si qty depasse les ingredients disponibles', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'confiture')!; // 2 strawberry / craft
    const harvestInv: HarvestInventory = { strawberry: { ordinaire: 5 } }; // max 2 craftables
    const farmInv: FarmInventory = { oeuf: 0, lait: 0, farine: 0, miel: 0 };

    const result = craftItem(recipe, harvestInv, farmInv, 3);
    expect(result).toBeNull();
    // Originaux non mutes
    expect(countItemByGrade(harvestInv, 'strawberry', 'ordinaire')).toBe(5);
  });

  it('clamp qty < 1 a 1 (qty=0 traite comme qty=1)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'confiture')!;
    const harvestInv: HarvestInventory = { strawberry: { ordinaire: 3 } };
    const farmInv: FarmInventory = { oeuf: 0, lait: 0, farine: 0, miel: 0 };

    const result = craftItem(recipe, harvestInv, farmInv, 0);
    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(1);
    expect(countItemByGrade(result!.harvestInv, 'strawberry', 'ordinaire')).toBe(1);
  });
});

// ─── maxCraftableQty ──────────────────────────────────────────────────────────

describe('maxCraftableQty', () => {
  it('retourne le min sur tous les ingredients (confiture: 2 strawberry)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'confiture')!;
    const harvestInv: HarvestInventory = { strawberry: 7 }; // floor(7/2) = 3
    const farmInv: FarmInventory = { oeuf: 0, lait: 0, farine: 0, miel: 0 };
    expect(maxCraftableQty(recipe, harvestInv, farmInv)).toBe(3);
  });

  it('retourne 0 si un ingredient manque', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'confiture')!;
    const harvestInv: HarvestInventory = { strawberry: 1 }; // < 2
    const farmInv: FarmInventory = { oeuf: 0, lait: 0, farine: 0, miel: 0 };
    expect(maxCraftableQty(recipe, harvestInv, farmInv)).toBe(0);
  });

  it('combine crop + building resource (gateau: 1 strawberry + 1 oeuf + 1 farine)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'gateau')!;
    const harvestInv: HarvestInventory = { strawberry: 5 };
    const farmInv: FarmInventory = { oeuf: 2, lait: 0, farine: 4, miel: 0 };
    // min(5, 2, 4) = 2
    expect(maxCraftableQty(recipe, harvestInv, farmInv)).toBe(2);
  });
});

// ─── sellCraftedItem ──────────────────────────────────────────────────────────

describe('sellCraftedItem', () => {
  it('retourne sellValue de la recette confiture (460)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'confiture')!;
    expect(sellCraftedItem(recipe)).toBe(recipe.sellValue);
    expect(sellCraftedItem(recipe)).toBe(460);
  });

  it('retourne sellValue de la recette gateau (540)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'gateau')!;
    expect(sellCraftedItem(recipe)).toBe(540);
  });

  it('retourne sellValue de la recette omelette (440)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'omelette')!;
    expect(sellCraftedItem(recipe)).toBe(440);
  });

  it('retourne sellValue de la recette bouquet (200)', () => {
    const recipe = CRAFT_RECIPES.find(r => r.id === 'bouquet')!;
    expect(sellCraftedItem(recipe)).toBe(200);
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
    // Phase B — format gradé + compat ascendante sur les entrées number
    const inv: HarvestInventory = { strawberry: { ordinaire: 3 }, wheat: { ordinaire: 1 }, carrot: { ordinaire: 0 } };
    const csv = serializeHarvestInventory(inv);
    const parsed = parseHarvestInventory(csv);
    // carrot:0 est filtré (qty > 0 seulement)
    expect(countItemByGrade(parsed, 'strawberry', 'ordinaire')).toBe(3);
    expect(countItemByGrade(parsed, 'wheat', 'ordinaire')).toBe(1);
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
