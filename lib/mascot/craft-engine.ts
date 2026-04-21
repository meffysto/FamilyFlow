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
import {
  GRADE_ORDER,
  addToGradedInventory,
  countItemByGrade,
  countItemTotal,
  removeFromGradedInventory,
  getWeakestGrade,
  type HarvestGrade,
} from './grade-engine';

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
  tarte_carottes:    require('../../assets/garden/craft/tarte_carottes.png'),
  veloute_printanier:require('../../assets/garden/craft/veloute_printanier.png'),
  gratin_hiver:      require('../../assets/garden/craft/gratin_hiver.png'),
  mijote_hiver:      require('../../assets/garden/craft/mijote_hiver.png'),
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
  // ── Arbre — 🌸 Printemps (carrot/potato/cabbage/beetroot) ──
  {
    id: 'tarte_carottes',
    labelKey: 'craft.recipe.tarte_carottes',
    emoji: '🥕',
    sprite: CRAFT_SPRITES.tarte_carottes,
    ingredients: [
      { itemId: 'carrot', quantity: 2, source: 'crop' },
      { itemId: 'farine', quantity: 1, source: 'building' },
      { itemId: 'oeuf', quantity: 1, source: 'building' },
    ],
    xpBonus: 25,
    sellValue: 480, // (25+25+90+80) x 2.2
    minTreeStage: 'arbre',
  },
  {
    id: 'veloute_printanier',
    labelKey: 'craft.recipe.veloute_printanier',
    emoji: '🥬',
    sprite: CRAFT_SPRITES.veloute_printanier,
    ingredients: [
      { itemId: 'cabbage', quantity: 1, source: 'crop' },
      { itemId: 'potato', quantity: 1, source: 'crop' },
      { itemId: 'lait', quantity: 1, source: 'building' },
    ],
    xpBonus: 25,
    sellValue: 470, // (70+35+100) x 2.3
    minTreeStage: 'arbre',
  },
  // ── Arbre — ❄️ Hiver (potato/cabbage/beetroot — cultures de conservation) ──
  {
    id: 'gratin_hiver',
    labelKey: 'craft.recipe.gratin_hiver',
    emoji: '🍲',
    sprite: CRAFT_SPRITES.gratin_hiver,
    ingredients: [
      { itemId: 'potato', quantity: 2, source: 'crop' },
      { itemId: 'cabbage', quantity: 1, source: 'crop' },
      { itemId: 'lait', quantity: 1, source: 'building' },
    ],
    xpBonus: 25,
    sellValue: 480, // (35+35+70+100) x 2.0
    minTreeStage: 'arbre',
  },
  {
    id: 'mijote_hiver',
    labelKey: 'craft.recipe.mijote_hiver',
    emoji: '🥘',
    sprite: CRAFT_SPRITES.mijote_hiver,
    ingredients: [
      { itemId: 'beetroot', quantity: 2, source: 'crop' },
      { itemId: 'potato', quantity: 1, source: 'crop' },
      { itemId: 'oeuf', quantity: 1, source: 'building' },
    ],
    xpBonus: 25,
    sellValue: 400, // (30+30+35+80) x 2.3
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

/** Verifier si une recette peut etre craftee avec l'inventaire actuel (total toutes grades) */
export function canCraft(
  recipe: CraftRecipe,
  harvestInv: HarvestInventory,
  farmInv: FarmInventory,
): boolean {
  for (const ing of recipe.ingredients) {
    if (ing.source === 'crop') {
      if (countItemTotal(harvestInv, ing.itemId) < ing.quantity) return false;
    } else {
      // building resource
      const key = ing.itemId as ResourceType;
      if ((farmInv[key] ?? 0) < ing.quantity) return false;
    }
  }
  return true;
}

/** Quantité maximale craftable d'une recette en fonction des inventaires disponibles (total toutes grades) */
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
      ? countItemTotal(harvestInv, ing.itemId)
      : (farmInv[ing.itemId as ResourceType] ?? 0);
    max = Math.min(max, Math.floor(have / ing.quantity));
  }
  return Number.isFinite(max) ? Math.max(0, max) : 0;
}

