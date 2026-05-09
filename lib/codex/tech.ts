// lib/codex/tech.ts — Arbre de technologies (source: TECH_TREE)
//
// Array dérivé de l'engine tech. Les coûts et prérequis sont lus à la demande
// depuis TECH_TREE via getTechStats (lib/codex/stats.ts) pour rester alignés
// avec l'engine (per D-02).

import { TECH_TREE } from '../mascot/tech-engine';
import type { TechEntry } from './types';

export const techEntries: TechEntry[] = TECH_TREE.map((t) => ({
  id: `tech_${t.id}`,
  kind: 'tech' as const,
  sourceId: t.id,
  nameKey: `codex:tech.${t.id}.name`,
  loreKey: `codex:tech.${t.id}.lore`,
  iconRef: t.emoji,
}));
