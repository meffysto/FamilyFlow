/**
 * SettingsLightning — Configuration du wallet Lightning (LNbits BYO, family-only)
 *
 * Phase 53 Plan 04 — Final shape :
 *   - Toggle « Activer Lightning » (par défaut OFF, gate sur `familyConfig !== null`)
 *   - TriggerModeSelector (3 modes — REQ-3)
 *   - Input dailyCapPerMember (clamp 100-10000 — REQ-4)
 *   - Entrée conditionnelle "Pay-outs en attente (N)" → PayoutQueueModal (D-06)
 *   - Form legacy single-wallet (baseUrl + invoiceKey + test/save/clear) RETIRÉ —
 *     la config family se fait via le playground ou un futur wizard family. La
 *     surface single-wallet est obsolète depuis le rename Member (Plan 01) +
 *     family-credentials.ts (Plan 01).
 *
 * Garanties :
 *   - Aucun appel réseau LN si l'interrupteur est OFF (SPEC Constraint #1).
 *   - Creds vivent en SecureStore via `lightning_family_config_v1`,
 *     JAMAIS dans le vault Markdown.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Clock, Lightbulb, Zap } from 'lucide-react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useVault } from '../../contexts/VaultContext';
import { SectionHeader } from '../ui/SectionHeader';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import {
  isLightningEnabled,
  loadFamilyConfig,
  loadQueue,
  saveFamilyConfig,
  setLightningEnabled,
  type FamilyLightningConfig,
} from '../../lib/lightning';
import { TriggerModeSelector, type TriggerMode } from '../lightning/TriggerModeSelector';
import { PayoutQueueModal } from '../lightning/PayoutQueueModal';

const DAILY_CAP_MIN = 100;
const DAILY_CAP_MAX = 10000;
const DAILY_CAP_DEFAULT = 1000;

function clampDailyCap(value: number): number {
  if (!Number.isFinite(value)) return DAILY_CAP_DEFAULT;
  return Math.max(DAILY_CAP_MIN, Math.min(DAILY_CAP_MAX, Math.floor(value)));
}

export function SettingsLightning() {
  const { primary, colors } = useThemeColors();
  const { profiles, tasks } = useVault();

  const [enabled, setEnabled] = useState(false);

  // Phase 53 — TriggerMode + dailyCap + queue entry
  const [familyConfig, setFamilyConfig] = useState<FamilyLightningConfig | null>(null);
  const [triggerMode, setTriggerMode] = useState<TriggerMode>('instant');
  const [dailyCapInput, setDailyCapInput] = useState<string>(String(DAILY_CAP_DEFAULT));
  const [pendingCount, setPendingCount] = useState(0);
  const [showQueueModal, setShowQueueModal] = useState(false);

  const refreshQueueCount = useCallback(async () => {
    try {
      const queue = await loadQueue();
      setPendingCount(queue.filter((i) => i.reason === 'review').length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [flag, family] = await Promise.all([
        isLightningEnabled(),
        loadFamilyConfig(),
      ]);
      setEnabled(flag);
      if (family) {
        setFamilyConfig(family);
        setTriggerMode(family.triggerMode);
        setDailyCapInput(String(family.dailyCapPerMember));
      }
      await refreshQueueCount();
    })();
  }, [refreshQueueCount]);

  const handleToggle = useCallback(async (value: boolean) => {
    if (value && familyConfig === null) {
      Alert.alert(
        'Configurer d\'abord',
        'Aucune configuration family Lightning détectée. La configuration se fait depuis un build dev (config wallets membres + family + adminKey).',
      );
      return;
    }
    setEnabled(value);
    await setLightningEnabled(value);
  }, [familyConfig]);

  // Phase 53 — persist triggerMode (REQ-3).
  const handleChangeTriggerMode = useCallback(
    async (mode: TriggerMode) => {
      setTriggerMode(mode);
      if (!familyConfig) return;
      const updated: FamilyLightningConfig = { ...familyConfig, triggerMode: mode };
      await saveFamilyConfig(updated);
      setFamilyConfig(updated);
    },
    [familyConfig],
  );

  // Phase 53 — persist dailyCapPerMember (REQ-4).
  const handleSaveDailyCap = useCallback(async () => {
    if (!familyConfig) return;
    const num = parseInt(dailyCapInput, 10);
    const clamped = clampDailyCap(num);
    setDailyCapInput(String(clamped));
    const updated: FamilyLightningConfig = {
      ...familyConfig,
      dailyCapPerMember: clamped,
    };
    await saveFamilyConfig(updated);
    setFamilyConfig(updated);
  }, [familyConfig, dailyCapInput]);

  const handleOpenQueue = useCallback(() => {
    setShowQueueModal(true);
  }, []);

  const handleCloseQueue = useCallback(() => {
    setShowQueueModal(false);
    refreshQueueCount();
  }, [refreshQueueCount]);

  return (
    <View>
      <SectionHeader
        title="Lightning Wallet (BYO)"
        icon={<Zap size={16} strokeWidth={1.75} color={primary} />}
        flush
      />

      {/* Statut + toggle */}
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Activer Lightning</Text>
            <Text style={[styles.rowSub, { color: colors.textSub }]}>
              {familyConfig !== null
                ? enabled
                  ? 'Actif — appels réseau autorisés vers ton instance LNbits family.'
                  : 'Family config présente mais désactivée — aucun appel réseau.'
                : 'Aucune config family détectée. Configure les wallets membres + family depuis un build dev avant d\'activer.'}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            trackColor={{ false: colors.border, true: primary }}
            accessibilityLabel="Activer Lightning"
          />
        </View>
      </View>

      {/* Phase 53 — Mode de déclenchement (REQ-3, UI-SPEC Surface 6) */}
      {familyConfig && (
        <>
          <View style={{ marginTop: Spacing['2xl'] }}>
            <SectionHeader
              title="Déclenchement des pay-outs"
              icon={<Clock size={16} strokeWidth={1.75} color={primary} />}
              flush
            />
            <TriggerModeSelector value={triggerMode} onChange={handleChangeTriggerMode} />
          </View>

          {/* Phase 53 — Plafond quotidien par membre (REQ-4) */}
          <View
            style={[
              styles.card,
              Shadows.sm,
              { backgroundColor: colors.card, marginTop: Spacing.xl },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Plafond quotidien (sats)
            </Text>
            <Text style={[styles.rowSub, { color: colors.textSub }]}>
              Par défaut 1000. Plage : 100–10 000.
            </Text>
            <View style={styles.dailyCapRow}>
              <TextInput
                style={[
                  styles.dailyCapInput,
                  {
                    borderColor: colors.inputBorder,
                    color: colors.text,
                    backgroundColor: colors.inputBg,
                  },
                ]}
                value={dailyCapInput}
                onChangeText={setDailyCapInput}
                onBlur={handleSaveDailyCap}
                keyboardType="number-pad"
                placeholder={String(DAILY_CAP_DEFAULT)}
                placeholderTextColor={colors.textFaint}
                accessibilityLabel="Plafond quotidien en sats"
                returnKeyType="done"
                onSubmitEditing={handleSaveDailyCap}
              />
            </View>
          </View>

          {/* Phase 53 — Entrée Pay-outs en attente (D-06) — conditionnelle */}
          {pendingCount > 0 && (
            <TouchableOpacity
              style={[
                styles.card,
                Shadows.sm,
                { backgroundColor: colors.card, marginTop: Spacing.md },
              ]}
              onPress={handleOpenQueue}
              accessibilityRole="button"
              accessibilityLabel={`Pay-outs en attente, ${pendingCount} paiement${pendingCount > 1 ? 's' : ''} à valider`}
            >
              <View style={styles.rowBetween}>
                <View style={styles.row}>
                  <Clock size={18} strokeWidth={1.75} color={primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      Pay-outs en attente
                    </Text>
                    <Text style={[styles.rowSub, { color: colors.textSub }]}>
                      {`${pendingCount} pay-out${pendingCount > 1 ? 's' : ''} à valider · ${pendingCount * 100} sats`}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </>
      )}

      <View
        style={[
          styles.tip,
          {
            backgroundColor: colors.cardAlt,
            borderColor: colors.border,
            marginTop: Spacing.xl,
          },
        ]}
      >
        <Lightbulb size={14} strokeWidth={1.75} color={colors.textSub} style={{ marginTop: 2 }} />
        <Text style={[styles.tipText, { color: colors.textSub, flex: 1 }]}>
          <Text style={styles.bold}>Labo.</Text> Feature expérimentale, désactivée par défaut.
          Ton instance LNbits = ta garde de tes sats. FamilyFlow n'héberge rien et ne voit
          aucune clé privée.
        </Text>
      </View>

      {/* Modal PayoutQueueModal — Plan 03b */}
      <PayoutQueueModal
        visible={showQueueModal}
        profiles={profiles}
        tasks={tasks}
        onClose={handleCloseQueue}
        onBatchComplete={refreshQueueCount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.lg },
  rowLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  rowSub: { fontSize: FontSize.sm, lineHeight: 20, marginTop: 2 },
  cardTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  tip: {
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipText: { fontSize: FontSize.label, lineHeight: 18 },
  bold: { fontWeight: FontWeight.bold },
  dailyCapRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: Spacing.md,
  },
  dailyCapInput: {
    width: 120,
    height: 40,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.body,
    textAlign: 'center',
  },
});
