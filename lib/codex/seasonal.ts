// lib/codex/seasonal.ts — Drops saisonniers & événements (source: SEASONAL_EVENT_DIALOGUES Record)
//
// SEASONAL_EVENT_DIALOGUES est un Record<string, SeasonalEventContent> et non un array —
// on itère donc via Object.keys pour dériver les entries codex.
// 8 événements : nouvel-an, st-valentin, poisson-avril, paques, ete, rentree, halloween, noel.

import { SEASONAL_EVENT_DIALOGUES } from '../mascot/seasonal-events-content';
import type { SeasonalEntry } from './types';

export const seasonalEntries: SeasonalEntry[] = Object.entries(
  SEASONAL_EVENT_DIALOGUES,
).map(([key, content]) => ({
  id: `seasonal_${key}`,
  kind: 'seasonal' as const,
  sourceId: key,
  nameKey: `codex.seasonal.${key}.name`,
  loreKey: `codex.seasonal.${key}.lore`,
  iconRef: content.emoji,
}));
