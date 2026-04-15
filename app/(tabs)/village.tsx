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
  Image,
  AppState,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useGarden } from '../../hooks/useGarden';
import { TileMapRenderer, VILLAGE_GRASS_TILE_IMAGE } from '../../components/mascot/TileMapRenderer';
import { LiquidXPBar } from '../../components/ui/LiquidXPBar';
import { CollapsibleSection } from '../../components/ui/CollapsibleSection';
import { ReactiveAvatar } from '../../components/ui/ReactiveAvatar';
import { getCurrentSeason } from '../../lib/mascot/seasons';
import { pickSeasonalActivity } from '../../lib/village/activities';
import { addPoints } from '../../lib/gamification/engine';
import { parseGamification, serializeGamification } from '../../lib/parser';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import type { VaultManager } from '../../lib/vault';
import type { Profile } from '../../lib/types';
// Phase 29 — overlay avatars + tooltip (VILL-01/02/03) + portail retour (VILL-11/12)
import { VillageAvatar } from '../../components/village/VillageAvatar';
import { AvatarTooltip } from '../../components/village/AvatarTooltip';
import { PortalSprite } from '../../components/village/PortalSprite';
// Phase 30 — bâtiments persistants (VILL-04, VILL-06)
import { BuildingSprite } from '../../components/village/BuildingSprite';
import { BuildingTooltip } from '../../components/village/BuildingTooltip';
import { BuildingsCatalog } from '../../components/village/BuildingsCatalog';
import { VillageBuildingModal } from '../../components/village/VillageBuildingModal';
// Phase 31+ — atelier village + arbre tech
import { AtelierSheet } from '../../components/village/AtelierSheet';
import { VillageTechSheet } from '../../components/village/VillageTechSheet';
import { BUILDINGS_CATALOG, VILLAGE_RECIPES } from '../../lib/village';
import type { UnlockedBuilding, VillageAtelierCraft } from '../../lib/village';
import { VILLAGE_GRID } from '../../lib/village/grid';
// Q49 — Échange inter-familles via Port
import { PortTradeModal } from '../../components/village/PortTradeModal';
import { TradeReceiptModal } from '../../components/village/TradeReceiptModal';
// Marché boursier
import { MarketSheet } from '../../components/village/MarketSheet';
import { parseFarmProfile } from '../../lib/parser';
import type { FarmInventory, HarvestInventory } from '../../lib/mascot/types';

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
const MAP_HEIGHT = SCREEN_W * 2;
const FOUNTAIN_SIZE = 96;
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

// ── UnifiedFeedItem — crafts uniquement ───────────────────────────────────

type UnifiedFeedItem = { kind: 'craft'; data: VillageAtelierCraft; timestamp: string };

// ── CraftFeedItem — mémoïsé ────────────────────────────────────────────────

const CraftFeedItem = React.memo(function CraftFeedItem({
  craft,
  profileName,
  profileEmoji,
  colors,
}: {
  craft: VillageAtelierCraft;
  profileName: string;
  profileEmoji: string;
  colors: ColorsType;
}) {
  const recipe = VILLAGE_RECIPES.find(r => r.id === craft.recipeId);
  const label = recipe ? `${recipe.resultEmoji} ${recipe.labelFR}` : craft.recipeId;
  const xp = recipe?.xpBonus ?? 0;
  return (
    <View style={[styles.feedItem, styles.craftFeedItem, { borderBottomColor: colors.borderLight, borderLeftColor: colors.warning }]}>
      <Text style={styles.feedEmoji}>{profileEmoji}</Text>
      <View style={styles.feedContent}>
        <Text style={[styles.feedName, { color: colors.text }]} numberOfLines={1}>
          {profileName}
        </Text>
        <Text style={[styles.feedType, { color: colors.textMuted }]} numberOfLines={1}>
          a crafté · {label}
        </Text>
      </View>
      {xp > 0 && (
        <Text style={[styles.feedAmount, { color: colors.warning }]}>+{xp} XP</Text>
      )}
      <Text style={[styles.feedTime, { color: colors.textFaint ?? colors.textMuted }]}>
        {formatRelativeTime(craft.timestamp)}
      </Text>
    </View>
  );
});

// ── VillageScreen — Composant principal ───────────────────────────────────

