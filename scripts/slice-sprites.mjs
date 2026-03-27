#!/usr/bin/env node
/**
 * Decoupe les spritesheets Mana Seed en sprites individuels
 * pour le jardin pixel art de Family Flow.
 *
 * Usage: node scripts/slice-sprites.mjs
 */

import sharp from 'sharp';
import { mkdirSync, existsSync, copyFileSync } from 'fs';
import { join, resolve } from 'path';

const DOWNLOADS = join(process.env.HOME, 'Downloads');
const OUT = resolve('assets/garden');
const SCALE = 4; // upscale x4 nearest-neighbor

// ── Helpers ──────────────────────────────────────

async function sliceGrid(srcPath, cellW, cellH, cols, rows, outputFn) {
  const img = sharp(srcPath);
  const meta = await img.metadata();
  const results = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const left = col * cellW;
      const top = row * cellH;
      if (left + cellW > meta.width || top + cellH > meta.height) continue;

      const outPath = outputFn(row, col);
      if (!outPath) continue;

      const dir = join(outPath, '..');
      mkdirSync(dir, { recursive: true });

      await sharp(srcPath)
        .extract({ left, top, width: cellW, height: cellH })
        .resize(cellW * SCALE, cellH * SCALE, { kernel: 'nearest' })
        .png()
        .toFile(outPath);

      results.push(outPath);
    }
  }
  return results;
}

async function sliceRegion(srcPath, left, top, w, h, outPath) {
  const dir = join(outPath, '..');
  mkdirSync(dir, { recursive: true });

  await sharp(srcPath)
    .extract({ left, top, width: w, height: h })
    .resize(w * SCALE, h * SCALE, { kernel: 'nearest' })
    .png()
    .toFile(outPath);
}

// ── 1. Fruit Trees ──────────────────────────────

const SPECIES_MAP = {
  peach:     'fruit trees (peach) 48x64.png',
  apple_red: 'fruit trees (apple, red) 48x64.png',
  orange:    'fruit trees (orange) 48x64.png',
  plum:      'fruit trees (plum) 48x64.png',
  pear:      'fruit trees (pear) 48x64.png',
};

// Lignes du spritesheet : saison
const SEASON_ROWS = {
  0: 'summer',   // ligne 0 = ete (fruits)
  1: 'spring',   // ligne 1 = printemps (vert)
  2: 'autumn',   // ligne 2 = automne
  3: 'winter_bare', // ligne 3 = hiver nu
  4: 'winter',   // ligne 4 = hiver neige
  5: 'dead',     // ligne 5 = mort
  6: 'shadow',   // ligne 6 = ombres
};

// On extrait seulement les 4 saisons utiles + ombres
const USEFUL_SEASONS = ['summer', 'spring', 'autumn', 'winter', 'shadow'];

// Colonnes = tailles (1 = petit, 4 = grand)
// Le spritesheet a 7 colonnes de 48px = 336px
// Mais les arbres sont sur les 4 premieres colonnes (cols 0-3)
// avec des colonnes vides ou des variantes apres

async function sliceFruitTrees() {
  console.log('\n=== Fruit Trees ===');
  let count = 0;

  for (const [species, filename] of Object.entries(SPECIES_MAP)) {
    const src = join(DOWNLOADS, '25.09a - Growable Fruit Trees 1.0', filename);
    if (!existsSync(src)) {
      console.log(`  SKIP ${species}: ${filename} introuvable`);
      continue;
    }

    // Le spritesheet fait 336x512. Grille : 48x64.
    // 336/48 = 7 cols, 512/64 = 8 lignes
    // Les arbres sont dans les 4 premieres colonnes (tailles croissantes)
    // mais avec un layout specifique :
    // - Cols 0-3 : tailles 1-4
    // Les colonnes au-dela sont des extras/variantes

    const img = sharp(src);
    const meta = await img.metadata();
    const gridCols = Math.floor(meta.width / 48);
    const gridRows = Math.floor(meta.height / 64);

    // Extraire les 4 tailles x lignes utiles
    for (let row = 0; row < Math.min(gridRows, 7); row++) {
      const seasonName = SEASON_ROWS[row];
      if (!seasonName || !USEFUL_SEASONS.includes(seasonName)) continue;

      for (let col = 0; col < 4; col++) {
        const size = col + 1;
        const outPath = join(OUT, 'trees', species, `${seasonName}_${size}.png`);

        await sliceRegion(src, col * 48, row * 64, 48, 64, outPath);
        count++;
      }
    }
    console.log(`  ${species}: OK`);
  }

  // Sprite graine depuis extras
  const extrasPath = join(DOWNLOADS, '25.09a - Growable Fruit Trees 1.0', 'fruit trees extras 16x16, 16x32.png');
  if (existsSync(extrasPath)) {
    // Le premier sprite 16x32 est une petite pousse
    await sliceRegion(extrasPath, 0, 0, 16, 32, join(OUT, 'trees', 'seed.png'));
    console.log('  seed sprite: OK');
    count++;
  }

  console.log(`  Total arbres: ${count} sprites`);
}

