/**
 * expedition-engine.ts — Moteur logique pur des expéditions
 * Phase 33 — Système d'expéditions à risque
 *
 * Logique pure : catalogue, roll probabiliste, timer, pity system, pool quotidien
 * Aucune dépendance sur les hooks React ou le vault — testable unitairement
 */

import type { ActiveExpedition, ExpeditionDifficulty, ExpeditionOutcome } from '../types';
import { type TreeStage, TREE_STAGE_ORDER, CROP_CATALOG } from './types';

// ─── Constantes ──────────────────────────────────────────────────────────────

export const MAX_ACTIVE_EXPEDITIONS = 2;

// ─── Types internes ──────────────────────────────────────────────────────────

export interface ExpeditionMission {
  id: string;
  name: string;
  emoji: string;
  difficulty: ExpeditionDifficulty;
  durationHours: number;        // 4 | 12 | 24
  costCoins: number;            // feuilles
  costCrops: { cropId: string; quantity: number }[];
  description: string;
  minTreeStage: TreeStage;      // stade d'arbre minimum pour voir cette mission
}

export interface ExpeditionLoot {
  itemId: string;
  type: 'inhabitant' | 'seed' | 'booster';
  label: string;
  emoji: string;
}

// ─── Catalogue (32 missions, 6 difficultés) ─────────────────────────────────

