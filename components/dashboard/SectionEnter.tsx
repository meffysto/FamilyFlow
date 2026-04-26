/**
 * SectionEnter.tsx — Wrapper d'entrée animée des sections dashboard.
 *
 * Fade + translateY au mount, avec stagger basé sur `index`.
 * Mount-only : ne se rejoue pas lors d'un re-render (refresh, vault update).
 * Respecte useReducedMotion : aucune anim si l'utilisateur l'a désactivée.
 */

import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';

const ENTER_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const STAGGER_MS = 35;
const DURATION_MS = 360;
const TRAVEL = 10;

interface Props {
  index: number;
  children: React.ReactNode;
}

export function SectionEnter({ index, children }: Props) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateY = useSharedValue(reduceMotion ? 0 : TRAVEL);

  useEffect(() => {
    if (reduceMotion) return;
    const delay = index * STAGGER_MS;
    opacity.value = withDelay(delay, withTiming(1, { duration: DURATION_MS, easing: ENTER_EASING }));
    translateY.value = withDelay(delay, withTiming(0, { duration: DURATION_MS, easing: ENTER_EASING }));
    // mount-only — pas de dépendance index, déclenché une fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
