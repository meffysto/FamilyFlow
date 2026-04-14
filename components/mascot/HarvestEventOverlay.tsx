/**
 * HarvestEventOverlay.tsx — Overlay cinématique pixel-art pour événements de récolte
 *
 * 100% pixel-art : particules carrées, pas d'emojis, pas de confetti-cannon.
 * - insectes : fond rouge, shake, pixels marron/verts qui grouillent
 * - pluie_doree : fond doré, pixels dorés explosent du bas + feuilles pixel tombent
 * - mutation_rare : fond violet, losanges pixel en orbite, sparkles, pulse rings
 */

import React, { useEffect, useMemo, useState } from 'react';
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
import { useTranslation } from 'react-i18next';

import { Spacing } from '../../constants/spacing';
import type { HarvestEvent, RareSeedDrop } from '../../lib/mascot/farm-engine';

const { width: SW, height: SH } = Dimensions.get('window');
const CX = SW / 2; // centre X
const CY = SH / 2; // centre Y

// ── Types ────────────────────────────────────────

interface HarvestEventOverlayProps {
  event: HarvestEvent | null;
  onDismiss: () => void;
}

// ── Couleurs pixel-art ──────────────────────────

const BG_COLORS: Record<string, string> = {
  insectes: 'rgba(60, 20, 15, 0.92)',
  pluie_doree: 'rgba(40, 30, 5, 0.92)',
  mutation_rare: 'rgba(40, 15, 60, 0.90)',
};

const BUG_COLORS = ['#5C3A1E', '#3D5C1E', '#4A2E0F', '#2E4A0F', '#6B4423', '#4B6B23', '#8B6914'];
const GOLD_COLORS = ['#FFD700', '#FFA500', '#FFEC8B', '#DAA520', '#F4A460', '#FFE4B5'];
const LEAF_COLORS = ['#7CB342', '#8BC34A', '#9CCC65', '#689F38', '#558B2F'];
const MUTATION_COLORS = ['#CE93D8', '#BA68C8', '#AB47BC', '#E1BEE7', '#FFD700'];

// ── Particule pixel (position absolue écran) ────

function PixelDot({ startX, startY, endX, endY, size, color, delay, duration }: {
  startX: number; startY: number; endX: number; endY: number;
  size: number; color: string; delay: number; duration: number;
}) {
  const left = useSharedValue(startX);
  const top = useSharedValue(startY);
  const opacity = useSharedValue(0);

  useEffect(() => {
    left.value = withDelay(delay, withTiming(endX, { duration, easing: Easing.out(Easing.cubic) }));
    top.value = withDelay(delay, withTiming(endY, { duration, easing: Easing.out(Easing.cubic) }));
    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(1, { duration: duration * 0.55 }),
      withTiming(0, { duration: duration * 0.35 }),
    ));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    left: left.value,
    top: top.value,
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{
      position: 'absolute',
      width: size,
      height: size,
      backgroundColor: color,
    }, animStyle]} />
  );
}

// ── Insectes ─────────────────────────────────────

function InsectesContent({ event }: { event: HarvestEvent }) {
  const { t } = useTranslation();
  const shakeX = useSharedValue(0);
  const trembleX = useSharedValue(0);
  const labelOpacity = useSharedValue(0);

  const bugs = useMemo(() =>
    Array.from({ length: 28 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 28 + (Math.random() - 0.5) * 0.6;
      const dist = SW * 0.5 + Math.random() * SW * 0.3;
      return {
        id: i,
        endX: CX + Math.cos(angle) * dist,
        endY: CY + Math.sin(angle) * dist,
        delay: Math.random() * 500,
        size: 4 + Math.floor(Math.random() * 5),
        color: BUG_COLORS[i % BUG_COLORS.length],
      };
    })
  , []);

  useEffect(() => {
    shakeX.value = withRepeat(
      withSequence(withTiming(10, { duration: 50 }), withTiming(-10, { duration: 50 })),
      8, true,
    );
    trembleX.value = withRepeat(
      withSequence(withTiming(2, { duration: 60 }), withTiming(-2, { duration: 60 })),
      -1, true,
    );
    labelOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));
  }, []);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const textStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: trembleX.value }],
    opacity: labelOpacity.value,
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, shakeStyle]}>
      {/* Pixels bugs depuis le centre */}
      {bugs.map(b => (
        <PixelDot key={b.id}
          startX={CX} startY={CY}
          endX={b.endX} endY={b.endY}
          size={b.size} color={b.color}
          delay={b.delay} duration={1400}
        />
      ))}
      {/* Emoji + label central */}
      <Animated.View style={[styles.centerLabel, textStyle]}>
        <Text style={styles.bigEmoji}>🐛</Text>
        <View style={styles.pixelLabel}>
          <Text style={styles.pixelLabelText}>{t(event.labelKey)}</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ── Pluie dorée ──────────────────────────────────

