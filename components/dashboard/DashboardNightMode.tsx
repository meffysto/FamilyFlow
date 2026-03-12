/**
 * DashboardNightMode.tsx — Section mode nuit bébé
 */

import React, { useMemo } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { isBabyProfile } from '../../lib/types';
import type { DashboardSectionProps } from './types';

function DashboardNightModeInner(_props: DashboardSectionProps) {
  const router = useRouter();
  const { colors } = useThemeColors();
  const { profiles } = useVault();

  const hasBaby = useMemo(() => profiles.some(isBabyProfile), [profiles]);
  if (!hasBaby) return null;

  const hour = new Date().getHours();
  const isNightTime = hour >= 20 || hour < 8;
  if (!isNightTime) return null;

  return (
    <DashboardCard key="nightMode" title="Mode nuit bébé" icon="🌙" color="#B8860B" onPressMore={() => router.push('/(tabs)/night-mode')}>
      <TouchableOpacity
        style={[styles.nightModeBtn, { backgroundColor: colors.cardAlt }]}
        onPress={() => router.push('/(tabs)/night-mode')}
        activeOpacity={0.7}
      >
        <Text style={[styles.nightModeBtnTitle, { color: colors.text }]}>🌙 Ouvrir le mode nuit</Text>
        <Text style={[styles.nightModeBtnSub, { color: colors.textMuted }]}>Écran sombre pour les tétées nocturnes</Text>
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
    fontSize: 15,
    fontWeight: '600' as const,
  },
  nightModeBtnSub: {
    fontSize: 13,
    marginTop: 4,
  },
});
