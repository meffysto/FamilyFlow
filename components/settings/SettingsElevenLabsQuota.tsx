/**
 * SettingsElevenLabsQuota.tsx — Cap quotidien ElevenLabs (chars/jour)
 *
 * Garde-fou parental contre les surprises de facture : affiche le compteur
 * du jour (chars consommés / cap), permet de choisir un preset, et propose
 * un reset manuel. Reset auto à minuit géré par lib/elevenlabs-quota.ts.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { SectionHeader } from '../ui/SectionHeader';
import { Shield } from 'lucide-react-native';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import {
  getDailyUsage,
  setDailyLimit,
  resetDailyQuota,
  type QuotaUsage,
} from '../../lib/elevenlabs-quota';

// Presets en caractères. ~30 chars/sec lecture → équivalences en pratique :
//   5k  ≈ 3 minutes audio  ≈ 0,15€   (test)
//   25k ≈ 15 minutes      ≈ 0,75€   (1 histoire/jour)
//   50k ≈ 30 minutes      ≈ 1,50€   (défaut, 2 histoires/jour)
//   100k ≈ 1h             ≈ 3€     (famille nombreuse)
//   0   = désactivé (à éviter sauf raison précise)
const PRESETS = [
  { label: '5k', value: 5_000, hint: '~3 min · 0,15€' },
  { label: '25k', value: 25_000, hint: '~15 min · 0,75€' },
  { label: '50k', value: 50_000, hint: '~30 min · 1,50€' },
  { label: '100k', value: 100_000, hint: '~1h · 3€' },
  { label: '∞', value: 0, hint: 'Désactivé' },
];

export function SettingsElevenLabsQuota() {
  const { colors, primary } = useThemeColors();
  const [usage, setUsage] = useState<QuotaUsage | null>(null);

  const refresh = useCallback(async () => {
    const u = await getDailyUsage();
    setUsage(u);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const handlePreset = useCallback(async (value: number) => {
    await setDailyLimit(value);
    await refresh();
  }, [refresh]);

  const handleReset = useCallback(() => {
    Alert.alert(
      'Réinitialiser le compteur ?',
      'Le compteur du jour repartira à 0. Le cap quotidien reste inchangé.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          onPress: async () => {
            await resetDailyQuota();
            await refresh();
          },
        },
      ],
    );
  }, [refresh]);

  if (!usage) return null;

  const limitDisabled = usage.limit === 0;
  const usedK = (usage.used / 1000).toFixed(usage.used < 1000 ? 0 : 1);
  const limitK = limitDisabled ? '∞' : (usage.limit / 1000).toFixed(0);
  const barColor = usage.percentage >= 90 ? colors.error
    : usage.percentage >= 70 ? colors.warning
    : colors.success;

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Limite quotidienne"
        icon={<Shield size={16} strokeWidth={1.75} color={colors.brand.soilMuted} />}
        flush
      />
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <Text style={[styles.description, { color: colors.textMuted }]}>
          Plafond de caractères ElevenLabs envoyés par jour. Reset automatique à minuit.
        </Text>

        {/* Compteur + barre */}
        <View style={styles.usageRow}>
          <Text style={[styles.usageText, { color: colors.text }]}>
            {usedK}k / {limitK} chars aujourd'hui
          </Text>
          <Text style={[styles.usagePct, { color: limitDisabled ? colors.textMuted : barColor }]}>
            {limitDisabled ? '—' : `${usage.percentage}%`}
          </Text>
        </View>
        {!limitDisabled && (
          <View style={[styles.barTrack, { backgroundColor: colors.inputBg }]}>
            <View style={[styles.barFill, { width: `${usage.percentage}%`, backgroundColor: barColor }]} />
          </View>
        )}

        {/* Presets */}
        <View style={styles.presetRow}>
          {PRESETS.map(p => {
            const active = usage.limit === p.value;
            return (
              <Pressable
                key={p.label}
                onPress={() => handlePreset(p.value)}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: active ? primary : colors.inputBg,
                    borderColor: active ? primary : colors.inputBorder,
                  },
                ]}
              >
                <Text style={[styles.presetLabel, { color: active ? '#fff' : colors.text }]}>
                  {p.label}
                </Text>
                <Text style={[styles.presetHint, { color: active ? '#ffffffcc' : colors.textMuted }]}>
                  {p.hint}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Reset manuel */}
        <Pressable onPress={handleReset} style={styles.resetBtn}>
          <Text style={[styles.resetText, { color: colors.textSub }]}>
            Réinitialiser le compteur du jour
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.hint, { color: colors.textFaint }]}>
        Tarif Cinéma v3 ≈ 0,30€ pour 10 000 caractères. Le défaut 50k limite à ~1,50€/jour.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
    gap: Spacing.xl,
  },
  description: {
    fontSize: FontSize.caption,
    lineHeight: 18,
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  usageText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  usagePct: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  presetChip: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.base,
    borderWidth: 1.5,
    minWidth: 70,
    alignItems: 'center',
  },
  presetLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  presetHint: {
    fontSize: FontSize.micro,
    marginTop: 2,
  },
  resetBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
  },
  resetText: {
    fontSize: FontSize.caption,
    textDecorationLine: 'underline',
  },
  hint: {
    fontSize: FontSize.micro,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
});
