/**
 * FloatingPoints.tsx — Animation "+X pts" flottante
 *
 * S'affiche au-dessus de la checkbox quand un enfant complète une tâche.
 * Flotte vers le haut avec fade-out.
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  useReducedMotion,
  Easing,
} from 'react-native-reanimated';
import { useThemeColors } from '../contexts/ThemeContext';
import { FontSize, FontWeight } from '../constants/typography';

interface FloatingPointsProps {
  points: number;
  visible: boolean;
  onDone: () => void;
}

export function FloatingPoints({ points, visible, onDone }: FloatingPointsProps) {
  const { primary } = useThemeColors();
  const reduceMotion = useReducedMotion();

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!visible) return;

    if (reduceMotion) {
      onDone();
      return;
    }

    // Reset
    translateY.value = 0;
    opacity.value = 1;
    scale.value = 1;

    // Animate
    translateY.value = withTiming(-50, { duration: 420, easing: Easing.out(Easing.quad) });
    scale.value = withTiming(1.15, { duration: 420, easing: Easing.out(Easing.quad) });
    opacity.value = withDelay(
      180,
      withTiming(0, { duration: 240 }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.Text style={[styles.text, { color: primary }, animStyle]}>
      +{points} pts
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: {
    position: 'absolute',
    top: -8,
    left: -4,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    zIndex: 10,
  },
});
