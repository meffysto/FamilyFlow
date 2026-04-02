/**
 * building-sprites.ts — Mapping sprites batiments par niveau
 */

// Assets charges au top-level pour garantir la resolution Metro
const POULAILLER_LV1 = require('../../assets/buildings/poulailler_lv1.png');
const POULAILLER_LV2 = require('../../assets/buildings/poulailler_lv2.png');
const POULAILLER_LV3 = require('../../assets/buildings/poulailler_lv3.png');
const GRANGE_LV1 = require('../../assets/buildings/grange_lv1.png');
const GRANGE_LV2 = require('../../assets/buildings/grange_lv2.png');
const GRANGE_LV3 = require('../../assets/buildings/grange_lv3.png');
const MOULIN_LV1 = require('../../assets/buildings/moulin_lv1.png');
const MOULIN_LV2 = require('../../assets/buildings/moulin_lv2.png');
const MOULIN_LV3 = require('../../assets/buildings/moulin_lv3.png');
const RUCHE_LV1 = require('../../assets/buildings/ruche_lv1.png');
const RUCHE_LV2 = require('../../assets/buildings/ruche_lv2.png');
const RUCHE_LV3 = require('../../assets/buildings/ruche_lv3.png');

/** Sprites par batimentId -> niveau -> source image */
export const BUILDING_SPRITES: Record<string, Record<number, any>> = {
  poulailler: { 1: POULAILLER_LV1, 2: POULAILLER_LV2, 3: POULAILLER_LV3 },
  grange: { 1: GRANGE_LV1, 2: GRANGE_LV2, 3: GRANGE_LV3 },
  moulin: { 1: MOULIN_LV1, 2: MOULIN_LV2, 3: MOULIN_LV3 },
  ruche: { 1: RUCHE_LV1, 2: RUCHE_LV2, 3: RUCHE_LV3 },
};