function FireworkBurst({ originX, originY, delay }: {
  originX: number; originY: number; delay: number;
}) {
  const particles = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 18 + (Math.random() - 0.5) * 0.4;
      const dist = 50 + Math.random() * 100;
      return {
        id: i,
        endX: originX + Math.cos(angle) * dist,
        endY: originY + Math.sin(angle) * dist * 0.7 - 30, // bias vers le haut
        size: 3 + Math.floor(Math.random() * 4),
        color: GOLD_COLORS[i % GOLD_COLORS.length],
      };
    })
  , []);

  return (
    <>
      {particles.map(p => (
        <PixelDot key={p.id}
          startX={originX} startY={originY}
          endX={p.endX} endY={p.endY}
          size={p.size} color={p.color}
          delay={delay} duration={900}
        />
      ))}
    </>
  );
}

function FallingLeaf({ x, delay }: { x: number; delay: number }) {
  const top = useSharedValue(-8);
  const left = useSharedValue(x);
  const opacity = useSharedValue(0);
  const size = 4 + Math.floor(Math.random() * 3);
  const color = LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)];

  const fallDuration = 1800 + Math.random() * 800;
  useEffect(() => {
    top.value = withDelay(delay, withTiming(SH + 20, { duration: fallDuration, easing: Easing.in(Easing.quad) }));
    left.value = withDelay(delay, withTiming(x + (Math.random() - 0.5) * 50, { duration: 2200 }));
    opacity.value = withDelay(delay, withSequence(
      withTiming(0.85, { duration: 100 }),
      withTiming(0.85, { duration: fallDuration * 0.75 }),
      withTiming(0, { duration: 300 }),
    ));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    left: left.value,
    top: top.value,
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{
      position: 'absolute',
      width: size,
      height: size + 1,
      backgroundColor: color,
    }, animStyle]} />
  );
}

function PluieDoreeContent({ event }: { event: HarvestEvent }) {
  const { t } = useTranslation();
  const scale = useSharedValue(0);
  const [burst2, setBurst2] = useState(false);
  const [burst3, setBurst3] = useState(false);

  const leaves = useMemo(() =>
    Array.from({ length: 35 }, (_, i) => ({
      id: i, x: Math.random() * SW, delay: Math.random() * 600,
    }))
  , []);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 6, stiffness: 160 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => { setBurst2(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }, 400);
    setTimeout(() => { setBurst3(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }, 800);
  }, []);

  const mulStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Feuilles pixel qui tombent */}
      {leaves.map(l => <FallingLeaf key={l.id} x={l.x} delay={l.delay} />)}

      {/* 3 feux d'artifice pixel du bas */}
      <FireworkBurst originX={SW * 0.15} originY={SH * 0.80} delay={100} />
      {burst2 && <FireworkBurst originX={SW * 0.85} originY={SH * 0.75} delay={0} />}
      {burst3 && <FireworkBurst originX={SW * 0.50} originY={SH * 0.65} delay={0} />}

      {/* Multiplicateur + label centrés */}
      <View style={styles.centerLabel}>
        <Animated.View style={mulStyle}>
          <View style={styles.pixelMultiplierBox}>
            <Text style={styles.pixelMultiplierTextGold}>x3</Text>
          </View>
        </Animated.View>
        <View style={[styles.pixelLabel, { marginTop: Spacing.lg }]}>
          <Text style={styles.pixelLabelText}>{t(event.labelKey)}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Mutation rare ────────────────────────────────

