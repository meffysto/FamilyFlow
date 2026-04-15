/**
 * TechTreeSheet.tsx — Arbre de technologies (bottom sheet)
 *
 * Affiche les 3 branches tech (Culture, Elevage, Expansion) avec noeuds
 * interactifs : debloque, debloquable, verrouille. Confirmation par Alert.
 * Thème : cozy farm game (Wood frame + AwningStripes + Parchment).
 */

import React, { useMemo, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
  FadeInDown,
  FadeOutUp,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { useThemeColors } from '../../contexts/ThemeContext';
import {
  TECH_TREE,
  canUnlockTech,
  type TechNode,
  type TechBranchId,
} from '../../lib/mascot/tech-engine';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm } from '../../constants/farm-theme';

// ── Constantes animation ──────────────────────────────────────────────────

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

// ── Types ─────────────────────────────────────────────────────────────────

interface TechTreeSheetProps {
  visible: boolean;
  onClose: () => void;
  profileId: string;
  unlockedTechs: string[];
  coins: number;
  onUnlock: (techId: string) => Promise<boolean>;
  onMessage?: (text: string, type?: 'success' | 'error') => void;
}

type NodeStatus = 'unlocked' | 'unlockable' | 'locked';

// ── Branch config ─────────────────────────────────────────────────────────

const BRANCHES: { id: TechBranchId; labelKey: string; emoji: string; color: string }[] = [
  { id: 'culture',   labelKey: 'tech.branch_culture',   emoji: '🌱', color: '#10B981' },
  { id: 'elevage',   labelKey: 'tech.branch_elevage',   emoji: '🐄', color: '#F59E0B' },
  { id: 'expansion', labelKey: 'tech.branch_expansion', emoji: '🏗️', color: '#6366F1' },
];

// ── AwningStripes ─────────────────────────────────────────────────────────

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

// ── FarmButton (3D, dynamic color) ────────────────────────────────────────

