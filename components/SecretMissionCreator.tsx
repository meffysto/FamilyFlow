/**
 * SecretMissionCreator.tsx — Modal de création de mission secrète
 *
 * Permet au parent de choisir un enfant cible, un texte de mission
 * (libre ou depuis le pool de suggestions), et d'envoyer la mission.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useVault } from '../contexts/VaultContext';
import { useThemeColors } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { ModalHeader } from './ui/ModalHeader';
import { Chip } from './ui/Chip';
import { MISSION_POOL, getMissionText, getMissionCategoryLabel, type MissionSuggestion } from '../constants/secret-missions';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { Shadows } from '../constants/shadows';
import { useTranslation } from 'react-i18next';

interface SecretMissionCreatorProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

/** Emoji par catégorie de mission */
const CATEGORY_EMOJIS: Record<string, string> = {
  tendresse: '💕',
  responsabilité: '🧹',
  créativité: '🎨',
  entraide: '🤝',
};

/** Regroupe les missions par catégorie */
function groupByCategory(missions: MissionSuggestion[]): Record<string, MissionSuggestion[]> {
  const groups: Record<string, MissionSuggestion[]> = {};
  for (const m of missions) {
    if (!groups[m.category]) groups[m.category] = [];
    groups[m.category].push(m);
  }
  return groups;
}

export const SecretMissionCreator = React.memo(function SecretMissionCreator({
  visible,
  onClose,
  onCreated,
}: SecretMissionCreatorProps) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const { profiles, addSecretMission } = useVault();
  const { showToast } = useToast();

  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [missionText, setMissionText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Filtrer les profils enfants
  const childProfiles = useMemo(
    () => profiles.filter((p) => p.role === 'enfant' || p.role === 'ado'),
    [profiles],
  );

  // Missions groupées par catégorie
  const groupedMissions = useMemo(() => groupByCategory(MISSION_POOL), []);

  const canSubmit = selectedChild && missionText.trim().length > 0 && !isSaving;

  const handleSubmit = useCallback(async () => {
    if (!selectedChild || !missionText.trim()) return;
    setIsSaving(true);
    try {
      await addSecretMission(missionText.trim(), selectedChild);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      showToast(t('secretMissionCreator.toast.sent'));
      // Réinitialiser le formulaire
      setMissionText('');
      setSelectedChild(null);
      onCreated?.();
      onClose();
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [selectedChild, missionText, addSecretMission, showToast, onCreated, onClose]);

  const handleClose = useCallback(() => {
    setMissionText('');
    setSelectedChild(null);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.card }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
        <View style={[styles.dragHandle, { backgroundColor: colors.separator }]} />
        <ModalHeader
          title={t('secretMissionCreator.title')}
          onClose={handleClose}
          rightLabel={isSaving ? '...' : t('secretMissionCreator.send')}
          onRight={handleSubmit}
          rightDisabled={!canSubmit}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Sélecteur de profil enfant */}
          <Text style={[styles.sectionLabel, { color: colors.textSub }]}>
            {t('secretMissionCreator.chooseChild')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.profileRow}
          >
            {childProfiles.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                emoji={p.avatar}
                selected={selectedChild === p.id}
                onPress={() => setSelectedChild(p.id)}
              />
            ))}
          </ScrollView>

          {/* Champ texte libre */}
          <Text style={[styles.sectionLabel, { color: colors.textSub }]}>
            {t('secretMissionCreator.missionText')}
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.inputBorder,
                color: colors.text,
              },
            ]}
            value={missionText}
            onChangeText={setMissionText}
            placeholder={t('secretMissionCreator.missionPlaceholder')}
            placeholderTextColor={colors.textFaint}
            multiline
            textAlignVertical="top"
          />

          {/* Suggestions groupées par catégorie */}
          <Text style={[styles.sectionLabel, { color: colors.textSub }]}>
            {t('secretMissionCreator.suggestions')}
          </Text>
          {Object.entries(groupedMissions).map(([category, missions]) => {
            const emoji = CATEGORY_EMOJIS[category] ?? '📋';
            return (
              <View key={category} style={styles.categoryBlock}>
                <Text style={[styles.categoryHeader, { color: colors.textMuted }]}>
                  {emoji} {getMissionCategoryLabel(category as MissionSuggestion['category'])}
                </Text>
                <View style={styles.suggestionsGrid}>
                  {missions.map((m, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.suggestionChip,
                        {
                          backgroundColor: missionText === getMissionText(m)
                            ? colors.warningBg
                            : colors.cardAlt,
                          borderColor: missionText === getMissionText(m)
                            ? colors.warning
                            : colors.border,
                        },
                      ]}
                      onPress={() => setMissionText(getMissionText(m))}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestionEmoji}>{m.emoji}</Text>
                      <Text
                        style={[
                          styles.suggestionText,
                          { color: colors.text },
                        ]}
                        numberOfLines={2}
                      >
                        {getMissionText(m)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}

          {/* Espace en bas pour le scroll */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Bouton d'envoi fixe en bas */}
        <View style={[styles.bottomBar, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: canSubmit ? primary : colors.cardAlt },
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.7}
            accessibilityLabel={t('secretMissionCreator.sendMissionA11y')}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.submitBtnText,
                { color: canSubmit ? colors.onPrimary : colors.textFaint },
              ]}
            >
              {t('secretMissionCreator.sendMission')}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.rewardInfo, { color: colors.textMuted }]}>
            {t('secretMissionCreator.rewardInfo')}
          </Text>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing['3xl'],
    gap: Spacing.lg,
  },
  sectionLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.md,
  },
  profileRow: {
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    fontSize: FontSize.body,
    minHeight: 80,
  },
  categoryBlock: {
    gap: Spacing.md,
  },
  categoryHeader: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.sm,
  },
  suggestionsGrid: {
    gap: Spacing.md,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  suggestionEmoji: {
    fontSize: FontSize.title,
  },
  suggestionText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  bottomSpacer: {
    height: Spacing['6xl'],
  },
  bottomBar: {
    padding: Spacing['2xl'],
    borderTopWidth: 1,
  },
  submitBtn: {
    paddingVertical: Spacing.xl,
    borderRadius: Radius.md,
    alignItems: 'center',
    ...Shadows.sm,
  },
  submitBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  rewardInfo: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
