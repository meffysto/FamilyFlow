/**
 * DashboardDefis.tsx — Section défis familiaux
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { DashboardCard } from '../DashboardCard';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';

function DashboardDefisInner(_props: DashboardSectionProps) {
  const { t } = useTranslation();
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
    <DashboardCard key="defis" title={t('dashboard.defis.title')} icon="🏅" count={activeDefis.length} color={colors.catJeux} tinted onPressMore={() => router.push('/(tabs)/defis')}>
      <View style={styles.defiHeader}>
        <Text style={styles.defiEmoji}>{mainDefi.emoji}</Text>
        <Text style={[styles.defiTitle, { color: colors.text }]} numberOfLines={1}>{mainDefi.title}</Text>
        {!todayDone && activeProfile && (
          <TouchableOpacity
            style={[styles.defiCheckBtn, { backgroundColor: colors.warning }]}
            onPress={async () => {
              await checkInDefi(mainDefi.id, activeProfile.id, true);
              showToast(t('dashboard.defis.checkinToast', { emoji: mainDefi.emoji, title: mainDefi.title }));
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.defiCheckText, { color: colors.onPrimary }]}>✓</Text>
          </TouchableOpacity>
        )}
        {todayDone && <Text style={{ color: colors.success, fontSize: FontSize.heading }}>✅</Text>}
      </View>
      <View style={[styles.defiProgressBg, { backgroundColor: colors.cardAlt }]}>
        <View style={[styles.defiProgressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.warning }]} />
      </View>
      <Text style={[styles.defiMeta, { color: colors.textMuted }]}>{uniqueDays}/{mainDefi.targetDays} {t('dashboard.defis.days')}</Text>
      {activeDefis.length > 1 && (
        <TouchableOpacity onPress={() => router.push('/(tabs)/defis')} activeOpacity={0.7}>
          <Text style={[styles.seeAllText, { color: primary }]}>{t('dashboard.defis.seeMore', { count: activeDefis.length - 1 })}</Text>
        </TouchableOpacity>
      )}
    </DashboardCard>
  );
}

export const DashboardDefis = React.memo(DashboardDefisInner);

const styles = StyleSheet.create({
  defiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  defiEmoji: {
    fontSize: FontSize.icon,
  },
  defiTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    flex: 1,
  },
  defiProgressBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  defiProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  defiMeta: {
    fontSize: FontSize.caption,
  },
  defiCheckBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defiCheckText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.heavy,
  },
  seeAllText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
});
