/**
 * VisitorSlot.tsx — Composant animé du visiteur mystérieux dans le diorama arbre
 *
 * Affiche le voyageur mystérieux avec 5 états d'animation :
 *   entering → idle → reacting → departing → departed
 *
 * Le visiteur arrive depuis la droite, se positionne dans le diorama,
 * réagit au tap (haptic + saut), joue des animations de réaction aux choix saga,
 * puis repart vers la droite (normal ou dramatique si dernier chapitre).
 *
 * Chaque saga a son propre personnage visiteur pixel art (PixelLab) :
 *   voyageur_argent → voyageur encapuchonné bleu, source_cachee → esprit eau,
 *   carnaval_ombres → masqué violet, graine_anciens → vieux sage vert
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Pressable, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

// ── Types ─────────────────────────────────────────────

export type ReactionType = 'joy' | 'surprise' | 'mystery';

export interface VisitorSlotProps {
  /** true = chapitre disponible aujourd'hui → rendre le visiteur visible */
  visible: boolean;
  /** Identifiant de la saga active (pour tint variation) */
  sagaId: string;
  containerWidth: number;
  containerHeight: number;
  /** Callback déclenché au tap en état idle → ouvre SagaWorldEvent dans tree.tsx */
  onTap: () => void;
  /** true après completion du chapitre → déclenche l'animation de départ */
  shouldDepart: boolean;
  /** true = dernier chapitre → départ dramatique avec flash + scale */
  isLastChapter: boolean;
  /** Callback appelé après la fin de l'animation de départ */
  onDepartComplete?: () => void;
  /** Réaction visuelle déclenchée par un choix saga (SAG-04) */
  reactionType?: ReactionType;
  /** Callback appelé après la fin de l'animation de réaction */
  onReactionComplete?: () => void;
}

type VisitorState = 'entering' | 'idle' | 'reacting' | 'departing' | 'departed';

// ── Constantes géométrie ──────────────────────────────

/** Taille des sprites du visiteur (pixels logiques) */
const VISITOR_SIZE = 48;

/**
 * Position cible dans le diorama (fractions du container).
 * Côté droit, légèrement plus bas que le chemin principal —
 * évite la collision avec le PATROL_ROUTE du CompanionSlot.
 */
const TARGET_FX = 0.72;
const TARGET_FY = 0.62;

// ── Configuration animations ──────────────────────────

const SPRING_WALK = { damping: 16, stiffness: 120 };
const SPRING_WALK_DEPART = { damping: 18, stiffness: 100 };

// ── Mapping sagaId → tint couleur optionnel ───────────
// Appliqué comme overlay View semi-transparent si le tint ne rend pas bien sur Image.

const SAGA_TINT: Record<string, string> = {
  'silver-voyager': '#C0C8D0',
  'hidden-spring':  '#80B4D0',
  'amber-road':     '#D4A060',
  'forest-whisper': '#90B880',
};

// ── Sprites par saga ─────────────────────────────────

