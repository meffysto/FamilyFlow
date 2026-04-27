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
import { Heart } from 'lucide-react-native';
import { DashboardCard } from '../DashboardCard';
import { computeGratitudeStreak } from '../../app/(tabs)/gratitude';
import { isBabyProfile } from '../../lib/types';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight, FontFamily } from '../../constants/typography';
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
    <DashboardCard key="gratitude" title={t('dashboard.gratitude.title')} IconComponent={Heart} color={colors.catSouvenirs} tinted onPressMore={() => router.push('/(tabs)/gratitude' as any)} hideMoreLink style={{ flex: 1 }}>
      <Text style={[styles.metric, { color: colors.text }]}>
        <Text style={[styles.metricCount, { color: colors.catSouvenirs }]}>{todayCount}</Text>
        {`/${gratitudeProfiles.length} aujourd'hui`}
      </Text>
      {firstEntry && (
        <View style={[styles.quoteBorder, { backgroundColor: colors.brand.wash, borderLeftWidth: 2, borderLeftColor: colors.brand.bark }]}>
          <Text style={[styles.quoteText, { color: colors.text }]} numberOfLines={2}>
            "{firstEntry.text}"
          </Text>
        </View>
      )}
      {gratitudeStreak > 0 && (
        <Text style={[styles.streak, { color: colors.textMuted }]}>{gratitudeStreak}j 🔥</Text>
      )}
    </DashboardCard>
  );
}

export const DashboardGratitude = React.memo(DashboardGratitudeInner);

const styles = StyleSheet.create({
  metric: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.normal,
    lineHeight: 26,
    marginBottom: Spacing.sm,
  },
  metricCount: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.titleLg,
    letterSpacing: -0.3,
  },
  quoteBorder: {
    padding: Spacing.md,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  quoteText: {
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    lineHeight: 20,
    fontWeight: FontWeight.medium,
  },
  streak: {
    fontSize: FontSize.caption,
    marginTop: Spacing.sm,
  },
});
