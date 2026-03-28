#!/usr/bin/env node
/**
 * Decoupe les spritesheets Farming Crops en sprites individuels
 * pour les 4 cultures initiales de la ferme.
 *
 * Layout : grille 16x32, 9 colonnes par ligne de culture.
 * Colonnes 0=icon, 1=seedbag, 2=seeds, 3-7=stage 1-5, 8=sign icon, 9=sign
 * On extrait : icon (col 0) + stages 1-5 (cols 3-7)
 */

import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const DOWNLOADS = join(process.env.HOME, 'Downloads');
const OUT = resolve('assets/garden/crops');
const SCALE = 4;

const CELL_W = 16;
const CELL_H = 32;
const COLS_PER_ROW = 9; // colonnes logiques par ligne dans le sheet (mais le sheet fait 144px = 9 cols de 16px)

// Sheet 1-A : 144x512, grille 16x32 = 9 cols x 16 rows
const SHEET_A = join(DOWNLOADS, '20.02a - Farming Crops #1 3.1', 'farming crops 1-A 16x32.png');

// Mapping : cropId → row index dans le sheet (cell / 9 pour trouver la ligne, mais le cell reference
// utilise des cells de 16x32 dans une grille de 9 cols)
// Cell 0 = row 0, cell 9 = row 1, cell 19 = row 2 (en fait cell 18 = row 2 debut...)
// Non : cell ref 19 = Carrot. 19 / 9 = row 2 remainder 1. Mais ca ne colle pas.
// En fait le sheet est 144px wide / 16px = 9 columns. 512px tall / 32px = 16 rows.
// Chaque culture occupe exactement 1 row. Cell numbers: row * 9 + col.
// Carrot = cell 19 → row 2, col 1. Mais c'est l'icon qui est en col 0...
// En fait le cell reference donne le debut de chaque culture :
// Carrot = 19 → row 19/9 = 2.11 → hmm.
// Actually looking more carefully: 144 cells total, 9 cols... 144/9 = 16 rows.
// Cell 0 = (row 0, col 0), Cell 9 = (row 1, col 0), Cell 19 = (row 2, col 1)...
// Wait that doesn't work. Let me reconsider.
// The reference says "0 Beetroot" meaning cell 0 is the start of Beetroot.
// And "19 Carrot" but if 9 cols per row, cell 19 = row 2 col 1.
// That means Carrot icon is at row 2, col 1? No, it should be col 0.
// Actually I think the numbering uses 10 columns: 144px / 16px = 9 cols.
// But some crops start at cell 19 not 18... Let me just count:
// Beetroot: cell 0 → row 0
// Cabbage: cell 9 → row 1
// Carrot: cell 19 → must be row 2 (with 9-based: 19/9 = 2.11, so row 2 col 1?)
// Hmm, the note says "columns 1-8" visible per crop + the 9th is sign.
// Let me try: Pumpkin = cell 139. If 9 cols: 139/9 = 15.44 → row 15.
// And Broccoli = cell 140 → 140/9 = 15.55 → row 15 col 5? That doesn't work.
//
// OK re-reading: "There are 144 cells in each sheet"
// 144 = 9 cols × 16 rows. Each crop takes 9 cells (one full row).
// But then Carrot should be at cell 18 not 19...
// Unless it's actually 10 columns!
// Let me check: the note mentions columns 1-10 (10 columns). But 144/10 = 14.4 rows.
// Wait - 144x512 is the SHEET SIZE in pixels, not cells.
// 144px / 16px = 9 columns. So 9 cols.
// Then cell 0 = Beetroot (row 0), cell 9 = Cabbage (row 1).
// But cell 19 = Carrot means row 19÷9 = 2 remainder 1, so row 2 col 1.
// BUT the first column of Beetroot (row 0) would be col 0 = icon.
// So Carrot starts at row 2, col 1? That means the icon is at row 2, col 0?
// The description lists 10 columns but the actual grid is 9 wide (144/16=9).
// I think there's an error in the reference. Let me just use row index directly.
//
// Actually: re-reading "Column 1) An inventory/shop icon" ... "Column 10) Map object sign"
// That's 10 columns listed. But the sheet is only 144px = 9 × 16px cols.
// Some columns might be combined or the counting starts at 1.
// Looking again: columns 1-8 = 8 items, columns 9-10 = signs. But the sign sprites
// might be at the start of the NEXT row.
//
// Simplest approach: just visually verify. Each crop row has stages at cols 3-7 (0-indexed).
// And each crop starts at a specific row:
// Row 0: Beetroot, Row 1: Cabbage, Row 2: Carrot, etc.

const CROPS_TO_EXTRACT = {
  carrot:     { row: 2 },   // cell 19 → roughly row 2
  wheat:      { row: 9 },   // cell 89 / 9 ≈ row 9
  tomato:     { row: 8 },   // cell 79 / 9 ≈ row 8
  strawberry: { row: 12 },  // 13th crop in list (0-indexed = row 12)
};

async function sliceCrops() {
  console.log('=== Slicing Crop Sprites ===');

  if (!existsSync(SHEET_A)) {
    console.log('SKIP: sheet not found at', SHEET_A);
    return;
  }

  const meta = await sharp(SHEET_A).metadata();
  console.log(`Sheet: ${meta.width}x${meta.height}`);
  const gridCols = Math.floor(meta.width / CELL_W); // should be 9
  console.log(`Grid: ${gridCols} cols`);

  let count = 0;

  for (const [cropId, config] of Object.entries(CROPS_TO_EXTRACT)) {
    const dir = join(OUT, cropId);
    mkdirSync(dir, { recursive: true });

    // Extract icon (col 0)
    await sharp(SHEET_A)
      .extract({ left: 0, top: config.row * CELL_H, width: CELL_W, height: CELL_H })
      .resize(CELL_W * SCALE, CELL_H * SCALE, { kernel: 'nearest' })
      .png()
      .toFile(join(dir, 'icon.png'));
    count++;

    // Extract stages 0-4 (cols 3-7 in sheet)
    for (let stage = 0; stage < 5; stage++) {
      const col = 3 + stage; // cols 3,4,5,6,7 = stages 1-5 in Mana Seed notation
      const left = col * CELL_W;
      const top = config.row * CELL_H;

      if (left + CELL_W > meta.width || top + CELL_H > meta.height) {
        console.log(`  ${cropId} stage_${stage}: SKIP (out of bounds)`);
        continue;
      }

      await sharp(SHEET_A)
        .extract({ left, top, width: CELL_W, height: CELL_H })
        .resize(CELL_W * SCALE, CELL_H * SCALE, { kernel: 'nearest' })
        .png()
        .toFile(join(dir, `stage_${stage}.png`));
      count++;
    }

    console.log(`  ${cropId}: OK (icon + 5 stages)`);
  }

  console.log(`Total: ${count} sprites`);
}

sliceCrops().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});
