/**
 * SettingsLightning — Configuration du wallet Lightning (LNbits BYO)
 *
 * Spike feat/lightning-farm — voir .planning/spikes/001-lnbits-end-to-end/README.md
 *
 * UX :
 *   - Toggle « Activer Lightning » (par défaut OFF).
 *   - Form baseUrl + invoice key (placeholder demo.lnbits.com).
 *   - Bouton « Préremplir demo.lnbits.com » pour tester sans node perso.
 *   - Bouton « Tester la connexion » → tente GET /api/v1/wallet, affiche balance.
 *   - Bouton « Sauvegarder » → SecureStore + active le flag.
 *   - Lien « Ouvrir l'écran de test » → /lightning-spike pour invoice end-to-end.
 *
 * Garanties :
 *   - Aucun appel réseau LN si l'interrupteur est OFF.
 *   - Creds vivent en SecureStore, JAMAIS dans le vault Markdown.
 *   - Invoice key suffit (pas l'admin key) — surface réduite.
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
import { useRouter } from 'expo-router';
import { Bitcoin, ExternalLink, Lightbulb, Users, Zap } from 'lucide-react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
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
  loadLnbitsConfig,
  saveLnbitsConfig,
  setLightningEnabled,
  type WalletInfo,
} from '../../lib/lightning';

const DEMO_URL = 'https://demo.lnbits.com';

export function SettingsLightning() {
  const router = useRouter();
  const { primary, colors } = useThemeColors();

  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [invoiceKey, setInvoiceKey] = useState('');
  const [savedConfigured, setSavedConfigured] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<WalletInfo | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [flag, cfg] = await Promise.all([
        isLightningEnabled(),
        loadLnbitsConfig(),
      ]);
      setEnabled(flag);
      if (cfg) {
        setBaseUrl(cfg.baseUrl);
        setInvoiceKey(cfg.invoiceKey);
        setSavedConfigured(true);
      }
    })();
  }, []);

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
      'Supprime l\'URL et l\'invoice key. Lightning sera désactivé.',
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

  const handleOpenSpike = useCallback(() => {
    router.push('/lightning-spike' as any);
  }, [router]);

  const handleOpenFamily = useCallback(() => {
    router.push('/lightning-family-spike' as any);
  }, [router]);

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

      {/* Liens vers les playgrounds */}
      {enabled && (
        <>
          {savedConfigured && (
            <TouchableOpacity
              style={[styles.card, Shadows.sm, { backgroundColor: colors.card, marginTop: Spacing.xl }]}
              onPress={handleOpenSpike}
              accessibilityRole="link"
              accessibilityLabel="Ouvrir l'écran de test Lightning"
            >
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Écran de test (1 wallet)</Text>
                  <Text style={[styles.rowSub, { color: colors.textSub }]}>
                    Balance + génération invoice 100 sats + QR + polling statut
                  </Text>
                </View>
                <ExternalLink size={18} color={primary} />
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.card, Shadows.sm, { backgroundColor: colors.card, marginTop: Spacing.md }]}
            onPress={handleOpenFamily}
            accessibilityRole="link"
            accessibilityLabel="Ouvrir le mode famille (multi-wallet)"
          >
            <View style={styles.rowBetween}>
              <View style={styles.row}>
                <Users size={18} color={primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Mode famille (multi-wallet)</Text>
                  <Text style={[styles.rowSub, { color: colors.textSub }]}>
                    Wallet famille + sub-wallet par enfant · 1 tâche = 100 sats
                  </Text>
                </View>
              </View>
              <ExternalLink size={18} color={primary} />
            </View>
          </TouchableOpacity>
        </>
      )}

      <View style={[styles.tip, { backgroundColor: colors.cardAlt, borderColor: colors.border, marginTop: Spacing.xl }]}>
        <Lightbulb size={14} strokeWidth={1.75} color={colors.textSub} style={{ marginTop: 2 }} />
        <Text style={[styles.tipText, { color: colors.textSub, flex: 1 }]}>
          <Text style={styles.bold}>Spike — Labo.</Text> Feature expérimentale, désactivée par défaut.
          Ton instance LNbits = ta garde de tes sats. FamilyFlow n'héberge rien et ne voit aucune clé privée.
        </Text>
      </View>
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
});
