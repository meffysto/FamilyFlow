/**
 * CampExplorationCell.tsx — Cellule spéciale ferme Camp d'exploration
 * Phase 33 — Système d'expéditions à risque
 *
 * Affiche le Camp d'exploration sur la grille ferme avec :
 * - Badge "1/2" ou "2/2" si expéditions actives
 * - Badge "Retour !" avec pulse animation si résultat prêt
 * - Pilule timer stylisée sous le sprite (une ligne par expédition)
 */

import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Farm } from '../../constants/farm-theme';
import { CAMP_EXPLORATION_CELL } from '../../lib/mascot/world-grid';

// ── Assets ───────────────────────────────────────────────────────────────────

const EXPEDITION_BOAT = require('../../assets/garden/decos/expedition_boat.png');

// ── Constantes module ─────────────────────────────────────────────────────────

const CELL_SIZE = 64;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMinutes(minutes: number): string {
  if (!isFinite(minutes) || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  activeCount: number;
  hasResult: boolean;
  remainingMinutes: number[];
  onPress: () => void;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function CampExplorationCell({ activeCount, hasResult, remainingMinutes, onPress }: Props) {
  const { colors } = useThemeColors();

  const isIdle = activeCount === 0 && !hasResult;

  // Animation pulse pour le badge "Retour !"
  const pulseScale = useSharedValue(1);
  const pulseAnim = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Animation bob flottant pour la bulle "!" idle
  const bobY = useSharedValue(0);
  const bobAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: bobY.value }],
  }));

  useEffect(() => {
    if (hasResult) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 400 }),
          withTiming(1, { duration: 400 }),
        ),
        2,
        false,
      );
    } else {
      pulseScale.value = 1;
    }
  }, [hasResult, pulseScale]);

  useEffect(() => {
    if (isIdle) {
      bobY.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 1200 }),
          withTiming(0, { duration: 1200 }),
        ),
        -1,
        true,
      );
    } else {
      bobY.value = 0;
    }
  }, [isIdle, bobY]);

  // Timers triés du plus court au plus long, filtre les terminés (0m)
  const activeTimers = remainingMinutes
    .filter(m => isFinite(m) && m > 0)
    .sort((a, b) => a - b);
  const showTimers = activeTimers.length > 0 && !hasResult;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel="Camp d'exploration"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {/* Sprite principal — barque d'exploration */}
      <Image source={EXPEDITION_BOAT} style={styles.boatSprite} />

      {/* Badge compteur actif — top-right */}
      {activeCount > 0 && (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{`${activeCount}/2`}</Text>
        </View>
      )}

      {/* Badge "Retour !" avec pulse — bottom */}
      {hasResult && (
        <Animated.View style={[styles.resultBadge, { backgroundColor: colors.success }, pulseAnim]}>
          <Text style={styles.resultBadgeText}>{'Retour !'}</Text>
        </Animated.View>
      )}

      {/* Bulle "!" dorée flottante — aucune expédition en cours */}
      {isIdle && (
        <Animated.View style={[styles.idleBubble, bobAnim]}>
          <View style={styles.idleBubbleInner}>
            <Text style={styles.idleBubbleText}>{'!'}</Text>
          </View>
          <View style={styles.idleBubbleTail} />
        </Animated.View>
      )}

      {/* Pilule timer stylisée sous le sprite */}
      {showTimers && (
        <View style={styles.timerPill}>
          {activeTimers.map((min, i) => (
            <View key={i} style={styles.timerRow}>
              <MaterialCommunityIcons name="compass-outline" size={10} color={Farm.brownText} />
              <Text style={styles.timerText}>{formatMinutes(min)}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  boatSprite: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    resizeMode: 'contain',
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    height: 20,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Farm.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
    color: Farm.goldText,
  },
  resultBadge: {
    position: 'absolute',
    bottom: -8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  resultBadgeText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  idleBubble: {
    position: 'absolute',
    top: -18,
    alignItems: 'center',
  },
  idleBubbleInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Farm.gold,
    borderWidth: 2,
    borderColor: Farm.goldText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idleBubbleText: {
    fontSize: 13,
    fontWeight: FontWeight.heavy,
    color: Farm.goldText,
    marginTop: -1,
  },
  idleBubbleTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Farm.goldText,
    marginTop: -1,
  },
  timerPill: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    backgroundColor: Farm.parchmentDark,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    gap: 1,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timerText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },
});

// Export de la constante pour usage externe (positionnement dans tree.tsx)
export { CAMP_EXPLORATION_CELL };
