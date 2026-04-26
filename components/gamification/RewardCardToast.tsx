/**
 * RewardCardToast.tsx — Bandeau reward animé pour la validation de tâche
 *
 * Slide-up spring depuis le bas, layout compact une ligne :
 *   - Emoji (🎁 si loot, sinon avatar profil) + nom du profil
 *   - Compteur XP animé "+N pts" + niveau
 *   - Fine barre de progression sous la ligne
 *   - Sparkles au pop
 *
 * Géré par ToastContext.showRewardCard().
 */

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

// ─── Constantes animations ────────────────────────────────────────────────────

const SPRING_IN = { damping: 26, stiffness: 200 } as const;
const SPRING_OUT = { damping: 28, stiffness: 180 } as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RewardCardData {
  /** Emoji avatar du profil */
  profileEmoji: string;
  /** Nom du profil */
  profileName: string;
  /** Texte de la tâche accomplie */
  taskTitle: string;
  /** Points gagnés (ex: 10) */
  xpGained: number;
  /** Points totaux APRÈS gain */
  currentXP: number;
  /** Progression 0-1 dans le niveau courant */
  levelProgress: number;
  /** Niveau actuel */
  level: number;
  /** XP cumulé nécessaire pour atteindre le niveau suivant */
  xpForNextLevel: number;
  /** Badge cadeau si loot */
  hasLoot: boolean;
}

interface RewardCardToastProps {
  visible: boolean;
  data: RewardCardData | null;
  onDismiss: () => void;
}

// ─── Composant Sparkle ────────────────────────────────────────────────────────

interface SparkleProps {
  visible: boolean;
  offsetX: number;
  offsetY: number;
  delay: number;
  reduceMotion: boolean;
}

function Sparkle({ visible, offsetX, offsetY, delay, reduceMotion }: SparkleProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      translateX.value = 0;
      translateY.value = 0;
      opacity.value = 1;
      scale.value = 1;

      if (reduceMotion) {
        opacity.value = 0;
      } else {
        translateX.value = withDelay(delay, withTiming(offsetX, { duration: 700, easing: Easing.out(Easing.cubic) }));
        translateY.value = withDelay(delay, withTiming(offsetY, { duration: 700, easing: Easing.out(Easing.cubic) }));
        opacity.value = withDelay(delay, withTiming(0, { duration: 700 }));
        scale.value = withDelay(delay, withTiming(0.3, { duration: 700 }));
      }
    } else {
      translateX.value = 0;
      translateY.value = 0;
      opacity.value = 0;
      scale.value = 1;
    }
  }, [visible, offsetX, offsetY, delay, reduceMotion, translateX, translateY, opacity, scale]);

  const sparkleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.sparkle, sparkleStyle]} pointerEvents="none">
      <Text style={styles.sparkleText}>✨</Text>
    </Animated.View>
  );
}

// ─── Compteur XP animé (polling JS ~60fps pendant 850ms) ─────────────────────

interface AnimatedCounterProps {
  visible: boolean;
  targetValue: number;
  reduceMotion: boolean;
  color: string;
}

function AnimatedCounter({ visible, targetValue, reduceMotion, color }: AnimatedCounterProps) {
  const [displayVal, setDisplayVal] = useState(0);
  const frameRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (frameRef.current) clearTimeout(frameRef.current);
    setDisplayVal(0);

    if (!visible) return;

    if (reduceMotion) {
      setDisplayVal(targetValue);
      return;
    }

    let elapsed = 0;
    const TICK = 16;
    const DURATION = 850;

    const tick = () => {
      elapsed += TICK;
      const t = Math.min(elapsed / DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayVal(Math.round(eased * targetValue));
      if (elapsed < DURATION) {
        frameRef.current = setTimeout(tick, TICK);
      }
    };

    frameRef.current = setTimeout(tick, TICK);

    return () => {
      if (frameRef.current) clearTimeout(frameRef.current);
    };
  }, [visible, targetValue, reduceMotion]);

  return <Text style={[styles.xpCounter, { color }]}>+{displayVal} pts</Text>;
}

