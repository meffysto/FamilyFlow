import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

interface SettingsVaultProps {
  vaultPath: string | null;
  onChangeVault: () => void;
}

export function SettingsVault({ vaultPath, onChangeVault }: SettingsVaultProps) {
  const { colors } = useThemeColors();

  return (
    <View style={styles.section} accessibilityRole="summary" accessibilityLabel="Section Vault Obsidian">
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Vault Obsidian</Text>
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.textSub }]}>📁 Chemin</Text>
        </View>
        <Text style={[styles.pathText, { color: colors.textSub, backgroundColor: colors.cardAlt }]} numberOfLines={3}>
          {vaultPath ?? 'Non configuré'}
        </Text>
        <Button label="Changer le vault" onPress={onChangeVault} variant="secondary" size="sm" fullWidth />
        <View style={[styles.hint, { backgroundColor: colors.successBg }]}>
          <Text style={[styles.hintText, { color: colors.successText }]}>
            ✅ Les données sont stockées en fichiers .md standard, compatibles avec Obsidian.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  sectionTitle: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  card: {
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    gap: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  pathText: {
    fontSize: FontSize.label,
    fontFamily: 'Menlo',
    padding: Spacing.lg,
    borderRadius: Radius.md,
    lineHeight: 18,
  },
  hint: {
    padding: Spacing.lg,
    borderRadius: Radius.md,
  },
  hintText: {
    fontSize: FontSize.caption,
    lineHeight: 17,
  },
});
