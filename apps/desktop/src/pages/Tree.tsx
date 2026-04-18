import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { Modal } from '../components/ui/Modal';
import { useVault } from '../contexts/VaultContext';
import { CompanionWidget } from '../components/companion/CompanionWidget';
import { CompanionPicker } from '../components/companion/CompanionPicker';
import {
  getTreeStage,
  getStageIndex,
  getCurrentSeason,
  parseCrops,
  CROP_CATALOG,
  INHABITANTS,
  BUILDING_CATALOG,
  SPECIES_INFO,
  PLOTS_BY_TREE_STAGE,
  buildFarmMap,
  findWangTile,
  parseTilesetMeta,
  FARM_MAP_COLS,
  FARM_MAP_ROWS,
  CROP_CELLS,
  BUILDING_CELLS,
  getPendingResources,
  hasCropSeasonalBonus,
  type TreeStage,
  type TreeSpecies,
  type PlantedCrop,
  type PlacedBuilding,
  type FarmMapData,
  type TileMeta,
  getEffectiveHarvestReward,
  TECH_TREE,
  canUnlockTech,
  getAllBadgeProgress,
  TIER_EMOJI,
  type BuildingDefinition,
  type CropDefinition,
  getMainPlotIndex,
  getActiveWearEffects,
  parseWearEvents,
  REPAIR_COSTS,
  type WearEffects,
  type WearEvent,
  type WearEventType,
  // Sagas
  SAGAS,
  shouldStartSaga,
  getNextSagaForProfile,
  type Saga,
  type SagaProgress,
  createEmptySagaProgress,
  // Companion
  SEASON_INFO,
} from '@family-vault/core';
import type { Profile } from '@family-vault/core';
import {
  plantCropInVault, harvestCropInVault, sellHarvestInVault,
  collectBuildingInVault, buyBuildingInVault, upgradeBuildingInVault,
  checkWearInVault, repairWearInVault,
} from '../lib/farm-vault';
import './Tree.css';

// ---------------------------------------------------------------------------
// Constants & mappings
// ---------------------------------------------------------------------------

/** Maps treeSpecies to the sprite folder name under /assets/garden/trees/ */
const SPECIES_TO_FRUIT: Record<TreeSpecies, string> = {
  cerisier: 'apple_red',
  chene: 'pear',
  bambou: 'plum',
  oranger: 'orange',
  palmier: 'peach',
};

/** Maps TreeStage to sprite size index (1-4). 'graine' uses special path. */
const STAGE_TO_SIZE: Record<TreeStage, number | null> = {
  graine: null,
  pousse: 1,
  arbuste: 2,
  arbre: 3,
  majestueux: 4,
  legendaire: 4,
};

/** Human-readable French stage names */
const STAGE_LABELS: Record<TreeStage, string> = {
  graine: 'Graine',
  pousse: 'Pousse',
  arbuste: 'Arbuste',
  arbre: 'Arbre',
  majestueux: 'Majestueux',
  legendaire: 'Légendaire',
};

/** Maps Season to the illustration filename */
const SEASON_ILLUSTRATION: Record<string, string> = {
  printemps: 'tree-spring',
  ete: 'tree-summer',
  automne: 'tree-autumn',
  hiver: 'tree-winter',
};

// ---------------------------------------------------------------------------
// XP helpers
// ---------------------------------------------------------------------------

function xpForNextLevel(level: number): number {
  return level * 100;
}

function xpProgress(profile: Profile): { current: number; needed: number; pct: number } {
  const level = profile.level ?? 1;
  const points = profile.points ?? 0;
  const xpToCurrentLevel = Array.from({ length: level - 1 }, (_, i) => xpForNextLevel(i + 1))
    .reduce((a, b) => a + b, 0);
  const needed = xpForNextLevel(level);
  const current = Math.max(0, points - xpToCurrentLevel);
  const pct = Math.min(100, Math.round((current / needed) * 100));
  return { current, needed, pct };
}

// ---------------------------------------------------------------------------
// Seasonal particles
// ---------------------------------------------------------------------------

interface ParticleConfig {
  count: number;
  color: string;
  size: number;
  duration: number;
  float: boolean;
}

const SEASON_PARTICLES: Record<string, ParticleConfig> = {
  printemps: { count: 18, color: '#FFB7C5', size: 6, duration: 6, float: false },
  ete:       { count: 10, color: '#FFE082', size: 4, duration: 8, float: true  },
  automne:   { count: 16, color: '#D4A373', size: 7, duration: 5, float: false },
  hiver:     { count: 22, color: '#D0E8FF', size: 5, duration: 7, float: false },
};

interface Particle {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  opacity: number;
}

function buildParticles(season: string): Particle[] {
  const cfg = SEASON_PARTICLES[season] ?? SEASON_PARTICLES.printemps;
  return Array.from({ length: cfg.count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * cfg.duration,
    duration: cfg.duration * 0.75 + Math.random() * cfg.duration * 0.5,
    size: cfg.size * (0.7 + Math.random() * 0.6),
    opacity: 0.5 + Math.random() * 0.5,
  }));
}

const ParticleLayer = memo(function ParticleLayer({ season }: { season: string }) {
  const particles = useMemo(() => buildParticles(season), [season]);
  const cfg = SEASON_PARTICLES[season] ?? SEASON_PARTICLES.printemps;

  return (
    <div className="tree-particles" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className={`tree-particle${cfg.float ? ' tree-particle--float' : ''}`}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: cfg.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            opacity: p.opacity,
          }}
        />
      ))}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Wang TileMap Renderer
// ---------------------------------------------------------------------------

/** Terrain layers rendered bottom to top (excluding grass which is CSS bg) */
const WANG_LAYERS = ['farmland', 'dirt', 'water', 'cobblestone'] as const;
type WangLayer = typeof WANG_LAYERS[number];

interface ComputedTile {
  col: number;
  row: number;
  layer: WangLayer;
  tile: TileMeta;
}

interface TileMapRendererProps {
  farmMap: FarmMapData;
  tilesets: Record<string, TileMeta[]>;
  containerWidth: number;
  containerHeight: number;
}

const TileMapRenderer = memo(function TileMapRenderer({
  farmMap,
  tilesets,
  containerWidth,
  containerHeight,
}: TileMapRendererProps) {
  const cellW = containerWidth / FARM_MAP_COLS;
  const cellH = containerHeight / FARM_MAP_ROWS;

  const tiles = useMemo<ComputedTile[]>(() => {
    if (containerWidth === 0 || containerHeight === 0) return [];
    const result: ComputedTile[] = [];

    for (const layer of WANG_LAYERS) {
      const tiles = tilesets[layer];
      if (!tiles || tiles.length === 0) continue;
      const vertices = farmMap.layers[layer];
      if (!vertices) continue;

      for (let row = 0; row < FARM_MAP_ROWS; row++) {
        for (let col = 0; col < FARM_MAP_COLS; col++) {
          const nw = vertices[row]?.[col] ?? false;
          const ne = vertices[row]?.[col + 1] ?? false;
          const sw = vertices[row + 1]?.[col] ?? false;
          const se = vertices[row + 1]?.[col + 1] ?? false;

          // All-false = pure grass, skip (CSS background handles it)
          if (!nw && !ne && !sw && !se) continue;

          const tile = findWangTile(tiles, nw, ne, sw, se);
          if (!tile) continue;

          result.push({ col, row, layer, tile });
        }
      }
    }

    return result;
  }, [farmMap, tilesets, containerWidth, containerHeight]);

  if (containerWidth === 0 || containerHeight === 0) return null;

  return (
    <>
      {tiles.map(({ col, row, layer, tile }) => {
        // Use CSS background-position to crop the 4×4 spritesheet.
        // tile.bbox.x/y are 0, 32, 64, or 96 in a 128×128 sheet.
        // background-position percentage: (tileCol / 3) * 100, (tileRow / 3) * 100
        const tileCol = tile.bbox.x / 32; // 0-3
        const tileRow = tile.bbox.y / 32; // 0-3
        const bgPosX = tileCol === 0 ? '0%' : `${(tileCol / 3) * 100}%`;
        const bgPosY = tileRow === 0 ? '0%' : `${(tileRow / 3) * 100}%`;

        return (
          <div
            key={`${layer}-${row}-${col}`}
            style={{
              position: 'absolute',
              left: col * cellW,
              top: row * cellH,
              width: Math.ceil(cellW) + 1,
              height: Math.ceil(cellH) + 1,
              backgroundImage: `url(/assets/terrain/tilesets/grass_to_${layer}.png)`,
              backgroundSize: `${Math.ceil(cellW) * 4 + 4}px ${Math.ceil(cellH) * 4 + 4}px`,
              backgroundPosition: bgPosX + ' ' + bgPosY,
              backgroundRepeat: 'no-repeat',
              imageRendering: 'pixelated',
            }}
            aria-hidden="true"
          />
        );
      })}
    </>
  );
});

// ---------------------------------------------------------------------------
// Ground decorations — scatter on pure-grass cells
// ---------------------------------------------------------------------------

interface DecorationDef {
  src: string;
  /** Fractional x position (0–1) relative to container width */
  x: number;
  /** Fractional y position (0–1) relative to container height */
  y: number;
  /** Rendered width in px at reference container size */
  w: number;
  /** Rendered height in px at reference container size */
  h: number;
  /** Minimum stage index (0–5) required to show this decoration */
  minStage: number;
  /** If true, always render (skip terrain-overlap check) */
  fixed: boolean;
}

