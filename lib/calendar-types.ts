/**
 * calendar-types.ts — Types et config pour le calendrier unifié
 */

import type { RDV, Task, Anniversary, MealItem, Defi, Memory, MoodEntry, ChildQuote } from './types';

// ─── Types d'événements ─────────────────────────────────────────────────────

export type CalendarEventType =
  | 'rdv' | 'task' | 'anniversary' | 'meal'
  | 'vacation' | 'defi' | 'memory' | 'mood' | 'quote';

export interface CalendarEventBase {
  id: string;
  date: string;           // YYYY-MM-DD
  time?: string;          // HH:MM (pour le tri intra-jour)
  type: CalendarEventType;
  label: string;
  sublabel?: string;
  emoji: string;
  colorKey: CalendarColorKey;
  route?: string;
  routeParams?: Record<string, string>;
}

export type CalendarColorKey = 'info' | 'warning' | 'success' | 'error' | 'primary' | 'accentPink';

interface CalendarRDV extends CalendarEventBase { type: 'rdv'; source: RDV; }
interface CalendarTask extends CalendarEventBase { type: 'task'; source: Task; }
interface CalendarAnniversary extends CalendarEventBase { type: 'anniversary'; source: Anniversary; age?: number; }
interface CalendarMeal extends CalendarEventBase { type: 'meal'; source: MealItem; }
interface CalendarVacation extends CalendarEventBase { type: 'vacation'; }
interface CalendarDefi extends CalendarEventBase { type: 'defi'; source: Defi; }
interface CalendarMemory extends CalendarEventBase { type: 'memory'; source: Memory; }
interface CalendarMood extends CalendarEventBase { type: 'mood'; source: MoodEntry; }
interface CalendarQuote extends CalendarEventBase { type: 'quote'; source: ChildQuote; }

export type CalendarEvent =
  | CalendarRDV | CalendarTask | CalendarAnniversary | CalendarMeal
  | CalendarVacation | CalendarDefi | CalendarMemory | CalendarMood | CalendarQuote;

// ─── Configuration visuelle par type ────────────────────────────────────────

export const EVENT_CONFIG: Record<CalendarEventType, { emoji: string; colorKey: CalendarColorKey; label: string }> = {
  rdv:         { emoji: '📅', colorKey: 'info',       label: 'RDV' },
  task:        { emoji: '📋', colorKey: 'warning',    label: 'Tâche' },
  anniversary: { emoji: '🎂', colorKey: 'accentPink', label: 'Anniversaire' },
  meal:        { emoji: '🍽️', colorKey: 'success',    label: 'Repas' },
  vacation:    { emoji: '☀️', colorKey: 'warning',    label: 'Vacances' },
  defi:        { emoji: '🏅', colorKey: 'primary',    label: 'Défi' },
  memory:      { emoji: '⭐', colorKey: 'accentPink', label: 'Souvenir' },
  mood:        { emoji: '🌤️', colorKey: 'info',       label: 'Humeur' },
  quote:       { emoji: '💬', colorKey: 'info',       label: 'Mot' },
};

// ─── Labels jours ───────────────────────────────────────────────────────────

// ─── Utilitaire couleur ─────────────────────────────────────────────────────

/** Résout un CalendarColorKey en couleur concrète via les tokens du thème */
export function resolveCalendarColor(
  colors: { info: string; warning: string; success: string; error: string; accentPink: string },
  primary: string,
  key: CalendarColorKey,
): string {
  switch (key) {
    case 'info': return colors.info;
    case 'warning': return colors.warning;
    case 'success': return colors.success;
    case 'error': return colors.error;
    case 'primary': return primary;
    case 'accentPink': return colors.accentPink;
    default: return primary;
  }
}

// ─── Labels jours ───────────────────────────────────────────────────────────

export const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const DAYS_ORDER_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
