/**
 * HarvestBurst.tsx — Animation de recolte (particules + label reward)
 *
 * Affiche un burst de particules colorees + "+X 🍃" flottant
 * quand une culture mature est recoltee.
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

interface HarvestBurstProps {
  x: number;
  y: number;
  reward: number;
  cropColor: string;
  onComplete: () => void;
}

function Particle({ color, index, startX, startY }: { color: string; index: number; startX: number; startY: number }) {
  const angle = (index / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
  const distance = 25 + Math.random() * 20;
  const targetX = Math.cos(angle) * distance;
  const targetY = Math.sin(angle) * distance - 15; // bias vers le haut

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    translateX.value = withSpring(targetX, { damping: 8, stiffness: 80 });
    translateY.value = withSpring(targetY, { damping: 8, stiffness: 80 });
    opacity.value = withDelay(200, withTiming(0, { duration: 400 }));
    scale.value = withDelay(100, withTiming(0.3, { duration: 400 }));
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
          left: startX - PARTICLE_SIZE / 2,
          top: startY - PARTICLE_SIZE / 2,
          width: PARTICLE_SIZE,
          height: PARTICLE_SIZE,
          borderRadius: PARTICLE_SIZE / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export function HarvestBurst({ x, y, reward, cropColor, onComplete }: HarvestBurstProps) {
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
    labelY.value = withTiming(-45, { duration: 800, easing: Easing.out(Easing.quad) });
    labelOpacity.value = withDelay(400, withTiming(0, { duration: 400 }));

    // Success haptic after burst
    setTimeout(() => {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 300);

    // Callback after animation
    setTimeout(() => runOnJS(triggerComplete)(), 900);
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
        {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
          <Particle key={i} color={cropColor} index={i} startX={0} startY={0} />
        ))}
      </Animated.View>

      {/* Label reward flottant */}
      <Animated.View style={[{ position: 'absolute', left: x - 30, top: y - 10 }, labelStyle]}>
        <Text style={styles.rewardLabel}>
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
    color: '#FFD700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center',
    width: 60,
  },
});
