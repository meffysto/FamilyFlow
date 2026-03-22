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
import { BarChart } from '../charts';
import { aggregateTasksByWeek, getWeekStart } from '../../lib/stats';
import type { DashboardSectionProps } from './types';
import { FontSize } from '../../constants/typography';

function DashboardWeeklyStatsInner(_props: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { primary, colors } = useThemeColors();
  const { tasks } = useVault();

  const weeklyStatsData = useMemo(() => {
    const weekStart = getWeekStart(new Date());
    const data = aggregateTasksByWeek(tasks, weekStart);
    const total = data.reduce((s, d) => s + d.value, 0);
    return { data, total };
  }, [tasks]);

  const { data: weekData, total: weekTotal } = weeklyStatsData;
  if (weekTotal === 0) return null;

  return (
    <DashboardCard
      key="weeklyStats"
      title={t('dashboard.weeklyStats.title')}
      icon="📊"
      count={weekTotal}
      color={primary}
      onPressMore={() => router.push('/(tabs)/stats')}
    >
      <BarChart data={weekData} compact showValues={false} barColor={primary} />
      <Text style={[styles.weekStatsSummary, { color: colors.textMuted }]}>
        {t('dashboard.weeklyStats.summary', { count: weekTotal })}
      </Text>
    </DashboardCard>
  );
}

export const DashboardWeeklyStats = React.memo(DashboardWeeklyStatsInner);

const styles = StyleSheet.create({
  weekStatsSummary: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    marginTop: 4,
  },
});
