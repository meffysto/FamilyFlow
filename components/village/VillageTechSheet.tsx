// components/village/VillageTechSheet.tsx
// Modal Arbre Tech Village — 3 branches : Production / Atelier / Harmonie
// Permet de débloquer les noeuds tech en dépensant des items de l'inventaire.

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import {
  VILLAGE_TECH_TREE,
  canUnlockVillageTech,
} from '../../lib/village';
import type { VillageTechNode, VillageTechBranchId } from '../../lib/village/atelier-engine';
import type { VillageInventory } from '../../lib/village/types';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm } from '../../constants/farm-theme';

// ── Constantes animation ────────────────────────────────────────────────────

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

// ── Types ─────────────────────────────────────────────────────────────────

interface VillageTechSheetProps {
  visible: boolean;
  inventory: VillageInventory;
  unlockedTechs: string[];
  onUnlock: (techId: string) => Promise<boolean>;
  onClose: () => void;
}

// ── Constantes branche ─────────────────────────────────────────────────────

const BRANCH_META: Record<VillageTechBranchId, { label: string; emoji: string; color: string }> = {
  production: { label: 'Production', emoji: '⚙️', color: '#F59E0B' },
  atelier:    { label: 'Atelier',    emoji: '🪚', color: '#6366F1' },
  harmonie:   { label: 'Harmonie',   emoji: '🤝', color: '#10B981' },
};

const BRANCH_ORDER: VillageTechBranchId[] = ['production', 'atelier', 'harmonie'];

// ── AwningStripes ──────────────────────────────────────────────────────────

function AwningStripes() {
  return (
    <View style={styles.awning}>
      <View style={styles.awningStripes}>
        {Array.from({ length: Farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.awningStripe,
              { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream },
            ]}
          />
        ))}
      </View>
      {/* Scallop dots row */}
      <View style={styles.awningScallops}>
        {Array.from({ length: Farm.awningStripeCount }).map((_, i) => (
          <View key={i} style={styles.awningScallopDot} />
        ))}
      </View>
    </View>
  );
}

// ── FarmButton (3D, dynamic color) ─────────────────────────────────────────

