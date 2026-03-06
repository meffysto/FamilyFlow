/**
 * DashboardCard.tsx — Reusable card widget for dashboard sections
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';

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
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text style={styles.title}>{title}</Text>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    fontSize: 18,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  moreLink: {
    fontSize: 13,
    fontWeight: '600',
  },
  body: {
    gap: 4,
  },
});
