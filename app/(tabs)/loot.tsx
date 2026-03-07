/**
 * loot.tsx — Gamification screen
 *
 * - Loot box openers per profile
 * - Active rewards display
 * - Full leaderboard with streaks + levels
 * - Badges collection (history of opened loot)
 * - Last 10 history entries
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVault } from '../../hooks/useVault';
import { useGamification } from '../../hooks/useGamification';
import { FamilyLeaderboard } from '../../components/FamilyLeaderboard';
import { LootBoxOpener } from '../../components/LootBoxOpener';
import { buildLeaderboard, processActiveRewards } from '../../lib/gamification';
import {
  RARITY_COLORS,
  RARITY_LABELS,
  RARITY_EMOJIS,
  REWARDS,
  DROP_RATES,
  PITY_THRESHOLD,
} from '../../constants/rewards';
import { Profile, LootBox, LootRarity } from '../../lib/types';
import { useThemeColors } from '../../contexts/ThemeContext';

export default function LootScreen() {
  const { profiles, gamiData, notifPrefs, vault, refresh, isLoading } = useVault();
  const { openLootBox, isProcessing } = useGamification({ vault, notifPrefs });
  const { primary, tint } = useThemeColors();

  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [lootOpenerVisible, setLootOpenerVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showDropRates, setShowDropRates] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleOpenLoot = useCallback(
    async (profile: Profile) => {
      setSelectedProfile(profile);
      setLootOpenerVisible(true);
    },
    []
  );

  const handleDoOpen = useCallback(async (): Promise<LootBox | null> => {
    if (!selectedProfile || !gamiData) return null;
    try {
      const { box } = await openLootBox(selectedProfile, gamiData);
      await refresh();
      return box;
    } catch (e) {
      Alert.alert('Erreur', String(e));
      return null;
    }
  }, [selectedProfile, gamiData, openLootBox, refresh]);

  const leaderboard = buildLeaderboard(profiles);

  // Active rewards
  const activeRewards = processActiveRewards(gamiData?.activeRewards ?? []);

  // Collect earned badges from history
  const badges = (gamiData?.history ?? [])
    .filter((h) => h.action.startsWith('loot:'))
    .slice(-30)
    .reverse();

  // Recent history (last 10 task completions)
  const recentHistory = (gamiData?.history ?? [])
    .slice(-10)
    .reverse();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
        }
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: primary }]}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>🎁 Loot & Récompenses</Text>
            <TouchableOpacity
              style={styles.dropRatesBtn}
              onPress={() => setShowDropRates(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.dropRatesBtnText}>📊</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>Complète des tâches pour gagner des loot boxes !</Text>
        </View>

        {/* Loot box cards per profile */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tes loot boxes</Text>
          {profiles.map((profile) => (
            <View key={profile.id} style={styles.lootCard}>
              <View style={styles.lootCardLeft}>
                <Text style={styles.lootCardAvatar}>{profile.avatar}</Text>
                <View>
                  <Text style={styles.lootCardName}>{profile.name}</Text>
                  <Text style={[styles.lootCardLevel, { color: primary }]}>Niveau {profile.level}</Text>
                </View>
              </View>

              {profile.lootBoxesAvailable > 0 ? (
                <TouchableOpacity
                  style={[styles.openBtn, { backgroundColor: primary }]}
                  onPress={() => handleOpenLoot(profile)}
                  disabled={isProcessing}
                >
                  <Text style={styles.openBtnEmoji}>🎁</Text>
                  <Text style={styles.openBtnText}>
                    Ouvrir{profile.lootBoxesAvailable > 1 ? ` (×${profile.lootBoxesAvailable})` : ''}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.noLootBadge}>
                  <Text style={styles.noLootText}>
                    {profile.points % (profile.role === 'enfant' ? 50 : 100)}/
                    {profile.role === 'enfant' ? 50 : 100} pts
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Active rewards */}
        {activeRewards.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏆 Récompenses actives</Text>
            <View style={styles.card}>
              {activeRewards.map((reward) => {
                const ownerProfile = profiles.find((p) => p.id === reward.profileId);
                return (
                  <View key={reward.id} style={styles.activeRewardRow}>
                    <Text style={styles.activeRewardEmoji}>{reward.emoji}</Text>
                    <View style={styles.activeRewardInfo}>
                      <Text style={styles.activeRewardName}>
                        {ownerProfile?.avatar ?? '👤'} {ownerProfile?.name ?? reward.profileId}
                      </Text>
                      <Text style={styles.activeRewardLabel}>{reward.label}</Text>
                      <Text style={styles.activeRewardMeta}>
                        {reward.remainingDays !== undefined && `${reward.remainingDays}j restant${reward.remainingDays > 1 ? 's' : ''}`}
                        {reward.remainingTasks !== undefined && `${reward.remainingTasks} tâche${reward.remainingTasks > 1 ? 's' : ''} restante${reward.remainingTasks > 1 ? 's' : ''}`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Leaderboard */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Classement</Text>
          <View style={styles.card}>
            <FamilyLeaderboard profiles={leaderboard} />
          </View>
        </View>

        {/* Badges collection */}
        {badges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏅 Badges gagnés</Text>
            <View style={styles.card}>
              <View style={styles.badgeGrid}>
                {badges.map((badge, idx) => {
                  const rarityKey = badge.action.split(':')[1] as keyof typeof RARITY_COLORS;
                  const borderColor = RARITY_COLORS[rarityKey] ?? '#9CA3AF';
                  const isMythique = rarityKey === 'mythique';
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.badge,
                        { borderColor },
                        isMythique && styles.badgeMythique,
                      ]}
                    >
                      <Text style={styles.badgeEmoji}>{badge.note.split(' ')[0]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Recent history */}
        {recentHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📜 Historique récent</Text>
            <View style={styles.card}>
              {recentHistory.map((entry, idx) => {
                const profileObj = profiles.find((p) => p.id === entry.profileId);
                const isLoot = entry.action.startsWith('loot:');
                const rarity = isLoot ? entry.action.split(':')[1] : null;
                return (
                  <View key={idx} style={styles.historyRow}>
                    <Text style={styles.historyAvatar}>{profileObj?.avatar ?? '👤'}</Text>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyName}>{profileObj?.name ?? entry.profileId}</Text>
                      <Text style={styles.historyNote}>{entry.note}</Text>
                    </View>
                    <View style={styles.historyPoints}>
                      {isLoot && rarity ? (
                        <Text style={[styles.historyRarity, { color: RARITY_COLORS[rarity as keyof typeof RARITY_COLORS] ?? '#9CA3AF' }]}>
                          {RARITY_LABELS[rarity as keyof typeof RARITY_LABELS]}
                        </Text>
                      ) : (
                        <Text style={styles.historyPts}>{entry.action}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Drop Rates Modal */}
      <Modal visible={showDropRates} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowDropRates(false)}>
        <SafeAreaView style={styles.drModal}>
          <ScrollView contentContainerStyle={styles.drContent}>
            {/* Header */}
            <View style={styles.drHeader}>
              <Text style={styles.drTitle}>📊 Drop Rates & Récompenses</Text>
              <TouchableOpacity onPress={() => setShowDropRates(false)}>
                <Text style={styles.drCloseBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Drop rates table */}
            <View style={styles.drCard}>
              <Text style={styles.drSectionTitle}>Probabilités par rôle</Text>
              {/* Table header */}
              <View style={styles.drTableRow}>
                <Text style={[styles.drTableCell, styles.drTableHeader, { flex: 2 }]}>Rareté</Text>
                <Text style={[styles.drTableCell, styles.drTableHeader]}>Enfant</Text>
                <Text style={[styles.drTableCell, styles.drTableHeader]}>Ado</Text>
                <Text style={[styles.drTableCell, styles.drTableHeader]}>Adulte</Text>
              </View>
              {/* Table rows */}
              {(Object.keys(RARITY_COLORS) as LootRarity[]).map((rarity) => (
                <View key={rarity} style={styles.drTableRow}>
                  <View style={[styles.drTableCell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                    <View style={[styles.drDot, { backgroundColor: RARITY_COLORS[rarity] }]} />
                    <Text style={[styles.drRarityLabel, { color: RARITY_COLORS[rarity] }]}>
                      {RARITY_EMOJIS[rarity]} {RARITY_LABELS[rarity]}
                    </Text>
                  </View>
                  <Text style={styles.drTableCell}>{Math.round(DROP_RATES.enfant[rarity] * 100)}%</Text>
                  <Text style={styles.drTableCell}>{Math.round(DROP_RATES.ado[rarity] * 100)}%</Text>
                  <Text style={styles.drTableCell}>{Math.round(DROP_RATES.adulte[rarity] * 100)}%</Text>
                </View>
              ))}
            </View>

            {/* Pity system */}
            <View style={[styles.drPityBox, { backgroundColor: tint }]}>
              <Text style={[styles.drPityTitle, { color: primary }]}>🎯 Pity System</Text>
              <Text style={styles.drPityText}>
                Après {PITY_THRESHOLD} loot boxes sans obtenir Épique ou mieux, la prochaine est <Text style={{ fontWeight: '800' }}>garantie Épique minimum</Text>.
              </Text>
            </View>

            {/* Rewards by rarity */}
            {(Object.keys(REWARDS) as LootRarity[]).map((rarity) => (
              <View key={rarity} style={styles.drCard}>
                <View style={styles.drRarityHeader}>
                  <View style={[styles.drRarityBadge, { backgroundColor: RARITY_COLORS[rarity] }]}>
                    <Text style={styles.drRarityBadgeText}>
                      {RARITY_EMOJIS[rarity]} {RARITY_LABELS[rarity]}
                    </Text>
                  </View>
                  <Text style={styles.drRewardCount}>{REWARDS[rarity].length} récompenses</Text>
                </View>
                {REWARDS[rarity].map((reward, idx) => (
                  <View key={idx} style={[styles.drRewardRow, idx < REWARDS[rarity].length - 1 && styles.drRewardRowBorder]}>
                    <Text style={styles.drRewardEmoji}>{reward.emoji}</Text>
                    <Text style={styles.drRewardName}>{reward.reward}</Text>
                    {reward.bonusPoints > 0 && (
                      <Text style={styles.drRewardPts}>+{reward.bonusPoints}</Text>
                    )}
                    {reward.requiresParent && (
                      <Text style={styles.drParentTag}>👨‍👩‍👧</Text>
                    )}
                  </View>
                ))}
              </View>
            ))}

            {/* Close button */}
            <TouchableOpacity style={[styles.drCloseButton, { backgroundColor: primary }]} onPress={() => setShowDropRates(false)}>
              <Text style={styles.drCloseButtonText}>Fermer</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Loot Box Opener Modal */}
      {selectedProfile && (
        <LootBoxOpener
          visible={lootOpenerVisible}
          profileName={selectedProfile.name}
          profileAvatar={selectedProfile.avatar}
          lootCount={selectedProfile.lootBoxesAvailable}
          profileTheme={selectedProfile.theme}
          onOpen={handleDoOpen}
          onClose={() => {
            setLootOpenerVisible(false);
            setSelectedProfile(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  scroll: { flex: 1 },
  content: { padding: 16 },
  header: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    gap: 4,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  dropRatesBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropRatesBtnText: { fontSize: 18 },
  subtitle: { fontSize: 14, color: '#C4B5FD' },
  section: { marginBottom: 16, gap: 8 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  lootCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 8,
  },
  lootCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lootCardAvatar: { fontSize: 32 },
  lootCardName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  lootCardLevel: { fontSize: 12, fontWeight: '600' },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  openBtnEmoji: { fontSize: 18 },
  openBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  noLootBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  noLootText: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  // Active rewards
  activeRewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  activeRewardEmoji: { fontSize: 32 },
  activeRewardInfo: { flex: 1, gap: 2 },
  activeRewardName: { fontSize: 13, fontWeight: '700', color: '#374151' },
  activeRewardLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  activeRewardMeta: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  // Badges
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  badgeMythique: {
    borderWidth: 3,
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  badgeEmoji: { fontSize: 28 },
  // History
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 10,
  },
  historyAvatar: { fontSize: 24 },
  historyInfo: { flex: 1, gap: 1 },
  historyName: { fontSize: 13, fontWeight: '600', color: '#374151' },
  historyNote: { fontSize: 12, color: '#9CA3AF' },
  historyPoints: { alignItems: 'flex-end' },
  historyPts: { fontSize: 13, fontWeight: '700', color: '#059669' },
  historyRarity: { fontSize: 12, fontWeight: '700' },
  // ─── Drop Rates Modal ─────────────────────────────────────────────────────
  drModal: { flex: 1, backgroundColor: '#F3F4F6' },
  drContent: { padding: 20, gap: 16 },
  drHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  drCloseBtn: { fontSize: 22, color: '#9CA3AF', padding: 4 },
  drCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  drSectionTitle: { fontSize: 15, fontWeight: '800', color: '#374151', marginBottom: 4 },
  drTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  drTableCell: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    textAlign: 'center',
  },
  drTableHeader: {
    fontWeight: '700',
    color: '#6B7280',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  drDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  drRarityLabel: { fontSize: 13, fontWeight: '700' },
  drPityBox: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
    gap: 6,
  },
  drPityTitle: { fontSize: 15, fontWeight: '800' },
  drPityText: { fontSize: 13, color: '#374151', lineHeight: 18 },
  drRarityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  drRarityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  drRarityBadgeText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' },
  drRewardCount: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  drRewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  drRewardRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  drRewardEmoji: { fontSize: 20 },
  drRewardName: { flex: 1, fontSize: 13, color: '#374151' },
  drRewardPts: { fontSize: 12, fontWeight: '700', color: '#059669' },
  drParentTag: { fontSize: 14 },
  drCloseButton: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  drCloseButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
