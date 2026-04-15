/**
 * expedition-engine.ts — Moteur logique pur des expéditions
 * Phase 33 — Système d'expéditions à risque
 *
 * Logique pure : catalogue, roll probabiliste, timer, pity system, pool quotidien
 * Aucune dépendance sur les hooks React ou le vault — testable unitairement
 */

import type { ActiveExpedition, ExpeditionDifficulty, ExpeditionOutcome } from '../types';
import { type TreeStage, TREE_STAGE_ORDER } from './types';

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

// ─── Catalogue (9 missions statiques) ────────────────────────────────────────

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
];

// ─── Taux de drop par difficulté ─────────────────────────────────────────────

export const EXPEDITION_DROP_RATES: Record<ExpeditionDifficulty, Record<ExpeditionOutcome, number>> = {
  easy:   { success: 0.60, partial: 0.25, failure: 0.12, rare_discovery: 0.03 },
  medium: { success: 0.40, partial: 0.30, failure: 0.20, rare_discovery: 0.10 },
  hard:   { success: 0.25, partial: 0.25, failure: 0.30, rare_discovery: 0.20 },
};

// ─── Table de loot ────────────────────────────────────────────────────────────

const EXPEDITION_LOOT_TABLE: Record<ExpeditionDifficulty, ExpeditionLoot[]> = {
  easy: [
    {
      itemId: 'boost_recolte_2x',
      type: 'booster',
      label: 'Boost Récolte ×2',
      emoji: '🌾',
    },
  ],
  medium: [
    {
      itemId: 'renard_expedition',
      type: 'inhabitant',
      label: 'Renard Explorateur',
      emoji: '🦊',
    },
    {
      itemId: 'fleur_de_lave',
      type: 'seed',
      label: 'Fleur de Lave',
      emoji: '🌺',
    },
    {
      itemId: 'boost_recolte_2x',
      type: 'booster',
      label: 'Boost Récolte ×2',
      emoji: '🌾',
    },
    {
      itemId: 'boost_production_2x',
      type: 'booster',
      label: 'Boost Production ×2',
      emoji: '⚙️',
    },
  ],
  hard: [
    {
      itemId: 'aigle_expedition',
      type: 'inhabitant',
      label: 'Aigle Légendaire',
      emoji: '🦅',
    },
    {
      itemId: 'graine_celeste',
      type: 'seed',
      label: 'Graine Céleste',
      emoji: '✨',
    },
    {
      itemId: 'fleur_de_lave',
      type: 'seed',
      label: 'Fleur de Lave',
      emoji: '🌺',
    },
    {
      itemId: 'boost_chance_doree',
      type: 'booster',
      label: 'Boost Chance Dorée',
      emoji: '🌟',
    },
    {
      itemId: 'boost_production_2x',
      type: 'booster',
      label: 'Boost Production ×2',
      emoji: '⚙️',
    },
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

  const difficulties: ExpeditionDifficulty[] = ['easy', 'medium', 'hard'];
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
 * Retourne une description lisible du coût d'une expédition.
 * Ex: "50 🍃 + 2 carotte"
 */
export function getExpeditionCostDescription(mission: ExpeditionMission): string {
  const parts: string[] = [`${mission.costCoins} 🍃`];
  for (const cost of mission.costCrops) {
    parts.push(`${cost.quantity} ${cost.cropId}`);
  }
  return parts.join(' + ');
}
