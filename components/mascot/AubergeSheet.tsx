/**
 * AubergeSheet.tsx — Modale principale Auberge (Phase 45-02)
 *
 * Visualise les visiteurs PNJ actifs (cartes interactives), un empty state,
 * une section repliable de réputation, et un bouton dev `__DEV__` "Forcer
 * un visiteur" qui appelle `useAuberge.forceSpawn` (livré Plan 45-01).
 *
 * Pattern modal pageSheet + drag-to-dismiss aligné sur BuildingDetailSheet.
 * Toutes les couleurs proviennent de useThemeColors() — seules les 2
 * couleurs sémantiques de timer (ambre / rouge) sont constantées (alignées
 * sur le pattern wear de DashboardGarden).
 */
import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  Pressable,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuberge } from '../../hooks/useAuberge';
import {
  canDeliver,
  getRemainingMinutes,
  getReputation,
} from '../../lib/mascot/auberge-engine';
import { VISITOR_CATALOG, type VisitorDefinition } from '../../lib/mascot/visitor-catalog';
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

// ─── Couleurs sémantiques timer (alignées DashboardGarden wear) ─────────
const TIMER_AMBER = '#F59E0B'; // < 6h
const TIMER_RED = '#EF4444';   // < 1h

// ─── Lookup map FR pour les 6 PNJ ───────────────────────────────────────
const VISITOR_LABELS_FR: Record<string, { name: string; bio: string }> = {
  hugo_boulanger: {
    name: 'Hugo le boulanger',
    bio: 'Le four chauffe — il lui faut farine et œufs frais.',
  },
  meme_lucette: {
    name: 'Mémé Lucette',
    bio: 'Une bonne soupe demande lait et légumes du jardin.',
  },
  yann_apiculteur: {
    name: 'Yann l’apiculteur',
    bio: 'Les ruches sont vides, il troque son miel contre du tien.',
  },
  voyageuse: {
    name: 'La Voyageuse',
    bio: 'Cherche un bouquet ou une soupe pour la route.',
  },
  marchand_ambulant: {
    name: 'Le Marchand ambulant',
    bio: 'Un fromage, un pain — il paie bien les craftés.',
  },
  comtesse: {
    name: 'La Comtesse',
    bio: 'N’accepte que ce qu’il y a de plus raffiné.',
  },
};

