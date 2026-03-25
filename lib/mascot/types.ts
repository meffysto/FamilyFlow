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
export const TREE_STAGES: TreeStageInfo[] = [
  { stage: 'graine',      minLevel: 1,  maxLevel: 3,  labelKey: 'mascot.stages.graine',      descriptionKey: 'mascot.stages.graineDesc' },
  { stage: 'pousse',      minLevel: 4,  maxLevel: 7,  labelKey: 'mascot.stages.pousse',      descriptionKey: 'mascot.stages.pousseDesc' },
  { stage: 'arbuste',     minLevel: 8,  maxLevel: 18, labelKey: 'mascot.stages.arbuste',     descriptionKey: 'mascot.stages.arbusteDesc' },
  { stage: 'arbre',       minLevel: 19, maxLevel: 32, labelKey: 'mascot.stages.arbre',       descriptionKey: 'mascot.stages.arbreDesc' },
  { stage: 'majestueux',  minLevel: 33, maxLevel: 40, labelKey: 'mascot.stages.majestueux',  descriptionKey: 'mascot.stages.majestueuxDesc' },
  { stage: 'legendaire',  minLevel: 41, maxLevel: 50, labelKey: 'mascot.stages.legendaire',  descriptionKey: 'mascot.stages.legendaireDesc' },
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

/** Décoration achetable pour l'arbre */
export interface MascotDecoration {
  id: string;
  labelKey: string;
  emoji: string;
  cost: number;          // prix en points
  rarity: 'commun' | 'rare' | 'épique' | 'légendaire' | 'prestige';
  minStage: TreeStage;   // stade minimum pour débloquer
}

/** Habitant achetable pour l'arbre */
export interface MascotInhabitant {
  id: string;
  labelKey: string;
  emoji: string;
  cost: number;
  rarity: 'commun' | 'rare' | 'épique' | 'légendaire' | 'prestige';
  minStage: TreeStage;
}

/** Catalogue décorations MVP */
export const DECORATIONS: MascotDecoration[] = [
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
];

/** Catalogue habitants MVP */
export const INHABITANTS: MascotInhabitant[] = [
  { id: 'oiseau',      labelKey: 'mascot.hab.oiseau',      emoji: '🐦', cost: 100,  rarity: 'commun',     minStage: 'arbuste' },
  { id: 'ecureuil',    labelKey: 'mascot.hab.ecureuil',    emoji: '🐿️', cost: 250,  rarity: 'commun',     minStage: 'arbuste' },
  { id: 'papillons',   labelKey: 'mascot.hab.papillons',   emoji: '🦋', cost: 200,  rarity: 'commun',     minStage: 'pousse' },
  { id: 'coccinelle',  labelKey: 'mascot.hab.coccinelle',  emoji: '🐞', cost: 150,  rarity: 'commun',     minStage: 'pousse' },
  { id: 'chat',        labelKey: 'mascot.hab.chat',        emoji: '😺', cost: 500,  rarity: 'rare',       minStage: 'arbre' },
  { id: 'hibou',       labelKey: 'mascot.hab.hibou',       emoji: '🦉', cost: 400,  rarity: 'rare',       minStage: 'arbre' },
  { id: 'fee',         labelKey: 'mascot.hab.fee',         emoji: '🧚', cost: 2000, rarity: 'épique',     minStage: 'majestueux' },
  { id: 'dragon',      labelKey: 'mascot.hab.dragon',      emoji: '🐉', cost: 10000, rarity: 'légendaire', minStage: 'legendaire' },
  { id: 'phoenix',     labelKey: 'mascot.hab.phoenix',     emoji: '🔥', cost: 15000, rarity: 'prestige',  minStage: 'legendaire' },
  { id: 'licorne',     labelKey: 'mascot.hab.licorne',     emoji: '🦄', cost: 20000, rarity: 'prestige',  minStage: 'legendaire' },
];
