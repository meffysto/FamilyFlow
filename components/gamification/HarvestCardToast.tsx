/**
 * HarvestCardToast.tsx — Carte de récolte animée avec accumulation live
 *
 * Slide-up spring depuis le bas, affiche :
 *   - Emoji principal + titre "Récolte !"
 *   - Chips items accumulés (merge qty si même emoji)
 *   - Sparkles au pop et à chaque merge
 *   - Timer bar 3s (reset à chaque item ajouté)
 *   - Badge loot 🎁 optionnel
 *
 * Géré par ToastContext.showHarvestCard().
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
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

// ─── Constantes animations (identiques à RewardCardToast) ─────────────────────

const SPRING_IN = { damping: 26, stiffness: 200 } as const;
const SPRING_OUT = { damping: 28, stiffness: 180 } as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HarvestItem {
  emoji: string;
  label: string;
  qty: number;
  /** Phase 40 — info Sporée scellée : affiche badge 🍄 ×N + 🎁 si drop-back. */
  wager?: {
    won: boolean;
    multiplier: number;
    dropBack: boolean;
  };
}

interface HarvestCardToastProps {
  visible: boolean;
  items: HarvestItem[];
  onDismiss: () => void;
  hasLoot?: boolean;
  /** Clé incrémentée à chaque merge — re-trigger sparkles + pulse */
  sparkleKey?: number;
}

// ─── Composant Sparkle ────────────────────────────────────────────────────────

interface SparkleProps {
  triggerKey: number;
  offsetX: number;
  offsetY: number;
  delay: number;
  reduceMotion: boolean;
}

function Sparkle({ triggerKey, offsetX, offsetY, delay, reduceMotion }: SparkleProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (triggerKey === 0) return;

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
  }, [triggerKey, offsetX, offsetY, delay, reduceMotion, translateX, translateY, opacity, scale]);

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

// ─── Composant Chip item ──────────────────────────────────────────────────────

interface ItemChipProps {
  item: HarvestItem;
  index: number;
  isNew: boolean;
  pulseKey: number;
  reduceMotion: boolean;
  primaryColor: string;
}

function ItemChip({ item, index, isNew, pulseKey, reduceMotion, primaryColor }: ItemChipProps) {
  const scale = useSharedValue(isNew ? 0 : 1);
  const prevPulseKey = useRef(pulseKey);

  // Entrée pour nouveau chip
  useEffect(() => {
    if (isNew) {
      if (reduceMotion) {
        scale.value = 1;
      } else {
        scale.value = withDelay(index * 40, withSpring(1, SPRING_IN));
      }
    }
  }, [isNew, index, reduceMotion, scale]);

  // Pulse quand qty change (pulseKey increment)
  useEffect(() => {
    if (pulseKey === prevPulseKey.current) return;
    prevPulseKey.current = pulseKey;
    if (!isNew && !reduceMotion) {
      scale.value = withSpring(1.15, { damping: 10, stiffness: 400 }, () => {
        scale.value = withSpring(1, { damping: 14, stiffness: 300 });
      });
    }
  }, [pulseKey, isNew, reduceMotion, scale]);

  const chipStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.chip,
        {
          backgroundColor: item.wager?.won ? 'rgba(255,215,0,0.25)' : 'rgba(255,255,255,0.18)',
          borderColor: item.wager?.won ? 'rgba(255,215,0,0.6)' : 'rgba(255,255,255,0.35)',
        },
        chipStyle,
      ]}
    >
      <Text style={styles.chipEmoji}>{item.emoji}</Text>
      <Text style={[styles.chipQty, { color: '#FFFFFF' }]}>×{item.qty}</Text>
      {item.wager?.won && (
        <View style={styles.wagerBadge}>
          <Text style={styles.wagerBadgeText}>{'🍄×'}{item.wager.multiplier}</Text>
        </View>
      )}
      {item.wager?.dropBack && (
        <Text style={styles.chipEmoji}>{'🎁'}</Text>
      )}
    </Animated.View>
  );
}

// ─── Timer Bar ────────────────────────────────────────────────────────────────

interface TimerBarProps {
  timerKey: number;
  reduceMotion: boolean;
  primaryColor: string;
}

