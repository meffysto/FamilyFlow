// ─────────────────────────────────────────────
// Craft — Moteur de recettes et vente
// ─────────────────────────────────────────────

import {
  CROP_CATALOG,
  type CraftRecipe,
  type CraftedItem,
  type HarvestInventory,
  type FarmInventory,
  type ResourceType,
  type RareSeedInventory,
} from './types';
import { GOLDEN_HARVEST_MULTIPLIER } from './farm-engine';

// ── Valeurs de base des ressources batiment (pour calcul sellValue) ──

export const BUILDING_RESOURCE_VALUE: Record<ResourceType, number> = {
  oeuf: 80,
  lait: 100,
  farine: 90,
  miel: 120,
};

// ── Catalogue de recettes ────────────────────────────────────────────

export const CRAFT_RECIPES: CraftRecipe[] = [
  // ── Pousse (niv 3-5) — crops de base + poulailler ──
  {
    id: 'soupe',
    labelKey: 'craft.recipe.soupe',
    emoji: '🥣',
    ingredients: [
      { itemId: 'carrot', quantity: 1, source: 'crop' },
      { itemId: 'potato', quantity: 1, source: 'crop' },
    ],
    xpBonus: 5,
    sellValue: 120, // (25+35) x 2
    minTreeStage: 'pousse',
  },
  {
    id: 'bouquet',
    labelKey: 'craft.recipe.bouquet',
    emoji: '💐',
    ingredients: [
      { itemId: 'cabbage', quantity: 1, source: 'crop' },
      { itemId: 'carrot', quantity: 1, source: 'crop' },
    ],
    xpBonus: 10,
    sellValue: 190, // (70+25) x 2
    minTreeStage: 'pousse',
  },
  {
    id: 'crepe',
    labelKey: 'craft.recipe.crepe',
    emoji: '🥞',
    ingredients: [
      { itemId: 'oeuf', quantity: 1, source: 'building' },
      { itemId: 'wheat', quantity: 1, source: 'crop' },
    ],
    xpBonus: 10,
    sellValue: 240, // (80+40) x 2
    minTreeStage: 'pousse',
  },
  // ── Arbuste (niv 6-10) — grange + tomate/chou/concombre ──
  {
    id: 'fromage',
    labelKey: 'craft.recipe.fromage',
    emoji: '🧀',
    ingredients: [
      { itemId: 'lait', quantity: 2, source: 'building' },
    ],
    xpBonus: 15,
    sellValue: 400, // (100+100) x 2
    minTreeStage: 'arbuste',
  },
  {
    id: 'gratin',
    labelKey: 'craft.recipe.gratin',
    emoji: '🫕',
    ingredients: [
      { itemId: 'lait', quantity: 1, source: 'building' },
      { itemId: 'potato', quantity: 1, source: 'crop' },
      { itemId: 'oeuf', quantity: 1, source: 'building' },
    ],
    xpBonus: 15,
    sellValue: 430, // (100+35+80) x 2
    minTreeStage: 'arbuste',
  },
  {
    id: 'omelette',
    labelKey: 'craft.recipe.omelette',
    emoji: '🍳',
    ingredients: [
      { itemId: 'oeuf', quantity: 2, source: 'building' },
      { itemId: 'tomato', quantity: 1, source: 'crop' },
    ],
    xpBonus: 15,
    sellValue: 520, // (80+80+80) x 2
    minTreeStage: 'arbuste',
  },
  {
    id: 'hydromel',
    labelKey: 'craft.recipe.hydromel',
    emoji: '🍯',
    ingredients: [
      { itemId: 'miel', quantity: 3, source: 'building' },
    ],
    xpBonus: 30,
    sellValue: 720, // (120x3) x 2
    minTreeStage: 'arbuste',
  },
  {
    id: 'nougat',
    labelKey: 'craft.recipe.nougat',
    emoji: '🍬',
    ingredients: [
      { itemId: 'miel', quantity: 1, source: 'building' },
      { itemId: 'oeuf', quantity: 1, source: 'building' },
      { itemId: 'farine', quantity: 1, source: 'building' },
    ],
    xpBonus: 35,
    sellValue: 580, // (120+80+90) x 2
    minTreeStage: 'arbuste',
  },
  {
    id: 'pain_epices',
    labelKey: 'craft.recipe.pain_epices',
    emoji: '🍪',
    ingredients: [
      { itemId: 'miel', quantity: 1, source: 'building' },
      { itemId: 'farine', quantity: 2, source: 'building' },
    ],
    xpBonus: 30,
    sellValue: 600, // (120+90+90) x 2
    minTreeStage: 'arbuste',
  },
  {
    id: 'parfum_orchidee',
    labelKey: 'craft.recipe.parfum_orchidee',
    emoji: '🪻',
    ingredients: [
      { itemId: 'orchidee', quantity: 2, source: 'crop' },
      { itemId: 'miel', quantity: 1, source: 'building' },
    ],
    xpBonus: 50,
    sellValue: 1200, // (300x2 + 120) x ~1.7
    minTreeStage: 'arbuste',
  },
  // ── Arbre (niv 11-18) — moulin + maïs/fraise ──
  {
    id: 'pain',
    labelKey: 'craft.recipe.pain',
    emoji: '🍞',
    ingredients: [
      { itemId: 'farine', quantity: 2, source: 'building' },
      { itemId: 'wheat', quantity: 1, source: 'crop' },
    ],
    xpBonus: 15,
    sellValue: 440, // (90+90+40) x 2
    minTreeStage: 'arbre',
  },
  {
    id: 'confiture',
    labelKey: 'craft.recipe.confiture',
    emoji: '🍓',
    ingredients: [
      { itemId: 'strawberry', quantity: 2, source: 'crop' },
    ],
    xpBonus: 20,
    sellValue: 480, // (120+120) x 2
    minTreeStage: 'arbre',
  },
  {
    id: 'popcorn',
    labelKey: 'craft.recipe.popcorn',
    emoji: '🍿',
    ingredients: [
      { itemId: 'corn', quantity: 2, source: 'crop' },
    ],
    xpBonus: 20,
    sellValue: 600, // (150+150) x 2
    minTreeStage: 'arbre',
  },
  {
    id: 'huile_tournesol',
    labelKey: 'craft.recipe.huile_tournesol',
    emoji: '🫙',
    ingredients: [
      { itemId: 'sunflower', quantity: 2, source: 'crop' },
    ],
    xpBonus: 20,
    sellValue: 400, // (100+100) x 2
    minTreeStage: 'arbre',
  },
  {
    id: 'brioche_tournesol',
    labelKey: 'craft.recipe.brioche_tournesol',
    emoji: '🥐',
    ingredients: [
      { itemId: 'sunflower', quantity: 1, source: 'crop' },
      { itemId: 'farine', quantity: 1, source: 'building' },
    ],
    xpBonus: 25,
    sellValue: 380, // (100+90) x 2
    minTreeStage: 'arbre',
  },
  {
    id: 'gateau',
    labelKey: 'craft.recipe.gateau',
    emoji: '🎂',
    ingredients: [
      { itemId: 'farine', quantity: 1, source: 'building' },
      { itemId: 'oeuf', quantity: 1, source: 'building' },
      { itemId: 'strawberry', quantity: 1, source: 'crop' },
    ],
    xpBonus: 30,
    sellValue: 580, // (90+80+120) x 2
    minTreeStage: 'arbre',
  },
  {
    id: 'confiture_royale',
    labelKey: 'craft.recipe.confiture_royale',
    emoji: '🌹',
    ingredients: [
      { itemId: 'rose_doree', quantity: 1, source: 'crop' },
      { itemId: 'strawberry', quantity: 1, source: 'crop' },
      { itemId: 'miel', quantity: 1, source: 'building' },
    ],
    xpBonus: 60,
    sellValue: 1500, // (500+120+120) x ~2
    minTreeStage: 'arbre',
  },
  // ── Majestueux (niv 19+) — citrouille ──
  {
    id: 'soupe_citrouille',
    labelKey: 'craft.recipe.soupe_citrouille',
    emoji: '🎃',
    ingredients: [
      { itemId: 'pumpkin', quantity: 1, source: 'crop' },
      { itemId: 'lait', quantity: 1, source: 'building' },
    ],
    xpBonus: 25,
    sellValue: 600, // (200+100) x 2
    minTreeStage: 'majestueux',
  },
  {
    id: 'tarte_citrouille',
    labelKey: 'craft.recipe.tarte_citrouille',
    emoji: '🥧',
    ingredients: [
      { itemId: 'pumpkin', quantity: 1, source: 'crop' },
      { itemId: 'farine', quantity: 1, source: 'building' },
      { itemId: 'oeuf', quantity: 1, source: 'building' },
    ],
    xpBonus: 35,
    sellValue: 740, // (200+90+80) x 2
    minTreeStage: 'majestueux',
  },
  {
    id: 'risotto_truffe',
    labelKey: 'craft.recipe.risotto_truffe',
    emoji: '🍄',
    ingredients: [
      { itemId: 'truffe', quantity: 1, source: 'crop' },
      { itemId: 'farine', quantity: 1, source: 'building' },
      { itemId: 'lait', quantity: 1, source: 'building' },
    ],
    xpBonus: 80,
    sellValue: 2000, // (800+90+100) x ~2
    minTreeStage: 'majestueux',
  },
];

