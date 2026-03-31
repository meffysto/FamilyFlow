/**
 * CompanionSlot.tsx — Composant animé du compagnon dans la scène arbre
 *
 * Affiche le compagnon pixel art à une position fixe dans la scène,
 * avec animation idle (frame swap), tap (saut + haptic) et bulles de message.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Image, Pressable, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { FontSize, FontWeight } from '../../constants/typography';
import { Spacing, Radius } from '../../constants/spacing';
import type { CompanionSpecies, CompanionStage, CompanionMood } from '../../lib/mascot/companion-types';

// ── Constantes géométrie ──────────────────────────────

/** Taille du sprite du compagnon (logical pixels) */
const COMPANION_SIZE = 32;

/**
 * Points d'intérêt en coordonnées fractionnelles (0-1) du container diorama.
 * Basés sur les positions réelles de WorldGridView (world-grid.ts).
 */
const WAYPOINTS = [
  { fx: 0.20, fy: 0.72, label: 'home' },        // position de repos (gauche de l'arbre)
  { fx: 0.28, fy: 0.08, label: 'crops-r1-c1' },  // culture rangée 1
  { fx: 0.42, fy: 0.08, label: 'crops-r1-c2' },  // culture rangée 1 centre
  { fx: 0.56, fy: 0.08, label: 'crops-r1-c3' },  // culture rangée 1 droite
  { fx: 0.28, fy: 0.20, label: 'crops-r2-c1' },  // culture rangée 2
  { fx: 0.56, fy: 0.20, label: 'crops-r2-c3' },  // culture rangée 2 droite
  { fx: 0.42, fy: 0.32, label: 'crops-r3' },      // culture rangée 3 centre
  { fx: 0.82, fy: 0.45, label: 'building-1' },    // bâtiment 1 (x=0.86)
  { fx: 0.82, fy: 0.60, label: 'building-2' },    // bâtiment 2
  { fx: 0.50, fy: 0.75, label: 'tree' },           // au pied de l'arbre
  { fx: 0.10, fy: 0.50, label: 'left-field' },    // côté gauche
  { fx: 0.35, fy: 0.50, label: 'center' },        // centre de la scène
];

const HOME_IDX = 0;

// ── Sprites Mana Seed ─────────────────────────────────

const COMPANION_SPRITES: Record<CompanionSpecies, Record<CompanionStage, { idle_1: any; idle_2: any }>> = {
  chat: {
    bebe:   { idle_1: require('../../assets/garden/animals/chat/bebe/idle_1.png'),   idle_2: require('../../assets/garden/animals/chat/bebe/idle_2.png') },
    jeune:  { idle_1: require('../../assets/garden/animals/chat/jeune/idle_1.png'),  idle_2: require('../../assets/garden/animals/chat/jeune/idle_2.png') },
    adulte: { idle_1: require('../../assets/garden/animals/chat/adulte/idle_1.png'), idle_2: require('../../assets/garden/animals/chat/adulte/idle_2.png') },
  },
  chien: {
    bebe:   { idle_1: require('../../assets/garden/animals/chien/bebe/idle_1.png'),   idle_2: require('../../assets/garden/animals/chien/bebe/idle_2.png') },
    jeune:  { idle_1: require('../../assets/garden/animals/chien/jeune/idle_1.png'),  idle_2: require('../../assets/garden/animals/chien/jeune/idle_2.png') },
    adulte: { idle_1: require('../../assets/garden/animals/chien/adulte/idle_1.png'), idle_2: require('../../assets/garden/animals/chien/adulte/idle_2.png') },
  },
  lapin: {
    bebe:   { idle_1: require('../../assets/garden/animals/lapin/bebe/idle_1.png'),   idle_2: require('../../assets/garden/animals/lapin/bebe/idle_2.png') },
    jeune:  { idle_1: require('../../assets/garden/animals/lapin/jeune/idle_1.png'),  idle_2: require('../../assets/garden/animals/lapin/jeune/idle_2.png') },
    adulte: { idle_1: require('../../assets/garden/animals/lapin/adulte/idle_1.png'), idle_2: require('../../assets/garden/animals/lapin/adulte/idle_2.png') },
  },
  renard: {
    bebe:   { idle_1: require('../../assets/garden/animals/renard/bebe/idle_1.png'),   idle_2: require('../../assets/garden/animals/renard/bebe/idle_2.png') },
    jeune:  { idle_1: require('../../assets/garden/animals/renard/jeune/idle_1.png'),  idle_2: require('../../assets/garden/animals/renard/jeune/idle_2.png') },
    adulte: { idle_1: require('../../assets/garden/animals/renard/adulte/idle_1.png'), idle_2: require('../../assets/garden/animals/renard/adulte/idle_2.png') },
  },
  herisson: {
    bebe:   { idle_1: require('../../assets/garden/animals/herisson/bebe/idle_1.png'),   idle_2: require('../../assets/garden/animals/herisson/bebe/idle_2.png') },
    jeune:  { idle_1: require('../../assets/garden/animals/herisson/jeune/idle_1.png'),  idle_2: require('../../assets/garden/animals/herisson/jeune/idle_2.png') },
    adulte: { idle_1: require('../../assets/garden/animals/herisson/adulte/idle_1.png'), idle_2: require('../../assets/garden/animals/herisson/adulte/idle_2.png') },
  },
};

