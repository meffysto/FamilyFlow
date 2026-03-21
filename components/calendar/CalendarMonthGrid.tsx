/**
 * CalendarMonthGrid.tsx — Grille mensuelle avec dots colorés
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { startOfMonth, endOfMonth, eachDayOfInterval, getDay, format, isToday } from 'date-fns';
import { useThemeColors } from '../../contexts/ThemeContext';
import type { CalendarEvent, CalendarEventType } from '../../lib/calendar-types';
import { WEEKDAY_LABELS, EVENT_CONFIG, resolveCalendarColor } from '../../lib/calendar-types';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

const GRID_PADDING = Spacing.lg * 2;
const CELL_SIZE = Math.floor((Dimensions.get('window').width - GRID_PADDING) / 7);

interface CalendarMonthGridProps {
  month: Date;
  eventsByDate: Record<string, CalendarEvent[]>;
  selectedDate: string | null;
  vacationDates: Set<string>;
  onSelectDate: (date: string) => void;
}

function CalendarMonthGridInner({
  month, eventsByDate, selectedDate, vacationDates, onSelectDate,
}: CalendarMonthGridProps) {
  const { primary, colors } = useThemeColors();

  const { padding, days } = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const allDays = eachDayOfInterval({ start, end });
    let startDow = getDay(start) - 1;
    if (startDow < 0) startDow = 6;
    return { padding: Array(startDow).fill(null), days: allDays };
  }, [month]);

  return (
    <View>
      {/* Labels jours */}
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((l, i) => (
          <View key={i} style={styles.cell}>
            <Text style={[styles.weekdayText, { color: colors.textFaint }]}>{l}</Text>
          </View>
        ))}
      </View>

      {/* Grille */}
      <View style={styles.grid}>
        {padding.map((_, i) => <View key={`p${i}`} style={styles.cell} />)}
        {days.map((date) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const dayEvents = eventsByDate[dateStr] ?? [];
          const today = isToday(date);
          const selected = dateStr === selectedDate;
          const isVacation = vacationDates.has(dateStr);

          // Collecter les types uniques pour les dots
          const dotTypes = new Set<CalendarEventType>();
          for (const e of dayEvents) {
            if (e.type !== 'vacation') dotTypes.add(e.type);
          }

          return (
            <TouchableOpacity
              key={dateStr}
              style={[
                styles.cell,
                { backgroundColor: isVacation ? colors.warningBg : colors.card },
                today && { borderWidth: 2, borderColor: primary },
                selected && { backgroundColor: primary + '20' },
              ]}
              onPress={() => onSelectDate(dateStr)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dayNum,
                { color: today ? primary : colors.textSub },
                today && { fontWeight: FontWeight.heavy },
                selected && { color: primary, fontWeight: FontWeight.bold },
              ]}>
                {date.getDate()}
              </Text>
              {dotTypes.size > 0 && (
                <View style={styles.dots}>
                  {[...dotTypes].slice(0, 3).map((type) => (
                    <View
                      key={type}
                      style={[styles.dot, { backgroundColor: resolveCalendarColor(colors, primary, EVENT_CONFIG[type].colorKey) }]}
                    />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export const CalendarMonthGrid = React.memo(CalendarMonthGridInner);

const styles = StyleSheet.create({
  weekdayRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    marginBottom: 2,
  },
  weekdayText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  dayNum: {
    fontSize: FontSize.label,
  },
  dots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
