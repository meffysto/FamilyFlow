/**
 * PixelDiorama.tsx — Fond pixel art top-down pour le jardin
 *
 * Vue 3/4 isométrique (style Stardew Valley) :
 * - Sol herbeux plein écran
 * - Plantes et fleurs auto-placées selon le niveau
 */

import React, { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import type { Season } from '../../lib/mascot/seasons';

// ── Couleurs sol par saison ──

export const PIXEL_GROUND: Record<Season, string> = {
  printemps: '#5A8C32',
  ete:       '#6B9E3A',
  automne:   '#7A6B3A',
  hiver:     '#C8D0C8',
};

export const PIXEL_GROUND_DARK: Record<Season, string> = {
  printemps: '#3D6B1E',
  ete:       '#4A7A28',
  automne:   '#5A4A28',
  hiver:     '#A0A8A0',
};

// ── Décorations sol — uniquement les vrais sprites plantes/fleurs ──

type GroundDeco = {
  source: any;
  x: number;
  y: number;
  size: number;
  minLevel: number;
};

const GROUND_DECOS: GroundDeco[] = [
  // Petites herbes (niveaux bas)
  { source: require('../../assets/garden/ground/flower_3_0.png'), x: 0.07, y: 0.15, size: 32, minLevel: 1 },  // pousse verte
  { source: require('../../assets/garden/ground/flower_3_1.png'), x: 0.91, y: 0.82, size: 30, minLevel: 1 },  // herbe haute
  { source: require('../../assets/garden/ground/flower_3_3.png'), x: 0.88, y: 0.20, size: 34, minLevel: 2 },  // buisson
  { source: require('../../assets/garden/ground/flower_3_0.png'), x: 0.10, y: 0.75, size: 28, minLevel: 3 },  // pousse

  // Petites fleurs colorées (niveaux moyens)
  { source: require('../../assets/garden/ground/flower_6_2.png'), x: 0.06, y: 0.40, size: 36, minLevel: 5 },  // fleurs bleues
  { source: require('../../assets/garden/ground/flower_6_0.png'), x: 0.92, y: 0.50, size: 34, minLevel: 5 },  // rose rouge
  { source: require('../../assets/garden/ground/flower_6_3.png'), x: 0.85, y: 0.35, size: 36, minLevel: 8 },  // fleurs jaunes
  { source: require('../../assets/garden/ground/flower_4_6.png'), x: 0.08, y: 0.58, size: 30, minLevel: 8 },  // fleur violette

  // Grandes fleurs (progression avancée)
  { source: require('../../assets/garden/ground/flower_7_2.png'), x: 0.12, y: 0.25, size: 40, minLevel: 12 }, // fleur bleue sur tige
  { source: require('../../assets/garden/ground/flower_7_3.png'), x: 0.88, y: 0.65, size: 40, minLevel: 12 }, // fleur jaune sur tige
  { source: require('../../assets/garden/ground/flower_7_0.png'), x: 0.06, y: 0.88, size: 42, minLevel: 15 }, // grosse rose
  { source: require('../../assets/garden/ground/flower_7_4.png'), x: 0.92, y: 0.88, size: 42, minLevel: 15 }, // grosse fleur bleue
  { source: require('../../assets/garden/ground/flower_7_5.png'), x: 0.14, y: 0.50, size: 38, minLevel: 20 }, // iris violet
  { source: require('../../assets/garden/ground/flower_5_0.png'), x: 0.86, y: 0.12, size: 38, minLevel: 20 }, // plante tropicale

  // Cactus / buisson décoratif (haut niveau)
  { source: require('../../assets/garden/ground/flower_3_4.png'), x: 0.05, y: 0.65, size: 36, minLevel: 25 }, // cactus
  { source: require('../../assets/garden/ground/flower_5_4.png'), x: 0.93, y: 0.40, size: 44, minLevel: 30 }, // petit arbre
];

interface PixelDioramaProps {
  season: Season;
  level: number;
  width: number;
  groundHeight: number;
}

export function PixelDiorama({ season, level, width, groundHeight }: PixelDioramaProps) {
  const visibleDecos = useMemo(
    () => GROUND_DECOS.filter(d => level >= d.minLevel),
    [level],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {visibleDecos.map((deco, i) => (
        <Image
          key={i}
          source={deco.source}
          style={{
            position: 'absolute',
            left: deco.x * width - deco.size / 2,
            top: deco.y * groundHeight - deco.size / 2,
            width: deco.size,
            height: deco.size,
            opacity: 0.8,
          } as any}
        />
      ))}
    </View>
  );
}
