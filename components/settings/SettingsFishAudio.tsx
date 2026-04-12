/**
 * SettingsFishAudio.tsx — Configuration cle API Fish Audio (TTS voix premium)
 * Pattern identique a SettingsElevenLabs.tsx
 */

import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useStoryVoice } from '../../contexts/StoryVoiceContext';
import { Button } from '../ui/Button';
import { ModalHeader } from '../ui/ModalHeader';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

export function SettingsFishAudio() {
  const { primary, colors } = useThemeColors();
  const { isFishAudioConfigured, setFishAudioKey, clearFishAudioKey } = useStoryVoice();
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSave = useCallback(async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      Alert.alert('Cle vide', 'Saisissez votre cle API Fish Audio.');
      return;
    }
    setIsSaving(true);
    await setFishAudioKey(trimmed);
    setIsSaving(false);
    setKeyInput('');
    setShowKeyModal(false);
    Alert.alert('Cle enregistree', 'Fish Audio est maintenant configure pour les histoires du soir.');
  }, [keyInput, setFishAudioKey]);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Supprimer la cle',
      'Les histoires du soir n\'utiliseront plus Fish Audio.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => { await clearFishAudioKey(); },
        },
      ],
    );
  }, [clearFishAudioKey]);

  return (
    <>
      <View style={styles.section}>
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSub }]}>Fish Audio</Text>
            <Text style={[styles.rowStatus, { color: isFishAudioConfigured ? colors.success : colors.textMuted }]}>
              {isFishAudioConfigured ? '\u2713 Configure' : 'Non configure'}
            </Text>
          </View>

          <Text style={[styles.description, { color: colors.textMuted }]}>
            Voix TTS haute qualite avec clonage vocal. Francais natif auto-detecte. Necessite un compte Fish Audio.
          </Text>

          {!isFishAudioConfigured ? (
            <Button
              label="Configurer la cle API"
              onPress={() => setShowKeyModal(true)}
              variant="primary"
            />
          ) : (
            <View style={styles.configuredRow}>
              <Text style={[styles.configuredKey, { color: colors.success }]}>
                Cle API enregistree
              </Text>
              <Button
                label="Supprimer"
                onPress={handleClear}
                variant="danger"
                size="sm"
              />
            </View>
          )}
        </View>

        <Text style={[styles.hint, { color: colors.textFaint }]}>
          Votre cle est chiffree localement et ne quitte jamais votre appareil.
        </Text>
      </View>

      {/* Modal saisie cle API */}
      <Modal
        visible={showKeyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowKeyModal(false); setKeyInput(''); }}
        onShow={() => setTimeout(() => inputRef.current?.focus(), 100)}
      >
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.bg }]}>
          <ModalHeader
            title="Cle API Fish Audio"
            onClose={() => { setShowKeyModal(false); setKeyInput(''); }}
            rightLabel="Enregistrer"
            onRight={handleSave}
            rightDisabled={isSaving || !keyInput.trim()}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalBody}
          >
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              Recuperez votre cle sur fish.audio (Dashboard &gt; API Keys).
            </Text>
            <Text style={[styles.modalHint, { color: colors.textFaint }]}>
              La cle est stockee chiffree dans le trousseau iOS (expo-secure-store).
            </Text>
            <TextInput
              ref={inputRef}
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="sk-..."
              placeholderTextColor={colors.textMuted}
              value={keyInput}
              onChangeText={setKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              accessibilityLabel="Cle API Fish Audio"
            />
          </KeyboardAvoidingView>
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
  rowLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  rowStatus: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  description: {
    fontSize: FontSize.caption,
    lineHeight: 18,
  },
  configuredRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  configuredKey: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  hint: {
    fontSize: FontSize.micro,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  // Modal
  modalSafe: { flex: 1 },
  modalBody: {
    padding: Spacing['3xl'],
    gap: Spacing['2xl'],
  },
  modalDesc: {
    fontSize: FontSize.body,
    lineHeight: 22,
  },
  modalHint: {
    fontSize: FontSize.caption,
  },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: Radius.base,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing['2xl'],
    fontSize: FontSize.sm,
    fontFamily: 'Courier',
  },
});
