// ─────────────────────────────────────────────
// Ferme — Sprites cultures (require mappings)
// ─────────────────────────────────────────────

/** Sprites par culture et stade (0-4) — tuple [frameA, frameB] pour animation balancement */
export const CROP_SPRITES: Record<string, Record<number, [any, any]>> = {
  carrot: {
    0: [require('../../assets/garden/crops/carrot/stage_0_a.png'), require('../../assets/garden/crops/carrot/stage_0_b.png')],
    1: [require('../../assets/garden/crops/carrot/stage_1_a.png'), require('../../assets/garden/crops/carrot/stage_1_b.png')],
    2: [require('../../assets/garden/crops/carrot/stage_2_a.png'), require('../../assets/garden/crops/carrot/stage_2_b.png')],
    3: [require('../../assets/garden/crops/carrot/stage_3_a.png'), require('../../assets/garden/crops/carrot/stage_3_b.png')],
    4: [require('../../assets/garden/crops/carrot/stage_4_a.png'), require('../../assets/garden/crops/carrot/stage_4_b.png')],
  },
  wheat: {
    0: [require('../../assets/garden/crops/wheat/stage_0_a.png'), require('../../assets/garden/crops/wheat/stage_0_b.png')],
    1: [require('../../assets/garden/crops/wheat/stage_1_a.png'), require('../../assets/garden/crops/wheat/stage_1_b.png')],
    2: [require('../../assets/garden/crops/wheat/stage_2_a.png'), require('../../assets/garden/crops/wheat/stage_2_b.png')],
    3: [require('../../assets/garden/crops/wheat/stage_3_a.png'), require('../../assets/garden/crops/wheat/stage_3_b.png')],
    4: [require('../../assets/garden/crops/wheat/stage_4_a.png'), require('../../assets/garden/crops/wheat/stage_4_b.png')],
  },
  tomato: {
    0: [require('../../assets/garden/crops/tomato/stage_0_a.png'), require('../../assets/garden/crops/tomato/stage_0_b.png')],
    1: [require('../../assets/garden/crops/tomato/stage_1_a.png'), require('../../assets/garden/crops/tomato/stage_1_b.png')],
    2: [require('../../assets/garden/crops/tomato/stage_2_a.png'), require('../../assets/garden/crops/tomato/stage_2_b.png')],
    3: [require('../../assets/garden/crops/tomato/stage_3_a.png'), require('../../assets/garden/crops/tomato/stage_3_b.png')],
    4: [require('../../assets/garden/crops/tomato/stage_4_a.png'), require('../../assets/garden/crops/tomato/stage_4_b.png')],
  },
  strawberry: {
    0: [require('../../assets/garden/crops/strawberry/stage_0_a.png'), require('../../assets/garden/crops/strawberry/stage_0_b.png')],
    1: [require('../../assets/garden/crops/strawberry/stage_1_a.png'), require('../../assets/garden/crops/strawberry/stage_1_b.png')],
    2: [require('../../assets/garden/crops/strawberry/stage_2_a.png'), require('../../assets/garden/crops/strawberry/stage_2_b.png')],
    3: [require('../../assets/garden/crops/strawberry/stage_3_a.png'), require('../../assets/garden/crops/strawberry/stage_3_b.png')],
    4: [require('../../assets/garden/crops/strawberry/stage_4_a.png'), require('../../assets/garden/crops/strawberry/stage_4_b.png')],
  },
  potato: {
    0: [require('../../assets/garden/crops/potato/stage_0_a.png'), require('../../assets/garden/crops/potato/stage_0_b.png')],
    1: [require('../../assets/garden/crops/potato/stage_1_a.png'), require('../../assets/garden/crops/potato/stage_1_b.png')],
    2: [require('../../assets/garden/crops/potato/stage_2_a.png'), require('../../assets/garden/crops/potato/stage_2_b.png')],
    3: [require('../../assets/garden/crops/potato/stage_3_a.png'), require('../../assets/garden/crops/potato/stage_3_b.png')],
    4: [require('../../assets/garden/crops/potato/stage_4_a.png'), require('../../assets/garden/crops/potato/stage_4_b.png')],
  },
  corn: {
    0: [require('../../assets/garden/crops/corn/stage_0_a.png'), require('../../assets/garden/crops/corn/stage_0_b.png')],
    1: [require('../../assets/garden/crops/corn/stage_1_a.png'), require('../../assets/garden/crops/corn/stage_1_b.png')],
    2: [require('../../assets/garden/crops/corn/stage_2_a.png'), require('../../assets/garden/crops/corn/stage_2_b.png')],
    3: [require('../../assets/garden/crops/corn/stage_3_a.png'), require('../../assets/garden/crops/corn/stage_3_b.png')],
    4: [require('../../assets/garden/crops/corn/stage_4_a.png'), require('../../assets/garden/crops/corn/stage_4_b.png')],
  },
  pumpkin: {
    0: [require('../../assets/garden/crops/pumpkin/stage_0_a.png'), require('../../assets/garden/crops/pumpkin/stage_0_b.png')],
    1: [require('../../assets/garden/crops/pumpkin/stage_1_a.png'), require('../../assets/garden/crops/pumpkin/stage_1_b.png')],
    2: [require('../../assets/garden/crops/pumpkin/stage_2_a.png'), require('../../assets/garden/crops/pumpkin/stage_2_b.png')],
    3: [require('../../assets/garden/crops/pumpkin/stage_3_a.png'), require('../../assets/garden/crops/pumpkin/stage_3_b.png')],
    4: [require('../../assets/garden/crops/pumpkin/stage_4_a.png'), require('../../assets/garden/crops/pumpkin/stage_4_b.png')],
  },
  cabbage: {
    0: [require('../../assets/garden/crops/cabbage/stage_0_a.png'), require('../../assets/garden/crops/cabbage/stage_0_b.png')],
    1: [require('../../assets/garden/crops/cabbage/stage_1_a.png'), require('../../assets/garden/crops/cabbage/stage_1_b.png')],
    2: [require('../../assets/garden/crops/cabbage/stage_2_a.png'), require('../../assets/garden/crops/cabbage/stage_2_b.png')],
    3: [require('../../assets/garden/crops/cabbage/stage_3_a.png'), require('../../assets/garden/crops/cabbage/stage_3_b.png')],
    4: [require('../../assets/garden/crops/cabbage/stage_4_a.png'), require('../../assets/garden/crops/cabbage/stage_4_b.png')],
  },
  beetroot: {
    0: [require('../../assets/garden/crops/beetroot/stage_0_a.png'), require('../../assets/garden/crops/beetroot/stage_0_b.png')],
    1: [require('../../assets/garden/crops/beetroot/stage_1_a.png'), require('../../assets/garden/crops/beetroot/stage_1_b.png')],
    2: [require('../../assets/garden/crops/beetroot/stage_2_a.png'), require('../../assets/garden/crops/beetroot/stage_2_b.png')],
    3: [require('../../assets/garden/crops/beetroot/stage_3_a.png'), require('../../assets/garden/crops/beetroot/stage_3_b.png')],
    4: [require('../../assets/garden/crops/beetroot/stage_4_a.png'), require('../../assets/garden/crops/beetroot/stage_4_b.png')],
  },
  cucumber: {
    0: [require('../../assets/garden/crops/cucumber/stage_0_a.png'), require('../../assets/garden/crops/cucumber/stage_0_b.png')],
    1: [require('../../assets/garden/crops/cucumber/stage_1_a.png'), require('../../assets/garden/crops/cucumber/stage_1_b.png')],
    2: [require('../../assets/garden/crops/cucumber/stage_2_a.png'), require('../../assets/garden/crops/cucumber/stage_2_b.png')],
    3: [require('../../assets/garden/crops/cucumber/stage_3_a.png'), require('../../assets/garden/crops/cucumber/stage_3_b.png')],
    4: [require('../../assets/garden/crops/cucumber/stage_4_a.png'), require('../../assets/garden/crops/cucumber/stage_4_b.png')],
  },
};

