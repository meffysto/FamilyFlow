// lib/codex/animals.ts — Habitants ferme + fantastiques + saga (source: INHABITANTS)
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

export const animalEntries: AnimalEntry[] = INHABITANTS.map(inh => ({
  id: `animal_${inh.id}`,
  kind: 'animal' as const,
  sourceId: inh.id,
  nameKey: `codex:animal.${inh.id}.name`,
  loreKey: `codex:animal.${inh.id}.lore`,
  iconRef: inh.emoji,
  subgroup: computeSubgroup(inh.rarity, inh.sagaExclusive === true),
  dropOnly: inh.sagaExclusive === true,
}));