const SAGA_SPRITES: Record<string, { idle: number[]; walk: number[] }> = {
  voyageur_argent: {
    idle: [
      require('../../assets/garden/animals/voyageur/idle_1.png'),
      require('../../assets/garden/animals/voyageur/idle_2.png'),
    ],
    walk: [
      require('../../assets/garden/animals/voyageur/walk_left_1.png'),
      require('../../assets/garden/animals/voyageur/walk_left_2.png'),
      require('../../assets/garden/animals/voyageur/walk_left_3.png'),
      require('../../assets/garden/animals/voyageur/walk_left_4.png'),
      require('../../assets/garden/animals/voyageur/walk_left_5.png'),
      require('../../assets/garden/animals/voyageur/walk_left_6.png'),
    ],
  },
  source_cachee: {
    idle: [
      require('../../assets/garden/animals/esprit_eau/idle_1.png'),
      require('../../assets/garden/animals/esprit_eau/idle_2.png'),
    ],
    walk: [
      require('../../assets/garden/animals/esprit_eau/walk_left_1.png'),
      require('../../assets/garden/animals/esprit_eau/walk_left_2.png'),
      require('../../assets/garden/animals/esprit_eau/walk_left_3.png'),
      require('../../assets/garden/animals/esprit_eau/walk_left_4.png'),
      require('../../assets/garden/animals/esprit_eau/walk_left_5.png'),
      require('../../assets/garden/animals/esprit_eau/walk_left_6.png'),
    ],
  },
  carnaval_ombres: {
    idle: [
      require('../../assets/garden/animals/masque_ombre/idle_1.png'),
      require('../../assets/garden/animals/masque_ombre/idle_2.png'),
    ],
    walk: [
      require('../../assets/garden/animals/masque_ombre/walk_left_1.png'),
      require('../../assets/garden/animals/masque_ombre/walk_left_2.png'),
      require('../../assets/garden/animals/masque_ombre/walk_left_3.png'),
      require('../../assets/garden/animals/masque_ombre/walk_left_4.png'),
      require('../../assets/garden/animals/masque_ombre/walk_left_5.png'),
      require('../../assets/garden/animals/masque_ombre/walk_left_6.png'),
    ],
  },
  graine_anciens: {
    idle: [
      require('../../assets/garden/animals/ancien_gardien/idle_1.png'),
      require('../../assets/garden/animals/ancien_gardien/idle_2.png'),
    ],
    walk: [
      require('../../assets/garden/animals/ancien_gardien/walk_left_1.png'),
      require('../../assets/garden/animals/ancien_gardien/walk_left_2.png'),
      require('../../assets/garden/animals/ancien_gardien/walk_left_3.png'),
      require('../../assets/garden/animals/ancien_gardien/walk_left_4.png'),
      require('../../assets/garden/animals/ancien_gardien/walk_left_5.png'),
      require('../../assets/garden/animals/ancien_gardien/walk_left_6.png'),
    ],
  },
};

// Fallback sur le voyageur si sagaId inconnu
const DEFAULT_SPRITES = SAGA_SPRITES.voyageur_argent;

// ── Composant principal ───────────────────────────────

