/**
 * CashOutModal — Encaissement out wallet membre → externe (UI-SPEC Surface 5).
 *
 * Plan 53-03b — modal pageSheet drag-to-dismiss.
 *
 * Flow (REQ-9 + REQ-10 + SPEC #4) :
 *   1. User colle / scanne un bolt11
 *   2. Disclaimer warning visible en permanence
 *   3. Tap "Confirmer" → FaceID gate (disableDeviceFallback: !__DEV__)
 *   4. Si auth.success → LnbitsClient.payInvoice(bolt11, member.adminKey)
 *   5. appendAudit({ status: 'cash_out', paymentHash }) + toast
 *
 * Composants visuels :
 *   - TextInput multiline bolt11 (4 lignes, autoCapitalize off)
 *   - Bouton "Coller depuis le presse-papiers" (expo-clipboard)
 *   - Bouton "Scanner un QR code" → ouvre QrScannerOverlay fullScreen
 *     PAR-DESSUS la pageSheet (Pitfall #7 stacking)
 *   - Disclaimer warning permanent
 *   - Bouton "Confirmer l'encaissement" (primaire, disabled si !bolt11)
 *
 * Le QrScannerOverlay est rendu DANS le même Modal pageSheet (sibling) avec
 * presentationStyle="fullScreen" pour bénéficier du stacking natif iOS sans
 * dismiss/present successif (Pitfall #7).
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Camera, Clipboard as ClipboardIcon } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

import {
  appendAudit,
  authenticatePayOut,
  LnbitsClient,
  type FamilyLightningConfig,
  type MemberWalletMapping,
} from '../../lib/lightning';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { ModalHeader } from '../ui/ModalHeader';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

import { QrScannerOverlay } from './QrScannerOverlay';

interface CashOutModalProps {
  visible: boolean;
  /** Membre destinataire — REQ-10 requiert member.adminKey présent pour activer. */
  member: MemberWalletMapping;
  /** Config family pour baseUrl (l'adminKey est sur member, pas family). */
  config: FamilyLightningConfig;
  onClose: () => void;
  /** Callback appelé après succès → refresh balance côté écran wallet. */
  onSuccess: () => void;
}

