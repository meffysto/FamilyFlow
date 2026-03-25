/**
 * EvolutionOverlay.tsx — Animation plein écran d'évolution de l'arbre
 *
 * Se déclenche quand le niveau atteint un seuil d'évolution de stade.
 * Morphing : ancien stade → flash lumineux → nouveau stade + confettis + haptics.
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Pressable, Modal } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  Easing,
  runOnJS,
  useReducedMotion,
} from 'react-native-reanimated';
import { hapticsEvolution } from '../../lib/mascot/haptics';
import { useTranslation } from 'react-i18next';

import { useThemeColors } from '../../contexts/ThemeContext';
import { TreeView } from './TreeView';
import { SPECIES_INFO, TREE_STAGES, type TreeSpecies, type TreeStage } from '../../lib/mascot/types';
import { FontSize, FontWeight } from '../../constants/typography';
import { Spacing, Radius } from '../../constants/spacing';

// ── Confettis feuilles ────────────────────────

const LEAF_COUNT = 30;
const LEAF_EMOJIS = ['🍃', '🌿', '☘️', '🍀', '✨', '⭐', '🌸', '🌺'];

interface LeafPiece {
  id: number;
  x: number;
  emoji: string;
  size: number;
  delay: number;
  rotation: number;
  drift: number;
}

function generateLeaves(screenW: number, species: TreeSpecies): LeafPiece[] {
  const sp = SPECIES_INFO[species];
  // Emojis adaptés à l'espèce
  const speciesEmojis: Record<TreeSpecies, string[]> = {
    cerisier: ['🌸', '🌸', '🌸', '✨', '💮', '🎀'],
    chene: ['🍃', '🍂', '🌿', '✨', '🍁', '🌰'],
    bambou: ['🍃', '🎋', '☘️', '✨', '🌿', '🍀'],
    oranger: ['🍊', '🍃', '🌿', '✨', '🍋', '🌼'],
    palmier: ['🌴', '🍃', '🥥', '✨', '🌺', '☀️'],
  };
  const emojis = speciesEmojis[species] || LEAF_EMOJIS;

  return Array.from({ length: LEAF_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * screenW,
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    size: 16 + Math.random() * 14,
    delay: Math.random() * 800,
    rotation: Math.random() * 360,
    drift: (Math.random() - 0.5) * 100,
  }));
}

function LeafItem({ piece, screenH }: { piece: LeafPiece; screenH: number }) {
  const translateY = useSharedValue(-40);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(piece.rotation);
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(piece.delay, withSpring(1, { damping: 4 }));
    translateY.value = withDelay(
      piece.delay,
      withTiming(screenH + 40, { duration: 2800 + Math.random() * 1000, easing: Easing.out(Easing.quad) }),
    );
    rotate.value = withDelay(
      piece.delay,
      withTiming(piece.rotation + 720 + Math.random() * 360, { duration: 3000 }),
    );
    opacity.value = withDelay(piece.delay + 2200, withTiming(0, { duration: 600 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: piece.drift },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text
      style={[
        { position: 'absolute', left: piece.x, top: -20, fontSize: piece.size },
        style,
      ]}
    >
      {piece.emoji}
    </Animated.Text>
  );
}

// ── Composant principal ───────────────────────

interface EvolutionOverlayProps {
  visible: boolean;
  species: TreeSpecies;
  fromStage: TreeStage;
  toStage: TreeStage;
  newLevel: number;
  profileName: string;
  profileAvatar: string;
  onDismiss: () => void;
}

export function EvolutionOverlay({
  visible,
  species,
  fromStage,
  toStage,
  newLevel,
  profileName,
  profileAvatar,
  onDismiss,
}: EvolutionOverlayProps) {
  const { t } = useTranslation();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { primary, colors } = useThemeColors();
  const reducedMotion = useReducedMotion();
  const leaves = useMemo(() => (visible ? generateLeaves(screenW, species) : []), [visible, screenW, species]);

  const sp = SPECIES_INFO[species];
  const fromInfo = TREE_STAGES.find((s) => s.stage === fromStage)!;
  const toInfo = TREE_STAGES.find((s) => s.stage === toStage)!;

  // Niveaux de référence pour afficher les bons arbres
  const fromLevel = fromInfo.maxLevel; // arbre ancien au max du stade
  const toLevel = toInfo.minLevel;     // arbre nouveau au début du stade

  // ── Animations séquencées ──
  const overlayOpacity = useSharedValue(0);
  const oldTreeScale = useSharedValue(1);
  const oldTreeOpacity = useSharedValue(1);
  const flashOpacity = useSharedValue(0);
  const newTreeScale = useSharedValue(0.3);
  const newTreeOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textScale = useSharedValue(0.8);
  const dismissOpacity = useSharedValue(0);

  const triggerHaptics = useCallback(() => {
    hapticsEvolution();
  }, []);

  useEffect(() => {
    if (!visible) return;

    // Séquence temporelle :
    // 0ms    — Fade in overlay + ancien arbre visible
    // 800ms  — Ancien arbre rétrécit + disparaît
    // 1200ms — Flash lumineux
    // 1500ms — Nouveau arbre apparaît avec spring bounce
    // 1800ms — Confettis feuilles + haptics
    // 2200ms — Texte félicitations
    // 3000ms — Bouton dismiss

    const dur = reducedMotion ? 100 : undefined;

    overlayOpacity.value = withTiming(1, { duration: dur ?? 400 });

    // Ancien arbre rétrécit
    oldTreeScale.value = withDelay(800, withTiming(0.5, { duration: dur ?? 400, easing: Easing.in(Easing.cubic) }));
    oldTreeOpacity.value = withDelay(800, withTiming(0, { duration: dur ?? 300 }));

    // Flash
    flashOpacity.value = withDelay(1100, withSequence(
      withTiming(0.9, { duration: dur ?? 200 }),
      withTiming(0, { duration: dur ?? 500 }),
    ));

    // Nouveau arbre
    newTreeOpacity.value = withDelay(1400, withTiming(1, { duration: dur ?? 300 }));
    newTreeScale.value = withDelay(1400, withSpring(1, { damping: 8, stiffness: 150 }));

    // Haptics au moment du nouveau arbre
    if (!reducedMotion) {
      setTimeout(() => runOnJS(triggerHaptics)(), 1500);
    }

    // Texte
    textOpacity.value = withDelay(2000, withTiming(1, { duration: dur ?? 400 }));
    textScale.value = withDelay(2000, withSpring(1, { damping: 10, stiffness: 200 }));

    // Dismiss
    dismissOpacity.value = withDelay(2800, withTiming(1, { duration: dur ?? 400 }));
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const oldTreeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: oldTreeScale.value }],
    opacity: oldTreeOpacity.value,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const newTreeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: newTreeScale.value }],
    opacity: newTreeOpacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ scale: textScale.value }],
  }));

  const dismissStyle = useAnimatedStyle(() => ({
    opacity: dismissOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible}>
      <Animated.View style={[styles.overlay, overlayStyle]}>
        {/* Fond sombre */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)' }]} />

        {/* Confettis feuilles */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {leaves.map((leaf) => (
            <LeafItem key={leaf.id} piece={leaf} screenH={screenH} />
          ))}
        </View>

        {/* Flash lumineux */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: sp.accent }, flashStyle]}
          pointerEvents="none"
        />

        {/* Contenu central */}
        <View style={styles.content}>
          {/* Ancien arbre (disparaît) */}
          <Animated.View style={[styles.treeWrap, oldTreeStyle]}>
            <TreeView species={species} level={fromLevel} size={180} showGround={false} interactive={false} />
          </Animated.View>

          {/* Nouveau arbre (apparaît avec spring) */}
          <Animated.View style={[styles.treeWrap, styles.newTreeWrap, newTreeStyle]}>
            <TreeView species={species} level={toLevel} size={220} showGround interactive />
          </Animated.View>

          {/* Texte de félicitations */}
          <Animated.View style={[styles.textContainer, textStyle]}>
            <Text style={styles.evoTitle}>
              {t('mascot.evolution.title')}
            </Text>
            <Text style={styles.evoEmoji}>{sp.emoji}</Text>
            <Text style={styles.evoMessage}>
              {t('mascot.evolution.message', {
                name: profileName,
                avatar: profileAvatar,
                stage: t(toInfo.labelKey),
              })}
            </Text>
            <Text style={[styles.evoLevel, { color: sp.accent }]}>
              {t('dashboard.loot.level', { level: newLevel })}
            </Text>
          </Animated.View>

          {/* Bouton fermer */}
          <Animated.View style={dismissStyle}>
            <Pressable
              style={[styles.dismissBtn, { backgroundColor: sp.accent }]}
              onPress={onDismiss}
            >
              <Text style={styles.dismissText}>
                {t('mascot.evolution.dismiss')}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  treeWrap: {
    position: 'absolute',
  },
  newTreeWrap: {
    position: 'relative',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: Spacing['2xl'],
  },
  evoTitle: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.heavy,
    color: '#FFD700',
    textAlign: 'center',
    textShadowColor: 'rgba(255,215,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  evoEmoji: {
    fontSize: 48,
    marginVertical: Spacing.lg,
  },
  evoMessage: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
    textAlign: 'center',
    marginHorizontal: Spacing['4xl'],
    lineHeight: 24,
  },
  evoLevel: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.md,
  },
  dismissBtn: {
    marginTop: Spacing['3xl'],
    paddingHorizontal: Spacing['4xl'],
    paddingVertical: Spacing.xl,
    borderRadius: Radius.full,
  },
  dismissText: {
    color: '#FFFFFF',
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
});