function FarmButton({
  label,
  onPress,
  enabled,
  bg,
  shadowColor,
  highlightColor,
}: {
  label: string;
  onPress: () => void;
  enabled: boolean;
  bg: string;
  shadowColor: string;
  highlightColor: string;
}) {
  const pressed = useSharedValue(0);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withSpring(pressed.value ? 4 : 0, SPRING_CONFIG) }],
  }));

  const resolvedBg = enabled ? bg : Farm.parchmentDark;
  const resolvedShadow = enabled ? shadowColor : '#D0CBC3';
  const resolvedGloss = enabled ? highlightColor + '66' : '#FFFFFF44';

  return (
    <View style={styles.farmBtnWrapper}>
      {/* Shadow layer */}
      <View style={[styles.farmBtnShadow, { backgroundColor: resolvedShadow }]} />
      {/* Body layer */}
      <Animated.View style={[styles.farmBtnBody, { backgroundColor: resolvedBg }, bodyStyle]}>
        {/* Gloss overlay (top 40%) */}
        <View style={[styles.farmBtnGloss, { backgroundColor: resolvedGloss }]} />
        <Pressable
          onPressIn={() => { if (enabled) pressed.value = 1; }}
          onPressOut={() => { pressed.value = 0; }}
          onPress={enabled ? onPress : undefined}
          style={styles.farmBtnPressable}
        >
          <Text style={[styles.farmBtnText, { color: enabled ? '#FFFFFF' : '#A09080' }]}>
            {label}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ── TechNodeCard ───────────────────────────────────────────────────────────

const TechNodeCard = React.memo(function TechNodeCard({
  node,
  inventory,
  unlockedTechs,
  branchColor,
  onUnlock,
  colors,
}: {
  node: VillageTechNode;
  inventory: VillageInventory;
  unlockedTechs: string[];
  branchColor: string;
  onUnlock: (techId: string) => void;
  colors: ReturnType<typeof useThemeColors>['colors'];
}) {
  const isUnlocked = unlockedTechs.includes(node.id);
  const { canUnlock, reason } = useMemo(
    () => canUnlockVillageTech(node.id, unlockedTechs, inventory),
    [node.id, unlockedTechs, inventory],
  );

  // Prérequis non débloqué (pas assez d'avancement dans la branche)
  const prereqMissing = node.requires !== null && !unlockedTechs.includes(node.requires ?? '');

  const borderColor = isUnlocked
    ? branchColor
    : canUnlock
      ? branchColor + '66'
      : Farm.woodHighlight;

  const bgColor = isUnlocked
    ? branchColor + '22'
    : Farm.parchmentDark;

  // Derive darker/lighter shades from branchColor for 3D button
  const btnShadow = branchColor + 'CC';
  const btnHighlight = branchColor + '88';

  return (
    <Animated.View entering={FadeIn} style={[styles.nodeCard, { backgroundColor: bgColor, borderColor }]}>
      {/* Connecteur vertical entre noeuds (sauf premier) */}
      {node.order > 1 && (
        <View style={[styles.nodeConnector, { backgroundColor: isUnlocked ? branchColor : Farm.woodHighlight }]} />
      )}

      {/* Header noeud */}
      <View style={styles.nodeHeader}>
        <View style={[styles.nodeEmojiContainer, { backgroundColor: isUnlocked ? branchColor : Farm.woodHighlight }]}>
          <Text style={styles.nodeEmoji}>{isUnlocked ? '✅' : node.emoji}</Text>
        </View>
        <View style={styles.nodeInfo}>
          <Text style={[styles.nodeLabel, { color: Farm.brownText }]}>{node.labelFR}</Text>
          <Text style={[styles.nodeDesc, { color: Farm.brownTextSub }]} numberOfLines={2}>
            {node.descriptionFR}
          </Text>
        </View>
        {isUnlocked && (
          <View style={[styles.unlockedBadge, { backgroundColor: branchColor }]}>
            <Text style={styles.unlockedBadgeText}>✓</Text>
          </View>
        )}
      </View>

      {/* Coût */}
      {!isUnlocked && (
        <View style={styles.costRow}>
          {node.cost.map(c => {
            const stock = inventory[c.itemId] ?? 0;
            const enough = stock >= c.quantity;
            return (
              <View
                key={c.itemId}
                style={[
                  styles.costPill,
                  { backgroundColor: enough ? '#10B98122' : '#EF444422' },
                ]}
              >
                <Text style={styles.costEmoji}>{c.itemEmoji}</Text>
                <Text style={[
                  styles.costQty,
                  { color: enough ? '#10B981' : '#EF4444' },
                ]}>
                  {stock}/{c.quantity}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Bouton déblocage ou label verrouillé */}
      {!isUnlocked && (
        canUnlock ? (
          <FarmButton
            label={`Débloquer ${node.emoji}`}
            onPress={() => onUnlock(node.id)}
            enabled={true}
            bg={branchColor}
            shadowColor={btnShadow}
            highlightColor={btnHighlight}
          />
        ) : (
          <Text style={styles.lockedLabel}>
            {prereqMissing
              ? `🔒 Nécessite niv. ${node.order - 1}`
              : reason ?? 'Ressources insuffisantes'}
          </Text>
        )
      )}
    </Animated.View>
  );
});

// ── BranchSection ──────────────────────────────────────────────────────────

function BranchSection({
  branch,
  nodes,
  inventory,
  unlockedTechs,
  onUnlock,
  colors,
}: {
  branch: VillageTechBranchId;
  nodes: VillageTechNode[];
  inventory: VillageInventory;
  unlockedTechs: string[];
  onUnlock: (techId: string) => void;
  colors: ReturnType<typeof useThemeColors>['colors'];
}) {
  const meta = BRANCH_META[branch];
  const unlockedCount = nodes.filter(n => unlockedTechs.includes(n.id)).length;

  return (
    <View style={styles.branchSection}>
      {/* En-tête branche */}
      <View style={styles.branchHeader}>
        <Text style={styles.branchEmoji}>{meta.emoji}</Text>
        <Text style={[styles.branchLabel, { color: Farm.brownText }]}>{meta.label}</Text>
        <View style={[styles.branchProgress, { backgroundColor: Farm.progressBg }]}>
          <View style={[
            styles.branchProgressFill,
            { backgroundColor: meta.color, width: `${(unlockedCount / nodes.length) * 100}%` },
          ]} />
        </View>
        <Text style={[styles.branchProgressText, { color: meta.color }]}>
          {unlockedCount}/{nodes.length}
        </Text>
      </View>

      {/* Noeuds de la branche */}
      {nodes.map(node => (
        <TechNodeCard
          key={node.id}
          node={node}
          inventory={inventory}
          unlockedTechs={unlockedTechs}
          branchColor={meta.color}
          onUnlock={onUnlock}
          colors={colors}
        />
      ))}
    </View>
  );
}

// ── VillageTechSheet — composant principal ─────────────────────────────────

export function VillageTechSheet({
  visible,
  inventory,
  unlockedTechs,
  onUnlock,
  onClose,
}: VillageTechSheetProps) {
  const { colors } = useThemeColors();

  // Grouper les noeuds par branche
  const nodesByBranch = useMemo(() => {
    const map: Record<VillageTechBranchId, VillageTechNode[]> = {
      production: [],
      atelier: [],
      harmonie: [],
    };
    for (const node of VILLAGE_TECH_TREE) {
      map[node.branch].push(node);
    }
    // Trier par order dans chaque branche
    for (const branch of BRANCH_ORDER) {
      map[branch].sort((a, b) => a.order - b.order);
    }
    return map;
  }, []);

  const totalUnlocked = unlockedTechs.length;
  const totalTechs = VILLAGE_TECH_TREE.length;

  const handleUnlock = useCallback(
    async (techId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const ok = await onUnlock(techId);
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Arbre Tech', 'Impossible de débloquer cette amélioration.');
      }
    },
    [onUnlock],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />

        {/* Wood frame outer */}
        <View style={styles.woodFrame}>
          {/* Wood frame inner */}
          <View style={styles.woodFrameInner}>
            {/* Awning at top */}
            <AwningStripes />

            {/* Parchment content area */}
            <View style={styles.parchment}>
              {/* Handle */}
              <View style={styles.handle} />

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text style={styles.title}>🏛️ Améliorations Village</Text>
                  <Text style={styles.headerSub}>
                    {totalUnlocked}/{totalTechs} débloquées
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Barre de progression globale */}
              <View style={styles.globalProgressContainer}>
                <View style={styles.globalProgressBg}>
                  <View style={[
                    styles.globalProgressFill,
                    {
                      width: `${totalTechs > 0 ? (totalUnlocked / totalTechs) * 100 : 0}%`,
                    },
                  ]} />
                  {/* Glossy overlay */}
                  <View style={styles.globalProgressGloss} />
                </View>
              </View>

              <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
              >
                {BRANCH_ORDER.map(branch => (
                  <BranchSection
                    key={branch}
                    branch={branch}
                    nodes={nodesByBranch[branch]}
                    inventory={inventory}
                    unlockedTechs={unlockedTechs}
                    onUnlock={handleUnlock}
                    colors={colors}
                  />
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  // ── Wood frame ────────────────────────────────────────────────────────────
  woodFrame: {
    backgroundColor: Farm.woodDark,
    padding: 5,
    borderRadius: Radius['2xl'],
    maxHeight: '88%',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing['4xl'],
    ...Shadows.xl,
  },
  woodFrameInner: {
    backgroundColor: Farm.woodLight,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    flexShrink: 1,
  },

  // ── Awning ────────────────────────────────────────────────────────────────
  awning: {
    overflow: 'hidden',
  },
  awningStripes: {
    flexDirection: 'row',
    height: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 0,
    elevation: 4,
  },
  awningStripe: {
    flex: 1,
  },
  awningScallops: {
    flexDirection: 'row',
    marginTop: -4,
    paddingHorizontal: 2,
  },
  awningScallopDot: {
    flex: 1,
    height: 8,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    backgroundColor: Farm.awningGreen,
    marginHorizontal: 1,
  },

  // ── Parchment area ────────────────────────────────────────────────────────
  parchment: {
    backgroundColor: Farm.parchment,
    flexShrink: 1,
    paddingBottom: Spacing['3xl'],
  },

  // ── Handle ────────────────────────────────────────────────────────────────
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Farm.woodHighlight,
    alignSelf: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
    gap: Spacing.xxs,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    textShadowColor: '#FFFFFF',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  headerSub: {
    fontSize: FontSize.label,
    color: Farm.brownTextSub,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Farm.woodDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Farm.parchment,
  },

  // ── Global progress bar ───────────────────────────────────────────────────
  globalProgressContainer: {
    marginHorizontal: Spacing['2xl'],
    marginBottom: Spacing.xl,
  },
  globalProgressBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Farm.progressBg,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
    overflow: 'hidden',
  },
  globalProgressFill: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366F1',
  },
  globalProgressGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 5,
  },

  // ── ScrollView content ────────────────────────────────────────────────────
  content: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: 100,
    gap: Spacing['3xl'],
  },

  // ── Branche ───────────────────────────────────────────────────────────────
  branchSection: {
    gap: Spacing.md,
  },
  branchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingLeft: Spacing.md,
    marginBottom: Spacing.md,
  },
  branchEmoji: {
    fontSize: FontSize.heading,
  },
  branchLabel: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    flex: 1,
  },
  branchProgress: {
    width: 60,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  branchProgressFill: {
    height: 4,
    borderRadius: 2,
  },
  branchProgressText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    minWidth: 28,
    textAlign: 'right',
  },

  // ── TechNodeCard ──────────────────────────────────────────────────────────
  nodeCard: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    padding: Spacing['2xl'],
    gap: Spacing.lg,
    marginLeft: Spacing['3xl'],
  },
  nodeConnector: {
    position: 'absolute',
    left: -Spacing['3xl'] + Spacing.lg,
    top: -Spacing.md,
    width: 2,
    height: Spacing.md + Spacing.lg,
  },
  nodeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.lg,
  },
  nodeEmojiContainer: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  nodeEmoji: {
    fontSize: FontSize.lg,
  },
  nodeInfo: {
    flex: 1,
    gap: Spacing.xxs,
  },
  nodeLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  nodeDesc: {
    fontSize: FontSize.label,
    lineHeight: 18,
  },
  unlockedBadge: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  unlockedBadgeText: {
    color: '#FFFFFF',
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
  },

  // ── Coût ──────────────────────────────────────────────────────────────────
  costRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  costPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  costEmoji: {
    fontSize: FontSize.sm,
  },
  costQty: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },

  // ── FarmButton 3D ─────────────────────────────────────────────────────────
  lockedLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Farm.brownTextSub,
    textAlign: 'center',
    paddingVertical: Spacing.md,
    fontStyle: 'italic',
  },
  farmBtnWrapper: {
    position: 'relative',
  },
  farmBtnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 5,
    borderRadius: Radius.md,
  },
  farmBtnBody: {
    borderRadius: Radius.md,
    marginBottom: 5,
    overflow: 'hidden',
  },
  farmBtnGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    zIndex: 1,
  },
  farmBtnPressable: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  farmBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