export function CashOutModal({
  visible,
  member,
  config,
  onClose,
  onSuccess,
}: CashOutModalProps) {
  const { colors, primary } = useThemeColors();
  const { showToast } = useToast();

  const [bolt11, setBolt11] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);

  const handlePaste = useCallback(async () => {
    try {
      const clipText = await Clipboard.getStringAsync();
      if (clipText) {
        setBolt11(clipText.trim());
      }
    } catch (err) {
      if (__DEV__) console.warn('[lightning] clipboard read failed:', err);
    }
  }, []);

  const handleOpenScanner = useCallback(() => {
    setShowQrScanner(true);
  }, []);

  const handleScanned = useCallback((data: string) => {
    setBolt11(data.trim());
    setShowQrScanner(false);
  }, []);

  const handleCloseScanner = useCallback(() => {
    setShowQrScanner(false);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!bolt11 || !member.adminKey) return;
    setLoading(true);

    // FaceID gate AVANT toute opération réseau (REQ-9 + SPEC #4).
    // disableDeviceFallback: !__DEV__ → strict en prod, fallback PIN dev only.
    const auth = await authenticatePayOut({
      reason: "Confirmer l'encaissement Lightning",
      allowDevicePasscode: __DEV__,
    });
    if (!auth.success) {
      setLoading(false);
      showToast('Encaissement annulé', 'info');
      return;
    }

    try {
      // payInvoice via family-level baseUrl, mais l'adminKey utilisée est
      // celle du MEMBRE (REQ-10 — encaissement out depuis wallet membre).
      // Le constructeur LnbitsClient exige invoiceKey non vide ; on passe
      // celle du membre car non utilisée pour payInvoice (cohérence client).
      const client = new LnbitsClient({
        baseUrl: config.baseUrl,
        invoiceKey: member.invoiceKey,
      });
      const result = await client.payInvoice(bolt11, member.adminKey);
      await appendAudit({
        ts: new Date().toISOString(),
        profileId: member.profileId,
        taskId: '(cash_out)',
        sats: 0, // sats: 0 — montant porté par le bolt11, pas par l'app
        status: 'cash_out',
        paymentHash: result.paymentHash,
      });
      showToast('Encaissement effectué', 'success');
      setBolt11('');
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'inconnu';
      showToast(`Échec de l'encaissement : ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [bolt11, member, config.baseUrl, onSuccess, onClose, showToast]);

  const canConfirm = bolt11.trim().length > 0 && !loading;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <ModalHeader title="Encaisser vers wallet externe" onClose={onClose} />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.label, { color: colors.textSub }]}>
              Coller une invoice Lightning (bolt11)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              value={bolt11}
              onChangeText={setBolt11}
              placeholder="lnbc1..."
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              numberOfLines={4}
              accessibilityLabel="Invoice Lightning bolt11"
            />

            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
              onPress={handlePaste}
              accessibilityRole="button"
              accessibilityLabel="Coller depuis le presse-papiers"
            >
              <ClipboardIcon size={16} color={primary} strokeWidth={1.75} />
              <Text style={[styles.secondaryBtnLabel, { color: colors.text }]}>
                Coller depuis le presse-papiers
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
              onPress={handleOpenScanner}
              accessibilityRole="button"
              accessibilityLabel="Scanner un QR code"
            >
              <Camera size={16} color={primary} strokeWidth={1.75} />
              <Text style={[styles.secondaryBtnLabel, { color: colors.text }]}>
                Scanner un QR code
              </Text>
            </TouchableOpacity>

            <View
              style={[
                styles.disclaimer,
                {
                  backgroundColor: colors.warningBg,
                  borderColor: colors.warning,
                },
              ]}
            >
              <AlertTriangle
                size={14}
                color={colors.warningText}
                strokeWidth={1.75}
                style={styles.disclaimerIcon}
              />
              <Text
                style={[styles.disclaimerText, { color: colors.warningText }]}
              >
                <Text style={styles.disclaimerBold}>
                  La transaction Lightning est définitive.
                </Text>
                {' '}
                Vérifiez l'invoice avant de confirmer.
              </Text>
            </View>
          </ScrollView>

          {/* Bouton Confirmer en bas, plein largeur. */}
          <View
            style={[
              styles.footer,
              { borderTopColor: colors.border, backgroundColor: colors.bg },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                {
                  backgroundColor: primary,
                  opacity: canConfirm ? 1 : 0.5,
                },
              ]}
              onPress={handleConfirm}
              disabled={!canConfirm}
              accessibilityRole="button"
              accessibilityLabel="Confirmer l'encaissement"
              accessibilityState={{ disabled: !canConfirm }}
            >
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.confirmLabel, { color: colors.onPrimary }]}>
                  Confirmer l'encaissement
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* QrScannerOverlay PAR-DESSUS la pageSheet via fullScreen (Pitfall #7). */}
        <QrScannerOverlay
          visible={showQrScanner}
          onScan={handleScanned}
          onClose={handleCloseScanner}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    padding: Spacing['2xl'],
    gap: Spacing.xl,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    fontSize: FontSize.sm,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
    ...Shadows.xs,
  },
  secondaryBtnLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.xl,
  },
  disclaimerIcon: {
    marginTop: 2,
  },
  disclaimerText: {
    flex: 1,
    fontSize: FontSize.caption,
    lineHeight: 18,
  },
  disclaimerBold: {
    fontWeight: FontWeight.semibold,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing['2xl'],
    paddingBottom: Spacing['4xl'],
  },
  confirmBtn: {
    height: 52,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLabel: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.semibold,
  },
});
