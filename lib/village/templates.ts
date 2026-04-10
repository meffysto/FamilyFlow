// lib/village/templates.ts
// Templates d'objectif hebdomadaire thematises + constantes de calcul de cible.
// Phase 25 — fondation-donnees-village (v1.4).

import type { ObjectiveTemplate } from './types';

/** Cible de base par profil actif (per D-05). Facilement ajustable. */
export const BASE_TARGET = 15;

/** Templates d'objectif hebdomadaire thematises (per D-06). Rotation aleatoire chaque semaine. */
export const OBJECTIVE_TEMPLATES: ObjectiveTemplate[] = [
  { id: 'grande-recolte',    name: 'La Grande Recolte',    icon: '\u{1F33E}', description: 'Remplissez les etals du marche !' },
  { id: 'semaine-verte',     name: 'La Semaine Verte',     icon: '\u{1F33F}', description: 'La nature reprend ses droits.' },
  { id: 'fete-du-village',   name: 'Fete du Village',      icon: '\u{1F389}', description: 'La place resonne de rires.' },
  { id: 'marche-automnal',   name: 'Marche Automnal',      icon: '\u{1F342}', description: 'Les couleurs de la saison.' },
  { id: 'lumiere-hivernale', name: 'Lumiere Hivernale',    icon: '\u{2728}',  description: "La magie de l'hiver." },
  { id: 'printemps-actif',   name: 'Printemps Actif',      icon: '\u{1F338}', description: "Tout s'eveille, tout pousse !" },
  { id: 'grande-canicule',   name: 'Grande Canicule',      icon: '\u{2600}\u{FE0F}',  description: 'Tenez bon sous la chaleur !' },
];

/**
 * Calcule la cible hebdomadaire en fonction du nombre de profils actifs (per D-05).
 * Formule : BASE_TARGET * max(1, activeProfileCount).
 */
export function computeWeekTarget(activeProfileCount: number): number {
  return BASE_TARGET * Math.max(1, activeProfileCount);
}
