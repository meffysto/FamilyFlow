// lib/codex/buildings.ts — Bâtiments productifs (source: BUILDING_CATALOG)
//
// Array dérivé de l'engine ferme. Aucune valeur numérique dupliquée ici :
// les stats (cycle, coût, upgrades) sont lues à la demande via lib/codex/stats.ts
// (getBuildingStats) pour rester alignées avec l'engine (per D-02).

import { BUILDING_CATALOG } from '../mascot/types';
import type { BuildingEntry } from './types';

export const buildingEntries: BuildingEntry[] = BUILDING_CATALOG.map((b) => ({
  id: `building_${b.id}`,
  kind: 'building' as const,
  sourceId: b.id,
  nameKey: `codex:building.${b.id}.name`,
  loreKey: `codex:building.${b.id}.lore`,
  iconRef: b.emoji,
}));
