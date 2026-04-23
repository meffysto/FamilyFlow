/**
 * CompanionSlot.tsx — Composant animé du compagnon dans la scène arbre
 *
 * Affiche le compagnon pixel art à une position fixe dans la scène,
 * avec animation idle (frame swap), tap (saut + haptic) et bulles de message.
 * Le compagnon se déplace de façon organique entre des zones marchables aléatoires
 * avec pauses variables — plus de circuit séquentiel rigide.
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
import type { CompanionSpecies, CompanionStage, CompanionMood, CropAffinity } from '../../lib/mascot/companion-types';
import { COMPANION_SPRITES } from '../../lib/mascot/companion-sprites';
import { FeedParticles } from './FeedParticles';

// ── Constantes géométrie ──────────────────────────────

/** Taille du sprite du compagnon (logical pixels) */
const COMPANION_SIZE = 48;

/** Zone d'ancrage des particules feed — couvre la trajectoire des emojis
 * (rise 120px, spread horizontal ±100px autour du sprite). */
const PARTICLE_ANCHOR_W = 200;
const PARTICLE_ANCHOR_H = 160;
/** Offset Y pour que l'émetteur soit au niveau du haut du sprite. */
const PARTICLE_EMITTER_Y = PARTICLE_ANCHOR_H - 20;

/** Point de repos du compagnon (position fractionnelle dans le container) */
const HOME_FX = 0.42;
const HOME_FY = 0.55;

// ── Type zone marchable ───────────────────────────────

/**
 * Une zone rectangulaire dans laquelle le compagnon peut se déplacer librement.
 * Le compagnon choisit un point aléatoire dans la zone, attend une pause
 * aléatoire entre pauseMin et pauseMax, puis choisit une nouvelle zone.
 */
type WalkableZone = {
  id: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  weight: number;     // probabilité relative de choisir cette zone
  pauseMin: number;   // pause min en ms à l'arrivée
  pauseMax: number;   // pause max en ms à l'arrivée
};

// ── Sprites Mana Seed ─────────────────────────────────
// Phase 29 : COMPANION_SPRITES extrait dans `lib/mascot/companion-sprites.ts`
// pour partage avec VillageAvatar. Importe en tete de fichier.