export const EXPEDITION_CATALOG: ExpeditionMission[] = [
  // ─ Facile (4h) — accessible dès 'graine' ───────────────────────
  {
    id: 'foret_facile',
    name: 'Forêt Ancienne',
    emoji: '🌲',
    difficulty: 'easy',
    durationHours: 4,
    costCoins: 40,
    costCrops: [{ cropId: 'carrot', quantity: 3 }],
    description: 'Une balade à travers les vieux chênes. Risque modéré, butin possible.',
    minTreeStage: 'graine',
  },
  {
    id: 'riviere_facile',
    name: 'Rivière Cristalline',
    emoji: '🏞️',
    difficulty: 'easy',
    durationHours: 4,
    costCoins: 45,
    costCrops: [{ cropId: 'wheat', quantity: 2 }],
    description: 'Suivre le courant jusqu\'aux sources cachées de la vallée.',
    minTreeStage: 'graine',
  },
  {
    id: 'prairie_facile',
    name: 'Prairie Fleurie',
    emoji: '🌸',
    difficulty: 'easy',
    durationHours: 4,
    costCoins: 50,
    costCrops: [{ cropId: 'potato', quantity: 2 }],
    description: 'Explorer les prairies sauvages à la recherche de fleurs rares.',
    minTreeStage: 'graine',
  },
  {
    id: 'colline_facile',
    name: 'Colline Ventée',
    emoji: '🌿',
    difficulty: 'easy',
    durationHours: 4,
    costCoins: 35,
    costCrops: [
      { cropId: 'carrot', quantity: 2 },
      { cropId: 'wheat', quantity: 1 },
    ],
    description: 'Grimper la colline pour observer les étoiles filantes.',
    minTreeStage: 'graine',
  },
  {
    id: 'ruisseau_facile',
    name: 'Ruisseau Chantant',
    emoji: '💧',
    difficulty: 'easy',
    durationHours: 4,
    costCoins: 42,
    costCrops: [{ cropId: 'beetroot', quantity: 2 }],
    description: 'Suivre le ruisseau pour trouver des pierres brillantes.',
    minTreeStage: 'graine',
  },

  // ─ Pousse (6h) — accessible dès 'pousse' ───────────────────────
  {
    id: 'marais_pousse',
    name: 'Marais Brumeux',
    emoji: '🐸',
    difficulty: 'pousse',
    durationHours: 6,
    costCoins: 60,
    costCrops: [
      { cropId: 'carrot', quantity: 3 },
      { cropId: 'wheat', quantity: 2 },
    ],
    description: 'Explorer les marécages mystérieux à l\'aube.',
    minTreeStage: 'pousse',
  },
  {
    id: 'clairiere_pousse',
    name: 'Clairière Secrète',
    emoji: '🍃',
    difficulty: 'pousse',
    durationHours: 6,
    costCoins: 65,
    costCrops: [
      { cropId: 'potato', quantity: 3 },
      { cropId: 'beetroot', quantity: 2 },
    ],
    description: 'Découvrir la clairière cachée au cœur de la forêt.',
    minTreeStage: 'pousse',
  },
  {
    id: 'grotte_pousse',
    name: 'Grotte Lumineuse',
    emoji: '🕯️',
    difficulty: 'pousse',
    durationHours: 6,
    costCoins: 70,
    costCrops: [
      { cropId: 'wheat', quantity: 4 },
      { cropId: 'carrot', quantity: 1 },
    ],
    description: 'Descendre dans la grotte où brillent des lucioles.',
    minTreeStage: 'pousse',
  },
  {
    id: 'sentier_pousse',
    name: 'Sentier des Fées',
    emoji: '🧚',
    difficulty: 'pousse',
    durationHours: 6,
    costCoins: 55,
    costCrops: [
      { cropId: 'beetroot', quantity: 2 },
      { cropId: 'potato', quantity: 2 },
    ],
    description: 'Suivre le sentier enchanté jusqu\'au cercle de champignons.',
    minTreeStage: 'pousse',
  },
  {
    id: 'lac_pousse',
    name: 'Lac Endormi',
    emoji: '🌙',
    difficulty: 'pousse',
    durationHours: 6,
    costCoins: 75,
    costCrops: [
      { cropId: 'carrot', quantity: 3 },
      { cropId: 'potato', quantity: 2 },
    ],
    description: 'Traverser le lac gelé sous la lumière de la lune.',
    minTreeStage: 'pousse',
  },

  // ─ Moyen (12h) — accessible dès 'arbuste' ──────────────────────
  {
    id: 'montagne_moyen',
    name: 'Sommets Brumeux',
    emoji: '⛰️',
    difficulty: 'medium',
    durationHours: 12,
    costCoins: 150,
    costCrops: [
      { cropId: 'potato', quantity: 3 },
      { cropId: 'carrot', quantity: 3 },
    ],
    description: 'Escalader jusqu\'aux crêtes enneigées pour découvrir des trésors alpins.',
    minTreeStage: 'arbuste',
  },
  {
    id: 'ocean_moyen',
    name: 'Profondeurs Marines',
    emoji: '🌊',
    difficulty: 'medium',
    durationHours: 12,
    costCoins: 175,
    costCrops: [
      { cropId: 'cabbage', quantity: 4 },
      { cropId: 'tomato', quantity: 3 },
    ],
    description: 'Plonger vers les épaves et les récifs coralliens de l\'océan lointain.',
    minTreeStage: 'arbuste',
  },
  {
    id: 'caverne_moyen',
    name: 'Cavernes Cristallines',
    emoji: '💎',
    difficulty: 'medium',
    durationHours: 12,
    costCoins: 200,
    costCrops: [
      { cropId: 'cucumber', quantity: 5 },
      { cropId: 'cabbage', quantity: 3 },
    ],
    description: 'S\'enfoncer dans les grottes illuminées de gemmes phosphorescentes.',
    minTreeStage: 'arbuste',
  },
  {
    id: 'desert_moyen',
    name: 'Désert des Mirages',
    emoji: '🏜️',
    difficulty: 'medium',
    durationHours: 12,
    costCoins: 160,
    costCrops: [
      { cropId: 'tomato', quantity: 3 },
      { cropId: 'wheat', quantity: 3 },
    ],
    description: 'Traverser les dunes mouvantes pour trouver l\'oasis cachée.',
    minTreeStage: 'arbuste',
  },
  {
    id: 'jungle_moyen',
    name: 'Jungle Émeraude',
    emoji: '🌴',
    difficulty: 'medium',
    durationHours: 12,
    costCoins: 185,
    costCrops: [
      { cropId: 'cucumber', quantity: 4 },
      { cropId: 'carrot', quantity: 2 },
    ],
    description: 'S\'enfoncer dans la jungle tropicale vers les ruines anciennes.',
    minTreeStage: 'arbuste',
  },
  {
    id: 'temple_moyen',
    name: 'Temple Englouti',
    emoji: '🏛️',
    difficulty: 'medium',
    durationHours: 12,
    costCoins: 190,
    costCrops: [
      { cropId: 'cabbage', quantity: 3 },
      { cropId: 'tomato', quantity: 3 },
      { cropId: 'potato', quantity: 2 },
    ],
    description: 'Plonger dans le temple submergé pour déchiffrer les inscriptions.',
    minTreeStage: 'arbuste',
  },

  // ─ Dur (24h) — accessible dès 'arbre' ──────────────────────────
  {
    id: 'volcan_dur',
    name: 'Cratère Ardent',
    emoji: '🌋',
    difficulty: 'hard',
    durationHours: 24,
    costCoins: 400,
    costCrops: [
      { cropId: 'strawberry', quantity: 7 },
      { cropId: 'tomato', quantity: 6 },
      { cropId: 'corn', quantity: 5 },
    ],
    description: 'Traverser les coulées de lave pour atteindre le cœur du volcan.',
    minTreeStage: 'arbre',
  },
  {
    id: 'toundra_dur',
    name: 'Toundra Glaciaire',
    emoji: '🏔️',
    difficulty: 'hard',
    durationHours: 24,
    costCoins: 450,
    costCrops: [
      { cropId: 'beetroot', quantity: 8 },
      { cropId: 'potato', quantity: 6 },
      { cropId: 'wheat', quantity: 6 },
    ],
    description: 'Survivre aux tempêtes polaires pour découvrir les secrets du Grand Nord.',
    minTreeStage: 'arbre',
  },
  {
    id: 'nuages_dur',
    name: 'Archipel des Nuages',
    emoji: '☁️',
    difficulty: 'hard',
    durationHours: 24,
    costCoins: 500,
    costCrops: [
      { cropId: 'sunflower', quantity: 8 },
      { cropId: 'corn', quantity: 7 },
      { cropId: 'strawberry', quantity: 7 },
    ],
    description: 'Atteindre les îles flottantes au-dessus des nuages. Destination légendaire.',
    minTreeStage: 'arbre',
  },
  {
    id: 'abysses_dur',
    name: 'Abysses Oubliées',
    emoji: '🦑',
    difficulty: 'hard',
    durationHours: 24,
    costCoins: 420,
    costCrops: [
      { cropId: 'corn', quantity: 6 },
      { cropId: 'cabbage', quantity: 5 },
      { cropId: 'tomato', quantity: 4 },
    ],
    description: 'Descendre dans les abysses où dorment les créatures anciennes.',
    minTreeStage: 'arbre',
  },
  {
    id: 'citadelle_dur',
    name: 'Citadelle des Vents',
    emoji: '🏰',
    difficulty: 'hard',
    durationHours: 24,
    costCoins: 470,
    costCrops: [
      { cropId: 'strawberry', quantity: 7 },
      { cropId: 'cucumber', quantity: 5 },
      { cropId: 'wheat', quantity: 5 },
    ],
    description: 'Escalader la forteresse perchée au sommet du monde.',
    minTreeStage: 'arbre',
  },
  {
    id: 'foret_petrifiee_dur',
    name: 'Forêt Pétrifiée',
    emoji: '🪨',
    difficulty: 'hard',
    durationHours: 24,
    costCoins: 480,
    costCrops: [
      { cropId: 'corn', quantity: 6 },
      { cropId: 'tomato', quantity: 6 },
      { cropId: 'carrot', quantity: 5 },
    ],
    description: 'Explorer la forêt de pierre où le temps s\'est arrêté.',
    minTreeStage: 'arbre',
  },

  // ─ Expert (36h) — accessible dès 'majestueux' ──────────────────
  {
    id: 'palais_expert',
    name: 'Palais Céleste',
    emoji: '✨',
    difficulty: 'expert',
    durationHours: 36,
    costCoins: 800,
    costCrops: [
      { cropId: 'pumpkin', quantity: 6 },
      { cropId: 'corn', quantity: 8 },
      { cropId: 'strawberry', quantity: 5 },
    ],
    description: 'Accéder au palais flottant au-dessus des nuages d\'or.',
    minTreeStage: 'majestueux',
  },
  {
    id: 'labyrinthe_expert',
    name: 'Labyrinthe Vivant',
    emoji: '🌀',
    difficulty: 'expert',
    durationHours: 36,
    costCoins: 850,
    costCrops: [
      { cropId: 'pumpkin', quantity: 5 },
      { cropId: 'tomato', quantity: 7 },
      { cropId: 'cabbage', quantity: 6 },
    ],
    description: 'Naviguer le labyrinthe dont les murs changent chaque heure.',
    minTreeStage: 'majestueux',
  },
  {
    id: 'forge_expert',
    name: 'Forge du Titan',
    emoji: '🔥',
    difficulty: 'expert',
    durationHours: 36,
    costCoins: 900,
    costCrops: [
      { cropId: 'pumpkin', quantity: 7 },
      { cropId: 'corn', quantity: 6 },
      { cropId: 'cucumber', quantity: 5 },
    ],
    description: 'Trouver la forge légendaire au cœur du volcan endormi.',
    minTreeStage: 'majestueux',
  },
  {
    id: 'sanctuaire_expert',
    name: 'Sanctuaire Glacé',
    emoji: '🧊',
    difficulty: 'expert',
    durationHours: 36,
    costCoins: 750,
    costCrops: [
      { cropId: 'pumpkin', quantity: 5 },
      { cropId: 'wheat', quantity: 8 },
      { cropId: 'potato', quantity: 7 },
    ],
    description: 'Atteindre le sanctuaire de glace éternelle du Grand Nord.',
    minTreeStage: 'majestueux',
  },
  {
    id: 'iles_expert',
    name: 'Îles Suspendues',
    emoji: '🪂',
    difficulty: 'expert',
    durationHours: 36,
    costCoins: 870,
    costCrops: [
      { cropId: 'pumpkin', quantity: 6 },
      { cropId: 'strawberry', quantity: 7 },
      { cropId: 'beetroot', quantity: 6 },
    ],
    description: 'Sauter entre les îles flottantes au-dessus de la mer de nuages.',
    minTreeStage: 'majestueux',
  },

  // ─ Légendaire (48h) — accessible dès 'legendaire' ──────────────
  {
    id: 'nexus_legendaire',
    name: 'Nexus des Mondes',
    emoji: '🌌',
    difficulty: 'legendary',
    durationHours: 48,
    costCoins: 1500,
    costCrops: [
      { cropId: 'pumpkin', quantity: 8 },
      { cropId: 'corn', quantity: 8 },
      { cropId: 'strawberry', quantity: 7 },
      { cropId: 'sunflower', quantity: 5 },
    ],
    description: 'Traverser le portail entre les dimensions pour sauver l\'arbre ancestral.',
    minTreeStage: 'legendaire',
  },
  {
    id: 'abime_legendaire',
    name: 'Abîme Éternel',
    emoji: '🕳️',
    difficulty: 'legendary',
    durationHours: 48,
    costCoins: 1600,
    costCrops: [
      { cropId: 'pumpkin', quantity: 9 },
      { cropId: 'tomato', quantity: 7 },
      { cropId: 'cabbage', quantity: 7 },
      { cropId: 'sunflower', quantity: 6 },
    ],
    description: 'Plonger dans l\'abîme sans fond où naissent les étoiles.',
    minTreeStage: 'legendaire',
  },
  {
    id: 'cime_legendaire',
    name: 'Cime du Monde',
    emoji: '🗻',
    difficulty: 'legendary',
    durationHours: 48,
    costCoins: 1400,
    costCrops: [
      { cropId: 'pumpkin', quantity: 7 },
      { cropId: 'wheat', quantity: 9 },
      { cropId: 'potato', quantity: 8 },
      { cropId: 'corn', quantity: 5 },
    ],
    description: 'Grimper jusqu\'au sommet du monde pour toucher le ciel.',
    minTreeStage: 'legendaire',
  },
  {
    id: 'jardin_legendaire',
    name: 'Jardin des Origines',
    emoji: '🌺',
    difficulty: 'legendary',
    durationHours: 48,
    costCoins: 1700,
    costCrops: [
      { cropId: 'pumpkin', quantity: 10 },
      { cropId: 'strawberry', quantity: 8 },
      { cropId: 'corn', quantity: 6 },
      { cropId: 'sunflower', quantity: 6 },
    ],
    description: 'Retrouver le jardin mythique où la première graine a été plantée.',
    minTreeStage: 'legendaire',
  },
  {
    id: 'etoiles_legendaire',
    name: 'Mer des Étoiles',
    emoji: '🌠',
    difficulty: 'legendary',
    durationHours: 48,
    costCoins: 1800,
    costCrops: [
      { cropId: 'pumpkin', quantity: 9 },
      { cropId: 'sunflower', quantity: 8 },
      { cropId: 'corn', quantity: 7 },
      { cropId: 'strawberry', quantity: 7 },
    ],
    description: 'Naviguer sur l\'océan de lumière vers la constellation oubliée.',
    minTreeStage: 'legendaire',
  },
];