// ── Walk sprites (4 frames par direction) ────────────
// Pour l'instant seul le lapin bébé a des vrais sprites de marche.
// Les autres espèces/stades fallback sur idle frame swap.

const COMPANION_WALK_DOWN: Partial<Record<CompanionSpecies, Partial<Record<CompanionStage, any[]>>>> = {
  chat: {
    bebe: [
      require('../../assets/garden/animals/chat/bebe/walk_down_1.png'),
      require('../../assets/garden/animals/chat/bebe/walk_down_2.png'),
      require('../../assets/garden/animals/chat/bebe/walk_down_3.png'),
      require('../../assets/garden/animals/chat/bebe/walk_down_4.png'),
      require('../../assets/garden/animals/chat/bebe/walk_down_5.png'),
      require('../../assets/garden/animals/chat/bebe/walk_down_6.png'),
    ],
  },
  chien: {
    bebe: [
      require('../../assets/garden/animals/chien/bebe/walk_down_1.png'),
      require('../../assets/garden/animals/chien/bebe/walk_down_2.png'),
      require('../../assets/garden/animals/chien/bebe/walk_down_3.png'),
      require('../../assets/garden/animals/chien/bebe/walk_down_4.png'),
      require('../../assets/garden/animals/chien/bebe/walk_down_5.png'),
      require('../../assets/garden/animals/chien/bebe/walk_down_6.png'),
    ],
  },
  lapin: {
    bebe: [
      require('../../assets/garden/animals/lapin/bebe/walk_down_1.png'),
      require('../../assets/garden/animals/lapin/bebe/walk_down_2.png'),
      require('../../assets/garden/animals/lapin/bebe/walk_down_3.png'),
      require('../../assets/garden/animals/lapin/bebe/walk_down_4.png'),
      require('../../assets/garden/animals/lapin/bebe/walk_down_5.png'),
      require('../../assets/garden/animals/lapin/bebe/walk_down_6.png'),
    ],
  },
};

