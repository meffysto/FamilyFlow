/**
 * WagerReadyRing.tsx — Anneau vert "prêt à valider" sur plant scellé (Phase 40 Plan 03).
 *
 * Double gate appliqué par le parent CropCell (WorldGridView) :
 *   - plant mûr (currentStage ≥ 4) ET
 *   - cumul atteint (wager.cumulCurrent ≥ wager.cumulTarget)
 *
 * Ce composant n'est rendu que pour plants déjà filtrés — cas rare, 0-2 plants
 * simultanés max en pratique. `useSharedValue` par instance acceptable.
 *
 * Animation :
 *   - Si `useReducedMotion()` → vue statique, aucune animation démarrée.
 *   - Sinon → breathing opacity 0.7 ↔ 1.0 sur 2s, très subtil, honore accessibilité.
 *
 * Zéro interaction : `pointerEvents: 'none'` — simple overlay visuel.
 * Couleur : `colors.success` (token theme, jamais hardcoded).
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  useReducedMotion,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { useThemeColors } from '../../contexts/ThemeContext';

/** Spring/timing config breathing — constante module (convention Phase 40). */
const BREATHING_CONFIG = {
  duration: 2000,
  minOpacity: 0.7,
  maxOpacity: 1.0,
} as const;

interface WagerReadyRingProps {
  /** Diamètre en pixels, matché à la taille du sprite CropCell. */
  size: number;
  /** Rayon de bordure custom, défaut = size / 2 (cercle). */
  borderRadius?: number;
}

export function WagerReadyRing({ size, borderRadius }: WagerReadyRingProps) {
  const { colors } = useThemeColors();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue<number>(BREATHING_CONFIG.maxOpacity);

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(opacity);
      opacity.value = BREATHING_CONFIG.maxOpacity;
      return;
    }
    opacity.value = BREATHING_CONFIG.minOpacity;
    opacity.value = withRepeat(
      withTiming(BREATHING_CONFIG.maxOpacity, {
        duration: BREATHING_CONFIG.duration,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(opacity);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const ringStyle = {
    width: size,
    height: size,
    borderRadius: borderRadius ?? size / 2,
    borderColor: colors.success,
  };

  // Rendu statique si reduceMotion (pas d'Animated.View nécessaire)
  if (reducedMotion) {
    return (
      <View
        pointerEvents="none"
        style={[styles.ring, ringStyle]}
      />
    );
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ring, ringStyle, animStyle]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 2,
    zIndex: 11,
  },
});
