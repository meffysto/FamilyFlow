/**
 * DashboardMenage.tsx — Tâches maison du jour
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { DashboardEmptyState } from '../DashboardEmptyState';
import { TaskCard } from '../TaskCard';
import type { DashboardSectionWithTaskToggleProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

function DashboardMenageInner({ vaultFileExists, activateCardTemplate, handleTaskToggle, handleTaskSkip }: DashboardSectionWithTaskToggleProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { tasks } = useVault();

  const todayStr = new Date().toISOString().slice(0, 10);
  const maisonTasks = tasks.filter((t) =>
    t.sourceFile.includes('Maison') && t.dueDate && t.dueDate <= todayStr
  );
  const pendingMaison = maisonTasks.filter((t) => !t.completed);
  const totalMaison = maisonTasks.length;
  const doneMaison = totalMaison - pendingMaison.length;
  const progress = totalMaison > 0 ? doneMaison / totalMaison : 0;

  if (!vaultFileExists.menage) return (
    <DashboardCard key="menage" title={t('dashboard.menage.title')} icon="🏠" color={colors.catOrganisation} tinted>
      <DashboardEmptyState
        description={t('dashboard.menage.emptyDescription')}
        onActivate={() => activateCardTemplate('menage')}
        activateLabel={t('dashboard.menage.activateLabel')}
      />
    </DashboardCard>
  );

  if (pendingMaison.length === 0) return (
    <DashboardCard key="menage" title={t('dashboard.menage.title')} icon="🏠" color={colors.catOrganisation} tinted>
      <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t('dashboard.menage.allDone')}</Text>
    </DashboardCard>
  );

  return (
    <DashboardCard key="menage" title={t('dashboard.menage.title')} icon="🏠" color={colors.catOrganisation} tinted onPressMore={() => router.push({ pathname: '/(tabs)/tasks', params: { filter: 'maison' } })}>
      <View style={styles.metricRow}>
        <Text style={[styles.metricNum, { color: colors.catOrganisation }]}>{doneMaison}/{totalMaison}</Text>
        <Text style={[styles.metricSub, { color: colors.textMuted }]}>{t('dashboard.menage.remaining', { count: pendingMaison.length })}</Text>
      </View>
      <View style={[styles.progressBg, { backgroundColor: colors.cardAlt }]}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.catOrganisation }]} />
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      {pendingMaison.slice(0, 3).map((task) => (
        <TaskCard key={task.id} task={task} onToggle={handleTaskToggle} onSkip={handleTaskSkip} hideSection compact />
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
  metricRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  metricNum: {
    fontSize: 48,
    fontWeight: FontWeight.bold,
    lineHeight: 52,
    letterSpacing: -1,
  },
  metricSub: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    paddingBottom: Spacing.sm,
  },
  progressBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  divider: {
    height: 1,
    marginTop: Spacing.xs,
    marginBottom: 0,
  },
});
