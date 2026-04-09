// lib/semantic/effects.ts
// Dispatcher applyTaskEffect() + 10 handlers d'effets sémantiques — Phase 20 v1.3 Seed.
//
// Décision architecturale (deviation délibérée de RESEARCH.md) :
// Ce dispatcher est SYNCHRONE intentionnellement — tous les handlers sont des mutations
// de données pures sans I/O. L'async n'est nécessaire que pour les caps (Plan 02) et
// le feature flag, qui sont gérés dans le caller (Plan 03).
//
// ARCH-01 : aucun import vault.ts, hooks, ou SecureStore — module 100% pur.
// SEMANTIC-06 : chaque CategoryId est mappé 1:1 à un EffectId.

import type { CategoryId, CategoryMatch } from './categories';
import type { FarmProfileData } from '../types';
import { repairWearEvent } from '../mascot/wear-engine';

// ── Types exportés ──────────────────────────────────────────────────────────────

export type EffectId =
  | 'weeds_removed'      // EFFECTS-01
  | 'wear_repaired'      // EFFECTS-02
  | 'building_turbo'     // EFFECTS-03
  | 'companion_mood'     // EFFECTS-04
  | 'growth_sprint'      // EFFECTS-05
  | 'rare_seed_drop'     // EFFECTS-06
  | 'saga_trait_boost'   // EFFECTS-07
  | 'capacity_boost'     // EFFECTS-08
  | 'golden_harvest'     // EFFECTS-09
  | 'recipe_unlock';     // EFFECTS-10

export interface EffectResult {
  effectApplied: EffectId | null;
  farmData: FarmProfileData;
  sagaTraitDelta?: { trait: string; amount: number };
  companionEvent?: string;  // 'task_completed' — consommé dans Plan 03, rendu dans Phase 21
  message?: string;         // evidence brute pour Phase 21 toasts
}

/** Multiplicateur golden harvest EFFECTS-09 : x3 (distinct de GOLDEN_HARVEST_MULTIPLIER = 5) */
export const EFFECT_GOLDEN_MULTIPLIER = 3;

// ── Mapping CategoryId → EffectId ──────────────────────────────────────────────

const CATEGORY_EFFECT_MAP: Record<CategoryId, EffectId> = {
  menage_quotidien: 'weeds_removed',
  menage_hebdo:     'wear_repaired',
  courses:          'building_turbo',
  enfants_routines: 'companion_mood',
  enfants_devoirs:  'growth_sprint',
  rendez_vous:      'rare_seed_drop',
  gratitude_famille:'saga_trait_boost',
  budget_admin:     'capacity_boost',
  bebe_soins:       'golden_harvest',
  cuisine_repas:    'recipe_unlock',
};

// ── Handlers locaux (fonctions pures, non exportées) ───────────────────────────

/** EFFECTS-01 : retire un weed de la ferme */
function handleWeedsRemoved(farmData: FarmProfileData, now: Date): EffectResult {
  const events = farmData.wearEvents ?? [];
  const weedEvent = events.find(e => e.type === 'weeds' && !e.repairedAt);
  if (!weedEvent) {
    return { effectApplied: null, farmData };
  }
  const result = repairWearEvent(events, weedEvent.id, Infinity, now);
  if (!result) {
    return { effectApplied: null, farmData };
  }
  return {
    effectApplied: 'weeds_removed',
    farmData: { ...farmData, wearEvents: result.events },
  };
}

/** EFFECTS-02 : répare un wear event non-weeds (priorité broken_fence > damaged_roof > pest) */
function handleWearRepaired(farmData: FarmProfileData, now: Date): EffectResult {
  const events = farmData.wearEvents ?? [];
  const priority: Array<string> = ['broken_fence', 'damaged_roof', 'pests'];
  let targetEvent = undefined as typeof events[number] | undefined;
  for (const type of priority) {
    targetEvent = events.find(e => e.type === type && !e.repairedAt);
    if (targetEvent) break;
  }
  if (!targetEvent) {
    return { effectApplied: null, farmData };
  }
  const result = repairWearEvent(events, targetEvent.id, Infinity, now);
  if (!result) {
    return { effectApplied: null, farmData };
  }
  return {
    effectApplied: 'wear_repaired',
    farmData: { ...farmData, wearEvents: result.events },
  };
}

/** EFFECTS-03 : accélère les bâtiments pendant 24h */
function handleBuildingTurbo(farmData: FarmProfileData, now: Date): EffectResult {
  const buildingTurboUntil = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
  return {
    effectApplied: 'building_turbo',
    farmData: { ...farmData, buildingTurboUntil },
  };
}

