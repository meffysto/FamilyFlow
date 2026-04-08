// lib/codex/stats.ts — Getters anti-drift (per D-02)
//
// Chaque getter lit la stat depuis la constante engine via le sourceId de l'entry.
// Aucune valeur numérique n'est dupliquée ici → si un cycle/coût change dans l'engine,
// le codex reflète automatiquement la valeur réelle au prochain rendu.

import {
  CROP_CATALOG,
  INHABITANTS,
  BUILDING_CATALOG,
  type CropDefinition,
  type MascotInhabitant,
  type BuildingDefinition,
  type CraftRecipe,
} from '../mascot/types';
import { CRAFT_RECIPES } from '../mascot/craft-engine';
import { TECH_TREE, type TechNode } from '../mascot/tech-engine';
import {
  COMPANION_SPECIES_CATALOG,
  type CompanionSpeciesInfo,
} from '../mascot/companion-types';
import { SAGAS } from '../mascot/sagas-content';
import type { Saga } from '../mascot/sagas-types';
import { ADVENTURES, type Adventure } from '../mascot/adventures';
import { SEASONAL_EVENT_DIALOGUES } from '../mascot/seasonal-events-content';
import type { SeasonalEventContent } from '../mascot/seasonal-events-types';

import type {
  CropEntry,
  AnimalEntry,
  BuildingEntry,
  CraftEntry,
  TechEntry,
  CompanionEntry,
  SagaEntry,
  QuestEntry,
  SeasonalEntry,
} from './types';

export function getCropStats(entry: CropEntry): CropDefinition | undefined {
  return CROP_CATALOG.find((c) => c.id === entry.sourceId);
}

export function getAnimalStats(entry: AnimalEntry): MascotInhabitant | undefined {
  return INHABITANTS.find((i) => i.id === entry.sourceId);
}

export function getBuildingStats(entry: BuildingEntry): BuildingDefinition | undefined {
  return BUILDING_CATALOG.find((b) => b.id === entry.sourceId);
}

export function getCraftStats(entry: CraftEntry): CraftRecipe | undefined {
  return CRAFT_RECIPES.find((r) => r.id === entry.sourceId);
}

export function getTechStats(entry: TechEntry): TechNode | undefined {
  return TECH_TREE.find((t) => t.id === entry.sourceId);
}

export function getCompanionStats(
  entry: CompanionEntry,
): CompanionSpeciesInfo | undefined {
  // String() pour neutraliser le typage littéral du catalogue compagnon
  return COMPANION_SPECIES_CATALOG.find((c) => String(c.id) === entry.sourceId);
}

export function getSagaStats(entry: SagaEntry): Saga | undefined {
  return SAGAS.find((s) => s.id === entry.sourceId);
}

export function getQuestStats(entry: QuestEntry): Adventure | undefined {
  return ADVENTURES.find((a) => a.id === entry.sourceId);
}

export function getSeasonalStats(
  entry: SeasonalEntry,
): SeasonalEventContent | undefined {
  return SEASONAL_EVENT_DIALOGUES[entry.sourceId];
}
