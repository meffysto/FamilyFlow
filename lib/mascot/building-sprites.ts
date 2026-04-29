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

/**
 * Sprites par batimentId -> niveau -> source image.
 * Au-delà du niveau 3, on réutilise le sprite L3 (les niveaux 4-10 partagent le visuel "max").
 */
function expandSprites(lv1: any, lv2: any, lv3: any): Record<number, any> {
  const map: Record<number, any> = { 1: lv1, 2: lv2, 3: lv3 };
  for (let i = 4; i <= 10; i++) map[i] = lv3;
  return map;
}

export const BUILDING_SPRITES: Record<string, Record<number, any>> = {
  poulailler: expandSprites(POULAILLER_LV1, POULAILLER_LV2, POULAILLER_LV3),
  grange: expandSprites(GRANGE_LV1, GRANGE_LV2, GRANGE_LV3),
  moulin: expandSprites(MOULIN_LV1, MOULIN_LV2, MOULIN_LV3),
  ruche: expandSprites(RUCHE_LV1, RUCHE_LV2, RUCHE_LV3),
};
