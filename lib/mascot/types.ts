// ─────────────────────────────────────────────
// Mascotte Arbre — Types & constantes
// ─────────────────────────────────────────────

/** 5 espèces d'arbres disponibles */
export type TreeSpecies = 'cerisier' | 'chene' | 'bambou' | 'oranger' | 'palmier';

/** 6 stades de croissance mappés sur les LEVEL_TIERS */
export type TreeStage = 'graine' | 'pousse' | 'arbuste' | 'arbre' | 'majestueux' | 'legendaire';

/** État mascotte stocké dans le profil */
export interface MascotState {
  species: TreeSpecies;
  decorations: string[];   // IDs des décorations achetées
  inhabitants: string[];   // IDs des habitants achetés
}

/** Mapping stade → plage de niveaux */
export interface TreeStageInfo {
  stage: TreeStage;
  minLevel: number;
  maxLevel: number;
  labelKey: string;        // clé i18n
  descriptionKey: string;  // clé i18n
}

/** Les 6 stades avec leurs plages de niveaux */
/** Stades redistributes pour une progression gratifiante :
 * Premiere evolution a ~11 jours, ferme a ~11 jours,
 * arbuste a ~2 mois, arbre a ~6 mois, legendaire a ~2 ans.
 */
export const TREE_STAGES: TreeStageInfo[] = [
  { stage: 'graine',      minLevel: 1,  maxLevel: 2,  labelKey: 'mascot.stages.graine',      descriptionKey: 'mascot.stages.graineDesc' },
  { stage: 'pousse',      minLevel: 3,  maxLevel: 5,  labelKey: 'mascot.stages.pousse',      descriptionKey: 'mascot.stages.pousseDesc' },
  { stage: 'arbuste',     minLevel: 6,  maxLevel: 10, labelKey: 'mascot.stages.arbuste',     descriptionKey: 'mascot.stages.arbusteDesc' },
  { stage: 'arbre',       minLevel: 11, maxLevel: 18, labelKey: 'mascot.stages.arbre',       descriptionKey: 'mascot.stages.arbreDesc' },
  { stage: 'majestueux',  minLevel: 19, maxLevel: 30, labelKey: 'mascot.stages.majestueux',  descriptionKey: 'mascot.stages.majestueuxDesc' },
  { stage: 'legendaire',  minLevel: 31, maxLevel: 50, labelKey: 'mascot.stages.legendaire',  descriptionKey: 'mascot.stages.legendaireDesc' },
];

/** Informations visuelles d'une espèce */
export interface SpeciesVisual {
  species: TreeSpecies;
  labelKey: string;
  emoji: string;
  /** Palette de couleurs par saison (printemps par défaut pour MVP) */
  trunk: string;           // couleur du tronc
  trunkDark: string;       // ombre du tronc
  leaves: string;          // couleur primaire feuillage
  leavesDark: string;      // ombre feuillage
  leavesLight: string;     // reflet feuillage
  accent: string;          // fleurs/fruits/détails
  accentLight: string;     // reflet accent
  particle: string;        // couleur particules
}

