/**
 * AmbientParticles.tsx — Overlay de particules ambiantes sur le diorama
 *
 * Affiche des particules selon le moment de la journee :
 * - Matin (05h-08h59) : rosee bleu clair tombante
 * - Soir (19h-20h59) : particules ambre flottantes
 * - Nuit (21h-04h59) : lucioles vert-jaune pulsantes
 * - Jour (09h-18h59) : rien
 *
 * Re-evalue le slot toutes les 60 secondes et anime la transition de couleur
 * overlay avec withTiming(2000) pour un fondu progressif.
 *
 * Respecte useReducedMotion — desactive les animations si Reduce Motion est active.
 * pointerEvents="none" pour ne pas intercepter les touches.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
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
import { getTimeSlot, AMBIENT_CONFIGS, type AmbiantConfig } from '../../lib/mascot/ambiance';

interface AmbientParticlesProps {
  containerHeight: number;
  paused?: boolean;
}

interface ParticleProps {
  config: AmbiantConfig;
  index: number;
  containerHeight: number;
  containerWidth: number;
}

/** Parse une couleur rgba(...) en composantes numeriques */
function parseRgba(color: string): { r: number; g: number; b: number; a: number } {
  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!match) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
    a: match[4] !== undefined ? parseFloat(match[4]) : 1,
  };
}

function AmbientParticle({ config, index, containerHeight, containerWidth }: ParticleProps) {
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);

  const startX = useMemo(() => (index * 47 + 23) % containerWidth, [index, containerWidth]);
  const startY = useMemo(() => {
    if (config.direction === 'down') return -20;
    return ((index * 61 + 11) % (containerHeight * 0.6)) + containerHeight * 0.1;
  }, [index, containerHeight, config.direction]);

  useEffect(() => {
    if (reducedMotion) return;

    const delay = index * 600;

    if (config.direction === 'down') {
      // Chute (rosee du matin)
      translateY.value = withDelay(
        delay,
        withRepeat(
          withTiming(containerHeight + 20, { duration: config.duration, easing: Easing.linear }),
          -1,
          false,
        ),
      );
      // Wobble horizontal leger
      translateX.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(10, { duration: config.duration * 0.5, easing: Easing.inOut(Easing.sin) }),
            withTiming(-10, { duration: config.duration * 0.5, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
    } else {
      // Flottement (lucioles nuit, soir)
      translateY.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-15, { duration: config.duration, easing: Easing.inOut(Easing.sin) }),
            withTiming(15, { duration: config.duration, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
      // Derive horizontale lente
      translateX.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(12 + (index % 3) * 4, { duration: config.duration * 0.8, easing: Easing.inOut(Easing.sin) }),
            withTiming(-12 - (index % 3) * 4, { duration: config.duration * 0.8, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
    }

    // Opacity pulse
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(config.opacity, { duration: config.duration * 0.4 }),
          withTiming(config.opacity * 0.3, { duration: config.duration * 0.6 }),
        ),
        -1,
        true,
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

  // Glow pour les lucioles (nuit, direction float)
  const isFirefly = config.direction === 'float' && config.particleColor === '#AAFF66';
  const glowStyle = isFirefly
    ? {
        shadowColor: config.particleColor,
        shadowRadius: 4,
        shadowOpacity: 0.8,
        shadowOffset: { width: 0, height: 0 },
      }
    : {};

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
      <View
        style={[
          {
            width: config.particleSize * 2,
            height: config.particleSize * 2,
            borderRadius: config.particleSize,
            backgroundColor: config.particleColor,
          },
          glowStyle,
        ]}
      />
    </Animated.View>
  );
}

export function AmbientParticles({ containerHeight, paused = false }: AmbientParticlesProps) {
  const [timeSlot, setTimeSlot] = useState(() => getTimeSlot());
  const config = AMBIENT_CONFIGS[timeSlot];
  const reducedMotion = useReducedMotion();

  // Largeur approximative — utilise une valeur generique car on est absoluteFill
  const containerWidth = 390;

  // Re-polling toutes les 60 secondes pour detecter les changements de slot horaire
  // Désactivé quand l'app est en background (paused)
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      const newSlot = getTimeSlot();
      setTimeSlot(prev => prev === newSlot ? prev : newSlot);
    }, 60_000);
    return () => clearInterval(interval);
  }, [paused]);

  // Shared values pour l'overlay anime (R, G, B, A)
  const overlayR = useSharedValue(0);
  const overlayG = useSharedValue(0);
  const overlayB = useSharedValue(0);
  const overlayA = useSharedValue(0);

  // Animer la transition de couleur quand le slot change
  useEffect(() => {
    const overlay = config?.colorOverlay ?? null;
    const target = overlay ? parseRgba(overlay) : { r: 0, g: 0, b: 0, a: 0 };
    const duration = 2000;

    if (reducedMotion) {
      // Transition instantanee si Reduce Motion est active
      overlayR.value = target.r;
      overlayG.value = target.g;
      overlayB.value = target.b;
      overlayA.value = target.a;
    } else {
      overlayR.value = withTiming(target.r, { duration });
      overlayG.value = withTiming(target.g, { duration });
      overlayB.value = withTiming(target.b, { duration });
      overlayA.value = withTiming(target.a, { duration });
    }
  }, [timeSlot, reducedMotion]);

  const overlayAnimStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(${Math.round(overlayR.value)}, ${Math.round(overlayG.value)}, ${Math.round(overlayB.value)}, ${overlayA.value})`,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Tint colore anime — toujours rendu, opacite 0 pour le slot jour */}
      <Animated.View style={[StyleSheet.absoluteFill, overlayAnimStyle]} />

      {/* Particules animees — desactivees si Reduce Motion, slot jour ou paused */}
      {!reducedMotion && !paused && config !== null &&
        Array.from({ length: config.particleCount }).map((_, i) => (
          <AmbientParticle
            key={`ap-${i}`}
            config={config}
            index={i}
            containerHeight={containerHeight}
            containerWidth={containerWidth}
          />
        ))}
    </View>
  );
}
