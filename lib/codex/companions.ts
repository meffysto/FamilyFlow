// lib/codex/companions.ts — Compagnons mascotte (source: COMPANION_SPECIES_CATALOG)
//
// Array dérivé de l'engine compagnon. La rareté et les textes d'espèce sont
// lus à la demande depuis COMPANION_SPECIES_CATALOG via getCompanionStats
// (lib/codex/stats.ts) pour rester alignés avec l'engine (per D-02).

import { COMPANION_SPECIES_CATALOG } from '../mascot/companion-types';
import type { CompanionEntry } from './types';

export const companionEntries: CompanionEntry[] = COMPANION_SPECIES_CATALOG.map((c) => ({
  id: `companion_${c.id}`,
  kind: 'companion' as const,
  sourceId: c.id,
  nameKey: `codex.companion.${c.id}.name`,
  loreKey: `codex.companion.${c.id}.lore`,
}));