/** Données visuelles des 5 espèces */
export const SPECIES_INFO: Record<TreeSpecies, SpeciesVisual> = {
  cerisier: {
    species: 'cerisier',
    labelKey: 'mascot.species.cerisier',
    emoji: '🌸',
    trunk: '#8B6F47',
    trunkDark: '#6B5035',
    leaves: '#4ADE80',
    leavesDark: '#22C55E',
    leavesLight: '#86EFAC',
    accent: '#F9A8D4',       // rose sakura
    accentLight: '#FBCFE8',
    particle: '#FFC0CB',
  },
  chene: {
    species: 'chene',
    labelKey: 'mascot.species.chene',
    emoji: '🌳',
    trunk: '#7A5C3A',
    trunkDark: '#5C4229',
    leaves: '#2D6A4F',
    leavesDark: '#1B4332',
    leavesLight: '#52B788',
    accent: '#A0522D',       // glands
    accentLight: '#CD853F',
    particle: '#8B6914',
  },
  bambou: {
    species: 'bambou',
    labelKey: 'mascot.species.bambou',
    emoji: '🎋',
    trunk: '#6B8E23',
    trunkDark: '#556B2F',
    leaves: '#90EE90',
    leavesDark: '#3CB371',
    leavesLight: '#C1FFC1',
    accent: '#98FB98',
    accentLight: '#E0FFE0',
    particle: '#ADFF2F',
  },
  oranger: {
    species: 'oranger',
    labelKey: 'mascot.species.oranger',
    emoji: '🍊',
    trunk: '#8B6F47',
    trunkDark: '#6B5035',
    leaves: '#228B22',
    leavesDark: '#006400',
    leavesLight: '#32CD32',
    accent: '#FF8C00',       // oranges
    accentLight: '#FFA500',
    particle: '#FFD700',
  },
  palmier: {
    species: 'palmier',
    labelKey: 'mascot.species.palmier',
    emoji: '🌴',
    trunk: '#C4A265',
    trunkDark: '#A0855C',
    leaves: '#00A86B',
    leavesDark: '#006B3C',
    leavesLight: '#50C878',
    accent: '#8B4513',       // noix de coco
    accentLight: '#CD853F',
    particle: '#F0E68C',
  },
};

/** Toutes les espèces dans l'ordre d'affichage */
export const ALL_SPECIES: TreeSpecies[] = ['cerisier', 'chene', 'bambou', 'oranger', 'palmier'];

/** Résultat de détection d'évolution */
export interface EvolutionEvent {
  evolved: boolean;
  fromStage?: TreeStage;
  toStage?: TreeStage;
  newLevel: number;
}

/** Zone de la scène pour le placement d'items */
export type SceneZone = 'tree' | 'ground' | 'sky';

/** Slot de placement sur la scène SVG (viewbox 200×240) */
export interface SceneSlot {
  id: string;
  cx: number;
  cy: number;
  zone: SceneZone;
}

/** 10 emplacements répartis sur toute la scène */
export const SCENE_SLOTS: SceneSlot[] = [
  { id: 'tree-top',      cx: 100, cy: 75,  zone: 'tree' },
  { id: 'tree-left',     cx: 60,  cy: 120, zone: 'tree' },
  { id: 'tree-right',    cx: 140, cy: 115, zone: 'tree' },
  { id: 'ground-left',   cx: 30,  cy: 208, zone: 'ground' },
  { id: 'ground-center', cx: 100, cy: 210, zone: 'ground' },
  { id: 'ground-right',  cx: 170, cy: 208, zone: 'ground' },
  { id: 'ground-far-l',  cx: 12,  cy: 215, zone: 'ground' },
  { id: 'ground-far-r',  cx: 188, cy: 215, zone: 'ground' },
  { id: 'sky-left',      cx: 30,  cy: 55,  zone: 'sky' },
  { id: 'sky-right',     cx: 170, cy: 50,  zone: 'sky' },
];

/** Décoration achetable pour l'arbre */
export interface MascotDecoration {
  id: string;
  labelKey: string;
  emoji: string;
  cost: number;          // prix en points
  rarity: 'commun' | 'rare' | 'épique' | 'légendaire' | 'prestige';
  minStage: TreeStage;   // stade minimum pour débloquer
  sagaExclusive?: boolean; // true = obtenu uniquement via saga (pas achetable)
}

/** Habitant achetable pour l'arbre */
export interface MascotInhabitant {
  id: string;
  labelKey: string;
  emoji: string;
  cost: number;
  rarity: 'commun' | 'rare' | 'épique' | 'légendaire' | 'prestige';
  minStage: TreeStage;
  sagaExclusive?: boolean; // true = obtenu uniquement via saga (pas achetable)
}

