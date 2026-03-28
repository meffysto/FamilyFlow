/**
 * building-sprites.ts — Mapping sprites batiments par niveau
 *
 * Tous les niveaux utilisent le meme sprite PNG pour l'instant
 * (les sprites _lv2/_lv3 seront ajoutes quand les assets seront disponibles).
 */

// Assets charges au top-level pour garantir la resolution Metro
const POULAILLER = require('../../assets/buildings/poulailler.png');
const GRANGE = require('../../assets/buildings/grange.png');
const MOULIN = require('../../assets/buildings/moulin.png');

/** Sprites par batimentId -> niveau -> source image */
export const BUILDING_SPRITES: Record<string, Record<number, any>> = {
  poulailler: { 1: POULAILLER, 2: POULAILLER, 3: POULAILLER },
  grange: { 1: GRANGE, 2: GRANGE, 3: GRANGE },
  moulin: { 1: MOULIN, 2: MOULIN, 3: MOULIN },
};
