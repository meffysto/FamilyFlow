/**
 * HarvestEventOverlay.tsx — Overlay cinématique pour événements aléatoires de récolte
 *
 * 3 ambiances visuelles :
 * - insectes : fond rouge, screen shake, emoji bugs qui s'éparpillent
 * - pluie_doree : fond doré, particules dorées, confettis, multiplicateur x3
 * - mutation_rare : fond violet, pulse concentrique, orbite d'étoiles, multiplicateur x2
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useTranslation } from 'react-i18next';

import { FontSize, FontWeight } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import type { HarvestEvent } from '../../lib/mascot/farm-engine';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── Types ────────────────────────────────────────

interface HarvestEventOverlayProps {
  event: HarvestEvent | null;
  onDismiss: () => void;
}

// ── Constantes animations ────────────────────────

const BG_COLORS: Record<string, string> = {
  insectes: 'rgba(180, 30, 30, 0.85)',
  pluie_doree: 'rgba(255, 215, 0, 0.85)',
  mutation_rare: 'rgba(120, 50, 180, 0.8)',
};

const SHAKE_AMPLITUDE = 8;
const SHAKE_DURATION = 60;
const SHAKE_COUNT = 6;

const BUG_COUNT = 9;
const RAIN_COUNT = 32;
const ORBIT_COUNT = 4;
const PULSE_COUNT = 3;

// ── Sous-composant : Insectes ────────────────────

function InsectesContent({ event }: { event: HarvestEvent }) {
  const { t } = useTranslation();
  const shakeX = useSharedValue(0);
  const textTrembleX = useSharedValue(0);

  // Génère des destinations aléatoires pour les bugs
  const bugs = useMemo(() => {
    return Array.from({ length: BUG_COUNT }, (_, i) => {
      const angle = (Math.PI * 2 * i) / BUG_COUNT + (Math.random() - 0.5) * 0.5;
      const dist = SCREEN_W * 0.5 + Math.random() * 80;
      return {
        id: i,
        targetX: Math.cos(angle) * dist,
        targetY: Math.sin(angle) * dist,
        delay: Math.random() * 400,
      };
    });
  }, []);

  useEffect(() => {
    // Screen shake
    shakeX.value = withRepeat(
      withSequence(
        withTiming(SHAKE_AMPLITUDE, { duration: SHAKE_DURATION }),
        withTiming(-SHAKE_AMPLITUDE, { duration: SHAKE_DURATION }),
      ),
      SHAKE_COUNT,
      true,
    );
    // Léger tremblement du texte
    textTrembleX.value = withRepeat(
      withSequence(
        withTiming(3, { duration: 80 }),
        withTiming(-3, { duration: 80 }),
      ),
      -1,
      true,
    );
  }, []);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const textTrembleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: textTrembleX.value }],
  }));

  return (
    <Animated.View style={[styles.contentCenter, shakeStyle]}>
      {/* Bugs qui s'éparpillent */}
      {bugs.map((bug) => (
        <BugParticle key={bug.id} targetX={bug.targetX} targetY={bug.targetY} delay={bug.delay} />
      ))}

      {/* Texte central */}
      <Animated.View style={[styles.textBlock, textTrembleStyle]}>
        <Text style={styles.bigEmoji}>🐛</Text>
        <Text style={styles.eventMessage}>{t(event.labelKey)}</Text>
      </Animated.View>
    </Animated.View>
  );
}

function BugParticle({ targetX, targetY, delay }: { targetX: number; targetY: number; delay: number }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    tx.value = withDelay(delay, withTiming(targetX, { duration: 1500, easing: Easing.out(Easing.quad) }));
    ty.value = withDelay(delay, withTiming(targetY, { duration: 1500, easing: Easing.out(Easing.quad) }));
    opacity.value = withDelay(delay + 1000, withTiming(0, { duration: 500 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.particleAbsolute, animStyle]}>
      <Text style={{ fontSize: 28 }}>🐛</Text>
    </Animated.View>
  );
}

// ── Sous-composant : Pluie dorée ─────────────────

function PluieDoreeContent({ event }: { event: HarvestEvent }) {
  const { t } = useTranslation();
  const multiplierScale = useSharedValue(0);

  const drops = useMemo(() => {
    return Array.from({ length: RAIN_COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * SCREEN_W,
      size: 4 + Math.random() * 3,
      delay: Math.random() * 800,
      duration: 1200 + Math.random() * 600,
    }));
  }, []);

  useEffect(() => {
    multiplierScale.value = withSpring(1, { damping: 4, stiffness: 150 });

    // Triple haptic léger
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 100);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 200);
  }, []);

  const multiplierStyle = useAnimatedStyle(() => ({
    transform: [{ scale: multiplierScale.value }],
  }));

  return (
    <View style={styles.contentCenter}>
      {/* Particules dorées */}
      {drops.map((drop) => (
        <GoldDrop key={drop.id} x={drop.x} size={drop.size} delay={drop.delay} duration={drop.duration} />
      ))}

      {/* Multiplicateur géant */}
      <Animated.View style={multiplierStyle}>
        <Text style={styles.multiplierGold}>x3</Text>
      </Animated.View>
      <Text style={styles.eventMessage}>{t(event.labelKey)}</Text>

      {/* Confettis */}
      <ConfettiCannon
        count={80}
        origin={{ x: SCREEN_W / 2, y: 0 }}
        fadeOut
        autoStart
        fallSpeed={2500}
      />
    </View>
  );
}

