/**
 * CalendarDayDetail.tsx — Détail groupé par type des événements d'un jour
 *
 * Sections prioritaires : RDV > Tâches > Défis > Repas > Anniversaires
 * Types "ambiance" (humeurs, mots, souvenirs) en chips compacts.
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../contexts/ThemeContext';
import type { CalendarEvent, CalendarEventType } from '../../lib/calendar-types';
import { EVENT_CONFIG, resolveCalendarColor } from '../../lib/calendar-types';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

interface CalendarDayDetailProps {
  date: string; // YYYY-MM-DD
  events: CalendarEvent[];
}

/** Ordre d'affichage des sections prioritaires */
const SECTION_ORDER: CalendarEventType[] = [
  'rdv', 'task', 'defi', 'meal', 'anniversary',
];

/** Types affichés en chips compacts */
const CHIP_TYPES: Set<CalendarEventType> = new Set(['mood', 'quote', 'memory']);

function CalendarDayDetailInner({ date, events }: CalendarDayDetailProps) {
  const { primary, colors } = useThemeColors();
  const router = useRouter();

  const dateLabel = useMemo(() => {
    const d = parseISO(date);
    const s = format(d, 'EEEE d MMMM', { locale: fr });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, [date]);

  const hasVacation = events.some(e => e.type === 'vacation');

  // Grouper par type
  const grouped = useMemo(() => {
    const map = new Map<CalendarEventType, CalendarEvent[]>();
    for (const e of events) {
      if (e.type === 'vacation') continue;
      if (!map.has(e.type)) map.set(e.type, []);
      map.get(e.type)!.push(e);
    }
    return map;
  }, [events]);

  // Sections prioritaires (avec events)
  const sections = useMemo(
    () => SECTION_ORDER.filter(t => grouped.has(t)),
    [grouped],
  );

  // Chips ambiance
  const chipEvents = useMemo(
    () => events.filter(e => CHIP_TYPES.has(e.type)),
    [events],
  );

  const isEmpty = sections.length === 0 && chipEvents.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.card }, Shadows.sm]}>
      <Text style={[styles.dateLabel, { color: colors.text }]}>{dateLabel}</Text>

      {hasVacation && (
        <View style={[styles.vacationBanner, { backgroundColor: colors.warningBg }]}>
          <Text style={[styles.vacationText, { color: colors.warningText }]}>Vacances</Text>
        </View>
      )}

      {isEmpty ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>Rien de prévu</Text>
      ) : (
        <>
          {/* Sections prioritaires */}
          {sections.map(type => {
            const config = EVENT_CONFIG[type];
            const items = grouped.get(type)!;
            const sectionColor = resolveCalendarColor(colors, primary, config.colorKey);

            return (
              <View key={type} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: sectionColor }]} />
                  <Text style={[styles.sectionTitle, { color: colors.textSub }]}>
                    {config.label}
                  </Text>
                  <Text style={[styles.sectionCount, { color: colors.textFaint }]}>
                    {items.length}
                  </Text>
                </View>
                {items.map(e => (
                  <TouchableOpacity
                    key={e.id}
                    style={[styles.eventRow, { borderLeftColor: sectionColor }]}
                    onPress={() => e.route && router.push(e.route as any)}
                    activeOpacity={e.route ? 0.7 : 1}
                    accessibilityLabel={`${config.emoji} ${e.label}`}
                    accessibilityRole="button"
                  >
                    <View style={styles.eventContent}>
                      <Text style={[styles.eventLabel, { color: colors.text }]} numberOfLines={1}>
                        {e.label}
                      </Text>
                      {e.sublabel ? (
                        <Text style={[styles.eventSublabel, { color: colors.textMuted }]} numberOfLines={1}>
                          {e.sublabel}
                        </Text>
                      ) : null}
                    </View>
                    {e.time ? (
                      <View style={[styles.timeBadge, { backgroundColor: sectionColor + '18' }]}>
                        <Text style={[styles.timeText, { color: sectionColor }]}>{e.time}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}

          {/* Chips ambiance */}
          {chipEvents.length > 0 && (
            <View style={styles.chipsSection}>
              {chipEvents.map(e => {
                const config = EVENT_CONFIG[e.type];
                const chipColor = resolveCalendarColor(colors, primary, config.colorKey);
                return (
                  <TouchableOpacity
                    key={e.id}
                    style={[styles.chip, { backgroundColor: chipColor + '14' }]}
                    onPress={() => e.route && router.push(e.route as any)}
                    activeOpacity={e.route ? 0.7 : 1}
                  >
                    <Text style={styles.chipEmoji}>{config.emoji}</Text>
                    <Text style={[styles.chipLabel, { color: colors.textSub }]} numberOfLines={1}>
                      {e.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
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

  // Sections
  section: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  sectionCount: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.medium,
  },

  // Event rows
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.xl,
    paddingRight: Spacing.sm,
    borderLeftWidth: 2,
    marginLeft: Spacing.xs,
    gap: Spacing.sm,
  },
  eventContent: {
    flex: 1,
  },
  eventLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  eventSublabel: {
    fontSize: FontSize.caption,
    marginTop: 1,
  },
  timeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.sm,
  },
  timeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },

  // Chips ambiance
  chipsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    gap: Spacing.xxs,
    maxWidth: '48%',
  },
  chipEmoji: {
    fontSize: 12,
  },
  chipLabel: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.medium,
    flexShrink: 1,
  },
});
