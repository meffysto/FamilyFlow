import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
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

export function SettingsAutomations() {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();

  const TOGGLES: { key: keyof AutomationConfig; emoji: string; label: string; detail: string }[] = [
    {
      key: 'autoCoursesFromRecipes',
      emoji: '🛒',
      label: t('settings.automations.recipesToShopping'),
      detail: t('settings.automations.recipesToShoppingDetail'),
    },
    {
      key: 'autoStockFromCourses',
      emoji: '📦',
      label: t('settings.automations.shoppingToStock'),
      detail: t('settings.automations.shoppingToStockDetail'),
    },
    {
      key: 'autoStockDecrementCook',
      emoji: '👨‍🍳',
      label: t('settings.automations.cookedToStock'),
      detail: t('settings.automations.cookedToStockDetail'),
    },
  ];
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
          {t('settings.automations.description')}
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
              thumbColor={colors.onPrimary}
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
