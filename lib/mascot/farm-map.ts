/**
 * farm-map.ts — Carte de terrain de la ferme (grille Wang tileset)
 *
 * Definit les zones de terrain (herbe, chemin, terre labouree, eau, paves)
 * pour le rendu par TileMapRenderer via Wang tilesets.
 *
 * La grille utilise des "vertex" (coins) pour le Wang tiling :
 * - Grille de COLS×ROWS cellules → (COLS+1)×(ROWS+1) vertices
 * - Chaque vertex = type de terrain (0=herbe, 1=upper terrain)
 */

import type { Season } from './seasons';
import type { TreeStage } from './types';

// ── Types de terrain ──

/** Identifiants des tilesets disponibles */
export type TerrainType = 'grass' | 'dirt' | 'farmland' | 'water' | 'cobblestone';

/** Grille de terrain — vertices définissant les zones */
export interface FarmMapData {
  cols: number;
  rows: number;
  /** Matrice (rows+1) × (cols+1) de vertices — true = upper terrain */
  layers: Record<TerrainType, boolean[][]>;
}

// ── Dimensions de la grille ──

export const FARM_MAP_COLS = 12;
export const FARM_MAP_ROWS = 20;

// ── Helpers ──

/** Cree une matrice de vertices vide (tout herbe / lower) */
function emptyVertices(cols: number, rows: number): boolean[][] {
  return Array.from({ length: rows + 1 }, () =>
    Array.from({ length: cols + 1 }, () => false),
  );
}

/** Remplit un rectangle de vertices a true */
function fillRect(
  grid: boolean[][],
  x1: number, y1: number,
  x2: number, y2: number,
): void {
  for (let y = y1; y <= y2 && y < grid.length; y++) {
    for (let x = x1; x <= x2 && x < grid[0].length; x++) {
      grid[y][x] = true;
    }
  }
}

// ── Carte de la ferme ──

/**
 * Genere la carte de terrain selon le stade de l'arbre.
 * Plus l'arbre grandit, plus la ferme est developpee.
 *
 * Mapping coordonnees world-grid → grille tilemap :
 *   col = x * COLS     row = y * ROWS
 *
 * Crops:  x 0.14-0.70 → cols 1-9,   y 0.05-0.29 → rows 1-6
 * Builds: x 0.86      → cols 10-12, y 0.42-0.78 → rows 8-16
 * Arbre:  x ~0.50      → cols 5-7,  y ~0.50-0.70 → rows 10-14
 * Expansion crops: y 0.41 → rows 7-9
 * Large crop: x 0.14, y 0.77 → cols 1-3, rows 14-16
 */
export function buildFarmMap(treeStage: TreeStage): FarmMapData {
  const cols = FARM_MAP_COLS;
  const rows = FARM_MAP_ROWS;

  const dirt = emptyVertices(cols, rows);
  const farmland = emptyVertices(cols, rows);
  const water = emptyVertices(cols, rows);
  const cobblestone = emptyVertices(cols, rows);

  // ══════════════════════════════════════════════
  // ZONE POTAGER — terre labouree en haut
  // Crops c0-c14 : x 0.14-0.70 (cols 1-9), y 0.05-0.29 (rows 0-6)
  // Bloc continu — le chemin commence APRES le potager
  // ══════════════════════════════════════════════
  fillRect(farmland, 1, 0, 9, 7);

  // ══════════════════════════════════════════════
  // CHEMIN — 1 tile de large, commence au bord bas du potager
  // Col 5 (x ~0.42) = centre du potager, part de row 7 vers le bas
  // ══════════════════════════════════════════════

  // Chemin vertical — col 5, de row 8 jusqu'au croisement lac (row 14)
  fillRect(dirt, 5, 8, 5, 14);

  // Chemin horizontal — row 9, relie le chemin central aux batiments
  fillRect(dirt, 6, 9, 10, 9);

  // Chemin vers le lac — du chemin central vers la gauche puis vers le bas
  if (treeStage !== 'graine') {
    fillRect(dirt, 2, 13, 5, 13); // horizontal vers la gauche
    fillRect(dirt, 2, 13, 2, 16); // vertical vers le lac
  }

  // ══════════════════════════════════════════════
  // ZONE BATIMENTS — paves a droite
  // b0-b2 : x 0.86 (col ~10), y 0.42-0.78 (rows 8-16)
  // ══════════════════════════════════════════════
  fillRect(cobblestone, 11, 7, 12, 16);

  // ══════════════════════════════════════════════
  // LAC — petit etang, en bas a gauche (des pousse)
  // ══════════════════════════════════════════════
  if (treeStage !== 'graine') {
    fillRect(water, 0, 16, 3, 19);
  }

  // Expansion potager — rangee 4 a y=0.32, deja couverte par le farmland principal (rows 0-7)

  // ══════════════════════════════════════════════
  // LARGE CROP (x=0.14 y=0.55 → cols 1-3, rows 10-12)
  // ══════════════════════════════════════════════
  if (treeStage === 'majestueux' || treeStage === 'legendaire') {
    fillRect(farmland, 1, 10, 3, 12);
  }

  // ══════════════════════════════════════════════
  // NETTOYAGE — zones exclusives
  // Le chemin et les paves percent le farmland
  // ══════════════════════════════════════════════
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= cols; x++) {
      if (dirt[y][x] || cobblestone[y][x]) {
        farmland[y][x] = false;
      }
    }
  }

  return {
    cols,
    rows,
    layers: {
      grass: emptyVertices(cols, rows),
      dirt,
      farmland,
      water,
      cobblestone,
    },
  };
}

// ── Tileset metadata ──

/** Info de bounding box d'un tile dans la spritesheet */
export interface TileMeta {
  corners: { NE: string; NW: string; SE: string; SW: string };
  bbox: { x: number; y: number; w: number; h: number };
}

/** Parse le JSON metadata d'un tileset PixelLab */
export function parseTilesetMeta(json: any): TileMeta[] {
  return json.tileset_data.tiles.map((t: any) => ({
    corners: t.corners,
    bbox: {
      x: t.bounding_box.x,
      y: t.bounding_box.y,
      w: t.bounding_box.width,
      h: t.bounding_box.height,
    },
  }));
}

/**
 * Trouve le bon tile Wang pour une cellule donnee.
 *
 * Pour une cellule (col, row) dans la grille, on regarde les 4 vertices (coins) :
 * - NW = vertices[row][col]
 * - NE = vertices[row][col+1]
 * - SW = vertices[row+1][col]
 * - SE = vertices[row+1][col+1]
 */
export function findWangTile(
  tiles: TileMeta[],
  nw: boolean, ne: boolean, sw: boolean, se: boolean,
): TileMeta | null {
  const toStr = (v: boolean) => v ? 'upper' : 'lower';
  return tiles.find(t =>
    t.corners.NW === toStr(nw) &&
    t.corners.NE === toStr(ne) &&
    t.corners.SW === toStr(sw) &&
    t.corners.SE === toStr(se),
  ) ?? null;
}
