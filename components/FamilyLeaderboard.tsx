/**
 * FamilyLeaderboard.tsx — Mini family scoreboard
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Profile } from '../lib/types';
import { useThemeColors } from '../contexts/ThemeContext';
import { levelProgress, getLevelTier, LOOT_THRESHOLD, xpForLevel, calculateLevel } from '../lib/gamification';
import { LiquidXPBar } from './ui/LiquidXPBar';
import { AvatarIcon } from './ui/AvatarIcon';
import { getTheme } from '../constants/themes';
import { FontSize, FontWeight } from '../constants/typography';

interface FamilyLeaderboardProps {
  profiles: Profile[];
  compact?: boolean;   // minimal version for dashboard
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function FamilyLeaderboard({ profiles, compact = false }: FamilyLeaderboardProps) {
  const { primary, tint, colors } = useThemeColors();

  if (profiles.length === 0) {
    return (
      <Text style={[styles.empty, { color: colors.textFaint }]}>Aucun profil configuré</Text>
    );
  }

  return (
    <View style={styles.container}>
      {profiles.map((profile, index) => {
        const progress = levelProgress(profile.points);
        const threshold = LOOT_THRESHOLD[profile.role];
        const lootProgress = (profile.points % threshold) / threshold;

        return (
          <View key={profile.id} style={[styles.row, { backgroundColor: colors.cardAlt }, compact && styles.rowCompact]}>
            <Text style={styles.medal}>{MEDALS[index] ?? '  '}</Text>

            <AvatarIcon name={profile.avatar} color={getTheme(profile.theme).primary} size={36} />

            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: colors.text }]}>{profile.name}</Text>
                <Text style={[styles.level, { color: getLevelTier(profile.level).color, backgroundColor: getLevelTier(profile.level).color + '20' }]}>
                  {getLevelTier(profile.level).emoji} {profile.level}
                </Text>
                {profile.streak > 1 && (
                  <Text style={[styles.streak, { color: colors.warning }]}>🔥 {profile.streak}j</Text>
                )}
                {profile.lootBoxesAvailable > 0 && (
                  <Text style={[styles.lootBadge, { color: colors.success }]}>🎁 ×{profile.lootBoxesAvailable}</Text>
                )}
              </View>

              {!compact && (
                <View style={styles.bars}>
                  {/* XP bar — liquide */}
                  <LiquidXPBar
                    current={profile.points - xpForLevel(calculateLevel(profile.points) - 1)}
                    total={xpForLevel(calculateLevel(profile.points)) - xpForLevel(calculateLevel(profile.points) - 1)}
                    label="⭐ XP"
                    color={primary}
                    height={18}
                  />

                  {/* Loot box progress — liquide */}
                  <LiquidXPBar
                    current={profile.points % threshold}
                    total={threshold}
                    label="🎁 Prochain loot"
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
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  rowCompact: {
    padding: 8,
  },
  medal: {
    fontSize: FontSize.title,
    width: 28,
    textAlign: 'center',
  },
  avatar: {
    fontSize: FontSize.icon,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  level: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  streak: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  lootBadge: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  bars: {
    gap: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barLabel: {
    fontSize: 11,
    width: 20,
    textAlign: 'center',
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  // lootFill color moved to inline style (dynamic theme)
  barValue: {
    fontSize: 11,
    width: 60,
    textAlign: 'right',
  },
  compactPoints: {
    fontSize: FontSize.caption,
  },
  empty: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    padding: 16,
  },
});
