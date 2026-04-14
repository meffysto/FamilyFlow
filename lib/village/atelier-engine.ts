// lib/village/atelier-engine.ts
// Moteur pur Village Atelier — recettes collectives, arbre tech village.
// Ingrédients = items produits par les bâtiments (VillageInventory).
// Coût tech = items collectifs (pas de coins individuels).
// Module pur : zéro import hook/context.

import type { VillageInventory } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type VillageTechBranchId = 'production' | 'atelier' | 'harmonie';

/** Noeud tech village */
export interface VillageTechNode {
  id: string;
  branch: VillageTechBranchId;
  order: number;
  labelFR: string;
  descriptionFR: string;
  emoji: string;
  cost: VillageTechCost[];   // items à dépenser
  requires: string | null;
}

/** Coût en items pour débloquer une tech */
export interface VillageTechCost {
  itemId: string;
  itemEmoji: string;
  quantity: number;
}

/** Ingrédient d'une recette village */
export interface VillageIngredient {
  itemId: string;
  itemEmoji: string;
  quantity: number;
}

/** Recette de craft collective */
export interface VillageRecipe {
  id: string;
  labelFR: string;
  resultEmoji: string;
  resultLabel: string;
  ingredients: VillageIngredient[];
  xpBonus: number;          // XP partagé à tous les membres actifs
  minAtelierTier: number;   // 0 = toujours disponible, 1/2/3 = nécessite atelier-1/2/3
}

/** Item crafté dans l'atelier village */
export interface VillageAtelierItem {
  recipeId: string;
  craftedAt: string;     // ISO 8601
  profileId: string;     // qui a déclenché le craft
}

