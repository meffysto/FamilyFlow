/**
 * MiniDiorama.tsx — Apercu miniature du jardin complet
 *
 * Combine : sol pixel + fleurs + parcelles + arbre
 * Utilise dans la boutique comme preview.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TreeView } from './TreeView';
import { PixelDiorama, PIXEL_GROUND, PIXEL_GROUND_DARK } from './PixelDiorama';
import { WorldGridView } from './WorldGridView';
import { type TreeSpecies, type TreeStage } from '../../lib/mascot/types';
import { getCurrentSeason } from '../../lib/mascot/seasons';
import { getTreeStage } from '../../lib/mascot/engine';

interface MiniDioramaProps {
  species: TreeSpecies;
  level: number;
  size: number;
  decorations?: string[];
  inhabitants?: string[];
  farmCropsCSV?: string;
}

export function MiniDiorama({ species, level, size, decorations = [], inhabitants = [], farmCropsCSV = '' }: MiniDioramaProps) {
  const season = getCurrentSeason();
  const treeStage = getTreeStage(level);
  const height = size * 1.1;

  return (
    <View style={[styles.container, { width: size, height }]}>
      {/* Sol */}
      <LinearGradient
        colors={[PIXEL_GROUND[season] + 'CC', PIXEL_GROUND[season], PIXEL_GROUND_DARK[season]]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Fleurs */}
      <PixelDiorama
        season={season}
        level={level}
        width={size}
        groundHeight={height}
      />

      {/* Grille monde */}
      <WorldGridView
        treeStage={treeStage}
        farmCropsCSV={farmCropsCSV}
        ownedBuildings={[]}
        containerWidth={size}
        containerHeight={height}
      />

      {/* Arbre centre */}
      <View style={styles.treeWrap}>
        <TreeView
          species={species}
          level={level}
          size={size * 0.65}
          interactive={false}
          decorations={decorations}
          inhabitants={inhabitants}
          placements={{}}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  treeWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
