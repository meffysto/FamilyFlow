// lib/codex/craft.ts — Recettes craft (source: CRAFT_RECIPES)
//
// Array dérivé de l'engine craft. Les ingrédients, sellValue et xpBonus sont
// lus à la demande depuis CRAFT_RECIPES via getCraftStats (lib/codex/stats.ts)
// pour rester alignés avec l'engine (per D-02).

import { CRAFT_RECIPES } from '../mascot/craft-engine';
import type { CraftEntry } from './types';

export const craftEntries: CraftEntry[] = CRAFT_RECIPES.map((r) => ({
  id: `craft_${r.id}`,
  kind: 'craft' as const,
  sourceId: r.id,
  nameKey: `codex:craft.${r.id}.name`,
  loreKey: `codex:craft.${r.id}.lore`,
  iconRef: r.emoji,
}));
