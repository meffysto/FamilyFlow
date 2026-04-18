/**
 * Phase 38 — Moteur pur de l'économie Sporée (MOD/SPOR v1.7)
 *
 * Fonctions pures, zéro I/O vault, zéro UI, zéro état partagé.
 * Tous les rolls utilisent Math.random() — testables via jest.spyOn(Math, 'random')
 * (pattern identique farm-engine.ts, voir 38-RESEARCH.md §4).
 *
 * Consommé par hooks/useFarm.ts (drop récolte), hooks/useExpeditions.ts (drop loot),
 * hooks/useGamification.ts (cadeau transition stade arbre) — voir Plan 38-03.
 */

import { CROP_CATALOG, TREE_STAGE_ORDER } from './types';
import type { TreeStage } from './types';
import type { ExpeditionDifficulty } from '../types';

// ─────────────────────────────────────────────
// Constantes économie Sporée (SPOR-08, SPOR-09)
// ─────────────────────────────────────────────

/** Cap strict inventaire Sporée per-profil (SPOR-09) */
export const SPOREE_MAX_INVENTORY = 10;

/** Drop rates à la récolte par tier de crop (SPOR-08) */
export const SPOREE_DROP_RATES = {
  base: 0.03,         // tier 1-3 : carrot/wheat/potato/beetroot/tomato/cabbage/cucumber/corn/strawberry/pumpkin/sunflower
  rare: 0.08,         // dropOnly: orchidee/rose_doree/truffe/fruit_dragon
  expedition: 0.15,   // expeditionExclusive: fleur_lave/cristal_noir/mousse_etoile/racine_geante/fleur_celeste
} as const;

/** Shop — prix en feuilles (SPOR-08) */
export const SPOREE_SHOP_PRICE = 400;

/** Shop — cap quotidien (reset minuit LOCAL device, SPOR-08) */
export const SPOREE_SHOP_DAILY_CAP = 2;

/** Shop — stade arbre minimum requis (SPOR-08) */
export const SPOREE_SHOP_MIN_TREE_STAGE: TreeStage = 'arbre';

/** Expedition — drop rate (SPOR-08) */
export const SPOREE_EXPEDITION_DROP_RATE = 0.05;

/** Expedition — difficultés éligibles Pousse+ (SPOR-08, exclut 'easy') */
export const SPOREE_EXPEDITION_ELIGIBLE: ReadonlyArray<ExpeditionDifficulty> = [
  'pousse', 'medium', 'hard', 'expert', 'legendary',
];

// ─────────────────────────────────────────────
// Classification tier par cropId
// ─────────────────────────────────────────────

export type HarvestTier = 'base' | 'rare' | 'expedition';

/** Détermine le tier d'un crop depuis les flags CROP_CATALOG. Default 'base' si cropId inconnu. */
export function classifyHarvestTier(cropId: string): HarvestTier {
  const def = CROP_CATALOG.find(c => c.id === cropId);
  if (!def) return 'base';
  if (def.expeditionExclusive) return 'expedition';
  if (def.dropOnly) return 'rare';
  return 'base';
}

// ─────────────────────────────────────────────
// Rolls drops (Math.random + spy Jest testable)
// ─────────────────────────────────────────────

/** Roll drop Sporée post-récolte (SPOR-08). Retourne true si drop obtenu. */
export function rollSporeeDropOnHarvest(tier: HarvestTier): boolean {
  return Math.random() < SPOREE_DROP_RATES[tier];
}

/** Roll drop Sporée post-expedition (SPOR-08). 0% sur 'easy', 5% sur Pousse+. */
export function rollSporeeDropOnExpedition(difficulty: ExpeditionDifficulty): boolean {
  if (!SPOREE_EXPEDITION_ELIGIBLE.includes(difficulty)) return false;
  return Math.random() < SPOREE_EXPEDITION_DROP_RATE;
}

// ─────────────────────────────────────────────
// Inventaire — cap 10 (SPOR-09)
// ─────────────────────────────────────────────

export interface IncrementResult {
  accepted: boolean;
  newCount: number;              // count après tentative (inchangé si refusé)
  reason?: 'inventory_full';
}

