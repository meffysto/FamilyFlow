/**
 * world-grid.test.ts — Tests unitaires pour lib/mascot/world-grid.ts
 * Couvre : WORLD_GRID shape, CROP_CELLS, BUILDING_CELLS, getUnlockedCropCells, CELL_SIZES
 */

import {
  WORLD_GRID,
  CROP_CELLS,
  BUILDING_CELLS,
  DECO_CELLS,
  getUnlockedCropCells,
  CELL_SIZES,
  type WorldCell,
} from '../mascot/world-grid';

// ─── WORLD_GRID shape ────────────────────────────────────────────────────────

describe('WORLD_GRID', () => {
  it('contient exactement 20 cellules', () => {
    expect(WORLD_GRID).toHaveLength(20);
  });

  it('chaque cellule a un id unique', () => {
    const ids = WORLD_GRID.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(WORLD_GRID.length);
  });

  it('les colonnes sont comprises entre 0 et 5', () => {
    for (const cell of WORLD_GRID) {
      expect(cell.col).toBeGreaterThanOrEqual(0);
      expect(cell.col).toBeLessThanOrEqual(5);
    }
  });

  it('les lignes sont comprises entre 0 et 4', () => {
    for (const cell of WORLD_GRID) {
      expect(cell.row).toBeGreaterThanOrEqual(0);
      expect(cell.row).toBeLessThanOrEqual(4);
    }
  });

  it('les positions x et y sont des fractions entre 0 et 1', () => {
    for (const cell of WORLD_GRID) {
      expect(cell.x).toBeGreaterThan(0);
      expect(cell.x).toBeLessThanOrEqual(1);
      expect(cell.y).toBeGreaterThan(0);
      expect(cell.y).toBeLessThanOrEqual(1);
    }
  });
});

// ─── CROP_CELLS ──────────────────────────────────────────────────────────────

describe('CROP_CELLS', () => {
  it('ne contient que des cellules de type crop', () => {
    for (const cell of CROP_CELLS) {
      expect(cell.cellType).toBe('crop');
    }
  });

  it('contient 15 cellules de culture', () => {
    expect(CROP_CELLS).toHaveLength(15);
  });

  it('est trié par unlockOrder croissant', () => {
    for (let i = 1; i < CROP_CELLS.length; i++) {
      expect(CROP_CELLS[i].unlockOrder).toBeGreaterThanOrEqual(CROP_CELLS[i - 1].unlockOrder);
    }
  });
});

// ─── BUILDING_CELLS ──────────────────────────────────────────────────────────

describe('BUILDING_CELLS', () => {
  it('ne contient que des cellules de type building', () => {
    for (const cell of BUILDING_CELLS) {
      expect(cell.cellType).toBe('building');
    }
  });

  it('contient 3 cellules de bâtiment', () => {
    expect(BUILDING_CELLS).toHaveLength(3);
  });
});

// ─── DECO_CELLS ──────────────────────────────────────────────────────────────

describe('DECO_CELLS', () => {
  it('ne contient que des cellules de type deco', () => {
    for (const cell of DECO_CELLS) {
      expect(cell.cellType).toBe('deco');
    }
  });

  it('contient 2 cellules de décoration', () => {
    expect(DECO_CELLS).toHaveLength(2);
  });
});

// ─── getUnlockedCropCells ────────────────────────────────────────────────────

describe('getUnlockedCropCells', () => {
  it('retourne 0 cellules pour le stade graine', () => {
    const cells = getUnlockedCropCells('graine');
    expect(cells).toHaveLength(0);
  });

  it('retourne 3 cellules pour le stade pousse', () => {
    const cells = getUnlockedCropCells('pousse');
    expect(cells).toHaveLength(3);
  });

  it('retourne 5 cellules pour le stade arbuste', () => {
    const cells = getUnlockedCropCells('arbuste');
    expect(cells).toHaveLength(5);
  });

  it('retourne plus de cellules pour un stade supérieur', () => {
    const arbuste = getUnlockedCropCells('arbuste');
    const arbre = getUnlockedCropCells('arbre');
    expect(arbre.length).toBeGreaterThan(arbuste.length);
  });

  it('retourne les cellules triées par unlockOrder', () => {
    const cells = getUnlockedCropCells('arbre');
    for (let i = 1; i < cells.length; i++) {
      expect(cells[i].unlockOrder).toBeGreaterThanOrEqual(cells[i - 1].unlockOrder);
    }
  });

  it('retourne toutes les cellules de culture pour le stade legendaire', () => {
    const cells = getUnlockedCropCells('legendaire');
    expect(cells.length).toBeGreaterThanOrEqual(12);
  });
});

// ─── CELL_SIZES ──────────────────────────────────────────────────────────────

describe('CELL_SIZES', () => {
  it('a les clés small et large', () => {
    expect(CELL_SIZES).toHaveProperty('small');
    expect(CELL_SIZES).toHaveProperty('large');
  });

  it('small est plus petit que large', () => {
    expect(CELL_SIZES.small).toBeLessThan(CELL_SIZES.large);
  });

  it('small et large sont des nombres positifs', () => {
    expect(CELL_SIZES.small).toBeGreaterThan(0);
    expect(CELL_SIZES.large).toBeGreaterThan(0);
  });
});
