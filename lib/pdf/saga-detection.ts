// lib/pdf/saga-detection.ts — Pure func détection tome saga (Phase 49 Plan 03).
// Critères : groupe par `livreId`, total = max(chapitre) sur le groupe.
// Aucune side effect — testée en isolation Jest (pdf-saga-detection.test.ts).

import type { BedtimeStory } from '../types';

export interface TomeBadge {
  current: number; // story.chapitre
  total: number; // max(chapitre) sur même livreId
  livreTitre: string; // story.livreTitre ?? story.titre
}

/**
 * Pure function : retourne le badge "Tome X sur Y du livre {titre}" si
 * l'histoire fait partie d'un livre (livreId + chapitre numériques), sinon null.
 *
 * Critères : groupe par `livreId`, total = max(chapitre) sur le groupe.
 * `allStories` typiquement = `storiesHook.stories` du VaultContext.
 */
export function detectTomeBadge(
  story: BedtimeStory,
  allStories: BedtimeStory[],
): TomeBadge | null {
  if (
    !story.livreId ||
    typeof story.chapitre !== 'number' ||
    story.chapitre < 1
  ) {
    return null;
  }
  const sameLivre = allStories.filter(
    (s) =>
      s.livreId === story.livreId &&
      typeof s.chapitre === 'number' &&
      s.chapitre >= 1,
  );
  if (sameLivre.length === 0) return null;

  const total = Math.max(...sameLivre.map((s) => s.chapitre as number));
  if (total < 1) return null;

  return {
    current: story.chapitre,
    total,
    livreTitre: story.livreTitre ?? story.titre,
  };
}