export function VisitorSlot({
  visible,
  sagaId,
  containerWidth,
  containerHeight,
  onTap,
  shouldDepart,
  isLastChapter,
  onDepartComplete,
  reactionType,
  onReactionComplete,
}: VisitorSlotProps) {
  const { primary, colors } = useThemeColors();
  const sprites = SAGA_SPRITES[sagaId] ?? DEFAULT_SPRITES;
  const IDLE_FRAMES = sprites.idle;
  const WALK_FRAMES = sprites.walk;

  // ── État machine ──────────────────────────────────
  const [state, setState] = useState<VisitorState>('entering');
  const [frameIdx, setFrameIdx] = useState(0);
  const [walkFrameIdx, setWalkFrameIdx] = useState(0);
  const [isWalking, setIsWalking] = useState(true); // true pendant entering + departing
  const [flipForDepart, setFlipForDepart] = useState(false); // scaleX: -1 sur Image pour walk_right

  // ── Ref pour cleanup ─────────────────────────────
  const mounted = useRef(true);

  // ── Positions calculées ───────────────────────────
  const TARGET_X = containerWidth * TARGET_FX;
  const TARGET_Y = containerHeight * TARGET_FY;
  const ENTRY_X = containerWidth * 1.15;
  const DEPART_X = containerWidth * 1.20;

  // ── Shared values animations ─────────────────────
  const posX       = useSharedValue(ENTRY_X);
  const bounceY    = useSharedValue(0);
  const opacity    = useSharedValue(0);
  const bubbleScale = useSharedValue(1);
  const flashOpacity = useSharedValue(0);

  // Shared values pour réactions
  const reactionScale       = useSharedValue(1);
  const reactionTranslateX  = useSharedValue(0);
  const reactionOpacity     = useSharedValue(1);

  // ── Animation arrivée ────────────────────────────
  useEffect(() => {
    if (!visible) return;
    mounted.current = true;

    // Fade in rapide
    opacity.value = withTiming(1, { duration: 200 });

    // Marche depuis hors-écran droite vers position cible
    posX.value = withSpring(TARGET_X, SPRING_WALK, (finished) => {
      if (finished) {
        runOnJS(setState)('idle');
        runOnJS(setIsWalking)(false);
      }
    });

    return () => { mounted.current = false; };
  }, [visible]);

  // ── Frame swap idle (800ms/frame) ────────────────
  useEffect(() => {
    if (state !== 'idle' && state !== 'reacting') return;
    const interval = setInterval(() => {
      if (mounted.current) setFrameIdx(f => (f + 1) % IDLE_FRAMES.length);
    }, 800);
    return () => clearInterval(interval);
  }, [state]);

  // ── Frame swap walk (150ms/frame) ────────────────
  useEffect(() => {
    if (!isWalking) return;
    const interval = setInterval(() => {
      if (mounted.current) setWalkFrameIdx(f => (f + 1) % WALK_FRAMES.length);
    }, 150);
    return () => clearInterval(interval);
  }, [isWalking]);

  // ── Animation idle bounce + bulle "!" ────────────
  useEffect(() => {
    if (state !== 'idle') return;

    // Bounce vertical continu
    bounceY.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 600 }),
        withTiming(0, { duration: 600 }),
      ),
      -1,
      true,
    );

    // Bulle "!" pulsante
    bubbleScale.value = withRepeat(
      withSequence(
        withSpring(1.25, { damping: 8, stiffness: 200 }),
        withSpring(1.0, { damping: 12, stiffness: 180 }),
      ),
      -1,
      true,
    );

    return () => {
      bounceY.value = withTiming(0, { duration: 200 });
    };
  }, [state]);

  // ── Animation réaction aux choix (SAG-04) ────────
  useEffect(() => {
    if (!reactionType || state === 'departed') return;

    setState('reacting');
    bounceY.value = withTiming(0, { duration: 100 });

    switch (reactionType) {
      case 'joy': {
        // Bounce enthousiaste — 3 rebonds décroissants
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        reactionScale.value = withSequence(
          withSpring(1.35, { damping: 6, stiffness: 250 }),
          withSpring(0.9,  { damping: 8, stiffness: 200 }),
          withSpring(1.15, { damping: 8, stiffness: 200 }),
          withSpring(1.0,  { damping: 12, stiffness: 180 }),
        );
        bounceY.value = withSequence(
          withTiming(-8, { duration: 150 }),
          withTiming(0,  { duration: 200 }),
          withTiming(-5, { duration: 150 }),
          withTiming(0,  { duration: 200 }),
        );
        setTimeout(() => {
          if (mounted.current) {
            setState('idle');
            onReactionComplete?.();
          }
        }, 700);
        break;
      }

      case 'surprise': {
        // Shake horizontal rapide — tremblement 6 phases
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        reactionScale.value = withSequence(
          withSpring(1.2, { damping: 10, stiffness: 300 }),
          withSpring(1.0, { damping: 12, stiffness: 200 }),
        );
        reactionTranslateX.value = withSequence(
          withTiming(-4, { duration: 50 }),
          withTiming(4,  { duration: 50 }),
          withTiming(-3, { duration: 50 }),
          withTiming(3,  { duration: 50 }),
          withTiming(-2, { duration: 50 }),
          withTiming(0,  { duration: 80 }),
        );
        setTimeout(() => {
          if (mounted.current) {
            setState('idle');
            onReactionComplete?.();
          }
        }, 400);
        break;
      }

      case 'mystery': {
        // Opacity flicker mystique — 6 phases de clignotement
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        reactionOpacity.value = withSequence(
          withTiming(0.3, { duration: 120 }),
          withTiming(1.0, { duration: 120 }),
          withTiming(0.4, { duration: 100 }),
          withTiming(1.0, { duration: 120 }),
          withTiming(0.5, { duration: 100 }),
          withTiming(1.0, { duration: 150 }),
        );
        reactionScale.value = withSequence(
          withTiming(1.08, { duration: 300 }),
          withTiming(1.0,  { duration: 400 }),
        );
        setTimeout(() => {
          if (mounted.current) {
            setState('idle');
            onReactionComplete?.();
          }
        }, 700);
        break;
      }
    }
  }, [reactionType]);

  // ── Départ (déclenché quand shouldDepart = true) ──
  useEffect(() => {
    if (!shouldDepart || (state !== 'idle')) return;

    setState('departing');
    setIsWalking(true);
    setFlipForDepart(true); // walk_right via scaleX: -1 sur Image

    if (isLastChapter) {
      // Départ dramatique : flash blanc + scale up + fadeout
      flashOpacity.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 600 }),
      );
      reactionScale.value = withSequence(
        withSpring(1.4, { damping: 8, stiffness: 120 }),
        withTiming(0, { duration: 400 }),
      );
      opacity.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 600 }),
      );
      setTimeout(() => {
        if (mounted.current) {
          setState('departed');
          onDepartComplete?.();
        }
      }, 900);
    } else {
      // Départ normal : marche vers la droite
      posX.value = withSpring(DEPART_X, SPRING_WALK_DEPART, (finished) => {
        if (finished) {
          runOnJS(setState)('departed');
          if (onDepartComplete) runOnJS(onDepartComplete)();
        }
      });
    }
  }, [shouldDepart, state]);

  // ── Cleanup ───────────────────────────────────────
  useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  // ── Styles animés ─────────────────────────────────

  const containerAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: posX.value - TARGET_X + reactionTranslateX.value },
      { translateY: bounceY.value },
      { scale: reactionScale.value },
    ],
    opacity: opacity.value * reactionOpacity.value,
  }));

  const bubbleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bubbleScale.value }],
  }));

  const flashAnimStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  // ── Garde départ ─────────────────────────────────
  if (state === 'departed') return null;
  if (!visible && state === 'entering') return null;

  // ── Frame courante ────────────────────────────────
  const currentFrame = isWalking
    ? WALK_FRAMES[walkFrameIdx % WALK_FRAMES.length]
    : IDLE_FRAMES[frameIdx % IDLE_FRAMES.length];

  // ── Tint couleur saga ─────────────────────────────
  const tintColor = SAGA_TINT[sagaId] ?? null;

  // ── Rendu ─────────────────────────────────────────

  return (
    <Animated.View
      style={[
        styles.container,
        {
          left: TARGET_X,
          top: TARGET_Y,
          width: VISITOR_SIZE,
          height: VISITOR_SIZE,
        },
        containerAnimStyle,
      ]}
    >
      {/* Sprite visiteur */}
      <Pressable
        onPress={() => {
          if (state !== 'idle') return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onTap();
        }}
        disabled={state !== 'idle'}
      >
        <Image
          source={currentFrame}
          style={[
            { width: VISITOR_SIZE, height: VISITOR_SIZE },
            flipForDepart ? { transform: [{ scaleX: -1 }] } : {},
          ] as any}
        />
      </Pressable>

      {/* Overlay tint saga (fallback si tintColor sur Image ne rend pas bien) */}
      {tintColor != null && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: tintColor,
              opacity: 0.15,
              borderRadius: Radius.xs,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Bulle "!" pulsante — visible uniquement en état idle */}
      {state === 'idle' && (
        <Animated.View
          style={[styles.exclamationBubble, { backgroundColor: primary + 'DD' }, bubbleAnimStyle]}
        >
          <Text style={[styles.exclamationText, { color: colors.bg }]}>!</Text>
        </Animated.View>
      )}

      {/* Flash overlay pour départ dramatique */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          styles.flashOverlay,
          flashAnimStyle,
        ]}
        pointerEvents="none"
      />
    </Animated.View>
  );
}

// ── Styles statiques ──────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    overflow: 'visible',
  },
  exclamationBubble: {
    position: 'absolute',
    top: -18,
    alignSelf: 'center',
    borderRadius: Radius.full,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exclamationText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
    lineHeight: 14,
  },
  flashOverlay: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xs,
  },
});
