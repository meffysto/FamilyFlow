/**
 * SettingsAI.tsx — Configuration de l'assistant IA (optionnel)
 *
 * La saisie de clé API s'ouvre dans une modal dédiée pour éviter
 * que le clavier masque le champ (la section est en bas de settings).
 */

import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useAI, AVAILABLE_MODELS } from '../../contexts/AIContext';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { ModalHeader } from '../ui/ModalHeader';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

export function SettingsAI() {
  const { primary, colors } = useThemeColors();
  const { isConfigured, model, setApiKey, clearApiKey, setModel } = useAI();
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSave = useCallback(async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      Alert.alert('Clé vide', 'Collez votre clé API Anthropic.');
      return;
    }
    if (!trimmed.startsWith('sk-ant-')) {
      Alert.alert('Format invalide', 'La clé API doit commencer par "sk-ant-".');
      return;
    }
    setIsSaving(true);
    await setApiKey(trimmed);
    setIsSaving(false);
    setKeyInput('');
    setShowKeyModal(false);
    Alert.alert('Sauvegardé', 'Clé API enregistrée. L\'assistant IA est activé.');
  }, [keyInput, setApiKey]);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Supprimer la clé ?',
      'L\'assistant IA sera désactivé.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => { await clearApiKey(); },
        },
      ],
    );
  }, [clearApiKey]);

  return (
    <>
      <View style={styles.section} accessibilityRole="summary" accessibilityLabel="Section assistant IA">
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Assistant IA</Text>
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSub }]}>🤖 Claude API</Text>
            <Text style={[styles.rowStatus, { color: colors.textMuted }]}>
              {isConfigured ? '🟢 Actif' : '⚪ Désactivé'}
            </Text>
          </View>

          <Text style={[styles.description, { color: colors.textMuted }]}>
            Active un assistant IA pour des suggestions personnalisées et une recherche conversationnelle.
            Vos données restent sur votre appareil — seul un résumé anonymisé est envoyé.
          </Text>

          {!isConfigured ? (
            <Button
              label="Configurer la clé API"
              onPress={() => setShowKeyModal(true)}
              variant="primary"
            />
          ) : (
            <>
              <View style={styles.modelSection}>
                <Text style={[styles.modelLabel, { color: colors.textSub }]}>Modèle</Text>
                <View style={styles.modelChips}>
                  {AVAILABLE_MODELS.map((m) => (
                    <Chip
                      key={m.id}
                      label={m.label}
                      selected={model === m.id}
                      onPress={() => setModel(m.id)}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.configuredRow}>
                <Text style={[styles.configuredKey, { color: colors.success }]}>
                  sk-ant-•••• configurée
                </Text>
                <Button
                  label="Supprimer"
                  onPress={handleClear}
                  variant="danger"
                  size="sm"
                />
              </View>
            </>
          )}
        </View>
      </View>

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
            title="Clé API Claude"
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
              Collez votre clé API Anthropic. Elle sera stockée de façon sécurisée sur votre appareil.
            </Text>
            <Text style={[styles.modalHint, { color: colors.textFaint }]}>
              Obtenez une clé sur console.anthropic.com
            </Text>
            <TextInput
              ref={inputRef}
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="sk-ant-api03-..."
              placeholderTextColor={colors.textMuted}
              value={keyInput}
              onChangeText={setKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              accessibilityLabel="Clé API Anthropic"
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing['3xl'] },
  sectionTitle: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
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
  modelSection: {
    gap: Spacing.md,
  },
  modelLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  modelChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
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
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
