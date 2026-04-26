import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../contexts/ThemeContext';
import { setAppLanguage, getSavedLanguage } from '../../lib/i18n';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { SectionHeader } from '../ui/SectionHeader';
import { Palette } from 'lucide-react-native';

type LangPref = 'fr' | 'en' | 'auto';

export function SettingsAppearance() {
  const { t } = useTranslation();
  const { primary, tint, colors, darkModePreference, setDarkModePreference } = useThemeColors();
  const [langPref, setLangPref] = useState<LangPref>('auto');

  useEffect(() => {
    getSavedLanguage().then(setLangPref);
  }, []);

  const handleLanguageChange = async (lng: LangPref) => {
    setLangPref(lng);
    await setAppLanguage(lng);
  };

  return (
    <View style={styles.section} accessibilityRole="summary" accessibilityLabel={t('settings.appearance.sectionA11y')}>
      <SectionHeader
        title={t('settings.appearance.sectionTitle')}
        icon={<Palette size={16} strokeWidth={1.75} color={colors.brand.soilMuted} />}
        flush
      />
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <Text style={[styles.label, { color: colors.textSub }]}>{t('settings.appearance.darkModeLabel')}</Text>
        <View style={styles.row}>
          {([
            { value: 'auto', label: t('settings.appearance.auto'), emoji: '⚙️' },
            { value: 'light', label: t('settings.appearance.light'), emoji: '☀️' },
            { value: 'dark', label: t('settings.appearance.dark'), emoji: '🌙' },
          ] as const).map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.chip,
                { backgroundColor: colors.bg },
                darkModePreference === opt.value && { backgroundColor: tint, borderColor: primary },
              ]}
              onPress={() => setDarkModePreference(opt.value)}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: darkModePreference === opt.value }}
              accessibilityLabel={t('settings.appearance.modeA11y', { mode: opt.label })}
            >
              <Text style={styles.chipEmoji}>{opt.emoji}</Text>
              <Text style={[
                styles.chipText, { color: colors.textMuted },
                darkModePreference === opt.value && { color: primary, fontWeight: FontWeight.bold },
              ]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sélecteur de langue */}
        <Text style={[styles.label, { color: colors.textSub, marginTop: Spacing.xl }]}>{t('settings.appearance.languageLabel')}</Text>
        <View style={styles.row}>
          {([
            { value: 'auto' as LangPref, label: t('settings.appearance.languageAuto'), emoji: '🌐' },
            { value: 'fr' as LangPref, label: t('settings.appearance.languageFr'), emoji: '🇫🇷' },
            { value: 'en' as LangPref, label: t('settings.appearance.languageEn'), emoji: '🇬🇧' },
          ]).map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.chip,
                { backgroundColor: colors.bg },
                langPref === opt.value && { backgroundColor: tint, borderColor: primary },
              ]}
              onPress={() => handleLanguageChange(opt.value)}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: langPref === opt.value }}
              accessibilityLabel={t('settings.appearance.languageA11y', { lang: opt.label })}
            >
              <Text style={styles.chipEmoji}>{opt.emoji}</Text>
              <Text style={[
                styles.chipText, { color: colors.textMuted },
                langPref === opt.value && { color: primary, fontWeight: FontWeight.bold },
              ]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  card: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.lg },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, marginBottom: Spacing.lg },
  row: { flexDirection: 'row', gap: Spacing.md },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipEmoji: { fontSize: FontSize.lg },
  chipText: { fontSize: FontSize.label, fontWeight: FontWeight.semibold },
});
