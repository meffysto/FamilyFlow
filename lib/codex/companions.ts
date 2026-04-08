// lib/codex/companions.ts — Compagnons mascotte (source: COMPANION_SPECIES_CATALOG)
//
// Array dérivé de l'engine compagnon. La rareté et les textes d'espèce sont
// lus à la demande depuis COMPANION_SPECIES_CATALOG via getCompanionStats
// (lib/codex/stats.ts) pour rester alignés avec l'engine (per D-02).
//
// Note emoji : COMPANION_SPECIES_CATALOG n'expose pas de champ emoji. Le
// mapping canonique vit dans components/mascot/CompanionAvatarMini.tsx
// (SPECIES_EMOJI) — on le duplique ici volontairement pour ne pas créer
// un import UI → data, et parce que la liste est stable et très courte.

import {
  COMPANION_SPECIES_CATALOG,
  type CompanionSpecies,
} from '../mascot/companion-types';
import type { CompanionEntry } from './types';

const COMPANION_EMOJI: Record<CompanionSpecies, string> = {
  chat: '🐱',
  chien: '🐶',
  lapin: '🐰',
  renard: '🦊',
  herisson: '🦔',
};

export const companionEntries: CompanionEntry[] = COMPANION_SPECIES_CATALOG.map((c) => ({
  id: `companion_${c.id}`,
  kind: 'companion' as const,
  sourceId: c.id,
  nameKey: `codex:companion.${c.id}.name`,
  loreKey: `codex:companion.${c.id}.lore`,
  iconRef: COMPANION_EMOJI[c.id],
}));