// ─── Helpers formatage ───────────────────────────────────────────────────
function formatRemaining(minutes: number): string {
  if (minutes <= 0) return 'Expiré';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

function timerColor(minutes: number, fallback: string): string {
  if (minutes <= 0) return TIMER_RED;
  if (minutes < 60) return TIMER_RED;
  if (minutes < 360) return TIMER_AMBER;
  return fallback;
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

// ─── Sous-composant : carte visiteur ────────────────────────────────────

interface VisitorCardProps {
  visitor: ActiveVisitor;
  canDeliverOk: boolean;
  missingIds: Set<string>;
  onDeliver: (visitor: ActiveVisitor) => void;
  onDismiss: (visitor: ActiveVisitor) => void;
  index: number;
}

const VisitorCard = React.memo(function VisitorCard({
  visitor,
  canDeliverOk,
  missingIds,
  onDeliver,
  onDismiss,
  index,
}: VisitorCardProps) {
  const { colors, primary } = useThemeColors();
  const def = getVisitorDef(visitor.visitorId);
  const labels = VISITOR_LABELS_FR[visitor.visitorId];
  const emoji = def?.emoji ?? '🧑';
  const name = labels?.name ?? visitor.visitorId;
  const bio = labels?.bio ?? '';

  const minutes = getRemainingMinutes(visitor, new Date());
  const tColor = timerColor(minutes, colors.textMuted);

  const lootPct = def?.preferredLoot && def.preferredLoot.length > 0
    ? Math.round(0.18 * 100) // approximation visuelle — la chance réelle est gérée moteur
    : 0;

  return (
    <Animated.View
      entering={FadeIn.delay(60 * index).springify().damping(14).stiffness(180)}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Ligne 1 : portrait + identité */}
      <View style={styles.cardRow}>
        <View style={[styles.portrait, { backgroundColor: colors.cardAlt }]}>
          <Text style={styles.portraitEmoji}>{emoji}</Text>
        </View>
        <View style={styles.identity}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.bio, { color: colors.textMuted }]} numberOfLines={2}>
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
                {
                  backgroundColor: colors.cardAlt,
                  borderColor: ok ? colors.success : colors.error,
                },
              ]}
            >
              <Text style={styles.requestEmoji}>{itemEmoji(item)}</Text>
              <Text style={[styles.requestQty, { color: colors.text }]}>
                {item.quantity}×
              </Text>
              <Text
                style={[
                  styles.requestStatus,
                  { color: ok ? colors.successText : colors.errorText },
                ]}
              >
                {ok ? '✅' : '❌'}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Ligne 3 : timer + reward preview */}
      <View style={styles.metaRow}>
        <View style={styles.metaCell}>
          <Text style={[styles.metaLabel, { color: colors.textFaint }]}>Repart dans</Text>
          <Text style={[styles.metaValue, { color: tColor }]}>
            {formatRemaining(minutes)}
          </Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={[styles.metaLabel, { color: colors.textFaint }]}>Récompense</Text>
          <Text style={[styles.metaValue, { color: colors.text }]}>
            +{visitor.rewardCoins} 🍃{lootPct > 0 ? ` · ${lootPct}% loot` : ''}
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
            {
              backgroundColor: primary,
              opacity: canDeliverOk ? 1 : 0.4,
            },
          ]}
          accessibilityLabel="Livrer le visiteur"
          accessibilityRole="button"
        >
          <Text style={[styles.ctaPrimaryText, { color: colors.onPrimary }]}>
            Livrer
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onDismiss(visitor)}
          style={[
            styles.ctaSecondary,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
          accessibilityLabel="Décliner le visiteur"
          accessibilityRole="button"
        >
          <Text style={[styles.ctaSecondaryText, { color: colors.textMuted }]}>
            Décliner
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
}

const ReputationRow = React.memo(function ReputationRow({
  visitorDef,
  reputation,
}: ReputationRowProps) {
  const { colors } = useThemeColors();
  const labels = VISITOR_LABELS_FR[visitorDef.id];
  const name = labels?.name ?? visitorDef.id;
  const level = reputation?.level ?? 0;
  const seen = reputation && (reputation.successCount > 0 || reputation.failureCount > 0);

  const hearts = '❤️'.repeat(level) + '🤍'.repeat(Math.max(0, 5 - level));

  return (
    <View style={[styles.repRow, { borderBottomColor: colors.borderLight }]}>
      <Text style={styles.repEmoji}>{visitorDef.emoji}</Text>
      <Text style={[styles.repName, { color: colors.text }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.repHearts, { color: colors.textMuted }]}>
        {seen ? hearts : 'Jamais rencontré'}
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
  const { colors } = useThemeColors();
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

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleDeliver = useCallback(
    async (visitor: ActiveVisitor) => {
      if (!activeProfile) return;
      try {
        const result = await deliverVisitor(activeProfile.id, visitor.instanceId);
        if (result.ok && result.reward) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showToast(
            `Livré ! +${result.reward.coins} 🍃${result.reward.loot ? ' + 🎁' : ''}`,
            'success',
          );
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } catch (e) {
        if (__DEV__) console.warn('[AubergeSheet] deliver error', e);
      }
    },
    [activeProfile, deliverVisitor, showToast],
  );

  const handleDismiss = useCallback(
    (visitor: ActiveVisitor) => {
      if (!activeProfile) return;
      Alert.alert(
        'Décliner ce visiteur ?',
        'Il repartira sans rien et il faudra attendre avant qu’il revienne.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Décliner',
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
    [activeProfile, dismissVisitor],
  );

  const handleForceSpawn = useCallback(async () => {
    if (!activeProfile) return;
    try {
      await Haptics.selectionAsync();
      const v = await forceSpawn(activeProfile.id);
      if (!v) {
        showToast(
          'Aucun visiteur éligible (arbre trop jeune ou cap atteint)',
          'info',
        );
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (e) {
      if (__DEV__) console.warn('[AubergeSheet] forceSpawn error', e);
    }
  }, [activeProfile, forceSpawn, showToast]);

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

        <View style={[styles.sheet, { backgroundColor: colors.bg }]}>
          {/* Grabber */}
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                🛖 Auberge
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                {activeVisitors.length} visiteur{activeVisitors.length > 1 ? 's' : ''} · ❤ {totalReputation}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.cardAlt }]}
              accessibilityLabel="Fermer"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.closeBtnText, { color: colors.textMuted }]}>✕</Text>
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
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    L’auberge est calme…
                  </Text>
                  <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
                    Un visiteur arrivera bientôt.
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
                    />
                  );
                })
              )}

              {/* Section Réputation (repliée par défaut) */}
              <View style={styles.repSectionWrap}>
                <CollapsibleSection
                  id="auberge-reputation"
                  title="Réputation"
                  defaultCollapsed
                >
                  <View
                    style={[
                      styles.repList,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
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
                  style={[
                    styles.devBtn,
                    { backgroundColor: colors.cardAlt, borderColor: colors.border },
                  ]}
                  accessibilityLabel="Forcer un visiteur (dev)"
                  accessibilityRole="button"
                >
                  <Text style={[styles.devBtnText, { color: colors.textMuted }]}>
                    🪄 Forcer un visiteur (dev)
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

const styles = StyleSheet.create({
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
    ...Shadows.xl,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginTop: Spacing.lg,
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
  },
  headerSubtitle: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
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
  },
  emptyBody: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },

  // ── Visitor card ──
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing['2xl'],
    gap: Spacing.lg,
    ...Shadows.sm,
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
  },
  portraitEmoji: {
    fontSize: 56,
  },
  identity: {
    flex: 1,
    gap: Spacing.xxs,
  },
  name: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.2,
  },
  bio: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
    lineHeight: 18,
  },

  requestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  requestEmoji: {
    fontSize: FontSize.lg,
  },
  requestQty: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  requestStatus: {
    fontSize: FontSize.sm,
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
  },
  metaValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.heavy,
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
  },
  ctaSecondaryText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },

  // ── Reputation section ──
  repSectionWrap: {
    marginTop: Spacing['2xl'],
  },
  repList: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  repRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  repEmoji: {
    fontSize: FontSize.icon,
  },
  repName: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  repHearts: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
  },

  // ── Dev button ──
  devBtn: {
    marginTop: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  devBtnText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
});
