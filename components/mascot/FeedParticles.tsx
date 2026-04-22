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

const PARTICLE_COUNT = 8;
const FLOAT_DISTANCE = -120;
const DURATION_MS = 1600;
const FADE_OUT_MS = 500;

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
  // 8 offsets horizontaux répartis en éventail large autour du centre
  const offsets = [-60, -40, -22, -8, 10, 24, 42, 62];
  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* Container centré sur le point émetteur — bounded mais overflow visible */}
      <View style={[styles.emitter, { left: x - 80, top: y - 20 }]} pointerEvents="none">
        {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
          <Particle
            key={`${affinity}-${i}`}
            emoji={emoji}
            delay={i * 80}
            offsetX={80 + (offsets[i] ?? 0)}
            onLastEnd={i === PARTICLE_COUNT - 1 ? onEnd : undefined}
          />
        ))}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
    zIndex: 999,
    elevation: 999,
  },
  emitter: {
    position: 'absolute',
    width: 160,
    height: 40,
    overflow: 'visible',
  },
  particle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  emoji: {
    fontSize: 32,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