/** Assets illustrés (remplacent les emojis quand disponibles) */
export const ITEM_ILLUSTRATIONS: Record<string, number> = {
  // Anciennes illustrations aquarelle (décorations existantes)
  guirlandes: require('../../assets/items/guirlandes.png'),
  cabane:     require('../../assets/items/cabane.png'),
  balancoire: require('../../assets/items/balancoire.png'),
  lanterne:   require('../../assets/items/lanterne.png'),
  nid:        require('../../assets/items/nid.png'),
  hamac:      require('../../assets/items/hamac.png'),
  fontaine:   require('../../assets/items/fontaine.png'),
  couronne:   require('../../assets/items/couronne.png'),
  portail:    require('../../assets/items/portail.png'),
  cristal:    require('../../assets/items/cristal.png'),
  // Nouvelles décorations pixel (Mana Seed)
  botte_foin:        require('../../assets/garden/decos/botte_foin.png'),
  etal_fruits:       require('../../assets/garden/decos/etal_fruits.png'),
  // Nouveaux habitants pixel (Mana Seed)
  poussin:   require('../../assets/garden/animals/poussin/idle_1.png'),
  poulet:    require('../../assets/garden/animals/poulet/idle_1.png'),
  canard:    require('../../assets/garden/animals/canard/idle_1.png'),
  cochon:    require('../../assets/garden/animals/cochon/idle_1.png'),
  vache:     require('../../assets/garden/animals/vache/idle_1.png'),
  // Habitants pixel (PixelLab)
  oiseau:     require('../../assets/garden/animals/oiseau/idle_1.png'),
  ecureuil:   require('../../assets/garden/animals/ecureuil/idle_1.png'),
  papillons:  require('../../assets/garden/animals/papillons/idle_1.png'),
  coccinelle: require('../../assets/garden/animals/coccinelle/idle_1.png'),
  hibou:      require('../../assets/garden/animals/hibou/idle_1.png'),
  chat:       require('../../assets/garden/animals/chat/idle_1.png'),
  fee:        require('../../assets/garden/animals/fee/idle_1.png'),
  dragon:     require('../../assets/garden/animals/dragon/idle_1.png'),
  phoenix:    require('../../assets/garden/animals/phoenix/idle_1.png'),
  licorne:    require('../../assets/garden/animals/licorne/idle_1.png'),
};

/** Catalogue décorations MVP */
export const DECORATIONS: MascotDecoration[] = [
  // Décorations pixel (Mana Seed)
  { id: 'botte_foin',   labelKey: 'mascot.deco.botteFoin',   emoji: '🌾', cost: 150,  rarity: 'commun',     minStage: 'pousse' },
  { id: 'etal_fruits',  labelKey: 'mascot.deco.etalFruits',  emoji: '🍎', cost: 500,  rarity: 'épique',     minStage: 'arbre' },
  // Décorations aquarelle (existantes)
  { id: 'balancoire',  labelKey: 'mascot.deco.balancoire',  emoji: '🪢', cost: 200,  rarity: 'commun',     minStage: 'arbuste' },
  { id: 'cabane',      labelKey: 'mascot.deco.cabane',      emoji: '🏠', cost: 500,  rarity: 'rare',       minStage: 'arbre' },
  { id: 'guirlandes',  labelKey: 'mascot.deco.guirlandes',  emoji: '🎄', cost: 150,  rarity: 'commun',     minStage: 'pousse' },
  { id: 'lanterne',    labelKey: 'mascot.deco.lanterne',    emoji: '🏮', cost: 300,  rarity: 'rare',       minStage: 'arbuste' },
  { id: 'nid',         labelKey: 'mascot.deco.nid',         emoji: '🪹', cost: 400,  rarity: 'rare',       minStage: 'arbre' },
  { id: 'hamac',       labelKey: 'mascot.deco.hamac',       emoji: '🛌', cost: 600,  rarity: 'épique',     minStage: 'arbre' },
  { id: 'fontaine',    labelKey: 'mascot.deco.fontaine',    emoji: '⛲', cost: 1000, rarity: 'épique',     minStage: 'majestueux' },
  { id: 'couronne',    labelKey: 'mascot.deco.couronne',    emoji: '👑', cost: 5000, rarity: 'légendaire', minStage: 'legendaire' },
  { id: 'portail',     labelKey: 'mascot.deco.portail',     emoji: '🌀', cost: 12000, rarity: 'prestige',  minStage: 'majestueux' },
  { id: 'cristal',     labelKey: 'mascot.deco.cristal',     emoji: '💎', cost: 15000, rarity: 'prestige',  minStage: 'legendaire' },
  // Saga exclusives
  { id: 'lanterne_argent', labelKey: 'mascot.deco.lanterneArgent', emoji: '🪔', cost: 0, rarity: 'épique',     minStage: 'pousse', sagaExclusive: true },
  { id: 'masque_ombre',    labelKey: 'mascot.deco.masqueOmbre',    emoji: '🎭', cost: 0, rarity: 'légendaire', minStage: 'pousse', sagaExclusive: true },
];

