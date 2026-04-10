// lib/village/grid.ts
// Grille village — positions des elements interactifs sur la place du village.
// Phase 25 — fondation-donnees-village (v1.4).

import type { VillageCell } from './types';

/**
 * Grille village — positions des elements interactifs sur la place.
 * Layout minimal MVP (per D-01): fontaine centre, panneau historique, 2 etals.
 * Phase 25 = positions seulement, pas de carte terrain (per D-03 — terrain en Phase 27).
 *
 * Tous les IDs sont prefixes `village_` pour eviter les collisions avec la ferme perso
 * lors de la transition portail (per D-11).
 */
export const VILLAGE_GRID: VillageCell[] = [
  { id: 'village_fountain', x: 0.50, y: 0.45, role: 'fountain' },
  { id: 'village_stall_0',  x: 0.22, y: 0.65, role: 'stall' },
  { id: 'village_stall_1',  x: 0.78, y: 0.65, role: 'stall' },
  { id: 'village_board',    x: 0.15, y: 0.25, role: 'board' },
];
