/**
 * CookSuggestModal.tsx — Modale itérative "Que cuisiner ce soir ?"
 *
 * Remplace l'Alert.alert() : permet à l'utilisateur de
 * - lire la suggestion en MarkdownText (lisible, scrollable)
 * - "Affiner" via un champ texte libre (ex: "plus rapide", "sans riz")
 * - "Régénérer" pour obtenir d'autres suggestions (les précédentes
 *   sont réinjectées au prompt pour éviter les répétitions)
 *
 * L'extraction des titres de recettes proposées est best-effort
 * (regex sur les puces "- 🍴 **Titre**") — utilisé uniquement pour
 * l'anti-doublon en régénération.
 */

import React, { useCallback, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../contexts/ThemeContext';
import { ModalHeader } from '../ui/ModalHeader';
import { Button } from '../ui/Button';
import { MarkdownText } from '../ui/MarkdownText';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CookSuggestModalProps {
  visible: boolean;
  /** Texte courant rendu (Markdown) — null si pas encore généré */
  text: string | null;
  /** true pendant l'appel API */
  loading: boolean;
  /** Erreur éventuelle (string) à afficher en remplacement du texte */
  error: string | null;
  /** Texte courant du champ "affiner" — contrôlé par le parent */
  refineValue: string;
  onRefineChange: (v: string) => void;
  /** Demande une nouvelle génération avec le refine courant */
  onRegenerate: () => void;
  /** Ferme la modale */
  onClose: () => void;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export const CookSuggestModal = React.memo(function CookSuggestModal({
  visible,
  text,
  loading,
  error,
  refineValue,
  onRefineChange,
  onRegenerate,
  onClose,
}: CookSuggestModalProps) {
  const { primary, colors } = useThemeColors();
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor: colors.bg }]}
      >
        <ModalHeader
          title={t('meals.cookSuggest.title')}
          onClose={onClose}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading && !text && (
            <View style={styles.center}>
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                {t('meals.cookSuggest.loading')}
              </Text>
            </View>
          )}

          {error && (
            <View style={[styles.errorCard, { backgroundColor: colors.cardAlt, borderColor: colors.error }]}>
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          {text && (
            <View style={[styles.suggestionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MarkdownText style={{ color: colors.text }}>{text}</MarkdownText>
            </View>
          )}

          {!loading && !text && !error && (
            <View style={styles.center}>
              <Text style={[styles.hintText, { color: colors.textFaint }]}>
                {t('meals.cookSuggest.empty')}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer : champ refine + boutons */}
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Text style={[styles.refineLabel, { color: colors.textMuted }]}>
            {t('meals.cookSuggest.refineLabel')}
          </Text>
          <TextInput
            value={refineValue}
            onChangeText={onRefineChange}
            placeholder={t('meals.cookSuggest.refinePlaceholder')}
            placeholderTextColor={colors.textFaint}
            style={[
              styles.refineInput,
              {
                backgroundColor: colors.bg,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            editable={!loading}
            returnKeyType="send"
            onSubmitEditing={onRegenerate}
            accessibilityLabel={t('meals.cookSuggest.refineLabel')}
          />
          <View style={styles.buttonRow}>
            <Button
              label={t('meals.cookSuggest.close')}
              onPress={onClose}
              variant="secondary"
              size="md"
            />
            <View style={{ flex: 1 }}>
              <Button
                label={loading ? t('meals.cookSuggest.generating') : t('meals.cookSuggest.regenerate')}
                onPress={onRegenerate}
                variant="primary"
                size="md"
                fullWidth
                disabled={loading}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing['2xl'],
  },
  center: {
    paddingVertical: Spacing['4xl'],
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FontSize.body,
    fontStyle: 'italic',
  },
  hintText: {
    fontSize: FontSize.body,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  errorCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing['2xl'],
    marginBottom: Spacing['2xl'],
  },
  errorText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  suggestionCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing['2xl'],
  },
  footer: {
    padding: Spacing['2xl'],
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  refineLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  refineInput: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    fontSize: FontSize.body,
    minHeight: 44,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
});

// ─── Helpers exportés ─────────────────────────────────────────────────────────

/**
 * Extrait les titres de recettes (entre **) depuis le markdown rendu par l'IA.
 * Best-effort : utilisé pour l'anti-doublon lors de la régénération.
 */
export function extractRecipeTitlesFromMarkdown(md: string): string[] {
  const titles: string[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(md)) !== null) {
    const t = m[1].trim();
    if (t && !titles.includes(t)) titles.push(t);
  }
  return titles;
}
