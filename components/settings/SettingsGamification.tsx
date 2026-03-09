import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { serializeGamification } from '../../lib/parser';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

interface SettingsGamificationProps {
  vault: any;
  gamiData: any;
  refresh: () => Promise<void>;
}

export function SettingsGamification({ vault, gamiData, refresh }: SettingsGamificationProps) {
  const { colors } = useThemeColors();

  const handleReset = useCallback(() => {
    Alert.alert(
      '⚠️ Réinitialiser la gamification',
      'Tous les points, niveaux, streaks et loot boxes seront remis à zéro. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: async () => {
            if (!vault || !gamiData) return;
            const resetData = {
              profiles: gamiData.profiles.map((p: any) => ({
                ...p, points: 0, level: 1, streak: 0, lootBoxesAvailable: 0, multiplier: 1, multiplierRemaining: 0, pityCounter: 0,
              })),
              history: [],
              activeRewards: [],
            };
            await vault.writeFile('gamification.md', serializeGamification(resetData));
            await refresh();
            Alert.alert('✅', 'Gamification réinitialisée.');
          },
        },
      ]
    );
  }, [vault, gamiData, refresh]);

  return (
    <View style={styles.section} accessibilityRole="summary" accessibilityLabel="Section Gamification">
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Gamification</Text>
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <Text style={[styles.rowLabel, { color: colors.textSub }]}>Statistiques globales</Text>
        {gamiData && (
          <View style={styles.stats}>
            <Text style={[styles.statText, { color: colors.textMuted }]}>
              Total tâches complétées : {gamiData.history.filter((h: any) => h.action.startsWith('+')).length}
            </Text>
            <Text style={[styles.statText, { color: colors.textMuted }]}>
              Total loot boxes ouvertes : {gamiData.history.filter((h: any) => h.action.startsWith('loot:')).length}
            </Text>
          </View>
        )}
        <Button label="🗑️ Réinitialiser la gamification" onPress={handleReset} variant="danger" size="sm" fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  sectionTitle: { fontSize: FontSize.label, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  card: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.lg },
  rowLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  stats: { gap: Spacing.xs },
  statText: { fontSize: FontSize.label },
});
