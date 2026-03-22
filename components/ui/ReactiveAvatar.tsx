/**
 * ReactiveAvatar.tsx — Avatar qui réagit au contexte
 *
 * Respire (idle), sautille (loot dispo), danse (tout fini),
 * dort (nuit), tremble (retard), s'étire (matin).
 */

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

export type AvatarMood = 'idle' | 'loot' | 'allDone' | 'night' | 'overdue' | 'morning';

interface ReactiveAvatarProps {
  emoji: string;
  mood: AvatarMood;
  style?: ViewStyle;
}

/** Détermine le mood automatiquement à partir du contexte */
export function getAvatarMood({
  hour,
  hasLoot,
  allTasksDone,
  hasOverdue,
}: {
  hour: number;
  hasLoot: boolean;
  allTasksDone: boolean;
  hasOverdue: boolean;
}): AvatarMood {
  // Priorité : nuit > allDone > loot > overdue > matin > idle
  if (hour >= 22 || hour < 5) return 'night';
  if (allTasksDone) return 'allDone';
  if (hasLoot) return 'loot';
  if (hasOverdue) return 'overdue';
  if (hour >= 5 && hour < 8) return 'morning';
  return 'idle';
}

export function ReactiveAvatar({ emoji, mood, style }: ReactiveAvatarProps) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scaleY = useSharedValue(1);

  useEffect(() => {
    // Reset
    cancelAnimation(scale);
    cancelAnimation(translateY);
    cancelAnimation(translateX);
    cancelAnimation(rotate);
    cancelAnimation(scaleY);
    scale.value = 1;
    translateY.value = 0;
    translateX.value = 0;
    rotate.value = 0;
    scaleY.value = 1;

    switch (mood) {
      case 'idle':
        // Respiration douce
        scale.value = withRepeat(
          withSequence(
            withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          ),
          -1, true,
        );
        break;

      case 'loot':
        // Sautille
        translateY.value = withRepeat(
          withSequence(
            withTiming(-5, { duration: 200, easing: Easing.out(Easing.cubic) }),
            withSpring(0, { damping: 6, stiffness: 200 }),
            withTiming(0, { duration: 600 }),
          ),
          -1,
        );
        rotate.value = withRepeat(
          withSequence(
            withTiming(-3, { duration: 200 }),
            withTiming(3, { duration: 200 }),
            withTiming(0, { duration: 200 }),
            withTiming(0, { duration: 600 }),
          ),
          -1,
        );
        break;

      case 'allDone':
        // Danse
        scale.value = withRepeat(
          withSequence(
            withSpring(1.12, { damping: 4, stiffness: 150 }),
            withSpring(1, { damping: 6, stiffness: 150 }),
          ),
          -1,
        );
        rotate.value = withRepeat(
          withSequence(
            withTiming(-10, { duration: 200, easing: Easing.out(Easing.cubic) }),
            withTiming(10, { duration: 200, easing: Easing.out(Easing.cubic) }),
            withTiming(-6, { duration: 150 }),
            withTiming(6, { duration: 150 }),
            withTiming(0, { duration: 200 }),
          ),
          -1,
        );
        break;

      case 'night':
        // Dort — bascule lentement
        rotate.value = withRepeat(
          withSequence(
            withTiming(-10, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            withTiming(-6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          ),
          -1, true,
        );
        scale.value = withRepeat(
          withSequence(
            withTiming(0.93, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.96, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          ),
          -1, true,
        );
        break;

      case 'overdue':
        // Tremble
        translateX.value = withRepeat(
          withSequence(
            withTiming(-1.5, { duration: 50 }),
            withTiming(1.5, { duration: 50 }),
            withTiming(-1, { duration: 50 }),
            withTiming(1, { duration: 50 }),
            withTiming(0, { duration: 50 }),
            withTiming(0, { duration: 400 }),
          ),
          -1,
        );
        break;

      case 'morning':
        // S'étire
        scaleY.value = withRepeat(
          withSequence(
            withTiming(1.12, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.95, { duration: 800, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
        );
        break;
    }
  }, [mood]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { scaleY: scaleY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.Text style={[styles.emoji, style as any, animStyle]}>
      {emoji}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  emoji: {
    fontSize: 28,
  },
});
