/**
 * DashboardMoods.tsx — Météo des humeurs familiales
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { MOOD_EMOJIS } from '../../lib/types';
import type { DashboardSectionProps } from './types';
import { FontSize } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

function DashboardMoodsInner(_props: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { moods, profiles } = useVault();

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMoods = useMemo(
    () => moods.filter(m => m.date === todayStr),
    [moods, todayStr],
  );

  const moodableProfiles = useMemo(
    () => profiles.filter(p => p.statut !== 'grossesse'),
    [profiles],
  );

  return (
    <DashboardCard key="moods" title={t('dashboard.moods.title')} icon="🌤️" color={colors.info} onPressMore={() => router.push('/(tabs)/moods' as any)}>
      {todayMoods.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          {t('dashboard.moods.empty')}
        </Text>
      ) : (
        <View style={styles.row}>
          {moodableProfiles.map(p => {
            const entry = todayMoods.find(m => m.profileId === p.id);
            return (
              <View key={p.id} style={styles.moodItem}>
                <Text style={styles.emoji}>{entry ? MOOD_EMOJIS[entry.level] : '⬜'}</Text>
                <Text style={[styles.name, { color: colors.textSub }]} numberOfLines={1}>{p.name}</Text>
              </View>
            );
          })}
        </View>
      )}
    </DashboardCard>
  );
}

export const DashboardMoods = React.memo(DashboardMoodsInner);

const styles = StyleSheet.create({
  empty: {
    fontSize: FontSize.caption,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  moodItem: {
    alignItems: 'center',
    minWidth: 48,
  },
  emoji: {
    fontSize: 24,
  },
  name: {
    fontSize: FontSize.micro,
    marginTop: Spacing.xxs,
  },
});