function GoldDrop({ x, size, delay, duration }: { x: number; size: number; delay: number; duration: number }) {
  const ty = useSharedValue(-40);
  const opacity = useSharedValue(0.9);

  useEffect(() => {
    ty.value = withDelay(
      delay,
      withRepeat(
        withTiming(SCREEN_H + 40, { duration, easing: Easing.linear }),
        -1,
        false,
      ),
    );
    opacity.value = withDelay(delay, withTiming(0.7, { duration: duration * 2 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x,
          top: 0,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#FFD700',
        },
        animStyle,
      ]}
    />
  );
}

// ── Sous-composant : Mutation rare ───────────────

function MutationContent({ event }: { event: HarvestEvent }) {
  const { t } = useTranslation();
  const multiplierScale = useSharedValue(0);
  const flashOpacity = useSharedValue(0.8);

  useEffect(() => {
    multiplierScale.value = withSpring(1, { damping: 6, stiffness: 160 });
    flashOpacity.value = withTiming(0, { duration: 300 });
  }, []);

  const multiplierStyle = useAnimatedStyle(() => ({
    transform: [{ scale: multiplierScale.value }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  return (
    <View style={styles.contentCenter}>
      {/* Flash blanc initial */}
      <Animated.View style={[styles.flash, flashStyle]} pointerEvents="none" />

      {/* Pulses concentriques */}
      {Array.from({ length: PULSE_COUNT }, (_, i) => (
        <PulseRing key={i} delay={i * 300} />
      ))}

      {/* Étoiles orbitantes */}
      {Array.from({ length: ORBIT_COUNT }, (_, i) => (
        <OrbitStar key={i} index={i} />
      ))}

      {/* Multiplicateur */}
      <Animated.View style={multiplierStyle}>
        <Text style={styles.multiplierPurple}>x2</Text>
      </Animated.View>
      <Text style={styles.eventMessage}>{t(event.labelKey)}</Text>
    </View>
  );
}

function PulseRing({ delay }: { delay: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withTiming(3, { duration: 1500, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(0, { duration: 1500, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.pulseRing, animStyle]} />
  );
}

function OrbitStar({ index }: { index: number }) {
  const RADIUS = 60;
  const angle = useSharedValue((index * Math.PI * 2) / ORBIT_COUNT);

  useEffect(() => {
    angle.value = withRepeat(
      withTiming(angle.value + Math.PI * 2, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.cos(angle.value) * RADIUS },
      { translateY: Math.sin(angle.value) * RADIUS },
    ],
  }));

  return (
    <Animated.View style={[styles.particleAbsolute, animStyle]}>
      <Text style={{ fontSize: 24 }}>✨</Text>
    </Animated.View>
  );
}

// ── Composant principal ──────────────────────────

export function HarvestEventOverlay({ event, onDismiss }: HarvestEventOverlayProps) {
  if (!event) return null;

  // Auto-dismiss après 2.5s
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [event, onDismiss]);

  // Haptic au montage
  useEffect(() => {
    if (event.type === 'insectes') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (event.type === 'mutation_rare') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // pluie_doree gère ses propres haptics dans son composant
  }, [event]);

  const bgColor = BG_COLORS[event.type] ?? 'rgba(0, 0, 0, 0.8)';

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(300)}
      style={[styles.overlay, { backgroundColor: bgColor }]}
    >
      {event.type === 'insectes' && <InsectesContent event={event} />}
      {event.type === 'pluie_doree' && <PluieDoreeContent event={event} />}
      {event.type === 'mutation_rare' && <MutationContent event={event} />}
    </Animated.View>
  );
}

// ── Styles ───────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  textBlock: {
    alignItems: 'center',
  },
  bigEmoji: {
    fontSize: 60,
    marginBottom: Spacing.sm,
  },
  eventMessage: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing['2xl'],
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  multiplierGold: {
    fontSize: 80,
    fontWeight: '900' as any,
    color: '#FFFFFF',
    textShadowColor: '#B8860B',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },
  multiplierPurple: {
    fontSize: 70,
    fontWeight: '900' as any,
    color: '#FFFFFF',
    textShadowColor: 'rgba(180, 100, 255, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },
  particleAbsolute: {
    position: 'absolute',
  },
  pulseRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
});