// ── Fonctions metier ─────────────────────────────────────────────────

/** Verifier si une recette peut etre craftee avec l'inventaire actuel */
export function canCraft(
  recipe: CraftRecipe,
  harvestInv: HarvestInventory,
  farmInv: FarmInventory,
): boolean {
  for (const ing of recipe.ingredients) {
    if (ing.source === 'crop') {
      if ((harvestInv[ing.itemId] ?? 0) < ing.quantity) return false;
    } else {
      // building resource
      const key = ing.itemId as ResourceType;
      if ((farmInv[key] ?? 0) < ing.quantity) return false;
    }
  }
  return true;
}

/** Crafter un item — retourne les inventaires mis a jour + l'item crafte, ou null si impossible */
export function craftItem(
  recipe: CraftRecipe,
  harvestInv: HarvestInventory,
  farmInv: FarmInventory,
): { harvestInv: HarvestInventory; farmInv: FarmInventory; item: CraftedItem } | null {
  if (!canCraft(recipe, harvestInv, farmInv)) return null;

  // Copier les inventaires pour ne pas muter les originaux
  const newHarvestInv: HarvestInventory = { ...harvestInv };
  const newFarmInv: FarmInventory = { ...farmInv };

  for (const ing of recipe.ingredients) {
    if (ing.source === 'crop') {
      newHarvestInv[ing.itemId] = (newHarvestInv[ing.itemId] ?? 0) - ing.quantity;
    } else {
      const key = ing.itemId as ResourceType;
      newFarmInv[key] = (newFarmInv[key] ?? 0) - ing.quantity;
    }
  }

  const item: CraftedItem = {
    recipeId: recipe.id,
    craftedAt: new Date().toISOString(),
  };

  return { harvestInv: newHarvestInv, farmInv: newFarmInv, item };
}

