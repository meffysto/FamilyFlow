/**
 * DashboardCourses.tsx — Section courses avec ajout rapide
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';

function DashboardCoursesInner(_props: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { courses } = useVault();

  const unchecked = courses.filter((c) => !c.completed);
  const topCourses = unchecked.slice(-5).reverse();

  return (
    <DashboardCard key="courses" title={t('dashboard.courses.title')} icon="🛒" color={colors.catOrganisation} tinted onPressMore={() => router.push({ pathname: '/(tabs)/meals', params: { tab: 'courses' } })} hideMoreLink style={{ flex: 1 }}>
      <Text style={[styles.courseCount, { color: colors.catOrganisation }]}>{unchecked.length}</Text>
      {topCourses.slice(0, 3).map((item) => (
        <Text key={item.id} style={[styles.courseMicro, { color: colors.textMuted }]} numberOfLines={1}>
          • {item.text}
        </Text>
      ))}
      {topCourses.length === 0 && (
        <Text style={[styles.courseEmpty, { color: colors.textFaint }]}>{t('dashboard.courses.emptyList')}</Text>
      )}
    </DashboardCard>
  );
}

export const DashboardCourses = React.memo(DashboardCoursesInner);

const styles = StyleSheet.create({
  courseCount: {
    fontSize: 38,
    fontWeight: FontWeight.bold,
    lineHeight: 42,
    letterSpacing: -1,
  },
  courseMicro: {
    fontSize: FontSize.micro,
    lineHeight: 14,
  },
  courseEmpty: {
    fontSize: FontSize.caption,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
});
