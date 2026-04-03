/**
 * seasonal-rewards.ts — Événements saisonniers et récompenses exclusives
 *
 * 8 événements par an, détection automatique par date.
 * Les rewards s'ajoutent au pool normal (jamais de remplacement).
 */

import { SeasonalEvent } from '../types';

/** Chance qu'un drop soit saisonnier quand un événement est actif */
export const SEASONAL_DROP_CHANCE = 0.20;

export const SEASONAL_EVENTS: SeasonalEvent[] = [
  // ─── 🎆 Nouvel An ──────────────────────────────────────────────────────────
  {
    id: 'nouvel-an',
    name: 'Nouvel An',
    emoji: '🎆',
    startDate: '12-27',
    endDate: '01-02',
    themeColor: '#6366F1', // indigo
    rewards: {
      commun: [
        { emoji: '🎆', reward: 'Badge Feu d\'Artifice', bonusPoints: 0, rewardType: 'badge' },
        { emoji: '🥳', reward: '+10 points bonne année', bonusPoints: 10, rewardType: 'points' },
      ],
      rare: [
        { emoji: '📝', reward: 'Écrire ses bonnes résolutions en famille', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
      ],
      épique: [
        { emoji: '🎊', reward: 'Coucher tardif spécial 31 décembre', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
      ],
      légendaire: [
        { emoji: '⭐', reward: 'Multiplicateur ×3 (10 tâches) — Nouvel An', bonusPoints: 0, multiplier: 3, multiplierTasks: 10, rewardType: 'multiplier' },
      ],
    },
  },

  // ─── ❤️ St-Valentin Famille ─────────────────────────────────────────────────
  {
    id: 'st-valentin',
    name: 'St-Valentin Famille',
    emoji: '❤️',
    startDate: '02-10',
    endDate: '02-15',
    themeColor: '#EC4899', // rose
    rewards: {
      commun: [
        { emoji: '💌', reward: 'Écrire un mot gentil à un membre de la famille', bonusPoints: 0, rewardType: 'reward' },
        { emoji: '💕', reward: 'Badge Petit Cœur', bonusPoints: 0, rewardType: 'badge' },
      ],
      rare: [
        { emoji: '🍽️', reward: 'Dîner en famille au resto', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
        { emoji: '💝', reward: 'Chacun dit 3 qualités d\'un autre membre', bonusPoints: 0, rewardType: 'reward' },
      ],
      épique: [
        { emoji: '❤️', reward: 'Badge Cœur Familial', bonusPoints: 0, rewardType: 'badge' },
      ],
      légendaire: [
        { emoji: '💎', reward: '+30 pts pour TOUTE la famille', bonusPoints: 30, rewardType: 'family_bonus' },
      ],
    },
  },

  // ─── 🐟 Poisson d'Avril ────────────────────────────────────────────────────
  {
    id: 'poisson-avril',
    name: 'Poisson d\'Avril',
    emoji: '🐟',
    startDate: '04-01',
    endDate: '04-02',
    themeColor: '#06B6D4', // cyan
    rewards: {
      commun: [
        { emoji: '🐟', reward: 'Badge Poisson', bonusPoints: 0, rewardType: 'badge' },
      ],
      rare: [
        { emoji: '🃏', reward: 'Droit à un poisson d\'avril familial (sans représailles)', bonusPoints: 0, rewardType: 'reward' },
      ],
      épique: [
        { emoji: '🎭', reward: 'Échange de rôles parent/enfant pendant 1h', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
      ],
    },
  },

  // ─── 🐣 Pâques ─────────────────────────────────────────────────────────────
  {
    id: 'paques',
    name: 'Pâques',
    emoji: '🐣',
    startDate: 'dynamic', // calculé depuis getEasterDate()
    endDate: 'dynamic',
    themeColor: '#A3E635', // lime
    rewards: {
      commun: [
        { emoji: '🥚', reward: 'Badge Œuf Coloré', bonusPoints: 0, rewardType: 'badge' },
        { emoji: '🐰', reward: '+8 points bonus lapin', bonusPoints: 8, rewardType: 'points' },
      ],
      rare: [
        { emoji: '🍫', reward: 'Chasse aux œufs organisée par les parents', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
        { emoji: '🌸', reward: 'Badge Fleur de Printemps', bonusPoints: 0, rewardType: 'badge' },
      ],
      épique: [
        { emoji: '🐣', reward: 'Badge Poussin Doré', bonusPoints: 0, rewardType: 'badge' },
        { emoji: '🎉', reward: 'Multiplicateur ×2 (5 tâches) Pâques', bonusPoints: 0, multiplier: 2, multiplierTasks: 5, rewardType: 'multiplier' },
      ],
      légendaire: [
        { emoji: '🌈', reward: 'Sortie spéciale printemps (parc, zoo…)', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
      ],
    },
  },

  // ─── ☀️ Été ─────────────────────────────────────────────────────────────────
  {
    id: 'ete',
    name: 'Été',
    emoji: '☀️',
    startDate: '07-01',
    endDate: '08-31',
    themeColor: '#F59E0B', // amber
    rewards: {
      commun: [
        { emoji: '🏖️', reward: 'Badge Coquillage', bonusPoints: 0, rewardType: 'badge' },
        { emoji: '🍦', reward: 'Glace au choix', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
      ],
      rare: [
        { emoji: '🌊', reward: 'Sortie piscine/plage', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
        { emoji: '☀️', reward: 'Badge Soleil', bonusPoints: 0, rewardType: 'badge' },
      ],
      épique: [
        { emoji: '🏄', reward: 'Activité au choix (accrobranche, kayak…)', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
        { emoji: '🌴', reward: 'Coucher tardif +1h', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
      ],
      légendaire: [
        { emoji: '🎆', reward: 'Soirée barbecue + feu d\'artifice', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
      ],
      mythique: [
        { emoji: '🐚', reward: 'Badge Perle Rare de l\'Été', bonusPoints: 0, rewardType: 'badge' },
      ],
    },
  },

  // ─── 🎒 Rentrée ────────────────────────────────────────────────────────────
  {
    id: 'rentree',
    name: 'Rentrée',
    emoji: '🎒',
    startDate: '09-01',
    endDate: '09-15',
    themeColor: '#8B5CF6', // violet
    rewards: {
      commun: [
        { emoji: '📚', reward: 'Badge Livre', bonusPoints: 0, rewardType: 'badge' },
        { emoji: '✏️', reward: 'Choisis ton goûter de la semaine', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
      ],
      rare: [
        { emoji: '🎒', reward: '+15 points bonus rentrée', bonusPoints: 15, rewardType: 'points' },
        { emoji: '🏫', reward: 'Badge Premier de la Classe', bonusPoints: 0, rewardType: 'badge' },
      ],
      épique: [
        { emoji: '🌟', reward: '+50 points de bienvenue', bonusPoints: 50, rewardType: 'points' },
      ],
    },
  },

  // ─── 🎃 Halloween ──────────────────────────────────────────────────────────
  {
    id: 'halloween',
    name: 'Halloween',
    emoji: '🎃',
    startDate: '10-15',
    endDate: '11-01',
    themeColor: '#F97316', // orange
    rewards: {
      commun: [
        { emoji: '🕸️', reward: 'Badge Toile d\'Araignée', bonusPoints: 0, rewardType: 'badge' },
        { emoji: '👻', reward: 'Cri de fantôme au prochain repas', bonusPoints: 0, rewardType: 'reward' },
      ],
      rare: [
        { emoji: '🎃', reward: 'Choisir un film d\'Halloween (adapté âge)', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
        { emoji: '🦇', reward: 'Badge Chauve-Souris', bonusPoints: 0, rewardType: 'badge' },
      ],
      épique: [
        { emoji: '🧛', reward: 'Soirée déguisée en famille !', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
        { emoji: '💀', reward: 'Badge Crâne Doré', bonusPoints: 0, rewardType: 'badge' },
      ],
      légendaire: [
        { emoji: '🏚️', reward: 'Sortie maison hantée/escape game', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
      ],
    },
  },

  // ─── 🎄 Noël ───────────────────────────────────────────────────────────────
  {
    id: 'noel',
    name: 'Noël',
    emoji: '🎄',
    startDate: '12-01',
    endDate: '12-26',
    themeColor: '#DC2626', // rouge
    rewards: {
      commun: [
        { emoji: '⛄', reward: 'Badge Bonhomme de Neige', bonusPoints: 0, rewardType: 'badge' },
        { emoji: '🍪', reward: 'Préparer des cookies de Noël ensemble', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
      ],
      rare: [
        { emoji: '🎅', reward: 'Écrire une lettre au Père Noël', bonusPoints: 0, rewardType: 'reward' },
        { emoji: '🦌', reward: 'Badge Renne Doré', bonusPoints: 0, rewardType: 'badge' },
      ],
      épique: [
        { emoji: '🎁', reward: 'Ouvrir un cadeau en avance !', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
        { emoji: '✨', reward: 'Multiplicateur ×2 (10 tâches) spécial Noël', bonusPoints: 0, multiplier: 2, multiplierTasks: 10, rewardType: 'multiplier' },
      ],
      légendaire: [
        { emoji: '🌟', reward: 'Sortie marché de Noël en famille', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
      ],
      mythique: [
        { emoji: '🎄', reward: 'Badge Sapin Mythique', bonusPoints: 0, rewardType: 'badge' },
      ],
    },
  },
];
