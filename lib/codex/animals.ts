// lib/codex/animals.ts — Habitants ferme + fantastiques + saga (source: INHABITANTS)
//
// Sprites pixel art Mana Seed (idle_1) pour les 17 inhabitants — mêmes
// assets que WorldGridView et CompanionSlot. Le fallback emoji est conservé
// en iconRef pour robustesse et accessibilité (lecteur d'écran).

import { INHABITANTS } from '../mascot/types';
import type { AnimalEntry } from './types';

function computeSubgroup(
  rarity: string,
  sagaExclusive: boolean,
): 'farm' | 'fantasy' | 'saga' {
  if (sagaExclusive) return 'saga';
  if (rarity === 'épique' || rarity === 'légendaire' || rarity === 'prestige') return 'fantasy';
  return 'farm';
}

/** require() statique pour que Metro embarque les PNG au bundle. */
const ANIMAL_SPRITES: Record<string, unknown> = {
  poussin:        require('../../assets/garden/animals/poussin/idle_1.png'),
  poulet:         require('../../assets/garden/animals/poulet/idle_1.png'),
  canard:         require('../../assets/garden/animals/canard/idle_1.png'),
  cochon:         require('../../assets/garden/animals/cochon/idle_1.png'),
  vache:          require('../../assets/garden/animals/vache/idle_1.png'),
  oiseau:         require('../../assets/garden/animals/oiseau/idle_1.png'),
  ecureuil:       require('../../assets/garden/animals/ecureuil/idle_1.png'),
  papillons:      require('../../assets/garden/animals/papillons/idle_1.png'),
  coccinelle:     require('../../assets/garden/animals/coccinelle/idle_1.png'),
  chat:           require('../../assets/garden/animals/chat/idle_1.png'),
  hibou:          require('../../assets/garden/animals/hibou/idle_1.png'),
  fee:            require('../../assets/garden/animals/fee/idle_1.png'),
  dragon:         require('../../assets/garden/animals/dragon/idle_1.png'),
  phoenix:        require('../../assets/garden/animals/phoenix/idle_1.png'),
  licorne:        require('../../assets/garden/animals/licorne/idle_1.png'),
  esprit_eau:     require('../../assets/garden/animals/esprit_eau/idle_1.png'),
  ancien_gardien: require('../../assets/garden/animals/ancien_gardien/idle_1.png'),
};

export const animalEntries: AnimalEntry[] = INHABITANTS.map(inh => ({
  id: `animal_${inh.id}`,
  kind: 'animal' as const,
  sourceId: inh.id,
  nameKey: `codex.animal.${inh.id}.name`,
  loreKey: `codex.animal.${inh.id}.lore`,
  iconRef: inh.emoji,
  spriteRef: ANIMAL_SPRITES[inh.id],
  subgroup: computeSubgroup(inh.rarity, inh.sagaExclusive === true),
  dropOnly: inh.sagaExclusive === true,
}));
