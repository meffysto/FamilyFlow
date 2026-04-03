/**
 * defiTemplates.ts — Templates de défis familiaux pré-construits
 */

import { t } from 'i18next';
import type { DefiType } from '../types';

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

/** Retourne le label traduit d'une catégorie de défi */
export function getDefiCategoryLabel(category: DefiCategory): string {
  return t(`gamification:defiCategory.${category}`, { defaultValue: DEFI_CATEGORY_LABELS[category]?.label });
}

/** Retourne le label traduit d'une difficulté */
export function getDifficultyLabel(difficulty: 'facile' | 'moyen' | 'difficile'): string {
  return t(`gamification:difficulty.${difficulty}`, { defaultValue: difficulty });
}

/** Retourne le titre traduit d'un template de défi */
export function getDefiTitle(templateId: string, fallback: string): string {
  return t(`gamification:defis.${templateId}.title`, { defaultValue: fallback });
}

/** Retourne la description traduite d'un template de défi */
export function getDefiDescription(templateId: string, fallback: string): string {
  return t(`gamification:defis.${templateId}.description`, { defaultValue: fallback });
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

  // ─── Coopératifs (objectif partagé, toute la famille contribue) ──────────

  {
    id: 'coop_explorateur_culinaire',
    title: 'Explorateurs culinaires',
    description: 'Cuisiner 5 nouvelles recettes en famille cette semaine. Chacun peut proposer et aider !',
    type: 'cumulative',
    emoji: '🧑‍🍳',
    difficulty: 'moyen',
    targetDays: 7,
    targetMetric: 5,
    metricUnit: 'recettes',
    category: 'cuisine',
  },
  {
    id: 'coop_zero_gaspi',
    title: 'Zéro gaspillage',
    description: 'Finir tous les restes du frigo avant d\'acheter du neuf. Objectif : 0 aliment jeté cette semaine.',
    type: 'cumulative',
    emoji: '♻️',
    difficulty: 'difficile',
    targetDays: 7,
    targetMetric: 7,
    metricUnit: 'jours',
    category: 'cuisine',
  },
  {
    id: 'coop_km_famille',
    title: 'Marathon familial',
    description: 'Cumuler 42 km de marche/course à pied en famille. Chaque sortie compte !',
    type: 'cumulative',
    emoji: '🏅',
    difficulty: 'difficile',
    targetDays: 14,
    targetMetric: 42,
    metricUnit: 'km',
    category: 'sport',
  },
  {
    id: 'coop_livres',
    title: 'Bibliothèque familiale',
    description: 'Lire 10 livres ou histoires à voix haute ensemble. Chaque livre compte pour tous.',
    type: 'cumulative',
    emoji: '📚',
    difficulty: 'moyen',
    targetDays: 30,
    targetMetric: 10,
    metricUnit: 'livres',
    category: 'lecture',
  },
  {
    id: 'coop_sorties_nature',
    title: 'Aventuriers du dehors',
    description: 'Faire 8 sorties nature en famille ce mois (parc, forêt, plage, jardin…).',
    type: 'cumulative',
    emoji: '🏕️',
    difficulty: 'moyen',
    targetDays: 30,
    targetMetric: 8,
    metricUnit: 'sorties',
    category: 'nature',
  },
  {
    id: 'coop_gentillesse',
    title: 'Chaîne de gentillesse',
    description: 'Faire 20 actes de gentillesse en famille cette semaine. Un café au lit, un dessin, aider à ranger…',
    type: 'cumulative',
    emoji: '💛',
    difficulty: 'facile',
    targetDays: 7,
    targetMetric: 20,
    metricUnit: 'actes',
    category: 'famille',
  },
  {
    id: 'coop_ecrans_famille',
    title: 'Soirées reconnectées',
    description: 'Passer 5 soirées sans écran en famille cette semaine. Jeux, discussions, activités manuelles.',
    type: 'cumulative',
    emoji: '🕯️',
    difficulty: 'moyen',
    targetDays: 7,
    targetMetric: 5,
    metricUnit: 'soirées',
    category: 'ecrans',
  },
  {
    id: 'coop_menage_express',
    title: 'Blitz ménage',
    description: 'Faire 10 sessions de rangement express (15 min chrono, tout le monde s\'y met).',
    type: 'cumulative',
    emoji: '⚡',
    difficulty: 'facile',
    targetDays: 14,
    targetMetric: 10,
    metricUnit: 'sessions',
    category: 'menage',
  },
  {
    id: 'coop_photo_jour',
    title: 'Journal photo familial',
    description: 'Prendre une photo de famille chaque jour pendant 2 semaines. Chacun peut être le photographe.',
    type: 'cumulative',
    emoji: '📸',
    difficulty: 'facile',
    targetDays: 14,
    targetMetric: 14,
    metricUnit: 'photos',
    category: 'famille',
  },
  {
    id: 'coop_gratitude_100',
    title: '100 mercis',
    description: 'Écrire 100 gratitudes en famille en un mois. Chaque membre contribue au compteur commun.',
    type: 'cumulative',
    emoji: '🙏',
    difficulty: 'difficile',
    targetDays: 30,
    targetMetric: 100,
    metricUnit: 'gratitudes',
    category: 'famille',
  },
];
