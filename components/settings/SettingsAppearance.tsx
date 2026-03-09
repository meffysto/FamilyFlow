import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

export function SettingsAppearance() {
  const { primary, tint, colors, darkModePreference, setDarkModePreference } = useThemeColors();

  return (
    <View style={styles.section} accessibilityRole="summary" accessibilityLabel="Section Apparence">
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Apparence</Text>
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <Text style={[styles.label, { color: colors.textSub }]}>🌙 Mode sombre</Text>
        <View style={styles.row}>
          {([
            { value: 'auto', label: 'Auto', emoji: '⚙️' },
            { value: 'light', label: 'Clair', emoji: '☀️' },
            { value: 'dark', label: 'Sombre', emoji: '🌙' },
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
              accessibilityLabel={`Mode ${opt.label}`}
            >
              <Text style={styles.chipEmoji}>{opt.emoji}</Text>
              <Text style={[
                styles.chipText, { color: colors.textMuted },
                darkModePreference === opt.value && { color: primary, fontWeight: FontWeight.bold },
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
  sectionTitle: { fontSize: FontSize.label, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
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
