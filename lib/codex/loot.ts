// lib/codex/loot.ts — Loot box & raretés agrégés (per D-13, CODEX-04)
import {
  HARVEST_EVENTS,
  RARE_SEED_DROP_RULES,
  GOLDEN_CROP_CHANCE,
  GOLDEN_HARVEST_MULTIPLIER,
} from '../mascot/farm-engine';
import type { LootEntry } from './types';

// Re-export des constantes pour que l'UI Phase 17 puisse les afficher sans re-importer farm-engine
export { HARVEST_EVENTS, RARE_SEED_DROP_RULES, GOLDEN_CROP_CHANCE, GOLDEN_HARVEST_MULTIPLIER };

export const lootEntries: LootEntry[] = [
  {
    id: 'loot_golden_crop',
    kind: 'loot' as const,
    sourceId: 'golden_crop',
    lootType: 'golden_crop' as const,
    nameKey: 'codex.loot.golden_crop.name',
    loreKey: 'codex.loot.golden_crop.lore',
    iconRef: '✨',
  },
  ...HARVEST_EVENTS.map(ev => ({
    id: `loot_harvest_${ev.type}`,
    kind: 'loot' as const,
    sourceId: ev.type,
    lootType: 'harvest_event' as const,
    nameKey: `codex.loot.harvest_${ev.type}.name`,
    loreKey: `codex.loot.harvest_${ev.type}.lore`,
    iconRef: ev.emoji,
  })),
  ...RARE_SEED_DROP_RULES.map(rule => ({
    id: `loot_seed_${rule.seedId}`,
    kind: 'loot' as const,
    sourceId: rule.seedId,
    lootType: 'rare_seed_drop' as const,
    nameKey: `codex.loot.seed_${rule.seedId}.name`,
    loreKey: `codex.loot.seed_${rule.seedId}.lore`,
  })),
];
