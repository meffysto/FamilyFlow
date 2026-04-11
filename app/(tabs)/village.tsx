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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useGarden } from '../../hooks/useGarden';
import { TileMapRenderer } from '../../components/mascot/TileMapRenderer';
import { LiquidXPBar } from '../../components/ui/LiquidXPBar';
import { CollapsibleSection } from '../../components/ui/CollapsibleSection';
import { ReactiveAvatar } from '../../components/ui/ReactiveAvatar';
import { getCurrentSeason } from '../../lib/mascot/seasons';
import { pickSeasonalActivity } from '../../lib/village/activities';
import { addPoints } from '../../lib/gamification/engine';
import { parseGamification, serializeGamification } from '../../lib/parser';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../../constants/typography';
import type { VaultManager } from '../../lib/vault';
import type { Profile } from '../../lib/types';
import type { VillageContribution } from '../../lib/village/types';
// Phase 29 — overlay avatars + tooltip (VILL-01/02/03) + portail retour (VILL-11/12)
import { VillageAvatar } from '../../components/village/VillageAvatar';
import { AvatarTooltip } from '../../components/village/AvatarTooltip';
import { PortalSprite } from '../../components/village/PortalSprite';
// Phase 30 — bâtiments persistants (VILL-04, VILL-06)
import { BuildingSprite } from '../../components/village/BuildingSprite';
import { BuildingTooltip } from '../../components/village/BuildingTooltip';
import { BuildingsCatalog } from '../../components/village/BuildingsCatalog';
import { BUILDINGS_CATALOG } from '../../lib/village';
import type { UnlockedBuilding } from '../../lib/village';
import { VILLAGE_GRID } from '../../lib/village/grid';

// ── Constantes module ──────────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── Helpers hors composant ────────────────────────────────────────────────

/**
 * Applique un bonus XP + 1 loot box à un profil via son fichier gami-{id}.md.
 * Pattern identique à addCoins dans useFarm.ts — lecture/écriture directe vault.
 * Per D-07 : réutilise le système loot existant (lootBoxesAvailable) pour l'item cosmetique.
 */
async function addVillageBonus(
  vaultMgr: VaultManager,
  profile: Profile,
  xpAmount: number,
  note: string,
): Promise<void> {
  const gamiPath = `gami-${profile.id}.md`;
  const raw = await vaultMgr.readFile(gamiPath).catch(() => '');
  if (!raw) return;
  const gami = parseGamification(raw);
  const gamiProfile = gami.profiles.find(
    (p: Profile) => p.id === profile.id || p.name === profile.name,
  );
  if (!gamiProfile) return;

  const { profile: updated } = addPoints(gamiProfile, xpAmount, note);
  // Appliquer les points mis à jour et ajouter 1 loot box (item cosmetique OBJ-03)
  gamiProfile.points = updated.points;
  gamiProfile.coins = updated.coins;
  gamiProfile.level = updated.level;
  gamiProfile.lootBoxesAvailable = (gamiProfile.lootBoxesAvailable ?? 0) + 1;

  const newEntry = {
    profileId: profile.id,
    action: `+${xpAmount}`,
    points: xpAmount,
    note,
    timestamp: new Date().toISOString(),
  };
  const singleData = {
    profiles: [gamiProfile],
    history: [
      ...gami.history.filter((e: any) => e.profileId === profile.id),
      newEntry,
    ],
    activeRewards: (gami.activeRewards ?? []).filter((r: any) => r.profileId === profile.id),
    usedLoots: (gami.usedLoots ?? []).filter((u: any) => u.profileId === profile.id),
  };

  await vaultMgr.writeFile(gamiPath, serializeGamification(singleData));
}
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

// ── RewardCard — carte de récompense collective (OBJ-03, OBJ-04) ─────────

type ColorsType = ReturnType<typeof useThemeColors>['colors'];

