/**
 * PixelDiorama.tsx — Fond pixel art saisonnier pour le jardin
 *
 * Remplace les JPEG aquarelle par un diorama composé de :
 * - Gradient ciel saisonnier
 * - Bande de sol pixel
 * - Décorations auto-placées selon le niveau (fleurs, pierres, champignons)
 */

import React, { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import type { Season } from '../../lib/mascot/seasons';

// ── Couleurs ciel par saison (palette pixel-friendly) ──

const PIXEL_SKY: Record<Season, [string, string]> = {
  printemps: ['#87CEEB', '#B8E6B8'],   // bleu clair → vert pastel
  ete:       ['#5DADE2', '#F9E79F'],    // bleu vif → jaune chaud
  automne:   ['#D4A574', '#E8B87A'],    // brun doré → ambre
  hiver:     ['#B0C4DE', '#E8E8F0'],    // gris bleuté → blanc neige
};

const PIXEL_GROUND: Record<Season, string> = {
  printemps: '#6B8E23',  // vert herbe
  ete:       '#7CCD7C',  // vert vif
  automne:   '#8B7355',  // terre brune
  hiver:     '#D3D3D3',  // gris neige
};

// ── Décorations auto : fleurs du Tiny Garden ──

type GroundDeco = {
  source: any;
  x: number;       // % de la largeur (0-1)
  y: number;       // % depuis le haut du sol (0-1)
  size: number;    // px
  minLevel: number;
};

// Fleurs sélectionnées depuis les sprites Tiny Garden (row, col)
const GROUND_FLOWERS: GroundDeco[] = [
  // Fleurs simples (apparaissent tôt)
  { source: require('../../assets/garden/ground/flower_0_0.png'), x: 0.08, y: 0.15, size: 28, minLevel: 1 },
  { source: require('../../assets/garden/ground/flower_0_2.png'), x: 0.88, y: 0.25, size: 28, minLevel: 1 },
  { source: require('../../assets/garden/ground/flower_1_1.png'), x: 0.18, y: 0.55, size: 24, minLevel: 3 },
  { source: require('../../assets/garden/ground/flower_1_4.png'), x: 0.78, y: 0.40, size: 24, minLevel: 3 },

  // Fleurs moyennes (progression)
  { source: require('../../assets/garden/ground/flower_2_0.png'), x: 0.35, y: 0.65, size: 30, minLevel: 6 },
  { source: require('../../assets/garden/ground/flower_2_3.png'), x: 0.62, y: 0.20, size: 30, minLevel: 6 },
  { source: require('../../assets/garden/ground/flower_3_1.png'), x: 0.05, y: 0.70, size: 26, minLevel: 10 },
  { source: require('../../assets/garden/ground/flower_3_5.png'), x: 0.92, y: 0.60, size: 26, minLevel: 10 },

  // Fleurs élaborées (haut niveau)
  { source: require('../../assets/garden/ground/flower_4_2.png'), x: 0.25, y: 0.30, size: 32, minLevel: 15 },
  { source: require('../../assets/garden/ground/flower_4_6.png'), x: 0.72, y: 0.70, size: 32, minLevel: 15 },
  { source: require('../../assets/garden/ground/flower_5_0.png'), x: 0.50, y: 0.80, size: 34, minLevel: 20 },
  { source: require('../../assets/garden/ground/flower_5_4.png'), x: 0.15, y: 0.45, size: 34, minLevel: 25 },
];

interface PixelDioramaProps {
  season: Season;
  level: number;
  width: number;
  groundHeight?: number; // hauteur de la bande de sol (défaut 80)
}

export function PixelDiorama({ season, level, width, groundHeight = 80 }: PixelDioramaProps) {
  const skyColors = PIXEL_SKY[season];
  const groundColor = PIXEL_GROUND[season];

  const visibleDecos = useMemo(
    () => GROUND_FLOWERS.filter(d => level >= d.minLevel),
    [level],
  );

  return (
    <View style={[styles.ground, { width, height: groundHeight, backgroundColor: groundColor }]} pointerEvents="none">
      {/* Bord supérieur : transition douce sky → sol */}
      <View style={[styles.groundEdge, { backgroundColor: groundColor + '88' }]} />

      {/* Décorations auto */}
      {visibleDecos.map((deco, i) => (
        <Image
          key={i}
          source={deco.source}
          style={[
            styles.groundItem,
            {
              left: deco.x * width - deco.size / 2,
              top: deco.y * groundHeight - deco.size / 2,
              width: deco.size,
              height: deco.size,
            },
          ] as any}
        />
      ))}
    </View>
  );
}

/** Couleurs de ciel exportées pour le gradient parent */
export { PIXEL_SKY, PIXEL_GROUND };

const styles = StyleSheet.create({
  ground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  groundEdge: {
    position: 'absolute',
    top: -4,
    left: 0,
    right: 0,
    height: 8,
  },
  groundItem: {
    position: 'absolute',
  },
});
