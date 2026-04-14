/**
 * CampExplorationCell.tsx — Cellule spéciale ferme Camp d'exploration
 * Phase 33 — Système d'expéditions à risque
 *
 * Affiche le Camp d'exploration sur la grille ferme avec :
 * - Badge "1/2" ou "2/2" si expéditions actives
 * - Badge "Retour !" avec pulse animation si résultat prêt
 * - Mini countdown sous le sprite
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

// ── Constantes module ─────────────────────────────────────────────────────────

const CELL_SIZE = 64;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMinutes(minutes: number): string {
  if (!isFinite(minutes) || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  activeCount: number;
  hasResult: boolean;
  shortestRemaining: number;
  onPress: () => void;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function CampExplorationCell({ activeCount, hasResult, shortestRemaining, onPress }: Props) {
  const { colors } = useThemeColors();

  // Animation pulse pour le badge "Retour !"
  const pulseScale = useSharedValue(1);
  const pulseAnim = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
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

  const countdownText = formatMinutes(shortestRemaining);
  const showCountdown = activeCount > 0 && !hasResult && countdownText.length > 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel="Camp d'exploration"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {/* Sprite principal — tente/boussole sur fond parchemin */}
      <View style={[styles.spriteCircle, { backgroundColor: Farm.parchmentDark, borderColor: Farm.woodHighlight }]}>
        <MaterialCommunityIcons name="tent" size={36} color={Farm.woodDark} />
      </View>

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

      {/* Mini countdown sous le sprite */}
      {showCountdown && (
        <Text style={[styles.countdown, { color: colors.textMuted }]}>
          {countdownText}
        </Text>
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
  spriteCircle: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
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
  countdown: {
    position: 'absolute',
    bottom: -20,
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
});

// Export de la constante pour usage externe (positionnement dans tree.tsx)
export { CAMP_EXPLORATION_CELL };
