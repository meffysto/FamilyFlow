/**
 * lightning-spike.tsx — Playground du spike Lightning end-to-end
 *
 * Spike feat/lightning-farm — voir .planning/spikes/001-lnbits-end-to-end/README.md
 *
 * Ce qui est validé ici :
 *   1. Connexion à l'instance LNbits depuis RN/Expo (TLS, X-Api-Key, JSON).
 *   2. Fetch balance via GET /api/v1/wallet (msat → sats).
 *   3. Création d'une invoice 100 sats via POST /api/v1/payments.
 *   4. Affichage QR du bolt11 + bouton copier.
 *   5. Polling GET /api/v1/payments/{hash} toutes les 2s jusqu'à paid.
 *   6. Bascule visuelle pending → paid en live, refresh balance auto.
 *
 * Pas de conversion feuilles↔sats ici, c'est l'itération suivante.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import {
  ArrowLeft,
  Bitcoin,
  Check,
  Copy,
  RefreshCw,
  Zap,
} from 'lucide-react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import { Button } from '../components/ui/Button';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { Shadows } from '../constants/shadows';
import {
  isLightningEnabled,
  LnbitsClient,
  LnbitsError,
  loadLnbitsConfig,
  type CreateInvoiceResult,
  type LnbitsConfig,
  type PaymentStatusValue,
  type WalletInfo,
} from '../lib/lightning';

const TEST_AMOUNT_SATS = 100;
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export default function LightningSpikeScreen() {
  const router = useRouter();
  const { primary, colors, isDark } = useThemeColors();

  const [config, setConfig] = useState<LnbitsConfig | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const [invoice, setInvoice] = useState<CreateInvoiceResult | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusValue>('pending');
  const [pollError, setPollError] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  const client = useMemo(() => (config ? new LnbitsClient(config) : null), [config]);

  // Charge config + flag au boot
  useEffect(() => {
    (async () => {
      const [flag, cfg] = await Promise.all([
        isLightningEnabled(),
        loadLnbitsConfig(),
      ]);
      setEnabled(flag);
      setConfig(cfg);
    })();
  }, []);

  // Première fetch de la balance dès que le client est prêt
  const refreshWallet = useCallback(async () => {
    if (!client) return;
    setLoadingWallet(true);
    setWalletError(null);
    try {
      const w = await client.getWallet();
      setWallet(w);
    } catch (err) {
      const msg = err instanceof LnbitsError ? err.message : 'Erreur inconnue';
      setWalletError(msg);
    } finally {
      setLoadingWallet(false);
    }
  }, [client]);

  useEffect(() => {
    if (client) refreshWallet();
  }, [client, refreshWallet]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback((paymentHash: string) => {
    stopPolling();
    pollStartRef.current = Date.now();
    pollIntervalRef.current = setInterval(async () => {
      if (!client) return;
      if (Date.now() - pollStartRef.current > POLL_MAX_DURATION_MS) {
        stopPolling();
        setPollError('Timeout polling (5 min) — l\'invoice est peut-être expirée.');
        return;
      }
      try {
        const status = await client.getPaymentStatus(paymentHash);
        setPaymentStatus(status.status);
        if (status.status === 'paid') {
          stopPolling();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          refreshWallet();
        } else if (status.status === 'failed') {
          stopPolling();
        }
      } catch (err) {
        if (__DEV__) console.warn('[lightning-spike] poll error:', err);
      }
    }, POLL_INTERVAL_MS);
  }, [client, refreshWallet, stopPolling]);

  const handleCreateInvoice = useCallback(async () => {
    if (!client) return;
    setCreatingInvoice(true);
    setInvoice(null);
    setPaymentStatus('pending');
    setPollError(null);
    try {
      const inv = await client.createInvoice(TEST_AMOUNT_SATS, 'FamilyFlow spike — test invoice');
      setInvoice(inv);
      setInvoiceModalOpen(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      startPolling(inv.paymentHash);
    } catch (err) {
      const msg = err instanceof LnbitsError ? err.message : 'Erreur inconnue';
      Alert.alert('Création invoice échouée', msg);
    } finally {
      setCreatingInvoice(false);
    }
  }, [client, startPolling]);

  const handleCopyBolt11 = useCallback(async () => {
    if (!invoice) return;
    await Clipboard.setStringAsync(invoice.bolt11);
    Haptics.selectionAsync();
    Alert.alert('Copié', 'Invoice bolt11 copiée dans le presse-papier.');
  }, [invoice]);

  const handleCloseInvoiceModal = useCallback(() => {
    setInvoiceModalOpen(false);
    stopPolling();
  }, [stopPolling]);

  // États bloquants en haut de l'écran
  if (enabled === null) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={primary} />
      </SafeAreaView>
    );
  }

  if (!enabled || !config) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Retour" hitSlop={12}>
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Lightning — test</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={[styles.emptyCard, Shadows.sm, { backgroundColor: colors.card, marginHorizontal: Spacing['3xl'] }]}>
          <Zap size={28} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Lightning n'est pas activé</Text>
          <Text style={[styles.emptyText, { color: colors.textSub }]}>
            Va dans Réglages → Labo → Lightning Wallet pour configurer ton instance LNbits et activer le flag.
          </Text>
          <Button label="Ouvrir les Réglages" onPress={() => router.replace('/(tabs)/settings' as any)} variant="primary" />
        </View>
      </SafeAreaView>
    );
  }

  const isDemo = config.baseUrl.includes('demo.lnbits.com');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Retour" hitSlop={12}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Lightning — test</Text>
        <TouchableOpacity onPress={refreshWallet} accessibilityLabel="Rafraîchir" hitSlop={12} disabled={loadingWallet}>
          <RefreshCw size={20} color={loadingWallet ? colors.textFaint : colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Bandeau instance */}
        <View style={[styles.instanceBanner, { backgroundColor: isDemo ? colors.warningBg : colors.successBg }]}>
          <Text style={[styles.instanceText, { color: isDemo ? colors.warningText : colors.success }]}>
            {isDemo ? 'Instance DEMO — pas de vrais sats' : `Instance perso · ${new URL(config.baseUrl).hostname}`}
          </Text>
        </View>

        {/* Carte balance */}
        <View style={[styles.balanceCard, Shadows.md, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <Bitcoin size={20} color={primary} />
            <Text style={[styles.balanceLabel, { color: colors.textSub }]}>Balance du wallet</Text>
          </View>
          {loadingWallet && !wallet ? (
            <ActivityIndicator color={primary} style={{ marginVertical: Spacing.xl }} />
          ) : walletError ? (
            <Text style={[styles.balanceError, { color: colors.error }]}>{walletError}</Text>
          ) : wallet ? (
            <>
              <Text style={[styles.balanceValue, { color: colors.text }]}>
                {wallet.balanceSats.toLocaleString('fr-FR')} <Text style={[styles.balanceUnit, { color: colors.textSub }]}>sats</Text>
              </Text>
              <Text style={[styles.walletName, { color: colors.textFaint }]}>« {wallet.name} »</Text>
            </>
          ) : null}
        </View>

        {/* Bouton génération invoice */}
        <View style={[styles.actionCard, Shadows.sm, { backgroundColor: colors.card }]}>
          <Text style={[styles.actionTitle, { color: colors.text }]}>Test de réception</Text>
          <Text style={[styles.actionSubtitle, { color: colors.textSub }]}>
            Génère une invoice de {TEST_AMOUNT_SATS} sats et regarde le statut basculer en live quand elle est payée.
          </Text>
          <Button
            label={creatingInvoice ? 'Génération...' : `Générer invoice ${TEST_AMOUNT_SATS} sats`}
            onPress={handleCreateInvoice}
            variant="primary"
            size="lg"
            disabled={creatingInvoice || !!walletError}
          />
        </View>
      </ScrollView>

      {/* Modal QR invoice + polling */}
      <Modal
        visible={invoiceModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseInvoiceModal}
      >
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.bg }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleCloseInvoiceModal} accessibilityLabel="Fermer" hitSlop={12}>
              <Text style={[styles.closeText, { color: primary }]}>Fermer</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Invoice {TEST_AMOUNT_SATS} sats</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Statut badge */}
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    paymentStatus === 'paid' ? colors.successBg :
                    paymentStatus === 'failed' ? colors.errorBg : colors.warningBg,
                },
              ]}
            >
              {paymentStatus === 'paid' ? (
                <Check size={16} color={colors.success} />
              ) : paymentStatus === 'failed' ? (
                <Text style={{ color: colors.error }}>✕</Text>
              ) : (
                <ActivityIndicator color={colors.warningText} size="small" />
              )}
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      paymentStatus === 'paid' ? colors.success :
                      paymentStatus === 'failed' ? colors.error : colors.warningText,
                  },
                ]}
              >
                {paymentStatus === 'paid' ? 'PAYÉE ✓' : paymentStatus === 'failed' ? 'ÉCHEC' : 'En attente de paiement...'}
              </Text>
            </View>

            {/* QR */}
            {invoice && paymentStatus !== 'paid' && (
              <View style={[styles.qrWrap, { backgroundColor: '#FFFFFF' }]}>
                <QRCode
                  value={invoice.bolt11.toUpperCase()}
                  size={240}
                  backgroundColor="#FFFFFF"
                  color="#000000"
                />
              </View>
            )}

            {paymentStatus === 'paid' && (
              <View style={[styles.paidCard, { backgroundColor: colors.successBg }]}>
                <Text style={[styles.paidEmoji]}>⚡️🎉</Text>
                <Text style={[styles.paidTitle, { color: colors.success }]}>Paiement reçu !</Text>
                <Text style={[styles.paidText, { color: colors.text }]}>
                  Balance mise à jour automatiquement.
                </Text>
              </View>
            )}

            {/* Bolt11 copyable */}
            {invoice && (
              <TouchableOpacity
                style={[styles.bolt11Box, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
                onPress={handleCopyBolt11}
                accessibilityRole="button"
                accessibilityLabel="Copier l'invoice bolt11"
              >
                <View style={styles.row}>
                  <Copy size={14} color={colors.textSub} />
                  <Text style={[styles.bolt11Label, { color: colors.textSub }]}>Invoice bolt11 (tap pour copier)</Text>
                </View>
                <Text style={[styles.bolt11Text, { color: colors.text }]} numberOfLines={3}>
                  {invoice.bolt11}
                </Text>
              </TouchableOpacity>
            )}

            {pollError && (
              <Text style={[styles.pollError, { color: colors.error }]}>{pollError}</Text>
            )}

            <Text style={[styles.hint, { color: colors.textFaint }]}>
              Scanne le QR avec un wallet Lightning (Phoenix, Wallet of Satoshi, Zeus, BlueWallet…) pour tester le flow.
              {isDemo ? ' Sur demo.lnbits.com, n\'importe quel wallet peut payer car ils ont une faucet.' : ''}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.xl,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  closeText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  scrollContent: { padding: Spacing['3xl'], gap: Spacing.xl },
  instanceBanner: { padding: Spacing.lg, borderRadius: Radius.md, alignItems: 'center' },
  instanceText: { fontSize: FontSize.label, fontWeight: FontWeight.semibold },
  balanceCard: { borderRadius: Radius.xl, padding: Spacing['3xl'], gap: Spacing.md, alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  balanceLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  balanceValue: { fontSize: 36, fontWeight: FontWeight.bold },
  balanceUnit: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  balanceError: { fontSize: FontSize.sm, marginTop: Spacing.md },
  walletName: { fontSize: FontSize.sm, fontStyle: 'italic' },
  actionCard: { borderRadius: Radius.xl, padding: Spacing['2xl'], gap: Spacing.lg },
  actionTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  actionSubtitle: { fontSize: FontSize.sm, lineHeight: 20 },
  emptyCard: {
    borderRadius: Radius.xl,
    padding: Spacing['3xl'],
    gap: Spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  emptyText: { fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center' },
  modalSafe: { flex: 1 },
  modalContent: { padding: Spacing['3xl'], gap: Spacing.xl, alignItems: 'center' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius.full ?? 999,
    alignSelf: 'center',
  },
  statusText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  qrWrap: {
    padding: Spacing['2xl'],
    borderRadius: Radius.lg,
    alignSelf: 'center',
  },
  paidCard: {
    padding: Spacing['3xl'],
    borderRadius: Radius.xl,
    alignItems: 'center',
    gap: Spacing.md,
    alignSelf: 'stretch',
  },
  paidEmoji: { fontSize: 48 },
  paidTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  paidText: { fontSize: FontSize.sm, textAlign: 'center' },
  bolt11Box: {
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
    alignSelf: 'stretch',
  },
  bolt11Label: { fontSize: FontSize.label, fontWeight: FontWeight.semibold },
  bolt11Text: { fontFamily: 'Menlo', fontSize: FontSize.caption, lineHeight: 16 },
  pollError: { fontSize: FontSize.sm, textAlign: 'center' },
  hint: { fontSize: FontSize.label, lineHeight: 16, textAlign: 'center', marginTop: Spacing.md },
});
