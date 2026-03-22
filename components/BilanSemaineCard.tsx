/**
 * BilanSemaineCard.tsx — Carte récapitulatif hebdomadaire style Instagram Story
 *
 * Affiche le bilan de la semaine avec stats, récit IA et citation enfant.
 * Animation d'entrée avec react-native-reanimated (FadeInDown + stagger).
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '../contexts/ThemeContext';
import { FontSize, FontWeight, LineHeight } from '../constants/typography';
import { Spacing, Radius } from '../constants/spacing';
import { useTranslation } from 'react-i18next';
import { Shadows } from '../constants/shadows';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BilanSemaineCardProps {
  weekLabel: string;         // "Semaine du 16 au 22 mars"
  tasksCompleted: number;
  mealsCookedCount: number;
  moodsAverage: number | null;
  aiNarrative: string;       // Texte généré par l'IA
  quote?: { citation: string; enfant: string };  // Meilleure citation de la semaine
  onShare?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Emoji humeur selon la moyenne (1-5) */
function getMoodEmoji(avg: number | null): string {
  if (avg === null) return '😶';
  if (avg >= 4.5) return '😄';
  if (avg >= 3.5) return '🙂';
  if (avg >= 2.5) return '😐';
  if (avg >= 1.5) return '😕';
  return '😢';
}

/** Label humeur selon la moyenne */
function getMoodLabel(avg: number | null): string {
  if (avg === null) return 'N/A';
  return avg.toFixed(1);
}

// ─── Composant ───────────────────────────────────────────────────────────────

export function BilanSemaineCard({
  weekLabel,
  tasksCompleted,
  mealsCookedCount,
  moodsAverage,
  aiNarrative,
  quote,
  onShare,
}: BilanSemaineCardProps) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();

  return (
    <Animated.View
      entering={FadeInDown.duration(500).springify()}
      style={[styles.card, Shadows.lg, { backgroundColor: colors.card }]}
    >
      {/* ── En-tête ── */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>👨‍👩‍👧‍👦</Text>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{weekLabel}</Text>
      </View>

      {/* ── Ligne de stats ── */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(400).springify()}
        style={styles.statsRow}
      >
        {/* Tâches */}
        <View style={styles.statItem}>
          <View style={[styles.statBadge, { backgroundColor: tint }]}>
            <Text style={styles.statEmoji}>✅</Text>
            <Text style={[styles.statValue, { color: primary }]}>{tasksCompleted}</Text>
          </View>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('bilanSemaine.tasks')}</Text>
        </View>

        {/* Repas */}
        <View style={styles.statItem}>
          <View style={[styles.statBadge, { backgroundColor: tint }]}>
            <Text style={styles.statEmoji}>🍽️</Text>
            <Text style={[styles.statValue, { color: primary }]}>{mealsCookedCount}</Text>
          </View>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('bilanSemaine.meals')}</Text>
        </View>

        {/* Humeur */}
        <View style={styles.statItem}>
          <View style={[styles.statBadge, { backgroundColor: tint }]}>
            <Text style={styles.statEmoji}>{getMoodEmoji(moodsAverage)}</Text>
            <Text style={[styles.statValue, { color: primary }]}>{getMoodLabel(moodsAverage)}</Text>
          </View>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('bilanSemaine.mood')}</Text>
        </View>
      </Animated.View>

      {/* ── Récit IA ── */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(400).springify()}
        style={[styles.narrativeContainer, { backgroundColor: tint }]}
      >
        <Text style={[styles.narrativeText, { color: colors.text }]}>
          {aiNarrative}
        </Text>
      </Animated.View>

      {/* ── Citation enfant ── */}
      {quote && (
        <Animated.View
          entering={FadeInDown.delay(300).duration(400).springify()}
          style={[styles.quoteBubble, { backgroundColor: tint, borderColor: primary }]}
        >
          <Text style={[styles.quoteText, { color: colors.text }]}>
            « {quote.citation} »
          </Text>
          <Text style={[styles.quoteAuthor, { color: colors.textMuted }]}>
            — {quote.enfant}
          </Text>
        </Animated.View>
      )}

      {/* ── Bouton Partager ── */}
      {onShare && (
        <Animated.View entering={FadeInDown.delay(400).duration(400).springify()}>
          <TouchableOpacity
            onPress={onShare}
            style={[styles.shareButton, { backgroundColor: primary }]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('bilanSemaine.shareA11y')}
          >
            <Text style={[styles.shareButtonText, { color: colors.onPrimary }]}>
              {t('common.share')}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    padding: Spacing['3xl'],
    gap: Spacing['2xl'],
  },

  // En-tête
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerEmoji: {
    fontSize: FontSize.icon,
  },
  headerTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    flex: 1,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: Spacing.md,
  },
  statItem: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statBadge: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxs,
  },
  statEmoji: {
    fontSize: FontSize.title,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  statLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },

  // Récit IA
  narrativeContainer: {
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
  },
  narrativeText: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.loose,
    fontWeight: FontWeight.normal,
  },

  // Citation enfant
  quoteBubble: {
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
    borderLeftWidth: 3,
  },
  quoteText: {
    fontSize: FontSize.body,
    fontStyle: 'italic',
    lineHeight: LineHeight.body,
  },
  quoteAuthor: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.sm,
    textAlign: 'right',
  },

  // Bouton partager
  shareButton: {
    borderRadius: Radius.base,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});
