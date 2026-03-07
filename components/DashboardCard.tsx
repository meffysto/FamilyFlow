/**
 * DashboardCard.tsx — Reusable card widget for dashboard sections
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';

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
  color = '#7C3AED',
  onPressMore,
  children,
  style,
}: DashboardCardProps) {
  const { colors } = useThemeColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card }, style]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {count !== undefined && (
            <View style={[styles.badge, { backgroundColor: color }]}>
              <Text style={styles.badgeText}>{count}</Text>
            </View>
          )}
        </View>
        {onPressMore && (
          <TouchableOpacity onPress={onPressMore} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.moreLink, { color }]}>Voir tout →</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 22,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  moreLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  body: {
    gap: 6,
  },
});
