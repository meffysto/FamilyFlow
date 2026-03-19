/**
 * SettingsRow.tsx — Ligne navigable pour l'index des réglages
 *
 * Affiche emoji, titre, sous-titre, indicateur de statut et chevron.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface SettingsRowProps {
  emoji: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export function SettingsRow({ emoji, title, subtitle, onPress, isFirst, isLast }: SettingsRowProps) {
  const { colors } = useThemeColors();

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
      <Text style={styles.emoji}>{emoji}</Text>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.chevron, { color: colors.textFaint }]}>&rsaquo;</Text>
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
  emoji: {
    fontSize: FontSize.titleLg,
    width: 30,
    textAlign: 'center',
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
  chevron: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.medium,
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