/**
 * Crafter N items en une opération atomique — retourne inventaires mis a jour + items craftes,
 * ou null si ingredients insuffisants pour la quantite demandee.
 *
 * Phase B : retire les ingredients en grade 'ordinaire' par défaut (compat legacy).
 * Les call sites qui veulent un grade spécifique utilisent `craftItemWithSelection`.
 */
export function craftItem(
  recipe: CraftRecipe,
  harvestInv: HarvestInventory,
  farmInv: FarmInventory,
  qty: number = 1,
): { harvestInv: HarvestInventory; farmInv: FarmInventory; items: CraftedItem[] } | null {
  const safeQty = Math.max(1, Math.floor(qty));
  if (maxCraftableQty(recipe, harvestInv, farmInv) < safeQty) return null;

  // Copier les inventaires pour ne pas muter les originaux (deep copy des entrées graded)
  const newHarvestInv: HarvestInventory = cloneHarvestInventory(harvestInv);
  const newFarmInv: FarmInventory = { ...farmInv };

  // Phase B — trace les grades effectivement consommés par ingrédient crop
  // afin de calculer le grade output (maillon faible) sans UI picker explicite.
  // Règle : on consomme d'abord ordinaire, puis beau, etc. (préserve les grades rares)
  // — donc le grade effectif d'un ingrédient = le plus bas grade où on a puisé.
  const gradesConsumed: HarvestGrade[] = [];

  for (const ing of recipe.ingredients) {
    if (ing.source === 'crop') {
      let toRemove = ing.quantity * safeQty;
      let firstGradeUsed: HarvestGrade | null = null;
      for (const grade of GRADE_ORDER) {
        if (toRemove <= 0) break;
        const have = countItemByGrade(newHarvestInv, ing.itemId, grade);
        const take = Math.min(have, toRemove);
        if (take > 0) {
          if (firstGradeUsed === null) firstGradeUsed = grade;
          removeFromGradedInventory(newHarvestInv, ing.itemId, grade, take);
          toRemove -= take;
        }
      }
      if (firstGradeUsed) gradesConsumed.push(firstGradeUsed);
    } else {
      const key = ing.itemId as ResourceType;
      newFarmInv[key] = (newFarmInv[key] ?? 0) - ing.quantity * safeQty;
    }
  }

  // Grade output = maillon faible des grades effectivement consommés (ingrédients crop uniquement).
  // Si aucun crop dans la recette, output grade reste 'ordinaire' par défaut.
  const outputGrade: HarvestGrade = gradesConsumed.length > 0
    ? getWeakestGrade(gradesConsumed)
    : 'ordinaire';

  const nowIso = new Date().toISOString();
  const items: CraftedItem[] = Array.from({ length: safeQty }, () => ({
    recipeId: recipe.id,
    craftedAt: nowIso,
    grade: outputGrade,
  }));

  return { harvestInv: newHarvestInv, farmInv: newFarmInv, items };
}

/** Clone profond de HarvestInventory (préserve les entrées number legacy et les records graded). */
export function cloneHarvestInventory(inv: HarvestInventory): HarvestInventory {
  const out: HarvestInventory = {};
  for (const cropId of Object.keys(inv)) {
    const entry = inv[cropId];
    if (entry == null) continue;
    if (typeof entry === 'number') {
      out[cropId] = entry;
    } else {
      out[cropId] = { ...entry };
    }
  }
  return out;
}

// ─────────────────────────────────────────────
// Phase B — Helpers craft par grade (maillon faible)
// ─────────────────────────────────────────────

/**
 * Par défaut, sélectionne pour chaque ingrédient le grade le plus faible POSSÉDÉ
 * en quantité suffisante pour la recette × multiplier.
 * Fallback 'ordinaire' si aucun grade n'est suffisant (UI affichera grisé).
 */
export function getDefaultGradeSelection(
  inv: HarvestInventory,
  recipe: CraftRecipe,
  multiplier: number = 1,
): Record<string, HarvestGrade> {
  const selection: Record<string, HarvestGrade> = {};
  for (const ing of recipe.ingredients) {
    if (ing.source !== 'crop') continue;
    const needed = ing.quantity * multiplier;
    const found = GRADE_ORDER.find(g => countItemByGrade(inv, ing.itemId, g) >= needed);
    selection[ing.itemId] = found ?? 'ordinaire';
  }
  return selection;
}

