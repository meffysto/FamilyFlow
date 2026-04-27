/**
 * SettingsRow.tsx — Ligne navigable pour l'index des réglages
 *
 * Affiche icône Lucide dans un badge coloré, titre, sous-titre et chevron.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface SettingsRowProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onPress: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export function SettingsRow({ icon: Icon, title, subtitle, onPress, isFirst, isLast }: SettingsRowProps) {
  const { colors, primary } = useThemeColors();

  return (
    <TouchableOpacity
      style={[
        styles.row,
        isFirst && styles.rowFirst,
        isLast && styles.rowLast,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
        { backgroundColor: colors.card },
      ]}
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}`}
    >
      <View style={[styles.iconBox, { backgroundColor: colors.brand?.wash ?? colors.cardAlt }]}>
        <Icon size={18} color={primary} strokeWidth={2} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={18} color={colors.textFaint} strokeWidth={2} />
    </TouchableOpacity>
  );
}

interface SettingsSectionHeaderProps {
  label: string;
}

export function SettingsSectionHeader({ label }: SettingsSectionHeaderProps) {
  const { colors } = useThemeColors();
  return (
    <Text
      style={[styles.sectionHeader, { color: colors.textMuted }]}
      accessibilityRole="header"
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xl + 2,
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.xl,
  },
  rowFirst: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  rowLast: {
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  subtitle: {
    fontSize: FontSize.label,
  },
  sectionHeader: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing['3xl'],
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
});
