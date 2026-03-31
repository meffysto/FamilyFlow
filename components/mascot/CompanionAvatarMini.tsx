/**
 * CompanionAvatarMini.tsx — Avatar compagnon miniature pour la tab bar et le profile picker
 *
 * Affiche le sprite idle_1 du compagnon au stade correspondant au niveau.
 * Fallback vers l'emoji avatar si pas de compagnon ou sprite indisponible.
 */

import React from 'react';
import { Image, Text, type ImageSourcePropType } from 'react-native';
import type { CompanionSpecies, CompanionStage } from '@/lib/mascot/companion-types';
import type { CompanionData } from '@/lib/mascot/companion-types';
import { getCompanionStage } from '@/lib/mascot/companion-engine';

// ─── Sprites idle_1 par espèce et stade ─────────────────────────────────────────

const AVATAR_SPRITES: Record<CompanionSpecies, Record<CompanionStage, ImageSourcePropType>> = {
  chat: {
    bebe: require('@/assets/garden/animals/chat/bebe/idle_1.png'),
    jeune: require('@/assets/garden/animals/chat/jeune/idle_1.png'),
    adulte: require('@/assets/garden/animals/chat/adulte/idle_1.png'),
  },
  chien: {
    bebe: require('@/assets/garden/animals/chien/bebe/idle_1.png'),
    jeune: require('@/assets/garden/animals/chien/jeune/idle_1.png'),
    adulte: require('@/assets/garden/animals/chien/adulte/idle_1.png'),
  },
  lapin: {
    bebe: require('@/assets/garden/animals/lapin/bebe/idle_1.png'),
    jeune: require('@/assets/garden/animals/lapin/jeune/idle_1.png'),
    adulte: require('@/assets/garden/animals/lapin/adulte/idle_1.png'),
  },
  renard: {
    bebe: require('@/assets/garden/animals/renard/bebe/idle_1.png'),
    jeune: require('@/assets/garden/animals/renard/jeune/idle_1.png'),
    adulte: require('@/assets/garden/animals/renard/adulte/idle_1.png'),
  },
  herisson: {
    bebe: require('@/assets/garden/animals/herisson/bebe/idle_1.png'),
    jeune: require('@/assets/garden/animals/herisson/jeune/idle_1.png'),
    adulte: require('@/assets/garden/animals/herisson/adulte/idle_1.png'),
  },
};

// ─── Props ───────────────────────────────────────────────────────────────────────

interface CompanionAvatarMiniProps {
  /** Données du compagnon actif — null/undefined → fallback emoji */
  companion: CompanionData | null | undefined;
  /** Niveau du profil pour déterminer le stade du compagnon */
  level: number;
  /** Emoji de fallback affiché si pas de compagnon */
  fallbackEmoji: string;
  /** Taille en points de l'image (width = height = size) */
  size: number;
}

// ─── Composant ───────────────────────────────────────────────────────────────────

/** Emoji de fallback par espèce — utilisé tant que les vrais sprites ne sont pas fournis */
const SPECIES_EMOJI: Record<CompanionSpecies, string> = {
  chat: '🐱',
  chien: '🐶',
  lapin: '🐰',
  renard: '🦊',
  herisson: '🦔',
};

export const CompanionAvatarMini = React.memo(function CompanionAvatarMini({
  companion,
  level,
  fallbackEmoji,
  size,
}: CompanionAvatarMiniProps) {
  if (!companion) {
    return <Text style={{ fontSize: size * 0.8 }}>{fallbackEmoji}</Text>;
  }

  // Utiliser l'emoji de l'espèce comme avatar — les sprites placeholder sont trop petits
  const speciesKey = companion.activeSpecies.toLowerCase() as CompanionSpecies;
  const emoji = SPECIES_EMOJI[speciesKey] ?? fallbackEmoji;
  return <Text style={{ fontSize: size * 0.8 }}>{emoji}</Text>;
});
