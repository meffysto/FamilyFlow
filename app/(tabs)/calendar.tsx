/**
 * calendar.tsx — Calendrier familial unifié
 *
 * Fusionne RDV, tâches, anniversaires, repas, vacances,
 * défis, souvenirs, humeurs et mots d'enfants en une seule vue.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { format, addMonths, subMonths } from 'date-fns';
import { getDateLocale } from '../../lib/date-locale';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useRefresh } from '../../hooks/useRefresh';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';
import { CalendarMonthGrid } from '../../components/calendar/CalendarMonthGrid';
import { CalendarDayDetail } from '../../components/calendar/CalendarDayDetail';
import { CalendarEventRow } from '../../components/calendar/CalendarEventRow';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { PillTabSwitcher } from '../../components/ui/PillTabSwitcher';
import { FAB } from '../../components/FAB';
import { RDVEditor } from '../../components/RDVEditor';
import { Spacing, Radius, Layout } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { useTranslation } from 'react-i18next';

type ViewMode = 'mois' | 'semaine';

export default function CalendarScreen() {
  const { t } = useTranslation();
  const { primary, colors, isDark } = useThemeColors();

  const VIEW_TABS = useMemo(() => [
    { id: 'mois' as ViewMode, label: t('calendarScreen.tabs.month') },
    { id: 'semaine' as ViewMode, label: t('calendarScreen.tabs.week') },
  ], [t]);
  const { refresh, addRDV, profiles } = useVault();
  const { refreshing, onRefresh } = useRefresh(refresh);
  const router = useRouter();
  const [showRDVEditor, setShowRDVEditor] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('mois');
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(
    () => new Date().toISOString().slice(0, 10),
  );

  const { eventsByDate, vacationDates } = useCalendarEvents(currentMonth);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Scroll handler pour collapse du ScreenHeader
  const scrollY = useSharedValue(0);
  const onScrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Reset du scroll au changement d'onglet (évite collapse fantôme)
  useEffect(() => {
    scrollY.value = 0;
  }, [viewMode]);

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

  const fabActions = useMemo(() => [
    { id: 'rdv', emoji: '📅', label: 'RDV', onPress: () => setShowRDVEditor(true) },
    { id: 'tache', emoji: '✅', label: 'Tâche', onPress: () => router.push('/(tabs)/tasks') },
  ], [router]);

  return (
    <View style={{ flex: 1 }}>
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <ScreenHeader
        title={t('calendarScreen.title')}
        actions={
          <TouchableOpacity
            style={[styles.todayBtn, { backgroundColor: colors.card }]}
            onPress={goToToday}
            accessibilityLabel={t('calendarScreen.a11y.today')}
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.todayBtnText, { color: primary }]}>{t('calendarScreen.today')}</Text>
          </TouchableOpacity>
        }
        bottom={
          <PillTabSwitcher
            tabs={VIEW_TABS}
            activeTab={viewMode}
            onTabChange={(id) => setViewMode(id)}
            primary={primary}
            colors={colors}
            marginHorizontal={0}
          />
        }
        scrollY={scrollY}
      />

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, Layout.contentContainer]}
        onScroll={onScrollHandler}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {viewMode === 'mois' ? (
          <>
            {/* Navigation mois */}
            <View style={styles.monthNav}>
              <TouchableOpacity
                style={[styles.monthArrow, { backgroundColor: colors.card }]}
                onPress={prevMonth}
                accessibilityLabel={t('calendarScreen.a11y.previousMonth')}
                accessibilityRole="button"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={[styles.monthArrowText, { color: primary }]}>‹</Text>
              </TouchableOpacity>
              <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
              <TouchableOpacity
                style={[styles.monthArrow, { backgroundColor: colors.card }]}
                onPress={nextMonth}
                accessibilityLabel={t('calendarScreen.a11y.nextMonth')}
                accessibilityRole="button"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
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
                accessibilityLabel={t('calendarScreen.a11y.previousWeek')}
                accessibilityRole="button"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={[styles.monthArrowText, { color: primary }]}>‹</Text>
              </TouchableOpacity>
              <Text style={[styles.monthLabel, { color: colors.text }]}>{t('calendarScreen.weekLabel')}</Text>
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
                accessibilityLabel={t('calendarScreen.a11y.nextWeek')}
                accessibilityRole="button"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
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
      </Animated.ScrollView>
    </SafeAreaView>
    <FAB actions={fabActions} />
    <Modal
      visible={showRDVEditor}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowRDVEditor(false)}
    >
      <RDVEditor
        profiles={profiles}
        initialDate={selectedDate ?? undefined}
        onSave={async (data) => {
          await addRDV(data);
          await refresh();
          setShowRDVEditor(false);
        }}
        onClose={() => setShowRDVEditor(false)}
      />
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  todayBtn: {
    paddingHorizontal: Spacing.md,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtnText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: 100,
    paddingTop: Spacing.md,
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