// ── 2. Animated Livestock ───────────────────────

const ANIMALS = {
  poussin: { dir: 'chick', file: 'livestock_chick_v01.png', cellSize: 16 },
  poulet:  { dir: 'chicken', file: 'livestock_chicken_AAA_v01.png', cellSize: 64 },
  canard:  { dir: 'duck', file: 'livestock_duck_v01.png', cellSize: 32 },
  cochon:  { dir: 'pig', file: 'livestock_pig_A_v01.png', cellSize: 64 },
  vache:   { dir: 'cattle', file: 'livestock_cattle-cow_A_v01.png', cellSize: 64 },
};

async function sliceAnimals() {
  console.log('\n=== Animated Livestock ===');
  let count = 0;

  for (const [name, config] of Object.entries(ANIMALS)) {
    const src = join(DOWNLOADS, '20.09a - Animated Livestock 4.0', config.dir, config.file);
    if (!existsSync(src)) {
      console.log(`  SKIP ${name}: introuvable (${src})`);
      continue;
    }

    const meta = await sharp(src).metadata();
    const cs = config.cellSize;
    const gridCols = Math.floor(meta.width / cs);
    const gridRows = Math.floor(meta.height / cs);

    // Layout Mana Seed livestock :
    // Row 0 : walk down (6 frames max)
    // Row 1 : walk up
    // Row 2 : walk left
    // Row 3 : walk right
    // Row 4+ : idle / eat / sleep

    // Extraire toutes les frames non-vides par ligne utile
    const maxFrames = Math.min(gridCols, 8);

    // Idle : prendre row 0 col 0 et col 1 (face, statique)
    const idle1 = join(OUT, 'animals', name, 'idle_1.png');
    await sliceRegion(src, 0, 0, cs, cs, idle1);
    count++;

    if (gridCols >= 2) {
      const idle2 = join(OUT, 'animals', name, 'idle_2.png');
      await sliceRegion(src, cs, 0, cs, cs, idle2);
      count++;
    }

    // Walk down (row 0)
    for (let col = 0; col < maxFrames; col++) {
      const x = col * cs;
      if (x + cs > meta.width) break;
      await sliceRegion(src, x, 0, cs, cs,
        join(OUT, 'animals', name, `walk_down_${col + 1}.png`));
      count++;
    }

    // Walk left (row 2)
    if (gridRows >= 3) {
      for (let col = 0; col < maxFrames; col++) {
        const x = col * cs;
        const y = 2 * cs;
        if (x + cs > meta.width || y + cs > meta.height) break;
        await sliceRegion(src, x, y, cs, cs,
          join(OUT, 'animals', name, `walk_left_${col + 1}.png`));
        count++;
      }
    }

    console.log(`  ${name}: OK`);
  }

  console.log(`  Total animaux: ${count} sprites`);
}

// ── 3. Decorations ──────────────────────────────

