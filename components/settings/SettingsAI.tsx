/**
 * SettingsAI.tsx — Configuration de l'assistant IA (optionnel)
 *
 * La saisie de clé API s'ouvre dans une modal dédiée pour éviter
 * que le clavier masque le champ (la section est en bas de settings).
 */

import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useAI, AVAILABLE_MODELS } from '../../contexts/AIContext';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { ModalHeader } from '../ui/ModalHeader';
import { SectionHeader } from '../ui/SectionHeader';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

export function SettingsAI() {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const { isConfigured, model, storyModel, setApiKey, clearApiKey, setModel, setStoryModel } = useAI();
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSave = useCallback(async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      Alert.alert(t('settings.ai.emptyKeyTitle'), t('settings.ai.emptyKeyMsg'));
      return;
    }
    if (!trimmed.startsWith('sk-ant-')) {
      Alert.alert(t('settings.ai.invalidKeyTitle'), t('settings.ai.invalidKeyMsg'));
      return;
    }
    setIsSaving(true);
    await setApiKey(trimmed);
    setIsSaving(false);
    setKeyInput('');
    setShowKeyModal(false);
    Alert.alert(t('settings.ai.savedTitle'), t('settings.ai.savedMsg'));
  }, [keyInput, setApiKey, t]);

  const handleClear = useCallback(() => {
    Alert.alert(
      t('settings.ai.deleteTitle'),
      t('settings.ai.deleteMessage'),
      [
        { text: t('settings.ai.cancel'), style: 'cancel' },
        {
          text: t('settings.ai.deleteConfirm'),
          style: 'destructive',
          onPress: async () => { await clearApiKey(); },
        },
      ],
    );
  }, [clearApiKey, t]);

  return (
    <>
      <View style={styles.section} accessibilityRole="summary" accessibilityLabel={t('settings.ai.sectionA11y')}>
        <SectionHeader title={t('settings.ai.sectionTitle')} flush />
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSub }]}>{t('settings.ai.apiLabel')}</Text>
            <Text style={[styles.rowStatus, { color: colors.textMuted }]}>
              {isConfigured ? t('settings.ai.active') : t('settings.ai.inactive')}
            </Text>
          </View>

          <Text style={[styles.description, { color: colors.textMuted }]}>
            {t('settings.ai.description')}
          </Text>

          {!isConfigured ? (
            <Button
              label={t('settings.ai.configureKey')}
              onPress={() => setShowKeyModal(true)}
              variant="primary"
            />
          ) : (
            <>
              <View style={styles.modelSection}>
                <Text style={[styles.modelLabel, { color: colors.textSub }]}>{t('settings.ai.modelLabel')}</Text>
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
              <View style={styles.modelSection}>
                <Text style={[styles.modelLabel, { color: colors.textSub }]}>{t('settings.ai.storyModelLabel')}</Text>
                <View style={styles.modelChips}>
                  {AVAILABLE_MODELS.map((m) => (
                    <Chip
                      key={m.id}
                      label={m.label}
                      selected={storyModel === m.id}
                      onPress={() => setStoryModel(m.id)}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.configuredRow}>
                <Text style={[styles.configuredKey, { color: colors.success }]}>
                  {t('settings.ai.keyConfigured')}
                </Text>
                <Button
                  label={t('settings.ai.deleteBtn')}
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
            title={t('settings.ai.keyModalTitle')}
            onClose={() => { setShowKeyModal(false); setKeyInput(''); }}
            rightLabel={t('settings.ai.keyModalSave')}
            onRight={handleSave}
            rightDisabled={isSaving || !keyInput.trim()}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalBody}
          >
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              {t('settings.ai.keyModalDesc')}
            </Text>
            <Text style={[styles.modalHint, { color: colors.textFaint }]}>
              {t('settings.ai.keyModalHint')}
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
              accessibilityLabel={t('settings.ai.keyA11y')}
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
