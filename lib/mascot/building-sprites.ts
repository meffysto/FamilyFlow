/**
 * building-sprites.ts — Mapping sprites batiments par niveau
 *
 * Tous les niveaux utilisent le meme sprite PNG pour l'instant
 * (les sprites _lv2/_lv3 seront ajoutes quand les assets seront disponibles).
 */

/** Sprites par batimentId -> niveau -> source image */
export const BUILDING_SPRITES: Record<string, Record<number, any>> = {
  poulailler: {
    1: require('../../assets/buildings/poulailler.png'),
    2: require('../../assets/buildings/poulailler.png'),
    3: require('../../assets/buildings/poulailler.png'),
  },
  grange: {
    1: require('../../assets/buildings/grange.png'),
    2: require('../../assets/buildings/grange.png'),
    3: require('../../assets/buildings/grange.png'),
  },
  moulin: {
    1: require('../../assets/buildings/moulin.png'),
    2: require('../../assets/buildings/moulin.png'),
    3: require('../../assets/buildings/moulin.png'),
  },
};