async function sliceDecos() {
  console.log('\n=== Decorations ===');
  let count = 0;
  const decoDir = join(OUT, 'decos');
  mkdirSync(decoDir, { recursive: true });

  // Botte de foin (48x48 standalone)
  const hayPath = join(DOWNLOADS, '23.11a - Livestock Accessories', 'hay pile 48x48.png');
  if (existsSync(hayPath)) {
    await sharp(hayPath)
      .resize(48 * SCALE, 48 * SCALE, { kernel: 'nearest' })
      .png()
      .toFile(join(decoDir, 'botte_foin.png'));
    count++;
    console.log('  botte_foin: OK');
  }

  // Livestock accessories 48x32 (caisses, etals)
  const accPath48 = join(DOWNLOADS, '23.11a - Livestock Accessories', 'livestock accessories 48x32.png');
  if (existsSync(accPath48)) {
    // 192x128, grille 48x32 = 4 cols x 4 rows
    // Row 0-1 : caisses de fruits (bois)
    // Row 2-3 : etals avec legumes
    await sliceRegion(accPath48, 0, 0, 48, 32, join(decoDir, 'etal_fruits.png'));
    await sliceRegion(accPath48, 48, 0, 48, 32, join(decoDir, 'etal_fruits_2.png'));
    await sliceRegion(accPath48, 0, 64, 48, 32, join(decoDir, 'etal_legumes.png'));
    count += 3;
    console.log('  etals/caisses: OK');
  }

  // Livestock accessories 16x16 (oeufs, plumes, outils)
  const accPath16 = join(DOWNLOADS, '23.11a - Livestock Accessories', 'livestock accessories 16x16.png');
  if (existsSync(accPath16)) {
    // 160x48 = 10 cols x 3 rows de 16x16
    // Extraire quelques items utiles (premiere ligne)
    for (let col = 0; col < 8; col++) {
      await sliceRegion(accPath16, col * 16, 0, 16, 16, join(decoDir, `acc_item_${col + 1}.png`));
      count++;
    }
    console.log('  accessories 16x16: OK');
  }

  // Fishing Gear objects 32x32 (clotures, etals poisson)
  const fishPath32 = join(DOWNLOADS, '23.09a - Fishing Gear 2.0', 'fishing objects 32x32.png');
  if (existsSync(fishPath32)) {
    const meta = await sharp(fishPath32).metadata();
    const cols = Math.floor(meta.width / 32);
    const rows = Math.floor(meta.height / 32);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        await sliceRegion(fishPath32, col * 32, row * 32, 32, 32,
          join(decoDir, `fish_obj_${row}_${col}.png`));
        count++;
      }
    }
    console.log('  fishing objects 32x32: OK');
  }

  // Fishing Gear objects composite (tonneaux, bancs, guirlandes)
  const fishPathMain = join(DOWNLOADS, '23.09a - Fishing Gear 2.0', 'fishing objects.png');
  if (existsSync(fishPathMain)) {
    // 192x192 — layout mixte, on decoupe en blocs de 32x32
    const meta = await sharp(fishPathMain).metadata();
    const cols = Math.floor(meta.width / 32);
    const rows = Math.floor(meta.height / 32);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        await sliceRegion(fishPathMain, col * 32, row * 32, 32, 32,
          join(decoDir, `fish_main_${row}_${col}.png`));
        count++;
      }
    }
    console.log('  fishing objects main: OK');
  }

  // Farming crops extras 16x16 (arrosoir, houe, panneaux)
  const cropsExtras = join(DOWNLOADS, '20.02a - Farming Crops #1 3.1', 'farming crops extras 16x16.png');
  if (existsSync(cropsExtras)) {
    const meta = await sharp(cropsExtras).metadata();
    const cols = Math.floor(meta.width / 16);
    for (let col = 0; col < cols; col++) {
      await sliceRegion(cropsExtras, col * 16, 0, 16, 16,
        join(decoDir, `crop_extra_${col + 1}.png`));
      count++;
    }
    console.log('  farming crops extras: OK');
  }

  // Chicken coop (standalone, upscale direct)
  const coopPath = join(DOWNLOADS, '23.11a - Livestock Accessories', 'livestock accessories.png');
  if (existsSync(coopPath)) {
    // La grange/etageres est dans ce sheet composite 256x128
    // On prend des blocs de 64x64 pour les batiments
    const meta = await sharp(coopPath).metadata();
    // Bloc grange (environ 96x80 en haut a droite)
    // On extrait des regions cles
    await sliceRegion(coopPath, 0, 0, 128, 64, join(decoDir, 'grange_part.png'));
    await sliceRegion(coopPath, 128, 0, 64, 64, join(decoDir, 'poulailler_part.png'));
    count += 2;
    console.log('  livestock buildings: OK');
  }

  console.log(`  Total decos: ${count} sprites`);
}

// ── 4. Ground / Tiny Garden ─────────────────────

async function sliceGround() {
  console.log('\n=== Ground / Tiny Garden ===');
  let count = 0;
  const groundDir = join(OUT, 'ground');
  mkdirSync(groundDir, { recursive: true });

  // Tiny Garden objects (144x128, cellules 16x16)
  const tinyObj = join(DOWNLOADS, 'Tiny garden_free pack', 'objects.png');
  if (existsSync(tinyObj)) {
    const meta = await sharp(tinyObj).metadata();
    const cols = Math.floor(meta.width / 16);
    const rows = Math.floor(meta.height / 16);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        await sliceRegion(tinyObj, col * 16, row * 16, 16, 16,
          join(groundDir, `flower_${row}_${col}.png`));
        count++;
      }
    }
    console.log('  tiny garden objects: OK');
  }

  // Tiny Garden tileset
  const tinyTile = join(DOWNLOADS, 'Tiny garden_free pack', 'tileset.png');
  if (existsSync(tinyTile)) {
    // Copier tel quel pour usage tileset
    const dest = join(OUT, 'ground', 'tileset_tinygarden.png');
    await sharp(tinyTile)
      .resize((await sharp(tinyTile).metadata()).width * SCALE,
              (await sharp(tinyTile).metadata()).height * SCALE,
              { kernel: 'nearest' })
      .png()
      .toFile(dest);
    count++;
    console.log('  tiny garden tileset: OK');
  }

  // Seasonal forest samples
  for (const season of ['spring', 'summer']) {
    const dir = `mana seed seasonal forest sample (${season})`;
    const file = `seasonal sample (${season}).png`;
    const src = join(DOWNLOADS, dir, file);
    if (existsSync(src)) {
      const dest = join(OUT, 'ground', `tileset_${season}.png`);
      copyFileSync(src, dest);
      count++;
      console.log(`  seasonal ${season}: OK`);
    }
  }

  console.log(`  Total ground: ${count} sprites`);
}

// ── Main ────────────────────────────────────────

async function main() {
  console.log('Decoupe des spritesheets Mana Seed');
  console.log(`Source: ${DOWNLOADS}`);
  console.log(`Destination: ${OUT}`);
  console.log(`Upscale: x${SCALE} nearest-neighbor`);

  await sliceFruitTrees();
  await sliceAnimals();
  await sliceDecos();
  await sliceGround();

  console.log('\n=== Termine ===');
}

main().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});
