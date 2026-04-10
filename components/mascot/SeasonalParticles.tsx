/**
 * SeasonalParticles.tsx — Overlay de particules saisonnières sur le diorama
 *
 * Affiche des particules emoji correspondant à la saison réelle :
 * - Printemps : fleurs de cerisier 🌸 tombantes
 * - Été : étoiles scintillantes ✨ flottantes
 * - Automne : feuilles mortes 🍂 tombantes
 * - Hiver : flocons de neige ❄️ tombants
 *
 * Respecte useReducedMotion — désactive les animations si Reduce Motion est actif.
 * Réduit automatiquement le count de 50% quand des particules horaires sont actives
 * pour éviter la surcharge visuelle.
 * pointerEvents="none" pour ne pas intercepter les touches.
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
import { SEASONAL_PARTICLES, type Season, type SeasonalParticle } from '../../lib/mascot/seasons';
import { getTimeSlot, AMBIENT_CONFIGS } from '../../lib/mascot/ambiance';

interface SeasonalParticlesProps {
  season: Season;
  containerHeight: number;
  paused?: boolean;
}

interface SeasonalParticleItemProps {
  config: SeasonalParticle;
  index: number;
  containerHeight: number;
  containerWidth: number;
}

const SPEED_DURATION: Record<SeasonalParticle['speed'], number> = {
  slow: 12000,
  normal: 8000,
  fast: 5000,
};

function SeasonalParticleItem({ config, index, containerHeight, containerWidth }: SeasonalParticleItemProps) {
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);

  const startX = useMemo(() => (index * 47 + 23) % containerWidth, [index, containerWidth]);
  const startY = useMemo(() => {
    if (config.direction === 'down') return -20;
    // Float : distribuer entre 10% et 70% de la hauteur
    return ((index * 61 + 11) % (containerHeight * 0.6)) + containerHeight * 0.1;
  }, [index, containerHeight, config.direction]);

  useEffect(() => {
    if (reducedMotion) return;

    const duration = SPEED_DURATION[config.speed];
    const delay = index * 4000 + Math.random() * 3000;

    if (config.direction === 'down') {
      // Chute saisonnière
      translateY.value = withDelay(
        delay,
        withRepeat(
          withTiming(containerHeight + 20, { duration, easing: Easing.linear }),
          -1,
          false,
        ),
      );
      // Wobble horizontal léger ±12px
      translateX.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(12, { duration: duration * 0.5, easing: Easing.inOut(Easing.sin) }),
            withTiming(-12, { duration: duration * 0.5, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
    } else {
      // Flottement (étoiles d'été)
      translateY.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-15, { duration, easing: Easing.inOut(Easing.sin) }),
            withTiming(15, { duration, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
      // Dérive horizontale légère ±12px
      translateX.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(12, { duration: duration * 0.8, easing: Easing.inOut(Easing.sin) }),
            withTiming(-12, { duration: duration * 0.8, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
    }

    // Fade in → visible → fade out → longue pause invisible
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.5, { duration: 2000, easing: Easing.in(Easing.ease) }),    // fade in
          withTiming(0.5, { duration: duration * 0.3 }),                            // visible
          withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }),       // fade out
          withTiming(0, { duration: duration * 0.7 }),                              // invisible longtemps
        ),
        -1,
      ),
    );
  }, [reducedMotion]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
    ],
    opacity: opacity.value,
  }));

  if (reducedMotion) return null;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: startX,
          top: startY,
        },
        animStyle,
      ]}
    >
      <Text style={styles.particleEmoji}>{config.emoji}</Text>
    </Animated.View>
  );
}

export function SeasonalParticles({ season, containerHeight, paused = false }: SeasonalParticlesProps) {
  const reducedMotion = useReducedMotion();

  // Largeur approximative — même convention que AmbientParticles
  const containerWidth = 390;

  const config = SEASONAL_PARTICLES[season];

  // Réduction de count quand particules horaires actives (Pitfall 1)
  // Évite la surcharge visuelle quand lucioles de nuit + flocons d'hiver
  const effectiveCount = useMemo(() => {
    const timeSlot = getTimeSlot();
    const ambientActive = AMBIENT_CONFIGS[timeSlot] !== null;
    return ambientActive ? Math.ceil(config.count / 2) : config.count;
  }, [config.count]);

  if (reducedMotion || paused) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: effectiveCount }).map((_, i) => (
        <SeasonalParticleItem
          key={`sp-${season}-${i}`}
          config={config}
          index={i}
          containerHeight={containerHeight}
          containerWidth={containerWidth}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particleEmoji: {
    fontSize: 16,
  },
});