function FarmButton({
  label,
  onPress,
  bg,
  shadowColor,
  highlightColor,
}: {
  label: string;
  onPress: () => void;
  bg: string;
  shadowColor: string;
  highlightColor: string;
}) {
  const pressed = useSharedValue(0);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withSpring(pressed.value ? 4 : 0, SPRING_CONFIG) }],
  }));

  const resolvedGloss = highlightColor + '66';

  return (
    <View style={styles.farmBtnWrapper}>
      {/* Shadow layer */}
      <View style={[styles.farmBtnShadow, { backgroundColor: shadowColor }]} />
      {/* Body layer */}
      <Animated.View style={[styles.farmBtnBody, { backgroundColor: bg }, bodyStyle]}>
        {/* Gloss overlay (top 40%) */}
        <View style={[styles.farmBtnGloss, { backgroundColor: resolvedGloss }]} />
        <Pressable
          onPressIn={() => {
            pressed.value = 1;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          onPressOut={() => { pressed.value = 0; }}
          onPress={onPress}
          style={styles.farmBtnPressable}
        >
          <Text style={styles.farmBtnText}>{label}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ── Noeud individuel ──────────────────────────────────────────────────────

const TechNodeView = React.memo(function TechNodeView({
  node,
  status,
  isLast,
  branchColor,
  coins,
  unlockedTechs,
  onPress,
}: {
  node: TechNode;
  status: NodeStatus;
  isLast: boolean;
  branchColor: string;
  coins: number;
  unlockedTechs: string[];
  onPress: () => void;
}) {
  const { t } = useTranslation();

  // Prérequis non débloqué
  const prereqMissing = !!node.requires && !unlockedTechs.includes(node.requires);
  const canUnlockResult = useMemo(
    () => canUnlockTech(node.id, unlockedTechs, coins),
    [node.id, unlockedTechs, coins],
  );

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

  const borderColor = status === 'unlocked'
    ? branchColor
    : status === 'unlockable'
      ? branchColor + '66'
      : Farm.woodHighlight;

  const bgColor = status === 'unlocked'
    ? branchColor + '22'
    : Farm.parchmentDark;

  const btnShadow = branchColor + 'CC';
  const btnHighlight = branchColor + '88';

  return (
    <View style={styles.nodeWrapper}>
      <Animated.View
        entering={FadeIn}
        style={[styles.nodeCard, { backgroundColor: bgColor, borderColor }]}
      >
        {/* Connecteur vertical (sauf premier) */}
        {node.order > 1 && (
          <View style={[
            styles.nodeConnector,
            { backgroundColor: status === 'unlocked' ? branchColor : Farm.woodHighlight },
          ]} />
        )}

        {/* Header noeud */}
        <View style={styles.nodeHeader}>
          <Animated.View style={status === 'unlockable' ? pulseStyle : undefined}>
            <View style={[
              styles.nodeEmojiContainer,
              { backgroundColor: status === 'unlocked' ? branchColor : Farm.woodHighlight },
            ]}>
              <Text style={styles.nodeEmoji}>
                {status === 'unlocked' ? '✅' : node.emoji}
              </Text>
            </View>
          </Animated.View>

          <View style={styles.nodeInfo}>
            <Text style={styles.nodeName} numberOfLines={2}>
              {t(node.labelKey)}
            </Text>
            <Text style={styles.nodeDesc}>
              {t(node.descriptionKey)}
            </Text>
          </View>

          {status === 'unlocked' && (
            <View style={[styles.unlockedBadge, { backgroundColor: branchColor }]}>
              <Text style={styles.unlockedBadgeText}>{'✓'}</Text>
            </View>
          )}
        </View>

        {/* Cout */}
        {status !== 'unlocked' && (
          <View style={styles.costRow}>
            <View style={[
              styles.costPill,
              { backgroundColor: coins >= node.cost ? '#10B98122' : '#EF444422' },
            ]}>
              <Text style={[
                styles.costQty,
                { color: coins >= node.cost ? '#10B981' : '#EF4444' },
              ]}>
                {node.cost} 🍃
              </Text>
            </View>
          </View>
        )}

        {/* Prerequis */}
        {status === 'locked' && node.requires && prereqMissing && (
          <Text style={styles.nodeRequires} numberOfLines={1}>
            {(() => {
              const reqNode = TECH_TREE.find(n => n.id === node.requires);
              return reqNode ? t('tech.requires', { name: t(reqNode.labelKey) }) : '';
            })()}
          </Text>
        )}

        {/* Bouton deblocage ou label verrouille */}
        {status !== 'unlocked' && (
          status === 'unlockable' ? (
            <FarmButton
              label={`${t('tech.unlock')} ${node.emoji}`}
              onPress={onPress}
              bg={branchColor}
              shadowColor={btnShadow}
              highlightColor={btnHighlight}
            />
          ) : (
            prereqMissing ? (
              <Text style={styles.lockedLabel}>
                {`🔒 ${t('tech.requires', { name: '' })}`.trim()}
              </Text>
            ) : null
          )
        )}
      </Animated.View>

      {/* Ligne de connexion vers le noeud suivant */}
      {!isLast && (
        <View style={[
          styles.connectorLine,
          { backgroundColor: status === 'unlocked' ? branchColor : Farm.woodHighlight },
        ]} />
      )}
    </View>
  );
});

// ── Composant principal ───────────────────────────────────────────────────

export function TechTreeSheet({
  visible,
  onClose,
  profileId,
  unlockedTechs,
  coins,
  onUnlock,
  onMessage,
}: TechTreeSheetProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [feedback, setFeedback] = useState<{ emoji: string; text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<TechBranchId>(BRANCHES[0].id);

  const showFeedback = useCallback((emoji: string, text: string, type: 'success' | 'info' | 'error' = 'info') => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback({ emoji, text, type });
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3500);
  }, []);

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
    for (const branch of Object.keys(map) as TechBranchId[]) {
      map[branch].sort((a, b) => a.order - b.order);
    }
    return map;
  }, []);

  // Statut de chaque noeud
  const getNodeStatus = useCallback(
    (node: TechNode): NodeStatus => {
      if (unlockedTechs.includes(node.id)) return 'unlocked';
      const result = canUnlockTech(node.id, unlockedTechs, coins);
      return result.canUnlock ? 'unlockable' : 'locked';
    },
    [unlockedTechs, coins],
  );

  // Progression globale
  const totalUnlocked = unlockedTechs.length;
  const totalTechs = TECH_TREE.length;

  // Noeuds filtrés par branche sélectionnée
  const activeBranch = useMemo(
    () => BRANCHES.find(b => b.id === selectedBranch)!,
    [selectedBranch],
  );
  const activeNodes = branchNodes[selectedBranch];

  // Handler tap noeud
  const handleNodePress = useCallback(
    (node: TechNode) => {
      const status = getNodeStatus(node);

      if (status === 'unlocked') {
        showFeedback(node.emoji, t(node.descriptionKey), 'info');
        return;
      }

      if (status === 'locked') {
        const result = canUnlockTech(node.id, unlockedTechs, coins);
        if (result.reason) {
          const reqNode = node.requires ? TECH_TREE.find(n => n.id === node.requires) : null;
          const msg = reqNode
            ? t('tech.requires', { name: t(reqNode.labelKey) })
            : result.reason;
          showFeedback('🔒', msg, 'error');
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
                showFeedback(node.emoji, `${t(node.labelKey)} — ${t(node.descriptionKey)}`, 'success');
              } else {
                showFeedback('❌', t('tech.not_enough_coins'), 'error');
              }
            },
          },
        ],
      );
    },
    [getNodeStatus, unlockedTechs, coins, onUnlock, onMessage, t],
  );

  const handleChipPress = useCallback((branchId: TechBranchId) => {
    Haptics.selectionAsync();
    setSelectedBranch(branchId);
  }, []);

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
            {/* Close button */}
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.closeBtnText}>{'✕'}</Text>
            </TouchableOpacity>

            {/* Awning at top */}
            <AwningStripes />

            {/* Parchment content area */}
            <View style={styles.parchment}>
              {/* Handle */}
              <View style={styles.handle} />

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text style={styles.title}>{'🔬 ' + t('tech.title')}</Text>
                  <Text style={styles.headerSub}>
                    {totalUnlocked}/{totalTechs} {t('tech.unlocked')}  ·  {coins} 🍃
                  </Text>
                </View>
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

              {/* Chips de branche */}
              <View style={styles.chipsRow}>
                {BRANCHES.map((branch) => {
                  const isActive = branch.id === selectedBranch;
                  const nodes = branchNodes[branch.id];
                  const unlockedCount = nodes.filter(n => unlockedTechs.includes(n.id)).length;

                  return (
                    <Pressable
                      key={branch.id}
                      onPress={() => handleChipPress(branch.id)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isActive ? branch.color : Farm.parchmentDark,
                          borderColor: isActive ? branch.color : Farm.woodHighlight,
                        },
                      ]}
                    >
                      <Text style={styles.chipEmoji}>{branch.emoji}</Text>
                      <Text style={[
                        styles.chipLabel,
                        { color: isActive ? '#FFFFFF' : Farm.brownText },
                      ]}>
                        {t(branch.labelKey)}
                      </Text>
                      <Text style={[
                        styles.chipBadgeText,
                        { color: isActive ? 'rgba(255,255,255,0.7)' : branch.color },
                      ]}>
                        {unlockedCount}/{nodes.length}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Bandeau feedback inline */}
              {feedback && (
                <Animated.View
                  entering={FadeInDown.duration(250)}
                  exiting={FadeOutUp.duration(200)}
                  style={[
                    styles.feedbackBanner,
                    {
                      backgroundColor: feedback.type === 'success' ? '#4ADE80'
                        : feedback.type === 'error' ? '#FCA5A5'
                        : Farm.parchmentDark,
                    },
                  ]}
                >
                  <Text style={styles.feedbackEmoji}>{feedback.emoji}</Text>
                  <Text
                    style={[
                      styles.feedbackText,
                      {
                        color: feedback.type === 'success' ? '#065F46'
                          : feedback.type === 'error' ? '#7F1D1D'
                          : Farm.brownText,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {feedback.text}
                  </Text>
                </Animated.View>
              )}

              {/* Liste des noeuds de la branche active */}
              <ScrollView
                style={styles.nodeList}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
              >
                {activeNodes.map((node, idx) => (
                  <TechNodeView
                    key={node.id}
                    node={node}
                    status={getNodeStatus(node)}
                    isLast={idx === activeNodes.length - 1}
                    branchColor={activeBranch.color}
                    coins={coins}
                    unlockedTechs={unlockedTechs}
                    onPress={() => handleNodePress(node)}
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

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  // ── Wood frame ─────────────────────────────────────────────────────────
  woodFrame: {
    backgroundColor: Farm.woodDark,
    padding: 5,
    borderRadius: Radius['2xl'],
    maxHeight: '88%',
    minHeight: '88%',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing['4xl'],
    ...Shadows.xl,
  },
  woodFrameInner: {
    backgroundColor: Farm.parchmentDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    flex: 1,
  },

  // ── Close button (absolute on woodFrameInner) ──────────────────────────
  closeBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Farm.woodDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Farm.parchment,
  },

  // ── Awning ─────────────────────────────────────────────────────────────
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

  // ── Parchment area ─────────────────────────────────────────────────────
  parchment: {
    backgroundColor: Farm.parchmentDark,
    flex: 1,
    paddingBottom: Spacing['3xl'],
  },

  // ── Handle ─────────────────────────────────────────────────────────────
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Farm.woodHighlight,
    alignSelf: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },

  // ── Header ─────────────────────────────────────────────────────────────
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
    marginRight: 40,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  headerSub: {
    fontSize: FontSize.label,
    color: Farm.brownTextSub,
  },
  coinsDisplay: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Farm.brownText,
    marginLeft: Spacing.md,
  },

  // ── Global progress bar ────────────────────────────────────────────────
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

  // ── Feedback banner ────────────────────────────────────────────────────
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing['2xl'],
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  feedbackEmoji: {
    fontSize: 20,
  },
  feedbackText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },

  // ── Chips row ──────────────────────────────────────────────────────────
  chipsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 28,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipEmoji: {
    fontSize: 12,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
  },
  chipBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },

  // ── ScrollView content ─────────────────────────────────────────────────
  nodeList: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: 100,
  },

  // ── Node wrapper + connector line ──────────────────────────────────────
  nodeWrapper: {
    alignItems: 'center',
  },
  connectorLine: {
    width: 2,
    height: Spacing.md,
    marginVertical: 2,
  },

  // ── TechNodeCard ───────────────────────────────────────────────────────
  nodeCard: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    padding: Spacing.md,
    gap: Spacing.sm,
    width: '100%',
    position: 'relative',
  },
  nodeConnector: {
    position: 'absolute',
    left: '50%',
    top: -Spacing.md,
    width: 2,
    height: Spacing.md,
    marginLeft: -1,
  },
  nodeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
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
    fontSize: FontSize.body,
  },
  nodeInfo: {
    flex: 1,
    gap: Spacing.xxs,
  },
  nodeName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Farm.brownText,
    lineHeight: 18,
  },
  nodeDesc: {
    fontSize: FontSize.caption,
    color: Farm.brownTextSub,
    lineHeight: 16,
  },
  unlockedBadge: {
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  unlockedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },

  // ── Cost ───────────────────────────────────────────────────────────────
  costRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  costPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  costQty: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  nodeRequires: {
    fontSize: FontSize.micro,
    color: Farm.brownTextSub,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // ── Locked label ───────────────────────────────────────────────────────
  lockedLabel: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
    color: Farm.brownTextSub,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    fontStyle: 'italic',
  },

  // ── FarmButton 3D ──────────────────────────────────────────────────────
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
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  farmBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
});
