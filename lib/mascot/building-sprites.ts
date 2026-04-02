/**
 * building-sprites.ts — Mapping sprites batiments par niveau
 */

// Assets charges au top-level pour garantir la resolution Metro
const POULAILLER_LV1 = require('../../assets/buildings/poulailler_lv1.png');
const POULAILLER_LV2 = require('../../assets/buildings/poulailler_lv2.png');
const POULAILLER_LV3 = require('../../assets/buildings/poulailler_lv3.png');
const GRANGE = require('../../assets/buildings/grange.png');
const MOULIN = require('../../assets/buildings/moulin.png');

/** Sprites par batimentId -> niveau -> source image */
export const BUILDING_SPRITES: Record<string, Record<number, any>> = {
  poulailler: { 1: POULAILLER_LV1, 2: POULAILLER_LV2, 3: POULAILLER_LV3 },
  grange: { 1: GRANGE, 2: GRANGE, 3: GRANGE },
  moulin: { 1: MOULIN, 2: MOULIN, 3: MOULIN },
};
