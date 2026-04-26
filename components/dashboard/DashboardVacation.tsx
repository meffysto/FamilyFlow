/**
 * DashboardVacation.tsx — Section vacances
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { TaskCard } from '../TaskCard';
import type { DashboardSectionWithTaskToggleProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';

function DashboardVacationInner({ handleTaskToggle, handleTaskSkip }: DashboardSectionWithTaskToggleProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { vacationTasks, vacationConfig, isVacationActive } = useVault();

  if (!isVacationActive || !vacationConfig) return null;

  const vacCompleted = vacationTasks.filter((t) => t.completed).length;
  const vacTotal = vacationTasks.length;
  const vacIncomplete = vacationTasks.filter((t) => !t.completed).slice(0, 5);
  const now = new Date();
  const start = new Date(vacationConfig.startDate + 'T00:00:00');
  const end = new Date(vacationConfig.endDate + 'T23:59:59');
  let vacCountdown: string;
  if (now < start) {
    const days = Math.ceil((start.getTime() - now.getTime()) / 86400000);
    vacCountdown = t('dashboard.vacation.departureIn', { count: days });
  } else if (now <= end) {
    const days = Math.ceil((end.getTime() - now.getTime()) / 86400000);
    vacCountdown = days > 0 ? t('dashboard.vacation.returnIn', { count: days }) : t('dashboard.vacation.lastDay');
  } else {
    vacCountdown = t('dashboard.vacation.finished');
  }
  const progress = vacTotal > 0 ? vacCompleted / vacTotal : 0;

  return (
    <DashboardCard key="vacation" title={t('dashboard.vacation.title')} color={colors.catSysteme} tinted onPressMore={() => router.push('/(tabs)/tasks')}>
      <Text style={[styles.vacCountdown, { color: colors.warning }]}>{vacCountdown}</Text>
      <View style={styles.vacProgressRow}>
        <View style={[styles.vacProgressBg, { backgroundColor: colors.borderLight }]}>
          <View style={[styles.vacProgressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.warning }]} />
        </View>
        <Text style={[styles.vacProgressText, { color: colors.textMuted }]}>{vacCompleted}/{vacTotal}</Text>
      </View>
      {vacIncomplete.map((task) => (
        <TaskCard key={task.id} task={task} onToggle={handleTaskToggle} onSkip={handleTaskSkip} />
      ))}
    </DashboardCard>
  );
}

export const DashboardVacation = React.memo(DashboardVacationInner);

const styles = StyleSheet.create({
  vacCountdown: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.heavy,
    marginBottom: 6,
  },
  vacProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  vacProgressBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  vacProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  vacProgressText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
});
