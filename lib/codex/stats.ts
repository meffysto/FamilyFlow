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
import { QUEST_TEMPLATES } from '../../constants/questTemplates';
import type { FamilyQuestTemplate } from '../quest-engine';
import { ADVENTURES, type Adventure } from '../mascot/adventures';
import { SEASONAL_EVENT_DIALOGUES } from '../mascot/seasonal-events-content';
import type { SeasonalEventContent } from '../mascot/seasonal-events-types';
import {
  GOLDEN_CROP_CHANCE,
  GOLDEN_HARVEST_MULTIPLIER,
  HARVEST_EVENT_CHANCE,
  HARVEST_EVENT_WEIGHTS,
  RARE_SEED_DROP_RULES,
  type HarvestEventType,
} from '../mascot/farm-engine';
import { SEASONAL_EVENTS, SEASONAL_DROP_CHANCE } from '../gamification/seasonal-rewards';

import type {
  CropEntry,
  AnimalEntry,
  BuildingEntry,
  CraftEntry,
  TechEntry,
  CompanionEntry,
  LootEntry,
  SagaEntry,
  QuestEntry,
  SeasonalEntry,
  AdventureEntry,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FR_MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'] as const;

function formatMmDd(mmdd: string): string {
  const [mm, dd] = mmdd.split('-');
  return `${parseInt(dd, 10)} ${FR_MONTHS[parseInt(mm, 10) - 1]}`;
}

function toPct(value: number): string {
  const n = value * 100;
  const rounded = Math.round(n * 100) / 100; // 2 décimales max
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded} %`;
}

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

export function getQuestStats(entry: QuestEntry): FamilyQuestTemplate | undefined {
  return QUEST_TEMPLATES.find((q) => q.id === entry.sourceId);
}

export function getAdventureStats(entry: AdventureEntry): Adventure | undefined {
  return ADVENTURES.find((a) => a.id === entry.sourceId);
}

export function getSeasonalStats(
  entry: SeasonalEntry,
): SeasonalEventContent | undefined {
  return SEASONAL_EVENT_DIALOGUES[entry.sourceId];
}

/**
 * Retourne les stats affichables d'une entrée loot : chance de drop et
 * multiplicateur éventuel. Les valeurs sont pré-formatées en chaîne
 * (ex: "3 %", "×5") pour éviter tout traitement supplémentaire dans l'UI.
 */
export function getLootStats(
  entry: LootEntry,
): Record<string, unknown> | undefined {
  if (entry.lootType === 'golden_crop') {
    return {
      chance: toPct(GOLDEN_CROP_CHANCE),
      multiplier: `×${GOLDEN_HARVEST_MULTIPLIER}`,
    };
  }
  if (entry.lootType === 'harvest_event') {
    const weight = HARVEST_EVENT_WEIGHTS[entry.sourceId as HarvestEventType] ?? 0;
    return { chance: toPct(HARVEST_EVENT_CHANCE * weight) };
  }
  if (entry.lootType === 'rare_seed_drop') {
    const rule = RARE_SEED_DROP_RULES.find((r) => r.seedId === entry.sourceId);
    if (!rule) return undefined;
    const sources =
      rule.sourceCropIds === '*'
        ? 'Toutes cultures'
        : rule.sourceCropIds
            .map((id) => CROP_CATALOG.find((c) => c.id === id)?.emoji ?? id)
            .join(' ');
    return { chance: toPct(rule.chance), sources };
  }
  return undefined;
}

/**
 * Retourne la période et la chance de drop d'un événement saisonnier.
 * La période est formatée en français court (ex: "27 déc — 2 jan").
 * Pâques est dynamique → libellé générique.
 */
export function getSeasonalPeriodStats(
  entry: SeasonalEntry,
): Record<string, unknown> | undefined {
  const event = SEASONAL_EVENTS.find((e) => e.id === entry.sourceId);
  if (!event) return undefined;

  const period =
    event.startDate === 'dynamic'
      ? 'Calculé dynamiquement'
      : `${formatMmDd(event.startDate)} — ${formatMmDd(event.endDate)}`;

  return {
    period,
    dropChance: toPct(SEASONAL_DROP_CHANCE),
  };
}
