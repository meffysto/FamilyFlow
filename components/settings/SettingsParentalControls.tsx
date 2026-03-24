/**
 * SettingsParentalControls.tsx — Section réglages contrôle parental
 *
 * Toggles rapides par catégorie pour autoriser/restreindre
 * ce que les enfants/ados voient dans l'app.
 */

import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useParentalControls, PARENTAL_CATEGORIES, type ParentalCategory } from '../../contexts/ParentalControlsContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { CollapsibleSection } from '../ui/CollapsibleSection';

export function SettingsParentalControls() {
  const { primary, colors } = useThemeColors();
  const { controls, setControl } = useParentalControls();
  const { t } = useTranslation();

  return (
    <CollapsibleSection id="parental-controls" title={t('parentalControls.title')} defaultCollapsed>
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <Text style={[styles.description, { color: colors.textSub }]}>
          {t('parentalControls.description')}
        </Text>
        {PARENTAL_CATEGORIES.map((cat) => (
          <View key={cat.id} style={[styles.row, { borderBottomColor: colors.separator }]}>
            <View style={styles.rowLeft}>
              <Text style={styles.emoji}>{cat.emoji}</Text>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{t(cat.labelKey)}</Text>
                <Text style={[styles.rowDesc, { color: colors.textMuted }]}>{t(cat.descKey)}</Text>
              </View>
            </View>
            <Switch
              value={controls[cat.id]}
              onValueChange={(val) => setControl(cat.id as ParentalCategory, val)}
              trackColor={{ false: colors.switchOff, true: primary }}
              accessibilityLabel={`${t(cat.labelKey)} : ${controls[cat.id] ? t('parentalControls.allowed') : t('parentalControls.restricted')}`}
            />
          </View>
        ))}
        <View style={[styles.hint, { backgroundColor: colors.infoBg }]}>
          <Text style={[styles.hintText, { color: colors.info }]}>
            {t('parentalControls.hint')}
          </Text>
        </View>
      </View>
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  description: {
    fontSize: FontSize.body,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.md,
  },
  emoji: {
    fontSize: FontSize.title,
    marginRight: Spacing.sm,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  rowDesc: {
    fontSize: FontSize.caption,
    marginTop: 2,
  },
  hint: {
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  hintText: {
    fontSize: FontSize.caption,
  },
});