/** Icones cultures (pour la boutique et le codex) */
export const CROP_ICONS: Record<string, any> = {
  carrot:       require('../../assets/garden/crops/carrot/icon.png'),
  wheat:        require('../../assets/garden/crops/wheat/icon.png'),
  tomato:       require('../../assets/garden/crops/tomato/icon.png'),
  strawberry:   require('../../assets/garden/crops/strawberry/icon.png'),
  potato:       require('../../assets/garden/crops/potato/icon.png'),
  corn:         require('../../assets/garden/crops/corn/icon.png'),
  pumpkin:      require('../../assets/garden/crops/pumpkin/icon.png'),
  cabbage:      require('../../assets/garden/crops/cabbage/icon.png'),
  beetroot:     require('../../assets/garden/crops/beetroot/icon.png'),
  cucumber:     require('../../assets/garden/crops/cucumber/icon.png'),
  sunflower:    require('../../assets/garden/crops/sunflower/icon.png'),
  // Graines rares (drop-only) — sprites générés via PixelLab
  orchidee:     require('../../assets/garden/crops/orchidee/icon.png'),
  rose_doree:   require('../../assets/garden/crops/rose_doree/icon.png'),
  truffe:       require('../../assets/garden/crops/truffe/icon.png'),
  fruit_dragon: require('../../assets/garden/crops/fruit_dragon/icon.png'),
};