// ─── Barre de progression niveau ─────────────────────────────────────────────

interface XPBarProps {
  visible: boolean;
  progress: number;
  reduceMotion: boolean;
  fillColor: string;
  trackColor: string;
}

function XPBar({ visible, progress, reduceMotion, fillColor, trackColor }: XPBarProps) {
  const barWidth = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      barWidth.value = 0;
      if (reduceMotion) {
        barWidth.value = progress;
      } else {
        barWidth.value = withDelay(300, withTiming(progress, {
          duration: 600,
          easing: Easing.out(Easing.cubic),
        }));
      }
    } else {
      barWidth.value = 0;
    }
  }, [visible, progress, reduceMotion, barWidth]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%` as `${number}%`,
  }));

  return (
    <View style={[styles.xpBarTrack, { backgroundColor: trackColor }]}>
      <Animated.View style={[styles.xpBarFill, { backgroundColor: fillColor }, fillStyle]} />
    </View>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function RewardCardToast({ visible, data, onDismiss }: RewardCardToastProps) {
  const insets = useSafeAreaInsets();
  const { primary, colors } = useThemeColors();
  const reduceMotion = useReducedMotion();

  const translateY = useSharedValue(200);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      if (reduceMotion) {
        translateY.value = 0;
        opacity.value = 1;
      } else {
        translateY.value = withSpring(0, SPRING_IN);
        opacity.value = withTiming(1, { duration: 250 });
      }
    } else {
      if (reduceMotion) {
        translateY.value = 200;
        opacity.value = 0;
      } else {
        translateY.value = withSpring(200, SPRING_OUT);
        opacity.value = withTiming(0, { duration: 250 });
      }
    }
  }, [visible, reduceMotion, translateY, opacity]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!data) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        { bottom: insets.bottom + Spacing['3xl'] },
        cardStyle,
      ]}
    >
      {/* Sparkles — 4 positions autour de la carte */}
      <Sparkle visible={visible} offsetX={-60} offsetY={-50} delay={0}   reduceMotion={reduceMotion ?? false} />
      <Sparkle visible={visible} offsetX={60}  offsetY={-40} delay={80}  reduceMotion={reduceMotion ?? false} />
      <Sparkle visible={visible} offsetX={-50} offsetY={-30} delay={150} reduceMotion={reduceMotion ?? false} />
      <Sparkle visible={visible} offsetX={70}  offsetY={-60} delay={200} reduceMotion={reduceMotion ?? false} />

      <View style={[
        styles.bandeau,
        {
          backgroundColor: colors.brand.cardSurface,
          borderColor: colors.brand.bark,
        },
      ]}>
        <View style={styles.bandeauRow}>
          <Text style={styles.bandeauEmoji}>{data.hasLoot ? '🎁' : data.profileEmoji}</Text>
          <Text
            style={[styles.bandeauName, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {data.profileName}
          </Text>
          <View style={styles.bandeauSpacer} />
          <AnimatedCounter
            visible={visible}
            targetValue={data.xpGained}
            reduceMotion={reduceMotion ?? false}
            color={primary}
          />
          <Text style={[styles.bandeauLevel, { color: colors.textMuted }]}>· Niv. {data.level}</Text>
        </View>
        <XPBar
          visible={visible}
          progress={data.levelProgress}
          reduceMotion={reduceMotion ?? false}
          fillColor={primary}
          trackColor={colors.brand.wash}
        />
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing['2xl'],
    right: Spacing['2xl'],
    zIndex: 9999,
  },
  sparkle: {
    position: 'absolute',
    top: 0,
    left: '50%',
  },
  sparkleText: {
    fontSize: 20,
  },
  bandeau: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  bandeauRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bandeauEmoji: {
    fontSize: FontSize.subtitle,
  },
  bandeauName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flexShrink: 1,
  },
  bandeauSpacer: {
    flex: 1,
  },
  bandeauLevel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
  },
  xpCounter: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    lineHeight: 20,
  },
  xpBarTrack: {
    height: 4,
    borderRadius: Radius.xxs,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: Radius.xxs,
  },
});
