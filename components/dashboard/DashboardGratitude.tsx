/**
 * DashboardGratitude.tsx — Section gratitude du jour
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { computeGratitudeStreak } from '../../app/(tabs)/gratitude';
import { isBabyProfile } from '../../lib/types';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';
import { Spacing, Radius } from '../../constants/spacing';

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

  const firstEntry = todayGrat?.entries[0];

  return (
    <DashboardCard key="gratitude" title={t('dashboard.gratitude.title')} color={colors.catSouvenirs} tinted onPressMore={() => router.push('/(tabs)/gratitude' as any)} hideMoreLink style={{ flex: 1 }}>
      {firstEntry ? (
        <>
          <View style={[styles.quoteBorder, { backgroundColor: colors.brand.wash, borderLeftWidth: 2, borderLeftColor: colors.brand.bark }]}>
            <Text style={[styles.quoteText, { color: colors.text }]} numberOfLines={3}>
              "{firstEntry.text}"
            </Text>
          </View>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {t('dashboard.gratitude.todayCount', { done: todayCount, total: gratitudeProfiles.length })}
            {gratitudeStreak > 0 ? ` · ${gratitudeStreak}j 🔥` : ''}
          </Text>
        </>
      ) : (
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {t('dashboard.gratitude.todayCount', { done: todayCount, total: gratitudeProfiles.length })}
          {gratitudeStreak > 0 ? ` · ${gratitudeStreak}j 🔥` : ''}
        </Text>
      )}
    </DashboardCard>
  );
}

export const DashboardGratitude = React.memo(DashboardGratitudeInner);

const styles = StyleSheet.create({
  quoteBorder: {
    padding: Spacing.md,
    borderRadius: Radius.sm,
    marginBottom: Spacing.sm,
  },
  quoteText: {
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    lineHeight: 20,
    fontWeight: FontWeight.medium,
  },
  meta: {
    fontSize: FontSize.micro,
  },
});
