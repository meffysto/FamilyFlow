/**
 * FamilyQuestPickerSheet.tsx — Sélecteur de templates de quêtes familiales
 *
 * Affiche les 7 templates de quêtes coopératives en grille.
 * L'accès est restreint côté appelant (adulte/ado uniquement).
 * Le composant lui-même n'a pas de logique de rôle — c'est l'appelant qui gate.
 *
 * Thème : parchment + auvent (cohérent avec CraftSheet / TechTreeSheet).
 */

import React, { useCallback } from 'react';
import type { AppColors } from '../../constants/colors';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { getRewardLabel } from './FamilyQuestBanner';
import { QUEST_TEMPLATES } from '../../constants/questTemplates';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Farm } from '../../constants/farm-theme';
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
    case 'plant':
      return 'Plantations';
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

// ─── Auvent (rayures + festons) ───────────────────────────────────────────────

function AwningStripes() {
  const stripes = Array.from({ length: Farm.awningStripeCount });
  return (
    <View style={awningStyles.container}>
      {stripes.map((_, i) => (
        <View
          key={i}
          style={[
            awningStyles.stripe,
            { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream },
          ]}
        />
      ))}
      <View style={awningStyles.scallopRow}>
        {stripes.map((_, i) => (
          <View key={i} style={awningStyles.scallop} />
        ))}
      </View>
    </View>
  );
}

const awningStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 28,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 0,
    elevation: 4,
  },
  stripe: {
    flex: 1,
    height: 28,
  },
  scallopRow: {
    position: 'absolute',
    bottom: -4,
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  scallop: {
    flex: 1,
    height: 8,
    backgroundColor: Farm.woodLight,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface FamilyQuestPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (templateId: string) => void;
  colors: AppColors;
  primary: string;
  t: (key: string, opts?: any) => string;
}

// ─── Composant ────────────────────────────────────────────────────────────────

function FamilyQuestPickerSheetInner({
  visible,
  onClose,
  onSelect,
}: FamilyQuestPickerSheetProps) {
  const handleSelect = useCallback(
    (templateId: string) => {
      Haptics.selectionAsync().catch(() => {});
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
      <View style={styles.container}>
        {/* Auvent */}
        <AwningStripes />

        {/* Contenu parchemin */}
        <View style={styles.parchment}>
          {/* Bouton fermer */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          >
            <Text style={styles.closeBtnText}>{'✕'}</Text>
          </TouchableOpacity>

          {/* Handle */}
          <View style={styles.handle} />

          {/* Header centré */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>Nouvelle quête familiale</Text>
            <Text style={styles.subtitle}>
              Choisissez une quête à réaliser ensemble
            </Text>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.grid}>
              {QUEST_TEMPLATES.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.templateCard}
                  onPress={() => handleSelect(template.id)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Quête : ${template.title}`}
                >
                  <Text style={styles.templateEmoji}>{template.emoji}</Text>
                  <Text style={styles.templateTitle} numberOfLines={2}>
                    {template.title}
                  </Text>
                  <Text style={styles.templateType}>
                    {getTypeLabel(template.type)}
                  </Text>
                  <Text style={styles.templateTarget}>
                    {template.target} {getTypeLabel(template.type).toLowerCase()} en {template.durationDays}j
                  </Text>
                  <View style={styles.rewardBadge}>
                    <Text style={styles.rewardText} numberOfLines={1}>
                      🎁 {getRewardLabel(template.reward)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: Spacing['4xl'] }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export const FamilyQuestPickerSheet = React.memo(FamilyQuestPickerSheetInner);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Farm.parchmentDark,
  },
  parchment: {
    flex: 1,
    backgroundColor: Farm.parchmentDark,
  },

  // Bouton fermer (pattern CraftSheet)
  closeBtn: {
    position: 'absolute',
    top: Spacing.xl,
    right: Spacing['2xl'],
    width: 32,
    height: 32,
    backgroundColor: Farm.woodDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    color: Farm.parchment,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    lineHeight: 16,
  },

  // Handle
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Farm.woodHighlight,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },

  // Header centré
  headerRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.caption,
    color: Farm.brownTextSub,
    textAlign: 'center',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },

  // Grille
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  templateCard: {
    width: '47%',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    backgroundColor: Farm.parchment,
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
    color: Farm.brownText,
  },
  templateType: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: Farm.greenBtn,
  },
  templateTarget: {
    fontSize: FontSize.micro,
    marginTop: Spacing.xxs,
    color: Farm.brownTextSub,
  },
  rewardBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.xs,
    marginTop: Spacing.xs,
    width: '100%',
    backgroundColor: Farm.parchmentDark,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
  },
  rewardText: {
    fontSize: FontSize.micro,
    color: Farm.brownTextSub,
  },
});
