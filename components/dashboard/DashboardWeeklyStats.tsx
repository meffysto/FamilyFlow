/**
 * DashboardWeeklyStats.tsx — Section stats de la semaine
 */

import React, { useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { aggregateTasksByWeek, getWeekStart } from '../../lib/stats';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight, FontFamily } from '../../constants/typography';

function DashboardWeeklyStatsInner(_props: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { tasks } = useVault();

  const weeklyStatsData = useMemo(() => {
    const weekStart = getWeekStart(new Date());
    const data = aggregateTasksByWeek(tasks, weekStart);
    const total = data.reduce((s, d) => s + d.value, 0);
    return { data, total };
  }, [tasks]);

  const { total: weekTotal } = weeklyStatsData;
  if (weekTotal === 0) return null;

  return (
    <DashboardCard
      key="weeklyStats"
      title={t('dashboard.weeklyStats.title')}
      variant="metric"
      onPressMore={() => router.push('/(tabs)/stats')}
      hideMoreLink
      style={{ flex: 1 }}
    >
      <Text style={[styles.statSentence, { color: colors.text }]}>
        <Text style={[styles.statNumber, { color: colors.brand.soil }]}>{weekTotal}</Text>
        {' '}
        {t('dashboard.weeklyStats.summary', { count: weekTotal })}
      </Text>
    </DashboardCard>
  );
}

export const DashboardWeeklyStats = React.memo(DashboardWeeklyStatsInner);

const styles = StyleSheet.create({
  statSentence: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.normal,
    lineHeight: 22,
  },
  statNumber: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.heading + 4, // 22px DM Serif intégré dans la phrase
    letterSpacing: -0.3,
  },
});
