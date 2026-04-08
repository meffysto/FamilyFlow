// lib/codex/content.ts — Point d'entrée unifié du codex ferme (Phase 16, CODEX-01)
// Agrège les 10 catégories dérivées des constantes engine sans drift (per D-02).

import { cropEntries } from './cultures';
import { animalEntries } from './animals';
import { buildingEntries } from './buildings';
import { craftEntries } from './craft';
import { techEntries } from './tech';
import { companionEntries } from './companions';
import { lootEntries } from './loot';
import { seasonalEntries } from './seasonal';
import { sagaEntries } from './sagas';
import { questEntries } from './quests';

import type { CodexEntry } from './types';

export const CODEX_CONTENT: CodexEntry[] = [
  ...cropEntries,
  ...animalEntries,
  ...buildingEntries,
  ...craftEntries,
  ...techEntries,
  ...companionEntries,
  ...lootEntries,
  ...seasonalEntries,
  ...sagaEntries,
  ...questEntries,
];

// Re-exports pour permettre un import unique depuis lib/codex/content
export * from './types';
export * from './stats';
export {
  HARVEST_EVENTS,
  RARE_SEED_DROP_RULES,
  GOLDEN_CROP_CHANCE,
  GOLDEN_HARVEST_MULTIPLIER,
} from './loot';

// Assert __DEV__ : garantit que les 10 kinds sont tous représentés au démarrage
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const kinds = new Set(CODEX_CONTENT.map((e) => e.kind));
  const expected: CodexEntry['kind'][] = [
    'crop',
    'animal',
    'building',
    'craft',
    'tech',
    'companion',
    'loot',
    'seasonal',
    'saga',
    'quest',
  ];
  const missing = expected.filter((k) => !kinds.has(k));
  if (missing.length > 0) {
    console.error('[codex] Kinds manquants dans CODEX_CONTENT:', missing);
  }
}
