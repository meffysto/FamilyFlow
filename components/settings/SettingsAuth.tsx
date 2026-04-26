/**
 * SettingsAuth.tsx — Section réglages : Protection de l'app
 *
 * Toggle verrouillage, changement PIN, délai, info biométrie.
 * Visible adultes uniquement.
 */

import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useAuth, LOCK_DELAY_OPTIONS, LockDelay } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { ModalHeader } from '../ui/ModalHeader';
import { SectionHeader } from '../ui/SectionHeader';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

type PinModalMode = 'setup' | 'change-verify' | 'change-new' | 'change-confirm' | null;

export function SettingsAuth() {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const {
    isAuthEnabled, hasPin, lockDelay, biometryType, biometryAvailable,
    setPin, removePin, setAuthEnabled, setLockDelay, verifyPin,
  } = useAuth();

  const [pinModal, setPinModal] = useState<PinModalMode>(null);
  const [pinInput, setPinInput] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState('');

  const inputRef = useRef<TextInput>(null);

  const biometryLabel = biometryType === 'face'
    ? 'Face ID'
    : biometryType === 'fingerprint'
      ? 'Touch ID'
      : biometryType === 'iris'
        ? 'Iris'
        : 'Non disponible';

  // ── Activer/désactiver la protection ──

  const handleToggleAuth = useCallback(() => {
    if (isAuthEnabled) {
      // Désactiver → confirmation
      Alert.alert(
        t('settings.auth.disableTitle'),
        t('settings.auth.disableMessage'),
        [
          { text: t('settings.auth.cancel'), style: 'cancel' },
          {
            text: t('settings.auth.disableBtn'),
            style: 'destructive',
            onPress: async () => {
              await removePin();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ],
      );
    } else {
      // Activer → ouvrir modal création PIN
      setPinModal('setup');
      setPinInput('');
      setNewPin('');
      setPinError('');
    }
  }, [isAuthEnabled, removePin]);

  // ── Changer le PIN ──

  const handleChangePin = useCallback(() => {
    setPinModal('change-verify');
    setPinInput('');
    setNewPin('');
    setPinError('');
  }, []);

  // ── Validation PIN dans modal ──

  const handlePinSubmit = useCallback(async () => {
    const trimmed = pinInput.trim();

    if (trimmed.length !== 4 || !/^\d{4}$/.test(trimmed)) {
      setPinError(t('settings.auth.pinError4Digits'));
      return;
    }

    switch (pinModal) {
      case 'setup':
        // Premier PIN → demander confirmation
        setNewPin(trimmed);
        setPinInput('');
        setPinError('');
        setPinModal('change-confirm');
        break;

      case 'change-verify':
        // Vérifier l'ancien PIN
        if (verifyPin(trimmed)) {
          setPinInput('');
          setPinError('');
          setPinModal('change-new');
        } else {
          setPinError(t('settings.auth.pinErrorWrong'));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        break;

      case 'change-new':
        // Nouveau PIN → demander confirmation
        setNewPin(trimmed);
        setPinInput('');
        setPinError('');
        setPinModal('change-confirm');
        break;

      case 'change-confirm':
        // Confirmer le nouveau PIN
        if (trimmed === newPin) {
          await setPin(trimmed);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setPinModal(null);
          setPinInput('');
          setNewPin('');
        } else {
          setPinError(t('settings.auth.pinErrorMismatch'));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setPinInput('');
        }
        break;
    }
  }, [pinModal, pinInput, newPin, verifyPin, setPin]);

  const closePinModal = useCallback(() => {
    setPinModal(null);
    setPinInput('');
    setNewPin('');
    setPinError('');
  }, []);

  // ── Titre modal selon l'étape ──

  const pinModalTitle = {
    'setup': t('settings.auth.pinModalSetup'),
    'change-verify': t('settings.auth.pinModalVerify'),
    'change-new': t('settings.auth.pinModalNew'),
    'change-confirm': t('settings.auth.pinModalConfirm'),
  }[pinModal ?? 'setup'] ?? '';

  const pinModalSubtitle = {
    'setup': t('settings.auth.pinSubtitleSetup'),
    'change-verify': t('settings.auth.pinSubtitleVerify'),
    'change-new': t('settings.auth.pinSubtitleNew'),
    'change-confirm': t('settings.auth.pinSubtitleConfirm'),
  }[pinModal ?? 'setup'] ?? '';

  return (
    <>
      <View style={styles.section} accessibilityRole="summary" accessibilityLabel={t('settings.auth.sectionA11y')}>
        <SectionHeader title={t('settings.auth.sectionTitle')} flush />

        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          {/* Toggle verrouillage */}
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, { color: colors.textSub }]}>{t('settings.auth.lockApp')}</Text>
              <Text style={[styles.rowHint, { color: colors.textMuted }]}>
                {t('settings.auth.lockHint')}
              </Text>
            </View>
            <Button
              label={isAuthEnabled ? t('settings.auth.enabled') : t('settings.auth.disabled')}
              onPress={handleToggleAuth}
              variant={isAuthEnabled ? 'primary' : 'secondary'}
              size="sm"
            />
          </View>

          {/* Biométrie info */}
          <View style={[styles.infoRow, { borderTopColor: colors.borderLight }]}>
            <Text style={[styles.infoLabel, { color: colors.textSub }]}>
              {biometryType === 'face' ? '👤' : biometryType === 'fingerprint' ? '👆' : '🔐'} {t('settings.auth.biometry')}
            </Text>
            <Text style={[styles.infoValue, { color: biometryAvailable ? colors.success : colors.textFaint }]}>
              {biometryAvailable ? t('settings.auth.biometryAvailable', { type: biometryLabel }) : t('settings.auth.biometryUnavailable')}
            </Text>
          </View>

          {/* Changer le PIN (si activé) */}
          {isAuthEnabled && hasPin && (
            <View style={[styles.actionRow, { borderTopColor: colors.borderLight }]}>
              <Button
                label={t('settings.auth.changePin')}
                onPress={handleChangePin}
                variant="secondary"
                size="sm"
              />
            </View>
          )}

          {/* Délai de verrouillage (si activé) */}
          {isAuthEnabled && hasPin && (
            <View style={[styles.delaySection, { borderTopColor: colors.borderLight }]}>
              <Text style={[styles.delayLabel, { color: colors.textSub }]}>
                {t('settings.auth.lockDelay')}
              </Text>
              <Text style={[styles.delayHint, { color: colors.textMuted }]}>
                {t('settings.auth.lockDelayHint')}
              </Text>
              <View style={styles.delayChips}>
                {LOCK_DELAY_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    selected={lockDelay === opt.value}
                    onPress={() => setLockDelay(opt.value)}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </View>

      {/* ── Modal saisie PIN ── */}
      <Modal
        visible={pinModal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePinModal}
        onShow={() => setTimeout(() => inputRef.current?.focus(), 100)}
      >
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.bg }]}>
          <ModalHeader
            title={pinModalTitle}
            onClose={closePinModal}
            rightLabel={t('settings.auth.validate')}
            onRight={handlePinSubmit}
            rightDisabled={pinInput.length !== 4}
          />
          <View style={styles.modalBody}>
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              {pinModalSubtitle}
            </Text>

            <TextInput
              ref={inputRef}
              style={[styles.pinInput, {
                backgroundColor: colors.inputBg,
                borderColor: pinError ? colors.error : colors.inputBorder,
                color: colors.text,
              }]}
              value={pinInput}
              onChangeText={(t) => {
                setPinError('');
                setPinInput(t.replace(/[^0-9]/g, '').slice(0, 4));
              }}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              placeholder="• • • •"
              placeholderTextColor={colors.textFaint}
              textAlign="center"
              accessibilityLabel={t('settings.auth.pinA11y')}
              onSubmitEditing={handlePinSubmit}
            />

            {pinError ? (
              <Text style={[styles.errorText, { color: colors.error }]}>{pinError}</Text>
            ) : null}

            {/* Dots visuels */}
            <View style={styles.dotsPreview}>
              {Array.from({ length: 4 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dotPreview,
                    {
                      backgroundColor: i < pinInput.length ? primary : colors.border,
                      borderColor: i < pinInput.length ? primary : colors.border,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
    gap: Spacing.xl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
    marginRight: Spacing.xl,
  },
  rowLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  rowHint: {
    fontSize: FontSize.caption,
    marginTop: Spacing.xxs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.xl,
  },
  infoLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  infoValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  actionRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.xl,
  },
  delaySection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.xl,
    gap: Spacing.md,
  },
  delayLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  delayHint: {
    fontSize: FontSize.caption,
  },
  delayChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  // Modal
  modalSafe: { flex: 1 },
  modalBody: {
    padding: Spacing['3xl'],
    gap: Spacing['2xl'],
    alignItems: 'center',
  },
  modalDesc: {
    fontSize: FontSize.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  pinInput: {
    borderWidth: 1.5,
    borderRadius: Radius.base,
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing['2xl'],
    fontSize: FontSize.hero,
    fontWeight: FontWeight.bold,
    letterSpacing: 16,
    width: 200,
  },
  errorText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  dotsPreview: {
    flexDirection: 'row',
    gap: Spacing['2xl'],
  },
  dotPreview: {
    width: 12,
    height: 12,
    borderRadius: Radius.full,
    borderWidth: 2,
  },
});