// ─── Taux de drop par difficulté ─────────────────────────────────────────────

export const EXPEDITION_DROP_RATES: Record<ExpeditionDifficulty, Record<ExpeditionOutcome, number>> = {
  easy:      { success: 0.60, partial: 0.25, failure: 0.12, rare_discovery: 0.03 },
  pousse:    { success: 0.55, partial: 0.25, failure: 0.15, rare_discovery: 0.05 },
  medium:    { success: 0.40, partial: 0.30, failure: 0.20, rare_discovery: 0.10 },
  hard:      { success: 0.25, partial: 0.25, failure: 0.30, rare_discovery: 0.20 },
  expert:    { success: 0.20, partial: 0.25, failure: 0.30, rare_discovery: 0.25 },
  legendary: { success: 0.15, partial: 0.20, failure: 0.30, rare_discovery: 0.35 },
};

// ─── Table de loot ────────────────────────────────────────────────────────────

export const EXPEDITION_LOOT_TABLE: Record<ExpeditionDifficulty, ExpeditionLoot[]> = {
  easy: [
    { itemId: 'boost_recolte_2x', type: 'booster', label: 'Boost Récolte ×2', emoji: '🌾' },
  ],
  pousse: [
    { itemId: 'loutre_riviere', type: 'inhabitant', label: 'Loutre de Rivière', emoji: '🦦' },
    { itemId: 'lynx_mystere', type: 'inhabitant', label: 'Lynx Mystère', emoji: '🐱' },
    { itemId: 'mousse_etoile', type: 'seed', label: 'Mousse Étoilée', emoji: '🌟' },
    { itemId: 'boost_recolte_2x', type: 'booster', label: 'Boost Récolte ×2', emoji: '🌾' },
  ],
  medium: [
    { itemId: 'renard_arctique', type: 'inhabitant', label: 'Renard Explorateur', emoji: '🦊' },
    { itemId: 'fleur_lave', type: 'seed', label: 'Fleur de Lave', emoji: '🌺' },
    { itemId: 'boost_recolte_2x', type: 'booster', label: 'Boost Récolte ×2', emoji: '🌾' },
    { itemId: 'boost_production_2x', type: 'booster', label: 'Boost Production ×2', emoji: '⚙️' },
  ],
  hard: [
    { itemId: 'aigle_dore', type: 'inhabitant', label: 'Aigle Légendaire', emoji: '🦅' },
    { itemId: 'dragon_glace', type: 'inhabitant', label: 'Dragon de Glace', emoji: '🐉' },
    { itemId: 'fleur_celeste', type: 'seed', label: 'Fleur Céleste', emoji: '🌸' },
    { itemId: 'fleur_lave', type: 'seed', label: 'Fleur de Lave', emoji: '🌺' },
    { itemId: 'boost_chance_doree', type: 'booster', label: 'Boost Chance Dorée', emoji: '🌟' },
    { itemId: 'boost_production_2x', type: 'booster', label: 'Boost Production ×2', emoji: '⚙️' },
  ],
  expert: [
    { itemId: 'cerf_argente', type: 'inhabitant', label: 'Cerf Argenté', emoji: '🦌' },
    { itemId: 'tortue_ancienne', type: 'inhabitant', label: 'Tortue Ancienne', emoji: '🐢' },
    { itemId: 'racine_geante', type: 'seed', label: 'Racine Géante', emoji: '🌿' },
    { itemId: 'cristal_noir', type: 'seed', label: 'Cristal Noir', emoji: '💎' },
    { itemId: 'boost_chance_doree', type: 'booster', label: 'Boost Chance Dorée', emoji: '🌟' },
    { itemId: 'boost_mega_recolte_3x', type: 'booster', label: 'Boost Méga-Récolte ×3', emoji: '🌾' },
  ],
  legendary: [
    { itemId: 'phenix_celeste', type: 'inhabitant', label: 'Phénix Céleste', emoji: '🔥' },
    { itemId: 'loup_etoile', type: 'inhabitant', label: 'Loup des Étoiles', emoji: '🐺' },
    { itemId: 'fleur_celeste', type: 'seed', label: 'Fleur Céleste', emoji: '🌸' },
    { itemId: 'racine_geante', type: 'seed', label: 'Racine Géante', emoji: '🌿' },
    { itemId: 'cristal_noir', type: 'seed', label: 'Cristal Noir', emoji: '💎' },
    { itemId: 'boost_mega_recolte_3x', type: 'booster', label: 'Boost Méga-Récolte ×3', emoji: '🌾' },
    { itemId: 'boost_production_3x', type: 'booster', label: 'Boost Production ×3', emoji: '⚙️' },
  ],
};

