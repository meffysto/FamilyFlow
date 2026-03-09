/**
 * defiTemplates.ts — Templates de défis familiaux pré-construits
 */

import type { DefiType } from '../lib/types';

export interface DefiTemplate {
  id: string;
  title: string;
  description: string;
  type: DefiType;
  emoji: string;
  difficulty: 'facile' | 'moyen' | 'difficile';
  targetDays: number;
  targetMetric?: number;
  metricUnit?: string;
  category: DefiCategory;
}

export type DefiCategory = 'ecrans' | 'cuisine' | 'lecture' | 'sport' | 'menage' | 'nature' | 'famille';

export const DEFI_CATEGORY_LABELS: Record<DefiCategory, { label: string; emoji: string }> = {
  ecrans: { label: 'Écrans', emoji: '📵' },
  cuisine: { label: 'Cuisine', emoji: '👨‍🍳' },
  lecture: { label: 'Lecture', emoji: '📚' },
  sport: { label: 'Sport', emoji: '🏃' },
  menage: { label: 'Ménage', emoji: '🧹' },
  nature: { label: 'Nature', emoji: '🌿' },
  famille: { label: 'Famille', emoji: '👨‍👩‍👧‍👦' },
};

/** Barème récompenses par difficulté */
export const DEFI_REWARDS: Record<'facile' | 'moyen' | 'difficile', { points: number; lootBoxes: number }> = {
  facile: { points: 15, lootBoxes: 0 },
  moyen: { points: 30, lootBoxes: 1 },
  difficile: { points: 50, lootBoxes: 2 },
};

/** Bonus ×1.5 pts si durée > 14 jours */
export function computeRewardPoints(difficulty: 'facile' | 'moyen' | 'difficile', targetDays: number): number {
  const base = DEFI_REWARDS[difficulty].points;
  return targetDays > 14 ? Math.round(base * 1.5) : base;
}

export const DEFI_TEMPLATES: DefiTemplate[] = [
  // Écrans
  {
    id: 'ecrans_soiree',
    title: 'Soirée sans écran',
    description: 'Pas d\'écran après 19h pendant toute la durée du défi',
    type: 'abstinence',
    emoji: '📵',
    difficulty: 'difficile',
    targetDays: 7,
    category: 'ecrans',
  },
  {
    id: 'ecrans_weekend',
    title: 'Week-end déconnecté',
    description: 'Pas de téléphone le week-end (sauf urgences)',
    type: 'abstinence',
    emoji: '🔇',
    difficulty: 'moyen',
    targetDays: 2,
    category: 'ecrans',
  },
  // Cuisine
  {
    id: 'cuisine_famille',
    title: 'Tous en cuisine',
    description: 'Cuisiner un repas en famille chaque jour',
    type: 'daily',
    emoji: '👨‍🍳',
    difficulty: 'moyen',
    targetDays: 7,
    category: 'cuisine',
  },
  {
    id: 'cuisine_nouveau',
    title: 'Recette inédite',
    description: 'Tester une nouvelle recette chaque jour',
    type: 'daily',
    emoji: '🍳',
    difficulty: 'difficile',
    targetDays: 5,
    category: 'cuisine',
  },
  // Lecture
  {
    id: 'lecture_30min',
    title: '30 min de lecture/jour',
    description: 'Lire au moins 30 minutes chaque jour',
    type: 'cumulative',
    emoji: '📖',
    difficulty: 'moyen',
    targetDays: 14,
    targetMetric: 420,
    metricUnit: 'min',
    category: 'lecture',
  },
  {
    id: 'lecture_histoire',
    title: 'Histoire du soir',
    description: 'Lire une histoire aux enfants chaque soir',
    type: 'daily',
    emoji: '🌙',
    difficulty: 'facile',
    targetDays: 7,
    category: 'lecture',
  },
  // Sport
  {
    id: 'sport_marche',
    title: 'Marche quotidienne',
    description: 'Faire au moins 30 min de marche en famille',
    type: 'cumulative',
    emoji: '🚶',
    difficulty: 'moyen',
    targetDays: 7,
    targetMetric: 210,
    metricUnit: 'min',
    category: 'sport',
  },
  {
    id: 'sport_10000',
    title: '10 000 pas/jour',
    description: 'Atteindre 10 000 pas chaque jour',
    type: 'cumulative',
    emoji: '👟',
    difficulty: 'difficile',
    targetDays: 7,
    targetMetric: 70000,
    metricUnit: 'pas',
    category: 'sport',
  },
  // Ménage
  {
    id: 'menage_ranger',
    title: 'Chambre rangée',
    description: 'Ranger sa chambre chaque matin avant de partir',
    type: 'daily',
    emoji: '🛏️',
    difficulty: 'facile',
    targetDays: 7,
    category: 'menage',
  },
  // Nature
  {
    id: 'nature_sortie',
    title: 'Sortie nature',
    description: 'Passer du temps dehors chaque jour (parc, jardin, forêt)',
    type: 'daily',
    emoji: '🌳',
    difficulty: 'facile',
    targetDays: 7,
    category: 'nature',
  },
  // Famille
  {
    id: 'famille_jeu',
    title: 'Jeu de société',
    description: 'Jouer en famille à un jeu de société chaque soir',
    type: 'daily',
    emoji: '🎲',
    difficulty: 'moyen',
    targetDays: 7,
    category: 'famille',
  },
  {
    id: 'famille_compliment',
    title: 'Compliment du jour',
    description: 'Chaque membre dit un compliment à un autre membre',
    type: 'daily',
    emoji: '💝',
    difficulty: 'facile',
    targetDays: 7,
    category: 'famille',
  },
];
