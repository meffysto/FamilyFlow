/**
 * DashboardMenage.tsx — Tâches maison du jour
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { DashboardEmptyState } from '../DashboardEmptyState';
import { TaskCard } from '../TaskCard';
import { useTranslation } from 'react-i18next';
import type { DashboardSectionWithTaskToggleProps } from './types';
import { FontSize } from '../../constants/typography';

function DashboardMenageInner({ vaultFileExists, activateCardTemplate, handleTaskToggle }: DashboardSectionWithTaskToggleProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { tasks } = useVault();

  const todayStr = new Date().toISOString().slice(0, 10);
  const pendingMaison = tasks.filter((t) =>
    t.sourceFile.includes('Maison') && !t.completed && t.dueDate && t.dueDate <= todayStr
  );

  if (!vaultFileExists.menage) return (
    <DashboardCard key="menage" title={t('dashboard.menage.title')} icon="🏠" color={colors.success}>
      <DashboardEmptyState
        description={t('dashboard.menage.emptyDescription')}
        onActivate={() => activateCardTemplate('menage')}
        activateLabel={t('dashboard.menage.activateLabel')}
      />
    </DashboardCard>
  );

  if (pendingMaison.length === 0) return (
    <DashboardCard key="menage" title={t('dashboard.menage.title')} icon="🏠" color={colors.success}>
      <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t('dashboard.menage.allDone')}</Text>
    </DashboardCard>
  );

  return (
    <DashboardCard key="menage" title={t('dashboard.menage.title')} icon="🏠" count={pendingMaison.length} color={colors.success} onPressMore={() => router.push({ pathname: '/(tabs)/tasks', params: { filter: 'maison' } })}>
      {pendingMaison.slice(0, 4).map((task) => (
        <TaskCard key={task.id} task={task} onToggle={handleTaskToggle} hideSection compact />
      ))}
    </DashboardCard>
  );
}

export const DashboardMenage = React.memo(DashboardMenageInner);

const styles = StyleSheet.create({
  emptyHint: {
    fontSize: FontSize.label,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 4,
  },
});
