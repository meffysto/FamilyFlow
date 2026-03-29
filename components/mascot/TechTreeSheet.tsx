/**
 * TechTreeSheet.tsx — Arbre de technologies (bottom sheet)
 *
 * Affiche les 3 branches tech (Culture, Elevage, Expansion) avec noeuds
 * interactifs : debloque, debloquable, verrouille. Confirmation par Alert.
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import {
  TECH_TREE,
  canUnlockTech,
  type TechNode,
  type TechBranchId,
} from '../../lib/mascot/tech-engine';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

// ── Types ──────────────────────────────────────

interface TechTreeSheetProps {
  visible: boolean;
  onClose: () => void;
  profileId: string;
  unlockedTechs: string[];
  coins: number;
  onUnlock: (techId: string) => Promise<boolean>;
}

type NodeStatus = 'unlocked' | 'unlockable' | 'locked';

// ── Branch config ──────────────────────────────

const BRANCHES: { id: TechBranchId; labelKey: string; emoji: string }[] = [
  { id: 'culture', labelKey: 'tech.branch_culture', emoji: '🌱' },
  { id: 'elevage', labelKey: 'tech.branch_elevage', emoji: '🐄' },
  { id: 'expansion', labelKey: 'tech.branch_expansion', emoji: '🏗️' },
];

// ── Noeud individuel ───────────────────────────

function TechNodeView({
  node,
  status,
  isLast,
  coins,
  unlockedTechs,
  onPress,
}: {
  node: TechNode;
  status: NodeStatus;
  isLast: boolean;
  coins: number;
  unlockedTechs: string[];
  onPress: () => void;
}) {
  const { primary, tint, colors } = useThemeColors();
  const { t } = useTranslation();

  // Pulsation pour noeuds debloquables
  const pulseOpacity = useSharedValue(1);
  React.useEffect(() => {
    if (status === 'unlockable') {
      pulseOpacity.value = withRepeat(
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      pulseOpacity.value = 1;
    }
  }, [status]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const bgColor =
    status === 'unlocked' ? primary :
    status === 'unlockable' ? tint :
    colors.cardAlt;

  const borderColor =
    status === 'unlocked' ? primary :
    status === 'unlockable' ? primary :
    colors.borderLight;

  const emojiOpacity = status === 'locked' ? 0.4 : 1;

  return (
    <View style={styles.nodeWrapper}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.nodeHitArea}
      >
        <Animated.View style={status === 'unlockable' ? pulseStyle : undefined}>
          <View
            style={[
              styles.nodeCircle,
              { backgroundColor: bgColor, borderColor },
              status === 'locked' && { opacity: 0.5 },
            ]}
          >
            <Text style={[styles.nodeEmoji, { opacity: emojiOpacity }]}>
              {node.emoji}
            </Text>
            {status === 'unlocked' && (
              <View style={styles.checkOverlay}>
                <Text style={styles.checkText}>{'✓'}</Text>
              </View>
            )}
            {status === 'locked' && (
              <View style={styles.lockOverlay}>
                <Text style={styles.lockText}>{'🔒'}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Nom du noeud */}
        <Text
          style={[
            styles.nodeName,
            { color: status === 'locked' ? colors.textMuted : colors.text },
          ]}
          numberOfLines={2}
        >
          {t(node.labelKey)}
        </Text>

        {/* Cout ou statut */}
        {status === 'unlockable' && (
          <Text style={[styles.nodeCost, { color: primary }]}>
            {node.cost} 🍃
          </Text>
        )}
        {status === 'locked' && node.requires && (
          <Text style={[styles.nodeRequires, { color: colors.textMuted }]} numberOfLines={1}>
            {(() => {
              const reqNode = TECH_TREE.find(n => n.id === node.requires);
              return reqNode ? t('tech.requires', { name: t(reqNode.labelKey) }) : '';
            })()}
          </Text>
        )}
        {status === 'unlocked' && (
          <Text style={[styles.nodeStatus, { color: colors.success }]}>
            {t('tech.unlocked')}
          </Text>
        )}
      </TouchableOpacity>

      {/* Ligne de connexion vers le noeud suivant */}
      {!isLast && (
        <View style={[styles.connectorLine, { backgroundColor: colors.borderLight }]} />
      )}
    </View>
  );
}

// ── Composant principal ──────────────────────────