function PixelDiamond({ index, radius }: { index: number; radius: number }) {
  const angle = useSharedValue((index * Math.PI * 2) / 6);
  const flash = useSharedValue(1);
  const color = MUTATION_COLORS[index % MUTATION_COLORS.length];

  useEffect(() => {
    angle.value = withRepeat(
      withTiming(angle.value + Math.PI * 2, { duration: 2200, easing: Easing.linear }),
      -1, false,
    );
    flash.value = withRepeat(
      withSequence(withTiming(0.3, { duration: 250 }), withTiming(1, { duration: 250 })),
      -1, true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.cos(angle.value) * radius },
      { translateY: Math.sin(angle.value) * radius },
      { rotate: '45deg' },
    ],
    opacity: flash.value,
  }));

  return (
    <Animated.View style={[{
      position: 'absolute',
      left: CX - 3, top: CY - 3,
      width: 7, height: 7,
      backgroundColor: color,
    }, animStyle]} />
  );
}

function PixelPulseRing({ delay }: { delay: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0.8);

  useEffect(() => {
    scale.value = withDelay(delay, withRepeat(
      withTiming(4, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false,
    ));
    opacity.value = withDelay(delay, withRepeat(
      withTiming(0, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false,
    ));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{
      position: 'absolute',
      left: CX - 40, top: CY - 40,
      width: 80, height: 80,
      borderWidth: 3,
      borderColor: 'rgba(206, 147, 216, 0.6)',
    }, animStyle]} />
  );
}

function Sparkle({ x, y, delay }: { x: number; y: number; delay: number }) {
  const opacity = useSharedValue(0);
  const color = MUTATION_COLORS[Math.floor(Math.random() * MUTATION_COLORS.length)];
  const size = 3 + Math.floor(Math.random() * 4);

  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withSequence(withTiming(1, { duration: 150 }), withTiming(0, { duration: 350 })),
      3, false,
    ));
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[{
      position: 'absolute', left: x, top: y,
      width: size, height: size,
      backgroundColor: color,
    }, animStyle]} />
  );
}

function MutationContent({ event }: { event: HarvestEvent }) {
  const { t } = useTranslation();
  const scale = useSharedValue(0);
  const flashOpacity = useSharedValue(0.9);

  const sparkles = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i, x: Math.random() * SW, y: Math.random() * SH, delay: Math.random() * 1000,
    }))
  , []);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 6, stiffness: 160 });
    flashOpacity.value = withTiming(0, { duration: 250 });
  }, []);

  const mulStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Flash violet */}
      <Animated.View style={[styles.flash, flashStyle]} pointerEvents="none" />

      {/* Sparkles pixel */}
      {sparkles.map(s => <Sparkle key={s.id} x={s.x} y={s.y} delay={s.delay} />)}

      {/* Pulse rings */}
      {Array.from({ length: 3 }, (_, i) => <PixelPulseRing key={i} delay={i * 350} />)}

      {/* Losanges en orbite */}
      {Array.from({ length: 6 }, (_, i) => (
        <PixelDiamond key={i} index={i} radius={55 + (i % 2) * 25} />
      ))}

      {/* Multiplicateur + label */}
      <View style={styles.centerLabel}>
        <Animated.View style={mulStyle}>
          <View style={[styles.pixelMultiplierBox, { borderColor: '#CE93D8' }]}>
            <Text style={[styles.pixelMultiplierTextGold, { color: '#F3E5F5' }]}>x2</Text>
          </View>
        </Animated.View>
        <View style={[styles.pixelLabel, { marginTop: Spacing.lg }]}>
          <Text style={styles.pixelLabelText}>{t(event.labelKey)}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Composant principal ──────────────────────────

