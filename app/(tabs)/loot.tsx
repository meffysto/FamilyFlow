/**
 * loot.tsx — Gamification screen
 *
 * - Loot box openers per profile
 * - Active rewards display
 * - Full leaderboard with streaks + levels
 * - Badges collection (history of opened loot)
 * - Last 10 history entries
 */

import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVault } from '../../contexts/VaultContext';
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
import { useToast } from '../../contexts/ToastContext';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';

export default function LootScreen() {
  const { profiles, gamiData, notifPrefs, vault, refresh, isLoading } = useVault();
  const { openLootBox, isProcessing } = useGamification({ vault, notifPrefs });
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();

  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [lootOpenerVisible, setLootOpenerVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const lootSectionRef = useRef<View>(null);
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
      showToast('Impossible d\'ouvrir la récompense', 'error');
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
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
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
            <Text style={[styles.title, { color: colors.onPrimary }]}>🎁 Récompenses</Text>
            <TouchableOpacity
              style={styles.dropRatesBtn}
              onPress={() => setShowDropRates(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.dropRatesBtnText}>📊</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.subtitle, { color: tint }]}>Complète des tâches pour gagner des récompenses !</Text>
        </View>

        {/* Loot box cards per profile */}
        <View ref={lootSectionRef} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Tes récompenses à ouvrir</Text>
          {profiles.map((profile) => (
            <View key={profile.id} style={[styles.lootCard, { backgroundColor: colors.card }]}>
              <View style={styles.lootCardLeft}>
                <Text style={styles.lootCardAvatar}>{profile.avatar}</Text>
                <View>
                  <Text style={[styles.lootCardName, { color: colors.text }]}>{profile.name}</Text>
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
                  <Text style={[styles.openBtnText, { color: colors.onPrimary }]}>
                    Ouvrir{profile.lootBoxesAvailable > 1 ? ` (×${profile.lootBoxesAvailable})` : ''}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.noLootBadge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.noLootText, { color: colors.textFaint }]}>
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>🏆 Récompenses actives</Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              {activeRewards.map((reward) => {
                const ownerProfile = profiles.find((p) => p.id === reward.profileId);
                return (
                  <View key={reward.id} style={[styles.activeRewardRow, { borderBottomColor: colors.bg }]}>
                    <Text style={styles.activeRewardEmoji}>{reward.emoji}</Text>
                    <View style={styles.activeRewardInfo}>
                      <Text style={[styles.activeRewardName, { color: colors.textSub }]}>
                        {ownerProfile?.avatar ?? '👤'} {ownerProfile?.name ?? reward.profileId}
                      </Text>
                      <Text style={[styles.activeRewardLabel, { color: colors.text }]}>{reward.label}</Text>
                      <Text style={[styles.activeRewardMeta, { color: colors.error }]}>
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>🏆 Classement</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <FamilyLeaderboard profiles={leaderboard} gamiHistory={gamiData?.history} />
          </View>
        </View>

        {/* Badges collection — grouped by profile */}
        {badges.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>🏅 Badges gagnés</Text>
            {profiles.map((profile) => {
              const profileBadges = badges.filter((b) => b.profileId === profile.id);
              if (profileBadges.length === 0) return null;
              return (
                <View key={profile.id} style={[styles.card, { backgroundColor: colors.card, marginBottom: 10 }]}>
                  <View style={styles.badgeProfileHeader}>
                    <Text style={styles.badgeProfileAvatar}>{profile.avatar}</Text>
                    <Text style={[styles.badgeProfileName, { color: colors.text }]}>{profile.name}</Text>
                    <Text style={[styles.badgeProfileCount, { color: colors.textFaint }]}>{profileBadges.length} badge{profileBadges.length > 1 ? 's' : ''}</Text>
                  </View>
                  <View style={styles.badgeGrid}>
                    {profileBadges.map((badge, idx) => {
                      const rarityKey = badge.action.split(':')[1] as keyof typeof RARITY_COLORS;
                      const borderColor = RARITY_COLORS[rarityKey] ?? colors.textFaint;
                      const isMythique = rarityKey === 'mythique';
                      return (
                        <View
                          key={idx}
                          style={[
                            styles.badge,
                            { borderColor, backgroundColor: colors.cardAlt },
                            isMythique && [styles.badgeMythique, { borderColor: colors.error, backgroundColor: colors.errorBg, shadowColor: colors.error }],
                          ]}
                        >
                          <Text style={styles.badgeEmoji}>{badge.note.split(' ')[0]}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Recent history */}
        {recentHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>📜 Historique récent</Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              {recentHistory.map((entry, idx) => {
                const profileObj = profiles.find((p) => p.id === entry.profileId);
                const isLoot = entry.action.startsWith('loot:');
                const rarity = isLoot ? entry.action.split(':')[1] : null;
                return (
                  <View key={idx} style={[styles.historyRow, { borderBottomColor: colors.bg }]}>
                    <Text style={styles.historyAvatar}>{profileObj?.avatar ?? '👤'}</Text>
                    <View style={styles.historyInfo}>
                      <View style={styles.historyNameRow}>
                        <Text style={[styles.historyName, { color: colors.textSub }]}>{profileObj?.name ?? entry.profileId}</Text>
                        <View style={[styles.historyTypeBadge, { backgroundColor: isLoot ? colors.infoBg : colors.successBg }]}>
                          <Text style={[styles.historyTypeText, { color: isLoot ? colors.info : colors.success }]}>
                            {isLoot ? '🎁 Loot' : '📋 Tâche'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.historyNote, { color: colors.textFaint }]}>{entry.note}</Text>
                    </View>
                    <View style={styles.historyPoints}>
                      {isLoot && rarity ? (
                        <Text style={[styles.historyRarity, { color: RARITY_COLORS[rarity as keyof typeof RARITY_COLORS] ?? colors.textFaint }]}>
                          {RARITY_LABELS[rarity as keyof typeof RARITY_LABELS]}
                        </Text>
                      ) : (
                        <Text style={[styles.historyPts, { color: colors.success }]}>{entry.action} pts</Text>
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
        <SafeAreaView style={[styles.drModal, { backgroundColor: colors.bg }]}>
          <ScrollView contentContainerStyle={styles.drContent}>
            {/* Header */}
            <View style={styles.drHeader}>
              <Text style={[styles.drTitle, { color: colors.text }]}>📊 Probabilités & Récompenses</Text>
              <TouchableOpacity onPress={() => setShowDropRates(false)}>
                <Text style={[styles.drCloseBtn, { color: colors.textFaint }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Drop rates table */}
            <View style={[styles.drCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.drSectionTitle, { color: colors.textSub }]}>Chances d'obtenir chaque rareté</Text>
              {/* Table header */}
              <View style={styles.drTableRow}>
                <Text style={[styles.drTableCell, styles.drTableHeader, { flex: 2, color: colors.textMuted }]}>Rareté</Text>
                <Text style={[styles.drTableCell, styles.drTableHeader, { color: colors.textMuted }]}>Enfant</Text>
                <Text style={[styles.drTableCell, styles.drTableHeader, { color: colors.textMuted }]}>Ado</Text>
                <Text style={[styles.drTableCell, styles.drTableHeader, { color: colors.textMuted }]}>Adulte</Text>
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
                  <Text style={[styles.drTableCell, { color: colors.textSub }]}>{Math.round(DROP_RATES.enfant[rarity] * 100)}%</Text>
                  <Text style={[styles.drTableCell, { color: colors.textSub }]}>{Math.round(DROP_RATES.ado[rarity] * 100)}%</Text>
                  <Text style={[styles.drTableCell, { color: colors.textSub }]}>{Math.round(DROP_RATES.adulte[rarity] * 100)}%</Text>
                </View>
              ))}
            </View>

            {/* Pity system */}
            <View style={[styles.drPityBox, { backgroundColor: tint, borderColor: tint }]}>
              <Text style={[styles.drPityTitle, { color: primary }]}>🎯 Garantie</Text>
              <Text style={[styles.drPityText, { color: colors.textSub }]}>
                Après {PITY_THRESHOLD} récompenses sans obtenir Épique ou mieux, la suivante est <Text style={{ fontWeight: '800' }}>garantie Épique minimum</Text>.
              </Text>
            </View>

            {/* Rewards by rarity */}
            {(Object.keys(REWARDS) as LootRarity[]).map((rarity) => (
              <View key={rarity} style={[styles.drCard, { backgroundColor: colors.card }]}>
                <View style={styles.drRarityHeader}>
                  <View style={[styles.drRarityBadge, { backgroundColor: RARITY_COLORS[rarity] }]}>
                    <Text style={[styles.drRarityBadgeText, { color: colors.onPrimary }]}>
                      {RARITY_EMOJIS[rarity]} {RARITY_LABELS[rarity]}
                    </Text>
                  </View>
                  <Text style={[styles.drRewardCount, { color: colors.textFaint }]}>{REWARDS[rarity].length} récompenses</Text>
                </View>
                {REWARDS[rarity].map((reward, idx) => (
                  <View key={idx} style={[styles.drRewardRow, idx < REWARDS[rarity].length - 1 && styles.drRewardRowBorder, idx < REWARDS[rarity].length - 1 && { borderBottomColor: colors.bg }]}>
                    <Text style={styles.drRewardEmoji}>{reward.emoji}</Text>
                    <Text style={[styles.drRewardName, { color: colors.textSub }]}>{reward.reward}</Text>
                    {reward.bonusPoints > 0 && (
                      <Text style={[styles.drRewardPts, { color: colors.success }]}>+{reward.bonusPoints}</Text>
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
              <Text style={[styles.drCloseButtonText, { color: colors.onPrimary }]}>Fermer</Text>
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

      <ScreenGuide
        screenId="loot"
        targets={[
          { ref: lootSectionRef, ...HELP_CONTENT.loot[0] },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 90 },
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
  subtitle: { fontSize: 14 },
  section: { marginBottom: 16, gap: 8 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  lootCard: {
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
  lootCardName: { fontSize: 16, fontWeight: '700' },
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  noLootText: { fontSize: 12, fontWeight: '600' },
  // Active rewards
  activeRewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  activeRewardEmoji: { fontSize: 32 },
  activeRewardInfo: { flex: 1, gap: 2 },
  activeRewardName: { fontSize: 13, fontWeight: '700' },
  activeRewardLabel: { fontSize: 14, fontWeight: '600' },
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
  badgeProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  badgeProfileAvatar: { fontSize: 24 },
  badgeProfileName: { fontSize: 15, fontWeight: '700', flex: 1 },
  badgeProfileCount: { fontSize: 12, fontWeight: '600' },
  // History
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 10,
  },
  historyAvatar: { fontSize: 24 },
  historyInfo: { flex: 1, gap: 2 },
  historyNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyName: { fontSize: 13, fontWeight: '600' },
  historyTypeBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  historyTypeText: { fontSize: 10, fontWeight: '700' },
  historyNote: { fontSize: 12 },
  historyPoints: { alignItems: 'flex-end' },
  historyPts: { fontSize: 13, fontWeight: '700', color: '#059669' },
  historyRarity: { fontSize: 12, fontWeight: '700' },
  // ─── Drop Rates Modal ─────────────────────────────────────────────────────
  drModal: { flex: 1 },
  drContent: { padding: 20, gap: 16 },
  drHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drTitle: { fontSize: 22, fontWeight: '800' },
  drCloseBtn: { fontSize: 22, padding: 4 },
  drCard: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  drSectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  drTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  drTableCell: {
    flex: 1,
    fontSize: 13,
    textAlign: 'center',
  },
  drTableHeader: {
    fontWeight: '700',
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
    gap: 6,
  },
  drPityTitle: { fontSize: 15, fontWeight: '800' },
  drPityText: { fontSize: 13, lineHeight: 18 },
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
  drRewardCount: { fontSize: 11, fontWeight: '600' },
  drRewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  drRewardRowBorder: {
    borderBottomWidth: 1,
  },
  drRewardEmoji: { fontSize: 20 },
  drRewardName: { flex: 1, fontSize: 13 },
  drRewardPts: { fontSize: 12, fontWeight: '700', color: '#059669' },
  drParentTag: { fontSize: 14 },
  drCloseButton: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  drCloseButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
