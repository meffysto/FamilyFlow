/**
 * building-sprites.ts — Mapping sprites batiments par niveau
 */

// Assets charges au top-level pour garantir la resolution Metro
const POULAILLER_LV1 = require('../../assets/buildings/poulailler_lv1.png');
const POULAILLER_LV2 = require('../../assets/buildings/poulailler_lv2.png');
const POULAILLER_LV3 = require('../../assets/buildings/poulailler_lv3.png');
const POULAILLER_LV4 = require('../../assets/buildings/poulailler_lv4.png');
const POULAILLER_LV5 = require('../../assets/buildings/poulailler_lv5.png');
const POULAILLER_LV6 = require('../../assets/buildings/poulailler_lv6.png');
const GRANGE_LV1 = require('../../assets/buildings/grange_lv1.png');
const GRANGE_LV2 = require('../../assets/buildings/grange_lv2.png');
const GRANGE_LV3 = require('../../assets/buildings/grange_lv3.png');
const GRANGE_LV4 = require('../../assets/buildings/grange_lv4.png');
const GRANGE_LV5 = require('../../assets/buildings/grange_lv5.png');
const GRANGE_LV6 = require('../../assets/buildings/grange_lv6.png');
const MOULIN_LV1 = require('../../assets/buildings/moulin_lv1.png');
const MOULIN_LV2 = require('../../assets/buildings/moulin_lv2.png');
const MOULIN_LV3 = require('../../assets/buildings/moulin_lv3.png');
const MOULIN_LV4 = require('../../assets/buildings/moulin_lv4.png');
const MOULIN_LV5 = require('../../assets/buildings/moulin_lv5.png');
const MOULIN_LV6 = require('../../assets/buildings/moulin_lv6.png');
const RUCHE_LV1 = require('../../assets/buildings/ruche_lv1.png');
const RUCHE_LV2 = require('../../assets/buildings/ruche_lv2.png');
const RUCHE_LV3 = require('../../assets/buildings/ruche_lv3.png');
const RUCHE_LV4 = require('../../assets/buildings/ruche_lv4.png');
const RUCHE_LV5 = require('../../assets/buildings/ruche_lv5.png');
const RUCHE_LV6 = require('../../assets/buildings/ruche_lv6.png');
const AUBERGE_LV1 = require('../../assets/buildings/auberge_lv1.png');
const AUBERGE_LV2 = require('../../assets/buildings/auberge_lv2.png');
const AUBERGE_LV3 = require('../../assets/buildings/auberge_lv3.png');
const AUBERGE_LV4 = require('../../assets/buildings/auberge_lv4.png');
const AUBERGE_LV5 = require('../../assets/buildings/auberge_lv5.png');
const AUBERGE_LV6 = require('../../assets/buildings/auberge_lv6.png');

function expandSprites(lv1: any, lv2: any, lv3: any): Record<number, any> {
  const map: Record<number, any> = { 1: lv1, 2: lv2, 3: lv3 };
  for (let i = 4; i <= 10; i++) map[i] = lv3;
  return map;
}

function expandSprites6(lv1: any, lv2: any, lv3: any, lv4: any, lv5: any, lv6: any): Record<number, any> {
  // lv1=1, lv2=2-3, lv3=4-5, lv4=6-7, lv5=8-9, lv6=10
  return { 1: lv1, 2: lv2, 3: lv2, 4: lv3, 5: lv3, 6: lv4, 7: lv4, 8: lv5, 9: lv5, 10: lv6 };
}

export const BUILDING_SPRITES: Record<string, Record<number, any>> = {
  poulailler: expandSprites6(POULAILLER_LV1, POULAILLER_LV2, POULAILLER_LV3, POULAILLER_LV4, POULAILLER_LV5, POULAILLER_LV6),
  grange: expandSprites6(GRANGE_LV1, GRANGE_LV2, GRANGE_LV3, GRANGE_LV4, GRANGE_LV5, GRANGE_LV6),
  moulin: expandSprites6(MOULIN_LV1, MOULIN_LV2, MOULIN_LV3, MOULIN_LV4, MOULIN_LV5, MOULIN_LV6),
  ruche: expandSprites6(RUCHE_LV1, RUCHE_LV2, RUCHE_LV3, RUCHE_LV4, RUCHE_LV5, RUCHE_LV6),
  auberge: expandSprites6(AUBERGE_LV1, AUBERGE_LV2, AUBERGE_LV3, AUBERGE_LV4, AUBERGE_LV5, AUBERGE_LV6),
};
