// lib/codex/adventures.ts — Mini-aventures narratives quotidiennes (source: ADVENTURES)
//
// Dérive les entrées codex depuis ADVENTURES (lib/mascot/adventures.ts), le
// système de mini-aventures à choix pioché quotidiennement par profil
// (getDailyAdventure) et consommé par DashboardGarden.
// 15 aventures narratives — chaque entry conserve son emoji comme iconRef.

import { ADVENTURES } from '../mascot/adventures';
import type { AdventureEntry } from './types';

export const adventureEntries: AdventureEntry[] = ADVENTURES.map((a) => ({
  id: `adventure_${a.id}`,
  kind: 'adventure' as const,
  sourceId: a.id,
  nameKey: `codex:adventure.${a.id}.name`,
  loreKey: `codex:adventure.${a.id}.lore`,
  iconRef: a.emoji,
}));
