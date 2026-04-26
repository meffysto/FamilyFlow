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
import { AnimatedProgressBar } from './AnimatedProgressBar';
import { TaskCard } from '../TaskCard';
import type { DashboardSectionWithTaskToggleProps } from './types';
import { FontSize, FontWeight, FontFamily } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Sparkles } from 'lucide-react-native';

function DashboardMenageInner({ vaultFileExists, activateCardTemplate, handleTaskToggle, handleTaskSkip }: DashboardSectionWithTaskToggleProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { tasks } = useVault();

  const todayStr = new Date().toISOString().slice(0, 10);
  const maisonTasks = tasks.filter((t) =>
    t.sourceFile.includes('Maison') &&
    ((t.dueDate && t.dueDate <= todayStr) || t.completedDate === todayStr)
  );
  const pendingMaison = maisonTasks.filter((t) => !t.completed);
  const totalMaison = maisonTasks.length;
  const doneMaison = totalMaison - pendingMaison.length;
  const progress = totalMaison > 0 ? doneMaison / totalMaison : 0;

  if (!vaultFileExists.menage) return (
    <DashboardCard key="menage" title={t('dashboard.menage.title')} variant="metric" IconComponent={Sparkles} color={colors.catOrganisation}>
      <DashboardEmptyState
        description={t('dashboard.menage.emptyDescription')}
        onActivate={() => activateCardTemplate('menage')}
        activateLabel={t('dashboard.menage.activateLabel')}
      />
    </DashboardCard>
  );

  if (pendingMaison.length === 0) return (
    <DashboardCard key="menage" title={t('dashboard.menage.title')} variant="metric" IconComponent={Sparkles} color={colors.catOrganisation}>
      <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t('dashboard.menage.allDone')}</Text>
    </DashboardCard>
  );

  return (
    <DashboardCard key="menage" title={t('dashboard.menage.title')} variant="metric" IconComponent={Sparkles} color={colors.catOrganisation} onPressMore={() => router.push({ pathname: '/(tabs)/tasks', params: { filter: 'maison' } })}>
      <Text style={[styles.sentence, { color: colors.text }]}>
        <Text style={[styles.metricNum, { color: colors.catOrganisation }]}>{doneMaison}/{totalMaison}</Text>
        {' '}
        {t('dashboard.menage.remaining', { count: pendingMaison.length })}
      </Text>
      <AnimatedProgressBar progress={progress} color={colors.catOrganisation} backgroundColor={colors.brand.wash} height={6} />

      <View style={[styles.divider, { backgroundColor: colors.brand.bark }]} />
      {pendingMaison.slice(0, 3).map((task) => (
        <TaskCard key={task.id} task={task} onToggle={handleTaskToggle} onSkip={handleTaskSkip} hideSection compact />
      ))}
    </DashboardCard>
  );
}

export const DashboardMenage = React.memo(DashboardMenageInner);

const styles = StyleSheet.create({
  emptyHint: {
    fontFamily: FontFamily.handwrite,
    fontSize: FontSize.subtitle,
    textAlign: 'center',
    paddingVertical: 4,
  },
  sentence: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.normal,
    lineHeight: 26,
    marginBottom: Spacing.md,
  },
  metricNum: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.heading + 4, // 22px DM Serif intégré
    letterSpacing: -0.3,
  },
  divider: {
    height: 1,
    marginTop: Spacing.xs,
    marginBottom: 0,
  },
});
