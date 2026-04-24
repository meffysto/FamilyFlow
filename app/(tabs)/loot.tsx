/**
 * loot.tsx — Gamification screen
 *
 * - Loot box openers per profile
 * - Active rewards display
 * - Full leaderboard with streaks + levels
 * - Badges collection (history of opened loot)
 * - Last 10 history entries
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { PillTabSwitcher, type PillTab } from '../../components/ui/PillTabSwitcher';
import { useVault } from '../../contexts/VaultContext';
import { useGamification } from '../../hooks/useGamification';
import { FamilyLeaderboard } from '../../components/FamilyLeaderboard';
import { LootBoxOpener } from '../../components/LootBoxOpener';
import {
  buildLeaderboard,
  processActiveRewards,
  getLevelTier,
  RARITY_COLORS,
  RARITY_EMOJIS,
  getRarityLabel,
  REWARDS,
  DROP_RATES,
  LOOT_THRESHOLD,
  PITY_THRESHOLD,
  getActiveEvent,
  seasonalDaysRemaining,
  getNextEvent,
  SEASONAL_EVENTS,
} from '../../lib/gamification';
import { Profile, LootBox, LootRarity, UsedLoot } from '../../lib/types';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';
import { SeasonalBanner } from '../../components/SeasonalBanner';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Layout, Spacing, Radius } from '../../constants/spacing';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';

export default function LootScreen() {
  const { profiles, gamiData, activeProfile, markLootUsed, notifPrefs, vault, refresh, isLoading } = useVault();
  const { openLootBox, isProcessing } = useGamification({ vault, notifPrefs });
  const { primary, tint, colors, isDark } = useThemeColors();

  const scrollY = useSharedValue(0);
  const onScrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [lootOpenerVisible, setLootOpenerVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const lootSectionRef = useRef<View>(null);
  const [showDropRates, setShowDropRates] = useState(false);
  type LootTabId = 'rewards' | 'collection' | 'mes-recompenses';
  const [activeTab, setActiveTab] = useState<LootTabId>('rewards');

  useEffect(() => { scrollY.value = 0; }, [activeTab, scrollY]);
  const [rewardsSubTab, setRewardsSubTab] = useState<'to-use' | 'used'>('to-use');
  const activeEvent = getActiveEvent();
  const nextEvent = !activeEvent ? getNextEvent() : null;

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
      showToast(t('loot.toast.openError'), 'error');
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

  // Loots physiques : entrées d'historique de type loot avec une récompense physique
  // Une récompense est physique : pas un badge, pas des points bonus, pas des graines/déco/habitant (appliqués automatiquement)
  const earnedPhysicalLoots = (gamiData?.history ?? [])
    .filter((h) => h.action.startsWith('loot:') && !h.note.includes('Badge') && !h.note.includes('points bonus') && !h.note.startsWith('+'));

  const usedLoots = gamiData?.usedLoots ?? [];
  const usedLootIds = new Set(usedLoots.map((u) => u.id));

  // Loots à utiliser (non cochés), identifiés par profileId_timestamp
  const toUseLoots = earnedPhysicalLoots.filter(
    (h) => !usedLootIds.has(`${h.profileId}_${h.timestamp}`)
  );

  // Loots utilisés, triés par usedAt décroissant
  const usedLootsSorted = [...usedLoots].sort(
    (a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime()
  );

  const lootTabs: ReadonlyArray<PillTab<LootTabId>> = [
    { id: 'rewards', label: t('loot.tabs.rewards') },
    { id: 'collection', label: t('loot.tabs.collection') },
    { id: 'mes-recompenses', label: 'Cadeaux', badge: toUseLoots.length },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <ScreenHeader
        title={t('loot.title')}
        subtitle={t('loot.subtitle')}
        actions={
          <TouchableOpacity
            style={[styles.dropRatesBtn, { backgroundColor: colors.card }]}
            onPress={() => setShowDropRates(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={t('loot.a11y.showDropRates')}
            accessibilityRole="button"
          >
            <Text style={styles.dropRatesBtnText}>📊</Text>
          </TouchableOpacity>
        }
        bottom={
          <View style={styles.tabsWrap}>
            <PillTabSwitcher
              tabs={lootTabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              primary={primary}
              colors={colors}
              marginHorizontal={0}
            />
          </View>
        }
        scrollY={scrollY}
      />
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, Layout.contentContainer]}
        onScroll={onScrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
        }
      >
        {/* Bandeau événement saisonnier */}
        {activeEvent && (
          <SeasonalBanner
            event={activeEvent}
            daysLeft={seasonalDaysRemaining()}
            onShowRewards={() => setShowDropRates(true)}
          />
        )}

        {/* Prochain événement (quand aucun n'est actif) */}
        {!activeEvent && nextEvent && (
          <View style={[styles.nextEventCard, { backgroundColor: colors.cardAlt }]}>
            <Text style={[styles.nextEventText, { color: colors.textSub }]}>
              {nextEvent.event.emoji} {t('loot.nextEvent')} <Text style={{ fontWeight: FontWeight.bold, color: nextEvent.event.themeColor }}>{nextEvent.event.name}</Text> — {t('loot.nextEventDays', { count: nextEvent.daysUntil })}
            </Text>
          </View>
        )}

        {activeTab === 'rewards' && <>
        {/* Loot box cards per profile */}
        <View ref={lootSectionRef} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('loot.sections.rewardsToOpen')}</Text>
          {profiles.map((profile) => (
            <View key={profile.id} style={[styles.lootCard, { backgroundColor: colors.card }]}>
              <View style={styles.lootCardLeft}>
                <Text style={styles.lootCardAvatar}>{profile.avatar}</Text>
                <View>
                  <Text style={[styles.lootCardName, { color: colors.text }]}>{profile.name}</Text>
                  <Text style={[styles.lootCardLevel, { color: getLevelTier(profile.level).color }]}>
                    {getLevelTier(profile.level).emoji} {getLevelTier(profile.level).name} ({t('loot.level', { level: profile.level })})
                  </Text>
                </View>
              </View>

              {profile.lootBoxesAvailable > 0 ? (
                activeProfile?.role === 'adulte' && profile.role === 'adulte' && profile.id !== activeProfile?.id ? (
                  <View style={[styles.noLootBadge, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.noLootText, { color: colors.textFaint }]}>
                      {profile.lootBoxesAvailable} 🎁
                    </Text>
                  </View>
                ) : (
                <TouchableOpacity
                  style={[styles.openBtn, { backgroundColor: primary }]}
                  onPress={() => handleOpenLoot(profile)}
                  disabled={isProcessing}
                  accessibilityLabel={t(profile.lootBoxesAvailable > 1 ? 'loot.openA11yPlural' : 'loot.openA11y', { count: profile.lootBoxesAvailable, name: profile.name })}
                  accessibilityRole="button"
                >
                  <Text style={styles.openBtnEmoji}>🎁</Text>
                  <Text style={[styles.openBtnText, { color: colors.onPrimary }]}>
                    {profile.lootBoxesAvailable > 1 ? t('loot.openBtnMultiple', { count: profile.lootBoxesAvailable }) : t('loot.openBtn')}
                  </Text>
                </TouchableOpacity>
                )
              ) : (
                <View style={[styles.noLootBadge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.noLootText, { color: colors.textFaint }]}>
                    {(() => { const t = LOOT_THRESHOLD[profile.role] ?? 100; return `${profile.points % t}/${t} pts`; })()}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Active rewards */}
        {activeRewards.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('loot.sections.activeRewards')}</Text>
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
                        {reward.remainingDays !== undefined && t('loot.activeRewardDaysRemaining', { count: reward.remainingDays })}
                        {reward.remainingTasks !== undefined && t('loot.activeRewardTasksRemaining', { count: reward.remainingTasks })}
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('loot.sections.leaderboard')}</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <FamilyLeaderboard profiles={leaderboard} />
          </View>
        </View>

        {/* Recent history */}
        {recentHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('loot.sections.recentHistory')}</Text>
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
                        <View style={[styles.historyTypeBadge, { backgroundColor: isLoot ? colors.infoBg : entry.note.startsWith('Compétence:') ? colors.warningBg : entry.note.startsWith('Défi:') ? colors.infoBg : colors.successBg }]}>
                          <Text style={[styles.historyTypeText, { color: isLoot ? colors.info : entry.note.startsWith('Compétence:') ? colors.warning : entry.note.startsWith('Défi:') ? colors.info : colors.success }]}>
                            {isLoot ? t('loot.history.loot') : entry.note.startsWith('Compétence:') ? t('loot.history.skill') : entry.note.startsWith('Défi:') ? t('loot.history.challenge') : entry.note.startsWith('Bonus') ? t('loot.history.bonus') : t('loot.history.task')}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.historyNote, { color: colors.textFaint }]}>{entry.note}</Text>
                    </View>
                    <View style={styles.historyPoints}>
                      {isLoot && rarity ? (
                        <Text style={[styles.historyRarity, { color: RARITY_COLORS[rarity as keyof typeof RARITY_COLORS] ?? colors.textFaint }]}>
                          {getRarityLabel(rarity as LootRarity)}
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
        </>}

        {activeTab === 'collection' && <>
        {/* Collection de badges — catalogue complet avec découverts/manquants */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('loot.sections.badgeCollection')}</Text>
          {profiles.map((profile) => {
            // Badges obtenus par ce profil (extraire les emojis uniques)
            const earnedEmojis = new Set(
              (gamiData?.history ?? [])
                .filter((h) => h.profileId === profile.id && h.action.startsWith('loot:') && h.note.includes('Badge'))
                .map((h) => h.note.split(' ')[0])
            );

            // Catalogue complet des badges par rareté
            const allBadges = (Object.entries(REWARDS) as [LootRarity, typeof REWARDS[LootRarity]][]).flatMap(
              ([rarity, rewards]) =>
                rewards
                  .filter((r) => r.rewardType === 'badge')
                  .map((r) => ({ ...r, rarity }))
            );

            const earnedCount = allBadges.filter((b) => earnedEmojis.has(b.emoji)).length;

            return (
              <View key={profile.id} style={[styles.card, { backgroundColor: colors.card, marginBottom: 10 }]}>
                <View style={styles.badgeProfileHeader}>
                  <Text style={styles.badgeProfileAvatar}>{profile.avatar}</Text>
                  <Text style={[styles.badgeProfileName, { color: colors.text }]}>{profile.name}</Text>
                  <Text style={[styles.badgeProfileCount, { color: earnedCount === allBadges.length ? colors.success : colors.textFaint }]}>
                    {earnedCount}/{allBadges.length}
                  </Text>
                </View>
                {/* Barre de progression collection */}
                <View style={[styles.collectionBar, { backgroundColor: colors.border }]}>
                  <View style={[styles.collectionBarFill, { width: `${Math.round((earnedCount / allBadges.length) * 100)}%`, backgroundColor: earnedCount === allBadges.length ? colors.success : primary }]} />
                </View>
                <View style={styles.badgeGrid}>
                  {allBadges.map((badge, idx) => {
                    const earned = earnedEmojis.has(badge.emoji);
                    const borderColor = earned ? RARITY_COLORS[badge.rarity] : colors.border;
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.badge,
                          { borderColor, backgroundColor: earned ? colors.cardAlt : colors.bg },
                          !earned && { opacity: 0.4 },
                        ]}
                      >
                        <Text style={styles.badgeEmoji}>{earned ? badge.emoji : '❓'}</Text>
                        {earned && (
                          <View style={[styles.badgeRarityDot, { backgroundColor: RARITY_COLORS[badge.rarity] }]} />
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
        </>}

        {activeTab === 'mes-recompenses' && (
          <View style={styles.section}>
            {/* Sous-onglets : À utiliser / Historique */}
            <View style={styles.subTabRow}>
              <TouchableOpacity
                style={[styles.subTab, { backgroundColor: rewardsSubTab === 'to-use' ? primary : colors.bg }]}
                onPress={() => setRewardsSubTab('to-use')}
              >
                <Text style={[styles.subTabText, { color: rewardsSubTab === 'to-use' ? colors.onPrimary : colors.textMuted }]}>
                  {'À utiliser'}{toUseLoots.length > 0 ? ` (${toUseLoots.length})` : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subTab, { backgroundColor: rewardsSubTab === 'used' ? primary : colors.bg }]}
                onPress={() => setRewardsSubTab('used')}
              >
                <Text style={[styles.subTabText, { color: rewardsSubTab === 'used' ? colors.onPrimary : colors.textMuted }]}>
                  {'Historique'}{usedLootsSorted.length > 0 ? ` (${usedLootsSorted.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Onglet À utiliser */}
            {rewardsSubTab === 'to-use' && (
              toUseLoots.length === 0
                ? <Text style={[styles.emptyText, { color: colors.textFaint }]}>{'Aucune récompense physique en attente.'}</Text>
                : toUseLoots.map((loot) => {
                  const lootId = `${loot.profileId}_${loot.timestamp}`;
                  const profileObj = profiles.find((p) => p.id === loot.profileId);
                  const canMark = activeProfile?.role === 'adulte';
                  // Extraire emoji et label du note (format: "🍪 Un cookie/goûter au choix")
                  const noteEmoji = loot.note.split(' ')[0] ?? '🎁';
                  const noteLabel = loot.note.slice(noteEmoji.length).trim() || loot.note;
                  return (
                    <View key={lootId} style={[styles.rewardCard, { backgroundColor: colors.card }]}>
                      <Text style={styles.rewardCardAvatar}>{profileObj?.avatar ?? '👤'}</Text>
                      <View style={styles.rewardCardInfo}>
                        <Text style={[styles.rewardCardProfile, { color: colors.textSub }]}>{profileObj?.name ?? loot.profileId}</Text>
                        <Text style={[styles.rewardCardLabel, { color: colors.text }]}>{noteEmoji} {noteLabel}</Text>
                      </View>
                      {canMark ? (
                        <TouchableOpacity
                          style={[styles.markBtn, { backgroundColor: colors.success }]}
                          onPress={async () => {
                            await markLootUsed({
                              id: lootId,
                              profileId: loot.profileId,
                              emoji: noteEmoji,
                              label: noteLabel,
                              earnedAt: loot.timestamp,
                              usedAt: new Date().toISOString(),
                            } as UsedLoot);
                            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          }}
                        >
                          <Text style={[styles.markBtnText, { color: colors.onPrimary }]}>{'✓ Utilisé'}</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.markBtn, { backgroundColor: colors.success, opacity: 0.4 }]}>
                          <Text style={[styles.markBtnText, { color: colors.onPrimary }]}>{'Parent requis'}</Text>
                        </View>
                      )}
                    </View>
                  );
                })
            )}

            {/* Onglet Historique */}
            {rewardsSubTab === 'used' && (
              usedLootsSorted.length === 0
                ? <Text style={[styles.emptyText, { color: colors.textFaint }]}>{'Aucune récompense utilisée pour le moment.'}</Text>
                : usedLootsSorted.map((usedLoot) => {
                  const profileObj = profiles.find((p) => p.id === usedLoot.profileId);
                  const usedAtFormatted = format(new Date(usedLoot.usedAt), 'dd/MM/yyyy');
                  return (
                    <View key={usedLoot.id} style={[styles.rewardCard, { backgroundColor: colors.card }]}>
                      <Text style={styles.rewardCardAvatar}>{profileObj?.avatar ?? '👤'}</Text>
                      <View style={styles.rewardCardInfo}>
                        <Text style={[styles.rewardCardProfile, { color: colors.textSub }]}>{profileObj?.name ?? usedLoot.profileId}</Text>
                        <Text style={[styles.rewardCardLabel, { color: colors.text }]}>{usedLoot.emoji} {usedLoot.label}</Text>
                      </View>
                      <View style={[styles.usedBadge, { backgroundColor: colors.successBg }]}>
                        <Text style={[styles.usedBadgeText, { color: colors.success }]}>{'✓ Utilisé'}</Text>
                        <Text style={[styles.usedBadgeDate, { color: colors.success }]}>{usedAtFormatted}</Text>
                      </View>
                    </View>
                  );
                })
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </Animated.ScrollView>

      {/* Drop Rates Modal */}
      <Modal visible={showDropRates} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowDropRates(false)}>
        <SafeAreaView style={[styles.drModal, { backgroundColor: colors.bg }]}>
          <ScrollView contentContainerStyle={styles.drContent}>
            {/* Header */}
            <View style={styles.drHeader}>
              <Text style={[styles.drTitle, { color: colors.text }]}>{t('loot.dropRates.title')}</Text>
              <TouchableOpacity onPress={() => setShowDropRates(false)} accessibilityLabel={t('loot.a11y.close')} accessibilityRole="button">
                <Text style={[styles.drCloseBtn, { color: colors.textFaint }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Drop rates table */}
            <View style={[styles.drCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.drSectionTitle, { color: colors.textSub }]}>{t('loot.dropRates.chancePerRarity')}</Text>
              {/* Table header */}
              <View style={styles.drTableRow}>
                <Text style={[styles.drTableCell, styles.drTableHeader, { flex: 2, color: colors.textMuted }]}>{t('loot.dropRates.rarity')}</Text>
                <Text style={[styles.drTableCell, styles.drTableHeader, { color: colors.textMuted }]}>{t('loot.dropRates.child')}</Text>
                <Text style={[styles.drTableCell, styles.drTableHeader, { color: colors.textMuted }]}>{t('loot.dropRates.teen')}</Text>
                <Text style={[styles.drTableCell, styles.drTableHeader, { color: colors.textMuted }]}>{t('loot.dropRates.adult')}</Text>
              </View>
              {/* Table rows */}
              {(Object.keys(RARITY_COLORS) as LootRarity[]).map((rarity) => (
                <View key={rarity} style={styles.drTableRow}>
                  <View style={[styles.drTableCell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                    <View style={[styles.drDot, { backgroundColor: RARITY_COLORS[rarity] }]} />
                    <Text style={[styles.drRarityLabel, { color: RARITY_COLORS[rarity] }]}>
                      {RARITY_EMOJIS[rarity]} {getRarityLabel(rarity)}
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
              <Text style={[styles.drPityTitle, { color: primary }]}>{t('loot.pity.title')}</Text>
              <Text style={[styles.drPityText, { color: colors.textSub }]}>
                {t('loot.pity.description', { threshold: PITY_THRESHOLD }).split('<bold>').map((part, i) => {
                  if (i === 0) return part;
                  const [bold, rest] = part.split('</bold>');
                  return <Text key={i}><Text style={{ fontWeight: FontWeight.heavy }}>{bold}</Text>{rest}</Text>;
                })}
              </Text>
            </View>

            {/* Récompenses saisonnières */}
            {activeEvent && (
              <View style={[styles.drCard, { backgroundColor: activeEvent.themeColor + '15' }]}>
                <View style={styles.drRarityHeader}>
                  <View style={[styles.drRarityBadge, { backgroundColor: activeEvent.themeColor }]}>
                    <Text style={[styles.drRarityBadgeText, { color: colors.onPrimary }]}>
                      {activeEvent.emoji} {activeEvent.name}
                    </Text>
                  </View>
                  <Text style={[styles.drRewardCount, { color: activeEvent.themeColor }]}>{t('loot.dropRates.chancePercent', { percent: 20 })}</Text>
                </View>
                {(Object.entries(activeEvent.rewards) as [LootRarity, typeof REWARDS[LootRarity]][]).map(([rarity, rewards]) =>
                  rewards?.map((reward, idx) => (
                    <View key={`${rarity}-${idx}`} style={[styles.drRewardRow, { borderBottomColor: activeEvent.themeColor + '20' }]}>
                      <Text style={styles.drRewardEmoji}>{reward.emoji}</Text>
                      <Text style={[styles.drRewardName, { color: colors.textSub }]}>{reward.reward}</Text>
                      <Text style={[styles.drRewardPts, { color: RARITY_COLORS[rarity as LootRarity] }]}>
                        {getRarityLabel(rarity as LootRarity)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Rewards by rarity */}
            {(Object.keys(REWARDS) as LootRarity[]).map((rarity) => (
              <View key={rarity} style={[styles.drCard, { backgroundColor: colors.card }]}>
                <View style={styles.drRarityHeader}>
                  <View style={[styles.drRarityBadge, { backgroundColor: RARITY_COLORS[rarity] }]}>
                    <Text style={[styles.drRarityBadgeText, { color: colors.onPrimary }]}>
                      {RARITY_EMOJIS[rarity]} {getRarityLabel(rarity)}
                    </Text>
                  </View>
                  <Text style={[styles.drRewardCount, { color: colors.textFaint }]}>{t('loot.dropRates.rewardCount', { count: REWARDS[rarity].length })}</Text>
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
            <TouchableOpacity style={[styles.drCloseButton, { backgroundColor: primary }]} onPress={() => setShowDropRates(false)} accessibilityLabel={t('loot.a11y.closeDropRates')} accessibilityRole="button">
              <Text style={[styles.drCloseButtonText, { color: colors.onPrimary }]}>{t('loot.dropRates.close')}</Text>
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
  tabsWrap: {
    paddingVertical: Spacing.xs,
  },
  dropRatesBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropRatesBtnText: { fontSize: FontSize.sm },
  nextEventCard: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  nextEventText: {
    fontSize: FontSize.label,
    textAlign: 'center',
  },
  section: { marginBottom: 16, gap: 8 },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.heavy,
    marginBottom: 4,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    ...Shadows.md,
  },
  lootCard: {
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.sm,
    marginBottom: 8,
  },
  lootCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lootCardAvatar: { fontSize: FontSize.hero },
  lootCardName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  lootCardLevel: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  openBtnEmoji: { fontSize: FontSize.heading },
  openBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  noLootBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  noLootText: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold },
  // Active rewards
  activeRewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  activeRewardEmoji: { fontSize: FontSize.hero },
  activeRewardInfo: { flex: 1, gap: 2 },
  activeRewardName: { fontSize: FontSize.label, fontWeight: FontWeight.bold },
  activeRewardLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  activeRewardMeta: { fontSize: FontSize.caption, fontWeight: FontWeight.bold },
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
  badgeEmoji: { fontSize: FontSize.icon },
  badgeRarityDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  collectionBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  collectionBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  badgeProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  badgeProfileAvatar: { fontSize: FontSize.display },
  badgeProfileName: { fontSize: FontSize.body, fontWeight: FontWeight.bold, flex: 1 },
  badgeProfileCount: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold },
  // History
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 10,
  },
  historyAvatar: { fontSize: FontSize.display },
  historyInfo: { flex: 1, gap: 2 },
  historyNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyName: { fontSize: FontSize.label, fontWeight: FontWeight.semibold },
  historyTypeBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  historyTypeText: { fontSize: FontSize.micro, fontWeight: FontWeight.bold },
  historyNote: { fontSize: FontSize.caption },
  historyPoints: { alignItems: 'flex-end' },
  historyPts: { fontSize: FontSize.label, fontWeight: FontWeight.bold },
  historyRarity: { fontSize: FontSize.caption, fontWeight: FontWeight.bold },
  // ─── Cadeaux ────────────────────────────────────────────────────────────
  subTabRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  subTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  subTabText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
  },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    ...Shadows.sm,
  },
  rewardCardAvatar: { fontSize: FontSize.hero },
  rewardCardInfo: { flex: 1, gap: 2 },
  rewardCardProfile: { fontSize: FontSize.label, fontWeight: FontWeight.bold },
  rewardCardLabel: { fontSize: FontSize.sm },
  markBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  markBtnText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
  },
  usedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    gap: 2,
  },
  usedBadgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  usedBadgeDate: {
    fontSize: FontSize.micro,
  },
  emptyText: {
    fontSize: FontSize.body,
    textAlign: 'center',
    paddingVertical: 24,
  },
  // ─── Drop Rates Modal ─────────────────────────────────────────────────────
  drModal: { flex: 1 },
  drContent: { padding: 20, gap: 16 },
  drHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drTitle: { fontSize: FontSize.titleLg, fontWeight: FontWeight.heavy },
  drCloseBtn: { fontSize: FontSize.titleLg, padding: 4 },
  drCard: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
    ...Shadows.md,
  },
  drSectionTitle: { fontSize: FontSize.body, fontWeight: FontWeight.heavy, marginBottom: 4 },
  drTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  drTableCell: {
    flex: 1,
    fontSize: FontSize.label,
    textAlign: 'center',
  },
  drTableHeader: {
    fontWeight: FontWeight.bold,
    fontSize: FontSize.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  drDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  drRarityLabel: { fontSize: FontSize.label, fontWeight: FontWeight.bold },
  drPityBox: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    gap: 6,
  },
  drPityTitle: { fontSize: FontSize.body, fontWeight: FontWeight.heavy },
  drPityText: { fontSize: FontSize.label, lineHeight: 18 },
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
  drRarityBadgeText: { fontSize: FontSize.caption, fontWeight: FontWeight.heavy, textTransform: 'uppercase' },
  drRewardCount: { fontSize: FontSize.caption, fontWeight: FontWeight.semibold },
  drRewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  drRewardRowBorder: {
    borderBottomWidth: 1,
  },
  drRewardEmoji: { fontSize: FontSize.title },
  drRewardName: { flex: 1, fontSize: FontSize.label },
  drRewardPts: { fontSize: FontSize.caption, fontWeight: FontWeight.bold },
  drParentTag: { fontSize: FontSize.sm },
  drCloseButton: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  drCloseButtonText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
});
