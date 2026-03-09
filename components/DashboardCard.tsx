/**
 * DashboardCard.tsx — Reusable card widget for dashboard sections
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { Shadows } from '../constants/shadows';

interface DashboardCardProps {
  title: string;
  icon?: string;
  count?: number;
  color?: string;
  onPressMore?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function DashboardCard({
  title,
  icon,
  count,
  color,
  onPressMore,
  children,
  style,
}: DashboardCardProps) {
  const { primary, colors } = useThemeColors();
  const accentColor = color ?? primary;
  return (
    <View
      style={[styles.card, Shadows.md, { backgroundColor: colors.card }, style]}
      accessibilityRole="summary"
      accessibilityLabel={`Section ${title}${count !== undefined ? `, ${count} éléments` : ''}`}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {count !== undefined && (
            <View style={[styles.badge, { backgroundColor: accentColor }]}>
              <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{count}</Text>
            </View>
          )}
        </View>
        {onPressMore && (
          <TouchableOpacity
            onPress={onPressMore}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`Voir tout ${title}`}
            accessibilityRole="button"
          >
            <Text style={[styles.moreLink, { color: accentColor }]}>Voir tout →</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    padding: Spacing['2xl'] + 2, // 18px — légèrement plus que 2xl
    marginBottom: Spacing['lg+' as keyof typeof Spacing] ?? 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl + 2, // 14px
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  icon: {
    fontSize: FontSize.subtitle + 3, // 20px
  },
  title: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
  },
  badge: {
    borderRadius: Radius.base,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    minWidth: 22,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
  },
  moreLink: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  body: {
    gap: Spacing.sm,
  },
});