export default function VillageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeColors();
  const { t } = useTranslation();
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
    // Phase 31+ — production collective
    inventory,
    productionState,
    lifetimeContributions,
    collectBuildingProduction,
    // Phase 31+ — atelier + techs
    atelierCrafts,
    atelierTechs,
    villageTechBonuses,
    craftVillageItem,
    unlockVillageTech,
    // Q49 — Trade inter-familles
    sendTrade,
    receiveTrade,
    canSendTradeToday: canSendTrade,
    tradesSentRemaining,
    // Marché boursier
    marketStock,
    marketTransactions,
    buyFromMarket,
    sellToMarket,
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
  // Phase 31+ — modal bâtiment débloqué (production collective)
  const [selectedBuilding, setSelectedBuilding] = useState<UnlockedBuilding | null>(null);
  // Phase 31+ — modal atelier + modal arbre tech
  const [showAtelier, setShowAtelier] = useState(false);
  const [showTechTree, setShowTechTree] = useState(false);
  // Q49 — Trade inter-familles via Port
  const [showPortTrade, setShowPortTrade] = useState(false);
  // Marché boursier
  const [showMarket, setShowMarket] = useState(false);
  const [tradeReceipt, setTradeReceipt] = useState<{ emoji: string; label: string; qty: number } | null>(null);
  const [farmInv, setFarmInv] = useState<FarmInventory>({ oeuf: 0, lait: 0, farine: 0, miel: 0 });
  const [harvestInv, setHarvestInv] = useState<HarvestInventory>({});
  const [craftedItems, setCraftedItems] = useState<import('../../lib/mascot/types').CraftedItem[]>([]);
  const season = getCurrentSeason();

  // ── Pause animations (background + onglet pas visible) ───────────────
  const [isAppActive, setIsAppActive] = useState(true);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setIsAppActive(state === 'active');
    });
    return () => sub.remove();
  }, []);
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => setIsScreenFocused(false);
    }, []),
  );
  const animationsPaused = !isAppActive || !isScreenFocused;

  // ── Memos ─────────────────────────────────────────────────────────────

  /** Feed unifié contributions + crafts — plus récents en premier */
  const feedItems = useMemo<UnifiedFeedItem[]>(() => {
    const crafts: UnifiedFeedItem[] = (atelierCrafts ?? []).map(c => ({
      kind: 'craft', data: c, timestamp: c.timestamp,
    }));
    const all = crafts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return showAllFeed ? all : all.slice(0, FEED_LIMIT);
  }, [atelierCrafts, showAllFeed]);

  const totalContribs = atelierCrafts?.length ?? 0;

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

  /** Slot de la fontaine centrale */
  const fountainSlot = useMemo(
    () => VILLAGE_GRID.find(c => c.role === 'fountain'),
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

  // Q49 — Charger les inventaires ferme du profil actif (ferme + récoltes)
  const loadFarmInventories = useCallback(async () => {
    if (!vault || !activeProfile) return;
    try {
      const farmPath = `farm-${activeProfile.id}.md`;
      const content = await vault.readFile(farmPath).catch(() => '');
      const farmData = parseFarmProfile(content);
      setFarmInv(farmData.farmInventory ?? { oeuf: 0, lait: 0, farine: 0, miel: 0 });
      setHarvestInv(farmData.harvestInventory ?? {});
      setCraftedItems(farmData.craftedItems ?? []);
    } catch {
      /* non-critique */
    }
  }, [vault, activeProfile]);

  // ── Phase 30/31 — handler tap bâtiment ───────────────────────────────
  // Bâtiment débloqué → modal production (tous). Port a en plus un bouton échange.
  // Marché → ouvre le MarketSheet au lieu du modal générique.
  const handleBuildingPress = useCallback(
    (ub: UnlockedBuilding) => {
      if (ub.buildingId === 'marche') {
        loadFarmInventories();
        setShowMarket(true);
        return;
      }
      setSelectedBuilding(ub);
    },
    [loadFarmInventories],
  );

  // Q49 — Ouvre la modal trade depuis le bouton dans VillageBuildingModal
  const handleOpenPortTrade = useCallback(() => {
    setSelectedBuilding(null);
    loadFarmInventories();
    setShowPortTrade(true);
  }, [loadFarmInventories]);

  const handleBuildingCollect = useCallback(
    async (buildingId: string) => {
      await collectBuildingProduction(buildingId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [collectBuildingProduction],
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
      // Bonus XP + loot box — profil actif : écriture directe (son propre gami)
      // Autres profils : pending-reward pour éviter d'écrire dans leurs fichiers (iCloud stale)
      try {
        await addVillageBonus(vault, activeProfile, 25, 'Objectif village atteint');
      } catch { /* Gamification — non-critical */ }
      const otherProfiles = activeProfiles.filter(p => p.id !== activeProfile.id);
      for (const p of otherProfiles) {
        try {
          const pending = JSON.stringify({ type: 'village', xp: 25, lootBoxes: 1, note: 'Objectif village atteint', from: activeProfile.id, at: new Date().toISOString() });
          await vault.writeFile(`pending-reward-${p.id}.md`, pending);
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

  useEffect(() => {
    loadFarmInventories();
  }, [loadFarmInventories]);

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
          {/* Fond herbe répété — couvre toute la carte y compris zones sans tile */}
          <Image
            source={VILLAGE_GRASS_TILE_IMAGE}
            style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
            resizeMode="repeat"
          />
          <TileMapRenderer
            treeStage="arbre"
            containerWidth={SCREEN_W}
            containerHeight={MAP_HEIGHT}
            season={season}
            mode="village"
          />

          {/* Fontaine centrale — sprite pixel statique sur le slot village_fountain */}
          {fountainSlot && (
            <View
              style={[
                styles.fountainSprite,
                {
                  left: fountainSlot.x * mapSize.width - FOUNTAIN_SIZE / 2,
                  top:  fountainSlot.y * mapSize.height - FOUNTAIN_SIZE / 2,
                },
              ]}
              pointerEvents="none"
            >
              <Image
                source={require('../../assets/items/fontaine_village.png')}
                style={{ width: FOUNTAIN_SIZE, height: FOUNTAIN_SIZE }}
                resizeMode="contain"
              />
            </View>
          )}

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
                paused={animationsPaused}
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
            const catalogEntry = BUILDINGS_CATALOG.find(b => b.id === ub.buildingId);
            const consumed = productionState[ub.buildingId] ?? 0;
            const available = Math.max(0, lifetimeContributions - consumed);
            const multiplier = villageTechBonuses.productionRateMultiplier[ub.buildingId] ?? 1;
            const effectiveRate = Math.max(1, Math.floor((catalogEntry?.production?.ratePerItem ?? 1) * multiplier));
            const pending = catalogEntry?.production ? Math.floor(available / effectiveRate) : 0;
            return (
              <BuildingSprite
                key={ub.buildingId}
                buildingId={ub.buildingId}
                slotX={slot.x * mapSize.width}
                slotY={slot.y * mapSize.height}
                pendingCount={pending}
                onPress={() => handleBuildingPress(ub)}
              />
            );
          })}

          {/* Phase 30 — tooltip bâtiment (verrouillé uniquement — les débloqués ont un modal) */}
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
              x={portalSlot.x * mapSize.width + 10}
              y={portalSlot.y * mapSize.height}
              accessibilityLabel="Retour à la ferme"
            />
          )}
        </View>

        {/* ── Carte Actions — chevauche le bas de la carte comme tree.tsx ── */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          style={styles.actionCardWrapper}
        >
          <View style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.borderLight }, Shadows.sm]}>
            <View style={styles.actionRow}>
              {unlockedBuildings.some(b => b.buildingId === 'marche') && (
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => { loadFarmInventories(); setShowMarket(true); }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Marché du village"
                >
                  <Text style={styles.actionItemIcon}>📈</Text>
                  <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>Marché</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => setShowAtelier(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Atelier village"
              >
                <Text style={styles.actionItemIcon}>⚒️</Text>
                <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>Atelier</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => setShowTechTree(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Améliorations village"
              >
                <Text style={styles.actionItemIcon}>🏛️</Text>
                <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>Techs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => setShowCatalog(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Bâtiments du village"
              >
                <Text style={styles.actionItemIcon}>🏘️</Text>
                <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>Bâtiments</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

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
                Activité du village
              </Text>

              {totalContribs === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>🌱</Text>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    Pas encore d'activité
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                    Les crafts apparaîtront ici.
                  </Text>
                </View>
              ) : (
                <>
                  {feedItems.map((item, idx) => {
                    const profileId = item.data.profileId;
                    const profile = profiles.find(p => p.id === profileId);
                    const name = profile?.name ?? profileId;
                    const emoji = profile?.avatar ?? '👤';
                    return (
                      <CraftFeedItem
                        key={`craft-${item.timestamp}-${idx}`}
                        craft={item.data as VillageAtelierCraft}
                        profileName={name}
                        profileEmoji={emoji}
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
        onUnlockedBuildingPress={(building) => {
          setShowCatalog(false);
          setSelectedBuilding(building);
        }}
      />

      {/* Phase 31+ — modal bâtiment débloqué (production collective) */}
      {selectedBuilding && (
        <VillageBuildingModal
          visible={!!selectedBuilding}
          building={selectedBuilding}
          lifetimeContributions={lifetimeContributions}
          productionState={productionState}
          inventory={inventory}
          onCollect={handleBuildingCollect}
          onClose={() => setSelectedBuilding(null)}
          onOpenTrade={selectedBuilding?.buildingId === 'port' ? handleOpenPortTrade : undefined}
          techMultiplier={villageTechBonuses.productionRateMultiplier[selectedBuilding.buildingId] ?? 1}
        />
      )}

      {/* Phase 31+ — modal atelier village */}
      <AtelierSheet
        visible={showAtelier}
        inventory={inventory}
        atelierCrafts={atelierCrafts}
        unlockedRecipeTier={villageTechBonuses.unlockedRecipeTier}
        profileId={activeProfile?.id ?? ''}
        coins={activeProfile?.coins ?? 0}
        onCraft={craftVillageItem}
        onClose={() => setShowAtelier(false)}
      />

      {/* Phase 31+ — modal arbre tech village */}
      <VillageTechSheet
        visible={showTechTree}
        inventory={inventory}
        unlockedTechs={atelierTechs}
        onUnlock={unlockVillageTech}
        onClose={() => setShowTechTree(false)}
      />

      {/* Q49 — Modal Port : échange inter-familles */}
      <PortTradeModal
        visible={showPortTrade}
        onClose={() => setShowPortTrade(false)}
        villageInventory={inventory}
        farmInventory={farmInv}
        harvestInventory={harvestInv}
        craftedItems={craftedItems}
        onSend={async (cat, itemId, qty) => {
          if (!activeProfile) return null;
          const code = await sendTrade(cat, itemId, qty, activeProfile.id);
          if (code) await loadFarmInventories();
          return code;
        }}
        onReceive={async (code) => {
          if (!activeProfile) return { success: false, error: 'Profil introuvable' };
          const result = await receiveTrade(code, activeProfile.id);
          if (result.success) {
            await loadFarmInventories();
            setShowPortTrade(false);
            // Traduire le label selon la catégorie
            let displayLabel = result.itemLabel ?? 'Objet';
            if (result.category === 'harvest' && result.itemId) {
              displayLabel = t(`farm.crop.${result.itemId}`, { defaultValue: displayLabel });
            } else if (result.category === 'crafted' && result.itemId) {
              displayLabel = t(`craft.recipe.${result.itemId}`, { defaultValue: displayLabel });
            }
            setTradeReceipt({
              emoji: result.emoji ?? '📦',
              label: displayLabel,
              qty: result.quantity ?? 1,
            });
          }
          return result;
        }}
        canSendToday={canSendTrade}
        sendsRemaining={tradesSentRemaining}
      />

      {/* Q49 — Modal réception colis animée */}
      <TradeReceiptModal
        visible={!!tradeReceipt}
        itemEmoji={tradeReceipt?.emoji ?? '📦'}
        itemLabel={tradeReceipt?.label ?? ''}
        quantity={tradeReceipt?.qty ?? 1}
        onDone={() => setTradeReceipt(null)}
      />

      {/* Marché boursier */}
      <MarketSheet
        visible={showMarket}
        marketStock={marketStock}
        marketTransactions={marketTransactions}
        profileId={activeProfile?.id ?? ''}
        profileCoins={activeProfile?.coins ?? 0}
        villageInventory={inventory}
        farmInventory={{
          oeuf: farmInv.oeuf ?? 0,
          lait: farmInv.lait ?? 0,
          farine: farmInv.farine ?? 0,
          miel: farmInv.miel ?? 0,
        }}
        harvestInventory={harvestInv}
        craftedCounts={(() => {
          const counts: Record<string, number> = {};
          for (const item of craftedItems) {
            counts[item.recipeId] = (counts[item.recipeId] ?? 0) + 1;
          }
          return counts;
        })()}
        onBuy={async (itemId, qty, priceOverride?) => {
          if (!activeProfile) return { success: false, error: 'Profil introuvable' };
          const result = await buyFromMarket(itemId, qty, activeProfile.id, priceOverride);
          if (result.success) await loadFarmInventories();
          return result;
        }}
        onSell={async (itemId, qty) => {
          if (!activeProfile) return { success: false, error: 'Profil introuvable' };
          const result = await sellToMarket(itemId, qty, activeProfile.id);
          if (result.success) await loadFarmInventories();
          return result;
        }}
        onClose={() => setShowMarket(false)}
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
  // Carte Actions (pattern tree.tsx — chevauche bas de la carte)
  actionCardWrapper: {
    marginTop: -22,
    zIndex: 10,
    position: 'relative',
  },
  actionCard: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  actionRow: {
    flexDirection: 'row',
  },
  actionItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  actionItemIcon: {
    fontSize: 22,
    lineHeight: 28,
  },
  actionItemLabel: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
  },

  // Carte tilemap (dans le flux scroll, comme tree.tsx)
  fountainSprite: {
    position: 'absolute',
    width: FOUNTAIN_SIZE,
    height: FOUNTAIN_SIZE,
  },
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
  craftFeedItem: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.sm,
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
