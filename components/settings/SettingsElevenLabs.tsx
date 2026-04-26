/**
 * SettingsElevenLabs.tsx — Configuration clé API ElevenLabs (TTS voix premium)
 * Pattern identique à SettingsAI.tsx
 */

import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useStoryVoice } from '../../contexts/StoryVoiceContext';
import { Button } from '../ui/Button';
import { ModalHeader } from '../ui/ModalHeader';
import { SectionHeader } from '../ui/SectionHeader';
import { Mic } from 'lucide-react-native';
import { SettingsElevenLabsQuota } from './SettingsElevenLabsQuota';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

export function SettingsElevenLabs() {
  const { primary, colors } = useThemeColors();
  const { isElevenLabsConfigured, setElevenLabsKey, clearElevenLabsKey } = useStoryVoice();
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSave = useCallback(async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      Alert.alert('Clé vide', 'Saisissez votre clé API ElevenLabs.');
      return;
    }
    setIsSaving(true);
    await setElevenLabsKey(trimmed);
    setIsSaving(false);
    setKeyInput('');
    setShowKeyModal(false);
    Alert.alert('Clé enregistrée', 'ElevenLabs est maintenant configuré pour les histoires du soir.');
  }, [keyInput, setElevenLabsKey]);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Supprimer la clé',
      'Les histoires du soir utiliseront la voix système à la place.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => { await clearElevenLabsKey(); },
        },
      ],
    );
  }, [clearElevenLabsKey]);

  return (
    <>
      <View style={styles.section}>
        <SectionHeader
          title="Voix premium"
          icon={<Mic size={16} strokeWidth={1.75} color={colors.brand.soilMuted} />}
          flush
        />
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSub }]}>ElevenLabs</Text>
            <Text style={[styles.rowStatus, { color: isElevenLabsConfigured ? colors.success : colors.textMuted }]}>
              {isElevenLabsConfigured ? '✓ Configuré' : 'Non configuré'}
            </Text>
          </View>

          <Text style={[styles.description, { color: colors.textMuted }]}>
            Voix neurales haute qualité pour les histoires du soir. Nécessite un compte ElevenLabs (plan gratuit : 10 000 caractères/mois).
          </Text>

          {!isElevenLabsConfigured ? (
            <Button
              label="Configurer la clé API"
              onPress={() => setShowKeyModal(true)}
              variant="primary"
            />
          ) : (
            <View style={styles.configuredRow}>
              <Text style={[styles.configuredKey, { color: colors.success }]}>
                Clé API enregistrée
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
          Votre clé est chiffrée localement et ne quitte jamais votre appareil.
        </Text>
      </View>

      {/* Cap quotidien — visible uniquement si clé configurée */}
      {isElevenLabsConfigured && <SettingsElevenLabsQuota />}

      {/* Modal saisie clé API */}
      <Modal
        visible={showKeyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowKeyModal(false); setKeyInput(''); }}
        onShow={() => setTimeout(() => inputRef.current?.focus(), 100)}
      >
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.bg }]}>
          <ModalHeader
            title="Clé API ElevenLabs"
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
              Récupérez votre clé sur elevenlabs.io → Profil → API Key.
            </Text>
            <Text style={[styles.modalHint, { color: colors.textFaint }]}>
              La clé est stockée chiffrée dans le trousseau iOS (expo-secure-store).
            </Text>
            <TextInput
              ref={inputRef}
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="sk_..."
              placeholderTextColor={colors.textMuted}
              value={keyInput}
              onChangeText={setKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              accessibilityLabel="Clé API ElevenLabs"
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
