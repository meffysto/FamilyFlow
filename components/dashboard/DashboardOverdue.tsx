/**
 * DashboardOverdue.tsx — Section tâches en retard
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { TaskCard } from '../TaskCard';
import type { DashboardSectionWithTaskToggleProps } from './types';

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
    <DashboardCard key="overdue" title={t('dashboard.overdue.title')} icon="⚠️" count={overdueTasks.length} color={colors.catSante} tinted onPressMore={() => router.push('/(tabs)/tasks')}>
      {overdueTasks.slice(0, 3).map((task) => (
        <TaskCard key={task.id} task={task} onToggle={handleTaskToggle} onSkip={handleTaskSkip} hideSection compact />
      ))}
    </DashboardCard>
  );
}

export const DashboardOverdue = React.memo(DashboardOverdueInner);
