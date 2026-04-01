// ─────────────────────────────────────────────
// Grille monde unifiee — positions pour cultures, batiments, decos
// ─────────────────────────────────────────────

import { type TreeStage, PLOTS_BY_TREE_STAGE } from './types';
import { type TechBonuses } from './tech-engine';

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
 * Grille monde — layout ferme organisee
 *
 * 3 rangees de 5 cultures centrees en haut (potager).
 * Arbre au centre-bas. Batiments a droite au niveau de l'arbre.
 * Decos en bas.
 *
 * Layout :
 *   [c0] [c1] [c2] [c3] [c4]            <- potager rang 1
 *   [c5] [c6] [c7] [c8] [c9]            <- potager rang 2
 *   [c10][c11][c12][c13][c14]            <- potager rang 3
 *                                 [b0]   <- batiment 1
 *         [ARBRE centre]         [b1]   <- batiment 2
 *   [d0]        [d1]             [b2]   <- decos + batiment 3
 */
export const WORLD_GRID: WorldCell[] = [
  // Potager — 3 rangees de 5, centrees (x: 0.14 a 0.70)
  // Deblocage du centre vers l'exterieur pour un look naturel
  // Rangee 1 (y = 0.05)
  { id: 'c0',  col: 0, row: 0, x: 0.14, y: 0.05, cellType: 'crop',     unlockOrder: 5,  size: 'small' },
  { id: 'c1',  col: 1, row: 0, x: 0.28, y: 0.05, cellType: 'crop',     unlockOrder: 3,  size: 'small' },
  { id: 'c2',  col: 2, row: 0, x: 0.42, y: 0.05, cellType: 'crop',     unlockOrder: 1,  size: 'small' },
  { id: 'c3',  col: 3, row: 0, x: 0.56, y: 0.05, cellType: 'crop',     unlockOrder: 4,  size: 'small' },
  { id: 'c4',  col: 4, row: 0, x: 0.70, y: 0.05, cellType: 'crop',     unlockOrder: 6,  size: 'small' },

  // Rangee 2 (y = 0.14)
  { id: 'c5',  col: 0, row: 1, x: 0.14, y: 0.14, cellType: 'crop',     unlockOrder: 10, size: 'small' },
  { id: 'c6',  col: 1, row: 1, x: 0.28, y: 0.14, cellType: 'crop',     unlockOrder: 7,  size: 'small' },
  { id: 'c7',  col: 2, row: 1, x: 0.42, y: 0.14, cellType: 'crop',     unlockOrder: 2,  size: 'small' },
  { id: 'c8',  col: 3, row: 1, x: 0.56, y: 0.14, cellType: 'crop',     unlockOrder: 8,  size: 'small' },
  { id: 'c9',  col: 4, row: 1, x: 0.70, y: 0.14, cellType: 'crop',     unlockOrder: 11, size: 'small' },

  // Rangee 3 (y = 0.23)
  { id: 'c10', col: 0, row: 2, x: 0.14, y: 0.23, cellType: 'crop',     unlockOrder: 14, size: 'small' },
  { id: 'c11', col: 1, row: 2, x: 0.28, y: 0.23, cellType: 'crop',     unlockOrder: 12, size: 'small' },
  { id: 'c12', col: 2, row: 2, x: 0.42, y: 0.23, cellType: 'crop',     unlockOrder: 9,  size: 'small' },
  { id: 'c13', col: 3, row: 2, x: 0.56, y: 0.23, cellType: 'crop',     unlockOrder: 13, size: 'small' },
  { id: 'c14', col: 4, row: 2, x: 0.70, y: 0.23, cellType: 'crop',     unlockOrder: 15, size: 'small' },

  // Decos — bas gauche
  { id: 'd0',  col: 0, row: 4, x: 0.12, y: 0.88, cellType: 'deco',     unlockOrder: 99, size: 'small' },
  { id: 'd1',  col: 2, row: 4, x: 0.42, y: 0.90, cellType: 'deco',     unlockOrder: 99, size: 'small' },

  // Batiments — colonne droite (x = 0.94)
  { id: 'b0',  col: 5, row: 2, x: 0.94, y: 0.42, cellType: 'building', unlockOrder: 16, size: 'large' },
  { id: 'b1',  col: 5, row: 3, x: 0.94, y: 0.62, cellType: 'building', unlockOrder: 17, size: 'large' },
  { id: 'b2',  col: 5, row: 4, x: 0.94, y: 0.78, cellType: 'building', unlockOrder: 18, size: 'large' },
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

// ── Cellules d'extension (tech tree) ──────────────────────────

/** Cellules de la rangee 4 — debloquees par tech expansion-1 */
export const EXPANSION_CROP_CELLS: WorldCell[] = [
  { id: 'c15', col: 0, row: 3, x: 0.14, y: 0.32, cellType: 'crop', unlockOrder: 20, size: 'small' },
  { id: 'c16', col: 1, row: 3, x: 0.28, y: 0.32, cellType: 'crop', unlockOrder: 21, size: 'small' },
  { id: 'c17', col: 2, row: 3, x: 0.42, y: 0.32, cellType: 'crop', unlockOrder: 22, size: 'small' },
  { id: 'c18', col: 3, row: 3, x: 0.56, y: 0.32, cellType: 'crop', unlockOrder: 23, size: 'small' },
  { id: 'c19', col: 4, row: 3, x: 0.70, y: 0.32, cellType: 'crop', unlockOrder: 24, size: 'small' },
];

/** Cellule building supplementaire — debloquee par tech expansion-2 */
export const EXPANSION_BUILDING_CELL: WorldCell =
  { id: 'b3', col: 5, row: 5, x: 0.94, y: 0.90, cellType: 'building', unlockOrder: 25, size: 'large' };

/** Parcelle geante crop — debloquee par tech expansion-3 */
export const EXPANSION_LARGE_CROP_CELL: WorldCell =
  { id: 'c20', col: 0, row: 5, x: 0.14, y: 0.55, cellType: 'crop', unlockOrder: 26, size: 'large' };

/** Verifie si un plotIndex correspond a la parcelle geante (double recolte) */
export function isLargeCropPlot(plotIndex: number, treeStage: TreeStage, techBonuses: TechBonuses): boolean {
  if (!techBonuses.hasLargeCropCell) return false;
  const cells = getExpandedCropCells(treeStage, techBonuses);
  const cell = cells[plotIndex];
  return cell?.id === EXPANSION_LARGE_CROP_CELL.id;
}

/** Retourne les cellules crop debloquees + les extensions tech actives */
export function getExpandedCropCells(treeStage: TreeStage, techBonuses: TechBonuses): WorldCell[] {
  const baseCells = getUnlockedCropCells(treeStage);
  const expanded = [...baseCells];

  if (techBonuses.extraCropCells > 0) {
    expanded.push(...EXPANSION_CROP_CELLS.slice(0, techBonuses.extraCropCells));
  }

  if (techBonuses.hasLargeCropCell) {
    expanded.push(EXPANSION_LARGE_CROP_CELL);
  }

  return expanded;
}

/** Retourne les cellules building + les extensions tech actives */
export function getExpandedBuildingCells(techBonuses: TechBonuses): WorldCell[] {
  const baseCells = [...BUILDING_CELLS];

  if (techBonuses.extraBuildingCells > 0) {
    baseCells.push(EXPANSION_BUILDING_CELL);
  }

  return baseCells;
}

/** Taille de rendu d'une cellule */
export const CELL_SIZES = {
  small: 52,
  large: 64,
} as const;
