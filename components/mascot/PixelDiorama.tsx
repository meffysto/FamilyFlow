/**
 * PixelDiorama.tsx — Sol pixel art top-down pour le jardin ferme
 *
 * Vue 3/4 isométrique — sol herbeux avec :
 * - Parcelles de terre pour casser l'uniformité
 * - Buissons, pierres, champignons
 * - Fleurs qui apparaissent avec la progression
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

// ── Éléments du sol ──

type GroundElement = {
  source: any;
  x: number;       // % largeur (0-1)
  y: number;       // % hauteur (0-1)
  w: number;       // largeur px
  h: number;       // hauteur px
  opacity?: number;
  minLevel: number;
};

// ── Couche 0.5 : Touffes d'herbe dense (texture de prairie, toujours visibles) ──
const GRASS_TEXTURE: GroundElement[] = [
  // Grille reguliere de touffes pour casser l'uniformite du fond vert
  { source: require('../../assets/garden/ground/grass_tuft_1.png'), x: 0.08, y: 0.40, w: 20, h: 20, opacity: 0.5, minLevel: 0 },
  { source: require('../../assets/garden/ground/grass_tuft_2.png'), x: 0.22, y: 0.48, w: 18, h: 18, opacity: 0.45, minLevel: 0 },
  { source: require('../../assets/garden/ground/grass_tuft_3.png'), x: 0.38, y: 0.38, w: 22, h: 22, opacity: 0.5, minLevel: 0 },
  { source: require('../../assets/garden/ground/grass_tuft_1.png'), x: 0.55, y: 0.45, w: 20, h: 20, opacity: 0.4, minLevel: 0 },
  { source: require('../../assets/garden/ground/grass_tuft_2.png'), x: 0.72, y: 0.42, w: 18, h: 18, opacity: 0.45, minLevel: 0 },
  { source: require('../../assets/garden/ground/grass_tuft_3.png'), x: 0.88, y: 0.38, w: 20, h: 20, opacity: 0.5, minLevel: 0 },
  { source: require('../../assets/garden/ground/grass_tuft_1.png'), x: 0.15, y: 0.60, w: 22, h: 22, opacity: 0.45, minLevel: 0 },
  { source: require('../../assets/garden/ground/grass_tuft_3.png'), x: 0.32, y: 0.55, w: 18, h: 18, opacity: 0.4, minLevel: 0 },
  { source: require('../../assets/garden/ground/grass_tuft_2.png'), x: 0.62, y: 0.58, w: 20, h: 20, opacity: 0.5, minLevel: 0 },
  { source: require('../../assets/garden/ground/grass_tuft_1.png'), x: 0.78, y: 0.62, w: 22, h: 22, opacity: 0.45, minLevel: 0 },
  { source: require('../../assets/garden/ground/grass_tuft_3.png'), x: 0.05, y: 0.78, w: 20, h: 20, opacity: 0.4, minLevel: 0 },
  { source: require('../../assets/garden/ground/grass_tuft_2.png'), x: 0.25, y: 0.82, w: 18, h: 18, opacity: 0.5, minLevel: 0 },
  { source: require('../../assets/garden/ground/grass_tuft_1.png'), x: 0.48, y: 0.76, w: 22, h: 22, opacity: 0.45, minLevel: 0 },
  { source: require('../../assets/garden/ground/grass_tuft_3.png'), x: 0.68, y: 0.80, w: 20, h: 20, opacity: 0.4, minLevel: 0 },
  { source: require('../../assets/garden/ground/grass_tuft_2.png'), x: 0.90, y: 0.75, w: 18, h: 18, opacity: 0.5, minLevel: 0 },
  { source: require('../../assets/garden/ground/grass_tuft_1.png'), x: 0.42, y: 0.92, w: 20, h: 20, opacity: 0.45, minLevel: 0 },
  { source: require('../../assets/garden/ground/grass_tuft_3.png'), x: 0.82, y: 0.90, w: 22, h: 22, opacity: 0.4, minLevel: 0 },
];

// ── Couche 1 : Parcelles de terre (tres subtiles, juste un peu de variation) ──
const DIRT_PATCHES: GroundElement[] = [
  { source: require('../../assets/garden/ground/dirt_patch.png'), x: 0.35, y: 0.55, w: 40, h: 40, opacity: 0.08, minLevel: 0 },
  { source: require('../../assets/garden/ground/dirt_patch.png'), x: 0.65, y: 0.80, w: 36, h: 36, opacity: 0.06, minLevel: 0 },
];

// ── Couche 2 : Buissons et pierres (bordures, structure) ──
// Positions ajustees : eviter zone cultures (y < 0.30) et batiments (x > 0.80)
const STRUCTURES: GroundElement[] = [
  // Buissons bas et centre — loin des cultures et batiments
  { source: require('../../assets/garden/ground/bush_2.png'),  x: 0.06, y: 0.88, w: 46, h: 46, minLevel: 1 },
  { source: require('../../assets/garden/ground/bush_3.png'),  x: 0.50, y: 0.92, w: 44, h: 44, minLevel: 1 },
  { source: require('../../assets/garden/ground/bush_2.png'),  x: 0.72, y: 0.90, w: 42, h: 42, minLevel: 2 },
  // Pierres autour de l'arbre
  { source: require('../../assets/garden/ground/bush_1.png'),  x: 0.70, y: 0.50, w: 36, h: 36, minLevel: 2 },
  { source: require('../../assets/garden/ground/rock_3.png'),  x: 0.38, y: 0.72, w: 34, h: 34, minLevel: 3 },
  { source: require('../../assets/garden/ground/bush_1.png'),  x: 0.56, y: 0.78, w: 30, h: 30, minLevel: 5 },
  // Buissons progression
  { source: require('../../assets/garden/ground/bush_2.png'),  x: 0.30, y: 0.88, w: 40, h: 40, minLevel: 6 },
  { source: require('../../assets/garden/ground/bush_3.png'),  x: 0.62, y: 0.68, w: 38, h: 38, minLevel: 8 },
];

// ── Couche 3 : Champignons et petites fleurs (détails) ──
// Positions ajustees : zone arbre (0.35-0.65, 0.35-0.70) et bas
const DETAILS: GroundElement[] = [
  // Champignons — zone basse
  { source: require('../../assets/garden/ground/small_flower_1.png'), x: 0.18, y: 0.75, w: 28, h: 28, minLevel: 3 },
  { source: require('../../assets/garden/ground/small_flower_1.png'), x: 0.68, y: 0.82, w: 26, h: 26, minLevel: 5 },
  // Herbes — autour de l'arbre et en bas
  { source: require('../../assets/garden/ground/grass_tuft_1.png'),   x: 0.28, y: 0.55, w: 24, h: 24, opacity: 0.9, minLevel: 1 },
  { source: require('../../assets/garden/ground/grass_tuft_1.png'),   x: 0.68, y: 0.42, w: 22, h: 22, opacity: 0.9, minLevel: 1 },
  { source: require('../../assets/garden/ground/grass_tuft_2.png'),   x: 0.48, y: 0.82, w: 24, h: 24, opacity: 0.9, minLevel: 2 },
  { source: require('../../assets/garden/ground/grass_tuft_3.png'),   x: 0.12, y: 0.65, w: 22, h: 22, opacity: 0.9, minLevel: 2 },
];

// ── Couche 4 : Fleurs décoratives (progression avancée) ──
// Positions ajustees : zone basse et autour de l'arbre, eviter cultures (haut) et batiments (droite > 0.80)
const FLOWERS: GroundElement[] = [
  { source: require('../../assets/garden/ground/flower_3_0.png'), x: 0.42, y: 0.85, w: 32, h: 32, minLevel: 4 },   // pousse verte
  { source: require('../../assets/garden/ground/flower_3_1.png'), x: 0.72, y: 0.35, w: 30, h: 30, minLevel: 4 },   // herbe haute
  { source: require('../../assets/garden/ground/flower_6_2.png'), x: 0.28, y: 0.68, w: 34, h: 34, minLevel: 8 },   // fleurs bleues
  { source: require('../../assets/garden/ground/flower_6_0.png'), x: 0.62, y: 0.60, w: 32, h: 32, minLevel: 8 },   // rose rouge
  { source: require('../../assets/garden/ground/flower_6_3.png'), x: 0.15, y: 0.82, w: 34, h: 34, minLevel: 12 },  // fleurs jaunes
  { source: require('../../assets/garden/ground/flower_7_2.png'), x: 0.72, y: 0.75, w: 38, h: 38, minLevel: 15 },  // fleur bleue tige
  { source: require('../../assets/garden/ground/flower_7_3.png'), x: 0.35, y: 0.35, w: 38, h: 38, minLevel: 18 },  // fleur jaune tige
  { source: require('../../assets/garden/ground/flower_7_0.png'), x: 0.08, y: 0.92, w: 40, h: 40, minLevel: 22 },  // grosse rose
  { source: require('../../assets/garden/ground/flower_7_4.png'), x: 0.58, y: 0.92, w: 40, h: 40, minLevel: 25 },  // fleur bleue
  { source: require('../../assets/garden/ground/flower_7_5.png'), x: 0.75, y: 0.55, w: 38, h: 38, minLevel: 30 },  // iris violet
];

interface PixelDioramaProps {
  season: Season;
  level: number;
  width: number;
  groundHeight: number;
}

export function PixelDiorama({ season, level, width, groundHeight }: PixelDioramaProps) {
  const allElements = useMemo(() => {
    const visible = [
      ...GRASS_TEXTURE,
      ...DIRT_PATCHES,
      ...STRUCTURES.filter(d => level >= d.minLevel),
      ...DETAILS.filter(d => level >= d.minLevel),
      ...FLOWERS.filter(d => level >= d.minLevel),
    ];
    return visible;
  }, [level]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {allElements.map((el, i) => (
        <Image
          key={i}
          source={el.source}
          style={{
            position: 'absolute',
            left: el.x * width - el.w / 2,
            top: el.y * groundHeight - el.h / 2,
            width: el.w,
            height: el.h,
            opacity: el.opacity ?? 0.85,
          } as any}
        />
      ))}
    </View>
  );
}