/**
 * Vérifie qu'on peut crafter avec la sélection de grades donnée.
 * Retourne canCraft=false et missing détaillé sinon.
 */
export function canCraftAtGrade(
  inv: HarvestInventory,
  recipe: CraftRecipe,
  selection: Record<string, HarvestGrade>,
  farmInv: FarmInventory,
  multiplier: number = 1,
): {
  canCraft: boolean;
  missing?: { itemId: string; grade?: HarvestGrade; have: number; need: number };
} {
  for (const ing of recipe.ingredients) {
    const need = ing.quantity * multiplier;
    if (ing.source === 'crop') {
      const grade = selection[ing.itemId] ?? 'ordinaire';
      const have = countItemByGrade(inv, ing.itemId, grade);
      if (have < need) return { canCraft: false, missing: { itemId: ing.itemId, grade, have, need } };
    } else {
      const key = ing.itemId as ResourceType;
      const have = farmInv[key] ?? 0;
      if (have < need) return { canCraft: false, missing: { itemId: ing.itemId, have, need } };
    }
  }
  return { canCraft: true };
}

/** Grade output d'un craft = min des grades sélectionnés (règle du maillon faible). */
export function getCraftOutputGrade(
  selection: Record<string, HarvestGrade>,
): HarvestGrade {
  const grades = Object.values(selection);
  return getWeakestGrade(grades);
}

/**
 * Crafter N items avec sélection de grade par ingrédient — Phase B.
 * Retire strictement les qty des grades sélectionnés ; output a le grade maillon faible.
 */