const COMPANION_WALK_UP: Partial<Record<CompanionSpecies, Partial<Record<CompanionStage, any[]>>>> = {
  chat: {
    bebe: [
      require('../../assets/garden/animals/chat/bebe/walk_up_1.png'),
      require('../../assets/garden/animals/chat/bebe/walk_up_2.png'),
      require('../../assets/garden/animals/chat/bebe/walk_up_3.png'),
      require('../../assets/garden/animals/chat/bebe/walk_up_4.png'),
      require('../../assets/garden/animals/chat/bebe/walk_up_5.png'),
      require('../../assets/garden/animals/chat/bebe/walk_up_6.png'),
    ],
  },
  chien: {
    bebe: [
      require('../../assets/garden/animals/chien/bebe/walk_up_1.png'),
      require('../../assets/garden/animals/chien/bebe/walk_up_2.png'),
      require('../../assets/garden/animals/chien/bebe/walk_up_3.png'),
      require('../../assets/garden/animals/chien/bebe/walk_up_4.png'),
      require('../../assets/garden/animals/chien/bebe/walk_up_5.png'),
      require('../../assets/garden/animals/chien/bebe/walk_up_6.png'),
    ],
  },
  lapin: {
    bebe: [
      require('../../assets/garden/animals/lapin/bebe/walk_up_1.png'),
      require('../../assets/garden/animals/lapin/bebe/walk_up_2.png'),
      require('../../assets/garden/animals/lapin/bebe/walk_up_3.png'),
      require('../../assets/garden/animals/lapin/bebe/walk_up_4.png'),
      require('../../assets/garden/animals/lapin/bebe/walk_up_5.png'),
      require('../../assets/garden/animals/lapin/bebe/walk_up_6.png'),
    ],
  },
};

const COMPANION_WALK_LEFT: Partial<Record<CompanionSpecies, Partial<Record<CompanionStage, any[]>>>> = {
  chat: {
    bebe: [
      require('../../assets/garden/animals/chat/bebe/walk_left_1.png'),
      require('../../assets/garden/animals/chat/bebe/walk_left_2.png'),
      require('../../assets/garden/animals/chat/bebe/walk_left_3.png'),
      require('../../assets/garden/animals/chat/bebe/walk_left_4.png'),
      require('../../assets/garden/animals/chat/bebe/walk_left_5.png'),
      require('../../assets/garden/animals/chat/bebe/walk_left_6.png'),
    ],
  },
  chien: {
    bebe: [
      require('../../assets/garden/animals/chien/bebe/walk_left_1.png'),
      require('../../assets/garden/animals/chien/bebe/walk_left_2.png'),
      require('../../assets/garden/animals/chien/bebe/walk_left_3.png'),
      require('../../assets/garden/animals/chien/bebe/walk_left_4.png'),
      require('../../assets/garden/animals/chien/bebe/walk_left_5.png'),
      require('../../assets/garden/animals/chien/bebe/walk_left_6.png'),
    ],
  },
  lapin: {
    bebe: [
      require('../../assets/garden/animals/lapin/bebe/walk_left_1.png'),
      require('../../assets/garden/animals/lapin/bebe/walk_left_2.png'),
      require('../../assets/garden/animals/lapin/bebe/walk_left_3.png'),
      require('../../assets/garden/animals/lapin/bebe/walk_left_4.png'),
      require('../../assets/garden/animals/lapin/bebe/walk_left_5.png'),
      require('../../assets/garden/animals/lapin/bebe/walk_left_6.png'),
    ],
  },
};

/** Mapping humeur → emoji */
const MOOD_EMOJI: Record<CompanionMood, string> = {
  content:  '😊',
  endormi:  '😴',
  excite:   '🤩',
  triste:   '😢',
};

// ── Props ─────────────────────────────────────────────

interface CompanionSlotProps {
  species: CompanionSpecies;
  stage: CompanionStage;
  mood: CompanionMood;
  name: string;
  message?: string | null;
  onTap: () => void;
  containerWidth: number;
  containerHeight: number;
}

// ── Composant ─────────────────────────────────────────

