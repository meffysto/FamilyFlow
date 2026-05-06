// lib/pdf/print-illustrations.ts — Catalogue des illustrations print 2480×2480 JPEG q85 mozjpeg.
// Pattern require statique obligatoire pour Metro bundler (résolution statique des assets).
// Mirroir de lib/story-illustrations.ts mais pointant vers `assets/stories/illustrations-print/`.
//
// Phase A variants : chaque (univers, archetype) → array de variants.
// La sélection variant est déterministe via hash(storyId + archetype) — voir asset-loader.ts.
// Pour ajouter un variant : générer en Midjourney, convertir en JPEG q85 via sharp,
// pousser dans `assets/stories/illustrations-print/<univers>/<archetype>-<N>.jpg`,
// puis ajouter le require() dans le tableau correspondant ci-dessous.

import type { SceneArchetype, StoryUniverseId } from '../types';

/**
 * Catalogue print 2480×2480 JPEG. Clé = `${univers}-${archetype}`.
 * Valeur = array de require() de variants (≥ 1). Sélection déterministe par story.
 *
 * Univers `foret` : 6 archétypes × 3 variants = 18 illustrations.
 * Les autres univers retomberont sur le mode B (fallback texte-seul ornemental).
 */
export const PRINT_ILLUSTRATIONS: Partial<Record<string, number[]>> = {
  'foret-paysage': [
    require('../../assets/stories/illustrations-print/foret/paysage-1.jpg'),
    require('../../assets/stories/illustrations-print/foret/paysage-2.jpg'),
    require('../../assets/stories/illustrations-print/foret/paysage-3.jpg'),
  ],
  'foret-rencontre': [
    require('../../assets/stories/illustrations-print/foret/rencontre-1.jpg'),
    require('../../assets/stories/illustrations-print/foret/rencontre-2.jpg'),
    require('../../assets/stories/illustrations-print/foret/rencontre-3.jpg'),
  ],
  'foret-decouverte': [
    require('../../assets/stories/illustrations-print/foret/decouverte-1.jpg'),
    require('../../assets/stories/illustrations-print/foret/decouverte-2.jpg'),
    require('../../assets/stories/illustrations-print/foret/decouverte-3.jpg'),
  ],
  'foret-vulnerable': [
    require('../../assets/stories/illustrations-print/foret/vulnerable-1.jpg'),
    require('../../assets/stories/illustrations-print/foret/vulnerable-2.jpg'),
    require('../../assets/stories/illustrations-print/foret/vulnerable-3.jpg'),
  ],
  'foret-echange': [
    require('../../assets/stories/illustrations-print/foret/echange-1.jpg'),
    require('../../assets/stories/illustrations-print/foret/echange-2.jpg'),
    require('../../assets/stories/illustrations-print/foret/echange-3.jpg'),
  ],
  'foret-etreinte': [
    require('../../assets/stories/illustrations-print/foret/etreinte-1.jpg'),
    require('../../assets/stories/illustrations-print/foret/etreinte-2.jpg'),
    require('../../assets/stories/illustrations-print/foret/etreinte-3.jpg'),
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
