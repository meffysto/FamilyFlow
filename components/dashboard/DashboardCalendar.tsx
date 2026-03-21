/**
 * DashboardCalendar.tsx — Aperçu des 3 prochains jours
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';
import { DashboardCard } from '../DashboardCard';
import { CalendarEventRow } from '../calendar/CalendarEventRow';
import type { CalendarEvent } from '../../lib/calendar-types';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

const PREVIEW_DAYS = 3;

function DashboardCalendarInner(_props: DashboardSectionProps) {
  const router = useRouter();
  const { primary, colors } = useThemeColors();
  // Stabiliser la référence Date pour éviter les re-renders infinis
  const [stableMonth] = useState(() => new Date());
  const { eventsByDate } = useCalendarEvents(stableMonth);

  const previewDays = useMemo(() => {
    const today = new Date();
    const days: { date: string; label: string; events: CalendarEvent[] }[] = [];
    for (let i = 0; i < PREVIEW_DAYS; i++) {
      const d = addDays(today, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const events = (eventsByDate[dateStr] ?? []).filter(e => e.type !== 'vacation' && e.type !== 'mood');
      if (events.length > 0) {
        const label = i === 0 ? "Aujourd'hui" : i === 1 ? 'Demain' : format(d, 'EEEE', { locale: fr });
        days.push({ date: dateStr, label: label.charAt(0).toUpperCase() + label.slice(1), events });
      }
    }
    return days;
  }, [eventsByDate]);

  const totalEvents = previewDays.reduce((s, d) => s + d.events.length, 0);

  if (totalEvents === 0) return null;

  return (
    <DashboardCard
      key="calendar"
      title="Calendrier"
      icon="📆"
      count={totalEvents}
      color={primary}
      onPressMore={() => router.push('/(tabs)/calendar' as any)}
    >
      {previewDays.map(day => (
        <View key={day.date} style={styles.dayGroup}>
          <Text style={[styles.dayLabel, { color: colors.textSub }]}>{day.label}</Text>
          {day.events.slice(0, 3).map(e => (
            <CalendarEventRow key={e.id} event={e} />
          ))}
        </View>
      ))}
    </DashboardCard>
  );
}

export const DashboardCalendar = React.memo(DashboardCalendarInner);

const styles = StyleSheet.create({
  dayGroup: {
    marginBottom: Spacing.sm,
  },
  dayLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xxs,
  },
});
