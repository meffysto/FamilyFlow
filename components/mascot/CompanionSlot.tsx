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
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { FontSize, FontWeight } from '../../constants/typography';
import { Spacing, Radius } from '../../constants/spacing';
import type { CompanionSpecies, CompanionStage, CompanionMood } from '../../lib/mascot/companion-types';

// ── Constantes géométrie viewbox ──────────────────────

/** Dimensions viewbox SVG de la scène arbre */
const VIEWBOX_W = 200;
const VIEWBOX_H = 240;

/** Position du compagnon dans le viewbox — distinct des HAB_SLOTS existants */
const COMPANION_CX = 45;
const COMPANION_CY = 175;

/** Taille du sprite du compagnon (logical pixels) */
const COMPANION_SIZE = 32;

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
  const [bubbleOpacity, setBubbleOpacity] = useState(0);

  // Animation idle — frame swap toutes les 800ms
  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIdx(f => (f + 1) % 2);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // Bulle de message — apparait + disparait
  useEffect(() => {
    if (!message) {
      setBubbleOpacity(0);
      return;
    }
    setBubbleOpacity(1);
  }, [message]);

  // Valeurs animées pour le tap
  const jumpY = useSharedValue(0);
  const scale = useSharedValue(1);
  const bubbleAnim = useSharedValue(0);

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
      withSpring(-20, { damping: 6, stiffness: 400 }),
      withSpring(0, { damping: 10, stiffness: 180 }),
    );
    scale.value = withSequence(
      withSpring(1.3, { damping: 6, stiffness: 300 }),
      withSpring(1.0, { damping: 10, stiffness: 180 }),
    );
    onTap();
  }, [onTap, jumpY, scale]);

  // Styles animés
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

  // Position pixel dans le container
  const px = (COMPANION_CX / VIEWBOX_W) * containerWidth;
  const py = (COMPANION_CY / VIEWBOX_H) * containerHeight;

  // Sprite courant
  const sprites = COMPANION_SPRITES[species][stage];
  const currentSprite = frameIdx === 0 ? sprites.idle_1 : sprites.idle_2;

  const hasMessage = !!message;

  return (
    <View
      style={[
        styles.slot,
        {
          left: px - COMPANION_SIZE / 2,
          top: py - COMPANION_SIZE / 2,
        },
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
            style={styles.sprite}
            resizeMode="contain"
          />
        </Animated.View>
      </Pressable>
    </View>
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
