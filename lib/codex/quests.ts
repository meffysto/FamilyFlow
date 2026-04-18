// lib/codex/quests.ts — Quêtes coopératives familiales (source: QUEST_TEMPLATES)
//
// Dérive les entrées codex depuis QUEST_TEMPLATES (constants/questTemplates.ts),
// le vrai système de quêtes coopératives familiales introduit en Phase 14.
// 7 templates : moisson_collective, grand_defrichage, champions_defi,
// artisans_familiaux, graines_dorees, semaine_production, pluie_magique.
//
// Note : ADVENTURES (lib/mascot/adventures.ts) est un système séparé de
// mini-aventures quotidiennes — il n'a pas sa place sous l'onglet "Quêtes".

import { QUEST_TEMPLATES } from '../../constants/questTemplates';
import type { QuestEntry } from './types';

export const questEntries: QuestEntry[] = QUEST_TEMPLATES.map((q) => ({
  id: `quest_${q.id}`,
  kind: 'quest' as const,
  sourceId: q.id,
  nameKey: `codex.quest.${q.id}.name`,
  loreKey: `codex.quest.${q.id}.lore`,
  iconRef: q.emoji,
}));
