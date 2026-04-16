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

// ── Sprites recettes ─────────────────────────────────────────────────
const CRAFT_SPRITES: Record<string, ReturnType<typeof require>> = {
  soupe:             require('../../assets/garden/craft/soupe.png'),
  bouquet:           require('../../assets/garden/craft/bouquet.png'),
  crepe:             require('../../assets/garden/craft/crepe.png'),
  bortsch:           require('../../assets/garden/craft/bortsch.png'),
  fromage:           require('../../assets/garden/craft/fromage.png'),
  gratin:            require('../../assets/garden/craft/gratin.png'),
  omelette:          require('../../assets/garden/craft/omelette.png'),
  hydromel:          require('../../assets/garden/craft/hydromel.png'),
  nougat:            require('../../assets/garden/craft/nougat.png'),
  pain_epices:       require('../../assets/garden/craft/pain_epices.png'),
  parfum_orchidee:   require('../../assets/garden/craft/parfum_orchidee.png'),
  gaspacho:          require('../../assets/garden/craft/gaspacho.png'),
  galette_royale:    require('../../assets/garden/craft/galette_royale.png'),
  pain:              require('../../assets/garden/craft/pain.png'),
  confiture:         require('../../assets/garden/craft/confiture.png'),
  popcorn:           require('../../assets/garden/craft/popcorn.png'),
  huile_tournesol:   require('../../assets/garden/craft/huile_tournesol.png'),
  brioche_tournesol: require('../../assets/garden/craft/brioche_tournesol.png'),
  gateau:            require('../../assets/garden/craft/gateau.png'),
  confiture_royale:  require('../../assets/garden/craft/confiture_royale.png'),
  elixir_dragon:     require('../../assets/garden/craft/elixir_dragon.png'),
  soupe_citrouille:  require('../../assets/garden/craft/soupe_citrouille.png'),
  tarte_citrouille:  require('../../assets/garden/craft/tarte_citrouille.png'),
  risotto_truffe:    require('../../assets/garden/craft/risotto_truffe.png'),
  huile_phenix:      require('../../assets/garden/craft/huile_phenix.png'),
  tisane_volcanique: require('../../assets/garden/craft/tisane_volcanique.png'),
  encre_etoiles:     require('../../assets/garden/craft/encre_etoiles.png'),
  potion_eveil:      require('../../assets/garden/craft/potion_eveil.png'),
};

