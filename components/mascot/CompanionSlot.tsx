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
const COMPANION_SIZE = 48;

/**
 * Circuit de patrouille séquentiel aligné sur le chemin beige du tileset.
 * Le compagnon suit ce circuit en boucle :
 *   repos → chemin ↑ → potager (zig-zag) → chemin ↓ → bâtiments → chemin → arbre → repos
 *
 * pause = durée d'arrêt à ce point (ms). 0 = passage sans arrêt.
 */
const PATROL_ROUTE: { fx: number; fy: number; label: string; pause: number }[] = [
  // — Repos près de l'arbre (départ) —
  { fx: 0.28, fy: 0.58, label: 'home',           pause: 4000 },

  // — Monter le chemin beige vers le potager —
  { fx: 0.44, fy: 0.50, label: 'path-center',    pause: 0 },
  { fx: 0.44, fy: 0.38, label: 'path-top',       pause: 800 },

  // — Patrouille du potager (zig-zag rang 3 → 1) —
  { fx: 0.28, fy: 0.29, label: 'crops-r3-left',  pause: 2000 },
  { fx: 0.56, fy: 0.29, label: 'crops-r3-right', pause: 1500 },
  { fx: 0.42, fy: 0.17, label: 'crops-r2-mid',   pause: 2000 },
  { fx: 0.14, fy: 0.05, label: 'crops-r1-left',  pause: 1500 },
  { fx: 0.70, fy: 0.05, label: 'crops-r1-right', pause: 2000 },

  // — Redescendre vers le chemin —
  { fx: 0.44, fy: 0.17, label: 'crops-exit',     pause: 0 },
  { fx: 0.44, fy: 0.38, label: 'path-junction',  pause: 800 },

  // — Bifurquer vers les bâtiments (droite) —
  { fx: 0.65, fy: 0.42, label: 'path-to-build',  pause: 0 },
  { fx: 0.82, fy: 0.42, label: 'building-1',     pause: 3000 },
  { fx: 0.82, fy: 0.62, label: 'building-2',     pause: 2500 },
  { fx: 0.82, fy: 0.78, label: 'building-3',     pause: 2000 },

  // — Retour au chemin central —
  { fx: 0.65, fy: 0.55, label: 'build-exit',     pause: 0 },
  { fx: 0.44, fy: 0.55, label: 'path-mid',       pause: 800 },

  // — Descendre vers l'arbre —
  { fx: 0.44, fy: 0.70, label: 'path-tree',      pause: 1000 },
  { fx: 0.35, fy: 0.75, label: 'near-tree',      pause: 3000 },
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
  renard: {
    bebe: [
      require('../../assets/garden/animals/renard/bebe/walk_down_1.png'),
      require('../../assets/garden/animals/renard/bebe/walk_down_2.png'),
      require('../../assets/garden/animals/renard/bebe/walk_down_3.png'),
      require('../../assets/garden/animals/renard/bebe/walk_down_4.png'),
      require('../../assets/garden/animals/renard/bebe/walk_down_5.png'),
      require('../../assets/garden/animals/renard/bebe/walk_down_6.png'),
      require('../../assets/garden/animals/renard/bebe/walk_down_7.png'),
      require('../../assets/garden/animals/renard/bebe/walk_down_8.png'),
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
  renard: {
    bebe: [
      require('../../assets/garden/animals/renard/bebe/walk_up_1.png'),
      require('../../assets/garden/animals/renard/bebe/walk_up_2.png'),
      require('../../assets/garden/animals/renard/bebe/walk_up_3.png'),
      require('../../assets/garden/animals/renard/bebe/walk_up_4.png'),
      require('../../assets/garden/animals/renard/bebe/walk_up_5.png'),
      require('../../assets/garden/animals/renard/bebe/walk_up_6.png'),
      require('../../assets/garden/animals/renard/bebe/walk_up_7.png'),
      require('../../assets/garden/animals/renard/bebe/walk_up_8.png'),
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
  renard: {
    bebe: [
      require('../../assets/garden/animals/renard/bebe/walk_left_1.png'),
      require('../../assets/garden/animals/renard/bebe/walk_left_2.png'),
      require('../../assets/garden/animals/renard/bebe/walk_left_3.png'),
      require('../../assets/garden/animals/renard/bebe/walk_left_4.png'),
      require('../../assets/garden/animals/renard/bebe/walk_left_5.png'),
      require('../../assets/garden/animals/renard/bebe/walk_left_6.png'),
      require('../../assets/garden/animals/renard/bebe/walk_left_7.png'),
      require('../../assets/garden/animals/renard/bebe/walk_left_8.png'),
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

interface HarvestableInfo {
  fx: number;  // position fractionnelle X de la crop
  fy: number;  // position fractionnelle Y de la crop
  cropName: string;
}

interface CompanionSlotProps {
  species: CompanionSpecies;
  stage: CompanionStage;
  mood: CompanionMood;
  name: string;
  message?: string | null;
  onTap: () => void;
  containerWidth: number;
  containerHeight: number;
  harvestables?: HarvestableInfo[];  // crops prêtes à récolter
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
  harvestables = [],
}: CompanionSlotProps) {
  const { colors } = useThemeColors();
  const [frameIdx, setFrameIdx] = useState(0);
  const [facingLeft, setFacingLeft] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [isHorizontal, setIsHorizontal] = useState(false);
  const [goingUp, setGoingUp] = useState(false);
  const [walkFrameIdx, setWalkFrameIdx] = useState(0);
  const currentFx = React.useRef(PATROL_ROUTE[HOME_IDX].fx);
  const currentFy = React.useRef(PATROL_ROUTE[HOME_IDX].fy);

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

  // Message de récolte autonome (pas le message IA — celui-ci vient du compagnon lui-même)
  const [harvestHint, setHarvestHint] = useState<string | null>(null);
  const harvestablesRef = React.useRef(harvestables);
  useEffect(() => { harvestablesRef.current = harvestables; }, [harvestables]);

  // Patrouille séquentielle — suit le circuit PATROL_ROUTE en boucle
  useEffect(() => {
    let mounted = true;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let routeIdx = 0;
    let visitedHarvestThisCycle = false;

    const walkTo = (targetFx: number, targetFy: number, onArrive?: () => void) => {
      const dfx = targetFx - currentFx.current;
      const dfy = targetFy - currentFy.current;
      const dist = Math.sqrt(dfx * dfx + dfy * dfy);
      const duration = Math.max(2000, Math.min(8000, dist * 14000));

      setFacingLeft(dfx < -0.02);
      setGoingUp(dfy < -0.02);
      setIsHorizontal(Math.abs(dfx) > Math.abs(dfy));
      setIsWalking(true);

      const homeFx = PATROL_ROUTE[HOME_IDX].fx;
      const homeFy = PATROL_ROUTE[HOME_IDX].fy;
      posX.value = withTiming((targetFx - homeFx) * containerWidth, { duration, easing: Easing.inOut(Easing.sin) });
      posY.value = withTiming((targetFy - homeFy) * containerHeight, { duration, easing: Easing.inOut(Easing.sin) });
      currentFx.current = targetFx;
      currentFy.current = targetFy;

      const stopWalk = setTimeout(() => {
        if (mounted) setIsWalking(false);
        onArrive?.();
      }, duration);
      timeouts.push(stopWalk);

      return duration;
    };

    const walkNext = () => {
      if (!mounted) return;

      const step = PATROL_ROUTE[routeIdx];

      // Détour récolte — une seule fois par cycle, quand on passe dans le potager
      const readyCrops = harvestablesRef.current;
      if (
        readyCrops.length > 0 &&
        !visitedHarvestThisCycle &&
        step.label.startsWith('crops-')
      ) {
        visitedHarvestThisCycle = true;
        const crop = readyCrops[Math.floor(Math.random() * readyCrops.length)];
        const duration = walkTo(crop.fx, crop.fy, () => {
          if (mounted && !message) {
            setHarvestHint(crop.cropName);
            const hideHint = setTimeout(() => { if (mounted) setHarvestHint(null); }, 4000);
            timeouts.push(hideHint);
          }
        });
        // Après le détour, continuer le circuit normal (sans avancer routeIdx)
        const t = setTimeout(walkNext, duration + 4000);
        timeouts.push(t);
        return;
      }

      // Avancer au point suivant du circuit
      const duration = walkTo(step.fx, step.fy);

      // Reset le cycle harvest quand on revient au home
      if (step.label === 'home') visitedHarvestThisCycle = false;

      // Prochain point (boucle)
      routeIdx = (routeIdx + 1) % PATROL_ROUTE.length;

      const t = setTimeout(walkNext, duration + step.pause);
      timeouts.push(t);
    };

    // Premier déplacement après 3s
    const initial = setTimeout(walkNext, 3000);
    timeouts.push(initial);

    return () => {
      mounted = false;
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [containerWidth, containerHeight]);

  // Animer la bulle de message ou harvest hint
  useEffect(() => {
    if (message || harvestHint) {
      bubbleAnim.value = withTiming(1, { duration: 200 });
    } else {
      bubbleAnim.value = withTiming(0, { duration: 500 });
    }
  }, [message, harvestHint]);

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
  const home = PATROL_ROUTE[HOME_IDX];
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
  const displayText = message || (harvestHint ? `🌾 ${harvestHint} est prêt !` : null);
  const showBubble = !!displayText;

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
      {/* Bulle de message (IA, harvest hint, ou contextuel) */}
      {showBubble && (() => {
        const BUBBLE_W = 200;
        const bubbleLeft = px - BUBBLE_W / 2;
        const bubbleRight = bubbleLeft + BUBBLE_W;
        const margin = 8;
        // Recaler si la bulle déborde à droite ou à gauche
        let offsetX = -BUBBLE_W / 2;
        if (bubbleRight > containerWidth - margin) {
          offsetX = -(BUBBLE_W - (containerWidth - px - margin));
        } else if (bubbleLeft < margin) {
          offsetX = -(px - margin);
        }
        return (
          <Animated.View
            style={[
              styles.messageBubble,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                transform: [{ translateX: offsetX }],
              },
              bubbleAnimStyle,
            ]}
          >
            <Text style={[styles.messageText, { color: colors.text }]} numberOfLines={5}>
              {displayText}
            </Text>
          </Animated.View>
        );
      })()}

      {/* Emoji d'humeur — seulement à l'arrêt, pas en marchant */}
      {!showBubble && !isWalking && (
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
    width: 200,
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
