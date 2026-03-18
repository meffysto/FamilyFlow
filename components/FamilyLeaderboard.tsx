/**
 * FamilyLeaderboard.tsx — Mini family scoreboard
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Profile, GamificationEntry } from '../lib/types';
import { useThemeColors } from '../contexts/ThemeContext';
import { levelProgress, LOOT_THRESHOLD, RARITY_COLORS } from '../lib/gamification';

interface FamilyLeaderboardProps {
  profiles: Profile[];
  compact?: boolean;   // minimal version for dashboard
  gamiHistory?: GamificationEntry[];  // loot history for badge display
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function FamilyLeaderboard({ profiles, compact = false, gamiHistory = [] }: FamilyLeaderboardProps) {
  const { primary, tint, colors } = useThemeColors();

  // Build per-profile badge map (most recent 6)
  const badgesByProfile = React.useMemo(() => {
    const map: Record<string, GamificationEntry[]> = {};
    for (const entry of gamiHistory) {
      if (!entry.action.startsWith('loot:')) continue;
      if (!map[entry.profileId]) map[entry.profileId] = [];
      map[entry.profileId].push(entry);
    }
    // Keep only the last 6 per profile (most recent)
    for (const key of Object.keys(map)) {
      map[key] = map[key].slice(-6).reverse();
    }
    return map;
  }, [gamiHistory]);
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

            <Text style={styles.avatar}>{profile.avatar}</Text>

            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: colors.text }]}>{profile.name}</Text>
                <Text style={[styles.level, { color: primary, backgroundColor: tint }]}>Niv. {profile.level}</Text>
                {profile.streak > 1 && (
                  <Text style={styles.streak}>🔥 {profile.streak}j</Text>
                )}
                {profile.lootBoxesAvailable > 0 && (
                  <Text style={styles.lootBadge}>🎁 ×{profile.lootBoxesAvailable}</Text>
                )}
              </View>

              {!compact && (
                <View style={styles.bars}>
                  {/* XP bar */}
                  <View style={styles.barRow}>
                    <Text style={[styles.barLabel, { color: colors.textFaint }]}>XP</Text>
                    <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                      <View style={[styles.barFill, { backgroundColor: primary, width: `${Math.round(progress * 100)}%` as any }]} />
                    </View>
                    <Text style={[styles.barValue, { color: colors.textMuted }]}>{profile.points} pts</Text>
                  </View>

                  {/* Loot box progress */}
                  <View style={styles.barRow}>
                    <Text style={[styles.barLabel, { color: colors.textFaint }]}>🎁</Text>
                    <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                      <View style={[styles.barFill, styles.lootFill, { width: `${Math.round(lootProgress * 100)}%` as any }]} />
                    </View>
                    <Text style={[styles.barValue, { color: colors.textMuted }]}>{profile.points % threshold}/{threshold}</Text>
                  </View>
                </View>
              )}

              {compact && (
                <Text style={[styles.compactPoints, { color: colors.textMuted }]}>{profile.points} pts</Text>
              )}

              {/* Badge strip (last earned badges) */}
              {(badgesByProfile[profile.id]?.length ?? 0) > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgeStrip} contentContainerStyle={styles.badgeStripContent}>
                  {badgesByProfile[profile.id]!.map((badge, bIdx) => {
                    const rarityKey = badge.action.split(':')[1] as keyof typeof RARITY_COLORS;
                    const borderColor = RARITY_COLORS[rarityKey] ?? colors.textFaint;
                    const isMythique = rarityKey === 'mythique';
                    return (
                      <View
                        key={bIdx}
                        style={[
                          styles.miniBadge,
                          { borderColor, backgroundColor: colors.bg },
                          isMythique && { borderWidth: 2, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 4 },
                        ]}
                      >
                        <Text style={styles.miniBadgeEmoji}>{badge.note.split(' ')[0]}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
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
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  avatar: {
    fontSize: 28,
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
    fontSize: 15,
    fontWeight: '700',
  },
  level: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  streak: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  lootBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
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
  // xpFill color moved to inline style (dynamic theme)
  lootFill: {
    backgroundColor: '#F59E0B',
  },
  barValue: {
    fontSize: 11,
    width: 60,
    textAlign: 'right',
  },
  compactPoints: {
    fontSize: 12,
  },
  empty: {
    textAlign: 'center',
    fontSize: 14,
    padding: 16,
  },
  badgeStrip: {
    marginTop: 4,
  },
  badgeStripContent: {
    gap: 5,
  },
  miniBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBadgeEmoji: {
    fontSize: 18,
  },
});
