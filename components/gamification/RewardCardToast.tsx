/**
 * RewardCardToast.tsx — Carte reward animée pour la validation de tâche
 *
 * Slide-up spring depuis le bas, affiche :
 *   - Avatar emoji + nom du profil
 *   - Tâche barrée
 *   - Compteur XP animé 0→N pts
 *   - Barre de progression niveau animée
 *   - Sparkles au pop
 *   - Badge cadeau si loot
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

    // Interpolation easeOutCubic JS-side (~60fps pendant 850ms)
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

  return (
    <Text style={[styles.xpCounter, { color }]}>+{displayVal} pts</Text>
  );
}

// ─── Barre de progression niveau ─────────────────────────────────────────────

interface XPBarProps {
  visible: boolean;
  progress: number;
  level: number;
  reduceMotion: boolean;
  primaryColor: string;
  trackColor: string;
}

function XPBar({ visible, progress, level, reduceMotion, primaryColor, trackColor }: XPBarProps) {
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
    <View style={styles.xpBarRow}>
      <View style={[styles.xpBarTrack, { backgroundColor: trackColor }]}>
        <Animated.View
          style={[styles.xpBarFill, { backgroundColor: primaryColor }, fillStyle]}
        />
      </View>
      <Text style={[styles.levelLabel, { color: 'rgba(255,255,255,0.9)' }]}>Niv. {level}</Text>
    </View>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function RewardCardToast({ visible, data, onDismiss }: RewardCardToastProps) {
  const insets = useSafeAreaInsets();
  const { primary } = useThemeColors();
  const reduceMotion = useReducedMotion();

  const translateY = useSharedValue(200);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Entrée : slide-up spring
      if (reduceMotion) {
        translateY.value = 0;
        opacity.value = 1;
      } else {
        translateY.value = withSpring(0, SPRING_IN);
        opacity.value = withTiming(1, { duration: 250 });
      }
    } else {
      // Sortie : spring vers le bas
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

  const taskShort = data.taskTitle.length > 30
    ? data.taskTitle.slice(0, 30) + '…'
    : data.taskTitle;

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

      {/* Carte principale */}
      <View style={[
        styles.card,
        {
          backgroundColor: primary + 'F0',
          borderColor: primary + '33',
        },
      ]}>
        {/* Gauche : avatar + nom */}
        <View style={styles.avatarCol}>
          <Text style={styles.avatarEmoji}>{data.profileEmoji}</Text>
          <Text style={[styles.profileName, { color: 'rgba(255,255,255,0.9)' }]} numberOfLines={1}>
            {data.profileName}
          </Text>
        </View>

        {/* Centre : tâche + XP + barre */}
        <View style={styles.centerCol}>
          <Text style={[styles.taskTitle, { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
            {taskShort}
          </Text>
          <AnimatedCounter
            visible={visible}
            targetValue={data.xpGained}
            reduceMotion={reduceMotion ?? false}
            color="#FFFFFF"
          />
          <XPBar
            visible={visible}
            progress={data.levelProgress}
            level={data.level}
            reduceMotion={reduceMotion ?? false}
            primaryColor="#FFFFFF"
            trackColor="rgba(255,255,255,0.25)"
          />
        </View>

        {/* Droite : badge loot (optionnel) */}
        {data.hasLoot && (
          <Text style={styles.lootBadge}>🎁</Text>
        )}
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  avatarCol: {
    alignItems: 'center',
    gap: Spacing.xs,
    minWidth: 40,
  },
  avatarEmoji: {
    fontSize: FontSize.hero,
    lineHeight: 36,
  },
  profileName: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
  centerCol: {
    flex: 1,
    gap: Spacing.xs,
  },
  taskTitle: {
    fontSize: FontSize.sm,
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  xpCounter: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.bold,
    lineHeight: 28,
  },
  xpBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  xpBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: Radius.xxs,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: Radius.xxs,
  },
  levelLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
    opacity: 0.7,
  },
  lootBadge: {
    fontSize: FontSize.icon,
    lineHeight: 32,
  },
});
