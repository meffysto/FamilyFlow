/**
 * LootBoxOpener.tsx — Premium animated loot box opening UI
 *
 * Built with react-native-reanimated for 60fps animations.
 * Cozy chest asset, shake suspense, golden glow ring on reveal,
 * and "INCROYABLE !" banner for high tiers.
 *
 * Phases:
 * 1. Idle — Chest floating with subtle breathing animation + particles
 * 2. Spinning — Chest shakes intensely, light rays burst from center
 * 3. Reveal — Card scales in, rarity glow ring, particles
 * 4. Done — Reward displayed with persistent glow for high tiers
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  withRepeat,
  interpolate,
  Easing,
  cancelAnimation,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LootBox, ProfileTheme } from '../lib/types';
import { RARITY_COLORS, RARITY_EMOJIS, getRarityLabel, SEASONAL_EVENTS } from '../lib/gamification';
import { getTheme } from '../constants/themes';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../contexts/ThemeContext';
import { FontSize, FontWeight } from '../constants/typography';

const LOOT_CHEST_IMAGE = require('../assets/ui/loot/loot-chest.png');

let ConfettiCannon: any = null;
try {
  ConfettiCannon = require('react-native-confetti-cannon').default;
} catch {
  // Optional dependency
}

// ─── Particle System ────────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
}

function generateParticles(count: number, colors: string[], screenW: number, screenH: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * screenW,
    y: Math.random() * screenH * 0.6 + screenH * 0.1,
    size: Math.random() * 6 + 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    delay: Math.random() * 2000,
  }));
}

function FloatingParticle({ particle }: { particle: Particle }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      particle.delay,
      withRepeat(
        withSequence(
          withTiming(0.7, { duration: 1200 }),
          withTiming(0, { duration: 1200 }),
        ),
        -1,
      ),
    );
    translateY.value = withDelay(
      particle.delay,
      withRepeat(
        withSequence(
          withTiming(-40, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
    scale.value = withDelay(
      particle.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 600 }),
          withTiming(0.3, { duration: 1800 }),
        ),
        -1,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: particle.x,
    top: particle.y,
    width: particle.size,
    height: particle.size,
    borderRadius: particle.size / 2,
    backgroundColor: particle.color,
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return <Animated.View style={style} />;
}

// ─── Light Ray ──────────────────────────────────────────────────────────────

function LightRay({ angle, color, delay }: { angle: number; color: string; delay: number }) {
  const opacity = useSharedValue(0);
  const scaleY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(0.6, { duration: 300 }),
        withTiming(0.15, { duration: 1500 }),
      ),
    );
    scaleY.value = withDelay(
      delay,
      withSpring(1, { damping: 8, stiffness: 80 }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    width: 3,
    height: 160,
    backgroundColor: color,
    opacity: opacity.value,
    borderRadius: 2,
    transform: [
      { rotate: `${angle}deg` },
      { scaleY: scaleY.value },
      { translateY: -80 },
    ],
  }));

  return <Animated.View style={style} />;
}

// ─── Glow Ring (Pokémon TCG Pocket style golden ring) ───────────────────────

function GlowRing({ color, size, pulseSpeed, borderW }: { color: string; size: number; pulseSpeed: number; borderW?: number }) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: pulseSpeed }),
        withTiming(0.85, { duration: pulseSpeed }),
      ),
      -1,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: pulseSpeed }),
        withTiming(0.15, { duration: pulseSpeed }),
      ),
      -1,
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: borderW ?? 3,
    borderColor: color,
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={style} />;
}

// ─── Sparkle (small star-like particle) ─────────────────────────────────────

function Sparkle({ x, y, delay, color }: { x: number; y: number; delay: number; color: string }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0, { duration: 600 }),
        ),
        -1,
      ),
    );
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withSpring(1, { damping: 4, stiffness: 100 }),
          withTiming(0, { duration: 400 }),
        ),
        -1,
      ),
    );
    rotation.value = withDelay(
      delay,
      withRepeat(
        withTiming(180, { duration: 1000 }),
        -1,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x,
    top: y,
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <Text style={{ fontSize: 14, color }}>✦</Text>
    </Animated.View>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface LootBoxOpenerProps {
  visible: boolean;
  profileName: string;
  profileAvatar: string;
  lootCount: number;
  profileTheme?: ProfileTheme;
  onOpen: () => Promise<LootBox | null>;
  onClose: () => void;
}

type Phase = 'idle' | 'spinning' | 'reveal' | 'done';

export function LootBoxOpener({
  visible,
  profileName,
  profileAvatar,
  lootCount,
  profileTheme,
  onOpen,
  onClose,
}: LootBoxOpenerProps) {
  const { t } = useTranslation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { colors: { textFaint } } = useThemeColors();
  const reduceMotion = useReducedMotion();
  const theme = getTheme(profileTheme);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<LootBox | null>(null);
  const confettiRef = useRef<any>(null);
  const confettiRef2 = useRef<any>(null);

  // ─── Shared values ──────────────────────────────────────────────────────

  const breathe = useSharedValue(0);
  const floatY = useSharedValue(0);

  const shakeX = useSharedValue(0);
  const shakeRotate = useSharedValue(0);
  const spinScale = useSharedValue(1);

  const cardScale = useSharedValue(0);
  const cardScaleX = useSharedValue(0);
  const cardOpacity = useSharedValue(0);

  const flashOpacity = useSharedValue(0);
  const rewardGlow = useSharedValue(0);

  const packScale = useSharedValue(1);
  const packOpacity = useSharedValue(1);

  // Banner animation for "INCROYABLE !"
  const bannerScale = useSharedValue(0);
  const bannerOpacity = useSharedValue(0);

  // ─── Particle data ─────────────────────────────────────────────────────

  const [idleParticles] = useState(() =>
    generateParticles(6, [...theme.confettiColors.slice(0, 3), 'rgba(255,255,255,0.5)'], screenWidth, screenHeight),
  );
  const [revealParticles, setRevealParticles] = useState<Particle[]>([]);

  // ─── Sparkle data for reveal ───────────────────────────────────────────

  const [sparkles] = useState(() =>
    Array.from({ length: 4 }, (_, i) => ({
      id: i,
      x: screenWidth * 0.15 + Math.random() * screenWidth * 0.7,
      y: screenHeight * 0.2 + Math.random() * screenHeight * 0.4,
      delay: Math.random() * 1500,
      color: ['#FFD700', '#FFFFFF', '#FDE68A', '#E3350D'][Math.floor(Math.random() * 4)],
    })),
  );

  // ─── Reset on visibility change ────────────────────────────────────────

  useEffect(() => {
    if (visible) {
      setPhase('idle');
      setResult(null);
      resetAnimations();
      if (!reduceMotion) {
        startIdleAnimations();
      }
    } else {
      stopAllAnimations();
    }
  }, [visible, reduceMotion]);

  function resetAnimations() {
    breathe.value = 0;
    floatY.value = 0;
    shakeX.value = 0;
    shakeRotate.value = 0;
    spinScale.value = 1;
    cardScale.value = 0;
    cardScaleX.value = 0;
    cardOpacity.value = 0;
    flashOpacity.value = 0;
    rewardGlow.value = 0;
    packScale.value = 1;
    packOpacity.value = 1;
    bannerScale.value = 0;
    bannerOpacity.value = 0;
  }

  function stopAllAnimations() {
    cancelAnimation(breathe);
    cancelAnimation(floatY);
    cancelAnimation(shakeX);
    cancelAnimation(shakeRotate);
    cancelAnimation(spinScale);
    cancelAnimation(rewardGlow);
    cancelAnimation(bannerScale);
  }

  function startIdleAnimations() {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(8, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }

  // ─── Animated styles ──────────────────────────────────────────────────

  const packStyle = useAnimatedStyle(() => {
    const scale = interpolate(breathe.value, [0, 1], [1, 1.06]);
    return {
      transform: [
        { translateY: floatY.value },
        { translateX: shakeX.value },
        { rotate: `${shakeRotate.value}deg` },
        { scale: spinScale.value * scale * packScale.value },
      ],
      opacity: packOpacity.value,
    };
  });

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: cardScale.value },
      { scaleX: cardScaleX.value },
    ],
    opacity: cardOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: rewardGlow.value,
    transform: [{ scale: interpolate(rewardGlow.value, [0, 1], [0.8, 1.2]) }],
  }));

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: bannerOpacity.value,
    transform: [{ scale: bannerScale.value }],
  }));

  // ─── Open handler ─────────────────────────────────────────────────────

  const handleOpen = useCallback(async () => {
    if (phase !== 'idle' || lootCount <= 0) return;

    // ─── Mode reduceMotion : ouverture rapide, résultat immédiat ─────
    if (reduceMotion) {
      const box = await onOpen();
      if (!box) return;

      setResult(box);
      setPhase('reveal');

      // Afficher directement la carte sans animation
      cardOpacity.value = 1;
      cardScale.value = 1;
      cardScaleX.value = 1;
      packOpacity.value = 0;

      const boxIsMythique = box.rarity === 'mythique';
      const boxIsLegendaire = box.rarity === 'légendaire';
      const isHighTier = boxIsMythique || boxIsLegendaire;

      if (isHighTier) {
        bannerOpacity.value = 1;
        bannerScale.value = 1;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    // ─── Mode normal : animations complètes ─────────────────────────
    setPhase('spinning');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    cancelAnimation(breathe);
    cancelAnimation(floatY);
    floatY.value = withTiming(0, { duration: 200 });

    // Intense shaking — builds up
    shakeX.value = withRepeat(
      withSequence(
        withTiming(8, { duration: 40 }),
        withTiming(-8, { duration: 40 }),
        withTiming(12, { duration: 35 }),
        withTiming(-12, { duration: 35 }),
        withTiming(16, { duration: 30 }),
        withTiming(-16, { duration: 30 }),
      ),
      8,
    );

    shakeRotate.value = withRepeat(
      withSequence(
        withTiming(6, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(10, { duration: 40 }),
        withTiming(-10, { duration: 40 }),
      ),
      6,
    );

    spinScale.value = withSequence(
      withTiming(1.3, { duration: 500, easing: Easing.out(Easing.cubic) }),
      withTiming(1.35, { duration: 400 }),
      withTiming(0.7, { duration: 200, easing: Easing.in(Easing.cubic) }),
    );

    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 300);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 500);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 700);

    // Fetch API démarre IMMÉDIATEMENT en parallèle du shake animation.
    // On attend que max(fetch, 900ms minimum de shake "présentable") soit terminé.
    const minShakeDelay = new Promise((r) => setTimeout(r, 900));
    const [box] = await Promise.all([onOpen(), minShakeDelay]);

    if (!box) {
      setPhase('idle');
      resetAnimations();
      startIdleAnimations();
      return;
    }

    setResult(box);

    const boxIsMythique = box.rarity === 'mythique';
    const boxIsLegendaire = box.rarity === 'légendaire';
    const boxIsEpique = box.rarity === 'épique';
    const isHighTier = boxIsMythique || boxIsLegendaire;

    if (boxIsMythique) {
      // Haptics fire-and-forget — ne bloquent plus l'apparition du reveal
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 300);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 550);

      flashOpacity.value = withSequence(
        withTiming(0.9, { duration: 100 }),
        withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }),
      );
    } else if (boxIsLegendaire) {
      // Haptics fire-and-forget — ne bloquent plus l'apparition du reveal
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);

      flashOpacity.value = withSequence(
        withTiming(0.5, { duration: 100 }),
        withTiming(0, { duration: 400 }),
      );
    } else if (boxIsEpique) {
      // Haptics fire-and-forget — ne bloque plus l'apparition du reveal
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      flashOpacity.value = withSequence(
        withTiming(0.3, { duration: 80 }),
        withTiming(0, { duration: 300 }),
      );
    }

    // Generate reveal particles
    const rColor = RARITY_COLORS[box.rarity];
    setRevealParticles(
      generateParticles(
        boxIsMythique ? 14 : isHighTier ? 10 : 6,
        boxIsMythique
          ? ['#FFD700', '#EF4444', '#FF6B6B', '#FFFFFF', '#FFA500']
          : [rColor, '#FFFFFF', theme.confettiColors[0]],
        screenWidth,
        screenHeight,
      ),
    );

    // Pack disappears
    packScale.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) });
    packOpacity.value = withTiming(0, { duration: 200 });

    // Card appears
    await new Promise((r) => setTimeout(r, 250));
    setPhase('reveal');

    cardOpacity.value = withTiming(1, { duration: 200 });
    cardScale.value = withSpring(1, { damping: 12, stiffness: 100, mass: 0.8 });
    cardScaleX.value = withSpring(1, { damping: 14, stiffness: 100 });

    // "INCROYABLE !" banner for high tiers
    if (isHighTier) {
      bannerOpacity.value = withDelay(300, withTiming(1, { duration: 200 }));
      bannerScale.value = withDelay(300, withSpring(1, { damping: 8, stiffness: 120 }));
    }

    // Glow behind card
    if (isHighTier) {
      rewardGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: boxIsMythique ? 800 : 1200 }),
          withTiming(0.3, { duration: boxIsMythique ? 800 : 1200 }),
        ),
        -1,
      );
    } else if (boxIsEpique) {
      rewardGlow.value = withTiming(0.5, { duration: 600 });
    }

    // Haptics fire-and-forget — ne bloque pas le confetti
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 200);

    if (confettiRef.current) confettiRef.current.start();
    if (boxIsMythique && confettiRef2.current) {
      setTimeout(() => confettiRef2.current?.start(), 400);
    }
  }, [phase, lootCount, onOpen, theme, reduceMotion]);

  // ─── Close handler ────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    stopAllAnimations();
    setPhase('idle');
    setResult(null);
    setRevealParticles([]);
    resetAnimations();
    onClose();
  }, [onClose]);

  // ─── Computed ─────────────────────────────────────────────────────────

  const isMythique = result?.rarity === 'mythique';
  const isLegendaire = result?.rarity === 'légendaire';
  const isHighTier = isMythique || isLegendaire;
  const isEpique = result?.rarity === 'épique';

  const rarityColor = result ? RARITY_COLORS[result.rarity] : theme.primary;
  const rarityEmoji = result ? RARITY_EMOJIS[result.rarity] : '';

  const flashColor = isMythique ? '#FFD700' : isLegendaire ? '#F59E0B' : '#FFFFFF';

  const defaultBg = theme.id === 'lavande' ? '#1F1035' : theme.secondary;
  const bgColor = isMythique
    ? '#2D0A0A'
    : isLegendaire
    ? '#1F1500'
    : defaultBg;

  // Rarity-based card border color
  const cardBorderColor = result
    ? isHighTier
      ? rarityColor
      : isEpique
      ? `${rarityColor}80`
      : 'rgba(255,255,255,0.15)'
    : 'rgba(255,255,255,0.15)';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        {/* Screen flash (skip si reduceMotion) */}
        {!reduceMotion && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: flashColor, zIndex: 100, pointerEvents: 'none' },
              flashStyle,
            ]}
          />
        )}

        {/* Idle floating particles (skip si reduceMotion) */}
        {!reduceMotion && phase === 'idle' && idleParticles.map((p) => (
          <FloatingParticle key={p.id} particle={p} />
        ))}

        {/* Reveal particles (skip si reduceMotion) */}
        {!reduceMotion && (phase === 'reveal' || phase === 'done') && (
          <>
            {revealParticles.map((p) => (
              <FloatingParticle key={`r${p.id}`} particle={p} />
            ))}
            {isHighTier && sparkles.map((s) => (
              <Sparkle key={`s${s.id}`} x={s.x} y={s.y} delay={s.delay} color={s.color} />
            ))}
          </>
        )}

        {/* Confetti (skip si reduceMotion) */}
        {!reduceMotion && ConfettiCannon && (
          <>
            <ConfettiCannon
              ref={confettiRef}
              count={isMythique ? 90 : isLegendaire ? 70 : 50}
              origin={{ x: -10, y: 0 }}
              autoStart={false}
              fadeOut
              explosionSpeed={isMythique ? 400 : 350}
              fallSpeed={isMythique ? 2500 : 3000}
              colors={isMythique
                ? ['#EF4444', '#FFD700', '#FF6B6B', '#FFFFFF', '#FFA500']
                : isLegendaire
                ? ['#F59E0B', '#FFD700', '#FFFFFF', '#FDE68A', theme.primary]
                : theme.confettiColors
              }
            />
            {isMythique && (
              <ConfettiCannon
                ref={confettiRef2}
                count={70}
                origin={{ x: screenWidth + 10, y: 0 }}
                autoStart={false}
                fadeOut
                explosionSpeed={350}
                fallSpeed={2800}
                colors={['#FFD700', '#EF4444', '#FF4500', '#FFFFFF']}
              />
            )}
          </>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.profileInfo}>
            {profileAvatar} {profileName}
          </Text>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.closeBtn, { color: textFaint }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* ═══ IDLE PHASE ═══ */}
          {phase === 'idle' && (
            <>
              <Text style={styles.title}>{theme.packLabel}</Text>
              <Text style={[styles.subtitle, { color: theme.primary }]}>
                {t('loot.opener.available', { count: lootCount })}
              </Text>
              <TouchableOpacity onPress={handleOpen} style={styles.chestButton} activeOpacity={0.8}>
                <View style={styles.packContainer}>
                  <View style={[styles.packGlow, { backgroundColor: theme.primary, opacity: 0.15 }]} />
                  <Animated.View style={packStyle}>
                    <Image source={LOOT_CHEST_IMAGE} style={styles.lootChestImage} resizeMode="contain" />
                  </Animated.View>
                </View>
                <Text style={[styles.openText, { color: theme.primary }]}>
                  {t('loot.opener.tapToOpen')}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* ═══ SPINNING PHASE ═══ (jamais affiché si reduceMotion — on passe directement au reveal) */}
          {!reduceMotion && phase === 'spinning' && (
            <View style={styles.spinContainer}>
              <View style={styles.raysContainer}>
                {Array.from({ length: 6 }, (_, i) => (
                  <LightRay
                    key={i}
                    angle={i * 60}
                    color={theme.confettiColors[0]}
                    delay={i * 50}
                  />
                ))}
              </View>
              <Animated.View style={packStyle}>
                <Image source={LOOT_CHEST_IMAGE} style={styles.lootChestImage} resizeMode="contain" />
              </Animated.View>
              <Text style={styles.spinText}>{t('loot.opener.opening')}</Text>
            </View>
          )}

          {/* ═══ REVEAL PHASE ═══ */}
          {(phase === 'reveal' || phase === 'done') && result && (
            <View style={styles.revealContainer}>
              {/* Glow rings behind card — Pokémon TCG Pocket style (skip si reduceMotion) */}
              {!reduceMotion && (isHighTier || isEpique) && (
                <View style={styles.glowCenter}>
                  {/* Inner ring */}
                  <GlowRing
                    color={isMythique ? '#FFD700' : rarityColor}
                    size={220}
                    pulseSpeed={isMythique ? 700 : 1000}
                    borderW={isMythique ? 5 : 3}
                  />
                  {/* Outer ring */}
                  {isHighTier && (
                    <GlowRing
                      color={isMythique ? '#EF4444' : '#FDE68A'}
                      size={300}
                      pulseSpeed={isMythique ? 900 : 1400}
                      borderW={isMythique ? 4 : 2}
                    />
                  )}
                  {/* Third ring for mythique */}
                  {isMythique && (
                    <GlowRing
                      color="#FFA500"
                      size={360}
                      pulseSpeed={1100}
                      borderW={2}
                    />
                  )}
                  {/* Center glow blob */}
                  <Animated.View
                    style={[
                      styles.glowBlob,
                      { backgroundColor: isMythique ? '#FFD700' : rarityColor },
                      glowStyle,
                    ]}
                  />
                </View>
              )}

              {/* "INCROYABLE !" banner for high tiers (Pokémon Pocket style) */}
              {isHighTier && (
                <Animated.View style={[styles.incredibleBanner, bannerStyle]}>
                  <View style={[
                    styles.incredibleBannerInner,
                    { borderColor: isMythique ? '#FFD700' : '#F59E0B' },
                  ]}>
                    <Text style={[
                      styles.incredibleText,
                      isMythique && styles.incredibleTextMythique,
                    ]}>
                      {isMythique ? t('loot.opener.incredible') : t('loot.opener.super')}
                    </Text>
                  </View>
                </Animated.View>
              )}

              {/* Reward Card */}
              <Animated.View style={[
                styles.rewardCard,
                { borderColor: cardBorderColor },
                isHighTier && { borderWidth: 2 },
                isMythique && styles.rewardCardMythique,
                cardStyle,
              ]}>
                {/* Rarity badge */}
                <View
                  style={[
                    styles.rarityBadge,
                    { backgroundColor: rarityColor },
                    isMythique && styles.mythiqueBadge,
                  ]}
                >
                  <Text style={styles.rarityText}>
                    {rarityEmoji} {getRarityLabel(result.rarity)}
                  </Text>
                </View>

                {/* Tag saisonnier */}
                {(() => {
                  const sEvent = result.seasonal ? SEASONAL_EVENTS.find((e) => e.id === result.seasonal) : undefined;
                  return sEvent ? (
                    <Text style={[styles.seasonalTag, { color: sEvent.themeColor }]}>
                      {t('loot.opener.seasonalExclusive', { emoji: sEvent.emoji, name: sEvent.name })}
                    </Text>
                  ) : null;
                })()}

                {/* Reward emoji */}
                <Text style={[
                  styles.rewardEmoji,
                  isMythique && styles.rewardEmojiMythique,
                  isLegendaire && styles.rewardEmojiLegendaire,
                ]}>
                  {result.emoji}
                </Text>

                {/* Reward text */}
                <Text style={[
                  styles.rewardText,
                  isMythique && styles.rewardTextMythique,
                  isLegendaire && styles.rewardTextLegendaire,
                ]}>
                  {result.reward}
                </Text>

                {/* Bonus points */}
                {result.bonusPoints > 0 && (
                  <View style={[styles.bonusPill, isMythique && { backgroundColor: '#EF4444' }]}>
                    <Text style={styles.bonusText}>{t('loot.opener.bonusPoints', { points: result.bonusPoints })}</Text>
                  </View>
                )}

                {/* Parent approval */}
                {result.requiresParent && (
                  <View style={styles.parentNote}>
                    <Text style={styles.parentNoteText}>
                      👨‍👩‍👧 {t('loot.opener.parentApproval')}
                    </Text>
                  </View>
                )}

                {/* Special reward descriptions */}
                {result.multiplier && result.multiplier > 1 && (
                  <View style={[styles.specialNote, isMythique && { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
                    <Text style={styles.specialNoteText}>
                      {t('loot.opener.multiplier', { multiplier: result.multiplier, tasks: result.multiplierTasks ?? 10 })}
                    </Text>
                  </View>
                )}

                {result.rewardType === 'double_loot' && (
                  <View style={[styles.specialNote, { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
                    <Text style={styles.specialNoteText}>{t('loot.opener.doubleLoot')}</Text>
                  </View>
                )}

                {result.rewardType === 'vacation' && (
                  <View style={[styles.specialNote, { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
                    <Text style={styles.specialNoteText}>{t('loot.opener.vacation')}</Text>
                  </View>
                )}

                {result.rewardType === 'crown' && (
                  <View style={[styles.specialNote, { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
                    <Text style={styles.specialNoteText}>{t('loot.opener.crown')}</Text>
                  </View>
                )}

                {result.rewardType === 'skip_all' && (
                  <View style={[styles.specialNote, { backgroundColor: 'rgba(245, 158, 11, 0.3)' }]}>
                    <Text style={styles.specialNoteText}>{t('loot.opener.skipAll')}</Text>
                  </View>
                )}

                {result.rewardType === 'family_bonus' && (
                  <View style={[styles.specialNote, { backgroundColor: 'rgba(245, 158, 11, 0.3)' }]}>
                    <Text style={styles.specialNoteText}>
                      {t('loot.opener.familyBonus', { points: result.bonusPoints })}
                    </Text>
                  </View>
                )}
              </Animated.View>

              {/* Close button */}
              <TouchableOpacity
                style={[styles.closeRewardBtn, { backgroundColor: isMythique ? '#EF4444' : theme.primary }]}
                onPress={handleClose}
              >
                <Text style={styles.closeRewardText}>
                  {isMythique ? t('loot.opener.closeIncredible') : t('loot.opener.closeSuper')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  profileInfo: {
    fontSize: FontSize.heading,
    color: '#FFFFFF',
    fontWeight: FontWeight.semibold,
  },
  closeBtn: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.semibold,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },

  // ─── Idle ─────────────────────────────────────────────────────────────
  title: {
    fontSize: 36,
    fontWeight: FontWeight.heavy,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.heading,
    marginBottom: 48,
  },
  chestButton: {
    alignItems: 'center',
    gap: 20,
  },
  packContainer: {
    width: 180,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lootChestImage: {
    width: 220,
    height: 220,
  },
  packGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  openText: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.semibold,
  },

  // ─── Spinning ─────────────────────────────────────────────────────────
  spinContainer: {
    alignItems: 'center',
    gap: 24,
  },
  raysContainer: {
    position: 'absolute',
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinText: {
    fontSize: FontSize.heading,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 16,
  },

  // ─── Reveal ───────────────────────────────────────────────────────────
  revealContainer: {
    alignItems: 'center',
    gap: 20,
  },
  glowCenter: {
    position: 'absolute',
    width: 360,
    height: 360,
    alignItems: 'center',
    justifyContent: 'center',
    top: -20,
  },
  glowBlob: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
  },

  // ─── "INCROYABLE !" banner ────────────────────────────────────────────
  incredibleBanner: {
    zIndex: 10,
    marginBottom: -8,
  },
  incredibleBannerInner: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  incredibleText: {
    color: '#FDE68A',
    fontSize: FontSize.heading,
    fontWeight: FontWeight.heavy,
    letterSpacing: 2,
    textAlign: 'center',
  },
  incredibleTextMythique: {
    color: '#FFD700',
    fontSize: FontSize.titleLg,
    letterSpacing: 3,
    textShadowColor: '#EF4444',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },

  // ─── Reward Card ──────────────────────────────────────────────────────
  rewardCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    minWidth: 280,
    maxWidth: 320,
  },
  rewardCardMythique: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  rarityBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 4,
  },
  mythiqueBadge: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 10,
  },
  seasonalTag: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    marginTop: 4,
    textAlign: 'center',
  },
  rarityText: {
    color: '#FFFFFF',
    fontWeight: FontWeight.heavy,
    fontSize: FontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rewardEmoji: {
    fontSize: 72,
  },
  rewardEmojiMythique: {
    fontSize: 88,
  },
  rewardEmojiLegendaire: {
    fontSize: 80,
  },
  rewardText: {
    fontSize: FontSize.title,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    maxWidth: 260,
  },
  rewardTextMythique: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.heavy,
    textShadowColor: '#EF4444',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  rewardTextLegendaire: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.heavy,
    textShadowColor: '#F59E0B',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  bonusPill: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bonusText: {
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.lg,
  },
  parentNote: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  parentNoteText: {
    color: '#FDE68A',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  specialNote: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  specialNoteText: {
    color: '#FDE68A',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  closeRewardBtn: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  closeRewardText: {
    color: '#FFFFFF',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
});
