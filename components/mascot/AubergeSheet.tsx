/**
 * AubergeSheet.tsx — Modale principale Auberge (Phase 45-02)
 *
 * Visualise les visiteurs PNJ actifs (cartes interactives), un empty state,
 * une section repliable de réputation, et un bouton dev `__DEV__` "Forcer
 * un visiteur" qui appelle `useAuberge.forceSpawn` (livré Plan 45-01).
 *
 * Pattern modal pageSheet + drag-to-dismiss aligné sur BuildingDetailSheet.
 * Esthétique "cozy farm game" : fond parchemin, auvent rayé, cadre bois —
 * aligné sur PlotUpgradeSheet. Seules 2 couleurs sémantiques (#E74C3C,
 * #27AE60) restent hardcodées pour error/success.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  Pressable,
  Image,
} from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';

// ─── Constantes animation livraison ──────────────────────────────────────
const SPRING_CONFIG = { damping: 10, stiffness: 180 };
const DELIVERY_FLASH_DURATION = 100;
const DELIVERY_FADE_DURATION = 400;
const DELIVERY_PARTICLE_DURATION = 600;
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useVault } from '../../contexts/VaultContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuberge } from '../../hooks/useAuberge';
import {
  canDeliver,
  getRemainingMinutes,
  getReputation,
} from '../../lib/mascot/auberge-engine';
import { VISITOR_CATALOG, type VisitorDefinition } from '../../lib/mascot/visitor-catalog';
import { VISITOR_SPRITES } from '../../lib/mascot/visitor-sprites';
import { CRAFT_RECIPES } from '../../lib/mascot/craft-engine';

// ─── Sprites items ───────────────────────────────────────────────────────
// Alignés sur CraftSheet : sprites png pour cultures et craftés.
// Bâtiments (oeuf/lait/farine/miel) restent en emoji (pas de sprite dispo).
const CROP_ICON_SPRITES: Record<string, ReturnType<typeof require>> = {
  carrot:       require('../../assets/garden/crops/carrot/icon.png'),
  wheat:        require('../../assets/garden/crops/wheat/icon.png'),
  beetroot:     require('../../assets/garden/crops/beetroot/icon.png'),
  cabbage:      require('../../assets/garden/crops/cabbage/icon.png'),
  tomato:       require('../../assets/garden/crops/tomato/icon.png'),
  potato:       require('../../assets/garden/crops/potato/icon.png'),
  cucumber:     require('../../assets/garden/crops/cucumber/icon.png'),
  corn:         require('../../assets/garden/crops/corn/icon.png'),
  strawberry:   require('../../assets/garden/crops/strawberry/icon.png'),
  sunflower:    require('../../assets/garden/crops/sunflower/icon.png'),
  pumpkin:      require('../../assets/garden/crops/pumpkin/icon.png'),
  orchidee:     require('../../assets/garden/crops/orchidee/icon.png'),
  truffe:       require('../../assets/garden/crops/truffe/icon.png'),
  rose_doree:   require('../../assets/garden/crops/rose_doree/icon.png'),
  fruit_dragon: require('../../assets/garden/crops/fruit_dragon/icon.png'),
};

function itemSprite(item: VisitorRequestItem): ReturnType<typeof require> | null {
  if (item.source === 'crop') return CROP_ICON_SPRITES[item.itemId] ?? null;
  if (item.source === 'crafted') {
    const recipe = CRAFT_RECIPES.find(r => r.id === item.itemId);
    return recipe?.sprite ?? null;
  }
  return null;
}
import type {
  ActiveVisitor,
  VisitorRequestItem,
  VisitorReputation,
  FarmInventory,
  HarvestInventory,
  CraftedItem,
} from '../../lib/mascot/types';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { SectionErrorBoundary } from '../SectionErrorBoundary';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm, FarmDarkPalette, useFarmTheme, type FarmPalette } from '../../constants/farm-theme';

type Styles = ReturnType<typeof makeStyles>;

// ─── Couleurs sémantiques (seules constantes non-Farm) ──────────────────
const COLOR_ERROR = '#E74C3C';
const COLOR_SUCCESS = '#27AE60';

// ─── Helpers formatage ───────────────────────────────────────────────────
function formatRemaining(minutes: number, expiredLabel: string): string {
  if (minutes <= 0) return expiredLabel;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

function timerColor(minutes: number, farm: FarmPalette): string {
  if (minutes <= 0) return COLOR_ERROR;
  if (minutes < 60) return COLOR_ERROR;
  if (minutes < 360) return '#E8943A';
  return farm.brownTextSub;
}

function getVisitorDef(visitorId: string): VisitorDefinition | undefined {
  return VISITOR_CATALOG.find(d => d.id === visitorId);
}

function itemEmoji(item: VisitorRequestItem): string {
  // Emojis bâtiment/crop courants — fallback générique
  const map: Record<string, string> = {
    oeuf: '🥚',
    lait: '🥛',
    farine: '🫓',
    miel: '🍯',
    carrot: '🥕',
    wheat: '🌾',
    potato: '🥔',
    beetroot: '🫜',
    tomato: '🍅',
    cabbage: '🥬',
    cucumber: '🥒',
    corn: '🌽',
    strawberry: '🍓',
    pumpkin: '🎃',
    sunflower: '🌻',
    orchidee: '🪻',
    rose_doree: '🌹',
    truffe: '🍄',
    fruit_dragon: '🐉',
    soupe: '🍲',
    bouquet: '💐',
    fromage: '🧀',
    pain: '🍞',
    hydromel: '🍯',
    gateau: '🍰',
    parfum_orchidee: '🧴',
  };
  return map[item.itemId] ?? (item.source === 'crafted' ? '🍽️' : '📦');
}

// Ressources bâtiment — alignées sur BuildingDetailSheet (capitalisé singulier)
const BUILDING_LABELS: Record<string, string> = {
  oeuf: 'Œuf',
  lait: 'Lait',
  farine: 'Farine',
  miel: 'Miel',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function itemLabel(item: VisitorRequestItem, t: (key: string, opts?: any) => string): string {
  if (item.source === 'building') {
    return BUILDING_LABELS[item.itemId] ?? item.itemId;
  }
  if (item.source === 'crop') {
    // Aligné sur la ferme (CraftSheet/Garden) : farm.crop.{id}
    return t(`farm.crop.${item.itemId}`, { defaultValue: item.itemId });
  }
  // Aligné sur l'Atelier (CraftSheet) : farm.recipe.{id}
  return t(`farm.recipe.${item.itemId}`, { defaultValue: item.itemId });
}

// ─── Sous-composant : auvent rayé ────────────────────────────────────────

function AwningStripes({ farm, styles }: { farm: FarmPalette; styles: Styles }) {
  return (
    <View style={styles.awning}>
      <View style={styles.awningStripes}>
        {Array.from({ length: farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.awningStripe,
              { backgroundColor: i % 2 === 0 ? farm.awningGreen : farm.awningCream },
            ]}
          />
        ))}
      </View>
      <View style={styles.awningShadow} />
      <View style={styles.awningScallop}>
        {Array.from({ length: farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.awningScallopDot,
              { backgroundColor: i % 2 === 0 ? farm.awningGreen : farm.awningCream },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Sous-composant : carte visiteur ────────────────────────────────────

interface VisitorCardProps {
  visitor: ActiveVisitor;
  canDeliverOk: boolean;
  missingIds: Set<string>;
  onDeliver: (visitor: ActiveVisitor) => void;
  onDismiss: (visitor: ActiveVisitor) => void;
  index: number;
  deliverTrigger: number;
  farm: FarmPalette;
  styles: Styles;
}

const VisitorCard = React.memo(function VisitorCard({
  visitor,
  canDeliverOk,
  missingIds,
  onDeliver,
  onDismiss,
  index,
  deliverTrigger,
  farm,
  styles,
}: VisitorCardProps) {
  const { t } = useTranslation();
  const def = getVisitorDef(visitor.visitorId);
  const emoji = def?.emoji ?? '🧑';
  const name = def ? t(def.labelKey) : visitor.visitorId;
  const bio = def ? t(def.descriptionKey) : '';

  const minutes = getRemainingMinutes(visitor, new Date());
  const tColor = timerColor(minutes, farm);

  const lootPct = def?.preferredLoot && def.preferredLoot.length > 0
    ? Math.round((visitor.lootChance ?? 0.18) * 100)
    : 0;

  // ─── Animation livraison festive ────────────────────────────────────
  const reducedMotion = useReducedMotion();
  const cardScale = useSharedValue(1);
  const flashOpacity = useSharedValue(0);
  const particleY = useSharedValue(0);
  const particleOpacity = useSharedValue(0);

  useEffect(() => {
    if (!deliverTrigger) return;
    if (reducedMotion) return;
    cardScale.value = withSequence(
      withTiming(1.15, { duration: 150 }),
      withSpring(1, SPRING_CONFIG),
    );
    flashOpacity.value = withSequence(
      withTiming(0.4, { duration: DELIVERY_FLASH_DURATION }),
      withTiming(0, { duration: DELIVERY_FADE_DURATION }),
    );
    particleY.value = 0;
    particleOpacity.value = 1;
    particleY.value = withTiming(-50, { duration: DELIVERY_PARTICLE_DURATION });
    particleOpacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 500 }),
    );
  }, [deliverTrigger, reducedMotion, cardScale, flashOpacity, particleY, particleOpacity]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));
  const particleStyle = useAnimatedStyle(() => ({
    opacity: particleOpacity.value,
    transform: [{ translateY: particleY.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.delay(60 * index).springify().damping(14).stiffness(180)}
      style={[styles.card, cardAnimStyle]}
    >
      {/* Flash overlay (animation livraison) */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: COLOR_SUCCESS, borderRadius: Radius.lg },
          flashStyle,
        ]}
      />
      {/* Particule "+X 🍃" qui flotte vers le haut */}
      <Animated.View pointerEvents="none" style={[styles.particle, particleStyle]}>
        <Text style={styles.particleText}>
          +{visitor.rewardCoins} 🍃
        </Text>
      </Animated.View>
      {/* Ligne 1 : portrait + identité */}
      <View style={styles.cardRow}>
        <View style={styles.portrait}>
          {VISITOR_SPRITES[visitor.visitorId] ? (
            <Image
              source={VISITOR_SPRITES[visitor.visitorId]}
              style={styles.portraitSprite}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.portraitEmoji}>{emoji}</Text>
          )}
        </View>
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.bio} numberOfLines={2}>
            {bio}
          </Text>
        </View>
      </View>

      {/* Ligne 2 : grille demande */}
      <View style={styles.requestGrid}>
        {visitor.request.map((item, i) => {
          const ok = !missingIds.has(item.itemId);
          return (
            <View
              key={`${item.itemId}-${i}`}
              style={[
                styles.requestItem,
                { borderColor: ok ? farm.awningGreen : COLOR_ERROR },
              ]}
            >
              <View style={styles.requestItemTop}>
                {(() => {
                  const sprite = itemSprite(item);
                  return sprite ? (
                    <Image source={sprite} style={styles.requestSprite} resizeMode="contain" />
                  ) : (
                    <Text style={styles.requestEmoji}>{itemEmoji(item)}</Text>
                  );
                })()}
                <Text style={styles.requestQty}>{item.quantity}×</Text>
                <Text style={styles.requestStatus}>{ok ? '✅' : '❌'}</Text>
              </View>
              <Text style={styles.requestItemName} numberOfLines={2}>
                {itemLabel(item, t)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Ligne 3 : timer + reward preview */}
      <View style={styles.metaRow}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>{t('auberge.timer.repart_in')}</Text>
          <Text style={[styles.metaValue, { color: tColor }]}>
            {formatRemaining(minutes, t('auberge.timer.expired'))}
          </Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>{t('auberge.reward.label')}</Text>
          <Text style={styles.metaValueReward}>
            +{visitor.rewardCoins} 🍃{visitor.xpReward ? ` · +${visitor.xpReward} XP` : ''}{lootPct > 0 ? ` · ${lootPct}% loot` : ''}
          </Text>
        </View>
      </View>

      {/* Ligne 4 : CTAs */}
      <View style={styles.ctaRow}>
        <Pressable
          onPress={() => onDeliver(visitor)}
          disabled={!canDeliverOk}
          style={[
            styles.ctaPrimary,
            { backgroundColor: canDeliverOk ? farm.greenBtn : farm.parchmentDark },
          ]}
          accessibilityLabel={t('auberge.cta.deliver')}
          accessibilityRole="button"
        >
          <Text style={[styles.ctaPrimaryText, { color: canDeliverOk ? '#FFFFFF' : farm.brownTextSub }]}>
            {t('auberge.cta.deliver')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onDismiss(visitor)}
          style={styles.ctaSecondary}
          accessibilityLabel={t('auberge.cta.dismiss')}
          accessibilityRole="button"
        >
          <Text style={styles.ctaSecondaryText}>
            {t('auberge.cta.dismiss')}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
});

// ─── Sous-composant : ligne réputation ──────────────────────────────────

interface ReputationRowProps {
  visitorDef: VisitorDefinition;
  reputation: VisitorReputation | undefined;
  styles: Styles;
}

const ReputationRow = React.memo(function ReputationRow({
  visitorDef,
  reputation,
  styles,
}: ReputationRowProps) {
  const { t } = useTranslation();
  const name = t(visitorDef.labelKey);
  const level = reputation?.level ?? 0;
  const seen = reputation && (reputation.successCount > 0 || reputation.failureCount > 0);

  const hearts = '❤️'.repeat(level) + '🤍'.repeat(Math.max(0, 5 - level));

  return (
    <View style={styles.repRow}>
      <View style={styles.repPortrait}>
        {VISITOR_SPRITES[visitorDef.id] ? (
          <Image
            source={VISITOR_SPRITES[visitorDef.id]}
            style={styles.repSprite}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.repEmoji}>{visitorDef.emoji}</Text>
        )}
      </View>
      <Text style={styles.repName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.repHearts}>
        {seen ? hearts : t('auberge.reputation.never_met')}
      </Text>
    </View>
  );
});

// ─── Props ──────────────────────────────────────────────────────────────

interface AubergeSheetProps {
  visible: boolean;
  onClose: () => void;
}

// ─── Composant principal ────────────────────────────────────────────────

function AubergeSheetInner({ visible, onClose }: AubergeSheetProps) {
  const { t } = useTranslation();
  const { farm, isDark } = useFarmTheme();
  const styles = isDark ? stylesDark : stylesLight;
  const { activeProfile } = useVault();
  const { showToast } = useToast();
  const {
    activeVisitors,
    reputations,
    totalReputation,
    deliverVisitor,
    dismissVisitor,
    forceSpawn,
  } = useAuberge();

  // ─── Inventaires courants pour canDeliver ─────────────────────────────
  const farmInv: FarmInventory = useMemo(
    () => activeProfile?.farmInventory ?? { oeuf: 0, lait: 0, farine: 0, miel: 0 },
    [activeProfile],
  );
  const harvestInv: HarvestInventory = useMemo(
    () => activeProfile?.harvestInventory ?? {},
    [activeProfile],
  );
  const craftedItems: CraftedItem[] = useMemo(
    () => activeProfile?.craftedItems ?? [],
    [activeProfile],
  );

  // Calcul canDeliver par visiteur
  const deliverChecks = useMemo(() => {
    const map = new Map<string, { ok: boolean; missingIds: Set<string> }>();
    for (const v of activeVisitors) {
      const r = canDeliver(v, farmInv, harvestInv, craftedItems);
      map.set(v.instanceId, {
        ok: r.ok,
        missingIds: new Set(r.missing.map(m => m.itemId)),
      });
    }
    return map;
  }, [activeVisitors, farmInv, harvestInv, craftedItems]);

  // ─── Reputation par visitorId ─────────────────────────────────────────
  const repByVisitor = useMemo(() => {
    const map = new Map<string, VisitorReputation>();
    for (const r of reputations) map.set(r.visitorId, r);
    return map;
  }, [reputations]);

  // Recalcul des cœurs via getReputation pour cohérence avec moteur
  const stateForRep = useMemo(
    () => ({
      visitors: [],
      reputations,
      totalDeliveries: 0,
    }),
    [reputations],
  );

  // ─── Triggers d'animation de livraison (instanceId → compteur) ────────
  const [deliveryTriggers, setDeliveryTriggers] = useState<Record<string, number>>({});

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleDeliver = useCallback(
    async (visitor: ActiveVisitor) => {
      if (!activeProfile) return;
      // Trigger animation OPTIMISTE — démarre avant que le moteur retire le visiteur.
      setDeliveryTriggers(prev => ({
        ...prev,
        [visitor.instanceId]: (prev[visitor.instanceId] ?? 0) + 1,
      }));
      try {
        const result = await deliverVisitor(activeProfile.id, visitor.instanceId);
        if (result.ok && result.reward) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const def = getVisitorDef(visitor.visitorId);
          const name = def ? t(def.labelKey) : t('auberge.fallback_visitor_name');
          const toastKey = result.reward.loot ? 'auberge.reward.toast_with_loot' : 'auberge.reward.toast';
          showToast(
            t(toastKey, { name, coins: result.reward.coins, xp: visitor.xpReward ?? 0 }),
            'success',
          );
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } catch (e) {
        if (__DEV__) console.warn('[AubergeSheet] deliver error', e);
      }
    },
    [activeProfile, deliverVisitor, showToast, t],
  );

  const handleDismiss = useCallback(
    (visitor: ActiveVisitor) => {
      if (!activeProfile) return;
      Alert.alert(
        t('auberge.dismiss_confirm.title'),
        t('auberge.dismiss_confirm.body'),
        [
          { text: t('auberge.dismiss_confirm.cancel'), style: 'cancel' },
          {
            text: t('auberge.dismiss_confirm.confirm'),
            style: 'destructive',
            onPress: async () => {
              try {
                await dismissVisitor(activeProfile.id, visitor.instanceId);
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              } catch (e) {
                if (__DEV__) console.warn('[AubergeSheet] dismiss error', e);
              }
            },
          },
        ],
      );
    },
    [activeProfile, dismissVisitor, t],
  );

  const handleForceSpawn = useCallback(async () => {
    if (!activeProfile) return;
    try {
      await Haptics.selectionAsync();
      const v = await forceSpawn(activeProfile.id);
      if (!v) {
        showToast(
          t('auberge.dev.no_eligible'),
          'info',
        );
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (e) {
      if (__DEV__) console.warn('[AubergeSheet] forceSpawn error', e);
    }
  }, [activeProfile, forceSpawn, showToast, t]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayBg}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheet}>
          {/* Auvent rayé — doit être en premier pour coller au bord arrondi */}
          <AwningStripes farm={farm} styles={styles} />

          {/* Grabber */}
          <View style={styles.grabber} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>
                {t('auberge.title')}
              </Text>
              <Text style={styles.headerSubtitle}>
                {t('auberge.header.subtitle_visitors', { count: activeVisitors.length, reputation: totalReputation })}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel={t('auberge.cta.close')}
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <SectionErrorBoundary name="Auberge">
            <ScrollView
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
            >
              {/* Liste visiteurs ou empty state */}
              {activeVisitors.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>🛖</Text>
                  <Text style={styles.emptyTitle}>
                    {t('auberge.empty.title')}
                  </Text>
                  <Text style={styles.emptyBody}>
                    {t('auberge.empty.body')}
                  </Text>
                </View>
              ) : (
                activeVisitors.map((v, idx) => {
                  const check = deliverChecks.get(v.instanceId);
                  return (
                    <VisitorCard
                      key={v.instanceId}
                      visitor={v}
                      canDeliverOk={check?.ok ?? false}
                      missingIds={check?.missingIds ?? new Set()}
                      onDeliver={handleDeliver}
                      onDismiss={handleDismiss}
                      index={idx}
                      deliverTrigger={deliveryTriggers[v.instanceId] ?? 0}
                      farm={farm}
                      styles={styles}
                    />
                  );
                })
              )}

              {/* Section Réputation (repliée par défaut) */}
              <View style={styles.repSectionWrap}>
                <CollapsibleSection
                  id="auberge-reputation"
                  title={t('auberge.reputation.title')}
                  defaultCollapsed
                >
                  <View style={styles.repList}>
                    {VISITOR_CATALOG.map(def => {
                      const rep = repByVisitor.get(def.id);
                      // S'aligne sur getReputation pour le level (cohérence moteur)
                      const level = getReputation(stateForRep as any, def.id);
                      const rebuilt: VisitorReputation | undefined = rep
                        ? { ...rep, level }
                        : undefined;
                      return (
                        <ReputationRow
                          key={def.id}
                          visitorDef={def}
                          reputation={rebuilt}
                          styles={styles}
                        />
                      );
                    })}
                  </View>
                </CollapsibleSection>
              </View>

              {/* Phase 46 : bouton dev re-gated derrière __DEV__ (le spawn auto prend le relais en release) */}
              {__DEV__ && (
                <TouchableOpacity
                  onPress={handleForceSpawn}
                  style={styles.devBtn}
                  accessibilityLabel={t('auberge.dev.force_spawn_a11y')}
                  accessibilityRole="button"
                >
                  <Text style={styles.devBtnText}>
                    {t('auberge.dev.force_spawn')}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </SectionErrorBoundary>
        </View>
      </View>
    </Modal>
  );
}

export const AubergeSheet = React.memo(AubergeSheetInner);

// ─── Styles ─────────────────────────────────────────────────────────────

const makeStyles = (farm: FarmPalette) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    height: '90%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: farm.parchment,
    ...Shadows.xl,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginTop: Spacing.lg,
    backgroundColor: farm.woodMed,
  },

  // ── Auvent ──
  awning: {
    height: 36,
    overflow: 'hidden',
  },
  awningStripes: {
    flexDirection: 'row',
    height: 28,
  },
  awningStripe: {
    flex: 1,
  },
  awningShadow: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  awningScallop: {
    flexDirection: 'row',
    height: 8,
    marginTop: -4,
  },
  awningScallopDot: {
    flex: 1,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['3xl'],
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  headerTitleWrap: {
    flex: 1,
    gap: Spacing.xxs,
  },
  headerTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.3,
    color: farm.brownText,
  },
  headerSubtitle: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
    color: farm.brownTextSub,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: farm.parchmentDark,
  },
  closeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: farm.brownTextSub,
  },
  body: {
    paddingHorizontal: Spacing['3xl'],
    paddingBottom: Spacing['5xl'],
    gap: Spacing.lg,
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['5xl'],
    gap: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 64,
  },
  emptyTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.heavy,
    color: farm.brownText,
  },
  emptyBody: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    color: farm.brownTextSub,
  },

  // ── Visitor card ──
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: farm.parchmentDark,
    backgroundColor: farm.parchment,
    padding: Spacing['2xl'],
    gap: Spacing.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  particle: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    zIndex: 10,
  },
  particleText: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.heavy,
    color: farm.awningGreen,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  portrait: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: farm.parchmentDark,
  },
  portraitEmoji: {
    fontSize: 56,
  },
  portraitSprite: {
    width: 64,
    height: 64,
  },
  identity: {
    flex: 1,
    gap: Spacing.xxs,
  },
  name: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.2,
    color: farm.brownText,
  },
  bio: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
    lineHeight: 18,
    color: farm.brownTextSub,
  },

  requestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  requestItem: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: Spacing.xxs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    backgroundColor: farm.parchmentDark,
    minWidth: 72,
  },
  requestItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  requestItemName: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: farm.brownText,
    textAlign: 'center',
    maxWidth: 90,
  },
  requestEmoji: {
    fontSize: FontSize.lg,
  },
  requestSprite: {
    width: 28,
    height: 28,
  },
  requestQty: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: farm.brownText,
  },
  requestStatus: {
    fontSize: FontSize.sm,
    color: farm.brownText,
  },

  metaRow: {
    flexDirection: 'row',
    gap: Spacing['2xl'],
  },
  metaCell: {
    flex: 1,
    gap: Spacing.xxs,
  },
  metaLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: farm.brownTextSub,
  },
  metaValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.heavy,
    // color injected inline (timer dynamic color)
  },
  metaValueReward: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.heavy,
    color: farm.brownText,
  },

  ctaRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  ctaPrimary: {
    flex: 2,
    paddingVertical: Spacing.xl,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimaryText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.2,
  },
  ctaSecondary: {
    flex: 1,
    paddingVertical: Spacing.xl,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: farm.woodBtn,
    borderColor: farm.woodBtnShadow,
  },
  ctaSecondaryText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: farm.parchment,
  },

  // ── Reputation section ──
  repSectionWrap: {
    marginTop: Spacing['2xl'],
  },
  repList: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: farm.parchment,
    borderColor: farm.parchmentDark,
  },
  repRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: farm.parchmentDark,
  },
  repPortrait: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: farm.parchmentDark,
  },
  repSprite: {
    width: 32,
    height: 32,
  },
  repEmoji: {
    fontSize: FontSize.icon,
  },
  repName: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: farm.brownText,
  },
  repHearts: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
    color: farm.brownTextSub,
  },

  // ── Dev button ──
  devBtn: {
    marginTop: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    backgroundColor: farm.parchmentDark,
    borderColor: farm.woodLight,
  },
  devBtnText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    color: farm.brownTextSub,
  },
});

const stylesLight = makeStyles(Farm);
const stylesDark = makeStyles(FarmDarkPalette);
