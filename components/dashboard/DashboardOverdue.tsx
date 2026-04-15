/**
 * DashboardOverdue.tsx — Section tâches en retard
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { TaskCard } from '../TaskCard';
import type { DashboardSectionWithTaskToggleProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

function DashboardOverdueInner({ handleTaskToggle, handleTaskSkip }: DashboardSectionWithTaskToggleProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { tasks } = useVault();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const overdueTasks = tasks.filter(
    (t) => !t.completed && t.dueDate && t.dueDate < todayStr
  );

  if (overdueTasks.length === 0) return null;

  return (
    <DashboardCard key="overdue" title={t('dashboard.overdue.title')} icon="⚠️" count={overdueTasks.length} color={colors.catSante} tinted onPressMore={() => router.push({ pathname: '/(tabs)/tasks', params: { filter: 'retard' } })}>
      <View style={styles.metricRow}>
        <Text style={[styles.metricNum, { color: colors.catSante }]}>{overdueTasks.length}</Text>
        <View style={styles.metricLabel}>
          <Text style={[styles.metricWord, { color: colors.catSante }]}>{t('dashboard.overdue.metricWord')}</Text>
          <Text style={[styles.metricSub, { color: colors.textMuted }]}>{t('dashboard.overdue.metricSub')}</Text>
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      {overdueTasks.slice(0, 3).map((task) => (
        <TaskCard key={task.id} task={task} onToggle={handleTaskToggle} onSkip={handleTaskSkip} hideSection compact />
      ))}
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.lg,
    marginBottom: 0,
  },
  metricNum: {
    fontSize: 48,
    fontWeight: FontWeight.bold,
    lineHeight: 52,
    letterSpacing: -1,
  },
  metricLabel: {
    paddingBottom: Spacing.xs,
    gap: 2,
  },
  metricWord: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.7,
  },
  metricSub: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  divider: {
    height: 1,
    marginTop: Spacing.xs,
    marginBottom: 0,
  },
});

export const DashboardOverdue = React.memo(DashboardOverdueInner);
