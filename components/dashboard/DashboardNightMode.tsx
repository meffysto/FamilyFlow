/**
 * DashboardNightMode.tsx — Section mode nuit bébé
 */

import React, { useMemo } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Moon } from 'lucide-react-native';
import { DashboardCard } from '../DashboardCard';
import { isBabyProfile } from '../../lib/types';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';

function DashboardNightModeInner(_props: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { profiles } = useVault();

  const hasBaby = useMemo(() => profiles.some(isBabyProfile), [profiles]);
  if (!hasBaby) return null;

  const hour = new Date().getHours();
  const isNightTime = hour >= 20 || hour < 8;
  if (!isNightTime) return null;

  return (
    <DashboardCard key="nightMode" title={t('dashboard.nightMode.title')} IconComponent={Moon} color={colors.catSante} tinted onPressMore={() => router.push('/(tabs)/night-mode')}>
      <TouchableOpacity
        style={[styles.nightModeBtn, { backgroundColor: colors.brand.wash, borderWidth: 1, borderColor: colors.brand.bark }]}
        onPress={() => router.push('/(tabs)/night-mode')}
        activeOpacity={0.7}
      >
        <Text style={[styles.nightModeBtnTitle, { color: colors.text }]}>{t('dashboard.nightMode.openBtn')}</Text>
        <Text style={[styles.nightModeBtnSub, { color: colors.textMuted }]}>{t('dashboard.nightMode.subtitle')}</Text>
      </TouchableOpacity>
    </DashboardCard>
  );
}

export const DashboardNightMode = React.memo(DashboardNightModeInner);

const styles = StyleSheet.create({
  nightModeBtn: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center' as const,
  },
  nightModeBtnTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  nightModeBtnSub: {
    fontSize: FontSize.label,
    marginTop: 4,
  },
});
