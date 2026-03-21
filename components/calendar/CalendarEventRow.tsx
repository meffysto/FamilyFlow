/**
 * CalendarEventRow.tsx — Ligne d'événement réutilisable
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../contexts/ThemeContext';
import type { CalendarEvent } from '../../lib/calendar-types';
import { resolveCalendarColor } from '../../lib/calendar-types';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface CalendarEventRowProps {
  event: CalendarEvent;
}

function CalendarEventRowInner({ event }: CalendarEventRowProps) {
  const router = useRouter();
  const { primary, colors } = useThemeColors();
  const eventColor = resolveCalendarColor(colors, primary, event.colorKey);

  const handlePress = useCallback(() => {
    if (event.route) {
      router.push(event.route as any);
    }
  }, [event.route, router]);

  return (
    <TouchableOpacity
      style={[styles.row, { borderLeftColor: eventColor }]}
      onPress={handlePress}
      activeOpacity={event.route ? 0.7 : 1}
      accessibilityLabel={`${event.emoji} ${event.label}`}
      accessibilityRole="button"
    >
      <Text style={styles.emoji}>{event.emoji}</Text>
      <View style={styles.content}>
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
          {event.label}
        </Text>
        {event.sublabel ? (
          <Text style={[styles.sublabel, { color: colors.textMuted }]} numberOfLines={1}>
            {event.sublabel}
          </Text>
        ) : null}
      </View>
      {event.time ? (
        <Text style={[styles.time, { color: colors.textSub }]}>{event.time}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

export const CalendarEventRow = React.memo(CalendarEventRowInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderLeftWidth: 3,
    marginBottom: Spacing.xs,
    borderRadius: Radius.sm,
    gap: Spacing.sm,
  },
  emoji: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },
  sublabel: {
    fontSize: FontSize.caption,
    marginTop: 1,
  },
  time: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
});