// ─── Fonctions timer ──────────────────────────────────────────────────────────

/**
 * Retourne true si l'expédition est terminée (durée écoulée).
 * Pattern identique à building-engine.ts elapsed time check.
 */
export function isExpeditionComplete(exp: ActiveExpedition, now: Date = new Date()): boolean {
  const started = new Date(exp.startedAt).getTime();
  const durationMs = exp.durationHours * 60 * 60 * 1000;
  return now.getTime() >= started + durationMs;
}

/**
 * Retourne le nombre de minutes restantes avant la fin de l'expédition.
 * Retourne 0 si déjà terminée.
 */
export function getExpeditionRemainingMinutes(exp: ActiveExpedition, now: Date = new Date()): number {
  if (isExpeditionComplete(exp, now)) return 0;
  const started = new Date(exp.startedAt).getTime();
  const endTime = started + exp.durationHours * 60 * 60 * 1000;
  return Math.ceil((endTime - now.getTime()) / 60000);
}

// ─── Roll résultat ────────────────────────────────────────────────────────────

/**
 * Calcule le résultat d'une expédition selon la difficulté et le compteur de pity.
 * Pity system : après 5 échecs consécutifs, retourne 'success' garanti.
 * Pattern inspiré de rewards.ts PITY_THRESHOLD.
 */
