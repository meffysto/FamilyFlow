// ─────────────────────────────────────────────
// Événements saisonniers — Contenu narratif des 8 événements
// ─────────────────────────────────────────────

import type { SeasonalEventContent } from './seasonal-events-types';
import { SEASONAL_EVENT_BONUS_XP } from './seasonal-events-engine';

/**
 * Contenu narratif de tous les événements saisonniers.
 * Clé = eventId matchant SEASONAL_EVENTS[].id.
 *
 * Convention clés i18n : mascot.event.{eventId}.{...}
 * Chaque événement a un visiteur unique et un dialogue thématique.
 */
export const SEASONAL_EVENT_DIALOGUES: Record<string, SeasonalEventContent> = {

  // ─── 🎆 Nouvel An ──────────────────────────────────────────────────────────
  'nouvel-an': {
    eventId: 'nouvel-an',
    emoji: '🎆',
    titleKey: 'mascot.event.nouvel-an.title',
    visitorNameKey: 'mascot.event.nouvel-an.visitor_name',
    bonusXP: SEASONAL_EVENT_BONUS_XP,
    chapter: {
      id: 1,
      narrativeKey: 'mascot.event.nouvel-an.narrative',
      cliffhangerKey: 'mascot.event.nouvel-an.cliffhanger',
      choices: [
        {
          id: 'A',
          labelKey: 'mascot.event.nouvel-an.choiceA',
          emoji: '🎉',
          traits: { générosité: 2 },
          points: 5,
        },
        {
          id: 'B',
          labelKey: 'mascot.event.nouvel-an.choiceB',
          emoji: '✨',
          traits: { sagesse: 2 },
          points: 5,
        },
        {
          id: 'C',
          labelKey: 'mascot.event.nouvel-an.choiceC',
          emoji: '🥂',
          traits: { courage: 2 },
          points: 5,
        },
      ],
    },
  },

  // ─── ❤️ St-Valentin ─────────────────────────────────────────────────────────
  'st-valentin': {
    eventId: 'st-valentin',
    emoji: '❤️',
    titleKey: 'mascot.event.st-valentin.title',
    visitorNameKey: 'mascot.event.st-valentin.visitor_name',
    bonusXP: SEASONAL_EVENT_BONUS_XP,
    chapter: {
      id: 1,
      narrativeKey: 'mascot.event.st-valentin.narrative',
      cliffhangerKey: 'mascot.event.st-valentin.cliffhanger',
      choices: [
        {
          id: 'A',
          labelKey: 'mascot.event.st-valentin.choiceA',
          emoji: '💌',
          traits: { générosité: 2 },
          points: 5,
        },
        {
          id: 'B',
          labelKey: 'mascot.event.st-valentin.choiceB',
          emoji: '🌹',
          traits: { sagesse: 2 },
          points: 5,
        },
      ],
    },
  },

  // ─── 🐟 Poisson d'Avril ────────────────────────────────────────────────────
  'poisson-avril': {
    eventId: 'poisson-avril',
    emoji: '🐟',
    titleKey: 'mascot.event.poisson-avril.title',
    visitorNameKey: 'mascot.event.poisson-avril.visitor_name',
    bonusXP: SEASONAL_EVENT_BONUS_XP,
    chapter: {
      id: 1,
      narrativeKey: 'mascot.event.poisson-avril.narrative',
      cliffhangerKey: 'mascot.event.poisson-avril.cliffhanger',
      choices: [
        {
          id: 'A',
          labelKey: 'mascot.event.poisson-avril.choiceA',
          emoji: '😄',
          traits: { malice: 2 },
          points: 5,
        },
        {
          id: 'B',
          labelKey: 'mascot.event.poisson-avril.choiceB',
          emoji: '🤫',
          traits: { sagesse: 2 },
          points: 5,
        },
        {
          id: 'C',
          labelKey: 'mascot.event.poisson-avril.choiceC',
          emoji: '🐟',
          traits: { curiosité: 2 },
          points: 5,
        },
      ],
    },
  },

  // ─── 🐣 Pâques ─────────────────────────────────────────────────────────────
  'paques': {
    eventId: 'paques',
    emoji: '🐣',
    titleKey: 'mascot.event.paques.title',
    visitorNameKey: 'mascot.event.paques.visitor_name',
    bonusXP: SEASONAL_EVENT_BONUS_XP,
    chapter: {
      id: 1,
      narrativeKey: 'mascot.event.paques.narrative',
      cliffhangerKey: 'mascot.event.paques.cliffhanger',
      choices: [
        {
          id: 'A',
          labelKey: 'mascot.event.paques.choiceA',
          emoji: '🥚',
          traits: { curiosité: 2 },
          points: 5,
        },
        {
          id: 'B',
          labelKey: 'mascot.event.paques.choiceB',
          emoji: '🌸',
          traits: { générosité: 2 },
          points: 5,
        },
        {
          id: 'C',
          labelKey: 'mascot.event.paques.choiceC',
          emoji: '🍫',
          traits: { sagesse: 2 },
          points: 5,
        },
      ],
    },
  },

  // ─── ☀️ Été ─────────────────────────────────────────────────────────────────
  'ete': {
    eventId: 'ete',
    emoji: '☀️',
    titleKey: 'mascot.event.ete.title',
    visitorNameKey: 'mascot.event.ete.visitor_name',
    bonusXP: SEASONAL_EVENT_BONUS_XP,
    chapter: {
      id: 1,
      narrativeKey: 'mascot.event.ete.narrative',
      cliffhangerKey: 'mascot.event.ete.cliffhanger',
      choices: [
        {
          id: 'A',
          labelKey: 'mascot.event.ete.choiceA',
          emoji: '🏖️',
          traits: { courage: 2 },
          points: 5,
        },
        {
          id: 'B',
          labelKey: 'mascot.event.ete.choiceB',
          emoji: '🌊',
          traits: { curiosité: 2 },
          points: 5,
        },
        {
          id: 'C',
          labelKey: 'mascot.event.ete.choiceC',
          emoji: '🍦',
          traits: { générosité: 2 },
          points: 5,
        },
      ],
    },
  },

  // ─── 🎒 Rentrée ────────────────────────────────────────────────────────────
  'rentree': {
    eventId: 'rentree',
    emoji: '🎒',
    titleKey: 'mascot.event.rentree.title',
    visitorNameKey: 'mascot.event.rentree.visitor_name',
    bonusXP: SEASONAL_EVENT_BONUS_XP,
    chapter: {
      id: 1,
      narrativeKey: 'mascot.event.rentree.narrative',
      cliffhangerKey: 'mascot.event.rentree.cliffhanger',
      choices: [
        {
          id: 'A',
          labelKey: 'mascot.event.rentree.choiceA',
          emoji: '📚',
          traits: { sagesse: 2 },
          points: 5,
        },
        {
          id: 'B',
          labelKey: 'mascot.event.rentree.choiceB',
          emoji: '✏️',
          traits: { courage: 2 },
          points: 5,
        },
        {
          id: 'C',
          labelKey: 'mascot.event.rentree.choiceC',
          emoji: '🎒',
          traits: { générosité: 2 },
          points: 5,
        },
      ],
    },
  },

  // ─── 🎃 Halloween ──────────────────────────────────────────────────────────
  'halloween': {
    eventId: 'halloween',
    emoji: '🎃',
    titleKey: 'mascot.event.halloween.title',
    visitorNameKey: 'mascot.event.halloween.visitor_name',
    bonusXP: SEASONAL_EVENT_BONUS_XP,
    chapter: {
      id: 1,
      narrativeKey: 'mascot.event.halloween.narrative',
      cliffhangerKey: 'mascot.event.halloween.cliffhanger',
      choices: [
        {
          id: 'A',
          labelKey: 'mascot.event.halloween.choiceA',
          emoji: '👻',
          traits: { malice: 2 },
          points: 5,
        },
        {
          id: 'B',
          labelKey: 'mascot.event.halloween.choiceB',
          emoji: '🕯️',
          traits: { courage: 2 },
          points: 5,
        },
        {
          id: 'C',
          labelKey: 'mascot.event.halloween.choiceC',
          emoji: '🍬',
          traits: { générosité: 2 },
          points: 5,
        },
      ],
    },
  },

  // ─── 🎄 Noël ───────────────────────────────────────────────────────────────
  'noel': {
    eventId: 'noel',
    emoji: '🎄',
    titleKey: 'mascot.event.noel.title',
    visitorNameKey: 'mascot.event.noel.visitor_name',
    bonusXP: SEASONAL_EVENT_BONUS_XP,
    chapter: {
      id: 1,
      narrativeKey: 'mascot.event.noel.narrative',
      cliffhangerKey: 'mascot.event.noel.cliffhanger',
      choices: [
        {
          id: 'A',
          labelKey: 'mascot.event.noel.choiceA',
          emoji: '🎁',
          traits: { générosité: 2 },
          points: 5,
        },
        {
          id: 'B',
          labelKey: 'mascot.event.noel.choiceB',
          emoji: '⛄',
          traits: { curiosité: 2 },
          points: 5,
        },
        {
          id: 'C',
          labelKey: 'mascot.event.noel.choiceC',
          emoji: '🍪',
          traits: { sagesse: 2 },
          points: 5,
        },
      ],
    },
  },

};

/**
 * Retourne le contenu d'un événement saisonnier par son ID.
 * Retourne undefined si l'événement n'est pas dans SEASONAL_EVENT_DIALOGUES.
 */
export function getEventContent(eventId: string): SeasonalEventContent | undefined {
  return SEASONAL_EVENT_DIALOGUES[eventId];
}
