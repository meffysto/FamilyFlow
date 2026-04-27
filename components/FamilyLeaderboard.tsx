/**
 * FamilyLeaderboard.tsx — Mini family scoreboard
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Medal, Flame, Gift, Star } from 'lucide-react-native';
import { Profile } from '../lib/types';
import { useThemeColors } from '../contexts/ThemeContext';
import { levelProgress, getLevelTier, LOOT_THRESHOLD, xpForLevel, calculateLevel } from '../lib/gamification';
import { LiquidXPBar } from './ui/LiquidXPBar';
import { AvatarIcon } from './ui/AvatarIcon';
import { getTheme } from '../constants/themes';
import { FontSize, FontWeight } from '../constants/typography';
import { Spacing, Radius } from '../constants/spacing';

interface FamilyLeaderboardProps {
  profiles: Profile[];
  compact?: boolean;   // minimal version for dashboard
}

const MEDAL_COLORS = ['#E8C858', '#9CA3AF', '#A0784C']; // or, argent, bronze

export function FamilyLeaderboard({ profiles, compact = false }: FamilyLeaderboardProps) {
  const { primary, colors } = useThemeColors();

  if (profiles.length === 0) {
    return (
      <Text style={[styles.empty, { color: colors.textFaint }]}>Aucun profil configuré</Text>
    );
  }

  return (
    <View style={styles.container}>
      {profiles.map((profile, index) => {
        const threshold = LOOT_THRESHOLD[profile.role];
        const medalColor = MEDAL_COLORS[index];

        return (
          <View key={profile.id} style={[styles.row, { backgroundColor: colors.cardAlt }, compact && styles.rowCompact]}>
            <View style={styles.medalSlot}>
              {medalColor ? (
                <Medal size={20} color={medalColor} strokeWidth={2.2} />
              ) : (
                <Text style={[styles.medalRank, { color: colors.textFaint }]}>{index + 1}</Text>
              )}
            </View>

            <AvatarIcon name={profile.avatar} color={getTheme(profile.theme).primary} size={36} />

            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: colors.text }]}>{profile.name}</Text>
                <Text style={[styles.level, { color: getLevelTier(profile.level).color, backgroundColor: getLevelTier(profile.level).color + '20' }]}>
                  {getLevelTier(profile.level).emoji} {profile.level}
                </Text>
                {profile.streak > 1 && (
                  <View style={styles.inlineBadge}>
                    <Flame size={12} color={colors.warning} strokeWidth={2.4} />
                    <Text style={[styles.inlineBadgeText, { color: colors.warning }]}>{profile.streak}j</Text>
                  </View>
                )}
                {profile.lootBoxesAvailable > 0 && (
                  <View style={styles.inlineBadge}>
                    <Gift size={12} color={colors.success} strokeWidth={2.4} />
                    <Text style={[styles.inlineBadgeText, { color: colors.success }]}>×{profile.lootBoxesAvailable}</Text>
                  </View>
                )}
              </View>

              {!compact && (
                <View style={styles.bars}>
                  {/* XP bar — liquide */}
                  <LiquidXPBar
                    current={profile.points - xpForLevel(calculateLevel(profile.points) - 1)}
                    total={xpForLevel(calculateLevel(profile.points)) - xpForLevel(calculateLevel(profile.points) - 1)}
                    label="XP"
                    icon={Star}
                    color={primary}
                    height={18}
                  />

                  {/* Loot box progress — liquide */}
                  <LiquidXPBar
                    current={profile.points % threshold}
                    total={threshold}
                    label="Prochain loot"
                    icon={Gift}
                    color={colors.warning}
                    height={14}
                  />
                </View>
              )}

              {compact && (
                <Text style={[styles.compactPoints, { color: colors.textMuted }]}>{profile.points} pts</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  rowCompact: {
    padding: Spacing.md,
  },
  medalSlot: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalRank: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  info: {
    flex: 1,
    gap: Spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  level: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
    borderRadius: Radius.xs,
  },
  inlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  inlineBadgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  bars: {
    gap: Spacing.xs,
  },
  compactPoints: {
    fontSize: FontSize.caption,
  },
  empty: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    padding: Spacing['2xl'],
  },
});