function RewardCard({
  canClaim,
  alreadyClaimed,
  activity,
  onClaim,
  colors,
}: {
  canClaim: boolean;
  alreadyClaimed: boolean;
  activity: string;
  onClaim: () => void;
  colors: ColorsType;
}) {
  const [dismissed, setDismissed] = useState(false);
  const opacity = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const handleDismiss = useCallback(() => {
    opacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(setDismissed)(true);
    });
  }, [opacity]);

  if (dismissed) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(150).duration(350)}
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: Radius.xl,
          padding: Spacing.xl,
          marginTop: Spacing['2xl'],
        },
        cardStyle,
      ]}
    >
      <Text style={{
        fontSize: FontSize.heading,
        fontWeight: FontWeight.semibold,
        lineHeight: LineHeight.title,
        color: colors.text,
        marginBottom: Spacing.md,
      }}>
        Objectif atteint !
      </Text>

      <Text style={{
        fontSize: FontSize.body,
        fontWeight: FontWeight.normal,
        lineHeight: LineHeight.body,
        color: colors.textMuted,
        marginBottom: Spacing.md,
      }}>
        Activité famille cette semaine
      </Text>
      <Text style={{
        fontSize: FontSize.title,
        fontWeight: FontWeight.semibold,
        lineHeight: LineHeight.title,
        color: colors.text,
        marginBottom: Spacing['2xl'],
      }}>
        {activity}
      </Text>

      {canClaim && (
        <TouchableOpacity
          onPress={onClaim}
          style={{
            backgroundColor: colors.success,
            borderRadius: Radius.lg,
            paddingVertical: Spacing.xl,
            alignItems: 'center',
            marginBottom: Spacing.md,
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Récupérer la récompense"
        >
          <Text style={{
            color: colors.bg,
            fontSize: FontSize.body,
            fontWeight: FontWeight.semibold,
          }}>
            Récupérer la récompense (+25 XP + 1 loot box)
          </Text>
        </TouchableOpacity>
      )}

      {alreadyClaimed && (
        <Text style={{
          color: colors.textMuted,
          fontSize: FontSize.sm,
          textAlign: 'center',
          marginBottom: Spacing.md,
        }}>
          Récompense réclamée
        </Text>
      )}

      <TouchableOpacity onPress={handleDismiss} style={{ alignItems: 'center' }}>
        <Text style={{
          color: colors.textSub,
          fontSize: FontSize.sm,
        }}>
          Fermer la carte
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── FeedItem — mémoïsé (per CLAUDE.md — React.memo sur list items) ────────

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
  const { showToast } = useToast();
  const { activeProfile, profiles, vault, refreshGamification } = useVault();
  const {
    gardenData,
    progress,
    currentTarget,
    isGoalReached,
    currentTemplate,
    weekHistory,
    claimReward,
    isLoading,
    // Phase 30 — bâtiments persistants
    familyLifetimeLeaves,
    unlockedBuildings,
  } = useGarden();

  const [showAllFeed, setShowAllFeed] = useState(false);
  // Pitfall 4 (RESEARCH.md) — guard post-claim session pour éviter double-tap
  const [claimedThisSession, setClaimedThisSession] = useState(false);
  const [mapSize, setMapSize] = useState({ width: SCREEN_W, height: MAP_HEIGHT });
  // Phase 30 — catalogue bâtiments + tooltip bâtiment (VILL-04, VILL-06)
  const [showCatalog, setShowCatalog] = useState(false);
  const [buildingTooltip, setBuildingTooltip] = useState<{
    label: string;
    x: number;
    y: number;
  } | null>(null);
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

  // ── Phase 29 — Overlay avatars (VILL-01/02/03) ────────────────────────

  /** Contributions de la SEMAINE COURANTE par profil — per D-09, Pitfall 5 week-start ISO */
  const weeklyContribs = useMemo(() => {
    const weekStart = gardenData?.currentWeekStart;
    if (!weekStart) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    for (const c of gardenData?.contributions ?? []) {
      // Comparaison string ISO — un timestamp 'YYYY-MM-DDTHH:mm:ss' de la semaine
      // courante est toujours >= weekStart ('YYYY-MM-DD') lexicographiquement.
      if (c.timestamp >= weekStart) {
        map[c.profileId] = (map[c.profileId] ?? 0) + c.amount;
      }
    }
    return map;
  }, [gardenData?.contributions, gardenData?.currentWeekStart]);

  /** Profils actifs triés par id pour assignation déterministe slot (per D-07) */
  const sortedActiveProfiles = useMemo(
    () => [...activeProfiles].sort((a, b) => a.id.localeCompare(b.id)),
    [activeProfiles],
  );

  /** Slots avatar issus de la grille village (Phase 29) */
  const avatarSlots = useMemo(
    () => VILLAGE_GRID.filter(c => c.role === 'avatar'),
    [],
  );

  /** Slot du portail retour depuis la grille (per D-18 — VILL-11) */
  const portalSlot = useMemo(
    () => VILLAGE_GRID.find(c => c.id === 'village_portal_home'),
    [],
  );

  // ── Phase 29 — Fade cross-dissolve retour village → ferme (VILL-12) ───

  /** sharedValue d'opacité pour la transition de sortie (per D-21) */
  const screenOpacity = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));

  /** Handler portail retour — withTiming 400ms + runOnJS(router.replace) (per D-21, D-23) */
  const handleReturnPortalPress = useCallback(() => {
    screenOpacity.value = withTiming(
      0,
      { duration: 400, easing: Easing.out(Easing.ease) },
      (finished) => {
        if (finished) runOnJS(router.replace)('/(tabs)/tree' as any);
      },
    );
  }, [screenOpacity, router]);

  // Reset opacity quand l'écran regagne le focus — per D-22, Pitfall P3.
  // Évite que l'écran reste invisible après un ping-pong ferme ↔ village.
  useFocusEffect(
    useCallback(() => {
      screenOpacity.value = 1;
    }, [screenOpacity]),
  );

  /** State tooltip + timer ref — per D-13, Pitfall 4 cleanup */
  const [tooltip, setTooltip] = useState<{
    profileName: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAvatarPress = useCallback(
    (profile: Profile, slotX: number, slotY: number) => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
      const count = weeklyContribs[profile.id] ?? 0;
      setTooltip({ profileName: profile.name, count, x: slotX, y: slotY });
      dismissTimerRef.current = setTimeout(() => {
        setTooltip(null);
        dismissTimerRef.current = null;
      }, 2500);
    },
    [weeklyContribs],
  );

  // Cleanup timer au unmount (Pitfall 4)
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  // ── Phase 30 — handler tap bâtiment ──────────────────────────────────
  const handleBuildingPress = useCallback(
    (ub: UnlockedBuilding) => {
      const entry = BUILDINGS_CATALOG.find(b => b.id === ub.buildingId);
      const slot = VILLAGE_GRID.find(
        s => s.id === `village_building_${ub.buildingId}`,
      );
      if (!entry || !slot) return;
      setBuildingTooltip({
        label: `${entry.labelFR} — Débloqué à ${entry.palier} feuilles familiales`,
        x: slot.x * mapSize.width,
        y: slot.y * mapSize.height,
      });
    },
    [mapSize.width, mapSize.height],
  );

  /** Activité IRL saisonnière — déterministe par semaine */
  const activity = useMemo(
    () =>
      gardenData?.currentWeekStart
        ? pickSeasonalActivity(season, gardenData.currentWeekStart)
        : '',
    [season, gardenData?.currentWeekStart],
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
    if (!activeProfile || !vault) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const success = await claimReward(activeProfile.id);
    if (success) {
      setClaimedThisSession(true);
      // Bonus XP + loot box pour TOUS les profils actifs (D-07 — équitable, pas proportionnel)
      // OBJ-03 : +25 XP + 1 loot box (item cosmetique via systeme loot existant per D-07)
      for (const p of activeProfiles) {
        try {
          await addVillageBonus(vault, p, 25, 'Objectif village atteint');
        } catch { /* Gamification — non-critical */ }
      }
      refreshGamification();
      showToast('+25 XP et 1 loot box pour toute la famille !', 'success');
    }
  }, [activeProfile, vault, claimReward, activeProfiles, refreshGamification, showToast]);

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
    <Animated.View style={[styles.root, { backgroundColor: colors.bg }, fadeStyle]}>
      {/* ── Header flottant sans bouton retour — le portail est le seul point de sortie (per D-19) ── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)',
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>Place du Village</Text>
        {/* Phase 30 — bouton catalogue bâtiments (VILL-06) */}
        <TouchableOpacity
          onPress={() => setShowCatalog(true)}
          style={styles.headerCatalogButton}
          accessibilityRole="button"
          accessibilityLabel="Bâtiments du village"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="home-city" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* ── Scroll unique (pattern tree.tsx) : carte + sections dans le même flux ── */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing['5xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Carte TileMap village + overlay avatars ── */}
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

          {/* Overlay avatars — siblings du renderer (pointerEvents none) — per VILL-01/02, Pitfall 1 */}
          {sortedActiveProfiles.slice(0, 6).map((profile, idx) => {
            const slot = avatarSlots[idx];
            if (!slot || !profile.companion) return null;
            const slotX = slot.x * mapSize.width;
            const slotY = slot.y * mapSize.height;
            return (
              <VillageAvatar
                key={profile.id}
                profile={profile}
                slotX={slotX}
                slotY={slotY}
                isActive={(weeklyContribs[profile.id] ?? 0) > 0}
                onPress={() => handleAvatarPress(profile, slotX, slotY)}
              />
            );
          })}

          {/* Tooltip conditionnel — per VILL-03 */}
          {tooltip && (
            <AvatarTooltip
              profileName={tooltip.profileName}
              count={tooltip.count}
              x={tooltip.x}
              y={tooltip.y}
              containerWidth={mapSize.width}
              onDismiss={() => setTooltip(null)}
            />
          )}

          {/* Phase 30 — overlay bâtiments (VILL-04) */}
          {unlockedBuildings.map(ub => {
            const slot = VILLAGE_GRID.find(
              s => s.id === `village_building_${ub.buildingId}`,
            );
            if (!slot) return null;
            return (
              <BuildingSprite
                key={ub.buildingId}
                buildingId={ub.buildingId}
                slotX={slot.x * mapSize.width}
                slotY={slot.y * mapSize.height}
                onPress={() => handleBuildingPress(ub)}
              />
            );
          })}

          {/* Phase 30 — tooltip bâtiment conditionnel */}
          {buildingTooltip && (
            <BuildingTooltip
              label={buildingTooltip.label}
              x={buildingTooltip.x}
              y={buildingTooltip.y}
              containerWidth={mapSize.width}
              onDismiss={() => setBuildingTooltip(null)}
            />
          )}

          {/* Portail retour vers la ferme — seul point de sortie (per VILL-11, D-18, D-19) */}
          {portalSlot && (
            <PortalSprite
              onPress={handleReturnPortalPress}
              x={portalSlot.x * mapSize.width}
              y={portalSlot.y * mapSize.height}
              accessibilityLabel="Retour à la ferme"
            />
          )}
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

              {/* Carte récompense collective (OBJ-03, OBJ-04) */}
              {isGoalReached && (
                <RewardCard
                  canClaim={canClaim}
                  alreadyClaimed={alreadyClaimed ?? false}
                  activity={activity}
                  onClaim={handleClaim}
                  colors={colors}
                />
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
                        {week.contributionsByMember && Object.keys(week.contributionsByMember).length > 0 && (
                          <View style={styles.historyMembers}>
                            {Object.entries(week.contributionsByMember).map(([pid, count]) => {
                              const p = profiles.find(pr => pr.id === pid);
                              return (
                                <Text key={pid} style={[styles.historyMember, { color: colors.textMuted }]}>
                                  {p?.avatar ?? '👤'} {p?.name ?? pid} : {count}
                                </Text>
                              );
                            })}
                          </View>
                        )}
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

      {/* Phase 30 — modal catalogue bâtiments (VILL-06) */}
      <BuildingsCatalog
        visible={showCatalog}
        onClose={() => setShowCatalog(false)}
        unlockedBuildings={unlockedBuildings}
        familyLifetimeLeaves={familyLifetimeLeaves}
      />
    </Animated.View>
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  headerCatalogButton: {
    position: 'absolute',
    right: Spacing['2xl'],
    bottom: Spacing.xs,
    padding: Spacing.md,
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
  historyMembers: {
    gap: Spacing.xxs,
    marginTop: Spacing.xs,
  },
  historyMember: {
    fontSize: FontSize.sm,
  },
  historyClaimed: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
