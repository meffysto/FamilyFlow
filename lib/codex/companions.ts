// lib/codex/companions.ts — Compagnons mascotte (source: COMPANION_SPECIES_CATALOG)
//
// Array dérivé de l'engine compagnon. La rareté et les textes d'espèce sont
// lus à la demande depuis COMPANION_SPECIES_CATALOG via getCompanionStats
// (lib/codex/stats.ts) pour rester alignés avec l'engine (per D-02).
//
// Sprites pixel art Mana Seed (stage adulte idle_1) — mêmes assets que
// CompanionSlot.tsx:95-121. Le fallback emoji est conservé pour le cas
// où le bundler perdrait un require().

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

const COMPANION_SPRITES: Record<CompanionSpecies, unknown> = {
  chat:     require('../../assets/garden/animals/chat/adulte/idle_1.png'),
  chien:    require('../../assets/garden/animals/chien/adulte/idle_1.png'),
  lapin:    require('../../assets/garden/animals/lapin/adulte/idle_1.png'),
  renard:   require('../../assets/garden/animals/renard/adulte/idle_1.png'),
  herisson: require('../../assets/garden/animals/herisson/adulte/idle_1.png'),
};

export const companionEntries: CompanionEntry[] = COMPANION_SPECIES_CATALOG.map((c) => ({
  id: `companion_${c.id}`,
  kind: 'companion' as const,
  sourceId: c.id,
  nameKey: `codex:companion.${c.id}.name`,
  loreKey: `codex:companion.${c.id}.lore`,
  iconRef: COMPANION_EMOJI[c.id],
  spriteRef: COMPANION_SPRITES[c.id],
}));