// ── Walk sprites (4 frames par direction) ────────────
// Sprites de marche disponibles pour bébé, jeune et adulte (adulte ajouté P1 PixelLab).

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
    jeune: [
      require('../../assets/garden/animals/chat/jeune/walk_down_1.png'),
      require('../../assets/garden/animals/chat/jeune/walk_down_2.png'),
      require('../../assets/garden/animals/chat/jeune/walk_down_3.png'),
      require('../../assets/garden/animals/chat/jeune/walk_down_4.png'),
      require('../../assets/garden/animals/chat/jeune/walk_down_5.png'),
      require('../../assets/garden/animals/chat/jeune/walk_down_6.png'),
      require('../../assets/garden/animals/chat/jeune/walk_down_7.png'),
      require('../../assets/garden/animals/chat/jeune/walk_down_8.png'),
    ],
    adulte: [
      require('../../assets/garden/animals/chat/adulte/walk_down_1.png'),
      require('../../assets/garden/animals/chat/adulte/walk_down_2.png'),
      require('../../assets/garden/animals/chat/adulte/walk_down_3.png'),
      require('../../assets/garden/animals/chat/adulte/walk_down_4.png'),
      require('../../assets/garden/animals/chat/adulte/walk_down_5.png'),
      require('../../assets/garden/animals/chat/adulte/walk_down_6.png'),
      require('../../assets/garden/animals/chat/adulte/walk_down_7.png'),
      require('../../assets/garden/animals/chat/adulte/walk_down_8.png'),
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
    jeune: [
      require('../../assets/garden/animals/chien/jeune/walk_down_1.png'),
      require('../../assets/garden/animals/chien/jeune/walk_down_2.png'),
      require('../../assets/garden/animals/chien/jeune/walk_down_3.png'),
      require('../../assets/garden/animals/chien/jeune/walk_down_4.png'),
      require('../../assets/garden/animals/chien/jeune/walk_down_5.png'),
      require('../../assets/garden/animals/chien/jeune/walk_down_6.png'),
    ],
    adulte: [
      require('../../assets/garden/animals/chien/adulte/walk_down_1.png'),
      require('../../assets/garden/animals/chien/adulte/walk_down_2.png'),
      require('../../assets/garden/animals/chien/adulte/walk_down_3.png'),
      require('../../assets/garden/animals/chien/adulte/walk_down_4.png'),
      require('../../assets/garden/animals/chien/adulte/walk_down_5.png'),
      require('../../assets/garden/animals/chien/adulte/walk_down_6.png'),
      require('../../assets/garden/animals/chien/adulte/walk_down_7.png'),
      require('../../assets/garden/animals/chien/adulte/walk_down_8.png'),
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
    jeune: [
      require('../../assets/garden/animals/renard/jeune/walk_down_1.png'),
      require('../../assets/garden/animals/renard/jeune/walk_down_2.png'),
      require('../../assets/garden/animals/renard/jeune/walk_down_3.png'),
      require('../../assets/garden/animals/renard/jeune/walk_down_4.png'),
      require('../../assets/garden/animals/renard/jeune/walk_down_5.png'),
      require('../../assets/garden/animals/renard/jeune/walk_down_6.png'),
    ],
    adulte: [
      require('../../assets/garden/animals/renard/adulte/walk_down_1.png'),
      require('../../assets/garden/animals/renard/adulte/walk_down_2.png'),
      require('../../assets/garden/animals/renard/adulte/walk_down_3.png'),
      require('../../assets/garden/animals/renard/adulte/walk_down_4.png'),
      require('../../assets/garden/animals/renard/adulte/walk_down_5.png'),
      require('../../assets/garden/animals/renard/adulte/walk_down_6.png'),
      require('../../assets/garden/animals/renard/adulte/walk_down_7.png'),
      require('../../assets/garden/animals/renard/adulte/walk_down_8.png'),
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
    jeune: [
      require('../../assets/garden/animals/lapin/jeune/walk_down_1.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_down_2.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_down_3.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_down_4.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_down_5.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_down_6.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_down_7.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_down_8.png'),
    ],
    adulte: [
      require('../../assets/garden/animals/lapin/adulte/walk_down_1.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_down_2.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_down_3.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_down_4.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_down_5.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_down_6.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_down_7.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_down_8.png'),
    ],
  },
  herisson: {
    jeune: [
      require('../../assets/garden/animals/herisson/jeune/walk_down_1.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_down_2.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_down_3.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_down_4.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_down_5.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_down_6.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_down_7.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_down_8.png'),
    ],
    adulte: [
      require('../../assets/garden/animals/herisson/adulte/walk_down_1.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_down_2.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_down_3.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_down_4.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_down_5.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_down_6.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_down_7.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_down_8.png'),
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
    jeune: [
      require('../../assets/garden/animals/chat/jeune/walk_up_1.png'),
      require('../../assets/garden/animals/chat/jeune/walk_up_2.png'),
      require('../../assets/garden/animals/chat/jeune/walk_up_3.png'),
      require('../../assets/garden/animals/chat/jeune/walk_up_4.png'),
      require('../../assets/garden/animals/chat/jeune/walk_up_5.png'),
      require('../../assets/garden/animals/chat/jeune/walk_up_6.png'),
      require('../../assets/garden/animals/chat/jeune/walk_up_7.png'),
      require('../../assets/garden/animals/chat/jeune/walk_up_8.png'),
    ],
    adulte: [
      require('../../assets/garden/animals/chat/adulte/walk_up_1.png'),
      require('../../assets/garden/animals/chat/adulte/walk_up_2.png'),
      require('../../assets/garden/animals/chat/adulte/walk_up_3.png'),
      require('../../assets/garden/animals/chat/adulte/walk_up_4.png'),
      require('../../assets/garden/animals/chat/adulte/walk_up_5.png'),
      require('../../assets/garden/animals/chat/adulte/walk_up_6.png'),
      require('../../assets/garden/animals/chat/adulte/walk_up_7.png'),
      require('../../assets/garden/animals/chat/adulte/walk_up_8.png'),
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
    jeune: [
      require('../../assets/garden/animals/chien/jeune/walk_up_1.png'),
      require('../../assets/garden/animals/chien/jeune/walk_up_2.png'),
      require('../../assets/garden/animals/chien/jeune/walk_up_3.png'),
      require('../../assets/garden/animals/chien/jeune/walk_up_4.png'),
      require('../../assets/garden/animals/chien/jeune/walk_up_5.png'),
      require('../../assets/garden/animals/chien/jeune/walk_up_6.png'),
    ],
    adulte: [
      require('../../assets/garden/animals/chien/adulte/walk_up_1.png'),
      require('../../assets/garden/animals/chien/adulte/walk_up_2.png'),
      require('../../assets/garden/animals/chien/adulte/walk_up_3.png'),
      require('../../assets/garden/animals/chien/adulte/walk_up_4.png'),
      require('../../assets/garden/animals/chien/adulte/walk_up_5.png'),
      require('../../assets/garden/animals/chien/adulte/walk_up_6.png'),
      require('../../assets/garden/animals/chien/adulte/walk_up_7.png'),
      require('../../assets/garden/animals/chien/adulte/walk_up_8.png'),
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
    jeune: [
      require('../../assets/garden/animals/renard/jeune/walk_up_1.png'),
      require('../../assets/garden/animals/renard/jeune/walk_up_2.png'),
      require('../../assets/garden/animals/renard/jeune/walk_up_3.png'),
      require('../../assets/garden/animals/renard/jeune/walk_up_4.png'),
      require('../../assets/garden/animals/renard/jeune/walk_up_5.png'),
      require('../../assets/garden/animals/renard/jeune/walk_up_6.png'),
    ],
    adulte: [
      require('../../assets/garden/animals/renard/adulte/walk_up_1.png'),
      require('../../assets/garden/animals/renard/adulte/walk_up_2.png'),
      require('../../assets/garden/animals/renard/adulte/walk_up_3.png'),
      require('../../assets/garden/animals/renard/adulte/walk_up_4.png'),
      require('../../assets/garden/animals/renard/adulte/walk_up_5.png'),
      require('../../assets/garden/animals/renard/adulte/walk_up_6.png'),
      require('../../assets/garden/animals/renard/adulte/walk_up_7.png'),
      require('../../assets/garden/animals/renard/adulte/walk_up_8.png'),
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
    jeune: [
      require('../../assets/garden/animals/lapin/jeune/walk_up_1.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_up_2.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_up_3.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_up_4.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_up_5.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_up_6.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_up_7.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_up_8.png'),
    ],
    adulte: [
      require('../../assets/garden/animals/lapin/adulte/walk_up_1.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_up_2.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_up_3.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_up_4.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_up_5.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_up_6.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_up_7.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_up_8.png'),
    ],
  },
  herisson: {
    jeune: [
      require('../../assets/garden/animals/herisson/jeune/walk_up_1.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_up_2.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_up_3.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_up_4.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_up_5.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_up_6.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_up_7.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_up_8.png'),
    ],
    adulte: [
      require('../../assets/garden/animals/herisson/adulte/walk_up_1.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_up_2.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_up_3.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_up_4.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_up_5.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_up_6.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_up_7.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_up_8.png'),
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
    jeune: [
      require('../../assets/garden/animals/chat/jeune/walk_left_1.png'),
      require('../../assets/garden/animals/chat/jeune/walk_left_2.png'),
      require('../../assets/garden/animals/chat/jeune/walk_left_3.png'),
      require('../../assets/garden/animals/chat/jeune/walk_left_4.png'),
      require('../../assets/garden/animals/chat/jeune/walk_left_5.png'),
      require('../../assets/garden/animals/chat/jeune/walk_left_6.png'),
      require('../../assets/garden/animals/chat/jeune/walk_left_7.png'),
      require('../../assets/garden/animals/chat/jeune/walk_left_8.png'),
    ],
    adulte: [
      require('../../assets/garden/animals/chat/adulte/walk_left_1.png'),
      require('../../assets/garden/animals/chat/adulte/walk_left_2.png'),
      require('../../assets/garden/animals/chat/adulte/walk_left_3.png'),
      require('../../assets/garden/animals/chat/adulte/walk_left_4.png'),
      require('../../assets/garden/animals/chat/adulte/walk_left_5.png'),
      require('../../assets/garden/animals/chat/adulte/walk_left_6.png'),
      require('../../assets/garden/animals/chat/adulte/walk_left_7.png'),
      require('../../assets/garden/animals/chat/adulte/walk_left_8.png'),
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
    jeune: [
      require('../../assets/garden/animals/chien/jeune/walk_left_1.png'),
      require('../../assets/garden/animals/chien/jeune/walk_left_2.png'),
      require('../../assets/garden/animals/chien/jeune/walk_left_3.png'),
      require('../../assets/garden/animals/chien/jeune/walk_left_4.png'),
      require('../../assets/garden/animals/chien/jeune/walk_left_5.png'),
      require('../../assets/garden/animals/chien/jeune/walk_left_6.png'),
    ],
    adulte: [
      require('../../assets/garden/animals/chien/adulte/walk_left_1.png'),
      require('../../assets/garden/animals/chien/adulte/walk_left_2.png'),
      require('../../assets/garden/animals/chien/adulte/walk_left_3.png'),
      require('../../assets/garden/animals/chien/adulte/walk_left_4.png'),
      require('../../assets/garden/animals/chien/adulte/walk_left_5.png'),
      require('../../assets/garden/animals/chien/adulte/walk_left_6.png'),
      require('../../assets/garden/animals/chien/adulte/walk_left_7.png'),
      require('../../assets/garden/animals/chien/adulte/walk_left_8.png'),
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
    jeune: [
      require('../../assets/garden/animals/renard/jeune/walk_left_1.png'),
      require('../../assets/garden/animals/renard/jeune/walk_left_2.png'),
      require('../../assets/garden/animals/renard/jeune/walk_left_3.png'),
      require('../../assets/garden/animals/renard/jeune/walk_left_4.png'),
      require('../../assets/garden/animals/renard/jeune/walk_left_5.png'),
      require('../../assets/garden/animals/renard/jeune/walk_left_6.png'),
    ],
    adulte: [
      require('../../assets/garden/animals/renard/adulte/walk_left_1.png'),
      require('../../assets/garden/animals/renard/adulte/walk_left_2.png'),
      require('../../assets/garden/animals/renard/adulte/walk_left_3.png'),
      require('../../assets/garden/animals/renard/adulte/walk_left_4.png'),
      require('../../assets/garden/animals/renard/adulte/walk_left_5.png'),
      require('../../assets/garden/animals/renard/adulte/walk_left_6.png'),
      require('../../assets/garden/animals/renard/adulte/walk_left_7.png'),
      require('../../assets/garden/animals/renard/adulte/walk_left_8.png'),
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
    jeune: [
      require('../../assets/garden/animals/lapin/jeune/walk_left_1.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_left_2.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_left_3.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_left_4.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_left_5.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_left_6.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_left_7.png'),
      require('../../assets/garden/animals/lapin/jeune/walk_left_8.png'),
    ],
    adulte: [
      require('../../assets/garden/animals/lapin/adulte/walk_left_1.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_left_2.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_left_3.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_left_4.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_left_5.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_left_6.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_left_7.png'),
      require('../../assets/garden/animals/lapin/adulte/walk_left_8.png'),
    ],
  },
  herisson: {
    jeune: [
      require('../../assets/garden/animals/herisson/jeune/walk_left_1.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_left_2.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_left_3.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_left_4.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_left_5.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_left_6.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_left_7.png'),
      require('../../assets/garden/animals/herisson/jeune/walk_left_8.png'),
    ],
    adulte: [
      require('../../assets/garden/animals/herisson/adulte/walk_left_1.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_left_2.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_left_3.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_left_4.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_left_5.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_left_6.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_left_7.png'),
      require('../../assets/garden/animals/herisson/adulte/walk_left_8.png'),
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

/** Phase 42 — Spring config pour l'animation feed (pulse + recul) */
const SPRING_FEED = { damping: 10, stiffness: 180 } as const;

/** Type feedState — synchronisé avec affinité crop */
export type FeedState = 'eating-preferred' | 'eating-neutral' | 'eating-hated' | null;

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
  onLongPress?: () => void;         // Phase 42 — tap long ouvre FeedPicker (D-29)
  containerWidth: number;
  containerHeight: number;
  harvestables?: HarvestableInfo[];  // crops prêtes à récolter
  plantedCropYs?: number[];         // positions Y des rangées avec cultures plantées
  builtBuildingYs?: number[];       // positions Y des bâtiments construits
  hasLake?: boolean;                // true si le lac est visible (stade >= pousse)
  paused?: boolean;                 // stopper animations quand app en background
  feedState?: FeedState;            // Phase 42 — déclenche animation pulse/recul selon affinité
}

// ── Composant ─────────────────────────────────────────

export const CompanionSlot = React.memo(function CompanionSlot({
  species,
  stage,
  mood,
  name,
  message,
  onTap,
  onLongPress,
  containerWidth,
  containerHeight,
  harvestables = [],
  plantedCropYs = [],
  builtBuildingYs = [],
  hasLake = true,
  paused = false,
  feedState = null,
}: CompanionSlotProps) {
  const { colors } = useThemeColors();
  const [frameIdx, setFrameIdx] = useState(0);
  const [facingLeft, setFacingLeft] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [isHorizontal, setIsHorizontal] = useState(false);
  const [goingUp, setGoingUp] = useState(false);
  const [walkFrameIdx, setWalkFrameIdx] = useState(0);
  const currentFx = React.useRef(0.42);
  const currentFy = React.useRef(0.55);

  // Valeurs animées
  const jumpY = useSharedValue(0);
  const scale = useSharedValue(1);
  const bubbleAnim = useSharedValue(0);
  const posX = useSharedValue(0);
  const posY = useSharedValue(0);
  // Phase 42 — valeurs animées feed (pulse + recul si détesté)
  const feedScale = useSharedValue(1);
  const feedTranslateX = useSharedValue(0);

  // Frame swap idle — plus rapide en marchant (300ms) qu'au repos (800ms)
  // Stoppé quand paused (app en background)
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setFrameIdx(f => (f + 1) % 2);
    }, isWalking ? 300 : 800);
    return () => clearInterval(interval);
  }, [isWalking, paused]);

  // Walk frame cycle (pour les sprites de marche)
  useEffect(() => {
    if (paused || !isWalking) { setWalkFrameIdx(0); return; }
    const interval = setInterval(() => {
      setWalkFrameIdx(f => (f + 1) % 24);
    }, 150);
    return () => clearInterval(interval);
  }, [isWalking, paused]);

  // Message de récolte autonome (pas le message IA — celui-ci vient du compagnon lui-même)
  const [harvestHint, setHarvestHint] = useState<string | null>(null);
  const harvestablesRef = React.useRef(harvestables);
  useEffect(() => { harvestablesRef.current = harvestables; }, [harvestables]);

  // Construire les zones marchables selon l'état réel de la ferme
  const activeZones = React.useMemo((): WalkableZone[] => {
    const zones: WalkableZone[] = [];

    // ── Zones statiques (toujours présentes) ──

    // Zone repos près de l'arbre — favorite du compagnon
    zones.push({
      id: 'home-area',
      xMin: 0.38, xMax: 0.48,
      yMin: 0.50, yMax: 0.60,
      weight: 4,
      pauseMin: 2000, pauseMax: 6000,
    });

    // Chemin vertical principal
    zones.push({
      id: 'path-central',
      xMin: 0.38, xMax: 0.46,
      yMin: 0.38, yMax: 0.65,
      weight: 3,
      pauseMin: 1000, pauseMax: 4000,
    });

    // Bifurcation sud
    zones.push({
      id: 'path-south',
      xMin: 0.30, xMax: 0.46,
      yMin: 0.60, yMax: 0.68,
      weight: 1,
      pauseMin: 500, pauseMax: 2000,
    });

    // ── Zones dynamiques : potager ──
    // Une zone par rangée de crops, positionnée ENTRE les rangées
    // pour que le compagnon ne marche jamais sur les cultures
    const cropYsSorted = [...plantedCropYs].sort((a, b) => b - a);
    for (const fy of cropYsSorted) {
      const walkY = fy + 0.04; // passer entre les rangées
      zones.push({
        id: `crops-${fy}`,
        xMin: 0.14, xMax: 0.70,
        yMin: walkY - 0.02, yMax: walkY + 0.02,
        weight: 2,
        pauseMin: 1000, pauseMax: 3000,
      });
    }

    // ── Zones dynamiques : bâtiments ──
    const buildYsSorted = [...builtBuildingYs].sort((a, b) => a - b);
    if (buildYsSorted.length > 0) {
      const minY = buildYsSorted[0];
      const maxY = buildYsSorted[buildYsSorted.length - 1];

      // Chemin d'accès vers les bâtiments
      zones.push({
        id: 'path-to-buildings',
        xMin: 0.46, xMax: 0.90,
        yMin: 0.43, yMax: 0.47,
        weight: 1,
        pauseMin: 0, pauseMax: 500,
      });

      // Zone devant les bâtiments construits
      zones.push({
        id: 'buildings-area',
        xMin: 0.85, xMax: 0.92,
        yMin: Math.max(0.40, minY - 0.02),
        yMax: Math.min(0.90, maxY + 0.05),
        weight: 2,
        pauseMin: 2000, pauseMax: 4000,
      });
    }

    // ── Zone dynamique : lac ──
    if (hasLake) {
      zones.push({
        id: 'lake-shore',
        xMin: 0.14, xMax: 0.22,
        yMin: 0.63, yMax: 0.78,
        weight: 2,
        pauseMin: 3000, pauseMax: 6000,
      });
    }

    return zones;
  }, [plantedCropYs, builtBuildingYs, hasLake]);

  // Référence à la dernière zone visitée (pour éviter 2 fois de suite la même)
  const lastZoneIdRef = React.useRef<string | null>(null);

  // Mouvement organique — choisit des destinations aléatoires dans les zones marchables
  // Stoppé quand paused (app en background) — reprend au retour
  useEffect(() => {
    if (paused) return;
    let mounted = true;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
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

      posX.value = withTiming((targetFx - HOME_FX) * containerWidth, { duration, easing: Easing.inOut(Easing.sin) });
      posY.value = withTiming((targetFy - HOME_FY) * containerHeight, { duration, easing: Easing.inOut(Easing.sin) });
      currentFx.current = targetFx;
      currentFy.current = targetFy;

      const stopWalk = setTimeout(() => {
        if (mounted) setIsWalking(false);
        onArrive?.();
      }, duration);
      timeouts.push(stopWalk);

      return duration;
    };

    /** Sélection aléatoire pondérée parmi les zones disponibles */
    const pickZone = (): WalkableZone => {
      const zones = activeZones;
      // Si plusieurs zones disponibles, exclure la dernière visitée
      const candidates = zones.length > 1
        ? zones.filter(z => z.id !== lastZoneIdRef.current)
        : zones;

      const totalWeight = candidates.reduce((sum, z) => sum + z.weight, 0);
      let rand = Math.random() * totalWeight;
      for (const zone of candidates) {
        rand -= zone.weight;
        if (rand <= 0) return zone;
      }
      return candidates[candidates.length - 1];
    };

    /** Générer un point aléatoire dans une zone avec micro-variation */
    const randomPointInZone = (zone: WalkableZone): { fx: number; fy: number } => {
      const fx = zone.xMin + Math.random() * (zone.xMax - zone.xMin);
      const fy = zone.yMin + Math.random() * (zone.yMax - zone.yMin);
      // Micro-variation ±0.015 pour éviter les arrêts exactement au même point
      const microFx = Math.max(zone.xMin, Math.min(zone.xMax, fx + (Math.random() - 0.5) * 0.03));
      const microFy = Math.max(zone.yMin, Math.min(zone.yMax, fy + (Math.random() - 0.5) * 0.03));
      return { fx: microFx, fy: microFy };
    };

    const walkNext = () => {
      if (!mounted) return;

      const zone = pickZone();
      lastZoneIdRef.current = zone.id;

      // Reset le cycle harvest quand on revient dans la zone home-area
      if (zone.id === 'home-area') visitedHarvestThisCycle = false;

      // Détour récolte — une seule fois par cycle, quand on passe dans une zone crops
      const readyCrops = harvestablesRef.current;
      if (
        readyCrops.length > 0 &&
        !visitedHarvestThisCycle &&
        zone.id.startsWith('crops-')
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
        // Après le détour, reprendre le mouvement aléatoire normal
        const t = setTimeout(walkNext, duration + 4000);
        timeouts.push(t);
        return;
      }

      // Se déplacer vers un point aléatoire dans la zone choisie
      const { fx, fy } = randomPointInZone(zone);
      const duration = walkTo(fx, fy);

      // Pause variable selon la zone, puis prochaine destination
      const pause = zone.pauseMin + Math.random() * (zone.pauseMax - zone.pauseMin);
      const t = setTimeout(walkNext, duration + pause);
      timeouts.push(t);
    };

    // Premier déplacement après 3s
    const initial = setTimeout(walkNext, 3000);
    timeouts.push(initial);

    return () => {
      mounted = false;
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [containerWidth, containerHeight, activeZones, paused]);

  // Animer la bulle de message ou harvest hint
  useEffect(() => {
    if (message || harvestHint) {
      bubbleAnim.value = withTiming(1, { duration: 200 });
    } else {
      bubbleAnim.value = withTiming(0, { duration: 500 });
    }
  }, [message, harvestHint]);

  // Phase 42 — Animation feed (pulse joyeux OU recul + secousse si détesté)
  useEffect(() => {
    if (!feedState) {
      feedScale.value = withTiming(1, { duration: 200 });
      feedTranslateX.value = withTiming(0, { duration: 200 });
      return;
    }
    if (feedState === 'eating-hated') {
      // Recul + petite secousse, pas de scale joyeux
      feedTranslateX.value = withSequence(
        withTiming(-8, { duration: 200 }),
        withTiming(0, { duration: 400 }),
      );
      feedScale.value = withSequence(
        withSpring(0.9, SPRING_FEED),
        withSpring(1.0, SPRING_FEED),
      );
    } else {
      // eating-preferred ou eating-neutral : pulse joyeux
      const peak = feedState === 'eating-preferred' ? 1.3 : 1.15;
      feedScale.value = withSequence(
        withSpring(peak, SPRING_FEED),
        withSpring(1.0, SPRING_FEED),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedState]);

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

  // Style du sprite (saut + flip directionnel + pulse feed Phase 42)
  const companionAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: jumpY.value },
      { translateX: feedTranslateX.value },
      { scale: scale.value * feedScale.value },
    ],
  }));

  const bubbleAnimStyle = useAnimatedStyle(() => ({
    opacity: bubbleAnim.value,
    transform: [
      { translateY: (1 - bubbleAnim.value) * 4 },
    ],
  }));

  // Position pixel dans le container (point de repos)
  const px = HOME_FX * containerWidth;
  const py = HOME_FY * containerHeight;

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

      {/* Sprite animé du compagnon + overlay particules */}
      <Pressable onPress={handleTap} onLongPress={onLongPress} accessibilityLabel={name}>
        <View style={styles.spriteWrap}>
          <Animated.View style={companionAnimStyle}>
            <Image
              source={currentSprite}
              style={[styles.sprite, flipX && { transform: [{ scaleX: -1 }] }]}
              resizeMode="contain"
            />
          </Animated.View>
          {/* Particules feed — rendues au-dessus du sprite, suivent moveStyle via le parent */}
          <View pointerEvents="none" style={styles.particlesAnchor}>
            <FeedParticles
              visible={!!feedState}
              affinity={feedState ? (feedState.replace('eating-', '') as CropAffinity) : 'neutral'}
              x={PARTICLE_ANCHOR_W / 2}
              y={PARTICLE_EMITTER_Y}
            />
          </View>
        </View>
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
  spriteWrap: {
    width: COMPANION_SIZE,
    height: COMPANION_SIZE,
    overflow: 'visible',
  },
  particlesAnchor: {
    position: 'absolute',
    // Centré horizontalement sur le sprite (wrap = 48×48)
    left: COMPANION_SIZE / 2 - PARTICLE_ANCHOR_W / 2,
    // Le bas de l'ancre arrive à ~20px sous le haut du sprite (là où l'émetteur est placé)
    top: -(PARTICLE_ANCHOR_H - 20),
    width: PARTICLE_ANCHOR_W,
    height: PARTICLE_ANCHOR_H,
    overflow: 'visible',
    zIndex: 100,
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
