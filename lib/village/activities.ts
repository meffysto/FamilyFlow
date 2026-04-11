// lib/village/activities.ts
// Activités familiales IRL curateées par saison (OBJ-04, D-06).
// Sélection déterministe par semaine — même activité pour tous les membres.

import type { Season } from '../mascot/seasons';

/** ~5 activités par saison — 20 au total */
export const IRL_ACTIVITIES: Record<Season, string[]> = {
  printemps: [
    'Pique-nique au parc',
    'Planter des fleurs ensemble',
    'Balade à vélo en famille',
    'Marché aux fleurs',
    'Jeu de piste dans le jardin',
  ],
  ete: [
    'Sortie à la plage ou à la piscine',
    'Barbecue en famille',
    'Glaces artisanales en promenade',
    'Soirée cinéma en plein air',
    'Cueillette de fruits',
  ],
  automne: [
    'Ramasser des châtaignes',
    'Balade en forêt aux feuilles colorées',
    'Cuisiner une tarte aux pommes',
    "Visite d'un marché artisanal",
    'Jeux de société en famille',
  ],
  hiver: [
    'Soirée crêpes',
    'Promenade sous la neige',
    'Regarder un film ensemble au chaud',
    'Faire un puzzle en famille',
    'Préparer des biscuits de Noël',
  ],
};

/**
 * Sélectionne une activité déterministe pour la semaine courante.
 * Hash simple sur weekStart (YYYY-MM-DD) pour rotation.
 * Deux profils qui appellent avec le même weekStart obtiennent le même résultat.
 */
export function pickSeasonalActivity(season: Season, weekStart: string): string {
  const activities = IRL_ACTIVITIES[season];
  const hash = weekStart.split('-').reduce((acc, n) => acc + parseInt(n, 10), 0);
  return activities[hash % activities.length];
}
