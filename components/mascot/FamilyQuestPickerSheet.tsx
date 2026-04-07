/**
 * FamilyQuestPickerSheet.tsx — Sélecteur de templates de quêtes familiales
 *
 * Affiche les 7 templates de quêtes coopératives en grille.
 * L'accès est restreint côté appelant (adulte/ado uniquement).
 * Le composant lui-même n'a pas de logique de rôle — c'est l'appelant qui gate.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ModalHeader } from '../ui/ModalHeader';
import { getRewardLabel } from './FamilyQuestBanner';
import { QUEST_TEMPLATES } from '../../constants/questTemplates';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import type { FamilyQuestType } from '../../lib/quest-engine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTypeLabel(type: FamilyQuestType): string {
  switch (type) {
    case 'tasks':
      return 'Tâches';
    case 'defis':
      return 'Défis';
    case 'harvest':
      return 'Récoltes';
    case 'golden_harvest':
      return 'Récoltes Dorées';
    case 'craft':
      return 'Créations';
    case 'production':
      return 'Productions';
    case 'checkins':
      return 'Check-ins';
    case 'composite':
      return 'Mixte';
    default:
      return type;
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FamilyQuestPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (templateId: string) => void;
  colors: any;
  primary: string;
  t: (key: string, opts?: any) => string;
}

// ─── Composant ────────────────────────────────────────────────────────────────

function FamilyQuestPickerSheetInner({
  visible,
  onClose,
  onSelect,
  colors,
  primary,
  t,
}: FamilyQuestPickerSheetProps) {
  const handleSelect = useCallback(
    (templateId: string) => {
      Haptics.selectionAsync();
      onSelect(templateId);
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <ModalHeader
          title="Nouvelle Quête Familiale"
          onClose={onClose}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Choisissez une quête à réaliser ensemble
          </Text>

          <View style={styles.grid}>
            {QUEST_TEMPLATES.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={[
                  styles.templateCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.borderLight,
                  },
                ]}
                onPress={() => handleSelect(template.id)}
                activeOpacity={0.75}
              >
                <Text style={styles.templateEmoji}>{template.emoji}</Text>
                <Text
                  style={[styles.templateTitle, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {template.title}
                </Text>
                <Text style={[styles.templateType, { color: primary }]}>
                  {getTypeLabel(template.type)}
                </Text>
                <Text style={[styles.templateTarget, { color: colors.textSub }]}>
                  {template.target} {getTypeLabel(template.type).toLowerCase()} en {template.durationDays}j
                </Text>
                <View style={[styles.rewardBadge, { backgroundColor: colors.cardAlt }]}>
                  <Text style={[styles.rewardText, { color: colors.textSub }]} numberOfLines={1}>
                    🎁 {getRewardLabel(template.reward)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: Spacing['4xl'] }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

export const FamilyQuestPickerSheet = React.memo(FamilyQuestPickerSheetInner);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  subtitle: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  templateCard: {
    width: '47%',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
    gap: Spacing.xxs,
  },
  templateEmoji: {
    fontSize: FontSize.icon,
    marginBottom: Spacing.xxs,
  },
  templateTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.caption * 1.4,
  },
  templateType: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  templateTarget: {
    fontSize: FontSize.micro,
    marginTop: Spacing.xxs,
  },
  rewardBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.xs,
    marginTop: Spacing.xs,
    width: '100%',
  },
  rewardText: {
    fontSize: FontSize.micro,
  },
});
