/**
 * EnvelopeFlap.tsx — Rabat triangulaire de l'enveloppe (SVG Polygon)
 *
 * Triangle isocèle pointe vers le bas (sommets : top-left, top-right,
 * bottom-center). Dégradé vertical ivoire clair → ivoire ombré pour
 * simuler le pli papier. Posé en absoluteFill sur la moitié haute de
 * l'enveloppe par le parent (EnvelopeCard).
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Polygon,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';

interface EnvelopeFlapProps {
  width: number;
  height: number;
  /** Palette 3 stops haut→bas. Defaults : kraft (papier recyclé brun chaud). */
  colors?: [string, string, string];
}

export function EnvelopeFlap({
  width,
  height,
  colors = ['#c8a876', '#b08b5a', '#8f6a3f'],
}: EnvelopeFlapProps) {
  const points = `0,0 ${width},0 ${width / 2},${height}`;
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="flap" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors[0]} stopOpacity="1" />
          <Stop offset="0.8" stopColor={colors[1]} stopOpacity="1" />
          <Stop offset="1" stopColor={colors[2]} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Polygon points={points} fill="url(#flap)" />
    </Svg>
  );
}