/** Catalogue habitants MVP */
export const INHABITANTS: MascotInhabitant[] = [
  // Animaux pixel (Mana Seed)
  { id: 'poussin',     labelKey: 'mascot.hab.poussin',     emoji: '🐤', cost: 150,  rarity: 'commun',     minStage: 'pousse' },
  { id: 'poulet',      labelKey: 'mascot.hab.poulet',      emoji: '🐔', cost: 250,  rarity: 'commun',     minStage: 'arbuste' },
  { id: 'canard',      labelKey: 'mascot.hab.canard',      emoji: '🦆', cost: 300,  rarity: 'commun',     minStage: 'arbuste' },
  { id: 'cochon',      labelKey: 'mascot.hab.cochon',      emoji: '🐷', cost: 500,  rarity: 'rare',       minStage: 'arbre' },
  { id: 'vache',       labelKey: 'mascot.hab.vache',       emoji: '🐄', cost: 800,  rarity: 'rare',       minStage: 'arbre' },
  // Habitants pixel (PixelLab)
  { id: 'oiseau',      labelKey: 'mascot.hab.oiseau',      emoji: '🐦', cost: 100,  rarity: 'commun',     minStage: 'arbuste' },
  { id: 'ecureuil',    labelKey: 'mascot.hab.ecureuil',    emoji: '🐿️', cost: 250,  rarity: 'commun',     minStage: 'arbuste' },
  { id: 'papillons',   labelKey: 'mascot.hab.papillons',   emoji: '🦋', cost: 200,  rarity: 'commun',     minStage: 'pousse' },
  { id: 'coccinelle',  labelKey: 'mascot.hab.coccinelle',  emoji: '🐞', cost: 150,  rarity: 'commun',     minStage: 'pousse' },
  { id: 'chat',        labelKey: 'mascot.hab.chat',        emoji: '😺', cost: 500,  rarity: 'rare',       minStage: 'arbre' },
  { id: 'hibou',       labelKey: 'mascot.hab.hibou',       emoji: '🦉', cost: 400,  rarity: 'rare',       minStage: 'arbre' },
  // Fantastiques pixel (PixelLab)
  { id: 'fee',         labelKey: 'mascot.hab.fee',         emoji: '🧚', cost: 2000, rarity: 'épique',     minStage: 'majestueux' },
  { id: 'dragon',      labelKey: 'mascot.hab.dragon',      emoji: '🐉', cost: 10000, rarity: 'légendaire', minStage: 'legendaire' },
  { id: 'phoenix',     labelKey: 'mascot.hab.phoenix',     emoji: '🔥', cost: 15000, rarity: 'prestige',  minStage: 'legendaire' },
  { id: 'licorne',     labelKey: 'mascot.hab.licorne',     emoji: '🦄', cost: 20000, rarity: 'prestige',  minStage: 'legendaire' },
  // Saga exclusives
  { id: 'esprit_eau',      labelKey: 'mascot.hab.espritEau',      emoji: '💧', cost: 0, rarity: 'épique',     minStage: 'pousse', sagaExclusive: true },
  { id: 'ancien_gardien',  labelKey: 'mascot.hab.ancienGardien',  emoji: '🌿', cost: 0, rarity: 'légendaire', minStage: 'pousse', sagaExclusive: true },
];

// ─────────────────────────────────────────────
// Ferme — Types & catalogue cultures
// ─────────────────────────────────────────────

/** Definition d'une culture (catalogue) */
export interface CropDefinition {
  id: string;
  labelKey: string;
  emoji: string;
  tasksPerStage: number;   // taches pour avancer d'un stade de croissance
  harvestReward: number;   // feuilles gagnees a la recolte
  minTreeStage: TreeStage; // stade d'arbre minimum pour debloquer
  cost: number;            // cout en feuilles pour les graines
  techRequired?: string;   // id du noeud tech requis pour debloquer (optionnel)
}

