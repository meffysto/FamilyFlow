// ─────────────────────────────────────────────
// Grille monde unifiee — positions pour cultures, batiments, decos
// ─────────────────────────────────────────────

import { type TreeStage, PLOTS_BY_TREE_STAGE } from './types';

/** Type de contenu autorise dans une cellule */
export type CellType = 'crop' | 'building' | 'deco' | 'any';

/** Position d'une cellule dans la grille monde */
export interface WorldCell {
  id: string;           // identifiant unique (ex: "c0", "b0", "d0")
  col: number;          // colonne (0-5)
  row: number;          // ligne (0-3)
  x: number;            // fraction largeur conteneur (0-1)
  y: number;            // fraction hauteur conteneur (0-1)
  cellType: CellType;   // type de contenu autorise
  unlockOrder: number;  // ordre de deblocage (0 = premier)
  size: 'small' | 'large'; // taille de la cellule
}

/**
 * Grille 6x4 — le centre (cols 2-3, rows 1-2) est reserve a l'arbre.
 * 20 cellules utilisables autour.
 *
 * Layout :
 *   [d0] [c0] [c1] [c2] [c3] [d1]     <- row 0 (haut)
 *   [c4] [c5] [ARBRE    ] [c6] [c7]    <- row 1
 *   [c8] [c9] [ARBRE    ] [c10][b0]    <- row 2
 *   [d2] [c11][c12][c13] [c14][b1]     <- row 3 (bas)
 */
export const WORLD_GRID: WorldCell[] = [
  // Row 0 — haut
  { id: 'd0',  col: 0, row: 0, x: 0.08, y: 0.08, cellType: 'deco',     unlockOrder: 99, size: 'small' },
  { id: 'c0',  col: 1, row: 0, x: 0.25, y: 0.10, cellType: 'crop',     unlockOrder: 4,  size: 'small' },
  { id: 'c1',  col: 2, row: 0, x: 0.42, y: 0.08, cellType: 'crop',     unlockOrder: 8,  size: 'small' },
  { id: 'c2',  col: 3, row: 0, x: 0.58, y: 0.08, cellType: 'crop',     unlockOrder: 9,  size: 'small' },
  { id: 'c3',  col: 4, row: 0, x: 0.75, y: 0.10, cellType: 'crop',     unlockOrder: 5,  size: 'small' },
  { id: 'd1',  col: 5, row: 0, x: 0.92, y: 0.08, cellType: 'deco',     unlockOrder: 99, size: 'small' },

  // Row 1 — milieu haut (arbre au centre)
  { id: 'c4',  col: 0, row: 1, x: 0.10, y: 0.32, cellType: 'crop',     unlockOrder: 2,  size: 'small' },
  { id: 'c5',  col: 1, row: 1, x: 0.25, y: 0.35, cellType: 'crop',     unlockOrder: 6,  size: 'small' },
  // cols 2-3, row 1 = ARBRE
  { id: 'c6',  col: 4, row: 1, x: 0.75, y: 0.35, cellType: 'crop',     unlockOrder: 7,  size: 'small' },
  { id: 'c7',  col: 5, row: 1, x: 0.90, y: 0.32, cellType: 'crop',     unlockOrder: 3,  size: 'small' },

  // Row 2 — milieu bas (arbre au centre)
  { id: 'c8',  col: 0, row: 2, x: 0.10, y: 0.58, cellType: 'crop',     unlockOrder: 10, size: 'small' },
  { id: 'c9',  col: 1, row: 2, x: 0.25, y: 0.60, cellType: 'crop',     unlockOrder: 11, size: 'small' },
  // cols 2-3, row 2 = ARBRE
  { id: 'c10', col: 4, row: 2, x: 0.75, y: 0.60, cellType: 'crop',     unlockOrder: 12, size: 'small' },
  { id: 'b0',  col: 5, row: 2, x: 0.90, y: 0.58, cellType: 'building', unlockOrder: 13, size: 'large' },

  // Row 3 — bas
  { id: 'd2',  col: 0, row: 3, x: 0.08, y: 0.82, cellType: 'deco',     unlockOrder: 99, size: 'small' },
  { id: 'c11', col: 1, row: 3, x: 0.22, y: 0.82, cellType: 'crop',     unlockOrder: 14, size: 'small' },
  { id: 'c12', col: 2, row: 3, x: 0.38, y: 0.85, cellType: 'crop',     unlockOrder: 15, size: 'small' },
  { id: 'c13', col: 3, row: 3, x: 0.58, y: 0.85, cellType: 'crop',     unlockOrder: 16, size: 'small' },
  { id: 'c14', col: 4, row: 3, x: 0.75, y: 0.82, cellType: 'crop',     unlockOrder: 17, size: 'small' },
  { id: 'b1',  col: 5, row: 3, x: 0.90, y: 0.82, cellType: 'building', unlockOrder: 18, size: 'large' },
  // Slot b2 — moulin (stade majestueux)
  { id: 'b2',  col: 0, row: 2, x: 0.10, y: 0.82, cellType: 'building', unlockOrder: 19, size: 'large' },
];

/** Cellules de culture uniquement, triees par ordre de deblocage */
export const CROP_CELLS = WORLD_GRID
  .filter(c => c.cellType === 'crop')
  .sort((a, b) => a.unlockOrder - b.unlockOrder);

/** Cellules de batiment */
export const BUILDING_CELLS = WORLD_GRID
  .filter(c => c.cellType === 'building')
  .sort((a, b) => a.unlockOrder - b.unlockOrder);

/** Cellules de deco */
export const DECO_CELLS = WORLD_GRID
  .filter(c => c.cellType === 'deco');

/** Nombre de cellules de culture debloquees pour un stade d'arbre */
export function getUnlockedCropCells(treeStage: TreeStage): WorldCell[] {
  const count = PLOTS_BY_TREE_STAGE[treeStage] ?? 0;
  return CROP_CELLS.slice(0, count);
}

/** Taille de rendu d'une cellule */
export const CELL_SIZES = {
  small: 52,
  large: 64,
} as const;
