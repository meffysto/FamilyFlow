/**
 * AnimatedProgressBar.tsx — Barre de progression animée au mount.
 *
 * Width 0 → progress (0..1) avec withTiming léger (400ms out-quint).
 * Re-anim si `progress` change.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { Radius } from '../../constants/spacing';

const FILL_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const FILL_DURATION_MS = 400;

interface Props {
  /** Valeur 0..1 */
  progress: number;
  /** Couleur du remplissage */
  color: string;
  /** Couleur du fond (track) */
  backgroundColor: string;
  /** Hauteur de la barre. Default 6. */
  height?: number;
  /** Style additionnel sur le wrapper. */
  style?: ViewStyle;
}

export function AnimatedProgressBar({ progress, color, backgroundColor, height = 6, style }: Props) {
  const reduceMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, progress));
  const widthPct = useSharedValue(reduceMotion ? clamped * 100 : 0);

  useEffect(() => {
    widthPct.value = reduceMotion
      ? clamped * 100
      : withTiming(clamped * 100, { duration: FILL_DURATION_MS, easing: FILL_EASING });
  }, [clamped, reduceMotion, widthPct]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${widthPct.value}%`,
  }));

  return (
    <View style={[styles.track, { backgroundColor, height, borderRadius: height / 2 }, style]}>
      <Animated.View style={[styles.fill, { backgroundColor: color, borderRadius: height / 2 }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: Radius.xxs,
  },
  fill: {
    height: '100%',
  },
});
