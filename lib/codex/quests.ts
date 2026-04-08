// lib/codex/quests.ts — Quêtes coopératives / aventures (source: ADVENTURES)
//
// Dérive les entrées codex depuis ADVENTURES (lib/mascot/adventures.ts).
// 15 aventures issues de la ferme — chaque entry conserve son emoji comme iconRef.

import { ADVENTURES } from '../mascot/adventures';
import type { QuestEntry } from './types';

export const questEntries: QuestEntry[] = ADVENTURES.map((a) => ({
  id: `quest_${a.id}`,
  kind: 'quest' as const,
  sourceId: a.id,
  nameKey: `codex:quest.${a.id}.name`,
  loreKey: `codex:quest.${a.id}.lore`,
  iconRef: a.emoji,
}));