/** Complete decoration list matching the mobile app layout */
const GROUND_DECORATIONS: DecorationDef[] = [
  // --- Fences (fixed) ---
  { src: '/assets/garden/decos/farm/fence_horizontal.png', x: 0.10, y: 0.36, w: 32, h: 12, minStage: 1, fixed: true },
  { src: '/assets/garden/decos/farm/fence_horizontal.png', x: 0.21, y: 0.36, w: 32, h: 12, minStage: 1, fixed: true },
  { src: '/assets/garden/decos/farm/fence_horizontal.png', x: 0.32, y: 0.36, w: 32, h: 12, minStage: 1, fixed: true },
  { src: '/assets/garden/decos/farm/fence_horizontal.png', x: 0.54, y: 0.36, w: 32, h: 12, minStage: 1, fixed: true },
  { src: '/assets/garden/decos/farm/fence_horizontal.png', x: 0.65, y: 0.36, w: 32, h: 12, minStage: 1, fixed: true },
  { src: '/assets/garden/decos/farm/fence_horizontal.png', x: 0.76, y: 0.36, w: 32, h: 12, minStage: 1, fixed: true },
  { src: '/assets/garden/decos/farm/fence_gate.png',       x: 0.46, y: 0.36, w: 28, h: 28, minStage: 1, fixed: true },

  // --- Farm objects (fixed) ---
  { src: '/assets/garden/decos/farm/scarecrow.png',  x: 0.56, y: 0.32, w: 28, h: 56, minStage: 1, fixed: true },
  { src: '/assets/garden/decos/farm/crate.png',      x: 0.72, y: 0.04, w: 22, h: 22, minStage: 1, fixed: true },
  { src: '/assets/garden/decos/farm/well.png',       x: 0.72, y: 0.32, w: 36, h: 48, minStage: 1, fixed: true },
  { src: '/assets/garden/decos/farm/barrel.png',     x: 0.78, y: 0.38, w: 24, h: 24, minStage: 2, fixed: true },
  { src: '/assets/garden/decos/farm/windmill.png',   x: 0.90, y: 0.32, w: 52, h: 76, minStage: 4, fixed: true },
  { src: '/assets/garden/decos/farm/bridge.png',     x: 0.22, y: 0.70, w: 48, h: 24, minStage: 2, fixed: true },
  { src: '/assets/garden/decos/farm/sign_post.png',  x: 0.46, y: 0.45, w: 24, h: 36, minStage: 1, fixed: true },
  { src: '/assets/garden/decos/farm/bench.png',      x: 0.18, y: 0.90, w: 36, h: 24, minStage: 3, fixed: true },
  { src: '/assets/garden/decos/farm/torch.png',      x: 0.40, y: 0.42, w: 18, h: 28, minStage: 4, fixed: true },
  { src: '/assets/garden/decos/farm/torch.png',      x: 0.40, y: 0.58, w: 18, h: 28, minStage: 4, fixed: true },

  // --- Fishing (fixed, always visible) ---
  { src: '/assets/garden/decos/fish_main_0_0.png', x: 0.35, y: 0.72, w: 44, h: 44, minStage: 0, fixed: true },
  { src: '/assets/garden/decos/fish_main_1_0.png', x: 0.38, y: 0.84, w: 38, h: 38, minStage: 0, fixed: true },
  { src: '/assets/garden/decos/fish_obj_4_0.png',  x: 0.40, y: 0.90, w: 36, h: 36, minStage: 0, fixed: true },
  { src: '/assets/garden/decos/fish_obj_0_0.png',  x: 0.06, y: 0.60, w: 34, h: 34, minStage: 0, fixed: true },

  // --- Hay bale (fixed) ---
  { src: '/assets/garden/decos/botte_foin.png', x: 0.78, y: 0.36, w: 32, h: 32, minStage: 2, fixed: true },

  // --- Rocks (terrain-filtered) ---
  { src: '/assets/garden/ground/rock_1.png', x: 0.14, y: 0.54, w: 20, h: 20, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/rock_1.png', x: 0.32, y: 0.72, w: 18, h: 18, minStage: 1, fixed: false },
  { src: '/assets/garden/ground/rock_2.png', x: 0.60, y: 0.86, w: 18, h: 18, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/rock_2.png', x: 0.48, y: 0.56, w: 16, h: 16, minStage: 1, fixed: false },
  { src: '/assets/garden/ground/rock_3.png', x: 0.75, y: 0.50, w: 16, h: 16, minStage: 0, fixed: false },

  // --- Bushes (terrain-filtered) ---
  { src: '/assets/garden/ground/bush_1.png', x: 0.62, y: 0.96, w: 38, h: 38, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/bush_1.png', x: 0.68, y: 0.48, w: 30, h: 30, minStage: 1, fixed: false },
  { src: '/assets/garden/ground/bush_1.png', x: 0.22, y: 0.42, w: 28, h: 28, minStage: 2, fixed: false },
  { src: '/assets/garden/ground/bush_2.png', x: 0.15, y: 0.58, w: 32, h: 32, minStage: 1, fixed: false },
  { src: '/assets/garden/ground/bush_2.png', x: 0.72, y: 0.65, w: 32, h: 32, minStage: 2, fixed: false },
  { src: '/assets/garden/ground/bush_3.png', x: 0.88, y: 0.92, w: 36, h: 36, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/bush_3.png', x: 0.30, y: 0.92, w: 34, h: 34, minStage: 1, fixed: false },
  { src: '/assets/garden/ground/bush_3.png', x: 0.55, y: 0.72, w: 34, h: 34, minStage: 3, fixed: false },

  // --- Grass tufts (terrain-filtered, minStage 0) ---
  { src: '/assets/garden/ground/grass_tuft_1.png', x: 0.04, y: 0.38, w: 18, h: 18, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_2.png', x: 0.08, y: 0.52, w: 20, h: 20, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_3.png', x: 0.03, y: 0.70, w: 22, h: 22, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_1.png', x: 0.10, y: 0.84, w: 18, h: 18, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_2.png', x: 0.06, y: 0.94, w: 20, h: 20, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_3.png', x: 0.18, y: 0.44, w: 22, h: 22, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_1.png', x: 0.25, y: 0.50, w: 18, h: 18, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_2.png', x: 0.30, y: 0.58, w: 20, h: 20, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_3.png', x: 0.20, y: 0.68, w: 22, h: 22, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_1.png', x: 0.28, y: 0.78, w: 18, h: 18, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_2.png', x: 0.15, y: 0.90, w: 20, h: 20, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_3.png', x: 0.55, y: 0.42, w: 22, h: 22, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_1.png', x: 0.62, y: 0.50, w: 18, h: 18, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_2.png', x: 0.58, y: 0.62, w: 20, h: 20, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_3.png', x: 0.65, y: 0.72, w: 22, h: 22, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_1.png', x: 0.55, y: 0.80, w: 18, h: 18, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_2.png', x: 0.60, y: 0.92, w: 20, h: 20, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_3.png', x: 0.35, y: 0.88, w: 22, h: 22, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_1.png', x: 0.48, y: 0.94, w: 18, h: 18, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_2.png', x: 0.75, y: 0.90, w: 20, h: 20, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_3.png', x: 0.85, y: 0.95, w: 22, h: 22, minStage: 0, fixed: false },
  { src: '/assets/garden/ground/grass_tuft_1.png', x: 0.42, y: 0.82, w: 18, h: 18, minStage: 0, fixed: false },

  // --- Small flowers (terrain-filtered) ---
  { src: '/assets/garden/ground/small_flower_1.png', x: 0.20, y: 0.46, w: 20, h: 20, minStage: 1, fixed: false },
  { src: '/assets/garden/ground/small_flower_1.png', x: 0.10, y: 0.74, w: 20, h: 20, minStage: 2, fixed: false },
  { src: '/assets/garden/ground/small_flower_1.png', x: 0.42, y: 0.70, w: 16, h: 16, minStage: 2, fixed: false },
  { src: '/assets/garden/ground/small_flower_2.png', x: 0.58, y: 0.44, w: 18, h: 18, minStage: 1, fixed: false },
  { src: '/assets/garden/ground/small_flower_2.png', x: 0.50, y: 0.78, w: 18, h: 18, minStage: 2, fixed: false },
  { src: '/assets/garden/ground/small_flower_3.png', x: 0.35, y: 0.62, w: 18, h: 18, minStage: 1, fixed: false },
  { src: '/assets/garden/ground/small_flower_3.png', x: 0.28, y: 0.86, w: 20, h: 20, minStage: 2, fixed: false },
  { src: '/assets/garden/ground/small_flower_4.png', x: 0.68, y: 0.58, w: 16, h: 16, minStage: 1, fixed: false },
  { src: '/assets/garden/ground/small_flower_4.png', x: 0.65, y: 0.80, w: 18, h: 18, minStage: 2, fixed: false },

  // --- Mushrooms (terrain-filtered) ---
  { src: '/assets/garden/ground/mushroom_1.png', x: 0.10, y: 0.50, w: 18, h: 18, minStage: 1, fixed: false },
  { src: '/assets/garden/ground/mushroom_1.png', x: 0.22, y: 0.64, w: 14, h: 14, minStage: 2, fixed: false },
  { src: '/assets/garden/ground/mushroom_2.png', x: 0.08, y: 0.70, w: 16, h: 16, minStage: 2, fixed: false },

  // --- Large flowers (terrain-filtered) ---
  { src: '/assets/garden/ground/flower_3_0.png', x: 0.24, y: 0.56, w: 28, h: 28, minStage: 3, fixed: false },
  { src: '/assets/garden/ground/flower_3_0.png', x: 0.32, y: 0.50, w: 24, h: 24, minStage: 4, fixed: false },
  { src: '/assets/garden/ground/flower_6_2.png', x: 0.62, y: 0.74, w: 26, h: 26, minStage: 3, fixed: false },
  { src: '/assets/garden/ground/flower_6_2.png', x: 0.70, y: 0.55, w: 26, h: 26, minStage: 4, fixed: false },
  { src: '/assets/garden/ground/flower_7_2.png', x: 0.18, y: 0.80, w: 24, h: 24, minStage: 3, fixed: false },
  { src: '/assets/garden/ground/flower_7_3.png', x: 0.55, y: 0.60, w: 28, h: 28, minStage: 4, fixed: false },
];

interface GroundDecorationsProps {
  farmMap: FarmMapData;
  stageIdx: number;
  containerWidth: number;
  containerHeight: number;
}

const GroundDecorations = memo(function GroundDecorations({
  farmMap,
  stageIdx,
  containerWidth,
  containerHeight,
}: GroundDecorationsProps) {
  const visibleDecorations = useMemo(() => {
    return GROUND_DECORATIONS.filter(({ x, y, minStage, fixed }) => {
      // Stage gate — skip decorations not yet unlocked
      if (stageIdx < minStage) return false;

      // Fixed decorations skip terrain overlap check
      if (fixed) return true;

      // Terrain overlap check: compute grid cell and test all 4 Wang corners
      const col = Math.floor(x * FARM_MAP_COLS);
      const row = Math.floor(y * FARM_MAP_ROWS);

      for (const layer of WANG_LAYERS) {
        const vertices = farmMap.layers[layer];
        if (!vertices) continue;
        const nw = vertices[row]?.[col] ?? false;
        const ne = vertices[row]?.[col + 1] ?? false;
        const sw = vertices[row + 1]?.[col] ?? false;
        const se = vertices[row + 1]?.[col + 1] ?? false;
        if (nw || ne || sw || se) return false;
      }
      return true;
    });
  }, [farmMap, stageIdx]);

  if (containerWidth === 0 || containerHeight === 0) return null;

  const scale = containerHeight / 400;

  return (
    <>
      {visibleDecorations.map((dec, idx) => {
        const px = dec.x * containerWidth;
        const py = dec.y * containerHeight;
        const sw = dec.w * scale;
        const sh = dec.h * scale;

        return (
          <img
            key={idx}
            src={dec.src}
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: px - sw / 2,
              top: py - sh / 2,
              width: sw,
              height: sh,
              imageRendering: 'pixelated',
              objectFit: 'contain',
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </>
  );
});

// ---------------------------------------------------------------------------
// Tree sprite
// ---------------------------------------------------------------------------

interface TreeSpriteProps {
  species: TreeSpecies;
  stage: TreeStage;
  season: string;
}

const TreeSprite = memo(function TreeSprite({ species, stage, season }: TreeSpriteProps) {
  const fruitFolder = SPECIES_TO_FRUIT[species] ?? 'apple_red';
  const size = STAGE_TO_SIZE[stage];
  const speciesInfo = SPECIES_INFO[species];

  const spriteSeason = ['spring', 'summer', 'autumn', 'winter'][
    ['printemps', 'ete', 'automne', 'hiver'].indexOf(season)
  ] ?? 'spring';

  if (size === null) {
    return (
      <div
        className="tree-seed-fallback"
        style={{ bottom: '30%', left: '50%', transform: 'translateX(-50%)' }}
        role="img"
        aria-label={`Arbre ${speciesInfo.labelKey} — graine`}
      >
        <span className="tree-seed-emoji" aria-hidden="true">{speciesInfo.emoji}</span>
        <span className="tree-seed-label">Graine</span>
      </div>
    );
  }

  const spriteSrc = `/assets/garden/trees/${fruitFolder}/${spriteSeason}_${size}.png`;
  const shadowSrc = `/assets/garden/trees/${fruitFolder}/shadow_${size}.png`;
  const pxSize = 80 + (size - 1) * 45;

  return (
    <div
      className="tree-sprite-group"
      style={{
        left: `calc(42% - ${pxSize / 2}px)`,
        top: `calc(50% - ${pxSize * 1.2}px)`,
        width: pxSize,
      }}
      role="img"
      aria-label={`Arbre ${species} — ${STAGE_LABELS[stage]}`}
    >
      <img
        src={shadowSrc}
        alt=""
        className="tree-shadow"
        style={{ width: pxSize * 1.1 }}
        aria-hidden="true"
      />
      <img
        src={spriteSrc}
        alt=""
        className="tree-sprite"
        style={{ width: pxSize, height: 'auto' }}
      />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Farm crops
// ---------------------------------------------------------------------------

interface FarmCropsProps {
  crops: PlantedCrop[];
  plotCount: number;
  onCropClick: (plotIndex: number, crop: PlantedCrop | undefined) => void;
  wearEffects: WearEffects;
  mainPlotIdx: number | null;
  wearEvents: WearEvent[];
  onRepairWear?: (eventId: string) => void;
}

const FarmCrops = memo(function FarmCrops({ crops, plotCount, onCropClick, wearEffects, mainPlotIdx, wearEvents, onRepairWear }: FarmCropsProps) {
  const [frameB, setFrameB] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setFrameB((f) => !f), 800);
    return () => clearInterval(id);
  }, []);

  if (plotCount === 0) return null;

  // Use WORLD_GRID fractional coordinates for each crop cell
  const slotPx = 52;
  const unlockedCells = CROP_CELLS.slice(0, plotCount);

  return (
    <>
      {unlockedCells.map((cell, i) => {
        const crop = crops.find((c) => c.plotIndex === i);
        const isBlocked = wearEffects.blockedPlots.includes(i);
        const isWeedy = wearEffects.weedyPlots.includes(i);
        const isMainPlot = i === mainPlotIdx && crop && crop.currentStage < 4;

        return (
          <button
            key={cell.id}
            className={`tree-crop-slot tree-crop-slot--clickable${isMainPlot ? ' main-plot-indicator' : ''}`}
            style={{
              position: 'absolute',
              left: `calc(${cell.x * 100}% - ${slotPx / 2}px)`,
              top: `calc(${cell.y * 100}% - ${slotPx / 2}px)`,
              width: slotPx,
              height: slotPx,
              zIndex: 5,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: isBlocked ? 'not-allowed' : 'pointer',
            }}
            aria-label={crop ? `${crop.cropId} — stade ${crop.currentStage}/4` : isBlocked ? 'Parcelle bloquée' : 'Parcelle vide'}
            onClick={() => !isBlocked && onCropClick(i, crop)}
            type="button"
            disabled={isBlocked && !crop}
          >
            {crop ? (
              <img
                src={`/assets/garden/crops/${crop.cropId}/stage_${Math.min(crop.currentStage, 4)}_${frameB ? 'b' : 'a'}.png`}
                alt=""
                className={`tree-crop-img tree-crop-img--${frameB ? 'b' : 'a'}${crop.isGolden ? ' tree-crop-img--golden' : ''}`}
              />
            ) : (
              <div className="tree-crop-empty" />
            )}
            {isBlocked && (
              <div className="wear-overlay wear-overlay--fence" onClick={(e) => {
                e.stopPropagation();
                const evt = wearEvents.find(ev => ev.type === 'broken_fence' && ev.targetId === String(i) && !ev.repairedAt);
                if (evt) onRepairWear?.(evt.id);
              }}>
                <span style={{ fontSize: 14 }}>🚧</span>
                <button className="wear-repair-btn" type="button">
                  Réparer ({REPAIR_COSTS.broken_fence} 🍃)
                </button>
              </div>
            )}
            {isWeedy && !isBlocked && (
              <div className="wear-overlay wear-overlay--weeds" onClick={(e) => {
                e.stopPropagation();
                const evt = wearEvents.find(ev => ev.type === 'weeds' && ev.targetId === String(i) && !ev.repairedAt);
                if (evt) onRepairWear?.(evt.id);
              }}>
                <span style={{ fontSize: 12 }}>🌿</span>
                <button className="wear-repair-btn" type="button">
                  Desherber
                </button>
              </div>
            )}
          </button>
        );
      })}
    </>
  );
});

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

interface BuildingLayerProps {
  buildings: PlacedBuilding[];
  onBuildingClick: (building: PlacedBuilding, def: BuildingDefinition | undefined) => void;
  wearEffects: WearEffects;
  wearEvents: WearEvent[];
  onRepairWear?: (eventId: string) => void;
}

const BuildingLayer = memo(function BuildingLayer({ buildings, onBuildingClick, wearEffects, wearEvents, onRepairWear }: BuildingLayerProps) {
  if (buildings.length === 0) return null;

  const buildingSize = 64;

  return (
    <>
      {buildings.slice(0, 3).map((b, idx) => {
        // Use WORLD_GRID BUILDING_CELLS coordinates
        const cell = BUILDING_CELLS[idx];
        if (!cell) return null;
        const def = BUILDING_CATALOG.find((d) => d.id === b.buildingId);
        const imgSrc = `/assets/buildings/${b.buildingId}_lv${b.level}.png`;
        const isDamaged = wearEffects.damagedBuildings.includes(b.cellId);
        const hasPests = wearEffects.pestBuildings.includes(b.cellId);

        return (
          <button
            key={`${b.buildingId}-${idx}`}
            className="tree-building tree-building--clickable"
            style={{
              position: 'absolute',
              left: `calc(${cell.x * 100}% - ${buildingSize / 2}px)`,
              top: `calc(${cell.y * 100}% - ${buildingSize / 2}px)`,
              zIndex: 5,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
            aria-label={`${b.buildingId} niveau ${b.level} — voir détails`}
            onClick={() => onBuildingClick(b, def)}
            type="button"
          >
            <img
              src={imgSrc}
              alt=""
              className="tree-building-img"
              style={{ width: buildingSize, height: 'auto' }}
              aria-hidden="true"
            />
            {def && (
              <span className="tree-building-label">
                {def.emoji} niv.{b.level}
              </span>
            )}
            {isDamaged && (
              <div className="wear-overlay wear-overlay--roof" onClick={(e) => {
                e.stopPropagation();
                const evt = wearEvents.find(ev => ev.type === 'damaged_roof' && ev.targetId === b.cellId && !ev.repairedAt);
                if (evt) onRepairWear?.(evt.id);
              }}>
                <span style={{ fontSize: 14 }}>🔨</span>
                <button className="wear-repair-btn" type="button">
                  Réparer ({REPAIR_COSTS.damaged_roof} 🍃)
                </button>
              </div>
            )}
            {hasPests && !isDamaged && (
              <div className="wear-overlay wear-overlay--pests" onClick={(e) => {
                e.stopPropagation();
                const evt = wearEvents.find(ev => ev.type === 'pests' && ev.targetId === b.cellId && !ev.repairedAt);
                if (evt) onRepairWear?.(evt.id);
              }}>
                <span style={{ fontSize: 14 }}>🐛</span>
                <button className="wear-repair-btn" type="button">
                  Chasser
                </button>
              </div>
            )}
          </button>
        );
      })}
    </>
  );
});

// ---------------------------------------------------------------------------
// Animals / Inhabitants
// ---------------------------------------------------------------------------

const ANIMAL_POSITIONS = [
  { left: '8%',  bottom: '28%' },
  { left: '14%', bottom: '14%' },
  { left: '72%', bottom: '14%' },
  { left: '82%', bottom: '28%' },
  { left: '20%', bottom: '36%' },
  { left: '78%', bottom: '38%' },
];

interface AnimalLayerProps {
  inhabitants: string[];
}

const AnimalLayer = memo(function AnimalLayer({ inhabitants }: AnimalLayerProps) {
  const [frameB, setFrameB] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setFrameB((f) => !f), 600);
    return () => clearInterval(id);
  }, []);

  if (inhabitants.length === 0) return null;

  return (
    <>
      {inhabitants.slice(0, ANIMAL_POSITIONS.length).map((id, idx) => {
        const pos = ANIMAL_POSITIONS[idx];
        const def = INHABITANTS.find((h) => h.id === id);
        const img1 = `/assets/garden/animals/${id}/idle_1.png`;
        const img2 = `/assets/garden/animals/${id}/idle_2.png`;

        return (
          <div
            key={`${id}-${idx}`}
            className={`tree-animal${frameB ? ' tree-animal--frame-b' : ''}`}
            style={{ ...pos, position: 'absolute' }}
            role="img"
            aria-label={id}
          >
            <img src={img1} alt="" className="tree-animal-img tree-animal-img--a" style={{ width: 32, height: 'auto' }} aria-hidden="true" />
            <img src={img2} alt="" className="tree-animal-img tree-animal-img--b" style={{ width: 32, height: 'auto' }} aria-hidden="true" />
            {def && (
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', marginTop: 2 }} aria-hidden="true">
                {def.emoji}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
});

// ---------------------------------------------------------------------------
// Diorama — full scene
// ---------------------------------------------------------------------------

interface DiaoramaProps {
  profile: Profile;
  season: string;
  crops: PlantedCrop[];
  plotCount: number;
  onCropClick: (plotIndex: number, crop: PlantedCrop | undefined) => void;
  onBuildingClick: (building: PlacedBuilding, def: BuildingDefinition | undefined) => void;
  wearEffects: WearEffects;
  wearEvents: WearEvent[];
  mainPlotIdx: number | null;
  onRepairWear?: (eventId: string) => void;
}

const Diorama = memo(function Diorama({ profile, season, crops, plotCount, onCropClick, onBuildingClick, wearEffects, wearEvents, mainPlotIdx, onRepairWear }: DiaoramaProps) {
  const species: TreeSpecies = profile.treeSpecies ?? 'cerisier';
  const level = profile.level ?? 1;
  const stage = getTreeStage(level);
  const inhabitants = profile.mascotInhabitants ?? [];
  const buildings = profile.farmBuildings ?? [];

  // Measure container for pixel-perfect tile sizing
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          w: Math.round(entry.contentRect.width),
          h: Math.round(entry.contentRect.height),
        });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Build farm map from tree stage
  const farmMap = useMemo(() => buildFarmMap(stage), [stage]);

  // Load tileset JSON files on mount
  const [tilesets, setTilesets] = useState<Record<string, TileMeta[]>>({});

  useEffect(() => {
    const layers = ['grass_to_farmland', 'grass_to_dirt', 'grass_to_water', 'grass_to_cobblestone'];
    Promise.all(
      layers.map(async (name) => {
        const res = await fetch(`/assets/terrain/tilesets/${name}.json`);
        const json = await res.json();
        return { name: name.replace('grass_to_', ''), tiles: parseTilesetMeta(json) };
      })
    ).then((results) => {
      const map: Record<string, TileMeta[]> = {};
      results.forEach((r) => {
        map[r.name] = r.tiles;
      });
      setTilesets(map);
    });
  }, []);

  const illustrationSrc = `/assets/illustrations/${SEASON_ILLUSTRATION[season] ?? 'tree-spring'}.jpg`;

  return (
    <div
      className="tree-diorama-container"
      ref={containerRef}
      role="region"
      aria-label="Diorama de l'arbre familial"
    >
      {/* Layer 1: Base grass tile (CSS background-repeat) */}
      <div className="tree-terrain-grass" aria-hidden="true" />

      {/* Layers 2–5: Wang transition tiles (farmland, dirt, water, cobblestone) */}
      <div className="tree-tilemap-layer" aria-hidden="true">
        <TileMapRenderer
          farmMap={farmMap}
          tilesets={tilesets}
          containerWidth={containerSize.w}
          containerHeight={containerSize.h}
        />
      </div>

      {/* Layer 6: Ground decorations on grass-only cells */}
      <div className="tree-decorations-layer" aria-hidden="true">
        <GroundDecorations
          farmMap={farmMap}
          stageIdx={getStageIndex(stage as any)}
          containerWidth={containerSize.w}
          containerHeight={containerSize.h}
        />
      </div>

      {/* Layer 7: Tree sprite */}
      <TreeSprite species={species} stage={stage} season={season} />

      {/* Layer 8: Farm crops */}
      <FarmCrops crops={crops} plotCount={plotCount} onCropClick={onCropClick} wearEffects={wearEffects} mainPlotIdx={mainPlotIdx} wearEvents={wearEvents} onRepairWear={onRepairWear} />

      {/* Layer 9: Buildings */}
      <BuildingLayer buildings={buildings} onBuildingClick={onBuildingClick} wearEffects={wearEffects} wearEvents={wearEvents} onRepairWear={onRepairWear} />

      {/* Layer 10: Animals */}
      <AnimalLayer inhabitants={inhabitants} />

      {/* Layer 11: Seasonal particles */}
      <ParticleLayer season={season} />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Right panel: Profile stats card
// ---------------------------------------------------------------------------

interface ProfileTreeCardProps {
  profile: Profile;
  stage: TreeStage;
}

const ProfileTreeCard = memo(function ProfileTreeCard({ profile, stage }: ProfileTreeCardProps) {
  const xp = useMemo(() => xpProgress(profile), [profile]);
  const species: TreeSpecies = profile.treeSpecies ?? 'cerisier';
  const speciesInfo = SPECIES_INFO[species];

  return (
    <GlassCard icon={speciesInfo.emoji} title="Mon arbre" accentColor="var(--primary)" tinted>
      <div className="tree-profile-body">
        <div className="tree-profile-header">
          <span className="tree-species-emoji" aria-hidden="true">{speciesInfo.emoji}</span>
          <div className="tree-species-info">
            <span className="tree-species-name" style={{ textTransform: 'capitalize' }}>
              {species}
            </span>
            <span className="tree-stage-badge">
              {STAGE_LABELS[stage]}
            </span>
          </div>
        </div>

        <div className="tree-level-row">
          <div className="tree-level-badge" aria-label={`Niveau ${profile.level ?? 1}`}>
            <span className="tree-level-number">{profile.level ?? 1}</span>
            <span className="tree-level-label">niv.</span>
          </div>
          <div className="tree-xp-block">
            <div className="tree-xp-header">
              <span className="tree-xp-label">Expérience</span>
              <span className="tree-xp-value">{xp.current} / {xp.needed} XP</span>
            </div>
            <div className="tree-xp-track" aria-label={`XP: ${xp.pct}%`}>
              <div
                className="tree-xp-fill"
                style={{ width: `${xp.pct}%` }}
                role="progressbar"
                aria-valuenow={xp.pct}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        </div>

        <div className="tree-stats-row">
          <div className="tree-stat-tile">
            <span className="tree-stat-icon" aria-hidden="true">⭐</span>
            <span className="tree-stat-val">{(profile.points ?? 0).toLocaleString('fr-FR')}</span>
            <span className="tree-stat-lbl">points</span>
          </div>
          <div className="tree-stat-tile">
            <span className="tree-stat-icon" aria-hidden="true">🪙</span>
            <span className="tree-stat-val">{(profile.coins ?? 0).toLocaleString('fr-FR')}</span>
            <span className="tree-stat-lbl">pièces</span>
          </div>
          <div className="tree-stat-tile">
            <span className="tree-stat-icon" aria-hidden="true">🔥</span>
            <span className="tree-stat-val">{profile.streak ?? 0}</span>
            <span className="tree-stat-lbl">jours</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
});

// ---------------------------------------------------------------------------
// Right panel: Farm status card
// ---------------------------------------------------------------------------

interface FarmStatusCardProps {
  crops: PlantedCrop[];
  plotCount: number;
  buildings: PlacedBuilding[];
}

const FarmStatusCard = memo(function FarmStatusCard({ crops, plotCount, buildings }: FarmStatusCardProps) {
  const hasFarm = plotCount > 0;
  const cultivatedCount = crops.length;

  if (!hasFarm) {
    return (
      <GlassCard icon="🌱" title="Ferme">
        <div className="tree-farm-empty">
          <span className="tree-farm-empty-icon" aria-hidden="true">🌱</span>
          <p className="tree-farm-empty-text">
            La ferme se débloque au stade Pousse (niveau 3)
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard icon="🌱" title="Ferme" count={cultivatedCount > 0 ? cultivatedCount : undefined}>
      <div className="tree-farm-body">
        <p className="tree-farm-summary">
          {cultivatedCount} parcelle{cultivatedCount > 1 ? 's' : ''} cultivée{cultivatedCount > 1 ? 's' : ''} sur {plotCount}
        </p>

        {crops.length > 0 && (
          <div className="tree-crop-list" role="list" aria-label="Cultures actives">
            {crops.map((crop) => {
              const def = CROP_CATALOG.find((c) => c.id === crop.cropId);
              const isMature = crop.currentStage >= 4;
              const pct = isMature ? 100 : Math.round((crop.currentStage / 4) * 100);

              return (
                <div key={`${crop.plotIndex}-${crop.cropId}`} className="tree-crop-row" role="listitem">
                  <img
                    src={`/assets/garden/crops/${crop.cropId}/icon.png`}
                    alt=""
                    className="tree-crop-icon-img"
                    aria-hidden="true"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {def && (
                    <span className="tree-crop-icon-emoji" aria-hidden="true" style={{ display: 'none' }}>
                      {def.emoji}
                    </span>
                  )}
                  <div className="tree-crop-info">
                    <span className="tree-crop-name">
                      {def ? def.emoji + ' ' + crop.cropId : crop.cropId}
                      {crop.isGolden ? ' ✨' : ''}
                    </span>
                    <div className="tree-crop-progress-track">
                      <div
                        className={`tree-crop-progress-fill${isMature ? ' tree-crop-progress-fill--mature' : ''}`}
                        style={{ width: `${pct}%` }}
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  </div>
                  <span className={`tree-crop-pct${isMature ? ' tree-crop-pct--mature' : ''}`}>
                    {isMature ? 'Prêt !' : `${pct}%`}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {buildings.length > 0 && (
          <div className="tree-buildings-list" role="list" aria-label="Bâtiments">
            {buildings.map((b, idx) => {
              const def = BUILDING_CATALOG.find((d) => d.id === b.buildingId);
              return (
                <div key={`${b.buildingId}-${idx}`} className="tree-building-row" role="listitem">
                  <img
                    src={`/assets/buildings/${b.buildingId}_lv${b.level}.png`}
                    alt=""
                    className="tree-building-img-sm"
                    aria-hidden="true"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {def && (
                    <span className="tree-building-emoji" aria-hidden="true">{def.emoji}</span>
                  )}
                  <span className="tree-building-name">
                    {def ? def.emoji + ' ' + b.buildingId : b.buildingId}
                  </span>
                  <span className="tree-building-level">Niv. {b.level}</span>
                </div>
              );
            })}
          </div>
        )}

        {crops.length === 0 && buildings.length === 0 && (
          <p className="tree-farm-empty-text">
            Aucune culture ni bâtiment pour le moment
          </p>
        )}
      </div>
    </GlassCard>
  );
});

// ---------------------------------------------------------------------------
// Right panel: Inhabitants card
// ---------------------------------------------------------------------------

interface InhabitantsCardProps {
  inhabitants: string[];
}

const InhabitantsCard = memo(function InhabitantsCard({ inhabitants }: InhabitantsCardProps) {
  return (
    <GlassCard
      icon="🐾"
      title="Habitants"
      count={inhabitants.length > 0 ? inhabitants.length : undefined}
    >
      <div className="tree-inhabitants-body">
        {inhabitants.length === 0 ? (
          <p className="tree-inhabitants-empty">
            Aucun habitant pour le moment — visite la boutique !
          </p>
        ) : (
          <div className="tree-inhabitants-grid" role="list" aria-label="Habitants de l'arbre">
            {inhabitants.map((id) => {
              const def = INHABITANTS.find((h) => h.id === id);
              return (
                <div
                  key={id}
                  className="tree-inhabitant-avatar"
                  role="listitem"
                  title={def ? id : id}
                >
                  <img
                    src={`/assets/garden/animals/${id}/idle_1.png`}
                    alt={id}
                    className="tree-inhabitant-img"
                    onError={(e) => {
                      const el = e.currentTarget as HTMLImageElement;
                      el.style.display = 'none';
                      const span = el.nextElementSibling as HTMLElement | null;
                      if (span) span.style.display = 'flex';
                    }}
                  />
                  <span
                    className="tree-inhabitant-emoji"
                    style={{ display: 'none' }}
                    aria-hidden="true"
                  >
                    {def?.emoji ?? '🐾'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </GlassCard>
  );
});

// ---------------------------------------------------------------------------
// Right panel: Action buttons
// ---------------------------------------------------------------------------

const ACTIONS = [
  { icon: '🛒', label: 'Boutique' },
  { icon: '🔨', label: 'Atelier' },
  { icon: '🔬', label: 'Techs' },
  { icon: '🏅', label: 'Badges' },
] as const;

interface ActionRowProps {
  onAction: (label: string) => void;
}

const ActionRow = memo(function ActionRow({ onAction }: ActionRowProps) {
  return (
    <div className="tree-actions-row" role="group" aria-label="Actions">
      {ACTIONS.map(({ icon, label }) => (
        <button
          key={label}
          type="button"
          className="tree-action-btn"
          onClick={() => onAction(label)}
          aria-label={label}
        >
          <span className="tree-action-icon" aria-hidden="true">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Crop info modal
// ---------------------------------------------------------------------------

interface CropInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  plotIndex: number;
  crop: PlantedCrop | undefined;
  onHarvest?: (plotIndex: number) => void;
  onOpenSeedPicker?: (plotIndex: number) => void;
  busy?: boolean;
}

function CropInfoModal({ isOpen, onClose, plotIndex, crop, onHarvest, onOpenSeedPicker, busy }: CropInfoModalProps) {
  const def = crop ? CROP_CATALOG.find((c) => c.id === crop.cropId) : undefined;
  const isMature = (crop?.currentStage ?? 0) >= 4;
  const seasonalBonus = crop ? hasCropSeasonalBonus(crop.cropId) : false;
  const tasksInStage = crop?.tasksCompleted ?? 0;
  const tasksNeeded = def?.tasksPerStage ?? 1;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={!crop ? 'Parcelle vide' : `${def?.emoji ?? '🌱'} ${crop.cropId}`} width="sm">
      <div className="tree-modal-crop">
        <div className="tree-modal-crop-emoji" aria-hidden="true">
          {!crop ? '🟫' : isMature ? (def?.emoji ?? '🌾') : (def?.emoji ?? '🌱')}
        </div>

        {!crop ? (
          <>
            <p className="tree-modal-crop-body">Cette parcelle est vide</p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 12, width: '100%' }}
              onClick={() => { onOpenSeedPicker?.(plotIndex); onClose(); }}
              disabled={busy}
            >
              🌱 Planter une graine
            </button>
          </>
        ) : isMature ? (
          <>
            <p className="tree-modal-crop-body">{def?.emoji ?? '🌾'} {crop.cropId} est prêt à récolter !</p>
            {crop.isGolden && <p className="tree-modal-crop-golden">✨ Culture dorée — récompense x5 !</p>}
            <button
              className="btn btn-primary"
              style={{ marginTop: 12, width: '100%' }}
              onClick={() => { onHarvest?.(plotIndex); onClose(); }}
              disabled={busy}
            >
              🌾 Récolter (+{getEffectiveHarvestReward(crop.cropId)} 🍂)
            </button>
          </>
        ) : (
          <>
            <p className="tree-modal-crop-body">
              Stade {crop.currentStage}/4 — {tasksInStage}/{tasksNeeded} tâches
            </p>
            <div className="tree-modal-crop-progress">
              <div className="tree-modal-progress-track">
                <div
                  className="tree-modal-progress-fill"
                  style={{ width: `${Math.round((crop.currentStage / 4) * 100)}%` }}
                />
              </div>
              <span className="tree-modal-progress-label">
                {Math.round((crop.currentStage / 4) * 100)}% de croissance
              </span>
            </div>
            {crop.isGolden && <p className="tree-modal-crop-golden">✨ Culture dorée — récompense x5 !</p>}
            {seasonalBonus && <p className="tree-modal-crop-seasonal">🌿 Bonus saisonnier actif</p>}
            <p className="tree-modal-crop-hint" style={{ marginTop: 8, fontSize: 12, color: 'var(--text-faint)' }}>
              Complète des tâches pour faire pousser ta culture !
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Building info modal
// ---------------------------------------------------------------------------

interface BuildingInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  building: PlacedBuilding | null;
  def: BuildingDefinition | undefined;
}

function BuildingInfoModal({ isOpen, onClose, building, def }: BuildingInfoModalProps) {
  if (!building) return null;

  const tier = def?.tiers[building.level - 1];
  const pending = getPendingResources(building);
  const maxLevel = def?.tiers.length ?? 1;
  const isMaxLevel = building.level >= maxLevel;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${def?.emoji ?? '🏚️'} ${building.buildingId}`} width="sm">
      <div className="tree-modal-building">
        <div className="tree-modal-building-header">
          <span className="tree-modal-building-emoji" aria-hidden="true">{def?.emoji ?? '🏚️'}</span>
          <div className="tree-modal-building-info">
            <span className="tree-modal-building-name">{building.buildingId}</span>
            <span className="tree-modal-building-level">Niveau {building.level} / {maxLevel}</span>
          </div>
        </div>

        <div className="tree-modal-building-stats">
          {def && (
            <div className="tree-modal-stat-row">
              <span className="tree-modal-stat-label">Ressource produite</span>
              <span className="tree-modal-stat-value">{def.resourceType}</span>
            </div>
          )}
          {tier && (
            <div className="tree-modal-stat-row">
              <span className="tree-modal-stat-label">Cadence de production</span>
              <span className="tree-modal-stat-value">1 toutes les {tier.productionRateHours}h</span>
            </div>
          )}
          <div className="tree-modal-stat-row">
            <span className="tree-modal-stat-label">Ressources en attente</span>
            <span className={`tree-modal-stat-value${pending > 0 ? ' tree-modal-stat-value--ready' : ''}`}>
              {pending > 0 ? `${pending} à collecter !` : 'Aucune pour l\'instant'}
            </span>
          </div>
          {!isMaxLevel && tier && (
            <div className="tree-modal-stat-row">
              <span className="tree-modal-stat-label">Coût d'amélioration</span>
              <span className="tree-modal-stat-value">
                {def?.tiers[building.level]?.upgradeCoins.toLocaleString('fr-FR') ?? '—'} 🪙
              </span>
            </div>
          )}
          {isMaxLevel && (
            <div className="tree-modal-stat-row">
              <span className="tree-modal-stat-label">Amélioration</span>
              <span className="tree-modal-stat-value">Niveau maximum atteint ✓</span>
            </div>
          )}
        </div>

        <p className="tree-modal-mobile-tip">
          Collecte et amélioration depuis l'app mobile FamilyFlow
        </p>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Seed catalog modal
// ---------------------------------------------------------------------------

interface SeedCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  treeStage: TreeStage;
  coins: number;
  plotIndex: number;
  unlockedTechs: string[];
  onPlant?: (cropId: string, cost: number) => void;
  busy?: boolean;
}

const STAGE_ORDER: TreeStage[] = ['graine', 'pousse', 'arbuste', 'arbre', 'majestueux', 'legendaire'];

function stageIndex(s: TreeStage): number {
  return STAGE_ORDER.indexOf(s);
}

function SeedCatalogModal({ isOpen, onClose, treeStage, coins, plotIndex, unlockedTechs, onPlant, busy }: SeedCatalogModalProps) {
  const sorted = useMemo(() => {
    const isUnlocked = (c: typeof CROP_CATALOG[0]) => {
      if (c.dropOnly) return false;
      if (stageIndex(c.minTreeStage as TreeStage) > stageIndex(treeStage)) return false;
      if (c.techRequired && !unlockedTechs.includes(c.techRequired)) return false;
      return true;
    };
    const unlocked = CROP_CATALOG.filter(c => isUnlocked(c));
    const locked = CROP_CATALOG.filter(c => !isUnlocked(c));
    return [
      ...unlocked.sort((a, b) => stageIndex(a.minTreeStage as TreeStage) - stageIndex(b.minTreeStage as TreeStage)),
      ...locked.sort((a, b) => stageIndex(a.minTreeStage as TreeStage) - stageIndex(b.minTreeStage as TreeStage)),
    ];
  }, [treeStage, unlockedTechs]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🛒 Boutique — Graines" width="md">
      <div className="tree-modal-catalog">
        <p className="tree-modal-catalog-note" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Planter dans la parcelle #{plotIndex + 1}</span>
          <span style={{ fontWeight: 700 }}>💰 {coins} pièces</span>
        </p>
        <div className="tree-modal-catalog-list">
          {sorted.map((crop) => {
            const stageLocked = stageIndex(crop.minTreeStage as TreeStage) > stageIndex(treeStage);
            const techLocked = crop.techRequired ? !unlockedTechs.includes(crop.techRequired) : false;
            const isLocked = stageLocked || techLocked || !!crop.dropOnly;
            const canAfford = coins >= (crop.cost ?? 0);
            const hasBonus = hasCropSeasonalBonus(crop.id);

            return (
              <div
                key={crop.id}
                className={`tree-modal-catalog-item${isLocked ? ' tree-modal-catalog-item--locked' : ''}`}
              >
                <span className="tree-modal-catalog-emoji" aria-hidden="true">{crop.emoji}</span>
                <div className="tree-modal-catalog-details">
                  <div className="tree-modal-catalog-top">
                    <span className="tree-modal-catalog-name">{crop.id}</span>
                    {hasBonus && !isLocked && (
                      <span className="tree-modal-catalog-badge tree-modal-catalog-badge--seasonal">🌿 Bonus</span>
                    )}
                    {crop.dropOnly && (
                      <span className="tree-modal-catalog-badge tree-modal-catalog-badge--rare">💎 Rare</span>
                    )}
                    {isLocked && !crop.dropOnly && (
                      <span className="tree-modal-catalog-badge tree-modal-catalog-badge--locked">
                        🔒 {techLocked ? `Tech ${crop.techRequired}` : crop.minTreeStage}
                      </span>
                    )}
                  </div>
                  <div className="tree-modal-catalog-meta">
                    <span>{(crop.tasksPerStage ?? 1) * 4} tâches</span>
                    <span>·</span>
                    <span>{crop.harvestReward} 🍂</span>
                    {!crop.dropOnly && <span>· {crop.cost} 🍃</span>}
                  </div>
                </div>
                {!isLocked && (
                  <button
                    className="btn btn-primary"
                    style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 13 }}
                    disabled={!canAfford || busy}
                    onClick={() => { onPlant?.(crop.id, crop.cost ?? 0); onClose(); }}
                  >
                    {canAfford ? 'Planter' : 'Pas assez'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Building shop modal
// ---------------------------------------------------------------------------

interface BuildingCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  treeStage: TreeStage;
  unlockedTechs: string[];
}

function BuildingCatalogModal({ isOpen, onClose, treeStage, unlockedTechs }: BuildingCatalogModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔨 Atelier — Bâtiments" width="md">
      <div className="tree-modal-catalog">
        <p className="tree-modal-catalog-note">
          Bâtiments disponibles pour ta ferme
        </p>
        <div className="tree-modal-catalog-list">
          {BUILDING_CATALOG.map((b) => {
            const stageLocked = stageIndex(b.minTreeStage as TreeStage) > stageIndex(treeStage);
            const techLocked = b.techRequired ? !unlockedTechs.includes(b.techRequired) : false;
            const isLocked = stageLocked || techLocked;
            const lockReason = stageLocked
              ? `Stade ${b.minTreeStage} requis`
              : techLocked
                ? `Tech ${b.techRequired} requise`
                : '';

            return (
              <div
                key={b.id}
                className={`tree-modal-catalog-item${isLocked ? ' tree-modal-catalog-item--locked' : ''}`}
              >
                <span className="tree-modal-catalog-emoji" aria-hidden="true">{b.emoji}</span>
                <div className="tree-modal-catalog-details">
                  <div className="tree-modal-catalog-top">
                    <span className="tree-modal-catalog-name">{b.id}</span>
                    {isLocked ? (
                      <span className="tree-modal-catalog-badge tree-modal-catalog-badge--locked">
                        🔒 {lockReason}
                      </span>
                    ) : (
                      <span className="tree-modal-catalog-badge tree-modal-catalog-badge--available">
                        Disponible
                      </span>
                    )}
                  </div>
                  <div className="tree-modal-catalog-meta">
                    <span>Produit : {b.resourceType}</span>
                    <span>·</span>
                    <span>Coût : {b.cost.toLocaleString('fr-FR')} 🪙</span>
                    <span>·</span>
                    <span>{b.tiers.length} niveaux</span>
                  </div>
                  <div className="tree-modal-building-tiers">
                    {b.tiers.map((tier) => (
                      <span key={tier.level} className="tree-modal-tier-chip">
                        Niv.{tier.level} — {tier.productionRateHours}h/ressource
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tech Tree modal
// ---------------------------------------------------------------------------

// TECH_TREE, canUnlockTech imported directly from @family-vault/core

const TECH_LABELS: Record<string, { name: string; desc: string }> = {
  'culture-1': { name: 'Engrais naturel', desc: 'Les cultures poussent plus vite (-1 tâche par stade)' },
  'culture-2': { name: 'Récolte abondante', desc: '25% de chance de récolte double' },
  'culture-3': { name: 'Tournesol', desc: 'Débloque la culture du tournesol' },
  'culture-4': { name: 'Maître jardinier', desc: '50% de chance de récolte double' },
  'elevage-1': { name: 'Alimentation optimale', desc: 'Les bâtiments produisent 25% plus vite' },
  'elevage-2': { name: 'Grange agrandie', desc: 'Capacité de stockage doublée' },
  'elevage-3': { name: 'Ruche à miel', desc: 'Débloque la production de miel' },
  'expansion-1': { name: 'Atelier bâtisseur', desc: '1 nouvelle parcelle pour bâtiment' },
  'expansion-2': { name: 'Nouveau potager', desc: '5 nouvelles parcelles de culture' },
  'expansion-3': { name: 'Méga parcelle', desc: 'Parcelle géante (double récolte)' },
};

const BRANCH_INFO: Record<string, { label: string; emoji: string }> = {
  culture: { label: 'Culture', emoji: '🌱' },
  elevage: { label: 'Élevage', emoji: '🐄' },
  expansion: { label: 'Expansion', emoji: '🏗️' },
};

const TIER_COLORS: Record<string, { bg: string; border: string }> = {
  unlocked: { bg: 'var(--success-bg)', border: 'var(--success)' },
  unlockable: { bg: 'var(--tint)', border: 'var(--primary)' },
  locked: { bg: 'var(--card-alt)', border: 'var(--border)' },
};

interface TechTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  unlockedTechs: string[];
  coins: number;
  onUnlock?: (techId: string, cost: number) => void;
  busy?: boolean;
}

function TechTreeModal({ isOpen, onClose, unlockedTechs, coins, onUnlock, busy }: TechTreeModalProps) {
  const branches = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const node of TECH_TREE) {
      if (!map[node.branch]) map[node.branch] = [];
      map[node.branch].push(node);
    }
    for (const b of Object.values(map)) b.sort((a, b) => a.order - b.order);
    return map;
  }, []);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔬 Arbre technologique" width="lg">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Débloquer des technologies pour améliorer ta ferme</span>
        <span style={{ fontWeight: 700 }}>💰 {coins} pièces</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {Object.entries(branches).map(([branchId, nodes]) => {
          const info = BRANCH_INFO[branchId] ?? { label: branchId, emoji: '🔬' };
          return (
            <div key={branchId} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15, textAlign: 'center' }}>
                {info.emoji} {info.label}
              </div>
              {nodes.map((node) => {
                const isUnlocked = unlockedTechs.includes(node.id);
                const { canUnlock } = canUnlockTech(node.id, unlockedTechs, coins);
                const status = isUnlocked ? 'unlocked' : canUnlock ? 'unlockable' : 'locked';
                const colors = TIER_COLORS[status];

                return (
                  <div
                    key={node.id}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: `2px solid ${colors.border}`,
                      background: colors.bg,
                      opacity: status === 'locked' ? 0.5 : 1,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 24 }}>{node.emoji}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                      {TECH_LABELS[node.id]?.name ?? node.id}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2, lineHeight: 1.3 }}>
                      {TECH_LABELS[node.id]?.desc ?? ''}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {node.cost} 🍃
                    </div>
                    {isUnlocked && (
                      <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 700, marginTop: 4, display: 'block' }}>✅ Débloqué</span>
                    )}
                    {status === 'unlockable' && (
                      <button
                        className="btn btn-primary"
                        style={{ marginTop: 6, padding: '4px 10px', fontSize: 12, width: '100%' }}
                        disabled={busy}
                        onClick={() => { onUnlock?.(node.id, node.cost); }}
                      >
                        Débloquer ({node.cost} 🍃)
                      </button>
                    )}
                    {status === 'locked' && (
                      <span style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4, display: 'block' }}>
                        🔒 Nécessite : {TECH_LABELS[node.requires ?? '']?.name ?? node.requires}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Badges modal
// ---------------------------------------------------------------------------

// getAllBadgeProgress, TIER_EMOJI imported directly from @family-vault/core

const BADGE_LABELS: Record<string, { name: string; desc: string }> = {
  jardinier: { name: 'Petit Jardinier', desc: 'Récolter des cultures' },
  cuistot: { name: 'Apprenti Cuistot', desc: 'Préparer des recettes' },
  animaux: { name: 'Ami des Animaux', desc: 'Collecter des ressources' },
  regulier: { name: 'Super Régulier', desc: 'Maintenir son streak' },
  batisseur: { name: 'Grand Bâtisseur', desc: 'Construire et améliorer' },
  savant: { name: 'Savant Fou', desc: 'Débloquer des technologies' },
  assidu: { name: 'Champion des Tâches', desc: 'Compléter des tâches' },
  explorateur: { name: 'Grand Explorateur', desc: 'Atteindre des niveaux' },
};

const BADGE_TIER_COLORS: Record<string, { bg: string; border: string }> = {
  none: { bg: 'var(--card-alt)', border: 'var(--border)' },
  bronze: { bg: '#FEF3C7', border: '#F59E0B' },
  argent: { bg: '#F1F5F9', border: '#94A3B8' },
  or: { bg: '#FFFBEB', border: '#F59E0B' },
  diamant: { bg: '#EFF6FF', border: '#3B82F6' },
};

interface BadgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
}

function BadgesModal({ isOpen, onClose, profile }: BadgesModalProps) {
  const badgeProgress = useMemo(() => {
    if (!profile) return [];
    return getAllBadgeProgress(profile as any, { history: [] });
  }, [profile]);

  const earned = badgeProgress.filter(b => b.currentTier !== 'none').length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🏅 Badges" width="md">
      <div style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-muted)' }}>
        {earned} / {badgeProgress.length} badges obtenus
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {badgeProgress.map((bp) => {
          const colors = BADGE_TIER_COLORS[bp.currentTier] ?? BADGE_TIER_COLORS.none;
          const tierEmoji = TIER_EMOJI[bp.currentTier] ?? '⬜';

          return (
            <div
              key={bp.badge.id}
              style={{
                padding: 12,
                borderRadius: 12,
                border: `2px solid ${colors.border}`,
                background: colors.bg,
                opacity: bp.currentTier === 'none' ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 28 }}>{bp.badge.emoji}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {BADGE_LABELS[bp.badge.id]?.name ?? bp.badge.id} {tierEmoji}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>
                    {BADGE_LABELS[bp.badge.id]?.desc ?? ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {bp.currentValue}{bp.nextThreshold !== null ? ` / ${bp.nextThreshold}` : ' ✓ Max'}
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.round(bp.progress * 100)}%`,
                  borderRadius: 3,
                  background: bp.currentTier === 'none' ? 'var(--text-faint)' : colors.border,
                  transition: 'width 300ms ease',
                }} />
              </div>
              {/* Tier thresholds */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-faint)' }}>
                {(['bronze', 'argent', 'or', 'diamant'] as const).map((tier, i) => (
                  <span key={tier} style={{
                    opacity: bp.currentValue >= bp.badge.thresholds[i] ? 1 : 0.4,
                    fontWeight: bp.currentValue >= bp.badge.thresholds[i] ? 700 : 400,
                  }}>
                    {TIER_EMOJI[tier]} {bp.badge.thresholds[i]}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// useTranslation — simple French-only i18n shim for desktop (per D-07)
// ---------------------------------------------------------------------------

/** Minimal translation hook — returns key if no translation found */
function useTranslation(_namespace?: string) {
  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    const TRANSLATIONS: Record<string, string> = {
      // Sagas
      'mascot.saga.indicator.waiting': 'Un visiteur attend près de ton arbre',
      'mascot.saga.indicator.done': 'Suite de la saga demain...',
      'mascot.saga.indicator.progress': 'Chapitre {{current}}/{{total}} — {{title}}',
      // Companion
      'companion.stage.bebe': 'Bébé',
      'companion.stage.jeune': 'Jeune',
      'companion.stage.adulte': 'Adulte',
      // Seasons
      'mascot.season.printemps': 'Printemps',
      'mascot.season.ete': 'Été',
      'mascot.season.automne': 'Automne',
      'mascot.season.hiver': 'Hiver',
      // Tree
      'tree.sagas.title': 'Sagas',
      'tree.sagas.active': 'Saga en cours',
      'tree.sagas.chapter': 'Chapitre {{current}}/{{total}}',
      'tree.sagas.start': 'Commencer',
      'tree.sagas.continue': 'Continuer',
      'tree.sagas.choice': 'Choisir',
      'tree.sagas.completed': 'Saga terminée',
      'tree.sagas.none': 'Aucune saga disponible',
      'tree.companion.title': 'Compagnon',
      'tree.events.title': 'Événement saisonnier',
      'tree.buildings.title': 'Améliorations',
      'tree.buildings.upgrade': 'Améliorer',
      'tree.buildings.maxLevel': 'Niveau max',
    };
    let result = TRANSLATIONS[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        result = result.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
      }
    }
    return result;
  }, []);

  return { t };
}

// ---------------------------------------------------------------------------
// Saga localStorage helpers (desktop replacement for SecureStore)
// ---------------------------------------------------------------------------

function sagaStorageKey(profileId: string): string {
  return `saga_progress_${profileId}`;
}

function loadSagaProgressLocal(profileId: string): SagaProgress | null {
  try {
    const raw = localStorage.getItem(sagaStorageKey(profileId));
    if (!raw) return null;
    return JSON.parse(raw) as SagaProgress;
  } catch {
    return null;
  }
}

function saveSagaProgress(progress: SagaProgress): void {
  try {
    localStorage.setItem(sagaStorageKey(progress.profileId), JSON.stringify(progress));
  } catch {
    /* non-critical */
  }
}

function clearSagaProgressLocal(profileId: string): void {
  try {
    localStorage.removeItem(sagaStorageKey(profileId));
  } catch {
    /* non-critical */
  }
}

// ---------------------------------------------------------------------------
// Seasonal event helpers (desktop — based on current season + mock progress)
// ---------------------------------------------------------------------------

interface SeasonalEventState {
  name: string;
  emoji: string;
  season: string;
  quests: Array<{ id: string; label: string; done: boolean }>;
}

function getSeasonalEvent(season: string): SeasonalEventState {
  const info = SEASON_INFO[season as keyof typeof SEASON_INFO];
  const seasonEmoji = info?.emoji ?? '🌸';
  const EVENTS: Record<string, SeasonalEventState> = {
    printemps: {
      name: 'Fête du Printemps',
      emoji: '🌸',
      season: 'printemps',
      quests: [
        { id: 'plant_3', label: 'Planter 3 cultures', done: false },
        { id: 'streak_7', label: 'Maintenir un streak de 7 jours', done: false },
        { id: 'harvest_5', label: 'Récolter 5 fois', done: false },
      ],
    },
    ete: {
      name: "Solstice d'Été",
      emoji: '☀️',
      season: 'ete',
      quests: [
        { id: 'tasks_10', label: 'Compléter 10 tâches', done: false },
        { id: 'harvest_golden', label: 'Récolter une culture dorée', done: false },
        { id: 'unlock_tech', label: 'Débloquer une technologie', done: false },
      ],
    },
    automne: {
      name: 'Récolte Automnale',
      emoji: '🍂',
      season: 'automne',
      quests: [
        { id: 'harvest_10', label: 'Récolter 10 cultures', done: false },
        { id: 'craft_item', label: 'Crafterr un item', done: false },
        { id: 'buildings_2', label: 'Avoir 2 bâtiments actifs', done: false },
      ],
    },
    hiver: {
      name: "Magie de l'Hiver",
      emoji: '❄️',
      season: 'hiver',
      quests: [
        { id: 'gratitude_5', label: 'Écrire 5 gratitudes', done: false },
        { id: 'streak_14', label: 'Maintenir un streak de 14 jours', done: false },
        { id: 'family_tasks', label: 'Compléter des tâches en famille', done: false },
      ],
    },
  };
  return EVENTS[season] ?? {
    name: `Événement ${seasonEmoji}`,
    emoji: seasonEmoji,
    season,
    quests: [],
  };
}

function saveEventProgress(profileId: string, eventId: string, questsDone: string[]): void {
  try {
    const key = `event_progress_${profileId}_${eventId}`;
    localStorage.setItem(key, JSON.stringify(questsDone));
  } catch {
    /* non-critical */
  }
}

function loadEventProgress(profileId: string, eventId: string): string[] {
  try {
    const raw = localStorage.getItem(`event_progress_${profileId}_${eventId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Companion card — right panel
// ---------------------------------------------------------------------------

interface CompanionCardProps {
  onOpenPicker: () => void;
}

const CompanionCard = memo(function CompanionCard({ onOpenPicker }: CompanionCardProps) {
  const { t } = useTranslation('gamification');
  return (
    <GlassCard icon="🐾" title={t('tree.companion.title')} accentColor="var(--primary)">
      <CompanionWidget compact={false} onOpenPicker={onOpenPicker} />
    </GlassCard>
  );
});

// ---------------------------------------------------------------------------
// Sagas panel — right panel
// ---------------------------------------------------------------------------

interface SagasPanelProps {
  profileId: string;
  completedSagas: string[];
}

const SagasPanel = memo(function SagasPanel({ profileId, completedSagas }: SagasPanelProps) {
  const { t } = useTranslation('gamification');
  const [sagaProgress, setSagaProgress] = useState<SagaProgress | null>(null);
  const [activeSaga, setActiveSaga] = useState<Saga | null>(null);
  const [showChoices, setShowChoices] = useState(false);

  useEffect(() => {
    // Load saga progress from localStorage
    const progress = loadSagaProgressLocal(profileId);
    setSagaProgress(progress);

    if (progress && progress.status === 'active') {
      const saga = SAGAS.find(s => s.id === progress.sagaId);
      setActiveSaga(saga ?? null);
    } else {
      // Check if we should start a new saga
      const { start, sagaId } = shouldStartSaga(profileId, completedSagas, null);
      if (start && sagaId) {
        const saga = SAGAS.find(s => s.id === sagaId);
        setActiveSaga(saga ?? null);
      } else {
        setSagaProgress(null);
      }
    }
  }, [profileId, completedSagas]);

  const handleStartSaga = useCallback(() => {
    if (!activeSaga) return;
    const today = new Date().toISOString().slice(0, 10);
    const progress = createEmptySagaProgress(activeSaga.id, profileId, today);
    saveSagaProgress(progress);
    setSagaProgress(progress);
    setShowChoices(true);
  }, [activeSaga, profileId]);

  const handleMakeChoice = useCallback((choiceId: string) => {
    if (!sagaProgress || !activeSaga) return;
    const chapter = activeSaga.chapters[sagaProgress.currentChapter - 1];
    if (!chapter) return;

    const choice = chapter.choices.find(c => c.id === choiceId);
    if (!choice) return;

    const updatedTraits = { ...sagaProgress.traits };
    for (const [trait, points] of Object.entries(choice.traits ?? {})) {
      const k = trait as keyof typeof updatedTraits;
      updatedTraits[k] = (updatedTraits[k] ?? 0) + (points ?? 0);
    }

    const isLastChapter = sagaProgress.currentChapter >= activeSaga.chapters.length;
    const newProgress: SagaProgress = {
      ...sagaProgress,
      currentChapter: sagaProgress.currentChapter + 1,
      choices: { ...sagaProgress.choices, [sagaProgress.currentChapter]: choiceId },
      traits: updatedTraits,
      lastChapterDate: new Date().toISOString().slice(0, 10),
      status: isLastChapter ? 'completed' : 'active',
    };

    saveSagaProgress(newProgress);
    setSagaProgress(newProgress);
    setShowChoices(false);

    if (isLastChapter) {
      clearSagaProgressLocal(profileId);
      setSagaProgress(null);
      setActiveSaga(null);
    }
  }, [sagaProgress, activeSaga, profileId]);

  if (!activeSaga && (!sagaProgress || sagaProgress.status === 'completed')) {
    return (
      <GlassCard icon="📖" title={t('tree.sagas.title')}>
        <p className="tree-saga-empty">{t('tree.sagas.none')}</p>
      </GlassCard>
    );
  }

  const isActive = sagaProgress && sagaProgress.status === 'active';
  const chapter = activeSaga && sagaProgress
    ? activeSaga.chapters[sagaProgress.currentChapter - 1]
    : activeSaga?.chapters[0];

  return (
    <GlassCard
      icon={activeSaga?.emoji ?? '📖'}
      title={t('tree.sagas.title')}
      accentColor="#8b5cf6"
    >
      <div className="tree-saga-panel">
        {/* Saga header */}
        <div className="tree-saga-header">
          <span className="tree-saga-visitor-emoji" aria-hidden="true">
            {activeSaga?.emoji ?? '🧙'}
          </span>
          <div className="tree-saga-info">
            <span className="tree-saga-title">{activeSaga?.emoji} Visiteur</span>
            {isActive && sagaProgress && activeSaga && (
              <span className="tree-saga-progress">
                {t('tree.sagas.chapter', {
                  current: String(sagaProgress.currentChapter),
                  total: String(activeSaga.chapters.length),
                })}
              </span>
            )}
          </div>
        </div>

        {/* Narrative text */}
        {chapter && (
          <motion.div
            className="tree-saga-narrative"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            key={sagaProgress?.currentChapter ?? 0}
          >
            <p className="tree-saga-narrative-text">
              {/* Show narrative key as placeholder text (no i18n JSON loaded) */}
              {t(chapter.narrativeKey)}
            </p>
          </motion.div>
        )}

        {/* Choices */}
        <AnimatePresence>
          {showChoices && chapter && (
            <motion.div
              className="tree-saga-choices"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              {chapter.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className="tree-saga-choice-btn"
                  onClick={() => handleMakeChoice(choice.id)}
                >
                  <span aria-hidden="true">{choice.emoji}</span>
                  {t(choice.labelKey)}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        {!showChoices && (
          <div className="tree-saga-actions">
            {!isActive ? (
              <button
                type="button"
                className="btn btn-primary tree-saga-btn"
                onClick={handleStartSaga}
              >
                {t('tree.sagas.start')}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary tree-saga-btn"
                onClick={() => setShowChoices(true)}
              >
                {t('tree.sagas.continue')}
              </button>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
});

// ---------------------------------------------------------------------------
// Seasonal events panel — right panel
// ---------------------------------------------------------------------------

interface SeasonalEventPanelProps {
  season: string;
  profileId: string;
}

const SeasonalEventPanel = memo(function SeasonalEventPanel({
  season,
  profileId,
}: SeasonalEventPanelProps) {
  const { t } = useTranslation('gamification');
  const event = useMemo(() => getSeasonalEvent(season), [season]);
  const [questsDone, setQuestsDone] = useState<string[]>(() =>
    loadEventProgress(profileId, `${event.season}_${new Date().getFullYear()}`)
  );

  const handleToggleQuest = useCallback((questId: string) => {
    setQuestsDone(prev => {
      const next = prev.includes(questId)
        ? prev.filter(q => q !== questId)
        : [...prev, questId];
      saveEventProgress(profileId, `${event.season}_${new Date().getFullYear()}`, next);
      return next;
    });
  }, [profileId, event.season]);

  const completedCount = questsDone.length;
  const totalCount = event.quests.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <GlassCard
      icon={event.emoji}
      title={t('tree.events.title')}
      accentColor="#f59e0b"
      count={completedCount > 0 ? completedCount : undefined}
    >
      <div className="tree-event-panel">
        {/* Event name + progress bar */}
        <div className="tree-event-header">
          <span className="tree-event-name">{event.name}</span>
          <span className="tree-event-progress-label">{completedCount}/{totalCount}</span>
        </div>
        <div className="tree-event-progress-track">
          <motion.div
            className="tree-event-progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Quest list */}
        <ul className="tree-event-quests" role="list" aria-label="Quêtes de l'événement">
          {event.quests.map((quest) => {
            const done = questsDone.includes(quest.id);
            return (
              <li key={quest.id} className="tree-event-quest-item" role="listitem">
                <button
                  type="button"
                  className={`tree-event-quest-check${done ? ' tree-event-quest-check--done' : ''}`}
                  onClick={() => handleToggleQuest(quest.id)}
                  aria-label={`${quest.label} — ${done ? 'Terminé' : 'Non terminé'}`}
                  aria-pressed={done}
                >
                  {done ? '✓' : '○'}
                </button>
                <span className={`tree-event-quest-label${done ? ' tree-event-quest-label--done' : ''}`}>
                  {quest.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </GlassCard>
  );
});

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string) => {
    setMessage(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(null), 2400);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { message, show };
}

// ---------------------------------------------------------------------------
// No-profile state
// ---------------------------------------------------------------------------

function NoProfile() {
  return (
    <div className="tree-no-profile" role="status">
      <span className="tree-no-profile-icon" aria-hidden="true">🌳</span>
      <span>Aucun profil actif</span>
      <span className="tree-no-profile-hint">
        Configure ton vault pour afficher l'arbre familial
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function Tree() {
  const { t } = useTranslation('gamification');
  const { activeProfile, readFile, writeFile, refresh } = useVault();
  const { message: toastMsg, show: showToast } = useToast();
  const [busy, setBusy] = useState(false);

  // Companion picker
  const [companionPickerOpen, setCompanionPickerOpen] = useState(false);

  const season = useMemo(() => getCurrentSeason(), []);

  const { crops, plotCount } = useMemo(() => {
    if (!activeProfile) return { crops: [], plotCount: 0 };
    const level = activeProfile.level ?? 1;
    const stage = getTreeStage(level);
    const count = PLOTS_BY_TREE_STAGE[stage] ?? 0;
    const parsed = activeProfile.farmCrops ? parseCrops(activeProfile.farmCrops) : [];
    return { crops: parsed, plotCount: count };
  }, [activeProfile]);

  const buildings = useMemo(() => activeProfile?.farmBuildings ?? [], [activeProfile]);

  const stage = useMemo(
    () => getTreeStage(activeProfile?.level ?? 1),
    [activeProfile],
  );

  // ── Modal state ──────────────────────────────────────────────────────────

  // Crop info modal
  const [cropModal, setCropModal] = useState<{
    plotIndex: number;
    crop: PlantedCrop | undefined;
  } | null>(null);

  // Building info modal
  const [buildingModal, setBuildingModal] = useState<{
    building: PlacedBuilding;
    def: BuildingDefinition | undefined;
  } | null>(null);

  // Seed catalog modal
  const [seedCatalogOpen, setSeedCatalogOpen] = useState(false);

  // Building shop modal
  const [buildingCatalogOpen, setBuildingCatalogOpen] = useState(false);

  // Tech tree modal
  const [techTreeOpen, setTechTreeOpen] = useState(false);

  // Badges modal
  const [badgesOpen, setBadgesOpen] = useState(false);

  // Wear system state
  const [wearEffects, setWearEffects] = useState<WearEffects>({ blockedPlots: [], damagedBuildings: [], weedyPlots: [], pestBuildings: [] });
  const [wearEvents, setWearEvents] = useState<WearEvent[]>([]);
  const [mainPlotIdx, setMainPlotIdx] = useState<number | null>(null);
  const wearCheckedRef = useRef(false);

  // ── Wear effects computation ─────────────────────────────────────────────
  useEffect(() => {
    if (!activeProfile) return;

    // Compute mainPlotIdx
    setMainPlotIdx(getMainPlotIndex(crops));
  }, [activeProfile, crops]);

  // Read wear events from vault and check for new ones (once per session)
  useEffect(() => {
    if (!activeProfile || !readFile || !writeFile) return;

    const loadWearState = async () => {
      try {
        const famille = await readFile('famille.md');
        // Read wear_events field from profile section
        const lines = famille.split('\n');
        const header = `### ${activeProfile.id}`;
        let inSection = false;
        let wearCSV = '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.toLowerCase() === header.toLowerCase()) { inSection = true; continue; }
          if (inSection && trimmed.startsWith('### ')) break;
          if (inSection && trimmed.startsWith('wear_events:')) {
            wearCSV = trimmed.slice('wear_events:'.length).trim();
            break;
          }
        }
        const events = parseWearEvents(wearCSV);
        setWearEvents(events);
        setWearEffects(getActiveWearEffects(events));
      } catch { /* non-critical */ }
    };

    loadWearState();

    // Check for new wear events once per session
    if (!wearCheckedRef.current) {
      wearCheckedRef.current = true;
      checkWearInVault(readFile, writeFile, activeProfile.id, crops, buildings, plotCount)
        .then((effects) => {
          setWearEffects(effects);
          // Re-read events after check
          readFile('famille.md').then(famille => {
            const lines = famille.split('\n');
            const header = `### ${activeProfile.id}`;
            let inSection = false;
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.toLowerCase() === header.toLowerCase()) { inSection = true; continue; }
              if (inSection && trimmed.startsWith('### ')) break;
              if (inSection && trimmed.startsWith('wear_events:')) {
                const csv = trimmed.slice('wear_events:'.length).trim();
                setWearEvents(parseWearEvents(csv));
                break;
              }
            }
          }).catch(() => { /* ignore */ });
        })
        .catch(() => { /* non-critical */ });
    }
  }, [activeProfile, crops, buildings, plotCount, readFile, writeFile]);

  // ── Seed picker state ────────────────────────────────────────────────────

  const [seedPickerPlot, setSeedPickerPlot] = useState<number | null>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCropClick = useCallback((plotIndex: number, crop: PlantedCrop | undefined) => {
    setCropModal({ plotIndex, crop });
  }, []);

  const handleBuildingClick = useCallback((building: PlacedBuilding, def: BuildingDefinition | undefined) => {
    setBuildingModal({ building, def });
  }, []);

  const handleAction = useCallback((label: string) => {
    if (label === 'Boutique') {
      setSeedCatalogOpen(true);
    } else if (label === 'Atelier') {
      setBuildingCatalogOpen(true);
    } else if (label === 'Techs') {
      setTechTreeOpen(true);
    } else if (label === 'Badges') {
      setBadgesOpen(true);
    } else {
      showToast(`${label} — Bientôt disponible`);
    }
  }, [showToast]);

  const handleUnlockTech = useCallback(async (techId: string, cost: number) => {
    if (!activeProfile) return;
    setBusy(true);
    try {
      // Read famille.md, update farm_tech
      const famille = await readFile('famille.md');
      const { patchProfileField } = await import('../lib/farm-vault');
      const currentTechs = activeProfile.farmTech ?? [];
      const newTechs = [...currentTechs, techId];
      const updated = patchProfileField(famille, activeProfile.id, 'farm_tech', newTechs.join(','));
      await writeFile('famille.md', updated);

      // Deduct coins
      const gamiPath = `gami-${activeProfile.id}.md`;
      try {
        const { updateCoins, addGamiHistory } = await import('../lib/farm-vault');
        const gami = await readFile(gamiPath);
        let newGami = updateCoins(gami, activeProfile.name, -cost);
        newGami = addGamiHistory(newGami, activeProfile.id, 'tech_unlock', `🔬 Tech: ${techId} (-${cost} pièces)`);
        await writeFile(gamiPath, newGami);
      } catch { /* */ }

      await refresh();
      showToast(`🔬 ${techId} débloqué !`);
    } catch (e: any) {
      showToast(`Erreur: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [activeProfile, readFile, writeFile, refresh, showToast]);

  // ── Farm write handlers ────────────────────────────────────────────────

  const handlePlant = useCallback(async (cropId: string, cost: number) => {
    if (!activeProfile || seedPickerPlot === null) return;
    setBusy(true);
    try {
      await plantCropInVault(readFile, writeFile, activeProfile.id, activeProfile.name, seedPickerPlot, cropId, cost);
      await refresh();
      showToast(`🌱 ${cropId} planté !`);
      setSeedPickerPlot(null);
    } catch (e: any) {
      showToast(`Erreur: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [activeProfile, seedPickerPlot, readFile, writeFile, refresh, showToast]);

  const handleHarvest = useCallback(async (plotIndex: number) => {
    if (!activeProfile) return;
    setBusy(true);
    try {
      const result = await harvestCropInVault(readFile, writeFile, activeProfile.id, plotIndex);
      await refresh();
      showToast(`🌾 ${result.cropId} récolté ! +${result.reward} 🍂${result.isGolden ? ' ✨ Doré !' : ''}`);
    } catch (e: any) {
      showToast(`Erreur: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [activeProfile, readFile, writeFile, refresh, showToast]);

  const handleOpenSeedPicker = useCallback((plotIndex: number) => {
    setSeedPickerPlot(plotIndex);
    setSeedCatalogOpen(true);
  }, []);

  const handleRepairWear = useCallback(async (eventId: string) => {
    if (!activeProfile) return;
    setBusy(true);
    try {
      const cost = await repairWearInVault(readFile, writeFile, activeProfile.id, activeProfile.name, eventId);
      await refresh();
      showToast(cost > 0 ? `🔧 Réparé ! (-${cost} pièces)` : '🔧 Nettoyé !');
    } catch (e: any) {
      showToast(`Erreur: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [activeProfile, readFile, writeFile, refresh, showToast]);

  return (
    <div className="tree-page">
      {/* Left: diorama */}
      <div className="tree-diorama-panel">
        {activeProfile ? (
          <Diorama
            profile={activeProfile}
            season={season}
            crops={crops}
            plotCount={plotCount}
            onCropClick={handleCropClick}
            onBuildingClick={handleBuildingClick}
            wearEffects={wearEffects}
            wearEvents={wearEvents}
            mainPlotIdx={mainPlotIdx}
            onRepairWear={handleRepairWear}
          />
        ) : (
          <div
            className="tree-diorama-container"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <NoProfile />
          </div>
        )}
      </div>

      {/* Right: info panel */}
      <aside className="tree-info-panel" aria-label="Informations de l'arbre">
        {!activeProfile ? (
          <GlassCard>
            <NoProfile />
          </GlassCard>
        ) : (
          <>
            <ProfileTreeCard profile={activeProfile} stage={stage} />
            <CompanionCard onOpenPicker={() => setCompanionPickerOpen(true)} />
            <SagasPanel
              profileId={activeProfile.id}
              completedSagas={activeProfile.completedSagas ?? []}
            />
            <SeasonalEventPanel season={season} profileId={activeProfile.id} />
            <FarmStatusCard crops={crops} plotCount={plotCount} buildings={buildings} />
            <InhabitantsCard inhabitants={activeProfile.mascotInhabitants ?? []} />
            <ActionRow onAction={handleAction} />
          </>
        )}
      </aside>

      {/* Toast */}
      <div
        className={`tree-toast${toastMsg ? ' tree-toast--visible' : ''}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {toastMsg}
      </div>

      {/* Modals */}
      <CropInfoModal
        isOpen={cropModal !== null}
        onClose={() => setCropModal(null)}
        plotIndex={cropModal?.plotIndex ?? 0}
        crop={cropModal?.crop}
        onHarvest={handleHarvest}
        onOpenSeedPicker={handleOpenSeedPicker}
        busy={busy}
      />

      <BuildingInfoModal
        isOpen={buildingModal !== null}
        onClose={() => setBuildingModal(null)}
        building={buildingModal?.building ?? null}
        def={buildingModal?.def}
      />

      <SeedCatalogModal
        isOpen={seedCatalogOpen}
        onClose={() => { setSeedCatalogOpen(false); setSeedPickerPlot(null); }}
        treeStage={stage}
        coins={activeProfile?.coins ?? 0}
        plotIndex={seedPickerPlot ?? 0}
        unlockedTechs={activeProfile?.farmTech ?? []}
        onPlant={handlePlant}
        busy={busy}
      />

      <BuildingCatalogModal
        isOpen={buildingCatalogOpen}
        onClose={() => setBuildingCatalogOpen(false)}
        treeStage={stage}
        unlockedTechs={activeProfile?.farmTech ?? []}
      />

      <TechTreeModal
        isOpen={techTreeOpen}
        onClose={() => setTechTreeOpen(false)}
        unlockedTechs={activeProfile?.farmTech ?? []}
        coins={activeProfile?.coins ?? 0}
        onUnlock={handleUnlockTech}
        busy={busy}
      />

      <BadgesModal
        isOpen={badgesOpen}
        onClose={() => setBadgesOpen(false)}
        profile={activeProfile}
      />

      {/* Companion picker */}
      <CompanionPicker
        isOpen={companionPickerOpen}
        onClose={() => setCompanionPickerOpen(false)}
      />
    </div>
  );
}

// Error boundary wrapper
class TreeErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: 'red', fontFamily: 'monospace' }}>
          <h2>Erreur dans Mon arbre</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, opacity: 0.7 }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const TreeOriginal = Tree;

export default function TreeWithBoundary() {
  return (
    <TreeErrorBoundary>
      <TreeOriginal />
    </TreeErrorBoundary>
  );
}
