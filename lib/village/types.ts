// lib/village/types.ts
// Interfaces du module Village — Jardin Familial (Phase 25, v1.4).
// Module pur TypeScript — zéro import hook/context.

// Phase 29 : ajout role 'avatar' (VILL-01)
/** Role d'un element interactif sur la place du village */
export type VillageRole = 'fountain' | 'stall' | 'board' | 'portal' | 'avatar';

/** Position d'un element interactif dans la grille village (per D-02 — type dedie, pas WorldCell) */
export interface VillageCell {
  id: string;        // DOIT commencer par 'village_' (per D-11)
  x: number;         // fraction largeur conteneur (0-1)
  y: number;         // fraction hauteur conteneur (0-1)
  role: VillageRole;
}

/** Type de contribution au village (per D-04 — 1 point chacun) */
export type ContributionType = 'harvest' | 'task';

/** Une contribution au village — ligne append-only (per D-10) */
export interface VillageContribution {
  timestamp: string;          // ISO 8601 sans Z — ex: 2026-04-10T14:32:00 (convention museum)
  profileId: string;
  type: ContributionType;
  amount: number;             // toujours 1 per D-04
}

/** Record d'une semaine passee dans l'historique */
export interface VillageWeekRecord {
  weekStart: string;          // YYYY-MM-DD
  target: number;
  total: number;
  claimed: boolean;
  contributionsByMember?: Record<string, number>; // profileId → total contributions (HIST-02)
}

/** Donnees completes du village parsees depuis jardin-familial.md */
export interface VillageData {
  version: number;
  createdAt: string;
  currentWeekStart: string;   // ISO date YYYY-MM-DD
  currentThemeIndex: number;  // index dans OBJECTIVE_TEMPLATES
  rewardClaimed: boolean;
  contributions: VillageContribution[];
  pastWeeks: VillageWeekRecord[];
}

/** Template d'objectif hebdomadaire thematise (per D-06) */
export interface ObjectiveTemplate {
  id: string;
  name: string;       // ex: "La Grande Recolte"
  icon: string;       // emoji
  description: string; // courte, motivante
}
