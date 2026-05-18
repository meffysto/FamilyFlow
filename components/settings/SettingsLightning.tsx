/**
 * SettingsLightning — Configuration du wallet Lightning (LNbits BYO)
 *
 * Phase 53 Plan 03b — étendu avec :
 *   - TriggerModeSelector (3 modes — REQ-3)
 *   - Input dailyCapPerMember (clamp 100-10000 — REQ-4)
 *   - Entrée conditionnelle "Pay-outs en attente (N)" → PayoutQueueModal (D-06)
 *   - Liens vers /lightning-spike + /lightning-family-spike RETIRÉS (Pitfall #10)
 *
 * UX (existant conservé) :
 *   - Toggle « Activer Lightning » (par défaut OFF).
 *   - Form baseUrl + invoice key (placeholder demo.lnbits.com).
 *   - Bouton « Préremplir demo.lnbits.com » pour tester sans node perso.
 *   - Bouton « Tester la connexion » → tente GET /api/v1/wallet, affiche balance.
 *   - Bouton « Sauvegarder » → SecureStore + active le flag.
 *
 * Garanties :
 *   - Aucun appel réseau LN si l'interrupteur est OFF.
 *   - Creds vivent en SecureStore, JAMAIS dans le vault Markdown.
 *   - Invoice key suffit pour le form legacy (pas l'admin key — surface réduite).
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
import { Bitcoin, Clock, Lightbulb, Zap } from 'lucide-react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useVault } from '../../contexts/VaultContext';
import { Button } from '../ui/Button';
import { SectionHeader } from '../ui/SectionHeader';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import {
  clearLnbitsConfig,
  isLightningEnabled,
  LnbitsClient,
  LnbitsError,
  loadFamilyConfig,
  loadLnbitsConfig,
  loadQueue,
  saveFamilyConfig,
  saveLnbitsConfig,
  setLightningEnabled,
  type FamilyLightningConfig,
  type WalletInfo,
} from '../../lib/lightning';
import { TriggerModeSelector, type TriggerMode } from '../lightning/TriggerModeSelector';
import { PayoutQueueModal } from '../lightning/PayoutQueueModal';

const DEMO_URL = 'https://demo.lnbits.com';
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
  const [baseUrl, setBaseUrl] = useState('');
  const [invoiceKey, setInvoiceKey] = useState('');
  const [savedConfigured, setSavedConfigured] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<WalletInfo | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

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
      const [flag, cfg, family] = await Promise.all([
        isLightningEnabled(),
        loadLnbitsConfig(),
        loadFamilyConfig(),
      ]);
      setEnabled(flag);
      if (cfg) {
        setBaseUrl(cfg.baseUrl);
        setInvoiceKey(cfg.invoiceKey);
        setSavedConfigured(true);
      }
      if (family) {
        setFamilyConfig(family);
        setTriggerMode(family.triggerMode);
        setDailyCapInput(String(family.dailyCapPerMember));
      }
      await refreshQueueCount();
    })();
  }, [refreshQueueCount]);

  const handleToggle = useCallback(async (value: boolean) => {
    if (value && !savedConfigured) {
      Alert.alert(
        'Configurer d\'abord',
        'Renseigne l\'URL et l\'invoice key, puis sauvegarde avant d\'activer Lightning.',
      );
      return;
    }
    setEnabled(value);
    await setLightningEnabled(value);
  }, [savedConfigured]);

  const handlePrefillDemo = useCallback(() => {
    setBaseUrl(DEMO_URL);
  }, []);

  const handleTest = useCallback(async () => {
    if (!baseUrl.trim() || !invoiceKey.trim()) {
      Alert.alert('Champs manquants', 'URL et invoice key sont requis pour tester.');
      return;
    }
    setTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const client = new LnbitsClient({ baseUrl, invoiceKey });
      const wallet = await client.getWallet();
      setTestResult(wallet);
    } catch (err) {
      const msg = err instanceof LnbitsError ? err.message : 'Erreur inconnue';
      setTestError(msg);
    } finally {
      setTesting(false);
    }
  }, [baseUrl, invoiceKey]);

  const handleSave = useCallback(async () => {
    if (!baseUrl.trim() || !invoiceKey.trim()) {
      Alert.alert('Champs manquants', 'URL et invoice key sont requis.');
      return;
    }
    setSaving(true);
    try {
      await saveLnbitsConfig({ baseUrl, invoiceKey });
      setSavedConfigured(true);
      Alert.alert(
        'Sauvegardé',
        'Configuration LNbits enregistrée dans le coffre sécurisé du téléphone. Active maintenant l\'interrupteur si tu veux utiliser Lightning.',
      );
    } finally {
      setSaving(false);
    }
  }, [baseUrl, invoiceKey]);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Effacer la configuration ?',
      'Supprime l\'URL, les clés et désactive Lightning.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: async () => {
            await clearLnbitsConfig();
            await setLightningEnabled(false);
            setEnabled(false);
            setBaseUrl('');
            setInvoiceKey('');
            setSavedConfigured(false);
            setTestResult(null);
            setTestError(null);
          },
        },
      ],
    );
  }, []);

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
              {savedConfigured
                ? enabled
                  ? 'Actif — appels réseau autorisés vers ton instance LNbits.'
                  : 'Configuré mais désactivé — aucun appel réseau.'
                : 'Non configuré. Renseigne l\'URL et la clé ci-dessous.'}
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

      {/* Form connexion */}
      <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card, marginTop: Spacing.xl }]}>
        <View style={styles.rowBetween}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Connexion LNbits</Text>
          <TouchableOpacity onPress={handlePrefillDemo} accessibilityLabel="Préremplir demo.lnbits.com">
            <Text style={[styles.linkText, { color: primary }]}>Utiliser demo.lnbits.com</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.inputLabel, { color: colors.textSub }]}>URL de l'instance</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholder="https://demo.lnbits.com"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <Text style={[styles.inputLabel, { color: colors.textSub }]}>Invoice / Read key</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
          value={invoiceKey}
          onChangeText={setInvoiceKey}
          placeholder="abcdef0123456789..."
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        <View style={[styles.tip, { backgroundColor: colors.warningBg, borderColor: colors.warning }]}>
          <Lightbulb size={14} strokeWidth={1.75} color={colors.warningText} style={{ marginTop: 2 }} />
          <Text style={[styles.tipText, { color: colors.warningText, flex: 1 }]}>
            Utilise <Text style={styles.bold}>l'invoice/read key</Text> (création d'invoice + lecture balance).
            <Text style={styles.bold}> Jamais l'admin key.</Text> Visible dans LNbits → Wallet → API info.
          </Text>
        </View>

        {/* Résultats du test */}
        {testResult && (
          <View style={[styles.resultCard, { backgroundColor: colors.successBg, borderColor: colors.success }]}>
            <Bitcoin size={16} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.resultTitle, { color: colors.success }]}>Connexion OK</Text>
              <Text style={[styles.resultText, { color: colors.text }]}>
                Wallet « {testResult.name} » · balance {testResult.balanceSats} sats
              </Text>
            </View>
          </View>
        )}
        {testError && (
          <View style={[styles.resultCard, { backgroundColor: colors.errorBg, borderColor: colors.error }]}>
            <Text style={[styles.resultTitle, { color: colors.error }]}>Erreur</Text>
            <Text style={[styles.resultText, { color: colors.text, flex: 1 }]}>{testError}</Text>
          </View>
        )}

        <View style={styles.btnRow}>
          <Button label={testing ? '...' : 'Tester'} onPress={handleTest} variant="secondary" size="md" disabled={testing} />
          <Button label={saving ? '...' : 'Sauvegarder'} onPress={handleSave} variant="primary" size="md" disabled={saving} />
        </View>

        {savedConfigured && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn} accessibilityLabel="Effacer la configuration">
            <Text style={[styles.clearText, { color: colors.error }]}>Effacer la configuration</Text>
          </TouchableOpacity>
        )}
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
  linkText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  inputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: Spacing.md },
  input: { borderWidth: 1.5, borderRadius: Radius.base, padding: Spacing.xl, fontSize: FontSize.body },
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
  resultCard: {
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  resultTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  resultText: { fontSize: FontSize.label, lineHeight: 18, marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  clearBtn: { alignSelf: 'center', paddingVertical: Spacing.md },
  clearText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
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