export function craftItemWithSelection(
  recipe: CraftRecipe,
  harvestInv: HarvestInventory,
  farmInv: FarmInventory,
  selection: Record<string, HarvestGrade>,
  qty: number = 1,
): { harvestInv: HarvestInventory; farmInv: FarmInventory; items: CraftedItem[] } | null {
  const safeQty = Math.max(1, Math.floor(qty));
  const check = canCraftAtGrade(harvestInv, recipe, selection, farmInv, safeQty);
  if (!check.canCraft) return null;

  const newHarvestInv: HarvestInventory = cloneHarvestInventory(harvestInv);
  const newFarmInv: FarmInventory = { ...farmInv };

  for (const ing of recipe.ingredients) {
    if (ing.source === 'crop') {
      const grade = selection[ing.itemId] ?? 'ordinaire';
      removeFromGradedInventory(newHarvestInv, ing.itemId, grade, ing.quantity * safeQty);
    } else {
      const key = ing.itemId as ResourceType;
      newFarmInv[key] = (newFarmInv[key] ?? 0) - ing.quantity * safeQty;
    }
  }

  const outputGrade = getCraftOutputGrade(selection);
  const nowIso = new Date().toISOString();
  const items: CraftedItem[] = Array.from({ length: safeQty }, () => ({
    recipeId: recipe.id,
    craftedAt: nowIso,
    grade: outputGrade,
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

const VALID_GRADES: ReadonlySet<string> = new Set<string>(GRADE_ORDER);

/**
 * Serialiser l'inventaire recoltes en CSV Phase B : "tomato:ordinaire:8,tomato:beau:3,wheat:ordinaire:5".
 * Ordre déterministe : cropId alphabétique + grade selon GRADE_ORDER.
 * Filtre qty <= 0. Les entrées legacy number sont écrites en `cropId:ordinaire:qty`.
 */
export function serializeHarvestInventory(inv: HarvestInventory): string {
  const parts: string[] = [];
  for (const cropId of Object.keys(inv).sort()) {
    const raw = inv[cropId];
    if (raw == null) continue;
    // Upgrade silencieux : entrée legacy number → ordinaire
    const gradeMap: Partial<Record<HarvestGrade, number>> =
      typeof raw === 'number' ? { ordinaire: raw } : raw;
    for (const grade of GRADE_ORDER) {
      const qty = gradeMap[grade] ?? 0;
      if (qty > 0) parts.push(`${cropId}:${grade}:${qty}`);
    }
  }
  return parts.join(',');
}

/**
 * Parser l'inventaire recoltes depuis CSV — Phase B.
 * Accepte deux formats par entrée :
 *   - Legacy "cropId:qty"       → grade 'ordinaire'
 *   - Phase B "cropId:grade:qty" → grade explicite
 * Grade invalide → fallback 'ordinaire' (résilience). Fusion si doublons.
 */
export function parseHarvestInventory(csv: string | undefined): HarvestInventory {
  const inv: HarvestInventory = {};
  if (!csv || csv.trim() === '') return inv;
  for (const rawEntry of csv.split(',')) {
    const entry = rawEntry.trim();
    if (!entry) continue;
    const parts = entry.split(':');
    if (parts.length === 2) {
      // Legacy cropId:qty
      const [cropId, qtyStr] = parts;
      const qty = parseInt(qtyStr, 10);
      if (cropId && !isNaN(qty) && qty > 0) {
        addToGradedInventory(inv, cropId, 'ordinaire', qty);
      }
    } else if (parts.length === 3) {
      // v2 cropId:grade:qty
      const [cropId, gradeRaw, qtyStr] = parts;
      const qty = parseInt(qtyStr, 10);
      if (!cropId || isNaN(qty) || qty <= 0) continue;
      const grade: HarvestGrade = VALID_GRADES.has(gradeRaw)
        ? (gradeRaw as HarvestGrade)
        : 'ordinaire';
      addToGradedInventory(inv, cropId, grade, qty);
    }
  }
  return inv;
}

/**
 * Serialiser les items craftes en CSV.
 * Format Phase B : "recipeId:craftedAt:grade" (3 parts) si grade présent.
 * Format legacy : "recipeId:craftedAt" si grade absent.
 * Note : craftedAt est un ISO string qui contient des ':' — on reconstruit via split(',') entre items,
 * et à l'intérieur d'une entrée on limite à 3 fragments en utilisant un marker d'échappement interne
 * simple. Pour rester compat avec l'existant, on garde l'ISO tel quel quand pas de grade,
 * et on append ":<grade>" seulement quand présent (safe car GRADE_ORDER n'intersecte pas l'ISO).
 */
export function serializeCraftedItems(items: CraftedItem[]): string {
  if (items.length === 0) return '';
  return items
    .map(item => {
      if (item.grade) return `${item.recipeId}:${item.craftedAt}:${item.grade}`;
      return `${item.recipeId}:${item.craftedAt}`;
    })
    .join(',');
}

/**
 * Parser les items craftes depuis CSV.
 * - Dernier fragment après ':' = grade si ∈ GRADE_ORDER (sinon fait partie du craftedAt legacy).
 * - Grade invalide (ex: "unknown") → fallback 'ordinaire'.
 */
export function parseCraftedItems(csv: string | undefined): CraftedItem[] {
  if (!csv || csv.trim() === '') return [];
  return csv
    .split(',')
    .map(entry => {
      const trimmed = entry.trim();
      const firstColon = trimmed.indexOf(':');
      if (firstColon < 0) return null;
      const recipeId = trimmed.slice(0, firstColon);
      let rest = trimmed.slice(firstColon + 1);
      if (!recipeId || !rest) return null;

      // Détection grade suffixe : dernier fragment séparé par ':' exactement = grade
      const lastColon = rest.lastIndexOf(':');
      let grade: HarvestGrade | undefined;
      if (lastColon >= 0) {
        const tail = rest.slice(lastColon + 1);
        if (VALID_GRADES.has(tail)) {
          grade = tail as HarvestGrade;
          rest = rest.slice(0, lastColon);
        } else if (/^[a-z]+$/i.test(tail) && tail.length <= 10 && !/^\d/.test(tail)) {
          // suffixe alpha non-grade (ex: "unknown") → traité comme grade invalide, fallback ordinaire
          // On ne le consomme que si le craftedAt résiduel reste plausible (contient un chiffre / date)
          const residual = rest.slice(0, lastColon);
          if (/\d/.test(residual)) {
            grade = 'ordinaire';
            rest = residual;
          }
        }
      }

      const craftedAt = rest;
      if (!craftedAt) return null;
      const item: CraftedItem = { recipeId, craftedAt };
      if (grade) item.grade = grade;
      return item;
    })
    .filter((item): item is CraftedItem => item !== null);
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
