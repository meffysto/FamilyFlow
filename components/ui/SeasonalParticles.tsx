/**
 * SeasonalParticles.tsx — Particules saisonnières flottantes
 *
 * Flocons en hiver, pétales au printemps, lucioles en été, feuilles en automne.
 * 6-8 particules max, très lent, très subtil.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  cancelAnimation,
  useReducedMotion,
  Easing,
} from 'react-native-reanimated';

type Season = 'winter' | 'spring' | 'summer' | 'autumn';

const SEASON_CONFIG: Record<Season, { chars: string[]; opacity: number }> = {
  winter: { chars: ['❄', '❄️', '❄', '✦', '❄', '❄️', '✧'], opacity: 0.4 },
  spring: { chars: ['🌸', '🌸', '🌸', '🌸', '🌸', '🌸'], opacity: 0.45 },
  summer: { chars: ['✦', '✧', '✦', '✧', '✦', '✧', '✦'], opacity: 0.35 },
  autumn: { chars: ['🍂', '🍁', '🍂', '🍁', '🍂', '🍁'], opacity: 0.4 },
};

/** Retourne la saison basée sur le mois */
export function getCurrentSeason(): Season {
  const month = new Date().getMonth(); // 0-11
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

interface ParticleConfig {
  char: string;
  startX: number; // % from left
  startY: number; // % from top
  size: number;
  delay: number;
  driftX: number;
  driftY: number;
  duration: number;
  rotation: number;
}

function generateParticles(season: Season): ParticleConfig[] {
  const config = SEASON_CONFIG[season];
  return config.chars.map((char, i) => ({
    char,
    startX: 5 + (i * 14) + (i % 2 === 0 ? 3 : -3), // réparti sur la largeur
    startY: 10 + Math.random() * 60,
    size: season === 'summer' ? 6 + Math.random() * 4 : 10 + Math.random() * 6,
    delay: i * 800,
    driftX: 20 + Math.random() * 30,
    driftY: season === 'summer' ? 10 + Math.random() * 15 : 20 + Math.random() * 20,
    duration: 8000 + Math.random() * 6000,
    rotation: (Math.random() - 0.5) * 60,
  }));
}

function Particle({ config, opacity, season }: { config: ParticleConfig; opacity: number; season: Season }) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(season === 'summer' ? 0.6 : 1);
  const particleOpacity = useSharedValue(opacity);

  React.useEffect(() => {
    const dur = config.duration;

    // Mouvement horizontal — va-et-vient
    translateX.value = withDelay(config.delay,
      withRepeat(
        withSequence(
          withTiming(config.driftX, { duration: dur, easing: Easing.inOut(Easing.ease) }),
          withTiming(-config.driftX * 0.6, { duration: dur * 0.8, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, true,
      ),
    );

    if (season === 'winter' || season === 'autumn') {
      // Tombe doucement
      translateY.value = withDelay(config.delay,
        withRepeat(
          withSequence(
            withTiming(config.driftY, { duration: dur * 0.7, easing: Easing.in(Easing.ease) }),
            withTiming(-config.driftY * 0.3, { duration: dur * 0.3 }),
          ),
          -1,
        ),
      );
    } else if (season === 'spring') {
      // Flotte en figure-8
      translateY.value = withDelay(config.delay,
        withRepeat(
          withSequence(
            withTiming(-config.driftY * 0.5, { duration: dur * 0.5, easing: Easing.inOut(Easing.ease) }),
            withTiming(config.driftY * 0.5, { duration: dur * 0.5, easing: Easing.inOut(Easing.ease) }),
          ),
          -1, true,
        ),
      );
    } else {
      // Lucioles — dérive lente
      translateY.value = withDelay(config.delay,
        withRepeat(
          withSequence(
            withTiming(-config.driftY * 0.4, { duration: dur * 0.6, easing: Easing.inOut(Easing.ease) }),
            withTiming(config.driftY * 0.4, { duration: dur * 0.6, easing: Easing.inOut(Easing.ease) }),
          ),
          -1, true,
        ),
      );
      // Pulse glow pour les lucioles
      particleOpacity.value = withDelay(config.delay,
        withRepeat(
          withSequence(
            withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          ),
          -1, true,
        ),
      );
      scale.value = withDelay(config.delay,
        withRepeat(
          withSequence(
            withTiming(1.2, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          ),
          -1, true,
        ),
      );
    }

    // Rotation
    rotate.value = withDelay(config.delay,
      withRepeat(
        withSequence(
          withTiming(config.rotation, { duration: dur, easing: Easing.inOut(Easing.ease) }),
          withTiming(-config.rotation * 0.5, { duration: dur * 0.8, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, true,
      ),
    );

    return () => {
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(rotate);
      cancelAnimation(scale);
      cancelAnimation(particleOpacity);
    };
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: particleOpacity.value,
  }));

  return (
    <Animated.Text
      style={[
        {
          position: 'absolute',
          left: `${config.startX}%`,
          top: `${config.startY}%`,
          fontSize: config.size,
          color: season === 'summer' ? '#FEF3C7' : undefined,
        },
        animStyle,
      ]}
      pointerEvents="none"
    >
      {config.char}
    </Animated.Text>
  );
}

export function SeasonalParticles() {
  const reducedMotion = useReducedMotion();
  const season = useMemo(() => getCurrentSeason(), []);
  const config = SEASON_CONFIG[season];
  const particles = useMemo(() => generateParticles(season), [season]);

  if (reducedMotion) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Particle key={i} config={p} opacity={config.opacity} season={season} />
      ))}
    </View>
  );
}
