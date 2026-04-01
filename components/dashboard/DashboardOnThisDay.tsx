/**
 * DashboardOnThisDay.tsx — Section "Il y a X an(s)"
 *
 * Affiche les souvenirs (jalons + photos) qui se sont passés à la même date
 * les années précédentes. Retourne null si rien à afficher.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import type { DashboardSectionProps } from './types';

interface OnThisDayItem {
  emoji: string;
  label: string;
  detail: string;
  year: number;
  yearsAgo: number;
}

function DashboardOnThisDayInner(_props: DashboardSectionProps) {
  const { t } = useTranslation();
  const { colors, primary } = useThemeColors();
  const { memories, photoDates, profiles } = useVault();

  const items = useMemo(() => {
    const enfants = profiles.filter((p) => p.role === 'enfant');
    const now = new Date();
    const currentYear = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todaySuffix = `-${mm}-${dd}`;

    const results: OnThisDayItem[] = [];

    // Jalons/souvenirs avec la même date (années précédentes)
    for (const m of memories) {
      if (!m.date || !m.date.endsWith(todaySuffix)) continue;
      const year = parseInt(m.date.substring(0, 4), 10);
      if (year >= currentYear) continue;

      const yearsAgo = currentYear - year;
      results.push({
        emoji: m.type === 'premières-fois' ? '🌟' : '💛',
        label: m.title,
        detail: `${m.enfant} · ${year}`,
        year,
        yearsAgo,
      });
    }

    // Photos prises ce jour-là les années précédentes
    for (const e of enfants) {
      const dates = photoDates[e.id] ?? [];
      for (const d of dates) {
        if (!d.endsWith(todaySuffix)) continue;
        const year = parseInt(d.substring(0, 4), 10);
        if (year >= currentYear) continue;

        results.push({
          emoji: '📸',
          label: t('dashboard.onThisDay.photoOf', { name: e.name }),
          detail: String(year),
          year,
          yearsAgo: currentYear - year,
        });
      }
    }

    // Trier par année la plus récente d'abord
    results.sort((a, b) => b.year - a.year);

    return results;
  }, [memories, photoDates, profiles]);

  if (items.length === 0) return null;

  return (
    <DashboardCard
      title={t('dashboard.onThisDay.title')}
      icon="🕰️"
      count={items.length}
      color={colors.catSouvenirs}
      tinted
      collapsible
      cardId="onThisDay"
    >
      {items.map((item, i) => {
        const yearsLabel = t('dashboard.onThisDay.yearsAgo', { count: item.yearsAgo });

        return (
          <View
            key={`${item.label}-${item.year}-${i}`}
            style={[styles.row, { borderLeftColor: primary }]}
          >
            <View style={styles.rowContent}>
              <Text style={[styles.title, { color: colors.text }]}>
                {item.emoji} {item.label}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {yearsLabel} · {item.detail}
              </Text>
            </View>
          </View>
        );
      })}
    </DashboardCard>
  );
}

export const DashboardOnThisDay = React.memo(DashboardOnThisDayInner);

const styles = StyleSheet.create({
  row: {
    paddingVertical: Spacing.md,
    borderLeftWidth: 3,
    paddingLeft: Spacing.lg,
    gap: Spacing.xxs,
  },
  rowContent: {
    gap: Spacing.xxs,
  },
  title: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  meta: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
  },
});
