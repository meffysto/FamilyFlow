// components/village/VillageTechSheet.tsx
// Modal Arbre Tech Village — 3 branches : Production / Atelier / Harmonie
// Permet de débloquer les noeuds tech en dépensant des items de l'inventaire.

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
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
      : colors.borderLight;

  const bgColor = isUnlocked
    ? branchColor + '22'
    : colors.cardAlt;

  return (
    <View style={[styles.nodeCard, { backgroundColor: bgColor, borderColor }]}>
      {/* Connecteur vertical entre noeuds (sauf premier) */}
      {node.order > 1 && (
        <View style={[styles.nodeConnector, { backgroundColor: isUnlocked ? branchColor : colors.borderLight }]} />
      )}

      {/* Header noeud */}
      <View style={styles.nodeHeader}>
        <View style={[styles.nodeEmojiContainer, { backgroundColor: isUnlocked ? branchColor : colors.borderLight }]}>
          <Text style={styles.nodeEmoji}>{isUnlocked ? '✅' : node.emoji}</Text>
        </View>
        <View style={styles.nodeInfo}>
          <Text style={[styles.nodeLabel, { color: colors.text }]}>{node.labelFR}</Text>
          <Text style={[styles.nodeDesc, { color: colors.textMuted }]} numberOfLines={2}>
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

      {/* Bouton déblocage */}
      {!isUnlocked && (
        <TouchableOpacity
          onPress={canUnlock ? () => onUnlock(node.id) : undefined}
          activeOpacity={canUnlock ? 0.7 : 1}
          style={[
            styles.unlockBtn,
            { backgroundColor: canUnlock ? branchColor : colors.borderLight },
          ]}
        >
          <Text style={[
            styles.unlockBtnText,
            { color: canUnlock ? '#FFFFFF' : colors.textMuted },
          ]}>
            {prereqMissing
              ? `🔒 Nécessite niv. ${node.order - 1}`
              : canUnlock
                ? `Débloquer ${node.emoji}`
                : reason ?? 'Ressources insuffisantes'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
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
      <View style={[styles.branchHeader, { borderLeftColor: meta.color }]}>
        <Text style={styles.branchEmoji}>{meta.emoji}</Text>
        <Text style={[styles.branchLabel, { color: colors.text }]}>{meta.label}</Text>
        <View style={[styles.branchProgress, { backgroundColor: colors.borderLight }]}>
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
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.borderLight }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.title, { color: colors.text }]}>🏛️ Améliorations Village</Text>
              <Text style={[styles.headerSub, { color: colors.textMuted }]}>
                {totalUnlocked}/{totalTechs} débloquées
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={[styles.closeBtnText, { color: colors.textSub }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Barre de progression globale */}
          <View style={[styles.globalProgressContainer, { marginHorizontal: Spacing['2xl'] }]}>
            <View style={[styles.globalProgressBg, { backgroundColor: colors.borderLight }]}>
              <View style={[
                styles.globalProgressFill,
                {
                  backgroundColor: '#6366F1',
                  width: `${totalTechs > 0 ? (totalUnlocked / totalTechs) * 100 : 0}%`,
                },
              ]} />
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
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '88%',
    ...Shadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
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
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  headerSub: {
    fontSize: FontSize.label,
  },
  closeBtn: {
    padding: Spacing.md,
  },
  closeBtnText: {
    fontSize: FontSize.lg,
  },
  globalProgressContainer: {
    marginBottom: Spacing.xl,
  },
  globalProgressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  globalProgressFill: {
    height: 6,
    borderRadius: 3,
  },
  content: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['6xl'],
    gap: Spacing['3xl'],
  },
  // Branche
  branchSection: {
    gap: Spacing.md,
  },
  branchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderLeftWidth: 3,
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
  // TechNodeCard
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
  // Coût
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
  // Bouton déblocage
  unlockBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  unlockBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