/** EFFECTS-04 : spike du mood compagnon + message IA */
function handleCompanionMood(farmData: FarmProfileData): EffectResult {
  return {
    effectApplied: 'companion_mood',
    farmData,
    companionEvent: 'task_completed',
  };
}

/** EFFECTS-05 : growth sprint 24h (tasksPerStage +1) */
function handleGrowthSprint(farmData: FarmProfileData, now: Date): EffectResult {
  const growthSprintUntil = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
  return {
    effectApplied: 'growth_sprint',
    farmData: { ...farmData, growthSprintUntil },
  };
}

/** EFFECTS-06 : guaranteed rare seed drop */
function handleRareSeedDrop(farmData: FarmProfileData): EffectResult {
  const rarePool = ['orchidee', 'rose_doree', 'truffe'];
  const seedId = rarePool[Math.floor(Math.random() * rarePool.length)];
  const existing = farmData.farmRareSeeds ?? {};
  const updated = { ...existing, [seedId]: ((existing as Record<string, number>)[seedId] ?? 0) + 1 };
  return {
    effectApplied: 'rare_seed_drop',
    farmData: { ...farmData, farmRareSeeds: updated },
    message: seedId,
  };
}

/** EFFECTS-07 : saga trait boost générosité +1 */
function handleSagaTraitBoost(farmData: FarmProfileData): EffectResult {
  return {
    effectApplied: 'saga_trait_boost',
    farmData,
    sagaTraitDelta: { trait: 'générosité', amount: 1 },
  };
}

/** EFFECTS-08 : building capacity boost ×2 pendant 24h */
function handleCapacityBoost(farmData: FarmProfileData, now: Date): EffectResult {
  const capacityBoostUntil = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
  return {
    effectApplied: 'capacity_boost',
    farmData: { ...farmData, capacityBoostUntil },
  };
}

/** EFFECTS-09 : marque la prochaine récolte comme dorée (×3) */
function handleGoldenHarvest(farmData: FarmProfileData): EffectResult {
  return {
    effectApplied: 'golden_harvest',
    farmData: { ...farmData, nextHarvestGolden: true },
  };
}

/** EFFECTS-10 : débloque une recette craft rare */
function handleRecipeUnlock(farmData: FarmProfileData): EffectResult {
  const effectRecipes = ['confiture_truffee', 'gateau_dore', 'elixir_champignon'];
  const existing = farmData.unlockedEffectRecipes ?? [];
  const available = effectRecipes.filter(r => !existing.includes(r));
  if (available.length === 0) {
    return { effectApplied: null, farmData };
  }
  const chosenId = available[Math.floor(Math.random() * available.length)];
  return {
    effectApplied: 'recipe_unlock',
    farmData: { ...farmData, unlockedEffectRecipes: [...existing, chosenId] },
    message: chosenId,
  };
}

// ── Dispatcher principal ────────────────────────────────────────────────────────

/**
 * Applique l'effet wow associé à la catégorie sémantique d'une tâche.
 *
 * SYNCHRONE — voir note architecturale en tête de fichier.
 *
 * @param match - Résultat de `deriveTaskCategory()` (Phase 19)
 * @param farmData - État ferme courant (lu depuis farm-{profileId}.md)
 * @param now - Date courante (injectable pour tests)
 * @returns EffectResult avec farmData muté + champs optionnels pour Phase 21
 */
export function applyTaskEffect(
  match: CategoryMatch,
  farmData: FarmProfileData,
  now: Date = new Date(),
): EffectResult {
  const effectId = CATEGORY_EFFECT_MAP[match.id];

  switch (effectId) {
    case 'weeds_removed':   return handleWeedsRemoved(farmData, now);
    case 'wear_repaired':   return handleWearRepaired(farmData, now);
    case 'building_turbo':  return handleBuildingTurbo(farmData, now);
    case 'companion_mood':  return handleCompanionMood(farmData);
    case 'growth_sprint':   return handleGrowthSprint(farmData, now);
    case 'rare_seed_drop':  return handleRareSeedDrop(farmData);
    case 'saga_trait_boost':return handleSagaTraitBoost(farmData);
    case 'capacity_boost':  return handleCapacityBoost(farmData, now);
    case 'golden_harvest':  return handleGoldenHarvest(farmData);
    case 'recipe_unlock':   return handleRecipeUnlock(farmData);
    default: {
      const _exhaustive: never = effectId;
      void _exhaustive;
      return { effectApplied: null, farmData };
    }
  }
}
