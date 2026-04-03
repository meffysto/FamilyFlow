/**
 * badges.ts — Systeme de badges d'accomplissement a paliers
 *
 * Calcule les badges et leur progression depuis les donnees existantes
 * du profil et de la gamification. Pas de persistance supplementaire.
 */

import type { PlacedBuilding } from './types';

// ── Types minimaux pour le calcul des badges ──────────────────

/** Profil minimaliste suffisant pour calculer les badges */
export interface BadgeProfile {
  level: number;
  streak: number;
  craftedItems?: Array<{ recipeId: string; craftedAt: string }>;
  farmBuildings?: PlacedBuilding[];
  farmTech?: string[];
}

/** Entrée d'historique de gamification */
export interface BadgeHistoryEntry {
  profileId: string;
  action: string;
  points: number;
  note: string;
  timestamp: string;
}

/** Données de gamification minimales pour le calcul des badges */
export interface BadgeGamificationData {
  history: BadgeHistoryEntry[];
}

// ── Types ──────────────────────────────────────

export type BadgeTier = 'none' | 'bronze' | 'argent' | 'or' | 'diamant';

export interface BadgeDefinition {
  id: string;
  emoji: string;
  labelKey: string;
  descriptionKey: string;
  thresholds: [number, number, number, number]; // bronze, argent, or, diamant
  getValue: (profile: BadgeProfile, gamiData: BadgeGamificationData) => number;
}

export interface BadgeProgress {
  badge: BadgeDefinition;
  currentValue: number;
  currentTier: BadgeTier;
  nextThreshold: number | null;
  progress: number; // 0-1 vers le prochain palier
}

// ── Paliers ──────────────────────────────────────

export const TIER_EMOJI: Record<BadgeTier, string> = {
  none: '⬜',
  bronze: '🥉',
  argent: '🥈',
  or: '🥇',
  diamant: '💎',
};

export const TIER_ORDER: BadgeTier[] = ['none', 'bronze', 'argent', 'or', 'diamant'];

// ── Catalogue de badges ──────────────────────────

export const BADGES: BadgeDefinition[] = [
  {
    id: 'jardinier',
    emoji: '🌱',
    labelKey: 'badges.jardinier',
    descriptionKey: 'badges.jardinier_desc',
    thresholds: [10, 50, 200, 1000],
    getValue: (_p, gami) => {
      // Compter les entrees d'historique de type recolte
      return gami.history.filter(e => e.note?.includes('colte') || e.note?.includes('harvest')).length;
    },
  },
  {
    id: 'cuistot',
    emoji: '👨‍🍳',
    labelKey: 'badges.cuistot',
    descriptionKey: 'badges.cuistot_desc',
    thresholds: [5, 20, 100, 500],
    getValue: (p) => (p.craftedItems ?? []).length,
  },
  {
    id: 'animaux',
    emoji: '🐔',
    labelKey: 'badges.animaux',
    descriptionKey: 'badges.animaux_desc',
    thresholds: [10, 50, 200, 1000],
    getValue: (_p, gami) => {
      return gami.history.filter(e => e.note?.includes('batiment') || e.note?.includes('building')).length;
    },
  },
  {
    id: 'regulier',
    emoji: '🔥',
    labelKey: 'badges.regulier',
    descriptionKey: 'badges.regulier_desc',
    thresholds: [7, 14, 30, 100],
    getValue: (p) => p.streak,
  },
  {
    id: 'batisseur',
    emoji: '🏗️',
    labelKey: 'badges.batisseur',
    descriptionKey: 'badges.batisseur_desc',
    thresholds: [1, 2, 3, 6],
    getValue: (p) => {
      const buildings = p.farmBuildings ?? [];
      return buildings.reduce((sum, b) => sum + b.level, 0);
    },
  },
  {
    id: 'savant',
    emoji: '🧪',
    labelKey: 'badges.savant',
    descriptionKey: 'badges.savant_desc',
    thresholds: [1, 3, 6, 10],
    getValue: (p) => (p.farmTech ?? []).length,
  },
  {
    id: 'assidu',
    emoji: '⭐',
    labelKey: 'badges.assidu',
    descriptionKey: 'badges.assidu_desc',
    thresholds: [50, 200, 1000, 5000],
    getValue: (_p, gami) => gami.history.length,
  },
  {
    id: 'explorateur',
    emoji: '🗺️',
    labelKey: 'badges.explorateur',
    descriptionKey: 'badges.explorateur_desc',
    thresholds: [3, 6, 11, 19],
    getValue: (p) => p.level,
  },
];

// ── Calculs ──────────────────────────────────────

export function getTier(value: number, thresholds: [number, number, number, number]): BadgeTier {
  if (value >= thresholds[3]) return 'diamant';
  if (value >= thresholds[2]) return 'or';
  if (value >= thresholds[1]) return 'argent';
  if (value >= thresholds[0]) return 'bronze';
  return 'none';
}

export function getBadgeProgress(
  badge: BadgeDefinition,
  profile: BadgeProfile,
  gamiData: BadgeGamificationData,
): BadgeProgress {
  const currentValue = badge.getValue(profile, gamiData);
  const currentTier = getTier(currentValue, badge.thresholds);

  const tierIdx = TIER_ORDER.indexOf(currentTier);
  const nextThresholdIdx = tierIdx; // 'none' → thresholds[0], 'bronze' → thresholds[1], etc.
  const nextThreshold = nextThresholdIdx < 4 ? badge.thresholds[nextThresholdIdx] : null;

  let progress = 0;
  if (nextThreshold !== null) {
    const prevThreshold = nextThresholdIdx > 0 ? badge.thresholds[nextThresholdIdx - 1] : 0;
    const range = nextThreshold - prevThreshold;
    progress = range > 0 ? Math.min(1, (currentValue - prevThreshold) / range) : 1;
  } else {
    progress = 1;
  }

  return { badge, currentValue, currentTier, nextThreshold, progress };
}

export function getAllBadgeProgress(
  profile: BadgeProfile,
  gamiData: BadgeGamificationData,
): BadgeProgress[] {
  return BADGES.map(b => getBadgeProgress(b, profile, gamiData));
}
