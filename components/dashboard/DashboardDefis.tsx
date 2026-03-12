/**
 * DashboardDefis.tsx — Section défis familiaux
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { DashboardCard } from '../DashboardCard';
import type { DashboardSectionProps } from './types';

function DashboardDefisInner(_props: DashboardSectionProps) {
  const router = useRouter();
  const { primary, colors } = useThemeColors();
  const { showToast } = useToast();
  const { defis, checkInDefi, activeProfile } = useVault();

  const activeDefis = defis.filter((d) => d.status === 'active');
  if (activeDefis.length === 0) return null;

  const mainDefi = activeDefis[0];
  const uniqueDays = new Set(mainDefi.progress.filter((p) => p.completed).map((p) => p.date)).size;
  const progress = mainDefi.targetDays > 0 ? uniqueDays / mainDefi.targetDays : 0;
  const todayStr2 = new Date().toISOString().slice(0, 10);
  const todayDone = activeProfile ? mainDefi.progress.some((p) => p.date === todayStr2 && p.profileId === activeProfile.id && p.completed) : false;

  return (
    <DashboardCard key="defis" title="Défis familiaux" icon="🏅" count={activeDefis.length} color="#F59E0B" onPressMore={() => router.push('/(tabs)/defis')}>
      <View style={styles.defiRow}>
        <Text style={styles.defiEmoji}>{mainDefi.emoji}</Text>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.defiTitle, { color: colors.text }]} numberOfLines={1}>{mainDefi.title}</Text>
          <View style={[styles.defiProgressBg, { backgroundColor: colors.cardAlt }]}>
            <View style={[styles.defiProgressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: '#F59E0B' }]} />
          </View>
          <Text style={[styles.defiMeta, { color: colors.textMuted }]}>{uniqueDays}/{mainDefi.targetDays} jours</Text>
        </View>
        {!todayDone && activeProfile && (
          <TouchableOpacity
            style={[styles.defiCheckBtn, { backgroundColor: '#F59E0B' }]}
            onPress={async () => {
              await checkInDefi(mainDefi.id, activeProfile.id, true);
              showToast(`Check-in ${mainDefi.emoji} ${mainDefi.title}`);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.defiCheckText, { color: colors.onPrimary }]}>✓</Text>
          </TouchableOpacity>
        )}
        {todayDone && <Text style={{ color: colors.success, fontSize: 18 }}>✅</Text>}
      </View>
      {activeDefis.length > 1 && (
        <TouchableOpacity onPress={() => router.push('/(tabs)/defis')} activeOpacity={0.7}>
          <Text style={[styles.seeAllText, { color: primary }]}>+{activeDefis.length - 1} autre{activeDefis.length > 2 ? 's' : ''} →</Text>
        </TouchableOpacity>
      )}
    </DashboardCard>
  );
}

export const DashboardDefis = React.memo(DashboardDefisInner);

const styles = StyleSheet.create({
  defiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  defiEmoji: {
    fontSize: 28,
  },
  defiTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  defiProgressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  defiProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  defiMeta: {
    fontSize: 12,
  },
  defiCheckBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defiCheckText: {
    fontSize: 16,
    fontWeight: '800',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
