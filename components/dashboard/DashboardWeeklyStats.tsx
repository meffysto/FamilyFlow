/**
 * DashboardWeeklyStats.tsx — Section stats de la semaine
 */

import React, { useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { BarChart } from '../charts';
import { aggregateTasksByWeek, getWeekStart } from '../../lib/stats';
import type { DashboardSectionProps } from './types';

function DashboardWeeklyStatsInner(_props: DashboardSectionProps) {
  const router = useRouter();
  const { primary, colors } = useThemeColors();
  const { tasks, menageTasks } = useVault();

  const weeklyStatsData = useMemo(() => {
    const weekStart = getWeekStart(new Date());
    const all = [...tasks, ...menageTasks];
    const data = aggregateTasksByWeek(all, weekStart);
    const total = data.reduce((s, d) => s + d.value, 0);
    return { data, total };
  }, [tasks, menageTasks]);

  const { data: weekData, total: weekTotal } = weeklyStatsData;
  if (weekTotal === 0) return null;

  return (
    <DashboardCard
      key="weeklyStats"
      title="Stats semaine"
      icon="📊"
      count={weekTotal}
      color={primary}
      onPressMore={() => router.push('/(tabs)/stats')}
    >
      <BarChart data={weekData} compact showValues={false} barColor={primary} />
      <Text style={[styles.weekStatsSummary, { color: colors.textMuted }]}>
        {weekTotal} tâche{weekTotal !== 1 ? 's' : ''} cette semaine
      </Text>
    </DashboardCard>
  );
}

export const DashboardWeeklyStats = React.memo(DashboardWeeklyStatsInner);

const styles = StyleSheet.create({
  weekStatsSummary: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