/** Instance de culture plantee */
export interface PlantedCrop {
  cropId: string;
  plotIndex: number;       // index de la parcelle (0-9)
  currentStage: number;    // 0 = graine, 4 = pret a recolter
  tasksCompleted: number;  // taches completees dans le stade actuel
  plantedAt: string;       // YYYY-MM-DD
  isGolden?: boolean;      // mutation doree — 3% chance a la plantation
}

/** Nombre de parcelles deblocables par stade d'arbre.
 * Progression plus rapide : ferme des le stade pousse (niv 3),
 * nouvelles parcelles regulieres pour maintenir l'engagement.
 */
export const PLOTS_BY_TREE_STAGE: Record<TreeStage, number> = {
  graine:     0,
  pousse:     3,
  arbuste:    5,
  arbre:      7,
  majestueux: 9,
  legendaire: 12,
};

/** Catalogue des cultures disponibles (4 initiales)
 * Design : la carotte est rapide et gratifiante, les cultures avancees
 * demandent plus mais recompensent mieux. Profit = reward - cost.
 */
export const CROP_CATALOG: CropDefinition[] = [
  // Rapides (1 tache/stade = 4 taches pour recolter)
  { id: 'carrot',     labelKey: 'farm.crop.carrot',     emoji: '🥕', tasksPerStage: 1, harvestReward: 25,  minTreeStage: 'pousse',   cost: 5  },
  { id: 'wheat',      labelKey: 'farm.crop.wheat',      emoji: '🌾', tasksPerStage: 1, harvestReward: 40,  minTreeStage: 'pousse',   cost: 10 },
  { id: 'potato',     labelKey: 'farm.crop.potato',     emoji: '🥔', tasksPerStage: 1, harvestReward: 35,  minTreeStage: 'pousse',   cost: 8  },
  { id: 'beetroot',   labelKey: 'farm.crop.beetroot',   emoji: '🫜', tasksPerStage: 1, harvestReward: 30,  minTreeStage: 'pousse',   cost: 6  },
  // Moyennes (2 taches/stade = 8 taches)
  { id: 'tomato',     labelKey: 'farm.crop.tomato',     emoji: '🍅', tasksPerStage: 2, harvestReward: 80,  minTreeStage: 'arbuste',  cost: 15 },
  { id: 'cabbage',    labelKey: 'farm.crop.cabbage',    emoji: '🥬', tasksPerStage: 2, harvestReward: 70,  minTreeStage: 'arbuste',  cost: 12 },
  { id: 'cucumber',   labelKey: 'farm.crop.cucumber',   emoji: '🥒', tasksPerStage: 2, harvestReward: 75,  minTreeStage: 'arbuste',  cost: 14 },
  // Lentes mais rentables (3 taches/stade = 12 taches)
  { id: 'corn',       labelKey: 'farm.crop.corn',       emoji: '🌽', tasksPerStage: 3, harvestReward: 150, minTreeStage: 'arbre',    cost: 30 },
  { id: 'strawberry', labelKey: 'farm.crop.strawberry', emoji: '🍓', tasksPerStage: 2, harvestReward: 120, minTreeStage: 'arbre',    cost: 25 },
  { id: 'pumpkin',    labelKey: 'farm.crop.pumpkin',    emoji: '🎃', tasksPerStage: 3, harvestReward: 200, minTreeStage: 'majestueux', cost: 40 },
  // Debloquee par tech culture-3
  { id: 'sunflower',  labelKey: 'farm.crop.sunflower',  emoji: '🌻', tasksPerStage: 2, harvestReward: 100, minTreeStage: 'pousse', cost: 20, techRequired: 'culture-3' },
];

// ─────────────────────────────────────────────
// Ferme — Batiments productifs (ressources)
// ─────────────────────────────────────────────

/** Types de ressources produites par les batiments */
export type ResourceType = 'oeuf' | 'lait' | 'farine';

/** Inventaire ressources de la ferme */
export interface FarmInventory {
  oeuf: number;
  lait: number;
  farine: number;
}

