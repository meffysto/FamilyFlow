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
    <DashboardCard key="moods" title={t('dashboard.moods.title')} icon="🌤️" color={colors.catSante} tinted onPressMore={() => router.push('/(tabs)/moods' as any)} hideMoreLink style={{ flex: 1, marginBottom: 0 }}>
      {todayMoods.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          {t('dashboard.moods.empty')}
        </Text>
      ) : (
        <View style={styles.row}>
          {moodableProfiles.map(p => {
            const entry = todayMoods.find(m => m.profileId === p.id);
            if (!entry) return null;
            return (
              <View key={p.id} style={styles.moodItem}>
                <Text style={styles.emoji}>{MOOD_EMOJIS[entry.level]}</Text>
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
    gap: Spacing.lg,
    justifyContent: 'center',
  },
  moodItem: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 32,
  },
  name: {
    fontSize: FontSize.caption,
    marginTop: Spacing.xs,
  },
});
