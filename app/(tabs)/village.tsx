/**
 * village.tsx — Écran Place du Village (Phase 27, v1.4)
 *
 * Affiche la carte tilemap cobblestone du village familial avec :
 * - Carte TileMapRenderer mode='village' (42% de l'écran)
 * - Barre de progression collective vers l'objectif hebdomadaire
 * - Feed des contributions de la semaine (par profil, heure relative)
 * - Indicateurs par membre actif
 * - Panneau historique des semaines précédentes (CollapsibleSection)
 *
 * Câblé sur useGarden() et useVault() — données depuis jardin-familial.md
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useGarden } from '../../hooks/useGarden';
import { TileMapRenderer } from '../../components/mascot/TileMapRenderer';
import { LiquidXPBar } from '../../components/ui/LiquidXPBar';
import { CollapsibleSection } from '../../components/ui/CollapsibleSection';
import { ReactiveAvatar } from '../../components/ui/ReactiveAvatar';
import { getCurrentSeason } from '../../lib/mascot/seasons';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import type { VillageContribution } from '../../lib/village/types';

// ── Constantes module ──────────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MAP_HEIGHT = Math.round(SCREEN_H * 0.75);
const GOLD = '#FFD700';
const SPRING_FEED = { damping: 20, stiffness: 200 } as const;
const FEED_LIMIT = 5;

// ── Fonctions utilitaires (hors composant) ────────────────────────────────

/**
 * Retourne une chaîne représentant le temps relatif.
 * Exemples : "à l'instant", "il y a 2h", "hier", "lun."
 */
function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;
  const diffH = diffMs / 3_600_000;
  const diffD = diffMs / 86_400_000;
  if (diffH < 1) return "à l'instant";
  if (diffH < 24) return `il y a ${Math.floor(diffH)}h`;
  if (diffD < 2) return 'hier';
  return new Date(isoTimestamp).toLocaleDateString('fr-FR', { weekday: 'short' });
}

/**
 * Formate une date ISO YYYY-MM-DD en JJ/MM/AAAA (per CLAUDE.md).
 */
