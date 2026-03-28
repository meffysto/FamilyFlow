/**
 * StreakFlames.tsx — Flammes de streak sous le diorama
 *
 * Affiche des flammes animees selon l'intensite du streak du profil.
 * Tiers bases sur STREAK_MILESTONES depuis lib/gamification/engine.
 *
 * - streak < 2  : rien (seuil minimum du dernier palier)
 * - streak >= 2  : tier 1 (1 flamme)
 * - streak >= 7  : tier 2 (2 flammes)
 * - streak >= 14 : tier 3 (3 flammes)
 * - streak >= 30 : tier 4 (4 flammes, derniere = 💎)
 *
 * Respecte useReducedMotion — render statique si Reduce Motion est active.
 */

import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { STREAK_MILESTONES } from '../../lib/gamification/engine';
import { Spacing } from '../../constants/spacing';

interface StreakFlamesProps {
  streak: number;
}

interface FlameItemProps {
  tier: number;
  index: number;
  isLast: boolean;
}

function FlameItem({ tier, index, isLast }: FlameItemProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.8);

  const animDuration = 400 + tier * 100;
  const emoji = isLast && tier >= 4 ? '💎' : '🔥';
  const fontSize = 18 + tier * 4;

  useEffect(() => {
    if (reducedMotion) return;

    const delay = index * 200;
    const maxScale = 1.0 + tier * 0.08;

    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(maxScale, { duration: animDuration, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.9, { duration: animDuration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );

    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.0, { duration: animDuration }),
          withTiming(0.6, { duration: animDuration }),
        ),
        -1,
        true,
      ),
    );
  }, [reducedMotion]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animStyle}>
      <Text style={{ fontSize }}>{emoji}</Text>
    </Animated.View>
  );
}

export function StreakFlames({ streak }: StreakFlamesProps) {
  // Seuil minimum = dernier element du tableau (trie decroissant par days)
  const minDays = STREAK_MILESTONES[STREAK_MILESTONES.length - 1].days;

  if (streak < minDays) {
    return null;
  }

  // Determine le tier en cherchant le premier palier atteint (tableau trie decroissant)
  const milestoneIdx = STREAK_MILESTONES.findIndex(m => streak >= m.days);
  if (milestoneIdx === -1) {
    return null;
  }

  // tier 4 = index 0 = 30+ jours, tier 1 = index 3 = 2+ jours
  const tier = STREAK_MILESTONES.length - milestoneIdx;

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
        marginVertical: Spacing.sm,
      }}
    >
      {Array.from({ length: tier }).map((_, i) => (
        <FlameItem
          key={`flame-${i}`}
          tier={tier}
          index={i}
          isLast={i === tier - 1}
        />
      ))}
    </View>
  );
}
