/**
 * FamilyQuestBanner.tsx — Widget bannière quête coopérative active
 *
 * Affiche la quête familiale active sur l'écran ferme :
 * - Titre + emoji + jours restants
 * - Barre de progression animée
 * - Contributions par avatar (max 4 affichés)
 * - Label de récompense
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { differenceInDays, parseISO } from 'date-fns';
import { Spacing, Radius } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import { FontSize, FontWeight } from '../../constants/typography';
import type { FamilyQuest, FamilyFarmReward } from '../../lib/quest-engine';
import type { Profile } from '../../lib/types';

// ─── Reward label ─────────────────────────────────────────────────────────────

export function getRewardLabel(reward: FamilyFarmReward): string {
  switch (reward.type) {
    case 'loot_legendary':
      return `Coffre Légendaire x${reward.count}`;
    case 'rare_seeds':
      return `Graines Rares x${reward.count}`;
    case 'rain_bonus':
      return `Pluie Magique ${reward.durationHours}h`;
    case 'golden_rain':
      return `Pluie Dorée ${reward.durationHours}h`;
    case 'production_boost':
      return `Boost Production ${reward.durationHours}h`;
    case 'building':
      return `Bâtiment : ${reward.buildingId}`;
    case 'tech_unlock':
      return `Technologie : ${reward.nodeId}`;
    case 'family_trophy':
      return 'Trophée Familial';
    case 'unlock_plot':
      return 'Nouvelle Parcelle';
    case 'crafting_recipe':
      return 'Recette Secrète';
    case 'seasonal_decoration':
      return 'Décoration Saisonnière';
    default:
      return 'Récompense';
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FamilyQuestBannerProps {
  quest: FamilyQuest;
  profiles: Profile[];
  colors: any;
  t: (key: string, opts?: any) => string;
  onPress: () => void;
}

// ─── Composant ────────────────────────────────────────────────────────────────

function FamilyQuestBannerInner({ quest, profiles, colors, t, onPress }: FamilyQuestBannerProps) {
  const progress = Math.min(1, quest.target > 0 ? quest.current / quest.target : 0);
  const daysLeft = Math.max(0, differenceInDays(parseISO(quest.endDate), new Date()));
  const rewardLabel = getRewardLabel(quest.farmReward);

  // Contributions : associer profileId → profil
  const contributions = Object.entries(quest.contributions ?? {});
  const displayedContribs = contributions.slice(0, 4);
  const extraContribs = contributions.length - 4;

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(400)}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[styles.container, { backgroundColor: colors.card, borderColor: colors.borderLight }, Shadows.sm]}
      >
        {/* En-tête : emoji + titre + jours restants */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {quest.emoji} {quest.title}
          </Text>
          <Text style={[styles.daysLeft, { color: colors.textMuted }]}>
            {daysLeft}j
          </Text>
        </View>

        {/* Barre de progression */}
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>

        {/* Texte progression */}
        <Text style={[styles.progressText, { color: colors.textMuted }]}>
          {quest.current} / {quest.target}
        </Text>

        {/* Contributions par avatar */}
        {displayedContribs.length > 0 && (
          <View style={styles.contributions}>
            {displayedContribs.map(([profileId, count]) => {
              const profile = profiles.find(p => p.id === profileId);
              const avatar = profile?.avatar ?? profileId.slice(0, 1).toUpperCase();
              return (
                <View key={profileId} style={styles.contrib}>
                  <Text style={styles.contribAvatar}>{avatar}</Text>
                  <Text style={[styles.contribCount, { color: colors.textSub }]}>+{count}</Text>
                </View>
              );
            })}
            {extraContribs > 0 && (
              <Text style={[styles.extraContribs, { color: colors.textMuted }]}>
                +{extraContribs} autres
              </Text>
            )}
          </View>
        )}

        {/* Récompense */}
        <Text style={[styles.reward, { color: colors.textSub }]} numberOfLines={1}>
          🎁 {rewardLabel}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export const FamilyQuestBanner = React.memo(FamilyQuestBannerInner);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing['2xl'],
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flex: 1,
    marginRight: Spacing.sm,
  },
  daysLeft: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  progressTrack: {
    height: Spacing.xs,
    borderRadius: Radius.xxs,
    overflow: 'hidden',
    marginBottom: Spacing.xxs,
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.xxs,
  },
  progressText: {
    fontSize: FontSize.micro,
    marginBottom: Spacing.xs,
  },
  contributions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
    alignItems: 'center',
  },
  contrib: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  contribAvatar: {
    fontSize: FontSize.body,
  },
  contribCount: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
  },
  extraContribs: {
    fontSize: FontSize.micro,
  },
  reward: {
    fontSize: FontSize.micro,
    fontStyle: 'italic',
  },
});
