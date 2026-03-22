/**
 * calendar.tsx — Calendrier familial unifié
 *
 * Fusionne RDV, tâches, anniversaires, repas, vacances,
 * défis, souvenirs, humeurs et mots d'enfants en une seule vue.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, addMonths, subMonths } from 'date-fns';
import { getDateLocale } from '../../lib/date-locale';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useRefresh } from '../../hooks/useRefresh';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';
import { CalendarMonthGrid } from '../../components/calendar/CalendarMonthGrid';
import { CalendarDayDetail } from '../../components/calendar/CalendarDayDetail';
import { CalendarEventRow } from '../../components/calendar/CalendarEventRow';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { EmptyState } from '../../components/EmptyState';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import type { CalendarEvent } from '../../lib/calendar-types';

type ViewMode = 'mois' | 'semaine';

const VIEW_TABS: { id: ViewMode; label: string }[] = [
  { id: 'mois', label: 'Mois' },
  { id: 'semaine', label: 'Semaine' },
];

export default function CalendarScreen() {
  const { primary, colors } = useThemeColors();
  const { refresh } = useVault();
  const { refreshing, onRefresh } = useRefresh(refresh);

  const [viewMode, setViewMode] = useState<ViewMode>('mois');
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(
    () => new Date().toISOString().slice(0, 10),
  );

  const { events, eventsByDate, vacationDates } = useCalendarEvents(currentMonth);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Navigation mois
  const prevMonth = useCallback(() => setCurrentMonth(m => subMonths(m, 1)), []);
  const nextMonth = useCallback(() => setCurrentMonth(m => addMonths(m, 1)), []);
  const goToToday = useCallback(() => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date().toISOString().slice(0, 10));
  }, []);

  // Label du mois
  const monthLabel = useMemo(() => {
    const s = format(currentMonth, 'MMMM yyyy', { locale: getDateLocale() });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, [currentMonth]);

  // Events du jour sélectionné
  const selectedDayEvents = useMemo(
    () => selectedDate ? (eventsByDate[selectedDate] ?? []) : [],
    [eventsByDate, selectedDate],
  );

  // Vue semaine : 7 jours à partir du lundi de la semaine contenant selectedDate
  const weekDays = useMemo(() => {
    if (!selectedDate) return [];
    const d = new Date(selectedDate + 'T12:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(monday.getDate() + diff);
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      days.push(date.toISOString().slice(0, 10));
    }
    return days;
  }, [selectedDate]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>📆 Calendrier</Text>
        <TouchableOpacity onPress={goToToday}>
          <Text style={[styles.todayBtn, { color: primary }]}>Aujourd'hui</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs Mois / Semaine */}
      <View style={styles.tabBar}>
        <SegmentedControl
          segments={VIEW_TABS}
          value={viewMode}
          onChange={(id) => setViewMode(id as ViewMode)}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {viewMode === 'mois' ? (
          <>
            {/* Navigation mois */}
            <View style={styles.monthNav}>
              <TouchableOpacity style={[styles.monthArrow, { backgroundColor: colors.card }]} onPress={prevMonth}>
                <Text style={[styles.monthArrowText, { color: primary }]}>‹</Text>
              </TouchableOpacity>
              <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
              <TouchableOpacity style={[styles.monthArrow, { backgroundColor: colors.card }]} onPress={nextMonth}>
                <Text style={[styles.monthArrowText, { color: primary }]}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Grille */}
            <CalendarMonthGrid
              month={currentMonth}
              eventsByDate={eventsByDate}
              selectedDate={selectedDate}
              vacationDates={vacationDates}
              onSelectDate={setSelectedDate}
            />

            {/* Détail du jour sélectionné */}
            {selectedDate && (
              <CalendarDayDetail date={selectedDate} events={selectedDayEvents} />
            )}
          </>
        ) : (
          <>
            {/* Navigation semaine */}
            <View style={styles.monthNav}>
              <TouchableOpacity
                style={[styles.monthArrow, { backgroundColor: colors.card }]}
                onPress={() => {
                  if (selectedDate) {
                    const d = new Date(selectedDate + 'T12:00:00');
                    d.setDate(d.getDate() - 7);
                    setSelectedDate(d.toISOString().slice(0, 10));
                    setCurrentMonth(d);
                  }
                }}
              >
                <Text style={[styles.monthArrowText, { color: primary }]}>‹</Text>
              </TouchableOpacity>
              <Text style={[styles.monthLabel, { color: colors.text }]}>Semaine</Text>
              <TouchableOpacity
                style={[styles.monthArrow, { backgroundColor: colors.card }]}
                onPress={() => {
                  if (selectedDate) {
                    const d = new Date(selectedDate + 'T12:00:00');
                    d.setDate(d.getDate() + 7);
                    setSelectedDate(d.toISOString().slice(0, 10));
                    setCurrentMonth(d);
                  }
                }}
              >
                <Text style={[styles.monthArrowText, { color: primary }]}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Timeline semaine */}
            {weekDays.map(dateStr => {
              const dayEvents = (eventsByDate[dateStr] ?? []).filter(e => e.type !== 'vacation');
              const isToday = dateStr === todayStr;
              const isVacation = vacationDates.has(dateStr);
              const d = new Date(dateStr + 'T12:00:00');
              const dayLabel = format(d, 'EEEE d', { locale: getDateLocale() });
              const label = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);

              return (
                <View
                  key={dateStr}
                  style={[
                    styles.weekDay,
                    { borderLeftColor: isToday ? primary : 'transparent' },
                    isVacation && { backgroundColor: colors.warningBg },
                  ]}
                >
                  <Text style={[
                    styles.weekDayLabel,
                    { color: isToday ? primary : colors.text },
                    isToday && { fontWeight: FontWeight.bold },
                  ]}>
                    {label}
                  </Text>
                  {dayEvents.length === 0 ? (
                    <Text style={[styles.weekDayEmpty, { color: colors.textMuted }]}>—</Text>
                  ) : (
                    dayEvents.map(e => (
                      <CalendarEventRow key={e.id} event={e} />
                    ))
                  )}
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },
  todayBtn: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  tabBar: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: 100,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthArrowText: {
    fontSize: 24,
    fontWeight: FontWeight.bold,
    lineHeight: 28,
  },
  monthLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  // Semaine
  weekDay: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderLeftWidth: 3,
    marginBottom: Spacing.xs,
  },
  weekDayLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  weekDayEmpty: {
    fontSize: FontSize.caption,
    fontStyle: 'italic',
    paddingLeft: Spacing.md,
  },
});
