/**
 * HarvestBurst.tsx — Animation de recolte (particules + label reward)
 *
 * Affiche un burst de particules colorees + "+X 🍃" flottant
 * quand une culture mature est recoltee.
 *
 * Phase 21 : prop `variant` optionnelle pour contrôler taille/couleur/durée
 * des particules selon la catégorie sémantique de la tâche.
 */

import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { HarvestBurstVariant } from '../../lib/semantic/effect-toasts';

const PARTICLE_COUNT = 8;
const PARTICLE_SIZE = 6;

/** Couleur dominante par culture */
export const CROP_COLORS: Record<string, string> = {
  carrot: '#F97316',
  wheat: '#EAB308',
  tomato: '#EF4444',
  strawberry: '#EC4899',
  potato: '#A3A3A3',
  corn: '#FCD34D',
  pumpkin: '#F97316',
  cabbage: '#4ADE80',
  beetroot: '#BE185D',
  cucumber: '#22C55E',
};

/**
 * VARIANT_CONFIG — paramètres visuels par variant.
 * ambient : comportement par défaut (8 particules vertes)
 * rare    : 10 particules violettes, légèrement plus amples
 * golden  : 12 particules dorées, plus grandes et plus amples
 */
export const VARIANT_CONFIG: Record<HarvestBurstVariant, {
  particleCount: number;
  particleSize: number;
  travelMin: number;
  travelMax: number;
  labelTravelY: number;
  labelDuration: number;
  labelColor: string;
  particleColor: string;
}> = {
  ambient: {
    particleCount: 8,
    particleSize: 6,
    travelMin: 25,
    travelMax: 45,
    labelTravelY: -45,
    labelDuration: 480,
    labelColor: '#A7F3D0',
    particleColor: '#34D399',
  },
  rare: {
    particleCount: 10,
    particleSize: 6,
    travelMin: 30,
    travelMax: 50,
    labelTravelY: -50,
    labelDuration: 530,
    labelColor: '#C4B5FD',
    particleColor: '#A78BFA',
  },
  golden: {
    particleCount: 12,
    particleSize: 8,
    travelMin: 35,
    travelMax: 60,
    labelTravelY: -60,
    labelDuration: 580,
    labelColor: '#FFD700',
    particleColor: '#FFD700',
  },
};

// Re-export du type pour les consommateurs
export type { HarvestBurstVariant };

interface HarvestBurstProps {
  x: number;
  y: number;
  reward: number;
  cropColor: string;
  onComplete: () => void;
  /** Phase 21 — variant optionnel : contrôle particules/couleur/durée */
  variant?: HarvestBurstVariant;
}

function Particle({
  color,
  index,
  startX,
  startY,
  particleSize,
  particleCount,
  travelMin,
  travelMax,
}: {
  color: string;
  index: number;
  startX: number;
  startY: number;
  particleSize: number;
  particleCount: number;
  travelMin: number;
  travelMax: number;
}) {
  const angle = (index / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
  const distance = travelMin + Math.random() * (travelMax - travelMin);
  const targetX = Math.cos(angle) * distance;
  const targetY = Math.sin(angle) * distance - 15; // bias vers le haut

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    translateX.value = withSpring(targetX, { damping: 10, stiffness: 160 });
    translateY.value = withSpring(targetY, { damping: 10, stiffness: 160 });
    opacity.value = withDelay(100, withTiming(0, { duration: 260 }));
    scale.value = withDelay(60, withTiming(0.3, { duration: 260 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: startX - particleSize / 2,
          top: startY - particleSize / 2,
          width: particleSize,
          height: particleSize,
          borderRadius: particleSize / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export function HarvestBurst({ x, y, reward, cropColor, onComplete, variant }: HarvestBurstProps) {
  const cfg = variant ? VARIANT_CONFIG[variant] : null;
  const effectiveParticleCount = cfg?.particleCount ?? PARTICLE_COUNT;
  const effectiveParticleSize = cfg?.particleSize ?? PARTICLE_SIZE;
  const effectiveColor = cfg?.particleColor ?? cropColor;
  const effectiveTravelMin = cfg?.travelMin ?? 25;
  const effectiveTravelMax = cfg?.travelMax ?? 45;
  const effectiveLabelTravelY = cfg?.labelTravelY ?? -45;
  const effectiveLabelDuration = cfg?.labelDuration ?? 800;
  const effectiveLabelColor = cfg?.labelColor ?? '#FFD700';

  const labelY = useSharedValue(0);
  const labelOpacity = useSharedValue(1);
  const shakeX = useSharedValue(0);

  const triggerComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    // Haptic shake
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Shake wobble
    shakeX.value = withSequence(
      withTiming(4, { duration: 60 }),
      withTiming(-4, { duration: 60 }),
      withTiming(3, { duration: 60 }),
      withTiming(-3, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );

    // Label float up
    labelY.value = withTiming(effectiveLabelTravelY, { duration: effectiveLabelDuration, easing: Easing.out(Easing.quad) });
    labelOpacity.value = withDelay(200, withTiming(0, { duration: 260 }));

    // Success haptic after burst
    setTimeout(() => {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 300);

    // Callback after animation
    setTimeout(() => runOnJS(triggerComplete)(), (cfg?.labelDuration ?? 480) + 60);
  }, []);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: labelY.value }],
    opacity: labelOpacity.value,
  }));

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]} pointerEvents="none">
      {/* Shake container */}
      <Animated.View style={[{ position: 'absolute', left: x, top: y }, shakeStyle]}>
        {/* Particules */}
        {Array.from({ length: effectiveParticleCount }).map((_, i) => (
          <Particle
            key={i}
            color={effectiveColor}
            index={i}
            startX={0}
            startY={0}
            particleSize={effectiveParticleSize}
            particleCount={effectiveParticleCount}
            travelMin={effectiveTravelMin}
            travelMax={effectiveTravelMax}
          />
        ))}
      </Animated.View>

      {/* Label reward flottant */}
      <Animated.View style={[{ position: 'absolute', left: x - 30, top: y - 10 }, labelStyle]}>
        <Text style={[styles.rewardLabel, { color: effectiveLabelColor }]}>
          +{reward} 🍃
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  rewardLabel: {
    fontSize: 16,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center',
    width: 60,
  },
});
