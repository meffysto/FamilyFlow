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
}

export function EnvelopeFlap({ width, height }: EnvelopeFlapProps) {
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
          <Stop offset="0" stopColor="#efdcb0" stopOpacity="1" />
          <Stop offset="0.8" stopColor="#e2ca92" stopOpacity="1" />
          <Stop offset="1" stopColor="#d4bc85" stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Polygon points={points} fill="url(#flap)" />
    </Svg>
  );
}
