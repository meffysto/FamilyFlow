/**
 * FarmPlots.tsx — Parcelles de culture sur le diorama
 *
 * Affiche les parcelles deblocables autour de l'arbre.
 * Parcelle vide = terre, parcelle plantee = culture au bon stade.
 */

import React from 'react';
import { View, Image, TouchableOpacity, Text, StyleSheet } from 'react-native';
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

// Sprite parcelle de terre vide
const DIRT_SPRITE = require('../../assets/garden/ground/dirt_patch.png');

export function FarmPlots({ treeStage, farmCropsCSV, containerWidth, containerHeight, onPlotPress }: FarmPlotsProps) {
  const unlockedCount = PLOTS_BY_TREE_STAGE[treeStage] ?? 0;
  if (unlockedCount === 0) return null;

  const crops = parseCrops(farmCropsCSV);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {FARM_GRID.slice(0, unlockedCount).map(pos => {
        const crop = crops.find(c => c.plotIndex === pos.index);
        const cropDef = crop ? CROP_CATALOG.find(c => c.id === crop.cropId) : null;
        const isMature = crop && crop.currentStage >= 4;

        const left = pos.x * containerWidth - PLOT_SIZE / 2;
        const top = pos.y * containerHeight - PLOT_SIZE / 2;

        return (
          <TouchableOpacity
            key={pos.index}
            activeOpacity={0.7}
            onPress={() => onPlotPress?.(pos.index, crop ?? null)}
            style={[styles.plot, { left, top, width: PLOT_SIZE, height: PLOT_SIZE }]}
          >
            {/* Fond terre */}
            <Image source={DIRT_SPRITE} style={styles.dirtBg as any} />

            {crop && cropDef ? (
              // Culture plantee — sprite pixel au stade actuel
              <View style={[styles.cropContainer, isMature && styles.matureCrop]}>
                {CROP_SPRITES[crop.cropId]?.[crop.currentStage] ? (
                  <Image
                    source={CROP_SPRITES[crop.cropId][crop.currentStage]}
                    style={styles.cropSprite as any}
                  />
                ) : (
                  <Text style={styles.cropEmoji}>{cropDef.emoji}</Text>
                )}
                {/* Indicateur de stade : petits points */}
                <View style={styles.stageRow}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.stageDot,
                        i <= crop.currentStage ? styles.stageDotFilled : styles.stageDotEmpty,
                      ]}
                    />
                  ))}
                </View>
              </View>
            ) : (
              // Parcelle vide — petit "+"
              <Text style={styles.emptyPlus}>+</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  plot: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    overflow: 'hidden',
  },
  dirtBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.7,
    borderRadius: 6,
  },
  cropContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  matureCrop: {
    // Lueur subtile quand la culture est prete
  },
  cropSprite: {
    width: 32,
    height: 40,
  },
  cropEmoji: {
    fontSize: 22,
    textAlign: 'center',
  },
  stageRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 1,
  },
  stageDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  stageDotFilled: {
    backgroundColor: '#4ADE80',
  },
  stageDotEmpty: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  emptyPlus: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