/** Bonus agrégés de tous les techs village débloqués */
export interface VillageTechBonuses {
  /** Multiplicateur ratePerItem par buildingId (0.8 = 20% plus rapide) */
  productionRateMultiplier: Record<string, number>;
  /** Palier max de recettes débloquées (0 = tier0 uniquement, 1/2/3) */
  unlockedRecipeTier: number;
  /** Réduction de la cible hebdo (en contributions par profil actif) */
  objectiveTargetReduction: number;
  /** Multiplicateur de contribution (1 ou 2 — chaque effort compte double) */
  contributionMultiplier: number;
  /** Multiplicateur XP claim collectif (1.0 ou 1.5) */
  claimXpMultiplier: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Arbre tech village
// ─────────────────────────────────────────────────────────────────────────────

/** 9 noeuds — 3 branches × 3 (Production, Atelier, Harmonie) */
export const VILLAGE_TECH_TREE: VillageTechNode[] = [
  // ── Branche Production — accélère la génération d'items des bâtiments
  {
    id: 'production-1', branch: 'production', order: 1,
    labelFR: 'Entretien régulier',
    descriptionFR: 'Puits et Boulangerie produisent 20 % plus vite.',
    emoji: '🔧',
    cost: [{ itemId: 'eau_fraiche', itemEmoji: '💧', quantity: 5 }],
    requires: null,
  },
  {
    id: 'production-2', branch: 'production', order: 2,
    labelFR: 'Mécanique avancée',
    descriptionFR: 'Marché, Café et Forge : production ×0.8.',
    emoji: '⚙️',
    cost: [
      { itemId: 'farine_moulee', itemEmoji: '🌾', quantity: 5 },
      { itemId: 'pain_frais', itemEmoji: '🍞', quantity: 5 },
    ],
    requires: 'production-1',
  },
  {
    id: 'production-3', branch: 'production', order: 3,
    labelFR: 'Maîtrise industrielle',
    descriptionFR: 'Moulin, Port et Bibliothèque : production ×0.8.',
    emoji: '🏭',
    cost: [
      { itemId: 'coffre_maritime', itemEmoji: '⚓', quantity: 5 },
      { itemId: 'outil_forge', itemEmoji: '🔨', quantity: 5 },
    ],
    requires: 'production-2',
  },

  // ── Branche Atelier — débloque les recettes de craft
  {
    id: 'atelier-1', branch: 'atelier', order: 1,
    labelFR: 'Premiers outils',
    descriptionFR: 'Débloque les recettes de base de l\'atelier.',
    emoji: '🪚',
    cost: [
      { itemId: 'pain_frais', itemEmoji: '🍞', quantity: 3 },
      { itemId: 'eau_fraiche', itemEmoji: '💧', quantity: 3 },
    ],
    requires: null,
  },
  {
    id: 'atelier-2', branch: 'atelier', order: 2,
    labelFR: 'Artisanat avancé',
    descriptionFR: 'Débloque les recettes intermédiaires.',
    emoji: '🪛',
    cost: [
      { itemId: 'cafe_matin', itemEmoji: '☕', quantity: 5 },
      { itemId: 'parchemin', itemEmoji: '📚', quantity: 3 },
    ],
    requires: 'atelier-1',
  },
  {
    id: 'atelier-3', branch: 'atelier', order: 3,
    labelFR: 'Maître artisan',
    descriptionFR: 'Débloque les recettes rares de l\'atelier.',
    emoji: '🎖️',
    cost: [
      { itemId: 'parchemin', itemEmoji: '📚', quantity: 5 },
      { itemId: 'coffre_maritime', itemEmoji: '⚓', quantity: 3 },
    ],
    requires: 'atelier-2',
  },

  // ── Branche Harmonie — améliore l'effort collectif
  {
    id: 'harmonie-1', branch: 'harmonie', order: 1,
    labelFR: 'Entraide',
    descriptionFR: 'L\'objectif hebdo est réduit de 1 contribution par profil actif.',
    emoji: '🤝',
    cost: [
      { itemId: 'cafe_matin', itemEmoji: '☕', quantity: 3 },
      { itemId: 'eau_fraiche', itemEmoji: '💧', quantity: 3 },
    ],
    requires: null,
  },
  {
    id: 'harmonie-2', branch: 'harmonie', order: 2,
    labelFR: 'Solidarité',
    descriptionFR: 'Chaque contribution compte double pour l\'objectif.',
    emoji: '💪',
    cost: [
      { itemId: 'cafe_matin', itemEmoji: '☕', quantity: 5 },
      { itemId: 'pain_frais', itemEmoji: '🍞', quantity: 5 },
    ],
    requires: 'harmonie-1',
  },
  {
    id: 'harmonie-3', branch: 'harmonie', order: 3,
    labelFR: 'Communion',
    descriptionFR: 'Le claim de récompense collective donne +50 % d\'XP.',
    emoji: '🌿',
    cost: [
      { itemId: 'parchemin', itemEmoji: '📚', quantity: 5 },
      { itemId: 'eau_fraiche', itemEmoji: '💧', quantity: 5 },
      { itemId: 'pain_frais', itemEmoji: '🍞', quantity: 5 },
    ],
    requires: 'harmonie-2',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue recettes village
// ─────────────────────────────────────────────────────────────────────────────

/** 11 recettes — paliers 0 (libre), 1 (atelier-1), 2 (atelier-2), 3 (atelier-3)
 *
 * Cadence cible (famille 25 tâches/jour) :
 *   Tier 0 ≈ 2-3 j chacune (~1 craft/jour en alternant)
 *   Tier 1 ≈ 7-10 j chacune (~1 craft/3 jours)
 *   Tier 2 ≈ 13-16 j chacune (~1 craft/semaine)
 *   Tier 3 ≈ 16-32 j chacune (événement rare)
 *
 * XP reflète la rareté des ressources et le temps d'accumulation :
 *   Tier 0 : 15-25 XP (~10 % d'une journée d'XP)
 *   Tier 1 : 50-75 XP (~20-30 %)
 *   Tier 2 : 120-140 XP (~50 %)
 *   Tier 3 : 250-400 XP (1-2 jours d'XP — célébration)
 */
export const VILLAGE_RECIPES: VillageRecipe[] = [
  // Palier 0 — toujours disponibles
  {
    id: 'soupe_village', labelFR: 'Soupe du village', resultEmoji: '🍲', resultLabel: 'Soupe du village',
    ingredients: [
      { itemId: 'eau_fraiche', itemEmoji: '💧', quantity: 6 },
      { itemId: 'pain_frais', itemEmoji: '🍞', quantity: 5 },
    ],
    xpBonus: 15, minAtelierTier: 0,
  },
  {
    id: 'cafe_gourmand', labelFR: 'Café gourmand', resultEmoji: '☕', resultLabel: 'Café gourmand',
    ingredients: [
      { itemId: 'cafe_matin', itemEmoji: '☕', quantity: 4 },
      { itemId: 'pain_frais', itemEmoji: '🍞', quantity: 3 },
    ],
    xpBonus: 20, minAtelierTier: 0,
  },
  {
    id: 'fougasse', labelFR: 'Fougasse', resultEmoji: '🥖', resultLabel: 'Fougasse',
    ingredients: [
      { itemId: 'farine_moulee', itemEmoji: '🌾', quantity: 3 },
      { itemId: 'eau_fraiche', itemEmoji: '💧', quantity: 5 },
    ],
    xpBonus: 25, minAtelierTier: 0,
  },

  // Palier 1 — nécessite atelier-1
  {
    id: 'tarte_moulin', labelFR: 'Tarte du moulin', resultEmoji: '🥧', resultLabel: 'Tarte du moulin',
    ingredients: [
      { itemId: 'farine_moulee', itemEmoji: '🌾', quantity: 6 },
      { itemId: 'pain_frais', itemEmoji: '🍞', quantity: 5 },
      { itemId: 'eau_fraiche', itemEmoji: '💧', quantity: 4 },
    ],
    xpBonus: 55, minAtelierTier: 1,
  },
  {
    id: 'livre_recettes', labelFR: 'Livre de recettes', resultEmoji: '📝', resultLabel: 'Livre de recettes',
    ingredients: [
      { itemId: 'parchemin', itemEmoji: '📚', quantity: 3 },
      { itemId: 'farine_moulee', itemEmoji: '🌾', quantity: 4 },
    ],
    xpBonus: 75, minAtelierTier: 1,
  },

  // Palier 2 — nécessite atelier-2
  {
    id: 'outil_artisan', labelFR: 'Outil d\'artisan', resultEmoji: '⚒️', resultLabel: 'Outil d\'artisan',
    ingredients: [
      { itemId: 'outil_forge', itemEmoji: '🔨', quantity: 10 },
      { itemId: 'farine_moulee', itemEmoji: '🌾', quantity: 5 },
    ],
    xpBonus: 120, minAtelierTier: 2,
  },
  {
    id: 'coffre_fort', labelFR: 'Coffre-fort', resultEmoji: '💎', resultLabel: 'Coffre-fort',
    ingredients: [
      { itemId: 'coffre_maritime', itemEmoji: '⚓', quantity: 5 },
      { itemId: 'outil_forge', itemEmoji: '🔨', quantity: 8 },
    ],
    xpBonus: 130, minAtelierTier: 2,
  },
  {
    id: 'parchemin_enluminé', labelFR: 'Parchemin enluminé', resultEmoji: '📜', resultLabel: 'Parchemin enluminé',
    ingredients: [
      { itemId: 'parchemin', itemEmoji: '📚', quantity: 5 },
      { itemId: 'cafe_matin', itemEmoji: '☕', quantity: 6 },
    ],
    xpBonus: 140, minAtelierTier: 2,
  },

  // Palier 3 — nécessite atelier-3
  {
    id: 'tresor_familial', labelFR: 'Trésor familial', resultEmoji: '🌟', resultLabel: 'Trésor familial',
    ingredients: [
      { itemId: 'coffre_maritime', itemEmoji: '⚓', quantity: 10 },
      { itemId: 'outil_forge', itemEmoji: '🔨', quantity: 12 },
      { itemId: 'parchemin', itemEmoji: '📚', quantity: 10 },
    ],
    xpBonus: 400, minAtelierTier: 3,
  },
  {
    id: 'grand_festin', labelFR: 'Grand Festin', resultEmoji: '🎁', resultLabel: 'Grand Festin',
    ingredients: [
      { itemId: 'pain_frais', itemEmoji: '🍞', quantity: 25 },
      { itemId: 'cafe_matin', itemEmoji: '☕', quantity: 20 },
      { itemId: 'outil_forge', itemEmoji: '🔨', quantity: 10 },
      { itemId: 'eau_fraiche', itemEmoji: '💧', quantity: 20 },
      { itemId: 'farine_moulee', itemEmoji: '🌾', quantity: 12 },
    ],
    xpBonus: 250, minAtelierTier: 3,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions pures
// ─────────────────────────────────────────────────────────────────────────────

/** Parse le CSV atelier_tech et retourne la liste des IDs débloqués */
export function getUnlockedVillageTechs(csv: string): string[] {
  if (!csv || csv.trim() === '') return [];
  return csv.split(',').map(s => s.trim()).filter(Boolean);
}

/** Sérialise la liste des techs en CSV */
export function serializeVillageTechs(techs: string[]): string {
  return techs.join(',');
}

/**
 * Vérifie si un noeud tech village peut être débloqué.
 * Prérequis + stocks suffisants dans l'inventaire.
 */
export function canUnlockVillageTech(
  techId: string,
  unlockedTechs: string[],
  inventory: VillageInventory,
): { canUnlock: boolean; reason?: string } {
  if (unlockedTechs.includes(techId)) {
    return { canUnlock: false, reason: 'Déjà débloqué' };
  }

  const node = VILLAGE_TECH_TREE.find(n => n.id === techId);
  if (!node) return { canUnlock: false, reason: 'Tech introuvable' };

  if (node.requires && !unlockedTechs.includes(node.requires)) {
    const req = VILLAGE_TECH_TREE.find(n => n.id === node.requires);
    return { canUnlock: false, reason: `Nécessite : ${req?.labelFR ?? node.requires}` };
  }

  for (const cost of node.cost) {
    const available = inventory[cost.itemId] ?? 0;
    if (available < cost.quantity) {
      return {
        canUnlock: false,
        reason: `Manque ${cost.quantity - available} ${cost.itemEmoji}`,
      };
    }
  }

  return { canUnlock: true };
}

/**
 * Vérifie si une recette est craftable avec l'inventaire actuel et le niveau atelier.
 */
export function canCraftVillageRecipe(
  recipeId: string,
  inventory: VillageInventory,
  unlockedAtelierTier: number,
): { canCraft: boolean; reason?: string } {
  const recipe = VILLAGE_RECIPES.find(r => r.id === recipeId);
  if (!recipe) return { canCraft: false, reason: 'Recette introuvable' };

  if (recipe.minAtelierTier > unlockedAtelierTier) {
    return { canCraft: false, reason: `Nécessite atelier niveau ${recipe.minAtelierTier}` };
  }

  for (const ing of recipe.ingredients) {
    const available = inventory[ing.itemId] ?? 0;
    if (available < ing.quantity) {
      return {
        canCraft: false,
        reason: `Manque ${ing.quantity - available} ${ing.itemEmoji}`,
      };
    }
  }

  return { canCraft: true };
}

/**
 * Calcule les bonus agrégés depuis la liste des techs débloqués.
 */
export function computeVillageTechBonuses(unlockedTechs: string[]): VillageTechBonuses {
  const productionRateMultiplier: Record<string, number> = {};

  // production-1 → Puits + Boulangerie ×0.8
  if (unlockedTechs.includes('production-1')) {
    productionRateMultiplier['puits'] = 0.8;
    productionRateMultiplier['boulangerie'] = 0.8;
  }
  // production-2 → Café + Forge ×0.8 (Marché = pas de production, interface boursière)
  if (unlockedTechs.includes('production-2')) {
    productionRateMultiplier['cafe'] = 0.8;
    productionRateMultiplier['forge'] = 0.8;
  }
  // production-3 → Moulin + Port + Bibliothèque ×0.8
  if (unlockedTechs.includes('production-3')) {
    productionRateMultiplier['moulin'] = 0.8;
    productionRateMultiplier['port'] = 0.8;
    productionRateMultiplier['bibliotheque'] = 0.8;
  }

  // atelier-1/2/3 → palier recettes
  const unlockedRecipeTier = unlockedTechs.includes('atelier-3') ? 3
    : unlockedTechs.includes('atelier-2') ? 2
    : unlockedTechs.includes('atelier-1') ? 1
    : 0;

  // harmonie-1 → −1 contribution par profil actif dans la cible hebdo
  const objectiveTargetReduction = unlockedTechs.includes('harmonie-1') ? 1 : 0;

  // harmonie-2 → contribution double
  const contributionMultiplier = unlockedTechs.includes('harmonie-2') ? 2 : 1;

  // harmonie-3 → XP claim ×1.5
  const claimXpMultiplier = unlockedTechs.includes('harmonie-3') ? 1.5 : 1.0;

  return {
    productionRateMultiplier,
    unlockedRecipeTier,
    objectiveTargetReduction,
    contributionMultiplier,
    claimXpMultiplier,
  };
}

/**
 * Applique le coût tech sur l'inventaire et retourne le nouvel inventaire.
 * Pur — ne mutate pas l'inventaire d'entrée.
 */
export function applyTechCost(
  inventory: VillageInventory,
  techId: string,
): VillageInventory {
  const node = VILLAGE_TECH_TREE.find(n => n.id === techId);
  if (!node) return inventory;
  const updated = { ...inventory };
  for (const cost of node.cost) {
    updated[cost.itemId] = Math.max(0, (updated[cost.itemId] ?? 0) - cost.quantity);
  }
  return updated;
}

/**
 * Applique le coût recette sur l'inventaire et retourne le nouvel inventaire.
 * Pur — ne mutate pas l'inventaire d'entrée.
 */
export function applyRecipeCost(
  inventory: VillageInventory,
  recipeId: string,
): VillageInventory {
  const recipe = VILLAGE_RECIPES.find(r => r.id === recipeId);
  if (!recipe) return inventory;
  const updated = { ...inventory };
  for (const ing of recipe.ingredients) {
    updated[ing.itemId] = Math.max(0, (updated[ing.itemId] ?? 0) - ing.quantity);
  }
  return updated;
}
