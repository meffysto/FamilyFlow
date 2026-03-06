/**
 * FamilyLeaderboard.tsx — Mini family scoreboard
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Profile } from '../lib/types';
import { levelProgress } from '../lib/gamification';
import { LOOT_THRESHOLD } from '../constants/rewards';

interface FamilyLeaderboardProps {
  profiles: Profile[];
  compact?: boolean;   // minimal version for dashboard
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function FamilyLeaderboard({ profiles, compact = false }: FamilyLeaderboardProps) {
  if (profiles.length === 0) {
    return (
      <Text style={styles.empty}>Aucun profil configuré</Text>
    );
  }

  return (
    <View style={styles.container}>
      {profiles.map((profile, index) => {
        const progress = levelProgress(profile.points);
        const threshold = LOOT_THRESHOLD[profile.role];
        const lootProgress = (profile.points % threshold) / threshold;

        return (
          <View key={profile.id} style={[styles.row, compact && styles.rowCompact]}>
            <Text style={styles.medal}>{MEDALS[index] ?? '  '}</Text>

            <Text style={styles.avatar}>{profile.avatar}</Text>

            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{profile.name}</Text>
                <Text style={styles.level}>Niv. {profile.level}</Text>
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
                    <Text style={styles.barLabel}>XP</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, styles.xpFill, { width: `${Math.round(progress * 100)}%` as any }]} />
                    </View>
                    <Text style={styles.barValue}>{profile.points} pts</Text>
                  </View>

                  {/* Loot box progress */}
                  <View style={styles.barRow}>
                    <Text style={styles.barLabel}>🎁</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, styles.lootFill, { width: `${Math.round(lootProgress * 100)}%` as any }]} />
                    </View>
                    <Text style={styles.barValue}>{profile.points % threshold}/{threshold}</Text>
                  </View>
                </View>
              )}

              {compact && (
                <Text style={styles.compactPoints}>{profile.points} pts</Text>
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
    backgroundColor: '#F9FAFB',
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
    color: '#111827',
  },
  level: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '600',
    backgroundColor: '#EDE9FE',
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
    color: '#9CA3AF',
    width: 20,
    textAlign: 'center',
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  xpFill: {
    backgroundColor: '#7C3AED',
  },
  lootFill: {
    backgroundColor: '#F59E0B',
  },
  barValue: {
    fontSize: 11,
    color: '#6B7280',
    width: 60,
    textAlign: 'right',
  },
  compactPoints: {
    fontSize: 12,
    color: '#6B7280',
  },
  empty: {
    color: '#9CA3AF',
    textAlign: 'center',
    fontSize: 14,
    padding: 16,
  },
});
