import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TextInput, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { serializeGamification } from '../../lib/parser';
import { useGiftExchange } from '../../hooks/useGiftExchange';
import type { GiftRequest } from '../../lib/types';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';
import { SectionHeader } from '../ui/SectionHeader';
import { Trophy } from 'lucide-react-native';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import {
  loadGamiConfig,
  saveGamiConfig,
  DEFAULT_GAMI_CONFIG,
  type GamificationConfig,
} from '../../lib/gamification';

interface SettingsGamificationProps {
  vault: any;
  gamiData: any;
  refresh: () => Promise<void>;
}

export function SettingsGamification({ vault, gamiData, refresh }: SettingsGamificationProps) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const [config, setConfig] = useState<GamificationConfig>(DEFAULT_GAMI_CONFIG);
  const [dirty, setDirty] = useState(false);

  // FAM-49 — file d'attente des demandes de cadeau
  const { approveGift, rejectGift, loadAll } = useGiftExchange();
  const [pending, setPending] = useState<GiftRequest[]>([]);

  const reloadPending = useCallback(async () => {
    const all = await loadAll();
    setPending(all.filter(g => g.status === 'pending'));
  }, [loadAll]);

  useEffect(() => {
    loadGamiConfig().then(setConfig);
  }, []);

  useEffect(() => {
    reloadPending();
  }, [reloadPending]);

  const handleApproveGift = useCallback(async (id: string) => {
    await approveGift(id);
    await reloadPending();
    await refresh();
  }, [approveGift, reloadPending, refresh]);

  const handleRejectGift = useCallback(async (id: string) => {
    await rejectGift(id);
    await reloadPending();
    await refresh();
  }, [rejectGift, reloadPending, refresh]);

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
    Alert.alert(t('settings.gamification.savedTitle'), t('settings.gamification.savedMsg'));
  }, [config, t]);

  const handleResetConfig = useCallback(() => {
    setConfig(DEFAULT_GAMI_CONFIG);
    setDirty(true);
  }, []);

  const handleReset = useCallback(() => {
    Alert.alert(
      t('settings.gamification.resetTitle'),
      t('settings.gamification.resetMessage'),
      [
        { text: t('settings.gamification.cancel'), style: 'cancel' },
        {
          text: t('settings.gamification.resetConfirm'),
          style: 'destructive',
          onPress: async () => {
            if (!vault || !gamiData) return;
            // Reset per-profile : ecrire un fichier gami-{id}.md vide pour chaque profil
            for (const p of gamiData.profiles) {
              const resetProfile = {
                ...p, points: 0, level: 1, streak: 0, lootBoxesAvailable: 0, multiplier: 1, multiplierRemaining: 0, pityCounter: 0,
              };
              const singleResetData = {
                profiles: [resetProfile],
                history: [],
                activeRewards: [],
              };
              await vault.writeFile(`gami-${p.id}.md`, serializeGamification(singleResetData));
            }
            await refresh();
            Alert.alert(t('settings.gamification.resetDone'));
          },
        },
      ]
    );
  }, [vault, gamiData, refresh, t]);

  const parseNum = (text: string, fallback: number) => {
    const n = parseInt(text, 10);
    return isNaN(n) || n < 0 ? fallback : n;
  };

  return (
    <View style={styles.section} accessibilityRole="summary" accessibilityLabel={t('settings.gamification.sectionA11y')}>
      <SectionHeader
        title={t('settings.gamification.sectionTitle')}
        icon={<Trophy size={16} strokeWidth={1.75} color={colors.brand.soilMuted} />}
        flush
      />

      {/* Points config */}
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings.gamification.pointsPerAction')}</Text>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.textSub }]}>{t('settings.gamification.pointsPerTask')}</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            value={String(config.pointsPerTask)}
            onChangeText={txt => updateField(c => ({ ...c, pointsPerTask: parseNum(txt, DEFAULT_GAMI_CONFIG.pointsPerTask) }))}
            keyboardType="number-pad"
            selectTextOnFocus
          />
        </View>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.textSub }]}>{t('settings.gamification.streakBonus')}</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            value={String(config.streakBonus)}
            onChangeText={txt => updateField(c => ({ ...c, streakBonus: parseNum(txt, DEFAULT_GAMI_CONFIG.streakBonus) }))}
            keyboardType="number-pad"
            selectTextOnFocus
          />
        </View>
      </View>

      {/* Loot thresholds */}
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings.gamification.lootThreshold')}</Text>

        {(['enfant', 'ado', 'adulte'] as const).map(role => (
          <View key={role} style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSub }]}>
              {role === 'enfant' ? t('settings.gamification.roleChild') : role === 'ado' ? t('settings.gamification.roleTeen') : t('settings.gamification.roleAdult')}
            </Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              value={String(config.lootThreshold[role])}
              onChangeText={txt => updateField(c => ({
                ...c,
                lootThreshold: { ...c.lootThreshold, [role]: parseNum(txt, DEFAULT_GAMI_CONFIG.lootThreshold[role]) },
              }))}
              keyboardType="number-pad"
              selectTextOnFocus
            />
          </View>
        ))}
      </View>

      {/* FAM-49 — Échange feuilles → cadeau € */}
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings.gamification.giftExchangeTitle')}</Text>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.textSub }]}>{t('settings.gamification.giftExchangeEnabled')}</Text>
          <Switch
            value={config.giftExchange.enabled}
            onValueChange={v => updateField(c => ({ ...c, giftExchange: { ...c.giftExchange, enabled: v } }))}
            trackColor={{ true: primary }}
          />
        </View>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.textSub }]}>{t('settings.gamification.giftExchangeLeaves')}</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            value={String(config.giftExchange.leavesCost)}
            onChangeText={txt => updateField(c => ({ ...c, giftExchange: { ...c.giftExchange, leavesCost: parseNum(txt, DEFAULT_GAMI_CONFIG.giftExchange.leavesCost) } }))}
            keyboardType="number-pad"
            selectTextOnFocus
          />
        </View>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.textSub }]}>{t('settings.gamification.giftExchangeEuro')}</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            value={String(config.giftExchange.euroValue)}
            onChangeText={txt => updateField(c => ({ ...c, giftExchange: { ...c.giftExchange, euroValue: parseNum(txt, DEFAULT_GAMI_CONFIG.giftExchange.euroValue) } }))}
            keyboardType="number-pad"
            selectTextOnFocus
          />
        </View>
      </View>

      {/* FAM-49 — Cadeaux en attente (validation parentale) */}
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings.gamification.pendingGiftsTitle')}</Text>

        {pending.length === 0 ? (
          <Text style={[styles.statText, { color: colors.textMuted }]}>{t('settings.gamification.pendingGiftsEmpty')}</Text>
        ) : (
          pending.map(gift => (
            <View key={gift.id} style={styles.giftRow}>
              <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
                {t('settings.gamification.pendingGiftLabel', { name: gift.profileName, euro: gift.euroValue, leaves: gift.leavesCost })}
              </Text>
              <View style={styles.giftActions}>
                <Button label={t('settings.gamification.approve')} onPress={() => handleApproveGift(gift.id)} variant="primary" size="sm" />
                <Button label={t('settings.gamification.reject')} onPress={() => handleRejectGift(gift.id)} variant="danger" size="sm" />
              </View>
            </View>
          ))
        )}
      </View>

      {/* Actions */}
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        {dirty && (
          <Button label={t('settings.gamification.saveChanges')} onPress={handleSave} variant="primary" size="md" fullWidth />
        )}
        <Button label={t('settings.gamification.defaultValues')} onPress={handleResetConfig} variant="secondary" size="sm" fullWidth />

        {gamiData && (
          <View style={styles.stats}>
            <Text style={[styles.statText, { color: colors.textMuted }]}>
              {t('settings.gamification.totalCompleted', { count: gamiData.history.filter((h: any) => h.action.startsWith('+')).length })}
            </Text>
            <Text style={[styles.statText, { color: colors.textMuted }]}>
              {t('settings.gamification.totalLootOpened', { count: gamiData.history.filter((h: any) => h.action.startsWith('loot:')).length })}
            </Text>
          </View>
        )}
        <Button label={t('settings.gamification.resetBtn')} onPress={handleReset} variant="danger" size="sm" fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  card: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.lg, marginBottom: Spacing.md },
  cardTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  rowLabel: { fontSize: FontSize.body, fontWeight: FontWeight.medium, flex: 1 },
  input: { width: 64, textAlign: 'center', fontSize: FontSize.body, fontWeight: FontWeight.semibold, borderWidth: 1, borderRadius: Radius.md, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm },
  stats: { gap: Spacing.xs },
  statText: { fontSize: FontSize.label },
  giftRow: { gap: Spacing.sm },
  giftActions: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
});