export const CompanionSlot = React.memo(function CompanionSlot({
  species,
  stage,
  mood,
  name,
  message,
  onTap,
  containerWidth,
  containerHeight,
}: CompanionSlotProps) {
  const { colors } = useThemeColors();
  const [frameIdx, setFrameIdx] = useState(0);
  const [facingLeft, setFacingLeft] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [isHorizontal, setIsHorizontal] = useState(false);
  const [goingUp, setGoingUp] = useState(false);
  const [walkFrameIdx, setWalkFrameIdx] = useState(0);
  const currentFx = React.useRef(WAYPOINTS[HOME_IDX].fx);
  const currentFy = React.useRef(WAYPOINTS[HOME_IDX].fy);

  // Valeurs animées
  const jumpY = useSharedValue(0);
  const scale = useSharedValue(1);
  const bubbleAnim = useSharedValue(0);
  const posX = useSharedValue(0);
  const posY = useSharedValue(0);

  // Frame swap idle — plus rapide en marchant (300ms) qu'au repos (800ms)
  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIdx(f => (f + 1) % 2);
    }, isWalking ? 300 : 800);
    return () => clearInterval(interval);
  }, [isWalking]);

  // Walk frame cycle (pour les sprites de marche)
  useEffect(() => {
    if (!isWalking) { setWalkFrameIdx(0); return; }
    const interval = setInterval(() => {
      setWalkFrameIdx(f => (f + 1) % 6);
    }, 150);
    return () => clearInterval(interval);
  }, [isWalking]);

  // Balade entre waypoints — va vers un point d'intérêt, pause, puis un autre
  useEffect(() => {
    let mounted = true;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let lastIdx = HOME_IDX;

    const walkToNext = () => {
      if (!mounted) return;
      // Choisir un waypoint différent du dernier
      let nextIdx: number;
      do {
        nextIdx = Math.floor(Math.random() * WAYPOINTS.length);
      } while (nextIdx === lastIdx);
      lastIdx = nextIdx;

      const target = WAYPOINTS[nextIdx];
      const dfx = target.fx - currentFx.current;
      const dfy = target.fy - currentFy.current;
      const dist = Math.sqrt(dfx * dfx + dfy * dfy);
      // Durée proportionnelle à la distance (4s min, 8s max) — marche tranquille
      const duration = Math.max(4000, Math.min(8000, dist * 14000));

      setFacingLeft(dfx < 0);
      setGoingUp(dfy < 0);
      setIsHorizontal(Math.abs(dfx) > Math.abs(dfy));
      setIsWalking(true);

      const homeFx = WAYPOINTS[HOME_IDX].fx;
      const homeFy = WAYPOINTS[HOME_IDX].fy;
      posX.value = withTiming((target.fx - homeFx) * containerWidth, { duration, easing: Easing.inOut(Easing.sin) });
      posY.value = withTiming((target.fy - homeFy) * containerHeight, { duration, easing: Easing.inOut(Easing.sin) });
      currentFx.current = target.fx;
      currentFy.current = target.fy;

      // Arrêter la marche à l'arrivée
      const stopWalk = setTimeout(() => { if (mounted) setIsWalking(false); }, duration);
      timeouts.push(stopWalk);

      // Pause au waypoint (5-10s) puis bouger à nouveau
      const pause = 5000 + Math.random() * 5000;
      const t = setTimeout(walkToNext, duration + pause);
      timeouts.push(t);
    };

    // Premier déplacement après 3s
    const initial = setTimeout(walkToNext, 3000);
    timeouts.push(initial);

    return () => {
      mounted = false;
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [containerWidth, containerHeight]);

  // Animer la bulle de message
  useEffect(() => {
    if (message) {
      bubbleAnim.value = withTiming(1, { duration: 200 });
    } else {
      bubbleAnim.value = withTiming(0, { duration: 500 });
    }
  }, [message]);

  const handleTap = useCallback(() => {
    Haptics.impactAsync(ImpactFeedbackStyle.Medium);
    jumpY.value = withSequence(
      withSpring(-8, { damping: 8, stiffness: 300 }),
      withSpring(0, { damping: 10, stiffness: 180 }),
    );
    scale.value = withSequence(
      withSpring(1.1, { damping: 8, stiffness: 300 }),
      withSpring(1.0, { damping: 10, stiffness: 180 }),
    );
    onTap();
  }, [onTap, jumpY, scale]);

  // Style de déplacement (balade entre waypoints)
  const moveStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: posX.value },
      { translateY: posY.value },
    ],
  }));

  // Style du sprite (saut + flip directionnel)
  const companionAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: jumpY.value },
      { scale: scale.value },
    ],
  }));

  const bubbleAnimStyle = useAnimatedStyle(() => ({
    opacity: bubbleAnim.value,
    transform: [
      { translateY: (1 - bubbleAnim.value) * 4 },
    ],
  }));

  // Position pixel dans le container (point de repos)
  const home = WAYPOINTS[HOME_IDX];
  const px = home.fx * containerWidth;
  const py = home.fy * containerHeight;

  // Sprite courant — walk frames si disponibles, sinon idle
  const sprites = COMPANION_SPRITES[species][stage];
  const walkDownFrames = COMPANION_WALK_DOWN[species]?.[stage];
  const walkUpFrames = COMPANION_WALK_UP[species]?.[stage];
  const walkLeftFrames = COMPANION_WALK_LEFT[species]?.[stage];

  let currentSprite: any;
  let flipX = false;

  if (isWalking && isHorizontal && walkLeftFrames) {
    // Marche latérale — walk_left, flip pour walk_right
    currentSprite = walkLeftFrames[walkFrameIdx % walkLeftFrames.length];
    flipX = !facingLeft;
  } else if (isWalking && !isHorizontal && goingUp && walkUpFrames) {
    // Marche vers le haut — walk_up (dos)
    currentSprite = walkUpFrames[walkFrameIdx % walkUpFrames.length];
  } else if (isWalking && !isHorizontal && !goingUp && walkDownFrames) {
    // Marche vers le bas — walk_down (face)
    currentSprite = walkDownFrames[walkFrameIdx % walkDownFrames.length];
  } else if (isWalking && walkLeftFrames) {
    // Fallback diagonal → walk_left avec flip
    currentSprite = walkLeftFrames[walkFrameIdx % walkLeftFrames.length];
    flipX = !facingLeft;
  } else {
    // Idle ou pas de walk sprites
    currentSprite = frameIdx === 0 ? sprites.idle_1 : sprites.idle_2;
    flipX = isWalking && facingLeft; // fallback flip en marchant sans walk sprites
  }

  const hasMessage = !!message;

  return (
    <Animated.View
      style={[
        styles.slot,
        {
          left: px - COMPANION_SIZE / 2,
          top: py - COMPANION_SIZE / 2,
        },
        moveStyle,
      ]}
      pointerEvents="box-none"
    >
      {/* Bulle de message contextuel */}
      {hasMessage && (
        <Animated.View
          style={[
            styles.messageBubble,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            bubbleAnimStyle,
          ]}
        >
          <Text style={[styles.messageText, { color: colors.text }]} numberOfLines={5}>
            {message}
          </Text>
        </Animated.View>
      )}

      {/* Emoji d'humeur (quand pas de message) */}
      {!hasMessage && (
        <View style={styles.moodBubble}>
          <Text style={styles.moodEmoji}>{MOOD_EMOJI[mood]}</Text>
        </View>
      )}

      {/* Sprite animé du compagnon */}
      <Pressable onPress={handleTap} accessibilityLabel={name}>
        <Animated.View style={companionAnimStyle}>
          <Image
            source={currentSprite}
            style={[styles.sprite, flipX && { transform: [{ scaleX: -1 }] }]}
            resizeMode="contain"
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
});

// ── Styles ────────────────────────────────────────────

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    alignItems: 'center',
  },
  sprite: {
    width: COMPANION_SIZE,
    height: COMPANION_SIZE,
  },
  messageBubble: {
    position: 'absolute',
    bottom: COMPANION_SIZE + 4,
    left: '50%',
    transform: [{ translateX: -80 }],
    width: 160,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    // Ombre legere
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  messageText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
  moodBubble: {
    position: 'absolute',
    bottom: COMPANION_SIZE + 2,
    alignSelf: 'center',
  },
  moodEmoji: {
    fontSize: FontSize.caption,
  },
});