function TimerBar({ timerKey, reduceMotion, primaryColor }: TimerBarProps) {
  const progress = useSharedValue(1);

  useEffect(() => {
    if (timerKey === 0) return;
    // Reset à 1 puis anime vers 0 en 3000ms
    progress.value = 1;
    if (reduceMotion) {
      progress.value = 0;
    } else {
      progress.value = withTiming(0, {
        duration: 3000,
        easing: Easing.linear,
      });
    }
  }, [timerKey, reduceMotion, progress]);

  // Utiliser width% via animated style — évite transformOrigin non supporté en RN
  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as `${number}%`,
  }));

  return (
    <View style={styles.timerTrack}>
      <Animated.View
        style={[
          styles.timerFill,
          { backgroundColor: 'rgba(255,255,255,0.6)' },
          fillStyle,
        ]}
      />
    </View>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function HarvestCardToast({
  visible,
  items,
  onDismiss,
  hasLoot = false,
  sparkleKey = 0,
}: HarvestCardToastProps) {
  const insets = useSafeAreaInsets();
  const { primary } = useThemeColors();
  const reduceMotion = useReducedMotion();

  const translateY = useSharedValue(200);
  const opacity = useSharedValue(0);

  // Suivi des chips déjà rendus pour distinguer nouveau vs existant
  const prevItemsRef = useRef<Set<string>>(new Set());
  const [renderedItems, setRenderedItems] = useState<Array<{ item: HarvestItem; isNew: boolean; pulseKey: number }>>([]);

  // Haptics au pop initial
  const didHapticPop = useRef(false);
  const prevSparkleKey = useRef(sparkleKey);

  // Animation entrée/sortie
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
      didHapticPop.current = false;
      if (reduceMotion) {
        translateY.value = 200;
        opacity.value = 0;
      } else {
        translateY.value = withSpring(200, SPRING_OUT);
        opacity.value = withTiming(0, { duration: 250 });
      }
    }
  }, [visible, reduceMotion, translateY, opacity]);

  // Haptic au pop initial
  useEffect(() => {
    if (visible && !didHapticPop.current) {
      didHapticPop.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [visible]);

  // Haptic selectionAsync à chaque merge (sparkleKey change)
  useEffect(() => {
    if (sparkleKey === prevSparkleKey.current) return;
    prevSparkleKey.current = sparkleKey;
    if (sparkleKey > 1) {
      // sparkleKey 1 = pop initial (déjà haptic via visible), >1 = merge
      Haptics.selectionAsync().catch(() => {});
    }
  }, [sparkleKey]);

  // Mise à jour des chips rendus
  useEffect(() => {
    if (!visible && items.length === 0) {
      prevItemsRef.current = new Set();
      setRenderedItems([]);
      return;
    }

    setRenderedItems(prev => {
      const nextEmojis = new Set(items.map(i => i.emoji));
      const result = items.map(item => {
        const existing = prev.find(r => r.item.emoji === item.emoji);
        if (!existing) {
          // Nouveau chip
          prevItemsRef.current.add(item.emoji);
          return { item, isNew: true, pulseKey: sparkleKey };
        }
        // Mise à jour qty — pulse si qty change
        const qtyChanged = existing.item.qty !== item.qty;
        return {
          item,
          isNew: false,
          pulseKey: qtyChanged ? sparkleKey : existing.pulseKey,
        };
      });
      // Supprimer les emojis qui ne sont plus dans items
      return result.filter(r => nextEmojis.has(r.item.emoji));
    });
  }, [items, sparkleKey, visible]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // Emoji principal = premier item ou 📦 par défaut
  const mainEmoji = items.length > 0 ? items[0].emoji : '📦';
  const subtitle = items.length > 1 ? 'Récoltes en cours...' : 'Récolte prête !';

  // Ne pas retourner null : laisser l'animation de sortie jouer
  // (masqué par opacity 0 via animation)
  if (!visible && items.length === 0) return null;

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
      <Sparkle triggerKey={sparkleKey} offsetX={-60} offsetY={-50} delay={0}   reduceMotion={reduceMotion ?? false} />
      <Sparkle triggerKey={sparkleKey} offsetX={60}  offsetY={-40} delay={80}  reduceMotion={reduceMotion ?? false} />
      <Sparkle triggerKey={sparkleKey} offsetX={-50} offsetY={-30} delay={150} reduceMotion={reduceMotion ?? false} />
      <Sparkle triggerKey={sparkleKey} offsetX={70}  offsetY={-60} delay={200} reduceMotion={reduceMotion ?? false} />

      {/* Carte principale */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: primary + 'F0',
            borderColor: primary + '33',
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.mainEmoji}>{mainEmoji}</Text>
          <View style={styles.titleGroup}>
            <Text style={[styles.title, { color: '#FFFFFF' }]}>Récolte !</Text>
            <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          {hasLoot && (
            <Text style={styles.lootBadge}>🎁</Text>
          )}
        </View>

        {/* Chips items */}
        <View style={styles.chipsRow}>
          {renderedItems.map(({ item, isNew, pulseKey }, idx) => (
            <ItemChip
              key={item.emoji}
              item={item}
              index={idx}
              isNew={isNew}
              pulseKey={pulseKey}
              reduceMotion={reduceMotion ?? false}
              primaryColor={primary}
            />
          ))}
        </View>

        {/* Timer bar */}
        <TimerBar
          timerKey={sparkleKey}
          reduceMotion={reduceMotion ?? false}
          primaryColor={primary}
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
    fontSize: 18,
  },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  mainEmoji: {
    fontSize: FontSize.icon,
    lineHeight: 34,
  },
  titleGroup: {
    flex: 1,
    gap: Spacing.xxs,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    lineHeight: 18,
  },
  subtitle: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
    lineHeight: 16,
  },
  lootBadge: {
    fontSize: FontSize.lg,
    lineHeight: 24,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    minHeight: 32,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },
  chipEmoji: {
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  chipQty: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    lineHeight: 18,
  },
  wagerBadge: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
  },
  wagerBadgeText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    color: '#FFE27A',
    lineHeight: 14,
  },
  timerTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.xxs,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    borderRadius: Radius.xxs,
  },
});
