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
import { COMPANION_SPRITES } from '../../lib/mascot/companion-sprites';

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
  // ══ Départ : sur le chemin, au centre ══
  { fx: 0.42, fy: 0.55, label: 'home',             pause: 3000 },

  // ══ 1. Monter le chemin vers le potager ══
  { fx: 0.42, fy: 0.45, label: 'path-up-1',        pause: 0 },
  { fx: 0.42, fy: 0.38, label: 'path-potager',     pause: 500 },

  // ══ 2. Entrer dans le potager (zig-zag rang 3 → 1) ══
  { fx: 0.28, fy: 0.23, label: 'crops-r3-left',    pause: 2000 },
  { fx: 0.56, fy: 0.23, label: 'crops-r3-right',   pause: 1500 },
  { fx: 0.42, fy: 0.14, label: 'crops-r2-mid',     pause: 2000 },
  { fx: 0.14, fy: 0.05, label: 'crops-r1-left',    pause: 1500 },
  { fx: 0.70, fy: 0.05, label: 'crops-r1-right',   pause: 2000 },

  // ══ 3. Sortir du potager par le chemin ══
  { fx: 0.42, fy: 0.14, label: 'crops-exit-1',     pause: 0 },
  { fx: 0.42, fy: 0.38, label: 'crops-exit-2',     pause: 500 },

  // ══ 4. Descendre au croisement, puis tourner vers les bâtiments ══
  { fx: 0.42, fy: 0.45, label: 'path-junction',    pause: 300 },
  { fx: 0.55, fy: 0.45, label: 'path-to-build-1',  pause: 0 },
  { fx: 0.70, fy: 0.45, label: 'path-to-build-2',  pause: 0 },
  { fx: 0.85, fy: 0.45, label: 'path-to-build-3',  pause: 0 },

  // ══ 5. Visiter les bâtiments (longer la zone pavée) ══
  { fx: 0.90, fy: 0.45, label: 'building-entry',   pause: 0 },
  { fx: 0.90, fy: 0.52, label: 'building-1',       pause: 3000 },
  { fx: 0.90, fy: 0.62, label: 'building-2',       pause: 2500 },
  { fx: 0.90, fy: 0.78, label: 'building-3',       pause: 2000 },

  // ══ 6. Retour : remonter les bâtiments, puis chemin horizontal ══
  { fx: 0.90, fy: 0.45, label: 'build-return-0',   pause: 0 },
  { fx: 0.70, fy: 0.45, label: 'build-return-1',   pause: 0 },
  { fx: 0.42, fy: 0.45, label: 'build-return-2',   pause: 800 },

  // ══ 7. Descendre le chemin vertical ══
  { fx: 0.42, fy: 0.55, label: 'path-mid',         pause: 500 },
  { fx: 0.42, fy: 0.65, label: 'path-down-1',      pause: 300 },

  // ══ 8. Tourner à gauche vers le lac (rester sur le chemin) ══
  { fx: 0.30, fy: 0.65, label: 'path-lake-1',      pause: 0 },
  { fx: 0.17, fy: 0.65, label: 'path-lake-2',      pause: 300 },
  { fx: 0.17, fy: 0.75, label: 'path-lake-3',      pause: 0 },

  // ══ 9. Contempler le lac ══
  { fx: 0.17, fy: 0.80, label: 'lake-shore',       pause: 4000 },

  // ══ 10. Retour vers le chemin principal ══
  { fx: 0.17, fy: 0.65, label: 'lake-return-1',    pause: 0 },
  { fx: 0.42, fy: 0.65, label: 'lake-return-2',    pause: 0 },
  { fx: 0.42, fy: 0.55, label: 'lake-return-3',    pause: 500 },
];

const HOME_IDX = 0;

