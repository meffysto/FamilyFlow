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
import type { DashboardSectionProps } from './types';

function DashboardGratitudeInner(_props: DashboardSectionProps) {
  const router = useRouter();
  const { colors } = useThemeColors();
  const { gratitudeDays, profiles } = useVault();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayGrat = gratitudeDays.find((d) => d.date === todayStr);
  const todayCount = todayGrat?.entries.length ?? 0;
  const gratitudeStreak = useMemo(() => computeGratitudeStreak(gratitudeDays, profiles.length), [gratitudeDays, profiles.length]);

  return (
    <DashboardCard key="gratitude" title="Gratitude" icon="🙏" color={colors.info} onPressMore={() => router.push('/(tabs)/gratitude')}>
      <Text style={[styles.defiMeta, { color: colors.textSub }]}>
        {todayCount}/{profiles.length} aujourd'hui
        {gratitudeStreak > 0 ? ` · ${gratitudeStreak}j 🔥` : ''}
      </Text>
    </DashboardCard>
  );
}

export const DashboardGratitude = React.memo(DashboardGratitudeInner);

const styles = StyleSheet.create({
  defiMeta: {
    fontSize: 12,
  },
});
