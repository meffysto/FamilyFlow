/**
 * DashboardGratitude.tsx — Section gratitude du jour
 */

import React, { useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { computeGratitudeStreak } from '../../app/(tabs)/gratitude';
import { isBabyProfile } from '../../lib/types';
import { useTranslation } from 'react-i18next';
import type { DashboardSectionProps } from './types';
import { FontSize } from '../../constants/typography';

function DashboardGratitudeInner(_props: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { gratitudeDays, profiles } = useVault();

  const gratitudeProfiles = useMemo(
    () => profiles.filter((p) => p.statut !== 'grossesse' && !isBabyProfile(p)),
    [profiles],
  );

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayGrat = gratitudeDays.find((d) => d.date === todayStr);
  const todayCount = todayGrat?.entries.length ?? 0;
  const gratitudeStreak = useMemo(() => computeGratitudeStreak(gratitudeDays, gratitudeProfiles.length), [gratitudeDays, gratitudeProfiles.length]);

  return (
    <DashboardCard key="gratitude" title={t('dashboard.gratitude.title')} icon="🙏" color={colors.info} onPressMore={() => router.push('/(tabs)/gratitude')}>
      <Text style={[styles.defiMeta, { color: colors.textSub }]}>
        {t('dashboard.gratitude.todayCount', { done: todayCount, total: gratitudeProfiles.length })}
        {gratitudeStreak > 0 ? ` · ${gratitudeStreak}j 🔥` : ''}
      </Text>
    </DashboardCard>
  );
}

export const DashboardGratitude = React.memo(DashboardGratitudeInner);

const styles = StyleSheet.create({
  defiMeta: {
    fontSize: FontSize.caption,
  },
});
