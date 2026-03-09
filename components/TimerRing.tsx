/**
 * TimerRing.tsx — Cercle animé pour countdown de cuisson.
 *
 * Affichage visuel du temps restant avec :
 * - Bordure épaisse colorée (primary → warning → error)
 * - Pulsation quand le temps est faible
 * - Contenu central (temps MM:SS)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  useSharedValue,
  useAnimatedReaction,
  Easing,
} from 'react-native-reanimated';

interface TimerRingProps {
  /** 0 → 1, fraction du temps restant */
  progress: number;
  /** Temps restant en secondes (pour déterminer l'urgence) */
  remaining: number;
  /** Taille du cercle en px */
  size: number;
  /** Couleurs sémantiques */
  colorNormal: string;
  colorWarning: string;
  colorDanger: string;
  /** Couleur de la piste */
  trackColor: string;
  /** Couleur de fond interne */
  bgColor: string;
  /** Contenu central (affichage temps) */
  children?: React.ReactNode;
}

export default function TimerRing({
  progress,
  remaining,
  size,
  colorNormal,
  colorWarning,
  colorDanger,
  trackColor,
  bgColor,
  children,
}: TimerRingProps) {
  const strokeWidth = 8;
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const ringColor = remaining <= 10 ? colorDanger : remaining <= 30 ? colorWarning : colorNormal;
  const isUrgent = remaining <= 10;

  // Pulse animation quand le temps est critique
  useAnimatedReaction(
    () => isUrgent,
    (urgent, prev) => {
      if (urgent && !prev) {
        pulseScale.value = withRepeat(
          withSequence(
            withTiming(1.06, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          true,
        );
        glowOpacity.value = withRepeat(
          withSequence(
            withTiming(0.4, { duration: 400 }),
            withTiming(0.1, { duration: 400 }),
          ),
          -1,
          true,
        );
      } else if (!urgent && prev) {
        pulseScale.value = withSpring(1);
        glowOpacity.value = withTiming(0);
      }
    },
    [isUrgent],
  );

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, { width: size, height: size }, pulseStyle]}>
      {/* Glow effect (urgent) */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: size + 20,
            height: size + 20,
            borderRadius: (size + 20) / 2,
            backgroundColor: colorDanger,
          },
          glowStyle,
        ]}
      />

      {/* Track circle */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: trackColor,
          },
        ]}
      />

      {/* Active ring */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: ringColor,
            opacity: progress,
          },
        ]}
      />

      {/* Inner bg */}
      <View
        style={[
          styles.inner,
          {
            width: size - strokeWidth * 2 - 4,
            height: size - strokeWidth * 2 - 4,
            borderRadius: (size - strokeWidth * 2 - 4) / 2,
            backgroundColor: bgColor,
          },
        ]}
      />

      {/* Center content */}
      <View style={styles.content}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
  },
  ring: {
    position: 'absolute',
  },
  inner: {
    position: 'absolute',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