export function rollExpeditionResult(
  difficulty: ExpeditionDifficulty,
  pityCount: number
): ExpeditionOutcome {
  if (pityCount >= 5) return 'success';

  const rates = EXPEDITION_DROP_RATES[difficulty];
  const roll = Math.random();

  let cumulative = 0;
  const outcomes: ExpeditionOutcome[] = ['success', 'partial', 'failure', 'rare_discovery'];
  for (const outcome of outcomes) {
    cumulative += rates[outcome];
    if (roll < cumulative) return outcome;
  }

  // Fallback (float precision)
  return 'failure';
}

/**
 * Calcule le loot obtenu selon la difficulté et l'outcome.
 * - failure → undefined (perte totale)
 * - partial → undefined (pas d'item, juste retour partiel des ressources)
 * - success / rare_discovery → item aléatoire dans la table de loot
 */
export function rollExpeditionLoot(
  difficulty: ExpeditionDifficulty,
  outcome: ExpeditionOutcome
): ExpeditionLoot | undefined {
  if (outcome === 'failure' || outcome === 'partial') return undefined;

  const table = EXPEDITION_LOOT_TABLE[difficulty];
  if (!table || table.length === 0) return undefined;

  const idx = Math.floor(Math.random() * table.length);
  return table[idx];
}

