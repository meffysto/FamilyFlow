/**
 * DashboardMoods.tsx — Météo des humeurs familiales
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Smile } from 'lucide-react-native';
import { DashboardCard } from '../DashboardCard';
import { MOOD_ICONS, getMoodIconColor } from '../../lib/mood-ui';
import type { DashboardSectionProps } from './types';
import { FontSize, FontFamily } from '../../constants/typography';
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
    <DashboardCard key="moods" title={t('dashboard.moods.title')} IconComponent={Smile} color={colors.catSante} tinted onPressMore={() => router.push('/(tabs)/moods' as any)} hideMoreLink style={{ flex: 1 }}>
      {todayMoods.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          {t('dashboard.moods.empty')}
        </Text>
      ) : (
        <View style={styles.row}>
          {moodableProfiles.map(p => {
            const entry = todayMoods.find(m => m.profileId === p.id);
            if (!entry) return null;
            const Icon = MOOD_ICONS[entry.level];
            return (
              <View
                key={p.id}
                style={styles.moodItem}
                accessible
                accessibilityLabel={t('moodsScreen.a11y.moodLevelFor', { level: entry.level, name: p.name })}
              >
                <Icon size={28} strokeWidth={1.75} color={getMoodIconColor(entry.level, colors)} />
                <Text style={[styles.name, { color: colors.textMuted }]} numberOfLines={1}>{p.name}</Text>
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
    fontFamily: FontFamily.handwrite,
    fontSize: FontSize.subtitle,
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
    fontFamily: FontFamily.handwrite,
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
});