export const CRAFT_RECIPES: CraftRecipe[] = [
  // ── Pousse (niv 3-5) — crops de base + poulailler ──
  {
    id: 'soupe',
    labelKey: 'craft.recipe.soupe',
    emoji: '🥣',
    sprite: CRAFT_SPRITES.soupe,
    ingredients: [
      { itemId: 'carrot', quantity: 1, source: 'crop' },
      { itemId: 'potato', quantity: 1, source: 'crop' },
    ],
    xpBonus: 5,
    sellValue: 150, // (25+35) x 2.5
    minTreeStage: 'pousse',
  },
  {
    id: 'bouquet',
    labelKey: 'craft.recipe.bouquet',
    emoji: '💐',
    sprite: CRAFT_SPRITES.bouquet,
    ingredients: [
      { itemId: 'cabbage', quantity: 1, source: 'crop' },
      { itemId: 'carrot', quantity: 1, source: 'crop' },
    ],
    xpBonus: 10,
    sellValue: 200, // (70+25) x 2.1
    minTreeStage: 'pousse',
  },
  {
    id: 'crepe',
    labelKey: 'craft.recipe.crepe',
    emoji: '🥞',
    sprite: CRAFT_SPRITES.crepe,
    ingredients: [
      { itemId: 'oeuf', quantity: 1, source: 'building' },
      { itemId: 'wheat', quantity: 1, source: 'crop' },
    ],
    xpBonus: 10,
    sellValue: 220, // (80+40) x 1.8
    minTreeStage: 'pousse',
  },
  {
    id: 'bortsch',
    labelKey: 'craft.recipe.bortsch',
    emoji: '🍲',
    sprite: CRAFT_SPRITES.bortsch,
    ingredients: [
      { itemId: 'beetroot', quantity: 2, source: 'crop' },
    ],
    xpBonus: 8,
    sellValue: 130, // (30+30) x 2.2
    minTreeStage: 'pousse',
  },
  // ── Arbuste (niv 6-10) — grange + tomate/chou/concombre ──
  {
    id: 'fromage',
    labelKey: 'craft.recipe.fromage',
    emoji: '🧀',
    sprite: CRAFT_SPRITES.fromage,
    ingredients: [
      { itemId: 'lait', quantity: 3, source: 'building' },
    ],
    xpBonus: 15,
    sellValue: 480, // (100+100+100) x 1.6
    minTreeStage: 'arbuste',
  },
  {
    id: 'gratin',
    labelKey: 'craft.recipe.gratin',
    emoji: '🫕',
    sprite: CRAFT_SPRITES.gratin,
    ingredients: [
      { itemId: 'lait', quantity: 1, source: 'building' },
      { itemId: 'potato', quantity: 1, source: 'crop' },
      { itemId: 'oeuf', quantity: 1, source: 'building' },
    ],
    xpBonus: 15,
    sellValue: 440, // (100+35+80) x 2.0
    minTreeStage: 'arbuste',
  },
  {
    id: 'omelette',
    labelKey: 'craft.recipe.omelette',
    emoji: '🍳',
    sprite: CRAFT_SPRITES.omelette,
    ingredients: [
      { itemId: 'oeuf', quantity: 2, source: 'building' },
      { itemId: 'tomato', quantity: 1, source: 'crop' },
    ],
    xpBonus: 15,
    sellValue: 440, // (80+80+80) x 1.8
    minTreeStage: 'arbuste',
  },
  {
    id: 'hydromel',
    labelKey: 'craft.recipe.hydromel',
    emoji: '🍯',
    sprite: CRAFT_SPRITES.hydromel,
    ingredients: [
      { itemId: 'miel', quantity: 3, source: 'building' },
    ],
    xpBonus: 30,
    sellValue: 660, // (120x3) x 1.8
    minTreeStage: 'arbuste',
  },
  {
    id: 'nougat',
    labelKey: 'craft.recipe.nougat',
    emoji: '🍬',
    sprite: CRAFT_SPRITES.nougat,
    ingredients: [
      { itemId: 'miel', quantity: 2, source: 'building' },
      { itemId: 'oeuf', quantity: 1, source: 'building' },
      { itemId: 'farine', quantity: 1, source: 'building' },
    ],
    xpBonus: 35,
    sellValue: 760, // (120+120+80+90) x 1.85
    minTreeStage: 'arbuste',
  },
  {
    id: 'pain_epices',
    labelKey: 'craft.recipe.pain_epices',
    emoji: '🍪',
    sprite: CRAFT_SPRITES.pain_epices,
    ingredients: [
      { itemId: 'miel', quantity: 1, source: 'building' },
      { itemId: 'farine', quantity: 2, source: 'building' },
    ],
    xpBonus: 30,
    sellValue: 560, // (120+90+90) x 1.9
    minTreeStage: 'arbuste',
  },
  {
    id: 'parfum_orchidee',
    labelKey: 'craft.recipe.parfum_orchidee',
    emoji: '🪻',
    sprite: CRAFT_SPRITES.parfum_orchidee,
    ingredients: [
      { itemId: 'orchidee', quantity: 2, source: 'crop' },
      { itemId: 'miel', quantity: 1, source: 'building' },
    ],
    xpBonus: 50,
    sellValue: 1200, // (300x2 + 120) x ~1.7
    minTreeStage: 'arbuste',
  },
  {
    id: 'gaspacho',
    labelKey: 'craft.recipe.gaspacho',
    emoji: '🥗',
    sprite: CRAFT_SPRITES.gaspacho,
    ingredients: [
      { itemId: 'cucumber', quantity: 1, source: 'crop' },
      { itemId: 'tomato', quantity: 1, source: 'crop' },
    ],
    xpBonus: 20,
    sellValue: 370, // (75+80) x 2.4
    minTreeStage: 'arbuste',
  },
  // ── Arbre (niv 11-18) — moulin + maïs/fraise ──
  {
    id: 'pain',
    labelKey: 'craft.recipe.pain',
    emoji: '🍞',
    sprite: CRAFT_SPRITES.pain,
    ingredients: [
      { itemId: 'farine', quantity: 2, source: 'building' },
      { itemId: 'wheat', quantity: 1, source: 'crop' },
    ],
    xpBonus: 15,
    sellValue: 480, // (90+90+40) x 2.2
    minTreeStage: 'arbre',
  },
  {
    id: 'confiture',
    labelKey: 'craft.recipe.confiture',
    emoji: '🍓',
    sprite: CRAFT_SPRITES.confiture,
    ingredients: [
      { itemId: 'strawberry', quantity: 2, source: 'crop' },
    ],
    xpBonus: 20,
    sellValue: 460, // (120+120) x 1.9
    minTreeStage: 'arbre',
  },
  {
    id: 'popcorn',
    labelKey: 'craft.recipe.popcorn',
    emoji: '🍿',
    sprite: CRAFT_SPRITES.popcorn,
    ingredients: [
      { itemId: 'corn', quantity: 2, source: 'crop' },
    ],
    xpBonus: 20,
    sellValue: 540, // (150+150) x 1.8
    minTreeStage: 'arbre',
  },
  {
    id: 'huile_tournesol',
    labelKey: 'craft.recipe.huile_tournesol',
    emoji: '🫙',
    sprite: CRAFT_SPRITES.huile_tournesol,
    ingredients: [
      { itemId: 'sunflower', quantity: 2, source: 'crop' },
    ],
    xpBonus: 20,
    sellValue: 500, // (100+100) x 2.5
    minTreeStage: 'arbre',
  },
  {
    id: 'brioche_tournesol',
    labelKey: 'craft.recipe.brioche_tournesol',
    emoji: '🥐',
    sprite: CRAFT_SPRITES.brioche_tournesol,
    ingredients: [
      { itemId: 'sunflower', quantity: 1, source: 'crop' },
      { itemId: 'farine', quantity: 1, source: 'building' },
    ],
    xpBonus: 25,
    sellValue: 440, // (100+90) x 2.3
    minTreeStage: 'arbre',
  },
  {
    id: 'gateau',
    labelKey: 'craft.recipe.gateau',
    emoji: '🎂',
    sprite: CRAFT_SPRITES.gateau,
    ingredients: [
      { itemId: 'farine', quantity: 1, source: 'building' },
      { itemId: 'oeuf', quantity: 1, source: 'building' },
      { itemId: 'strawberry', quantity: 1, source: 'crop' },
    ],
    xpBonus: 30,
    sellValue: 540, // (90+80+120) x 1.9
    minTreeStage: 'arbre',
  },
  {
    id: 'confiture_royale',
    labelKey: 'craft.recipe.confiture_royale',
    emoji: '🌹',
    sprite: CRAFT_SPRITES.confiture_royale,
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
    sprite: CRAFT_SPRITES.soupe_citrouille,
    ingredients: [
      { itemId: 'pumpkin', quantity: 1, source: 'crop' },
      { itemId: 'lait', quantity: 1, source: 'building' },
    ],
    xpBonus: 25,
    sellValue: 560, // (200+100) x 1.9
    minTreeStage: 'majestueux',
  },
  {
    id: 'tarte_citrouille',
    labelKey: 'craft.recipe.tarte_citrouille',
    emoji: '🥧',
    sprite: CRAFT_SPRITES.tarte_citrouille,
    ingredients: [
      { itemId: 'pumpkin', quantity: 1, source: 'crop' },
      { itemId: 'farine', quantity: 1, source: 'building' },
      { itemId: 'oeuf', quantity: 1, source: 'building' },
    ],
    xpBonus: 35,
    sellValue: 700, // (200+90+80) x 1.9
    minTreeStage: 'majestueux',
  },
  {
    id: 'risotto_truffe',
    labelKey: 'craft.recipe.risotto_truffe',
    emoji: '🍄',
    sprite: CRAFT_SPRITES.risotto_truffe,
    ingredients: [
      { itemId: 'truffe', quantity: 1, source: 'crop' },
      { itemId: 'farine', quantity: 1, source: 'building' },
      { itemId: 'lait', quantity: 1, source: 'building' },
    ],
    xpBonus: 80,
    sellValue: 2000, // (800+90+100) x ~2
    minTreeStage: 'majestueux',
  },
  {
    id: 'elixir_dragon',
    labelKey: 'craft.recipe.elixir_dragon',
    emoji: '🐲',
    sprite: CRAFT_SPRITES.elixir_dragon,
    ingredients: [
      { itemId: 'fruit_dragon', quantity: 1, source: 'crop' },
      { itemId: 'miel', quantity: 1, source: 'building' },
    ],
    xpBonus: 70,
    sellValue: 1600, // (600+120) x 2.2
    minTreeStage: 'arbre',
  },
  // ── Expédition exclusive — fleur_lave (arbre) ──
  {
    id: 'huile_phenix',
    labelKey: 'craft.recipe.huile_phenix',
    emoji: '🔥',
    sprite: CRAFT_SPRITES.huile_phenix,
    ingredients: [
      { itemId: 'fleur_lave', quantity: 1, source: 'crop' },
      { itemId: 'miel', quantity: 1, source: 'building' },
    ],
    xpBonus: 65,
    sellValue: 1580, // (600+120) x 2.2
    minTreeStage: 'arbre',
  },
  {
    id: 'tisane_volcanique',
    labelKey: 'craft.recipe.tisane_volcanique',
    emoji: '🌋',
    sprite: CRAFT_SPRITES.tisane_volcanique,
    ingredients: [
      { itemId: 'fleur_lave', quantity: 1, source: 'crop' },
      { itemId: 'lait', quantity: 1, source: 'building' },
      { itemId: 'miel', quantity: 1, source: 'building' },
    ],
    xpBonus: 85,
    sellValue: 2050, // (600+100+120) x 2.5
    minTreeStage: 'arbre',
  },
  // ── Expédition exclusive — cristal_noir (majestueux) ──
  {
    id: 'encre_etoiles',
    labelKey: 'craft.recipe.encre_etoiles',
    emoji: '🌑',
    sprite: CRAFT_SPRITES.encre_etoiles,
    ingredients: [
      { itemId: 'cristal_noir', quantity: 1, source: 'crop' },
      { itemId: 'fruit_dragon', quantity: 1, source: 'crop' },
    ],
    xpBonus: 110,
    sellValue: 3450, // (900+600) x 2.3
    minTreeStage: 'majestueux',
  },
  {
    id: 'potion_eveil',
    labelKey: 'craft.recipe.potion_eveil',
    emoji: '✨',
    sprite: CRAFT_SPRITES.potion_eveil,
    ingredients: [
      { itemId: 'cristal_noir', quantity: 1, source: 'crop' },
      { itemId: 'truffe', quantity: 1, source: 'crop' },
      { itemId: 'oeuf', quantity: 1, source: 'building' },
    ],
    xpBonus: 120,
    sellValue: 3900, // (900+800+80) x 2.2
    minTreeStage: 'majestueux',
  },
  // ── Recettes déverrouillables (quêtes coopératives) ──
  {
    id: 'galette_royale',
    labelKey: 'craft.recipe.galette_royale',
    emoji: '👑',
    sprite: CRAFT_SPRITES.galette_royale,
    ingredients: [
      { itemId: 'farine', quantity: 2, source: 'building' },
      { itemId: 'oeuf', quantity: 1, source: 'building' },
      { itemId: 'miel', quantity: 1, source: 'building' },
    ],
    xpBonus: 50,
    sellValue: 1100, // (90+90+80+120) x ~3 (recette rare)
    minTreeStage: 'arbuste',
    requiredUnlock: 'galette_royale',
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

/** Quantité maximale craftable d'une recette en fonction des inventaires disponibles */
export function maxCraftableQty(
  recipe: CraftRecipe,
  harvestInv: HarvestInventory,
  farmInv: FarmInventory,
): number {
  if (recipe.ingredients.length === 0) return 0;
  let max = Infinity;
  for (const ing of recipe.ingredients) {
    if (ing.quantity <= 0) continue;
    const have = ing.source === 'crop'
      ? (harvestInv[ing.itemId] ?? 0)
      : (farmInv[ing.itemId as ResourceType] ?? 0);
    max = Math.min(max, Math.floor(have / ing.quantity));
  }
  return Number.isFinite(max) ? Math.max(0, max) : 0;
}

/**
 * Crafter N items en une opération atomique — retourne inventaires mis a jour + items craftes,
 * ou null si ingredients insuffisants pour la quantite demandee.
 */
export function craftItem(
  recipe: CraftRecipe,
  harvestInv: HarvestInventory,
  farmInv: FarmInventory,
  qty: number = 1,
): { harvestInv: HarvestInventory; farmInv: FarmInventory; items: CraftedItem[] } | null {
  const safeQty = Math.max(1, Math.floor(qty));
  if (maxCraftableQty(recipe, harvestInv, farmInv) < safeQty) return null;

  // Copier les inventaires pour ne pas muter les originaux
  const newHarvestInv: HarvestInventory = { ...harvestInv };
  const newFarmInv: FarmInventory = { ...farmInv };

  for (const ing of recipe.ingredients) {
    if (ing.source === 'crop') {
      newHarvestInv[ing.itemId] = (newHarvestInv[ing.itemId] ?? 0) - ing.quantity * safeQty;
    } else {
      const key = ing.itemId as ResourceType;
      newFarmInv[key] = (newFarmInv[key] ?? 0) - ing.quantity * safeQty;
    }
  }

  const nowIso = new Date().toISOString();
  const items: CraftedItem[] = Array.from({ length: safeQty }, () => ({
    recipeId: recipe.id,
    craftedAt: nowIso,
  }));

  return { harvestInv: newHarvestInv, farmInv: newFarmInv, items };
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
