/**
 * DashboardMenage.tsx — Section ménage du jour
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { DashboardEmptyState } from '../DashboardEmptyState';
import { TaskCard } from '../TaskCard';
import type { DashboardSectionWithTaskToggleProps } from './types';
import { FontSize } from '../../constants/typography';

function DashboardMenageInner({ vaultFileExists, activateCardTemplate, handleTaskToggle }: DashboardSectionWithTaskToggleProps) {
  const router = useRouter();
  const { colors } = useThemeColors();
  const { tasks } = useVault();

  const todayStr = new Date().toISOString().slice(0, 10);
  const isMenageTask = (t: { section?: string }) =>
    t.section != null && /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s/i.test(t.section);
  const pendingMenage = tasks.filter((t) => isMenageTask(t) && !t.completed && (!t.dueDate || t.dueDate <= todayStr));

  if (!vaultFileExists.menage) return (
    <DashboardCard key="menage" title="Ménage du jour" icon="🧹" color={colors.success}>
      <DashboardEmptyState
        description="Organisez le ménage par jour avec des tâches récurrentes"
        onActivate={() => activateCardTemplate('menage')}
        activateLabel="Importer le modèle"
      />
    </DashboardCard>
  );

  if (pendingMenage.length === 0) return (
    <DashboardCard key="menage" title="Ménage du jour" icon="🧹" color={colors.success}>
      <Text style={[styles.emptyHint, { color: colors.textMuted }]}>Tout est fait pour aujourd'hui ✓</Text>
    </DashboardCard>
  );

  return (
    <DashboardCard key="menage" title="Ménage du jour" icon="🧹" count={pendingMenage.length} color={colors.success} onPressMore={() => router.push('/(tabs)/tasks')}>
      {pendingMenage.slice(0, 4).map((task) => (
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
