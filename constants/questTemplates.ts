/**
 * questTemplates.ts — Templates de quêtes coopératives familiales
 *
 * 7 templates couvrant les types harvest, tasks, defis, craft, golden_harvest, production.
 */

import type { FamilyQuestTemplate } from '../lib/quest-engine';

export const QUEST_TEMPLATES: FamilyQuestTemplate[] = [
  {
    id: 'moisson_collective',
    title: 'Moisson collective',
    emoji: '🌾',
    type: 'harvest',
    target: 25,
    durationDays: 7,
    reward: { type: 'loot_legendary', count: 1 },
    description: 'Récoltez 25 cultures en famille cette semaine. Chaque récolte compte !',
  },
  {
    id: 'grand_defrichage',
    title: 'Grand défrichage',
    emoji: '🪓',
    type: 'tasks',
    target: 120,
    durationDays: 14,
    reward: { type: 'unlock_plot' },
    description: 'Complétez 120 tâches familiales en 14 jours pour débloquer une nouvelle parcelle !',
  },
  {
    id: 'champions_defi',
    title: 'Champions du défi',
    emoji: '🏆',
    type: 'defis',
    target: 3,
    durationDays: 14,
    reward: { type: 'rare_seeds', count: 10 },
    description: 'Complétez 3 défis familiaux en 14 jours pour gagner des graines rares.',
  },
  {
    id: 'artisans_familiaux',
    title: 'Artisans familiaux',
    emoji: '🔨',
    type: 'craft',
    target: 5,
    durationDays: 10,
    reward: { type: 'crafting_recipe', recipeId: 'galette_royale' },
    description: 'Craftez 5 objets en famille pour débloquer la recette de la galette royale.',
  },
  {
    id: 'graines_dorees',
    title: 'Graines dorées',
    emoji: '✨',
    type: 'golden_harvest',
    target: 3,
    durationDays: 14,
    reward: { type: 'golden_rain', durationHours: 48 },
    description: 'Récoltez 3 cultures dorées en famille pour déclencher 48h de pluie dorée !',
  },
  {
    id: 'semaine_production',
    title: 'Semaine de production',
    emoji: '🏭',
    type: 'production',
    target: 30,
    durationDays: 7,
    reward: { type: 'production_boost', durationHours: 48 },
    description: 'Collectez 30 ressources de bâtiments cette semaine pour un boost de production 48h.',
  },
  {
    id: 'pluie_magique',
    title: 'Pluie magique',
    emoji: '🌧️',
    type: 'tasks',
    target: 30,
    durationDays: 5,
    reward: { type: 'rain_bonus', durationHours: 24 },
    description: 'Complétez 30 tâches en 5 jours pour déclencher 24h de pluie magique sur la ferme.',
  },
];
