import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TextInput } from 'react-native';
import { serializeGamification } from '../../lib/parser';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import {
  loadGamiConfig,
  saveGamiConfig,
  DEFAULT_GAMI_CONFIG,
  type GamificationConfig,
} from '../../constants/rewards';

interface SettingsGamificationProps {
  vault: any;
  gamiData: any;
  refresh: () => Promise<void>;
}

export function SettingsGamification({ vault, gamiData, refresh }: SettingsGamificationProps) {
  const { primary, colors } = useThemeColors();
  const [config, setConfig] = useState<GamificationConfig>(DEFAULT_GAMI_CONFIG);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    loadGamiConfig().then(setConfig);
  }, []);

  const updateField = useCallback((updater: (c: GamificationConfig) => GamificationConfig) => {
    setConfig(prev => {
      const next = updater(prev);
      setDirty(true);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    await saveGamiConfig(config);
    setDirty(false);
    Alert.alert('Enregistré', 'Les points de gamification ont été mis à jour.');
  }, [config]);

  const handleResetConfig = useCallback(() => {
    setConfig(DEFAULT_GAMI_CONFIG);
    setDirty(true);
  }, []);

  const handleReset = useCallback(() => {
    Alert.alert(
      'Réinitialiser la gamification',
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
            Alert.alert('Gamification réinitialisée.');
          },
        },
      ]
    );
  }, [vault, gamiData, refresh]);

  const parseNum = (text: string, fallback: number) => {
    const n = parseInt(text, 10);
    return isNaN(n) || n < 0 ? fallback : n;
  };

  return (
    <View style={styles.section} accessibilityRole="summary" accessibilityLabel="Section Gamification">
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Gamification</Text>

      {/* Points config */}
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Points par action</Text>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.textSub }]}>Points par tâche</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            value={String(config.pointsPerTask)}
            onChangeText={t => updateField(c => ({ ...c, pointsPerTask: parseNum(t, DEFAULT_GAMI_CONFIG.pointsPerTask) }))}
            keyboardType="number-pad"
            selectTextOnFocus
          />
        </View>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.textSub }]}>Bonus streak (jours consécutifs)</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            value={String(config.streakBonus)}
            onChangeText={t => updateField(c => ({ ...c, streakBonus: parseNum(t, DEFAULT_GAMI_CONFIG.streakBonus) }))}
            keyboardType="number-pad"
            selectTextOnFocus
          />
        </View>
      </View>

      {/* Loot thresholds */}
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Points pour 1 loot box</Text>

        {(['enfant', 'ado', 'adulte'] as const).map(role => (
          <View key={role} style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSub }]}>
              {role === 'enfant' ? 'Enfant' : role === 'ado' ? 'Ado' : 'Adulte'}
            </Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              value={String(config.lootThreshold[role])}
              onChangeText={t => updateField(c => ({
                ...c,
                lootThreshold: { ...c.lootThreshold, [role]: parseNum(t, DEFAULT_GAMI_CONFIG.lootThreshold[role]) },
              }))}
              keyboardType="number-pad"
              selectTextOnFocus
            />
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        {dirty && (
          <Button label="Enregistrer les modifications" onPress={handleSave} variant="primary" size="md" fullWidth />
        )}
        <Button label="Valeurs par défaut" onPress={handleResetConfig} variant="secondary" size="sm" fullWidth />

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
        <Button label="Réinitialiser la gamification" onPress={handleReset} variant="danger" size="sm" fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  sectionTitle: { fontSize: FontSize.label, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  card: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.lg, marginBottom: Spacing.md },
  cardTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  rowLabel: { fontSize: FontSize.body, fontWeight: FontWeight.medium, flex: 1 },
  input: { width: 64, textAlign: 'center', fontSize: FontSize.body, fontWeight: FontWeight.semibold, borderWidth: 1, borderRadius: Radius.md, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm },
  stats: { gap: Spacing.xs },
  statText: { fontSize: FontSize.label },
});