// ─── Pool quotidien déterministe ──────────────────────────────────────────────

/**
 * Génère le pool de 3 missions du jour (1 par difficulté) de façon déterministe.
 * Seed basé sur la date : toute la famille voit les mêmes missions.
 *
 * Algorithme LCG (Linear Congruential Generator) :
 * ((seed * 1103515245 + offset * 12345) & 0x7fffffff) / 0x7fffffff
 */
export function getDailyExpeditionPool(date?: string): ExpeditionMission[] {
  const today = date ?? new Date().toISOString().slice(0, 10);
  // Seed = YYYYMMDD sans tirets (ex: 20260414)
  const seed = parseInt(today.replace(/-/g, ''), 10);

  function lcgRandom(offset: number): number {
    return ((seed * 1103515245 + offset * 12345) & 0x7fffffff) / 0x7fffffff;
  }

  const difficulties: ExpeditionDifficulty[] = ['easy', 'pousse', 'medium', 'hard', 'expert', 'legendary'];
  const result: ExpeditionMission[] = [];

  for (let i = 0; i < difficulties.length; i++) {
    const diff = difficulties[i];
    const pool = EXPEDITION_CATALOG.filter(m => m.difficulty === diff);
    if (pool.length === 0) continue;
    const idx = Math.floor(lcgRandom(i + 1) * pool.length);
    result.push(pool[idx]);
  }

  return result;
}

