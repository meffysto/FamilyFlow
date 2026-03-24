/**
 * DashboardAnniversaires.tsx — Section anniversaires dans les 7 prochains jours
 *
 * Retourne null si aucun anniversaire imminent (la carte n'apparaît pas).
 * Jour J : affichage festif avec l'âge si birthYear disponible.
 * J-1 à J-7 : "dans X jours".
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import type { Anniversary } from '../../lib/types';
import type { DashboardSectionProps } from './types';

interface UpcomingAnniversary {
  anniversary: Anniversary;
  daysUntil: number;
  age: number | null;
}

/**
 * Calcule les jours restants avant un anniversaire (MM-DD) par rapport à aujourd'hui.
 * Retourne 0 pour aujourd'hui, 1 pour demain, etc.
 * Si la date est passée cette année, calcule pour l'année prochaine.
 */
function getDaysUntilAnniversary(mmdd: string, now: Date): number {
  const [mm, dd] = mmdd.split('-').map(Number);
  if (!mm || !dd) return -1;

  const year = now.getFullYear();
  const thisYear = new Date(year, mm - 1, dd);
  thisYear.setHours(0, 0, 0, 0);

  const today = new Date(year, now.getMonth(), now.getDate());
  today.setHours(0, 0, 0, 0);

  const diff = Math.round((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) {
    // Anniversaire déjà passé cette année
    const nextYear = new Date(year + 1, mm - 1, dd);
    return Math.round((nextYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  return diff;
}

function DashboardAnniversairesInner(_props: DashboardSectionProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { anniversaries } = useVault();

  const upcoming = useMemo(() => {
    if (!anniversaries || anniversaries.length === 0) return [];

    const now = new Date();
    const currentYear = now.getFullYear();

    const results: UpcomingAnniversary[] = [];

    for (const a of anniversaries) {
      const days = getDaysUntilAnniversary(a.date, now);
      if (days < 0 || days > 7) continue;

      const age = a.birthYear ? currentYear - a.birthYear + (days === 0 ? 0 : 0) : null;
      // Si l'anniversaire n'est pas encore passé cette année, l'âge sera atteint ce jour-là
      // Si on est le jour J, l'âge vient d'être atteint
      const computedAge = a.birthYear
        ? (() => {
            const [mm, dd] = a.date.split('-').map(Number);
            const birthdayThisYear = new Date(currentYear, mm - 1, dd);
            birthdayThisYear.setHours(0, 0, 0, 0);
            const today = new Date(currentYear, now.getMonth(), now.getDate());
            today.setHours(0, 0, 0, 0);
            if (birthdayThisYear.getTime() >= today.getTime()) {
              return currentYear - a.birthYear;
            }
            // L'anniversaire est passé, on calcule pour l'année prochaine
            return currentYear + 1 - a.birthYear;
          })()
        : null;

      results.push({ anniversary: a, daysUntil: days, age: computedAge });
    }

    // Trier par date la plus proche d'abord
    results.sort((a, b) => a.daysUntil - b.daysUntil);

    return results;
  }, [anniversaries]);

  // CRITIQUE : pas de carte vide
  if (upcoming.length === 0) return null;

  return (
    <DashboardCard
      title={t('dashboard.anniversaires.title')}
      icon="🎂"
      count={upcoming.length}
      color={colors.accentPink}
      collapsible
      cardId="anniversaires"
    >
      {upcoming.map((item) => {
        const isToday = item.daysUntil === 0;
        const label = isToday
          ? t('dashboard.anniversaires.today')
          : item.daysUntil === 1
            ? t('dashboard.anniversaires.tomorrow')
            : t('dashboard.anniversaires.inDays', { count: item.daysUntil });

        return (
          <View
            key={`${item.anniversary.name}-${item.anniversary.date}`}
            style={[
              styles.row,
              isToday && styles.rowToday,
              isToday && { backgroundColor: colors.warningBg, borderLeftColor: colors.accentPink },
              !isToday && { borderLeftColor: colors.textMuted },
            ]}
          >
            <View style={styles.rowContent}>
              <Text style={[styles.name, { color: colors.text }]}>
                {isToday ? '🎂 ' : '🎈 '}
                {item.anniversary.name}
                {item.age !== null && isToday ? ` — ${t('dashboard.anniversaires.yearsOld', { count: item.age })}` : ''}
              </Text>
              <Text style={[styles.meta, { color: isToday ? colors.textSub : colors.textMuted }]}>
                {label}
                {item.age !== null && !isToday ? ` (${t('dashboard.anniversaires.yearsOld', { count: item.age })})` : ''}
                {item.anniversary.category ? ` · ${item.anniversary.category}` : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </DashboardCard>
  );
}

export const DashboardAnniversaires = React.memo(DashboardAnniversairesInner);

const styles = StyleSheet.create({
  row: {
    paddingVertical: Spacing.md,
    borderLeftWidth: 3,
    paddingLeft: Spacing.lg,
    gap: Spacing.xxs,
  },
  rowToday: {
    borderRadius: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  rowContent: {
    gap: Spacing.xxs,
  },
  name: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  meta: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
  },
});
