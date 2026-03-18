import React from 'react';
import { Modal, View, Text, Alert, StyleSheet } from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import { ModalHeader } from './ui/ModalHeader';
import { Chip, Button } from './ui';
import { Spacing } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { formatDateForDisplay } from '../lib/parser';

interface SkillDetailModalProps {
  visible: boolean;
  onClose: () => void;
  skill: {
    id: string;
    label: string;
    categoryEmoji: string;
    categoryLabel: string;
    ageBracketLabel: string;
    xp: number;
  } | null;
  state: 'locked' | 'unlockable' | 'unlocked';
  unlockedAt?: string;
  unlockedBy?: string;
  onUnlock?: () => void;
  prerequisiteLabel?: string;
}

export function SkillDetailModal({
  visible,
  onClose,
  skill,
  state,
  unlockedAt,
  unlockedBy,
  onUnlock,
  prerequisiteLabel,
}: SkillDetailModalProps) {
  const { primary, colors } = useThemeColors();

  if (!skill) return null;

  const handleUnlock = () => {
    Alert.alert(
      'Confirmer la validation',
      `Confirmer la validation de cette compétence ? +${skill.xp} XP seront attribués.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Valider', onPress: onUnlock },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      animationType="slide"
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ModalHeader title={skill.categoryLabel} onClose={onClose} />

        <View style={styles.content}>
          {/* Grande icône emoji */}
          <Text style={styles.emoji}>{skill.categoryEmoji}</Text>

          {/* Nom de la compétence */}
          <Text style={[styles.label, { color: colors.text }]}>
            {skill.label}
          </Text>

          {/* Tranche d'âge */}
          <Chip label={skill.ageBracketLabel} size="sm" />

          {/* Récompense XP */}
          <Text style={[styles.xp, { color: primary }]}>
            +{skill.xp} XP
          </Text>

          {/* État : débloqué */}
          {state === 'unlocked' && (
            <View style={styles.unlockedSection}>
              <Chip
                label="Débloqué ✓"
                selected
                color={colors.success}
              />
              {unlockedAt ? (
                <Text style={[styles.meta, { color: colors.textSub }]}>
                  {formatDateForDisplay(unlockedAt)}
                </Text>
              ) : null}
              {unlockedBy ? (
                <Text style={[styles.meta, { color: colors.textSub }]}>
                  Validé par {unlockedBy}
                </Text>
              ) : null}
            </View>
          )}

          {/* État : déblocable */}
          {state === 'unlockable' && onUnlock && (
            <View style={styles.actionSection}>
              <Button
                label="Valider cette compétence"
                onPress={handleUnlock}
                size="lg"
                fullWidth
              />
            </View>
          )}

          {/* État : verrouillé */}
          {state === 'locked' && prerequisiteLabel ? (
            <Text style={[styles.lockedHint, { color: colors.textMuted }]}>
              Débloquer d'abord : {prerequisiteLabel}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: Spacing['3xl'],
    paddingTop: Spacing['5xl'],
    gap: Spacing['2xl'],
  },
  emoji: {
    fontSize: 64,
    textAlign: 'center',
  },
  label: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  xp: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
  },
  unlockedSection: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  meta: {
    fontSize: FontSize.sm,
  },
  actionSection: {
    width: '100%',
    marginTop: Spacing.md,
  },
  lockedHint: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});