/** Batiment place sur la grille */
export interface PlacedBuilding {
  buildingId: string;     // ref dans BUILDING_CATALOG
  cellId: string;         // id de la cellule (b0, b1, b2)
  level: number;          // niveau actuel (1-3)
  lastCollectAt: string;  // ISO string de la derniere collecte
}

/** Palier d'amelioration d'un batiment */
export interface BuildingTier {
  level: number;
  productionRateHours: number;  // une ressource produite toutes les N heures
  upgradeCoins: number;         // cout en feuilles pour ameliorer vers ce niveau
  spriteSuffix: string;         // suffixe sprite (ex: "_lv1", "_lv2")
}

export interface BuildingDefinition {
  id: string;
  labelKey: string;
  emoji: string;
  cost: number;            // cout en feuilles (niveau 1)
  dailyIncome: number;     // feuilles/jour (pour compatibilite collectPassiveIncome)
  minTreeStage: TreeStage;
  resourceType: ResourceType;
  tiers: BuildingTier[];
}

/** Batiments : revenu passif en ressources (oeuf, lait, farine).
 * 3 niveaux d'amelioration par batiment.
 */
// ─────────────────────────────────────────────
// Craft — Types & catalogue recettes
// ─────────────────────────────────────────────

/** Ingredient pour une recette de craft */
export interface CraftIngredient {
  itemId: string;           // cropId (ex: 'strawberry') ou resourceType (ex: 'oeuf')
  quantity: number;
  source: 'crop' | 'building';  // d'ou vient l'ingredient
}

/** Recette de craft */
export interface CraftRecipe {
  id: string;
  labelKey: string;
  emoji: string;
  ingredients: CraftIngredient[];
  xpBonus: number;          // XP supplementaire au craft
  sellValue: number;         // feuilles obtenues a la vente (= sum harvestReward x2)
}

/** Item crafte en inventaire */
export interface CraftedItem {
  recipeId: string;
  craftedAt: string;         // ISO date string
  isGolden?: boolean;        // true si tous les ingredients etaient golden
}

/** Inventaire des recoltes brutes (cultures recoltees non vendues) */
export interface HarvestInventory {
  [cropId: string]: number;  // ex: { strawberry: 3, wheat: 1 }
}

export const BUILDING_CATALOG: BuildingDefinition[] = [
  {
    id: 'poulailler',
    labelKey: 'farm.building.poulailler',
    emoji: '🐔',
    cost: 300,
    dailyIncome: 5,
    minTreeStage: 'pousse',
    resourceType: 'oeuf',
    tiers: [
      { level: 1, productionRateHours: 8,  upgradeCoins: 0,   spriteSuffix: '' },
      { level: 2, productionRateHours: 6,  upgradeCoins: 500, spriteSuffix: '_lv2' },
      { level: 3, productionRateHours: 4,  upgradeCoins: 1200, spriteSuffix: '_lv3' },
    ],
  },
  {
    id: 'grange',
    labelKey: 'farm.building.grange',
    emoji: '🏚️',
    cost: 800,
    dailyIncome: 8,
    minTreeStage: 'arbuste',
    resourceType: 'lait',
    tiers: [
      { level: 1, productionRateHours: 10, upgradeCoins: 0,    spriteSuffix: '' },
      { level: 2, productionRateHours: 7,  upgradeCoins: 800,  spriteSuffix: '_lv2' },
      { level: 3, productionRateHours: 5,  upgradeCoins: 2000, spriteSuffix: '_lv3' },
    ],
  },
  {
    id: 'moulin',
    labelKey: 'farm.building.moulin',
    emoji: '⚙️',
    cost: 1500,
    dailyIncome: 12,
    minTreeStage: 'arbre',
    resourceType: 'farine',
    tiers: [
      { level: 1, productionRateHours: 12, upgradeCoins: 0,    spriteSuffix: '' },
      { level: 2, productionRateHours: 8,  upgradeCoins: 1500, spriteSuffix: '_lv2' },
      { level: 3, productionRateHours: 5,  upgradeCoins: 3000, spriteSuffix: '_lv3' },
    ],
  },
];