/** Tente d'ajouter `qty` Sporée(s) à l'inventaire. Refusé si dépasse cap 10 (drop perdu, zéro conversion). */
export function tryIncrementSporeeCount(currentCount: number, qty: number = 1): IncrementResult {
  if (currentCount >= SPOREE_MAX_INVENTORY) {
    return { accepted: false, newCount: currentCount, reason: 'inventory_full' };
  }
  // Clamp : si qty pousse au-dessus du cap, accepte mais clamp à 10 (partiel accepté).
  // Décision 38-RESEARCH §9 : refusé pur si déjà plein, pas de fallback feuilles.
  const newCount = Math.min(currentCount + qty, SPOREE_MAX_INVENTORY);
  return { accepted: true, newCount };
}

// ─────────────────────────────────────────────
// Shop — validation achat (SPOR-08)
// ─────────────────────────────────────────────

export interface BuySporeeOpts {
  coins: number;                   // feuilles disponibles
  treeStage: TreeStage;            // stade courant de l'arbre mascotte
  boughtToday: number;             // achats déjà effectués aujourd'hui
  lastResetDate: string;           // YYYY-MM-DD local — dernière date de reset
  today: string;                   // YYYY-MM-DD local — injecté pour testabilité
  sporeeCount: number;             // inventaire actuel
}

export type BuySporeeReason = 'insufficient_stage' | 'insufficient_coins' | 'daily_cap' | 'inventory_full';

export interface BuySporeeCheck {
  ok: boolean;
  reason?: BuySporeeReason;
  // Projection post-achat (valide seulement si ok:true)
  nextBoughtToday?: number;
  nextLastResetDate?: string;
  nextSporeeCount?: number;
  nextCoins?: number;
}

/** Valide si l'achat Sporée est possible. Pure : n'effectue aucune mutation. */
export function canBuySporee(opts: BuySporeeOpts): BuySporeeCheck {
  const { coins, treeStage, boughtToday, lastResetDate, today, sporeeCount } = opts;

  // Check stade arbre (index 3 = 'arbre')
  const currentStageIdx = TREE_STAGE_ORDER.indexOf(treeStage);
  const minStageIdx = TREE_STAGE_ORDER.indexOf(SPOREE_SHOP_MIN_TREE_STAGE);
  if (currentStageIdx < minStageIdx) {
    return { ok: false, reason: 'insufficient_stage' };
  }

  // Check inventaire plein
  if (sporeeCount >= SPOREE_MAX_INVENTORY) {
    return { ok: false, reason: 'inventory_full' };
  }

  // Appliquer reset quotidien si date changée
  const reset = applyDailyResetIfNeeded(boughtToday, lastResetDate, today);

  // Check cap quotidien après reset
  if (reset.boughtToday >= SPOREE_SHOP_DAILY_CAP) {
    return { ok: false, reason: 'daily_cap' };
  }

  // Check feuilles
  if (coins < SPOREE_SHOP_PRICE) {
    return { ok: false, reason: 'insufficient_coins' };
  }

  return {
    ok: true,
    nextBoughtToday: reset.boughtToday + 1,
    nextLastResetDate: reset.lastResetDate,
    nextSporeeCount: sporeeCount + 1,
    nextCoins: coins - SPOREE_SHOP_PRICE,
  };
}

/** Applique le reset quotidien si today > lastResetDate (comparaison string lexicographique YYYY-MM-DD). */
export function applyDailyResetIfNeeded(
  boughtToday: number,
  lastResetDate: string,
  today: string,
): { boughtToday: number; lastResetDate: string } {
  if (!lastResetDate || today > lastResetDate) {
    return { boughtToday: 0, lastResetDate: today };
  }
  return { boughtToday, lastResetDate };
}

/** Format YYYY-MM-DD LOCAL device (pas UTC — cf. 38-RESEARCH Open Q4). */
export function getLocalDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─────────────────────────────────────────────
// Cadeau onboarding transition stade 2→3 (SPOR-08)
// ─────────────────────────────────────────────

export interface OnboardingGiftOpts {
  fromStage: TreeStage | undefined;
  toStage: TreeStage | undefined;
  alreadyClaimed: boolean;
}

/** Gate pur : retourne true SI transition arbuste→arbre ET cadeau jamais réclamé. */
export function shouldGiftOnboardingSporee(opts: OnboardingGiftOpts): boolean {
  if (opts.alreadyClaimed) return false;
  if (opts.fromStage !== 'arbuste') return false;
  if (opts.toStage !== 'arbre') return false;
  return true;
}