function formatDateFR(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

// ── FeedItem — mémoïsé (per CLAUDE.md — React.memo sur list items) ────────

type ColorsType = ReturnType<typeof useThemeColors>['colors'];

const FeedItem = React.memo(function FeedItem({
  contribution,
  profileName,
  profileEmoji,
  colors,
}: {
  contribution: VillageContribution;
  profileName: string;
  profileEmoji: string;
  colors: ColorsType;
}) {
  const typeLabel =
    contribution.type === 'harvest' ? 'a récolté' : 'a complété une tâche';
  return (
    <View style={[styles.feedItem, { borderBottomColor: colors.borderLight }]}>
      <Text style={styles.feedEmoji}>{profileEmoji}</Text>
      <View style={styles.feedContent}>
        <Text style={[styles.feedName, { color: colors.text }]} numberOfLines={1}>
          {profileName}
        </Text>
        <Text style={[styles.feedType, { color: colors.textMuted }]} numberOfLines={1}>
          {typeLabel}
        </Text>
      </View>
      <Text style={[styles.feedAmount, { color: colors.success }]}>+{contribution.amount}</Text>
      <Text style={[styles.feedTime, { color: colors.textFaint ?? colors.textMuted }]}>
        {formatRelativeTime(contribution.timestamp)}
      </Text>
    </View>
  );
});

// ── VillageScreen — Composant principal ───────────────────────────────────

export default function VillageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeColors();
  const { activeProfile, profiles } = useVault();
  const {
    gardenData,
    progress,
    currentTarget,
    isGoalReached,
    currentTemplate,
    weekHistory,
    claimReward,
    isLoading,
  } = useGarden();

  const [showAllFeed, setShowAllFeed] = useState(false);
  // Pitfall 4 (RESEARCH.md) — guard post-claim session pour éviter double-tap
  const [claimedThisSession, setClaimedThisSession] = useState(false);
  const [mapSize, setMapSize] = useState({ width: SCREEN_W, height: MAP_HEIGHT });
  const season = getCurrentSeason();

  // ── Memos ─────────────────────────────────────────────────────────────

  /** Contributions — plus récentes en premier, limitées par défaut à FEED_LIMIT */
  const feedItems = useMemo(
    () =>
      [...(gardenData?.contributions ?? [])].reverse().slice(
        0,
        showAllFeed ? undefined : FEED_LIMIT,
      ),
    [gardenData?.contributions, showAllFeed],
  );

  const totalContribs = gardenData?.contributions?.length ?? 0;

  /** Total de contributions par profil (pour les indicateurs membres) */
  const memberContribs = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of gardenData?.contributions ?? []) {
      map[c.profileId] = (map[c.profileId] ?? 0) + c.amount;
    }
    return map;
  }, [gardenData?.contributions]);

  /** Profils actifs — hors grossesse (per Phase 26 decision) */
  const activeProfiles = useMemo(
    () => profiles.filter(p => p.statut !== 'grossesse'),
    [profiles],
  );

  // ── Couleurs et états barre de progression ────────────────────────────

  const barColor = isGoalReached ? colors.warning : colors.success;
  const barLabel = isGoalReached ? 'Objectif atteint ! 🎉' : 'Progression collective';
  const canClaim =
    isGoalReached && !gardenData?.rewardClaimed && !claimedThisSession;
  const alreadyClaimed =
    isGoalReached && (gardenData?.rewardClaimed || claimedThisSession);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleClaim = useCallback(async () => {
    if (!activeProfile) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const success = await claimReward(activeProfile.id);
    if (success) setClaimedThisSession(true);
  }, [activeProfile, claimReward]);

  const handleMapLayout = useCallback(
    (e: any) => {
      const { width, height } = e.nativeEvent.layout;
      setMapSize({ width, height });
    },
    [],
  );

  const handleToggleFeed = useCallback(() => {
    setShowAllFeed(prev => !prev);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* ── Header flottant par-dessus la carte (comme HUD ferme dans tree.tsx) ── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)',
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/(tabs)/tree' as any)}
          accessibilityLabel="Retour"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.backArrow, { color: colors.text }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Place du Village</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* ── Scroll unique (pattern tree.tsx) : carte + sections dans le même flux ── */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing['5xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Carte TileMap village ── */}
        <View
          style={[styles.mapContainer, { height: MAP_HEIGHT, marginHorizontal: -Spacing['2xl'] }]}
          onLayout={handleMapLayout}
        >
          <TileMapRenderer
            treeStage="arbre"
            containerWidth={SCREEN_W}
            containerHeight={MAP_HEIGHT}
            season={season}
            mode="village"
          />
        </View>

        {isLoading || !gardenData ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.success} />
          </View>
        ) : (
          <>
            {/* ── Section Objectif ── */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Objectif de la semaine
              </Text>
              <Text style={[styles.templateSubtitle, { color: colors.textMuted }]}>
                {currentTemplate.icon} {currentTemplate.name}
              </Text>
              <View style={styles.barContainer}>
                <LiquidXPBar
                  current={progress}
                  total={currentTarget}
                  label={barLabel}
                  color={barColor}
                  height={24}
                />
              </View>

              {/* Bouton claim — apparaît avec animation quand objectif atteint */}
              {canClaim && (
                <Animated.View entering={FadeInDown.duration(400)}>
                  <TouchableOpacity
                    style={[styles.claimBtn, { backgroundColor: colors.warning }]}
                    onPress={handleClaim}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Réclamer la récompense collective"
                  >
                    <Text style={[styles.claimBtnText, { color: '#FFFFFF' }]}>
                      Réclamer la récompense
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              )}

              {alreadyClaimed && (
                <View style={[styles.claimBtn, styles.claimBtnDisabled]}>
                  <Text style={[styles.claimBtnText, { color: colors.textMuted }]}>
                    Récompense réclamée
                  </Text>
                </View>
              )}
            </View>

            {/* ── Section Contributions ── */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Contributions cette semaine
              </Text>

              {totalContribs === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>🌱</Text>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    Pas encore de contributions
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                    Les récoltes et tâches complétées cette semaine apparaîtront ici.
                  </Text>
                </View>
              ) : (
                <>
                  {feedItems.map((contribution, idx) => {
                    const profile = profiles.find(p => p.id === contribution.profileId);
                    return (
                      <FeedItem
                        key={`${contribution.profileId}-${contribution.timestamp}-${idx}`}
                        contribution={contribution}
                        profileName={profile?.name ?? contribution.profileId}
                        profileEmoji={profile?.avatar ?? '👤'}
                        colors={colors}
                      />
                    );
                  })}

                  {totalContribs > FEED_LIMIT && (
                    <TouchableOpacity
                      style={styles.toggleFeedBtn}
                      onPress={handleToggleFeed}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.toggleFeedText, { color: colors.success }]}>
                        {showAllFeed ? 'Réduire' : `Voir tout (${totalContribs})`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            {/* ── Section Membres actifs ── */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Membres actifs
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.membersRow}
              >
                {activeProfiles.map(profile => (
                  <View key={profile.id} style={styles.memberItem}>
                    <ReactiveAvatar
                      emoji={profile.avatar ?? '👤'}
                      mood="idle"
                      style={styles.memberAvatar}
                    />
                    <Text style={[styles.memberContrib, { color: colors.success }]}>
                      {memberContribs[profile.id] ?? 0}
                    </Text>
                    <Text
                      style={[styles.memberName, { color: colors.textMuted }]}
                      numberOfLines={1}
                    >
                      {profile.name}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* ── Section Historique ── */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Semaines précédentes
              </Text>

              {weekHistory.length === 0 ? (
                <Text style={[styles.historyEmpty, { color: colors.textMuted }]}>
                  L'historique des semaines accomplies s'affichera ici.
                </Text>
              ) : (
                // Plus récente en haut — Pitfall 5 : uniquement cible/total/statut
                [...weekHistory].reverse().map(week => {
                  const reached = week.total >= week.target;
                  const statusLabel = reached ? 'Objectif atteint' : 'Non atteint';
                  return (
                    <CollapsibleSection
                      key={week.weekStart}
                      id={`village_week_${week.weekStart}`}
                      title={`Semaine du ${formatDateFR(week.weekStart)} — ${week.total}/${week.target}`}
                      defaultCollapsed={true}
                    >
                      <View style={styles.historyDetail}>
                        <Text style={[styles.historyStatus, { color: reached ? colors.success : colors.textMuted }]}>
                          Statut : {statusLabel}
                        </Text>
                        <Text style={[styles.historyTotal, { color: colors.textMuted }]}>
                          Total contributions : {week.total} / {week.target}
                        </Text>
                        {week.claimed && (
                          <Text style={[styles.historyClaimed, { color: GOLD }]}>
                            Récompense réclamée
                          </Text>
                        )}
                      </View>
                    </CollapsibleSection>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles statiques ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Header flottant (comme HUD ferme)
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing.xs,
    minHeight: 32,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  headerSpacer: {
    width: 32,
  },

  // Carte tilemap (dans le flux scroll, comme tree.tsx)
  mapContainer: {
    width: SCREEN_W,
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },

  // ScrollView
  scrollContent: {
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing['2xl'],
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['6xl'],
  },

  // Sections
  section: {
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
  },
  sectionTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.md,
  },

  // Objectif
  templateSubtitle: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.xl,
  },
  barContainer: {
    marginBottom: Spacing.xl,
  },

  // Bouton claim
  claimBtn: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  claimBtnDisabled: {
    opacity: 0.5,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  claimBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },

  // Feed
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
    minHeight: 44,
  },
  feedEmoji: {
    fontSize: FontSize.lg,
  },
  feedContent: {
    flex: 1,
    minWidth: 0,
  },
  feedName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  feedType: {
    fontSize: FontSize.caption,
  },
  feedAmount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  feedTime: {
    fontSize: FontSize.caption,
    minWidth: 50,
    textAlign: 'right',
  },

  // Toggle feed
  toggleFeedBtn: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  toggleFeedText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },

  // État vide feed
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['4xl'],
    gap: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Section membres
  membersRow: {
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  memberItem: {
    width: 64,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  memberAvatar: {
    width: 36,
    height: 36,
  },
  memberContrib: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  memberName: {
    fontSize: FontSize.caption,
    textAlign: 'center',
  },

  // Historique
  historyEmpty: {
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Spacing['3xl'],
  },
  historyDetail: {
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  historyStatus: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  historyTotal: {
    fontSize: FontSize.sm,
  },
  historyClaimed: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
