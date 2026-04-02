/**
 * TileMapRenderer.tsx — Rendu tilemap Wang pour la ferme
 *
 * Remplace l'image statique de terrain par un vrai tilemap
 * compose de Wang tiles avec transitions douces entre zones.
 *
 * Couches (du bas vers le haut) :
 * 1. Herbe de base (tile full-lower)
 * 2. Terre labouree (farmland) — zone cultures
 * 3. Chemin de terre (dirt) — allees
 * 4. Paves (cobblestone) — zone batiments
 * 5. Eau (water) — mare decorative
 * 6. Decorations (arbres fruitiers, clotures, objets)
 */

import React, { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import type { Season } from '../../lib/mascot/seasons';
import type { TreeStage } from '../../lib/mascot/types';

/** Tile d'herbe pure extraite du tileset — sert de fond pour matcher exactement */
export const GRASS_TILE_IMAGE = require('../../assets/terrain/tilesets/grass_tile.png');
import {
  buildFarmMap,
  findWangTile,
  parseTilesetMeta,
  FARM_MAP_COLS,
  FARM_MAP_ROWS,
  type TerrainType,
  type TileMeta,
} from '../../lib/mascot/farm-map';

// ── Tilesets (printemps pour l'instant, variantes saisonnieres plus tard) ──

const TILESET_IMAGES: Record<TerrainType, any> = {
  grass: null, // herbe = fond uni, pas de spritesheet
  dirt: require('../../assets/terrain/tilesets/grass_to_dirt.png'),
  farmland: require('../../assets/terrain/tilesets/grass_to_farmland.png'),
  water: require('../../assets/terrain/tilesets/grass_to_water.png'),
  cobblestone: require('../../assets/terrain/tilesets/grass_to_cobblestone.png'),
};

const TILESET_META: Record<TerrainType, any> = {
  grass: null,
  dirt: require('../../assets/terrain/tilesets/grass_to_dirt.json'),
  farmland: require('../../assets/terrain/tilesets/grass_to_farmland.json'),
  water: require('../../assets/terrain/tilesets/grass_to_water.json'),
  cobblestone: require('../../assets/terrain/tilesets/grass_to_cobblestone.json'),
};

// ── Decorations de ferme ──

interface FarmDeco {
  source: any;
  x: number;       // fraction largeur (0-1)
  y: number;       // fraction hauteur (0-1)
  w: number;       // largeur px
  h: number;       // hauteur px
  minStage: number; // stade minimum pour afficher (0-5)
  fixed?: boolean;  // true = objet de ferme, pas filtré par les zones terrain
}

const STAGE_INDEX: Record<TreeStage, number> = {
  graine: 0, pousse: 1, arbuste: 2, arbre: 3, majestueux: 4, legendaire: 5,
};

// Arbres fruitiers Mana Seed — grands (stade 4) et petits (stade 1-2, "sapins")
const SEASON_TREE_SPRITES: Record<string, Record<string, any>> = {
  printemps: {
    apple: require('../../assets/garden/trees/apple_red/spring_4.png'),
    peach: require('../../assets/garden/trees/peach/spring_4.png'),
    orange: require('../../assets/garden/trees/orange/spring_4.png'),
    pear: require('../../assets/garden/trees/pear/spring_4.png'),
    plum: require('../../assets/garden/trees/plum/spring_4.png'),
    // Petits arbres (sapins / jeunes pousses)
    small1: require('../../assets/garden/trees/apple_red/spring_1.png'),
    small2: require('../../assets/garden/trees/plum/spring_2.png'),
    small3: require('../../assets/garden/trees/pear/spring_1.png'),
    mid1: require('../../assets/garden/trees/orange/spring_3.png'),
    mid2: require('../../assets/garden/trees/peach/spring_2.png'),
  },
  ete: {
    apple: require('../../assets/garden/trees/apple_red/summer_4.png'),
    peach: require('../../assets/garden/trees/peach/summer_4.png'),
    orange: require('../../assets/garden/trees/orange/summer_4.png'),
    pear: require('../../assets/garden/trees/pear/summer_4.png'),
    plum: require('../../assets/garden/trees/plum/summer_4.png'),
    small1: require('../../assets/garden/trees/apple_red/summer_1.png'),
    small2: require('../../assets/garden/trees/plum/summer_2.png'),
    small3: require('../../assets/garden/trees/pear/summer_1.png'),
    mid1: require('../../assets/garden/trees/orange/summer_3.png'),
    mid2: require('../../assets/garden/trees/peach/summer_2.png'),
  },
  automne: {
    apple: require('../../assets/garden/trees/apple_red/autumn_4.png'),
    peach: require('../../assets/garden/trees/peach/autumn_4.png'),
    orange: require('../../assets/garden/trees/orange/autumn_4.png'),
    pear: require('../../assets/garden/trees/pear/autumn_4.png'),
    plum: require('../../assets/garden/trees/plum/autumn_4.png'),
    small1: require('../../assets/garden/trees/apple_red/autumn_1.png'),
    small2: require('../../assets/garden/trees/plum/autumn_2.png'),
    small3: require('../../assets/garden/trees/pear/autumn_1.png'),
    mid1: require('../../assets/garden/trees/orange/autumn_3.png'),
    mid2: require('../../assets/garden/trees/peach/autumn_2.png'),
  },
  hiver: {
    apple: require('../../assets/garden/trees/apple_red/winter_4.png'),
    peach: require('../../assets/garden/trees/peach/winter_4.png'),
    orange: require('../../assets/garden/trees/orange/winter_4.png'),
    pear: require('../../assets/garden/trees/pear/winter_4.png'),
    plum: require('../../assets/garden/trees/plum/winter_4.png'),
    small1: require('../../assets/garden/trees/apple_red/winter_1.png'),
    small2: require('../../assets/garden/trees/plum/winter_2.png'),
    small3: require('../../assets/garden/trees/pear/winter_1.png'),
    mid1: require('../../assets/garden/trees/orange/winter_3.png'),
    mid2: require('../../assets/garden/trees/peach/winter_2.png'),
  },
};

const SHADOW_SPRITES: Record<string, any> = {
  apple: require('../../assets/garden/trees/apple_red/shadow_4.png'),
  peach: require('../../assets/garden/trees/peach/shadow_4.png'),
  orange: require('../../assets/garden/trees/orange/shadow_4.png'),
  pear: require('../../assets/garden/trees/pear/shadow_4.png'),
  plum: require('../../assets/garden/trees/plum/shadow_4.png'),
};

// Objets de ferme generes via PixelLab
const FARM_OBJECTS = {
  fence_h: require('../../assets/garden/decos/farm/fence_horizontal.png'),
  fence_gate: require('../../assets/garden/decos/farm/fence_gate.png'),
  scarecrow: require('../../assets/garden/decos/farm/scarecrow.png'),
  barrel: require('../../assets/garden/decos/farm/barrel.png'),
  crate: require('../../assets/garden/decos/farm/crate.png'),
  well: require('../../assets/garden/decos/farm/well.png'),
  windmill: require('../../assets/garden/decos/farm/windmill.png'),
  sign_post: require('../../assets/garden/decos/farm/sign_post.png'),
  bench: require('../../assets/garden/decos/farm/bench.png'),
  bridge: require('../../assets/garden/decos/farm/bridge.png'),
  torch: require('../../assets/garden/decos/farm/torch.png'),
};

// Sprites de peche Mana Seed — autour du lac
const FISH_DECOS = {
  fishing_rods: require('../../assets/garden/decos/fish_main_0_0.png'),
  fish_barrel: require('../../assets/garden/decos/fish_main_1_0.png'),
  fish_crate: require('../../assets/garden/decos/fish_main_2_0.png'),
  fish_trophy: require('../../assets/garden/decos/fish_obj_0_0.png'),
  dried_fish: require('../../assets/garden/decos/fish_obj_1_0.png'),
  drying_rack: require('../../assets/garden/decos/fish_obj_2_0.png'),
  rack_with_fish: require('../../assets/garden/decos/fish_obj_3_0.png'),
  fish_trap: require('../../assets/garden/decos/fish_obj_4_0.png'),
};

// Sprites de sol existants (Mana Seed) pour la vegetation
const GROUND = {
  grass1: require('../../assets/garden/ground/grass_tuft_1.png'),
  grass2: require('../../assets/garden/ground/grass_tuft_2.png'),
  grass3: require('../../assets/garden/ground/grass_tuft_3.png'),
  bush1: require('../../assets/garden/ground/bush_1.png'),
  bush2: require('../../assets/garden/ground/bush_2.png'),
  bush3: require('../../assets/garden/ground/bush_3.png'),
  rock1: require('../../assets/garden/ground/rock_1.png'),
  rock2: require('../../assets/garden/ground/rock_2.png'),
  rock3: require('../../assets/garden/ground/rock_3.png'),
  mushroom1: require('../../assets/garden/ground/mushroom_1.png'),
  mushroom2: require('../../assets/garden/ground/mushroom_2.png'),
  smallFlower1: require('../../assets/garden/ground/small_flower_1.png'),
  smallFlower2: require('../../assets/garden/ground/small_flower_2.png'),
  smallFlower3: require('../../assets/garden/ground/small_flower_3.png'),
  smallFlower4: require('../../assets/garden/ground/small_flower_4.png'),
  flower30: require('../../assets/garden/ground/flower_3_0.png'),
  flower62: require('../../assets/garden/ground/flower_6_2.png'),
  flower72: require('../../assets/garden/ground/flower_7_2.png'),
  flower73: require('../../assets/garden/ground/flower_7_3.png'),
  hay: require('../../assets/garden/decos/botte_foin.png'),
};

/**
 * Decorations positionnees sur la ferme — progressives.
 *
 * Zones libres pour decos (pas de collision avec crops/buildings/arbre) :
 * - Bordure gauche : x < 0.10
 * - Bordure droite : x > 0.92 (au-dela des paves)
 * - Zone centre-bas : x 0.10-0.75, y 0.40-0.90 (autour de l'arbre, le long du chemin)
 * - Zone mare : x 0.05-0.35, y 0.70-0.90
 * - Zone bas : y > 0.85
 */
function getFarmDecos(season: Season, stageIdx: number): FarmDeco[] {
  const trees = SEASON_TREE_SPRITES[season] ?? SEASON_TREE_SPRITES.printemps;
  const decos: FarmDeco[] = [];

  // ══════════════════════════════════════════════
  // ARBRES — grands, moyens et petits, repartis sur les bordures
  // Comme dans Stardew Valley : arbres partout autour de la ferme
  // ══════════════════════════════════════════════

  // ── Grands arbres fruitiers — bordure gauche ──
  decos.push({ source: trees.apple, x: 0.05, y: 0.08, w: 52, h: 68, minStage: 0 });
  decos.push({ source: trees.peach, x: 0.04, y: 0.48, w: 50, h: 66, minStage: 0 });
  if (stageIdx >= 1) {
    decos.push({ source: trees.orange, x: 0.06, y: 0.30, w: 48, h: 64, minStage: 1 });
  }
  if (stageIdx >= 2) {
    decos.push({ source: trees.plum, x: 0.03, y: 0.65, w: 50, h: 66, minStage: 2 });
  }

  // ── Grands arbres — bordure droite (au-dela des paves) ──
  decos.push({ source: trees.pear, x: 0.97, y: 0.05, w: 48, h: 64, minStage: 0 });
  if (stageIdx >= 2) {
    decos.push({ source: trees.apple, x: 0.96, y: 0.82, w: 46, h: 62, minStage: 2 });
  }

  // ── Petits arbres "sapins" — eparpilles, donnent de la profondeur ──
  decos.push({ source: trees.small1, x: 0.08, y: 0.88, w: 28, h: 36, minStage: 0 });
  decos.push({ source: trees.small3, x: 0.72, y: 0.94, w: 26, h: 34, minStage: 0 });
  if (stageIdx >= 1) {
    decos.push({ source: trees.small2, x: 0.92, y: 0.92, w: 30, h: 38, minStage: 1 });
    decos.push({ source: trees.small1, x: 0.12, y: 0.42, w: 24, h: 32, minStage: 1 });
  }
  if (stageIdx >= 2) {
    decos.push({ source: trees.small3, x: 0.70, y: 0.45, w: 26, h: 34, minStage: 2 });
    decos.push({ source: trees.small2, x: 0.04, y: 0.82, w: 28, h: 36, minStage: 2 });
  }

  // ── Arbres moyens — entre les zones ──
  if (stageIdx >= 1) {
    decos.push({ source: trees.mid1, x: 0.06, y: 0.18, w: 38, h: 50, minStage: 1 });
  }
  if (stageIdx >= 2) {
    decos.push({ source: trees.mid2, x: 0.95, y: 0.40, w: 36, h: 48, minStage: 2 });
  }
  if (stageIdx >= 3) {
    decos.push({ source: trees.mid1, x: 0.68, y: 0.85, w: 38, h: 50, minStage: 3 });
  }

  // ── Clotures — bordure basse du potager, split par le chemin central ──
  if (stageIdx >= 1) {
    const fenceY = 0.36;
    // Gauche du chemin (x 0.10-0.38)
    for (let i = 0; i < 3; i++) {
      decos.push({
        source: FARM_OBJECTS.fence_h,
        x: 0.10 + i * 0.11,
        y: fenceY,
        w: 32, h: 12,
        minStage: 1,
        fixed: true,
      });
    }
    // Droite du chemin (x 0.54-0.76)
    for (let i = 0; i < 3; i++) {
      decos.push({
        source: FARM_OBJECTS.fence_h,
        x: 0.54 + i * 0.11,
        y: fenceY,
        w: 32, h: 12,
        minStage: 1,
        fixed: true,
      });
    }
    // Portillon a l'entree du chemin
    decos.push({ source: FARM_OBJECTS.fence_gate, x: 0.46, y: fenceY, w: 28, h: 28, minStage: 1, fixed: true });
  }

  // ══════════════════════════════════════════════
  // OBJETS DE FERME — fixed: true (pas filtrés par zones terrain)
  // ══════════════════════════════════════════════

  // ── Epouvantail — dans le potager (centre, entre les rangees) ──
  if (stageIdx >= 1) {
    decos.push({ source: FARM_OBJECTS.scarecrow, x: 0.56, y: 0.15, w: 28, h: 56, minStage: 1, fixed: true });
  }

  // ── Caisse en bois — en haut a droite du potager ──
  if (stageIdx >= 1) {
    decos.push({ source: FARM_OBJECTS.crate, x: 0.72, y: 0.04, w: 22, h: 22, minStage: 1, fixed: true });
  }

  // ── Puits — en bas a droite du potager ──
  if (stageIdx >= 1) {
    decos.push({ source: FARM_OBJECTS.well, x: 0.72, y: 0.28, w: 36, h: 48, minStage: 1, fixed: true });
  }

  // ── Tonneau — pres du puits ──
  if (stageIdx >= 2) {
    decos.push({ source: FARM_OBJECTS.barrel, x: 0.78, y: 0.38, w: 24, h: 24, minStage: 2, fixed: true });
  }

  // ── Moulin — en haut a droite ──
  if (stageIdx >= 4) {
    decos.push({ source: FARM_OBJECTS.windmill, x: 0.90, y: 0.32, w: 52, h: 76, minStage: 4, fixed: true });
  }

  // ── Pont — au-dessus du lac ──
  if (stageIdx >= 2) {
    decos.push({ source: FARM_OBJECTS.bridge, x: 0.22, y: 0.70, w: 48, h: 24, minStage: 2, fixed: true });
  }

  // ── Peche — decorations sur la berge du lac (pas dans l'eau) ──
  // Lac = cols 0-3, rows 16-19 → x < 0.33, y > 0.80
  // Berge = juste au-dessus/droite du lac
  if (stageIdx >= 2) {
    // Cannes a peche posees sur la berge droite du lac
    decos.push({ source: FISH_DECOS.fishing_rods, x: 0.36, y: 0.78, w: 40, h: 40, minStage: 2, fixed: true });
    // Sechoir a poissons vide sur la berge haute
    decos.push({ source: FISH_DECOS.drying_rack, x: 0.15, y: 0.66, w: 38, h: 38, minStage: 2, fixed: true });
  }
  if (stageIdx >= 3) {
    // Tonneau a poissons sur la berge droite
    decos.push({ source: FISH_DECOS.fish_barrel, x: 0.38, y: 0.86, w: 36, h: 36, minStage: 3, fixed: true });
    // Sechoir garni sur la berge haute
    decos.push({ source: FISH_DECOS.rack_with_fish, x: 0.28, y: 0.64, w: 38, h: 38, minStage: 3, fixed: true });
  }
  if (stageIdx >= 4) {
    // Nasse/casier pres de l'eau
    decos.push({ source: FISH_DECOS.fish_trap, x: 0.34, y: 0.92, w: 34, h: 34, minStage: 4, fixed: true });
    // Trophee poisson sur la berge
    decos.push({ source: FISH_DECOS.fish_trophy, x: 0.08, y: 0.62, w: 32, h: 32, minStage: 4, fixed: true });
  }

  // ── Panneau — entree de la ferme (bas centre) ──
  if (stageIdx >= 1) {
    decos.push({ source: FARM_OBJECTS.sign_post, x: 0.46, y: 0.45, w: 24, h: 36, minStage: 1, fixed: true });
  }

  // ── Banc — zone repos, en bas a gauche ──
  if (stageIdx >= 3) {
    decos.push({ source: FARM_OBJECTS.bench, x: 0.18, y: 0.90, w: 36, h: 24, minStage: 3, fixed: true });
  }

  // ── Torches — bordures du chemin ──
  if (stageIdx >= 4) {
    decos.push({ source: FARM_OBJECTS.torch, x: 0.40, y: 0.42, w: 18, h: 28, minStage: 4, fixed: true });
    decos.push({ source: FARM_OBJECTS.torch, x: 0.40, y: 0.58, w: 18, h: 28, minStage: 4, fixed: true });
  }

  // ══════════════════════════════════════════════
  // VEGETATION AU SOL — herbes, fleurs, buissons, rochers
  // Remplit les zones herbeuses pour eviter le vide
  // ══════════════════════════════════════════════

  // ══════════════════════════════════════════════
  // VEGETATION AU SOL — dense, style Stardew Valley
  // Repartie dans toutes les zones herbeuses
  // ══════════════════════════════════════════════

  // ── Touffes d'herbe — PARTOUT dans les zones vertes ──
  const grassPositions = [
    // Bordure gauche
    { x: 0.04, y: 0.38 }, { x: 0.08, y: 0.52 }, { x: 0.03, y: 0.70 },
    { x: 0.10, y: 0.84 }, { x: 0.06, y: 0.94 },
    // Centre-gauche (entre arbres et chemin)
    { x: 0.18, y: 0.44 }, { x: 0.25, y: 0.50 }, { x: 0.30, y: 0.58 },
    { x: 0.20, y: 0.68 }, { x: 0.28, y: 0.78 }, { x: 0.15, y: 0.90 },
    // Centre-droit (entre chemin et batiments)
    { x: 0.55, y: 0.42 }, { x: 0.62, y: 0.50 }, { x: 0.58, y: 0.62 },
    { x: 0.65, y: 0.72 }, { x: 0.55, y: 0.80 }, { x: 0.60, y: 0.92 },
    // Bas
    { x: 0.35, y: 0.88 }, { x: 0.48, y: 0.94 }, { x: 0.75, y: 0.90 },
    { x: 0.85, y: 0.95 }, { x: 0.42, y: 0.82 },
  ];
  const grasses = [GROUND.grass1, GROUND.grass2, GROUND.grass3];
  grassPositions.forEach((pos, i) => {
    decos.push({ source: grasses[i % 3], x: pos.x, y: pos.y, w: 18 + (i % 3) * 2, h: 18 + (i % 3) * 2, minStage: 0 });
  });

  // ── Rochers — eparpilles ──
  decos.push({ source: GROUND.rock1, x: 0.14, y: 0.54, w: 20, h: 20, minStage: 0 });
  decos.push({ source: GROUND.rock2, x: 0.60, y: 0.86, w: 18, h: 18, minStage: 0 });
  decos.push({ source: GROUND.rock3, x: 0.75, y: 0.50, w: 16, h: 16, minStage: 0 });
  if (stageIdx >= 1) {
    decos.push({ source: GROUND.rock1, x: 0.32, y: 0.72, w: 18, h: 18, minStage: 1 });
    decos.push({ source: GROUND.rock2, x: 0.48, y: 0.56, w: 16, h: 16, minStage: 1 });
  }

  // ── Buissons — plus gros, remplissent les coins et bordures ──
  decos.push({ source: GROUND.bush1, x: 0.62, y: 0.96, w: 38, h: 38, minStage: 0 });
  decos.push({ source: GROUND.bush3, x: 0.88, y: 0.92, w: 36, h: 36, minStage: 0 });
  if (stageIdx >= 1) {
    decos.push({ source: GROUND.bush2, x: 0.15, y: 0.58, w: 32, h: 32, minStage: 1 });
    decos.push({ source: GROUND.bush1, x: 0.68, y: 0.48, w: 30, h: 30, minStage: 1 });
    decos.push({ source: GROUND.bush3, x: 0.30, y: 0.92, w: 34, h: 34, minStage: 1 });
  }
  if (stageIdx >= 2) {
    decos.push({ source: GROUND.bush2, x: 0.72, y: 0.65, w: 32, h: 32, minStage: 2 });
    decos.push({ source: GROUND.bush1, x: 0.22, y: 0.42, w: 28, h: 28, minStage: 2 });
  }
  if (stageIdx >= 3) {
    decos.push({ source: GROUND.bush3, x: 0.55, y: 0.72, w: 34, h: 34, minStage: 3 });
  }

  // ── Petites fleurs — densifiees ──
  if (stageIdx >= 1) {
    decos.push({ source: GROUND.smallFlower1, x: 0.20, y: 0.46, w: 20, h: 20, minStage: 1 });
    decos.push({ source: GROUND.smallFlower2, x: 0.58, y: 0.44, w: 18, h: 18, minStage: 1 });
    decos.push({ source: GROUND.smallFlower3, x: 0.35, y: 0.62, w: 18, h: 18, minStage: 1 });
    decos.push({ source: GROUND.smallFlower4, x: 0.68, y: 0.58, w: 16, h: 16, minStage: 1 });
  }
  if (stageIdx >= 2) {
    decos.push({ source: GROUND.smallFlower1, x: 0.10, y: 0.74, w: 20, h: 20, minStage: 2 });
    decos.push({ source: GROUND.smallFlower2, x: 0.50, y: 0.78, w: 18, h: 18, minStage: 2 });
    decos.push({ source: GROUND.smallFlower3, x: 0.28, y: 0.86, w: 20, h: 20, minStage: 2 });
    decos.push({ source: GROUND.smallFlower4, x: 0.65, y: 0.80, w: 18, h: 18, minStage: 2 });
    decos.push({ source: GROUND.smallFlower1, x: 0.42, y: 0.70, w: 16, h: 16, minStage: 2 });
  }

  // ── Champignons — pres des arbres et zones ombrees ──
  if (stageIdx >= 1) {
    decos.push({ source: GROUND.mushroom1, x: 0.10, y: 0.50, w: 18, h: 18, minStage: 1 });
  }
  if (stageIdx >= 2) {
    decos.push({ source: GROUND.mushroom2, x: 0.08, y: 0.70, w: 16, h: 16, minStage: 2 });
    decos.push({ source: GROUND.mushroom1, x: 0.22, y: 0.64, w: 14, h: 14, minStage: 2 });
  }

  // ── Grosses fleurs — stades avances ──
  if (stageIdx >= 3) {
    decos.push({ source: GROUND.flower30, x: 0.24, y: 0.56, w: 28, h: 28, minStage: 3 });
    decos.push({ source: GROUND.flower62, x: 0.62, y: 0.74, w: 26, h: 26, minStage: 3 });
    decos.push({ source: GROUND.flower72, x: 0.18, y: 0.80, w: 24, h: 24, minStage: 3 });
  }
  if (stageIdx >= 4) {
    decos.push({ source: GROUND.flower73, x: 0.55, y: 0.60, w: 28, h: 28, minStage: 4 });
    decos.push({ source: GROUND.flower30, x: 0.32, y: 0.50, w: 24, h: 24, minStage: 4 });
    decos.push({ source: GROUND.flower62, x: 0.70, y: 0.55, w: 26, h: 26, minStage: 4 });
  }

  // ── Botte de foin — pres du potager ──
  if (stageIdx >= 2) {
    decos.push({ source: GROUND.hay, x: 0.78, y: 0.36, w: 32, h: 32, minStage: 2 });
  }

  return decos.filter(d => stageIdx >= d.minStage);
}

// ── Composant principal ──

interface TileMapRendererProps {
  treeStage: TreeStage;
  containerWidth: number;
  containerHeight: number;
  season: Season;
}

export function TileMapRenderer({
  treeStage,
  containerWidth,
  containerHeight,
  season,
}: TileMapRendererProps) {
  const stageIdx = STAGE_INDEX[treeStage] ?? 0;

  // Build farm map data
  const farmMap = useMemo(() => buildFarmMap(treeStage), [treeStage]);

  // Parse tileset metadata (une seule fois)
  const tilesetMetas = useMemo(() => {
    const metas: Partial<Record<TerrainType, TileMeta[]>> = {};
    for (const key of ['dirt', 'farmland', 'water', 'cobblestone'] as TerrainType[]) {
      const json = TILESET_META[key];
      if (json) metas[key] = parseTilesetMeta(json);
    }
    return metas;
  }, []);

  // Taille d'une cellule a l'ecran
  const cellW = containerWidth / FARM_MAP_COLS;
  const cellH = containerHeight / FARM_MAP_ROWS;

  // Build tile grid for each terrain layer
  const terrainTiles = useMemo(() => {
    const result: { key: string; terrainType: TerrainType; col: number; row: number; tile: TileMeta }[] = [];

    // Ordre de rendu : farmland en bas, dirt par-dessus (chemins visibles), puis eau et paves
    for (const terrainType of ['farmland', 'dirt', 'water', 'cobblestone'] as TerrainType[]) {
      const vertices = farmMap.layers[terrainType];
      const tiles = tilesetMetas[terrainType];
      if (!vertices || !tiles) continue;

      for (let row = 0; row < FARM_MAP_ROWS; row++) {
        for (let col = 0; col < FARM_MAP_COLS; col++) {
          const nw = vertices[row][col];
          const ne = vertices[row][col + 1];
          const sw = vertices[row + 1][col];
          const se = vertices[row + 1][col + 1];

          // Skip if all corners are lower (= full grass, nothing to draw)
          if (!nw && !ne && !sw && !se) continue;

          const tile = findWangTile(tiles, nw, ne, sw, se);
          if (tile) {
            result.push({
              key: `${terrainType}_${col}_${row}`,
              terrainType,
              col,
              row,
              tile,
            });
          }
        }
      }
    }
    return result;
  }, [farmMap, tilesetMetas]);

  // Decos — filtrer celles qui tombent sur eau, chemins ou paves
  const decos = useMemo(() => {
    const allDecos = getFarmDecos(season, stageIdx);
    const { water: waterV, dirt: dirtV, cobblestone: cobbleV, farmland: farmV } = farmMap.layers;
    return allDecos.filter(d => {
      // Les objets de ferme (fixed) ne sont jamais filtrés
      if (d.fixed) return true;
      const col = Math.floor(d.x * FARM_MAP_COLS);
      const row = Math.floor(d.y * FARM_MAP_ROWS);
      if (row >= 0 && row <= FARM_MAP_ROWS && col >= 0 && col <= FARM_MAP_COLS) {
        // Exclure vegetation si un coin est dans l'eau, le chemin, les paves ou le potager
        for (const layer of [waterV, dirtV, cobbleV, farmV]) {
          const any = layer[row]?.[col] || layer[row]?.[col + 1] ||
                      layer[row + 1]?.[col] || layer[row + 1]?.[col + 1];
          if (any) return false;
        }
      }
      return true;
    });
  }, [season, stageIdx, farmMap]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Couche terrain tiles */}
      {terrainTiles.map(({ key, terrainType, col, row, tile }) => {
        const tilesetImage = TILESET_IMAGES[terrainType];
        if (!tilesetImage) return null;

        // Position a l'ecran
        const left = col * cellW;
        const top = row * cellH;

        // Source rect dans la spritesheet (128×128, tiles 32×32)
        // On utilise le crop via imageClipPath — non dispo en RN
        // Alternative : afficher la spritesheet entiere et decaler via position dans un conteneur clippe
        return (
          <View
            key={key}
            style={{
              position: 'absolute',
              left,
              top,
              width: cellW,
              height: cellH,
              overflow: 'hidden',
            }}
          >
            <Image
              source={tilesetImage}
              style={{
                position: 'absolute',
                // La spritesheet fait 128×128 (4×4 tiles de 32×32)
                // On scale pour que chaque tile fasse cellW×cellH
                width: cellW * 4,
                height: cellH * 4,
                // Decalage pour montrer le bon tile
                left: -(tile.bbox.x / 32) * cellW,
                top: -(tile.bbox.y / 32) * cellH,
              }}
              resizeMode="stretch"
            />
          </View>
        );
      })}

      {/* Couche decorations (arbres, clotures, objets) */}
      {decos.map((deco, i) => (
        <Image
          key={`deco_${i}`}
          source={deco.source}
          style={{
            position: 'absolute',
            left: deco.x * containerWidth - deco.w / 2,
            top: deco.y * containerHeight - deco.h / 2,
            width: deco.w,
            height: deco.h,
          }}
        />
      ))}
    </View>
  );
}
