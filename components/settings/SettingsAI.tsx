/**
 * SettingsAI.tsx — Configuration de l'assistant IA (optionnel)
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useAI, AVAILABLE_MODELS } from '../../contexts/AIContext';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

export function SettingsAI() {
  const { primary, colors } = useThemeColors();
  const { isConfigured, model, setApiKey, clearApiKey, setModel } = useAI();
  const [keyInput, setKeyInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      Alert.alert('Clé vide', 'Entrez votre clé API Anthropic.');
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
          onPress: async () => {
            await clearApiKey();
          },
        },
      ],
    );
  }, [clearApiKey]);

  return (
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
          <>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="sk-ant-..."
              placeholderTextColor={colors.textMuted}
              value={keyInput}
              onChangeText={setKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              accessibilityLabel="Clé API Anthropic"
            />
            <Button
              label={isSaving ? 'Enregistrement...' : 'Enregistrer la clé'}
              onPress={handleSave}
              variant="primary"
              disabled={isSaving || !keyInput.trim()}
            />
          </>
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
  input: {
    borderWidth: 1.5,
    borderRadius: Radius.base,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
    fontSize: FontSize.sm,
    fontFamily: 'Courier',
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
});
