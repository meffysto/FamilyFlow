// lib/pdf/print-illustrations.ts — Catalogue des illustrations print 2480×2480 JPEG q85 mozjpeg.
// Pattern require statique obligatoire pour Metro bundler (résolution statique des assets).
// Mirroir de lib/story-illustrations.ts mais pointant vers `assets/stories/illustrations-print/`.
//
// Phase A variants (déc. 2026) : chaque (univers, archetype) → array de variants.
// La sélection variant est déterministe via hash(storyId + archetype) — voir asset-loader.ts.
// Pour ajouter un variant : générer en Midjourney, convertir en JPEG q85 via sharp,
// pousser dans `assets/stories/illustrations-print/<univers>/<archetype>-<N>.jpg`,
// puis ajouter le require() dans le tableau correspondant ci-dessous.

import type { SceneArchetype, StoryUniverseId } from '../types';

/**
 * Catalogue print 2480×2480 JPEG. Clé = `${univers}-${archetype}`.
 * Valeur = array de require() de variants (≥ 1). Sélection déterministe par story.
 *
 * Phase 49 MVP : seul l'univers `foret` est couvert (6 archétypes, 1 variant chacun).
 * Les autres univers retomberont sur le mode B (fallback texte-seul ornemental).
 */
export const PRINT_ILLUSTRATIONS: Partial<Record<string, number[]>> = {
  'foret-paysage': [
    require('../../assets/stories/illustrations-print/foret/paysage.jpg'),
  ],
  'foret-rencontre': [
    require('../../assets/stories/illustrations-print/foret/rencontre.jpg'),
  ],
  'foret-decouverte': [
    require('../../assets/stories/illustrations-print/foret/decouverte.jpg'),
  ],
  'foret-vulnerable': [
    require('../../assets/stories/illustrations-print/foret/vulnerable.jpg'),
  ],
  'foret-echange': [
    require('../../assets/stories/illustrations-print/foret/echange.jpg'),
  ],
  'foret-etreinte': [
    require('../../assets/stories/illustrations-print/foret/etreinte.jpg'),
  ],
};

/**
 * Récupère le tableau de variants pour un (univers, archetype).
 * Retourne `undefined` si la combinaison n'est pas dans le catalogue (univers non-forêt MVP).
 */
export function getPrintIllustrationVariants(
  univers: StoryUniverseId,
  archetype: SceneArchetype,
): readonly number[] | undefined {
  return PRINT_ILLUSTRATIONS[`${univers}-${archetype}`];
}
