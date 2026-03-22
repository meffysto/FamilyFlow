import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Chip } from '../ui/Chip';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

export interface ZenConfig {
  enabled: boolean;
  excludedSections: string[];
}

export const DEFAULT_ZEN_CONFIG: ZenConfig = {
  enabled: true,
  excludedSections: [],
};

interface SettingsZenProps {
  zenConfig: ZenConfig;
  onSave: (config: ZenConfig) => Promise<void>;
}

const ZEN_SECTION_IDS = ['overdue', 'menage', 'photos', 'meals', 'recipes', 'courses', 'rdvs', 'gratitude'] as const;
const ZEN_EMOJIS: Record<string, string> = { overdue: '⚠️', menage: '🧹', photos: '📸', meals: '🍽️', recipes: '📖', courses: '🛒', rdvs: '📅', gratitude: '🙏' };

export function SettingsZen({ zenConfig, onSave }: SettingsZenProps) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();

  const ZEN_SECTIONS = ZEN_SECTION_IDS.map(id => ({
    id,
    emoji: ZEN_EMOJIS[id],
    label: t(`settings.zen.${id}.label`),
    detail: t(`settings.zen.${id}.detail`),
  }));
  const [expanded, setExpanded] = useState(false);

  const handleToggleEnabled = () => {
    onSave({ ...zenConfig, enabled: !zenConfig.enabled });
  };

  const handleToggleSection = (sectionId: string) => {
    const excluded = new Set(zenConfig.excludedSections);
    if (excluded.has(sectionId)) {
      excluded.delete(sectionId);
    } else {
      excluded.add(sectionId);
    }
    onSave({ ...zenConfig, excludedSections: [...excluded] });
  };

  const isSectionRequired = (sectionId: string) => {
    return !zenConfig.excludedSections.includes(sectionId);
  };

  return (
    <View style={styles.section} accessibilityRole="summary" accessibilityLabel={t('settings.zen.sectionA11y')}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.zen.sectionTitle')}</Text>

      {/* Card 1 : Description + toggle global */}
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <Text style={[styles.description, { color: colors.textSub }]}>
          {t('settings.zen.description')}
        </Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleEmoji}>🧘</Text>
          <View style={styles.toggleContent}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>{t('settings.zen.enableLabel')}</Text>
            <Text style={[styles.toggleDetail, { color: colors.textMuted }]}>{t('settings.zen.enableDetail')}</Text>
          </View>
          <Switch
            value={zenConfig.enabled}
            onValueChange={handleToggleEnabled}
            trackColor={{ true: primary, false: colors.switchOff }}
            thumbColor={colors.onPrimary}
            accessibilityRole="switch"
            accessibilityLabel={t('settings.zen.enableA11y')}
          />
        </View>
      </View>

      {/* Card 2 : Toggles par section (collapsible, visible seulement si zen activé) */}
      {zenConfig.enabled && (
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card, marginTop: Spacing.lg }]}>
          <TouchableOpacity
            onPress={() => setExpanded((e) => !e)}
            activeOpacity={0.7}
            style={styles.collapseHeader}
            accessibilityRole="button"
            accessibilityLabel={expanded ? t('settings.zen.collapseA11y') : t('settings.zen.expandA11y')}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.subTitle, { color: colors.text }]}>{t('settings.zen.requiredSections')}</Text>
              <Text style={[styles.description, { color: colors.textSub }]}>
                {expanded
                  ? t('settings.zen.sectionsDescription')
                  : t('settings.zen.sectionsCount', { active: ZEN_SECTIONS.length - zenConfig.excludedSections.length, total: ZEN_SECTIONS.length })
                }
              </Text>
            </View>
            <Text style={{ fontSize: FontSize.lg, color: colors.textMuted }}>
              {expanded ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          {expanded && ZEN_SECTIONS.map((s, i) => {
            const isLast = i === ZEN_SECTIONS.length - 1;
            const required = isSectionRequired(s.id);
            return (
              <View
                key={s.id}
                style={[
                  styles.toggleRow,
                  !isLast && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                ]}
              >
                <Text style={styles.toggleEmoji}>{s.emoji}</Text>
                <View style={styles.toggleContent}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.toggleLabel, { color: colors.text }]}>{s.label}</Text>
                    {s.id === 'meals' && (
                      <Chip label={t('settings.zen.alwaysVisible')} size="sm" />
                    )}
                  </View>
                  <Text style={[styles.toggleDetail, { color: colors.textMuted }]}>{s.detail}</Text>
                </View>
                <Switch
                  value={required}
                  onValueChange={() => handleToggleSection(s.id)}
                  trackColor={{ true: primary, false: colors.switchOff }}
                  thumbColor={colors.onPrimary}
                  accessibilityRole="switch"
                  accessibilityLabel={t('settings.zen.sectionRequiredA11y', { label: s.label })}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  sectionTitle: { fontSize: FontSize.label, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  card: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.sm },
  description: { fontSize: FontSize.sm, lineHeight: 20 },
  subTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  collapseHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.md },
  toggleEmoji: { fontSize: FontSize.heading },
  toggleContent: { flex: 1 },
  toggleLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  toggleDetail: { fontSize: FontSize.caption, marginTop: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
