// ─────────────────────────────────────────────
// Événements saisonniers — Types & interfaces
// ─────────────────────────────────────────────

import type { SagaChapter } from './sagas-types';

/**
 * Progression d'un événement saisonnier pour un profil.
 * La clé composite eventId + year évite la duplication inter-annuelle.
 */
export interface SeasonalEventProgress {
  eventId: string;      // ex: 'paques', 'halloween'
  year: number;         // année calendaire (clé composite eventId+year)
  profileId: string;
  completed: boolean;
  completedAt?: string; // YYYY-MM-DD
  choiceId?: string;    // choix fait (influence la rareté de la récompense)
}

/**
 * Contenu narratif + métadonnées d'un événement saisonnier.
 * Un seul chapitre par événement (interaction courte et directe).
 */
export interface SeasonalEventContent {
  eventId: string;           // doit matcher SEASONAL_EVENTS[].id
  emoji: string;
  titleKey: string;          // clé i18n du titre
  visitorNameKey: string;    // ex: 'mascot.event.paques.visitor_name'
  chapter: SagaChapter;      // un seul chapitre (per D-03)
  bonusXP: number;           // bonus XP à la complétion (15 pour tous)
}