// ── Sprites Mana Seed ─────────────────────────────────
// Phase 29 : COMPANION_SPRITES extrait dans `lib/mascot/companion-sprites.ts`
// pour partage avec VillageAvatar. Importe en tete de fichier.

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
  plantedCropYs?: number[];         // positions Y des rangées avec cultures plantées
  builtBuildingYs?: number[];       // positions Y des bâtiments construits
  hasLake?: boolean;                // true si le lac est visible (stade >= pousse)
  paused?: boolean;                 // stopper animations quand app en background
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
  plantedCropYs = [],
  builtBuildingYs = [],
  hasLake = true,
  paused = false,
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

  // Construire la route dynamique selon l'état réel de la ferme
  const activeRoute = React.useMemo(() => {
    type WP = { fx: number; fy: number; label: string; pause: number };
    const route: WP[] = [];

    // Toujours : point de départ sur le chemin
    route.push({ fx: 0.42, fy: 0.55, label: 'home', pause: 3000 });

    // ── Potager : ne visiter que les rangées avec des crops ──
    // Rangées possibles : y=0.05 (r1), y=0.14 (r2), y=0.23 (r3), y=0.32 (r4 expansion)
    const cropYsSorted = [...plantedCropYs].sort((a, b) => b - a); // du bas vers le haut
    if (cropYsSorted.length > 0) {
      // Monter vers le potager via le chemin
      route.push({ fx: 0.42, fy: 0.45, label: 'path-up-1', pause: 0 });
      route.push({ fx: 0.42, fy: 0.38, label: 'path-potager', pause: 500 });

      // Visiter chaque rangée occupée — passer ENTRE les lignes (fy + 0.04)
      // pour ne jamais marcher sur les crops
      let goLeft = true;
      for (const fy of cropYsSorted) {
        const walkY = fy + 0.04; // entre cette rangée et la suivante
        if (goLeft) {
          route.push({ fx: 0.14, fy: walkY, label: `crops-${fy}-left`, pause: 1500 });
          route.push({ fx: 0.70, fy: walkY, label: `crops-${fy}-right`, pause: 1500 });
        } else {
          route.push({ fx: 0.70, fy: walkY, label: `crops-${fy}-right`, pause: 1500 });
          route.push({ fx: 0.14, fy: walkY, label: `crops-${fy}-left`, pause: 1500 });
        }
        goLeft = !goLeft;
      }

      // Redescendre vers le chemin (passer par le centre)
      route.push({ fx: 0.42, fy: 0.36, label: 'crops-exit-1', pause: 0 });
      route.push({ fx: 0.42, fy: 0.38, label: 'crops-exit-2', pause: 500 });
    }

    // ── Bâtiments : ne visiter que ceux construits ──
    const buildYsSorted = [...builtBuildingYs].sort((a, b) => a - b); // du haut vers le bas
    if (buildYsSorted.length > 0) {
      route.push({ fx: 0.42, fy: 0.45, label: 'path-junction', pause: 300 });
      route.push({ fx: 0.55, fy: 0.45, label: 'path-to-build-1', pause: 0 });
      route.push({ fx: 0.70, fy: 0.45, label: 'path-to-build-2', pause: 0 });
      route.push({ fx: 0.85, fy: 0.45, label: 'path-to-build-3', pause: 0 });
      route.push({ fx: 0.90, fy: 0.45, label: 'building-entry', pause: 0 });

      // Descendre seulement jusqu'au dernier bâtiment construit
      for (let i = 0; i < buildYsSorted.length; i++) {
        route.push({ fx: 0.90, fy: buildYsSorted[i], label: `building-${i}`, pause: 2500 });
      }

      // Remonter et retour
      route.push({ fx: 0.90, fy: 0.45, label: 'build-return-0', pause: 0 });
      route.push({ fx: 0.70, fy: 0.45, label: 'build-return-1', pause: 0 });
      route.push({ fx: 0.42, fy: 0.45, label: 'build-return-2', pause: 800 });
    }

    // Retour au centre du chemin
    route.push({ fx: 0.42, fy: 0.55, label: 'path-mid', pause: 500 });

    // ── Lac ──
    if (hasLake) {
      route.push({ fx: 0.42, fy: 0.65, label: 'path-down-1', pause: 300 });
      route.push({ fx: 0.30, fy: 0.65, label: 'path-lake-1', pause: 0 });
      route.push({ fx: 0.17, fy: 0.65, label: 'path-lake-2', pause: 300 });
      route.push({ fx: 0.17, fy: 0.74, label: 'lake-shore', pause: 4000 });
      route.push({ fx: 0.17, fy: 0.65, label: 'lake-return-1', pause: 0 });
      route.push({ fx: 0.42, fy: 0.65, label: 'lake-return-2', pause: 0 });
      route.push({ fx: 0.42, fy: 0.55, label: 'lake-return-3', pause: 500 });
    }

    return route;
  }, [plantedCropYs, builtBuildingYs, hasLake]);

  // Patrouille séquentielle — suit la route active en boucle
  // Stoppée quand paused (app en background) — reprend au retour
  useEffect(() => {
    if (paused) return;
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

      const homeFx = activeRoute[HOME_IDX].fx;
      const homeFy = activeRoute[HOME_IDX].fy;
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

      const step = activeRoute[routeIdx];

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
      routeIdx = (routeIdx + 1) % activeRoute.length;

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
  }, [containerWidth, containerHeight, activeRoute, paused]);

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
  const home = activeRoute[HOME_IDX];
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
