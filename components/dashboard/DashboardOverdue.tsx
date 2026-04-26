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
import { AlertTriangle } from 'lucide-react-native';
import { DashboardCard } from '../DashboardCard';
import { TaskCard } from '../TaskCard';
import type { DashboardSectionWithTaskToggleProps } from './types';
import { FontSize, FontWeight, FontFamily } from '../../constants/typography';
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
    <DashboardCard key="overdue" title={t('dashboard.overdue.title')} IconComponent={AlertTriangle} count={overdueTasks.length} color={colors.error} variant="critical" onPressMore={() => router.push({ pathname: '/(tabs)/tasks', params: { filter: 'retard' } })}>
      <Text style={[styles.metricSentence, { color: colors.text }]}>
        <Text style={[styles.metricNum, { color: colors.error }]}>{overdueTasks.length}</Text>
        {' '}
        {t('dashboard.overdue.metricSentence', { count: overdueTasks.length })}
      </Text>
      <Text style={[styles.metricSub, { color: colors.brand.soilMuted }]}>
        {t('dashboard.overdue.metricSub')}
      </Text>
      <View style={[styles.divider, { backgroundColor: colors.brand.bark }]} />
      {overdueTasks.slice(0, 3).map((task) => (
        <TaskCard key={task.id} task={task} onToggle={handleTaskToggle} onSkip={handleTaskSkip} hideSection compact />
      ))}
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  metricSentence: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.normal,
    lineHeight: 28,
  },
  metricNum: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.display, // 24px DM Serif intégré dans la phrase
    letterSpacing: -0.4,
  },
  metricSub: {
    fontFamily: FontFamily.handwrite,
    fontSize: FontSize.subtitle,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
});

export const DashboardOverdue = React.memo(DashboardOverdueInner);