/**
 * Filtre un pool d'expéditions selon le stade d'arbre du profil.
 * Seules les missions dont minTreeStage ≤ treeStage sont retournées.
 */
export function filterExpeditionsByTreeStage(
  pool: ExpeditionMission[],
  treeStage: TreeStage
): ExpeditionMission[] {
  const viewerIdx = TREE_STAGE_ORDER.indexOf(treeStage);
  return pool.filter(m => TREE_STAGE_ORDER.indexOf(m.minTreeStage) <= viewerIdx);
}

// ─── Helper lookup loot ───────────────────────────────────────────────────────

/**
 * Retourne le label et l'emoji lisibles pour un itemId donné.
 * Cherche dans toutes les difficultés de EXPEDITION_LOOT_TABLE.
 * Retourne null si l'itemId est introuvable.
 */
export function getLootDisplay(
  itemId: string
): { label: string; emoji: string } | null {
  for (const difficulty of Object.keys(EXPEDITION_LOOT_TABLE) as ExpeditionDifficulty[]) {
    const found = EXPEDITION_LOOT_TABLE[difficulty].find(item => item.itemId === itemId);
    if (found) return { label: found.label, emoji: found.emoji };
  }
  return null;
}

// ─── Helpers coût ─────────────────────────────────────────────────────────────

/**
 * Vérifie si le joueur peut se permettre l'expédition.
 * Exige à la fois les feuilles (coins) ET les récoltes requises.
 */
export function canAffordExpedition(
  mission: ExpeditionMission,
  coins: number,
  harvestInventory: Record<string, number>
): boolean {
  if (coins < mission.costCoins) return false;

  for (const cost of mission.costCrops) {
    const available = harvestInventory[cost.cropId] ?? 0;
    if (available < cost.quantity) return false;
  }

  return true;
}

/**
 * Retourne une description lisible du coût récolte d'une expédition.
 * Ex: "2 🥕 Carotte + 1 🌾 Blé"
 * Ne contient PAS les feuilles (ajoutées par l'appelant).
 */
export function getExpeditionCostDescription(
  mission: ExpeditionMission,
  t?: (key: string) => string,
): string {
  const parts: string[] = [];
  for (const cost of mission.costCrops) {
    const cropDef = CROP_CATALOG.find(c => c.id === cost.cropId);
    const emoji = cropDef?.emoji ?? '';
    const label = cropDef && t ? t(cropDef.labelKey) : cost.cropId;
    parts.push(`${cost.quantity} ${emoji} ${label}`);
  }
  return parts.join(' + ');
}