/** Vendre un item crafte — retourne le nombre de feuilles */
export function sellCraftedItem(recipe: CraftRecipe): number {
  return recipe.sellValue;
}

/** Vendre une recolte brute — retourne le nombre de feuilles */
export function sellRawHarvest(cropId: string, isGolden?: boolean): number {
  const cropDef = CROP_CATALOG.find(c => c.id === cropId);
  if (!cropDef) return 0;
  return isGolden ? cropDef.harvestReward * GOLDEN_HARVEST_MULTIPLIER : cropDef.harvestReward;
}

// ── Serialisation / Parsing ──────────────────────────────────────────

/** Serialiser l'inventaire recoltes en CSV "strawberry:3,wheat:1" */
export function serializeHarvestInventory(inv: HarvestInventory): string {
  return Object.entries(inv)
    .filter(([, qty]) => qty > 0)
    .map(([cropId, qty]) => `${cropId}:${qty}`)
    .join(',');
}

/** Parser l'inventaire recoltes depuis CSV */
export function parseHarvestInventory(csv: string | undefined): HarvestInventory {
  const inv: HarvestInventory = {};
  if (!csv || csv.trim() === '') return inv;
  for (const entry of csv.split(',')) {
    const [cropId, val] = entry.trim().split(':');
    if (cropId && val) {
      const qty = parseInt(val, 10);
      if (!isNaN(qty) && qty > 0) {
        inv[cropId] = qty;
      }
    }
  }
  return inv;
}

/** Serialiser les items craftes en CSV "confiture:2024-01-01T00:00:00.000Z,gateau:2024-02-01T00:00:00.000Z" */
export function serializeCraftedItems(items: CraftedItem[]): string {
  if (items.length === 0) return '';
  return items
    .map(item => `${item.recipeId}:${item.craftedAt}`)
    .join(',');
}

/** Parser les items craftes depuis CSV */
export function parseCraftedItems(csv: string | undefined): CraftedItem[] {
  if (!csv || csv.trim() === '') return [];
  return csv.split(',').map(entry => {
    const colonIdx = entry.indexOf(':');
    if (colonIdx < 0) return null;
    const recipeId = entry.slice(0, colonIdx).trim();
    const craftedAt = entry.slice(colonIdx + 1).trim();
    if (!recipeId || !craftedAt) return null;
    return { recipeId, craftedAt } as CraftedItem;
  }).filter((item): item is CraftedItem => item !== null);
}

// ── Graines rares — Serialisation / Parsing ─────────────────────────

/** Serialiser l'inventaire graines rares en CSV "orchidee:1,truffe:2" */
export function serializeRareSeeds(inv: RareSeedInventory): string {
  return Object.entries(inv)
    .filter(([, qty]) => qty > 0)
    .map(([cropId, qty]) => `${cropId}:${qty}`)
    .join(',');
}

/** Parser l'inventaire graines rares depuis CSV */
export function parseRareSeeds(csv: string | undefined): RareSeedInventory {
  const inv: RareSeedInventory = {};
  if (!csv || csv.trim() === '') return inv;
  for (const entry of csv.split(',')) {
    const [cropId, val] = entry.trim().split(':');
    if (cropId && val) {
      const qty = parseInt(val, 10);
      if (!isNaN(qty) && qty > 0) {
        inv[cropId] = qty;
      }
    }
  }
  return inv;
}
