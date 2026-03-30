/**
 * WorldGridView.tsx — Rendu de la grille monde unifiee
 *
 * Affiche les cellules de la grille : cultures, batiments, decos.
 * Remplace FarmPlots avec un systeme extensible.
 */

import React, { useEffect, useState } from 'react';
import { View, Image, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import {
  WORLD_GRID,
  CELL_SIZES,
  getUnlockedCropCells,
  BUILDING_CELLS,
  EXPANSION_CROP_CELLS,
  EXPANSION_BUILDING_CELL,
  EXPANSION_LARGE_CROP_CELL,
  type WorldCell,
} from '../../lib/mascot/world-grid';
import { type TechBonuses } from '../../lib/mascot/tech-engine';
import { type PlantedCrop, type TreeStage, type PlacedBuilding, CROP_CATALOG, BUILDING_CATALOG, TREE_STAGES } from '../../lib/mascot/types';
import { BUILDING_SPRITES } from '../../lib/mascot/building-sprites';
import { getPendingResources } from '../../lib/mascot/building-engine';
import { parseCrops, hasCropSeasonalBonus } from '../../lib/mascot/farm-engine';
import { CROP_SPRITES } from '../../lib/mascot/crop-sprites';

interface WorldGridViewProps {
  treeStage: TreeStage;
  farmCropsCSV: string;
  ownedBuildings: PlacedBuilding[];
  containerWidth: number;
  containerHeight: number;
  techBonuses?: TechBonuses;
  onCropPlotPress?: (cellId: string, crop: PlantedCrop | null) => void;
  onBuildingCellPress?: (cellId: string, building: PlacedBuilding | null) => void;
}

const DIRT_SPRITE = require('../../assets/garden/ground/dirt_patch.png');

// ── Cellule culture ──

function CropCell({ cell, crop, cropDef, isMature, containerWidth, containerHeight, onPress }: {
  cell: WorldCell;
  crop: PlantedCrop | null;
  cropDef: typeof CROP_CATALOG[0] | null;
  isMature: boolean;
  containerWidth: number;
  containerHeight: number;
  onPress: () => void;
}) {
  const pulse = useSharedValue(1);
  const growScaleX = useSharedValue(1);
  const growScaleY = useSharedValue(1);
  const prevStage = React.useRef(crop?.currentStage ?? -1);

  // Frame swap animation (VIS-02) — balancement doux ~800ms
  const reducedMotion = useReducedMotion();
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    if (reducedMotion || !crop) return;
    const timer = setInterval(() => setFrameIdx(i => 1 - i), 800);
    return () => clearInterval(timer);
  }, [reducedMotion, crop?.cropId]);

  // Pulse mature
  useEffect(() => {
    if (isMature) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 600, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true,
      );
    } else {
      pulse.value = 1;
    }
  }, [isMature]);

  // Growth wiggle quand le stade change
  useEffect(() => {
    const currentStage = crop?.currentStage ?? -1;
    if (prevStage.current >= 0 && currentStage > prevStage.current && currentStage < 4) {
      // Squash → spring up → settle
      growScaleX.value = withSequence(
        withTiming(1.25, { duration: 100 }),
        withSpring(0.95, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 12, stiffness: 150 }),
      );
      growScaleY.value = withSequence(
        withTiming(0.7, { duration: 100 }),
        withSpring(1.1, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 12, stiffness: 150 }),
      );
    }
    prevStage.current = currentStage;
  }, [crop?.currentStage]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pulse.value },
      { scaleX: growScaleX.value },
      { scaleY: growScaleY.value },
    ],
  }));

  const size = CELL_SIZES[cell.size];
  const left = cell.x * containerWidth - size / 2;
  const top = cell.y * containerHeight - size / 2;

  return (
    <Animated.View style={[{ position: 'absolute', left, top, width: size, height: size }, animStyle]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={styles.cell}
      >
        <Image source={DIRT_SPRITE} style={styles.dirtBg as any} />
        {isMature && <View style={styles.matureGlow} />}

        {crop && cropDef ? (
          <View style={styles.cropContainer}>
            {(() => {
              const frames = CROP_SPRITES[crop.cropId]?.[crop.currentStage];
              const spriteSource = frames ? frames[frameIdx] : null;
              return spriteSource ? (
                <Image
                  source={spriteSource}
                  style={styles.cropSprite as any}
                />
              ) : (
                <Text style={styles.cropEmoji}>{cropDef.emoji}</Text>
              );
            })()}
            {/* Badge saisonnier */}
            {hasCropSeasonalBonus(crop.cropId) && crop.currentStage < 4 && (
              <Text style={styles.seasonBadge}>☀️x2</Text>
            )}
            <View style={styles.stageRow}>
              {Array.from({ length: 4 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.stageDot,
                    i < crop.currentStage
                      ? (isMature ? styles.stageDotMature : styles.stageDotFilled)
                      : styles.stageDotEmpty,
                  ]}
                />
              ))}
            </View>
            {!isMature && (
              <Text style={styles.taskCount}>
                {crop.tasksCompleted}/{cropDef.tasksPerStage}
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.emptyPlus}>+</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Cellule batiment ──

function BuildingCell({ cell, placedBuilding, pendingCount, canBuild, containerWidth, containerHeight, onPress }: {
  cell: WorldCell;
  placedBuilding: PlacedBuilding | null;
  pendingCount: number;
  canBuild: boolean;
  containerWidth: number;
  containerHeight: number;
  onPress: () => void;
}) {
  const pulse = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!reducedMotion && pendingCount > 0) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true,
      );
    } else {
      pulse.value = withTiming(1, { duration: 300 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, pendingCount > 0]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const size = CELL_SIZES[cell.size];
  const left = cell.x * containerWidth - size / 2;
  const top = cell.y * containerHeight - size / 2;

  return (
    <Animated.View style={[{ position: 'absolute', left, top, width: size, height: size }, animStyle]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.buildingCell}>
        {placedBuilding ? (
          <>
            <Image
              source={BUILDING_SPRITES[placedBuilding.buildingId]?.[placedBuilding.level]}
              style={styles.buildingSprite}
            />
            {pendingCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.emptyBuildingPlus}>{'⚒'}</Text>
            {canBuild && (
              <View style={styles.canBuildBadge}>
                <Text style={styles.canBuildBadgeText}>{'!'}</Text>
              </View>
            )}
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Cellule verrouillee (expansion) ──

function LockedExpansionCell({ cell, cellType, containerWidth, containerHeight }: {
  cell: WorldCell;
  cellType: 'crop' | 'building';
  containerWidth: number;
  containerHeight: number;
}) {
  const scale = useSharedValue(0);
  React.useEffect(() => {
    scale.value = withSpring(1, { damping: 10, stiffness: 150 });
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const size = CELL_SIZES[cell.size];
  const left = cell.x * containerWidth - size / 2;
  const top = cell.y * containerHeight - size / 2;

  return (
    <Animated.View style={[{ position: 'absolute', left, top, width: size, height: size }, animStyle]}>
      <View style={[
        styles.lockedCell,
        cellType === 'building' && styles.lockedBuildingCell,
      ]}>
        <Text style={styles.lockEmoji}>{'🔒'}</Text>
      </View>
    </Animated.View>
  );
}

// ── Grille monde ──

export function WorldGridView({
  treeStage,
  farmCropsCSV,
  ownedBuildings,
  containerWidth,
  containerHeight,
  techBonuses,
  onCropPlotPress,
  onBuildingCellPress,
}: WorldGridViewProps) {
  const unlockedCrops = getUnlockedCropCells(treeStage);
  const crops = parseCrops(farmCropsCSV);

  // Peut-on construire un batiment sur une cellule vide ?
  const stageOrder = TREE_STAGES.map(s => s.stage);
  const currentStageIdx = stageOrder.indexOf(treeStage);
  const placedIds = ownedBuildings.map(b => b.buildingId);
  const canBuildOnEmpty = BUILDING_CATALOG.some(def => {
    const requiredIdx = stageOrder.indexOf(def.minTreeStage);
    return requiredIdx <= currentStageIdx && !placedIds.includes(def.id);
  });

  // Calcul des cellules d'expansion
  const expansionCropsUnlocked = techBonuses ? techBonuses.extraCropCells > 0 : false;
  const expansionBuildingUnlocked = techBonuses ? techBonuses.extraBuildingCells > 0 : false;
  const largeCropUnlocked = techBonuses ? techBonuses.hasLargeCropCell : false;

  // Les cellules d'expansion a rendre (debloquees)
  const unlockedExpansionCrops = expansionCropsUnlocked
    ? EXPANSION_CROP_CELLS.slice(0, techBonuses!.extraCropCells)
    : [];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 3 }]} pointerEvents="box-none">
      {/* Cellules de culture debloquees */}
      {unlockedCrops.map(cell => {
        // Mapper l'ancien plotIndex sur le cellId
        const cellIdx = unlockedCrops.indexOf(cell);
        const crop = crops.find(c => c.plotIndex === cellIdx) ?? null;
        const cropDef = crop ? (CROP_CATALOG.find(c => c.id === crop.cropId) ?? null) : null;
        const isMature = !!crop && crop.currentStage >= 4;

        return (
          <CropCell
            key={cell.id}
            cell={cell}
            crop={crop}
            cropDef={cropDef}
            isMature={isMature}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            onPress={() => onCropPlotPress?.(cell.id, crop)}
          />
        );
      })}

      {/* Cellules d'expansion culture — debloquees */}
      {unlockedExpansionCrops.map(cell => {
        const allExpandedCells = [...unlockedCrops, ...unlockedExpansionCrops];
        const cellIdx = allExpandedCells.indexOf(cell);
        const crop = crops.find(c => c.plotIndex === cellIdx) ?? null;
        const cropDef = crop ? (CROP_CATALOG.find(c => c.id === crop.cropId) ?? null) : null;
        const isMature = !!crop && crop.currentStage >= 4;

        return (
          <CropCell
            key={cell.id}
            cell={cell}
            crop={crop}
            cropDef={cropDef}
            isMature={isMature}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            onPress={() => onCropPlotPress?.(cell.id, crop)}
          />
        );
      })}

      {/* Cellules d'expansion culture — verrouilees */}
      {!expansionCropsUnlocked && techBonuses !== undefined && EXPANSION_CROP_CELLS.map(cell => (
        <LockedExpansionCell
          key={cell.id}
          cell={cell}
          cellType="crop"
          containerWidth={containerWidth}
          containerHeight={containerHeight}
        />
      ))}

      {/* Parcelle geante — debloquee */}
      {largeCropUnlocked && (() => {
        const cell = EXPANSION_LARGE_CROP_CELL;
        const allExpandedCells = [...unlockedCrops, ...unlockedExpansionCrops, cell];
        const cellIdx = allExpandedCells.indexOf(cell);
        const crop = crops.find(c => c.plotIndex === cellIdx) ?? null;
        const cropDef = crop ? (CROP_CATALOG.find(c => c.id === crop.cropId) ?? null) : null;
        const isMature = !!crop && crop.currentStage >= 4;

        return (
          <CropCell
            key={cell.id}
            cell={cell}
            crop={crop}
            cropDef={cropDef}
            isMature={isMature}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            onPress={() => onCropPlotPress?.(cell.id, crop)}
          />
        );
      })()}

      {/* Parcelle geante — verrouillee */}
      {!largeCropUnlocked && techBonuses !== undefined && (
        <LockedExpansionCell
          cell={EXPANSION_LARGE_CROP_CELL}
          cellType="crop"
          containerWidth={containerWidth}
          containerHeight={containerHeight}
        />
      )}

      {/* Cellules de batiment */}
      {BUILDING_CELLS.map(cell => {
        const placedBuilding = ownedBuildings.find(b => b.cellId === cell.id) ?? null;
        const pendingCount = placedBuilding ? getPendingResources(placedBuilding) : 0;
        return (
          <BuildingCell
            key={cell.id}
            cell={cell}
            placedBuilding={placedBuilding}
            pendingCount={pendingCount}
            canBuild={!placedBuilding && canBuildOnEmpty}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            onPress={() => onBuildingCellPress?.(cell.id, placedBuilding)}
          />
        );
      })}

      {/* Cellule batiment expansion — debloquee */}
      {expansionBuildingUnlocked && (() => {
        const cell = EXPANSION_BUILDING_CELL;
        const placedBuilding = ownedBuildings.find(b => b.cellId === cell.id) ?? null;
        const pendingCount = placedBuilding ? getPendingResources(placedBuilding) : 0;
        return (
          <BuildingCell
            key={cell.id}
            cell={cell}
            placedBuilding={placedBuilding}
            pendingCount={pendingCount}
            canBuild={!placedBuilding && canBuildOnEmpty}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            onPress={() => onBuildingCellPress?.(cell.id, placedBuilding)}
          />
        );
      })()}

      {/* Cellule batiment expansion — verrouillee */}
      {!expansionBuildingUnlocked && techBonuses !== undefined && (
        <LockedExpansionCell
          cell={EXPANSION_BUILDING_CELL}
          cellType="building"
          containerWidth={containerWidth}
          containerHeight={containerHeight}
        />
      )}
    </View>
  );
}

/** Compteur ferme (a afficher sous le diorama) */
export function FarmStats({ farmCropsCSV, colors, t }: { farmCropsCSV: string; colors: any; t: (key: string, opts?: any) => string }) {
  const crops = parseCrops(farmCropsCSV);
  if (crops.length === 0) return null;

  const matureCount = crops.filter(c => c.currentStage >= 4).length;
  const growingCount = crops.filter(c => c.currentStage < 4).length;

  return (
    <View style={statsStyles.container}>
      {growingCount > 0 && (
        <Text style={[statsStyles.text, { color: colors.textSub }]}>
          {t('farm.stats.growing', { count: growingCount })}
        </Text>
      )}
      {matureCount > 0 && (
        <Text style={[statsStyles.text, { color: '#4ADE80' }]}>
          {t('farm.stats.ready', { count: matureCount })}
        </Text>
      )}
    </View>
  );
}

const statsStyles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingVertical: 6 },
  text: { fontSize: 13, fontWeight: '600' },
});

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    overflow: 'hidden',
  },
  dirtBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.8,
    borderRadius: 8,
  },
  matureGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4ADE80',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  cropContainer: { alignItems: 'center', justifyContent: 'center' },
  cropSprite: { width: 36, height: 44 },
  cropEmoji: { fontSize: 24, textAlign: 'center' },
  seasonBadge: { fontSize: 8, position: 'absolute', top: -2, right: -4 },
  stageRow: { flexDirection: 'row', gap: 3, marginTop: 2 },
  stageDot: { width: 5, height: 5, borderRadius: 3 },
  stageDotFilled: { backgroundColor: '#8B6914' },
  stageDotMature: { backgroundColor: '#FFD700' },
  stageDotEmpty: { backgroundColor: 'rgba(255,255,255,0.3)' },
  taskCount: { color: 'rgba(255,255,255,0.8)', fontSize: 8, fontWeight: '600' as const, marginTop: 1, textAlign: 'center' as const },
  emptyPlus: { color: 'rgba(255,255,255,0.5)', fontSize: 20, fontWeight: 'bold' },
  buildingCell: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  buildingEmoji: { fontSize: 28 },
  buildingSprite: { width: 32, height: 32 },
  buildingIncome: { fontSize: 10, color: '#4ADE80', fontWeight: '600', marginTop: 2 },
  pendingBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  pendingBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyBuildingPlus: {
    fontSize: 18,
    textAlign: 'center',
    opacity: 0.7,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  canBuildBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#4ADE80',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  canBuildBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  lockedCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
  },
  lockedBuildingCell: {
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  lockEmoji: {
    fontSize: 16,
    opacity: 0.7,
  },
});
