import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import {
  type AutomationConfig,
  DEFAULT_AUTOMATION_CONFIG,
  loadAutomationConfig,
  setAutomationFlag,
} from '../../lib/automation-config';

const TOGGLES: { key: keyof AutomationConfig; emoji: string; label: string; detail: string }[] = [
  {
    key: 'autoCoursesFromRecipes',
    emoji: '🛒',
    label: 'Recettes \u2192 Courses',
    detail: 'Ajouter les ingrédients manquants aux courses quand un repas est planifié avec une recette',
  },
  {
    key: 'autoStockFromCourses',
    emoji: '📦',
    label: 'Courses \u2192 Stock',
    detail: 'Mettre à jour le stock quand une course alimentaire est cochée',
  },
  {
    key: 'autoStockDecrementCook',
    emoji: '👨\u200D🍳',
    label: 'Cuisiné \u2192 Stock',
    detail: 'Décrémenter le stock quand un repas est marqué comme cuisiné',
  },
];

export function SettingsAutomations() {
  const { primary, colors } = useThemeColors();
  const [config, setConfig] = useState<AutomationConfig>(DEFAULT_AUTOMATION_CONFIG);

  useEffect(() => {
    loadAutomationConfig().then(setConfig);
  }, []);

  const handleToggle = useCallback(async (key: keyof AutomationConfig) => {
    const newValue = !config[key];
    setConfig(prev => ({ ...prev, [key]: newValue }));
    await setAutomationFlag(key, newValue);
  }, [config]);

  return (
    <View style={styles.section}>
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <Text style={[styles.description, { color: colors.textSub }]}>
          Le flux automatique connecte vos recettes, courses et stock. Désactivez individuellement chaque étape si besoin.
        </Text>
        {TOGGLES.map((toggle) => (
          <View key={toggle.key} style={[styles.toggleRow, { borderTopColor: colors.separator }]}>
            <Text style={styles.toggleEmoji}>{toggle.emoji}</Text>
            <View style={styles.toggleContent}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>{toggle.label}</Text>
              <Text style={[styles.toggleDetail, { color: colors.textMuted }]}>{toggle.detail}</Text>
            </View>
            <Switch
              value={config[toggle.key]}
              onValueChange={() => handleToggle(toggle.key)}
              trackColor={{ true: primary, false: colors.switchOff }}
              thumbColor="#FFFFFF"
              accessibilityRole="switch"
              accessibilityLabel={toggle.label}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.lg,
  },
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  description: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.5,
    marginBottom: Spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toggleEmoji: {
    fontSize: FontSize.titleLg,
    width: 30,
    textAlign: 'center',
  },
  toggleContent: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  toggleDetail: {
    fontSize: FontSize.label,
    lineHeight: FontSize.label * 1.4,
  },
});
