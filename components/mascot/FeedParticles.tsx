/**
 * FeedParticles.tsx — Particules emoji flottantes après feed (Phase 42 D-19)
 *
 * Affiche 5 emojis qui montent de -60px avec fade-out sur 1200ms.
 * Emoji dépend de l'affinité : préféré = cœurs 💕, neutre = bulles 😊, détesté = vent 💨.
 * Overlay absolute positionné (pointerEvents='none') — n'intercepte aucun tap.
 *
 * Usage :
 *   <FeedParticles
 *     visible={!!feedState}
 *     affinity={feedState ? (feedState.replace('eating-', '') as CropAffinity) : 'neutral'}
 *     x={spriteX}
 *     y={spriteY}
 *   />
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import type { CropAffinity } from '../../lib/mascot/companion-types';

// ── Constantes ────────────────────────────────────────

const AFFINITY_EMOJI: Record<CropAffinity, string> = {
  preferred: '💕',
  neutral:   '😊',
  hated:     '💨',
};

const PARTICLE_COUNT = 5;
const FLOAT_DISTANCE = -60;
const DURATION_MS = 1200;
const FADE_OUT_MS = 400;

// ── Props ─────────────────────────────────────────────

interface FeedParticlesProps {
  visible: boolean;
  affinity: CropAffinity;
  x: number;
  y: number;
  onEnd?: () => void;
}

// ── Particule individuelle ───────────────────────────

interface ParticleProps {
  emoji: string;
  delay: number;
  offsetX: number;
  onLastEnd?: () => void;
}

function Particle({ emoji, delay, offsetX, onLastEnd }: ParticleProps) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Fade-in rapide
    opacity.value = withDelay(delay, withTiming(1, { duration: 100 }));
    // Float-up sur toute la durée
    translateY.value = withDelay(
      delay,
      withTiming(FLOAT_DISTANCE, { duration: DURATION_MS, easing: Easing.out(Easing.quad) }),
    );
    // Fade-out final
    opacity.value = withDelay(
      delay + DURATION_MS - FADE_OUT_MS,
      withTiming(0, { duration: FADE_OUT_MS }, (finished) => {
        if (finished && onLastEnd) runOnJS(onLastEnd)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX },
      { translateY: translateY.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.particle, style]} pointerEvents="none">
      <Text style={styles.emoji}>{emoji}</Text>
    </Animated.View>
  );
}

// ── Composant principal ───────────────────────────────

export function FeedParticles({ visible, affinity, x, y, onEnd }: FeedParticlesProps) {
  if (!visible) return null;
  const emoji = AFFINITY_EMOJI[affinity];
  // Offsets horizontaux dispersés autour du point central
  const offsets = [-24, -12, 0, 12, 24];
  return (
    <View style={[styles.container, { left: x, top: y }]} pointerEvents="none">
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
        <Particle
          key={`${affinity}-${i}`}
          emoji={emoji}
          delay={i * 60}
          offsetX={offsets[i] ?? 0}
          onLastEnd={i === PARTICLE_COUNT - 1 ? onEnd : undefined}
        />
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  particle: {
    position: 'absolute',
  },
  emoji: {
    fontSize: 20,
  },
});
