/**
 * DashboardLeaderboard.tsx — Section classement familial
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { buildLeaderboard } from '../../lib/gamification';
import type { DashboardSectionProps } from './types';
import { FontSize, FontFamily } from '../../constants/typography';

function DashboardLeaderboardInner(_props: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { profiles } = useVault();

  const leaderboard = buildLeaderboard(profiles);
  if (leaderboard.length === 0) return null;

  const first = leaderboard[0];

  return (
    <DashboardCard key="leaderboard" title={t('dashboard.leaderboard.title')} color={colors.catJeux} tinted onPressMore={() => router.push('/(tabs)/loot')} hideMoreLink style={{ flex: 1 }}>
      <Text style={styles.medal}>🥇</Text>
      <Text style={[styles.firstName, { color: colors.text }]} numberOfLines={1}>{first.name}</Text>
      <Text style={[styles.firstPts, { color: colors.brand.soilMuted }]}>{first.points ?? 0} pts</Text>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  medal: {
    fontSize: 32,
  },
  firstName: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.lg,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  firstPts: {
    fontFamily: FontFamily.handwrite,
    fontSize: FontSize.sm,
  },
});

export const DashboardLeaderboard = React.memo(DashboardLeaderboardInner);