export function HarvestEventOverlay({ event, onDismiss }: HarvestEventOverlayProps) {
  useEffect(() => {
    if (!event) return;
    const timer = setTimeout(onDismiss, 1800);
    return () => clearTimeout(timer);
  }, [event, onDismiss]);

  useEffect(() => {
    if (!event) return;
    if (event.type === 'insectes') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (event.type === 'mutation_rare') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [event]);

  if (!event) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(300)}
      style={[styles.overlay, { backgroundColor: BG_COLORS[event.type] ?? 'rgba(0,0,0,0.8)' }]}
    >
      {event.type === 'insectes' && <InsectesContent event={event} />}
      {event.type === 'pluie_doree' && <PluieDoreeContent event={event} />}
      {event.type === 'mutation_rare' && <MutationContent event={event} />}
    </Animated.View>
  );
}

// ── Graine rare — overlay dédié ─────────────────

const SEED_SPARKLE_COLORS = ['#7CB342', '#8BC34A', '#FFD700', '#A5D6A7', '#FFF176', '#C8E6C9'];

function SeedSparkle({ x, y, delay: d }: { x: number; y: number; delay: number }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);
  const size = 3 + Math.floor(Math.random() * 4);
  const color = SEED_SPARKLE_COLORS[Math.floor(Math.random() * SEED_SPARKLE_COLORS.length)];

  useEffect(() => {
    opacity.value = withDelay(d, withRepeat(
      withSequence(withTiming(1, { duration: 200 }), withTiming(0, { duration: 400 })),
      2, false,
    ));
    scale.value = withDelay(d, withRepeat(
      withSequence(withTiming(1.5, { duration: 200 }), withTiming(0.5, { duration: 400 })),
      2, false,
    ));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[{
      position: 'absolute', left: x, top: y,
      width: size, height: size,
      backgroundColor: color,
    }, animStyle]} />
  );
}

interface SeedDropOverlayProps {
  seedDrop: RareSeedDrop | null;
  onDismiss: () => void;
}

export function SeedDropOverlay({ seedDrop, onDismiss }: SeedDropOverlayProps) {
  const emojiScale = useSharedValue(0);
  const labelOpacity = useSharedValue(0);

  const sparkles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: CX + (Math.random() - 0.5) * SW * 0.6,
      y: CY + (Math.random() - 0.5) * SH * 0.4,
      delay: Math.random() * 600,
    }))
  , []);

  useEffect(() => {
    if (!seedDrop) return;
    const timer = setTimeout(onDismiss, 2000);
    return () => clearTimeout(timer);
  }, [seedDrop, onDismiss]);

  useEffect(() => {
    if (!seedDrop) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    emojiScale.value = withSpring(1, { damping: 6, stiffness: 160 });
    labelOpacity.value = withDelay(300, withTiming(1, { duration: 300 }));
  }, [seedDrop]);

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  if (!seedDrop) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(300)}
      style={[styles.overlay, { backgroundColor: 'rgba(15, 40, 15, 0.90)' }]}
    >
      {sparkles.map(s => <SeedSparkle key={s.id} x={s.x} y={s.y} delay={s.delay} />)}
      <View style={styles.centerLabel}>
        <Animated.View style={emojiStyle}>
          <Text style={styles.seedEmoji}>{seedDrop.emoji}</Text>
        </Animated.View>
        <Animated.View style={textStyle}>
          <Text style={styles.seedTitle}>🌟 Graine rare trouvée !</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ── Styles ───────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  centerLabel: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pixelLabel: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  pixelLabelText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 1,
  },
  bigEmoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  pixelMultiplierBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderWidth: 3,
    borderColor: '#FFD700',
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  pixelMultiplierTextGold: {
    fontSize: 64,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E1BEE7',
    zIndex: 10,
  },
  seedEmoji: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  seedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#A5D6A7',
    textAlign: 'center',
    letterSpacing: 1,
  },
});
