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
  type WorldCell,
} from '../../lib/mascot/world-grid';
import { type PlantedCrop, type TreeStage, type PlacedBuilding, CROP_CATALOG, BUILDING_CATALOG } from '../../lib/mascot/types';
import { BUILDING_SPRITES } from '../../lib/mascot/building-sprites';
import { parseCrops, hasCropSeasonalBonus } from '../../lib/mascot/farm-engine';
import { CROP_SPRITES } from '../../lib/mascot/crop-sprites';

interface WorldGridViewProps {
  treeStage: TreeStage;
  farmCropsCSV: string;
  ownedBuildings: PlacedBuilding[];
  containerWidth: number;
  containerHeight: number;
  onCropPlotPress?: (cellId: string, crop: PlantedCrop | null) => void;
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
          </View>
        ) : (
          <Text style={styles.emptyPlus}>+</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Cellule batiment ──

function BuildingCell({ cell, placedBuilding, containerWidth, containerHeight }: {
  cell: WorldCell;
  placedBuilding: PlacedBuilding | null;
  containerWidth: number;
  containerHeight: number;
}) {
  if (!placedBuilding) return null;
  const building = BUILDING_CATALOG.find(b => b.id === placedBuilding.buildingId);
  if (!building) return null;

  const size = CELL_SIZES[cell.size];
  const left = cell.x * containerWidth - size / 2;
  const top = cell.y * containerHeight - size / 2;

  const spriteSource = BUILDING_SPRITES[building.id]?.[placedBuilding.level]
    ?? BUILDING_SPRITES[building.id]?.[1];

  return (
    <View style={[styles.buildingCell, { position: 'absolute', left, top, width: size, height: size }]}>
      <Image source={spriteSource} style={styles.buildingSprite} />
      <Text style={styles.buildingIncome}>+{building.dailyIncome}🍃</Text>
    </View>
  );
}

// ── Grille monde ──

export function WorldGridView({
  treeStage,
  farmCropsCSV,
  ownedBuildings,
  containerWidth,
  containerHeight,
  onCropPlotPress,
}: WorldGridViewProps) {
  const unlockedCrops = getUnlockedCropCells(treeStage);
  const crops = parseCrops(farmCropsCSV);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
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

      {/* Cellules de batiment */}
      {BUILDING_CELLS.map((cell) => (
        <BuildingCell
          key={cell.id}
          cell={cell}
          placedBuilding={ownedBuildings.find(b => b.cellId === cell.id) ?? null}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
        />
      ))}
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
});
