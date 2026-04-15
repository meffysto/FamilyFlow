/**
 * FamilyQuestDetailSheet.tsx — Bottom sheet détail quête coopérative
 *
 * Affiche le détail complet d'une quête familiale active :
 * - Grande barre de progression
 * - Contributions individuelles par membre
 * - Aperçu de la récompense
 * - Dates début/fin
 * - Bouton "Compléter" si la cible est atteinte
 * - Bouton "Supprimer" discret avec confirmation
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
  Alert,
  FlatList,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ModalHeader } from '../ui/ModalHeader';
import { getRewardLabel } from './FamilyQuestBanner';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import type { FamilyQuest } from '../../lib/quest-engine';
import type { Profile } from '../../lib/types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface FamilyQuestDetailSheetProps {
  quest: FamilyQuest;
  profiles: Profile[];
  colors: AppColors;
  primary: string;
  t: (key: string, opts?: any) => string;
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
  onDelete: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// ─── Composant ────────────────────────────────────────────────────────────────

function FamilyQuestDetailSheetInner({
  quest,
  profiles,
  colors,
  primary,
  t,
  visible,
  onClose,
  onComplete,
  onDelete,
}: FamilyQuestDetailSheetProps) {
  const progress = Math.min(1, quest.target > 0 ? quest.current / quest.target : 0);
  const isComplete = quest.current >= quest.target;

  const handleComplete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComplete();
  }, [onComplete]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Supprimer la quête',
      'Es-tu sûr de vouloir supprimer cette quête ? La progression sera perdue.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: onDelete,
        },
      ],
    );
  }, [onDelete]);

  // Contributions : associer profileId → profil
  const contribEntries = Object.entries(quest.contributions ?? {});

  interface ContribItem {
    profileId: string;
    count: number;
    profile?: Profile;
  }

  const contribData: ContribItem[] = contribEntries.map(([profileId, count]) => ({
    profileId,
    count,
    profile: profiles.find(p => p.id === profileId),
  }));

  const renderContrib = ({ item }: { item: ContribItem }) => {
    const avatar = item.profile?.avatar ?? item.profileId.slice(0, 1).toUpperCase();
    const name = item.profile?.name ?? item.profileId;
    const indivProgress = Math.min(1, quest.target > 0 ? item.count / quest.target : 0);

    return (
      <View style={styles.contribRow}>
        <Text style={styles.contribAvatar}>{avatar}</Text>
        <View style={styles.contribInfo}>
          <View style={styles.contribHeader}>
            <Text style={[styles.contribName, { color: colors.text }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.contribCount, { color: colors.textMuted }]}>
              +{item.count}
            </Text>
          </View>
          <View style={[styles.contribTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.contribFill,
                {
                  width: `${indivProgress * 100}%`,
                  backgroundColor: primary,
                },
              ]}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.sheet, { backgroundColor: colors.bg }]}>
        <ModalHeader
          title={`${quest.emoji} ${quest.title}`}
          onClose={onClose}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Section progression globale */}
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSub }]}>
              Progression
            </Text>
            <View style={[styles.bigProgressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.bigProgressFill,
                  {
                    width: `${progress * 100}%`,
                    backgroundColor: isComplete ? colors.success : primary,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: isComplete ? colors.success : colors.textMuted }]}>
              {quest.current} / {quest.target}
              {isComplete ? ' — Objectif atteint !' : ''}
            </Text>
          </View>

          {/* Section contributions */}
          {contribData.length > 0 && (
            <View style={[styles.section, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSub }]}>
                Contributions
              </Text>
              <FlatList
                data={contribData}
                renderItem={renderContrib}
                keyExtractor={(item) => item.profileId}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
              />
            </View>
          )}

          {/* Section récompense */}
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSub }]}>
              Récompense
            </Text>
            <View style={[styles.rewardBox, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}>
              <Text style={styles.rewardEmoji}>🎁</Text>
              <Text style={[styles.rewardLabel, { color: colors.text }]}>
                {getRewardLabel(quest.farmReward)}
              </Text>
            </View>
          </View>

          {/* Section dates */}
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSub }]}>
              Période
            </Text>
            <Text style={[styles.dates, { color: colors.textMuted }]}>
              Début : {formatDate(quest.startDate)} — Fin : {formatDate(quest.endDate)}
            </Text>
          </View>

          {/* Description */}
          {quest.description ? (
            <View style={[styles.section, { borderBottomColor: colors.border }]}>
              <Text style={[styles.description, { color: colors.textSub }]}>
                {quest.description}
              </Text>
            </View>
          ) : null}

          {/* Bouton Compléter */}
          {isComplete && (
            <TouchableOpacity
              style={[styles.completeBtn, { backgroundColor: primary }]}
              onPress={handleComplete}
              activeOpacity={0.8}
            >
              <Text style={[styles.completeBtnText, { color: colors.onPrimary ?? colors.card }]}>
                🏆 Compléter la quête
              </Text>
            </TouchableOpacity>
          )}

          {/* Bouton Supprimer discret */}
          {quest.status === 'active' && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Text style={[styles.deleteBtnText, { color: colors.textFaint }]}>
                Supprimer la quête
              </Text>
            </TouchableOpacity>
          )}

          <View style={{ height: Spacing['4xl'] }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

export const FamilyQuestDetailSheet = React.memo(FamilyQuestDetailSheetInner);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.lg,
  },
  section: {
    paddingBottom: Spacing.lg,
    marginBottom: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  bigProgressTrack: {
    height: Spacing.sm,
    borderRadius: Radius.xxs,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  bigProgressFill: {
    height: '100%',
    borderRadius: Radius.xxs,
  },
  progressLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  contribRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  contribAvatar: {
    fontSize: FontSize.title,
    width: 32,
    textAlign: 'center',
  },
  contribInfo: {
    flex: 1,
  },
  contribHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxs,
  },
  contribName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    flex: 1,
    marginRight: Spacing.sm,
  },
  contribCount: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  contribTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  contribFill: {
    height: '100%',
    borderRadius: 2,
  },
  rewardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rewardEmoji: {
    fontSize: FontSize.title,
  },
  rewardLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  dates: {
    fontSize: FontSize.caption,
  },
  description: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.5,
    fontStyle: 'italic',
  },
  completeBtn: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  completeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  deleteBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: FontSize.caption,
    textDecorationLine: 'underline',
  },
});
