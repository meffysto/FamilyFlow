/**
 * ReactiveAvatar.tsx — Avatar qui réagit au contexte
 *
 * Respire (idle), sautille (loot dispo), danse (tout fini),
 * dort (nuit), tremble (retard), s'étire (matin).
 *
 * Les animations s'arrêtent après un temps pour ne pas être pénibles.
 * idle/night : continu (subtil). loot : 8s. allDone : 5s. overdue : 3s. morning : 6s.
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  cancelAnimation,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';

export type AvatarMood = 'idle' | 'loot' | 'allDone' | 'night' | 'overdue' | 'morning';

interface ReactiveAvatarProps {
  emoji: string;
  mood: AvatarMood;
  style?: ViewStyle;
}

// Durée avant arrêt de l'animation (ms). -1 = continu.
// Note : idle/night limités à 5s (welcome pulse) pour économiser la batterie —
// sinon le display link reste à 120Hz en permanence sur le dashboard.
const MOOD_DURATION: Record<AvatarMood, number> = {
  idle: 5000,   // respiration 5s puis calme (welcome pulse)
  night: 5000,  // dort 5s puis calme
  loot: 8000,   // sautille 8s puis calme
  allDone: 5000, // danse 5s puis calme
  overdue: 3000, // tremble 3s puis calme
  morning: 6000, // s'étire 6s puis calme
};

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
  if (hour >= 22 || hour < 5) return 'night';
  if (allTasksDone) return 'allDone';
  if (hasLoot) return 'loot';
  if (hasOverdue) return 'overdue';
  if (hour >= 5 && hour < 8) return 'morning';
  return 'idle';
}

function resetAll(
  scale: SharedValue<number>,
  translateY: SharedValue<number>,
  translateX: SharedValue<number>,
  rotate: SharedValue<number>,
  scaleY: SharedValue<number>,
) {
  cancelAnimation(scale);
  cancelAnimation(translateY);
  cancelAnimation(translateX);
  cancelAnimation(rotate);
  cancelAnimation(scaleY);
  scale.value = withTiming(1, { duration: 300 });
  translateY.value = withTiming(0, { duration: 300 });
  translateX.value = withTiming(0, { duration: 300 });
  rotate.value = withTiming(0, { duration: 300 });
  scaleY.value = withTiming(1, { duration: 300 });
}

export function ReactiveAvatar({ emoji, mood, style }: ReactiveAvatarProps) {
  const isFocused = useIsFocused();
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scaleY = useSharedValue(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current);

    // Reset to neutral
    resetAll(scale, translateY, translateX, rotate, scaleY);

    // Stop quand écran pas focus (économie batterie)
    if (!isFocused) return;

    // Petit délai pour laisser le reset finir
    const startTimer = setTimeout(() => {
      switch (mood) {
        case 'idle':
          scale.value = withRepeat(
            withSequence(
              withTiming(1.12, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
              withTiming(0.95, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            ),
            -1, true,
          );
          translateY.value = withRepeat(
            withSequence(
              withTiming(-2, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
              withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            ),
            -1, true,
          );
          break;

        case 'loot':
          translateY.value = withRepeat(
            withSequence(
              withTiming(-4, { duration: 200, easing: Easing.out(Easing.cubic) }),
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
          scale.value = withRepeat(
            withSequence(
              withSpring(1.1, { damping: 5, stiffness: 150 }),
              withSpring(1, { damping: 6, stiffness: 150 }),
            ),
            -1,
          );
          rotate.value = withRepeat(
            withSequence(
              withTiming(-8, { duration: 200, easing: Easing.out(Easing.cubic) }),
              withTiming(8, { duration: 200, easing: Easing.out(Easing.cubic) }),
              withTiming(-4, { duration: 150 }),
              withTiming(4, { duration: 150 }),
              withTiming(0, { duration: 200 }),
            ),
            -1,
          );
          break;

        case 'night':
          rotate.value = withRepeat(
            withSequence(
              withTiming(-8, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
              withTiming(-5, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
            ),
            -1, true,
          );
          scale.value = withRepeat(
            withSequence(
              withTiming(0.94, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
              withTiming(0.97, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
            ),
            -1, true,
          );
          break;

        case 'overdue':
          translateX.value = withRepeat(
            withSequence(
              withTiming(-1.5, { duration: 50 }),
              withTiming(1.5, { duration: 50 }),
              withTiming(-1, { duration: 50 }),
              withTiming(1, { duration: 50 }),
              withTiming(0, { duration: 50 }),
              withTiming(0, { duration: 500 }),
            ),
            -1,
          );
          break;

        case 'morning':
          scaleY.value = withRepeat(
            withSequence(
              withTiming(1.1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
              withTiming(0.96, { duration: 800, easing: Easing.inOut(Easing.ease) }),
              withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
          );
          break;
      }

      // Auto-stop après le timeout (sauf idle et night qui restent)
      const duration = MOOD_DURATION[mood];
      if (duration > 0) {
        timerRef.current = setTimeout(() => {
          resetAll(scale, translateY, translateX, rotate, scaleY);
        }, duration);
      }
    }, 350);

    return () => {
      clearTimeout(startTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
      resetAll(scale, translateY, translateX, rotate, scaleY);
    };
  }, [mood, isFocused]);

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
    fontSize: 22,
  },
});
