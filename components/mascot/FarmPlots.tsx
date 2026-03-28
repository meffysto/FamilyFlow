/**
 * FarmPlots.tsx — Parcelles de culture sur le diorama
 *
 * Affiche les parcelles deblocables autour de l'arbre.
 * Parcelle vide = terre, parcelle plantee = culture au bon stade.
 * Culture mature = pulse animee pour attirer l'attention.
 */

import React, { useEffect } from 'react';
import { View, Image, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { FARM_GRID, PLOT_SIZE } from '../../lib/mascot/farm-grid';
import { type PlantedCrop, type TreeStage, PLOTS_BY_TREE_STAGE, CROP_CATALOG } from '../../lib/mascot/types';
import { parseCrops } from '../../lib/mascot/farm-engine';
import { CROP_SPRITES } from '../../lib/mascot/crop-sprites';

interface FarmPlotsProps {
  treeStage: TreeStage;
  farmCropsCSV: string;
  containerWidth: number;
  containerHeight: number;
  onPlotPress?: (plotIndex: number, crop: PlantedCrop | null) => void;
}

const DIRT_SPRITE = require('../../assets/garden/ground/dirt_patch.png');
const PLOT_RENDER_SIZE = 52; // plus grand que l'ancien 44

/** Parcelle individuelle avec animation */
function FarmPlot({ pos, crop, cropDef, isMature, containerWidth, containerHeight, onPress }: {
  pos: { index: number; x: number; y: number };
  crop: PlantedCrop | null;
  cropDef: typeof CROP_CATALOG[0] | null;
  isMature: boolean;
  containerWidth: number;
  containerHeight: number;
  onPress: () => void;
}) {
  // Pulse pour les cultures matures
  const pulse = useSharedValue(1);
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

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const left = pos.x * containerWidth - PLOT_RENDER_SIZE / 2;
  const top = pos.y * containerHeight - PLOT_RENDER_SIZE / 2;

  return (
    <Animated.View style={[{ position: 'absolute', left, top, width: PLOT_RENDER_SIZE, height: PLOT_RENDER_SIZE }, animStyle]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={styles.plot}
      >
        {/* Fond terre */}
        <Image source={DIRT_SPRITE} style={styles.dirtBg as any} />

        {/* Lueur mature */}
        {isMature && <View style={styles.matureGlow} />}

        {crop && cropDef ? (
          <View style={styles.cropContainer}>
            {CROP_SPRITES[crop.cropId]?.[crop.currentStage] ? (
              <Image
                source={CROP_SPRITES[crop.cropId][crop.currentStage]}
                style={styles.cropSprite as any}
              />
            ) : (
              <Text style={styles.cropEmoji}>{cropDef.emoji}</Text>
            )}
            {/* Indicateur de stade */}
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

export function FarmPlots({ treeStage, farmCropsCSV, containerWidth, containerHeight, onPlotPress }: FarmPlotsProps) {
  const unlockedCount = PLOTS_BY_TREE_STAGE[treeStage] ?? 0;
  if (unlockedCount === 0) return null;

  const crops = parseCrops(farmCropsCSV);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {FARM_GRID.slice(0, unlockedCount).map(pos => {
        const crop = crops.find(c => c.plotIndex === pos.index) ?? null;
        const cropDef = crop ? (CROP_CATALOG.find(c => c.id === crop.cropId) ?? null) : null;
        const isMature = !!crop && crop.currentStage >= 4;

        return (
          <FarmPlot
            key={pos.index}
            pos={pos}
            crop={crop}
            cropDef={cropDef}
            isMature={isMature}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            onPress={() => onPlotPress?.(pos.index, crop)}
          />
        );
      })}
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
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  plot: {
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
  cropContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropSprite: {
    width: 36,
    height: 44,
  },
  cropEmoji: {
    fontSize: 24,
    textAlign: 'center',
  },
  stageRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
  },
  stageDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  stageDotFilled: {
    backgroundColor: '#4ADE80',
  },
  stageDotMature: {
    backgroundColor: '#FFD700',
  },
  stageDotEmpty: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  emptyPlus: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
