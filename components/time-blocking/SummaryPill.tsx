/**
 * SummaryPill.tsx — Pill résumé du temps libre total du jour
 *
 * Phase quick-260516-oj6 — Time-blocking mode Journée.
 *
 * Affichée entre les day pills et la SectionList. Donne le total de temps libre
 * agrégé sur les 4 slots + nombre de tâches placées.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface SummaryPillProps {
  totalFreeMinutes: number;
  placedCount: number;
  dayLabel: string;
}

function formatTotal(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}`;
}

export const SummaryPill = React.memo(function SummaryPill({
  totalFreeMinutes,
  placedCount,
  dayLabel,
}: SummaryPillProps) {
  const { colors } = useThemeColors();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: colors.brand.or },
        ]}
      >
        <Sparkles size={14} color={colors.bg} strokeWidth={2.5} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.text }]}>
          {formatTotal(totalFreeMinutes)} de libre {dayLabel}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {placedCount} {placedCount > 1 ? 'tâches placées' : 'tâche placée'}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing['2xl'],
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  meta: {
    fontSize: FontSize.caption,
    marginTop: 2,
  },
});
