// ─────────────────────────────────────────────
// Ferme — Mapping sprites batiments par niveau
// ─────────────────────────────────────────────
//
// Les sprites de niveau 2 et 3 seront remplacés par des sprites pixel-art
// generés dans le style Mana Seed (D-15). En attendant, chaque niveau
// utilise le meme asset comme placeholder.
// ─────────────────────────────────────────────

export const BUILDING_SPRITES: Record<string, Record<number, ReturnType<typeof require>>> = {
  poulailler: {
    1: require('../../assets/buildings/poulailler.png'),
    2: require('../../assets/buildings/poulailler.png'),  // placeholder — a remplacer par sprite niveau 2
    3: require('../../assets/buildings/poulailler.png'),  // placeholder — a remplacer par sprite niveau 3
  },
  grange: {
    1: require('../../assets/buildings/grange.png'),
    2: require('../../assets/buildings/grange.png'),  // placeholder — a remplacer par sprite niveau 2
    3: require('../../assets/buildings/grange.png'),  // placeholder — a remplacer par sprite niveau 3
  },
  moulin: {
    1: require('../../assets/buildings/moulin.png'),
    2: require('../../assets/buildings/moulin.png'),  // placeholder — a remplacer par sprite niveau 2
    3: require('../../assets/buildings/moulin.png'),  // placeholder — a remplacer par sprite niveau 3
  },
};
