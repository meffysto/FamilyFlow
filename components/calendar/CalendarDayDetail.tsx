/**
 * CalendarDayDetail.tsx — Détail des événements d'un jour sélectionné
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useThemeColors } from '../../contexts/ThemeContext';
import type { CalendarEvent } from '../../lib/calendar-types';
import { CalendarEventRow } from './CalendarEventRow';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

interface CalendarDayDetailProps {
  date: string; // YYYY-MM-DD
  events: CalendarEvent[];
}

function CalendarDayDetailInner({ date, events }: CalendarDayDetailProps) {
  const { colors } = useThemeColors();

  const dateLabel = useMemo(() => {
    const d = parseISO(date);
    const s = format(d, 'EEEE d MMMM', { locale: fr });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, [date]);

  // Séparer les événements avec heure et sans heure
  const withTime = events.filter(e => e.time);
  const allDay = events.filter(e => !e.time && e.type !== 'vacation');
  const hasVacation = events.some(e => e.type === 'vacation');

  return (
    <View style={[styles.container, { backgroundColor: colors.card }, Shadows.sm]}>
      <Text style={[styles.dateLabel, { color: colors.text }]}>{dateLabel}</Text>

      {hasVacation && (
        <View style={[styles.vacationBanner, { backgroundColor: colors.warningBg }]}>
          <Text style={[styles.vacationText, { color: colors.warningText }]}>☀️ Vacances</Text>
        </View>
      )}

      {events.length === 0 || (events.length === 1 && hasVacation && allDay.length === 0 && withTime.length === 0) ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>Rien de prévu</Text>
      ) : (
        <>
          {withTime.map(e => <CalendarEventRow key={e.id} event={e} />)}
          {allDay.map(e => <CalendarEventRow key={e.id} event={e} />)}
        </>
      )}
    </View>
  );
}

export const CalendarDayDetail = React.memo(CalendarDayDetailInner);

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  dateLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  vacationBanner: {
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  vacationText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  empty: {
    fontSize: FontSize.caption,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
});