export function TechTreeSheet({
  visible,
  onClose,
  profileId,
  unlockedTechs,
  coins,
  onUnlock,
}: TechTreeSheetProps) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();

  // Grouper les noeuds par branche
  const branchNodes = useMemo(() => {
    const map: Record<TechBranchId, TechNode[]> = {
      culture: [],
      elevage: [],
      expansion: [],
    };
    for (const node of TECH_TREE) {
      map[node.branch].push(node);
    }
    // Trier par order
    for (const branch of Object.keys(map) as TechBranchId[]) {
      map[branch].sort((a, b) => a.order - b.order);
    }
    return map;
  }, []);

  // Determiner le statut de chaque noeud
  const getNodeStatus = useCallback(
    (node: TechNode): NodeStatus => {
      if (unlockedTechs.includes(node.id)) return 'unlocked';
      const result = canUnlockTech(node.id, unlockedTechs, coins);
      return result.canUnlock ? 'unlockable' : 'locked';
    },
    [unlockedTechs, coins],
  );

  // Handler tap noeud
  const handleNodePress = useCallback(
    (node: TechNode) => {
      const status = getNodeStatus(node);

      if (status === 'unlocked') {
        showToast(`${node.emoji} ${t('tech.unlocked')}`);
        return;
      }

      if (status === 'locked') {
        const result = canUnlockTech(node.id, unlockedTechs, coins);
        if (result.reason) {
          // Traduire la raison si c'est un prerequis
          const reqNode = node.requires ? TECH_TREE.find(n => n.id === node.requires) : null;
          const msg = reqNode
            ? t('tech.requires', { name: t(reqNode.labelKey) })
            : result.reason;
          showToast(`🔒 ${msg}`);
        }
        return;
      }

      // Debloquable : confirmation par Alert
      Alert.alert(
        t('tech.confirm_title', { name: t(node.labelKey) }),
        t('tech.confirm_message', {
          cost: node.cost,
          effect: t(node.descriptionKey),
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('tech.unlock'),
            style: 'default',
            onPress: async () => {
              const success = await onUnlock(node.id);
              if (success) {
                if (Platform.OS !== 'web') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                showToast(`${node.emoji} ${t(node.labelKey)} ${t('tech.unlocked')} !`);
              } else {
                showToast(t('tech.not_enough_coins'), 'error');
              }
            },
          },
        ],
      );
    },
    [getNodeStatus, unlockedTechs, coins, onUnlock, showToast, t],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, { color: primary }]}>{'←'}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            {'🔬 ' + t('tech.title')}
          </Text>
          <View style={styles.closeBtn} />
        </View>

        {/* Points */}
        <View style={[styles.pointsBar, { backgroundColor: tint }]}>
          <Text style={[styles.pointsText, { color: primary }]}>
            {coins} 🍃
          </Text>
        </View>

        {/* 3 branches cote a cote */}
        <ScrollView
          contentContainerStyle={styles.branchesContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.branchesRow}>
            {BRANCHES.map((branch, branchIdx) => (
              <Animated.View
                key={branch.id}
                entering={FadeInDown.delay(branchIdx * 100).duration(300)}
                style={styles.branchColumn}
              >
                {/* Titre branche */}
                <View style={[styles.branchHeader, { backgroundColor: tint, borderColor: colors.borderLight }]}>
                  <Text style={[styles.branchEmoji]}>{branch.emoji}</Text>
                  <Text style={[styles.branchTitle, { color: colors.text }]}>
                    {t(branch.labelKey)}
                  </Text>
                </View>

                {/* Noeuds */}
                {branchNodes[branch.id].map((node, idx) => (
                  <TechNodeView
                    key={node.id}
                    node={node}
                    status={getNodeStatus(node)}
                    isLast={idx === branchNodes[branch.id].length - 1}
                    coins={coins}
                    unlockedTechs={unlockedTechs}
                    onPress={() => handleNodePress(node)}
                  />
                ))}
              </Animated.View>
            ))}
          </View>
          <View style={{ height: Spacing['3xl'] }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────

const NODE_SIZE = 56;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
  },
  title: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
  },
  pointsBar: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  pointsText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  branchesContainer: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.lg,
  },
  branchesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  branchColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.xxs,
  },
  branchHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.lg,
    width: '100%',
  },
  branchEmoji: {
    fontSize: 20,
    marginBottom: Spacing.xxs,
  },
  branchTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  nodeWrapper: {
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  nodeHitArea: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  nodeCircle: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeEmoji: {
    fontSize: 22,
  },
  checkOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: FontWeight.bold,
  },
  lockOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  lockText: {
    fontSize: 14,
  },
  nodeName: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    marginTop: Spacing.xxs,
    width: 80,
  },
  nodeCost: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.xxs,
  },
  nodeRequires: {
    fontSize: FontSize.micro,
    textAlign: 'center',
    marginTop: Spacing.xxs,
    width: 80,
  },
  nodeStatus: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.xxs,
  },
  connectorLine: {
    width: 2,
    height: Spacing.lg,
    marginVertical: Spacing.xxs,
  },
});
