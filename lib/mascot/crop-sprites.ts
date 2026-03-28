// ─────────────────────────────────────────────
// Ferme — Sprites cultures (require mappings)
// ─────────────────────────────────────────────

/** Sprites par culture et stade (0-4) */
export const CROP_SPRITES: Record<string, Record<number, any>> = {
  carrot: {
    0: require('../../assets/garden/crops/carrot/stage_0.png'),
    1: require('../../assets/garden/crops/carrot/stage_1.png'),
    2: require('../../assets/garden/crops/carrot/stage_2.png'),
    3: require('../../assets/garden/crops/carrot/stage_3.png'),
    4: require('../../assets/garden/crops/carrot/stage_4.png'),
  },
  wheat: {
    0: require('../../assets/garden/crops/wheat/stage_0.png'),
    1: require('../../assets/garden/crops/wheat/stage_1.png'),
    2: require('../../assets/garden/crops/wheat/stage_2.png'),
    3: require('../../assets/garden/crops/wheat/stage_3.png'),
    4: require('../../assets/garden/crops/wheat/stage_4.png'),
  },
  tomato: {
    0: require('../../assets/garden/crops/tomato/stage_0.png'),
    1: require('../../assets/garden/crops/tomato/stage_1.png'),
    2: require('../../assets/garden/crops/tomato/stage_2.png'),
    3: require('../../assets/garden/crops/tomato/stage_3.png'),
    4: require('../../assets/garden/crops/tomato/stage_4.png'),
  },
  strawberry: {
    0: require('../../assets/garden/crops/strawberry/stage_0.png'),
    1: require('../../assets/garden/crops/strawberry/stage_1.png'),
    2: require('../../assets/garden/crops/strawberry/stage_2.png'),
    3: require('../../assets/garden/crops/strawberry/stage_3.png'),
    4: require('../../assets/garden/crops/strawberry/stage_4.png'),
  },
};

/** Icones cultures (pour la boutique) */
export const CROP_ICONS: Record<string, any> = {
  carrot:     require('../../assets/garden/crops/carrot/icon.png'),
  wheat:      require('../../assets/garden/crops/wheat/icon.png'),
  tomato:     require('../../assets/garden/crops/tomato/icon.png'),
  strawberry: require('../../assets/garden/crops/strawberry/icon.png'),
};
