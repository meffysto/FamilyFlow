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
} from './types';
import { GOLDEN_HARVEST_MULTIPLIER } from './farm-engine';

// ── Valeurs de base des ressources batiment (pour calcul sellValue) ──

export const BUILDING_RESOURCE_VALUE: Record<ResourceType, number> = {
  oeuf: 30,
  lait: 50,
  farine: 40,
};

// ── Catalogue de recettes ────────────────────────────────────────────

export const CRAFT_RECIPES: CraftRecipe[] = [
  {
    id: 'confiture',
    labelKey: 'craft.recipe.confiture',
    emoji: '🍓',
    ingredients: [
      { itemId: 'strawberry', quantity: 2, source: 'crop' },
    ],
    xpBonus: 20,
    sellValue: 480, // (120+120) x 2
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
    sellValue: 380, // (40+30+120) x 2
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
    sellValue: 280, // (30+30+80) x 2
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
