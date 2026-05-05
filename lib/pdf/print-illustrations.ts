// lib/pdf/print-illustrations.ts — Catalogue des illustrations print 2480×2480 JPEG q85 mozjpeg.
// Pattern require statique obligatoire pour Metro bundler (résolution statique des assets).
// Mirroir de lib/story-illustrations.ts mais pointant vers `assets/stories/illustrations-print/`.

import type { SceneArchetype, StoryUniverseId } from '../types';

/**
 * Catalogue print 2480×2480 JPEG q85. Clé = `${univers}-${archetype}`.
 * Phase 49 MVP : seul l'univers `foret` est couvert (6 archetypes).
 * Les autres univers retomberont sur le mode B (fallback texte-seul ornemental).
 */
export const PRINT_ILLUSTRATIONS: Partial<Record<string, number>> = {
  'foret-paysage': require('../../assets/stories/illustrations-print/foret/paysage.jpg'),
  'foret-rencontre': require('../../assets/stories/illustrations-print/foret/rencontre.jpg'),
  'foret-decouverte': require('../../assets/stories/illustrations-print/foret/decouverte.jpg'),
  'foret-vulnerable': require('../../assets/stories/illustrations-print/foret/vulnerable.jpg'),
  'foret-echange': require('../../assets/stories/illustrations-print/foret/echange.jpg'),
  'foret-etreinte': require('../../assets/stories/illustrations-print/foret/etreinte.jpg'),
};

/**
 * Récupère le module require() d'une illustration print pour un (univers, archetype).
 * Retourne `undefined` si l'illustration n'est pas dans le catalogue (univers non-forêt MVP).
 */
export function getPrintIllustrationModule(
  univers: StoryUniverseId,
  archetype: SceneArchetype,
): number | undefined {
  return PRINT_ILLUSTRATIONS[`${univers}-${archetype}`];
}
