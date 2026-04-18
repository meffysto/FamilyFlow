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

/** Slot de placement sur la scene diorama (fractions 0-1 du conteneur) */
export interface SceneSlot {
  id: string;
  x: number;    // fraction largeur conteneur (0-1)
  y: number;    // fraction hauteur conteneur (0-1)
  zone: SceneZone;
}

/** 10 emplacements repartis sur le diorama (fractions 0-1) */
export const SCENE_SLOTS: SceneSlot[] = [
  { id: 'slot-1',  x: 0.13, y: 0.48, zone: 'ground' },   // herbe gauche milieu
  { id: 'slot-2',  x: 0.57, y: 0.56, zone: 'ground' },   // pied arbre centre
  { id: 'slot-3',  x: 0.73, y: 0.58, zone: 'ground' },   // pied arbre droite
  { id: 'slot-4',  x: 0.58, y: 0.68, zone: 'ground' },   // sous arbre centre
  { id: 'slot-5',  x: 0.64, y: 0.79, zone: 'ground' },   // herbe basse centre-droite
  { id: 'slot-6',  x: 0.41, y: 0.80, zone: 'ground' },   // herbe basse centre-gauche
  { id: 'slot-7',  x: 0.85, y: 0.92, zone: 'ground' },   // herbe bas droite
  { id: 'slot-8',  x: 0.90, y: 0.23, zone: 'ground' },   // a droite du potager
  { id: 'slot-9',  x: 0.91, y: 0.11, zone: 'ground' },   // haut droite
  { id: 'slot-10', x: 0.92, y: 0.04, zone: 'sky' },       // coin haut droite
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
  sagaExclusive?: boolean;      // true = obtenu uniquement via saga (pas achetable)
  expeditionExclusive?: boolean; // true = obtenu uniquement via expédition (Phase 33)
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
  // Habitants expédition-exclusifs (PixelLab)
  renard_arctique: require('../../assets/garden/animals/renard_arctique/idle_1.png'),
  aigle_dore:      require('../../assets/garden/animals/aigle_dore/idle_1.png'),
  lynx_mystere:    require('../../assets/garden/animals/lynx_mystere/idle_1.png'),
  dragon_glace:    require('../../assets/garden/animals/dragon_glace/idle_1.png'),
  loutre_riviere:  require('../../assets/garden/animals/loutre_riviere/idle_1.png'),
  cerf_argente:    require('../../assets/garden/animals/cerf_argente/idle_1.png'),
  tortue_ancienne: require('../../assets/garden/animals/tortue_ancienne/idle_1.png'),
  phenix_celeste:  require('../../assets/garden/animals/phenix_celeste/idle_1.png'),
  loup_etoile:     require('../../assets/garden/animals/loup_etoile/idle_1.png'),
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
  // Expédition exclusives (Phase 33)
  { id: 'renard_arctique', labelKey: 'mascot.hab.renardArctique', emoji: '🦊', cost: 0, rarity: 'rare' as const,    minStage: 'pousse', expeditionExclusive: true },
  { id: 'aigle_dore',      labelKey: 'mascot.hab.aigleDore',      emoji: '🦅', cost: 0, rarity: 'épique' as const,  minStage: 'pousse', expeditionExclusive: true },
  { id: 'lynx_mystere',    labelKey: 'mascot.hab.lynxMystere',    emoji: '🐱', cost: 0, rarity: 'rare' as const,    minStage: 'pousse', expeditionExclusive: true },
  { id: 'dragon_glace',    labelKey: 'mascot.hab.dragonGlace',    emoji: '🐉', cost: 0, rarity: 'épique' as const,  minStage: 'pousse', expeditionExclusive: true },
  { id: 'loutre_riviere',  labelKey: 'mascot.hab.loutreRiviere',  emoji: '🦦', cost: 0, rarity: 'rare' as const,       minStage: 'pousse', expeditionExclusive: true },
  { id: 'cerf_argente',    labelKey: 'mascot.hab.cerfArgente',    emoji: '🦌', cost: 0, rarity: 'épique' as const,     minStage: 'majestueux', expeditionExclusive: true },
  { id: 'tortue_ancienne', labelKey: 'mascot.hab.tortueAncienne', emoji: '🐢', cost: 0, rarity: 'légendaire' as const, minStage: 'majestueux', expeditionExclusive: true },
  { id: 'phenix_celeste',  labelKey: 'mascot.hab.phenixCeleste',  emoji: '🔥', cost: 0, rarity: 'légendaire' as const, minStage: 'legendaire', expeditionExclusive: true },
  { id: 'loup_etoile',     labelKey: 'mascot.hab.loupEtoile',     emoji: '🐺', cost: 0, rarity: 'prestige' as const,   minStage: 'legendaire', expeditionExclusive: true },
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
  dropOnly?: boolean;      // true = graine rare, obtenue uniquement par drop (pas achetable)
  expeditionExclusive?: boolean; // true = graine obtenue uniquement via expédition (Phase 33)
}

/** Durées possibles d'une Sporée de Régularité (Phase 38 — v1.7) */
export type WagerDuration = 'chill' | 'engage' | 'sprint';

/** Multiplicateurs associés aux durées (Chill ×1.3 / Engagé ×1.7 / Sprint ×2.5) */
export type WagerMultiplier = 1.3 | 1.7 | 2.5;

/** Modifier Sporée de Régularité — pari cumulatif bienveillant sur tâches */
export interface WagerModifier {
  sporeeId: string;
  duration: WagerDuration;
  multiplier: WagerMultiplier;
  appliedAt: string;           // ISO YYYY-MM-DD
  sealerProfileId: string;
  cumulTarget?: number;        // Phase 39 — nullable phase 38
  cumulCurrent?: number;       // Phase 39 — nullable phase 38
}

/** Ensemble extensible de modifiers applicables à un plant */
export interface FarmCropModifiers {
  wager?: WagerModifier;
  graftedWith?: string;        // v1.8 Pollen — anticipé, zéro impl phase 38
}

/** Instance de culture plantee */
export interface PlantedCrop {
  cropId: string;
  plotIndex: number;       // index de la parcelle (0-9)
  currentStage: number;    // 0 = graine, 4 = pret a recolter
  tasksCompleted: number;  // taches completees dans le stade actuel
  plantedAt: string;       // YYYY-MM-DD
  isGolden?: boolean;      // mutation doree — 3% chance a la plantation
  modifiers?: FarmCropModifiers;  // Phase 38 (MOD-01) — Sporée, Pollen, etc.
}

/** Nombre de parcelles deblocables par stade d'arbre.
 * Progression plus rapide : ferme des le stade pousse (niv 3),
 * nouvelles parcelles regulieres pour maintenir l'engagement.
 */
export const PLOTS_BY_TREE_STAGE: Record<TreeStage, number> = {
  graine:     0,  // Stade initial : pas encore de parcelles débloquées
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
  // Graines rares (dropOnly — obtenues uniquement par drop a la recolte)
  { id: 'orchidee',       labelKey: 'farm.crop.orchidee',       emoji: '🪻', tasksPerStage: 3, harvestReward: 300, minTreeStage: 'arbuste',    cost: 0, dropOnly: true },
  { id: 'rose_doree',     labelKey: 'farm.crop.rose_doree',     emoji: '🌹', tasksPerStage: 4, harvestReward: 500, minTreeStage: 'arbre',      cost: 0, dropOnly: true },
  { id: 'truffe',         labelKey: 'farm.crop.truffe',         emoji: '🍄', tasksPerStage: 5, harvestReward: 800, minTreeStage: 'majestueux', cost: 0, dropOnly: true },
  { id: 'fruit_dragon',   labelKey: 'farm.crop.fruit_dragon',   emoji: '🐉', tasksPerStage: 4, harvestReward: 600, minTreeStage: 'arbre',      cost: 0, dropOnly: true },
  // Graines exclusives expédition (Phase 33)
  { id: 'fleur_lave',     labelKey: 'farm.crop.fleur_lave',     emoji: '🌺', tasksPerStage: 4, harvestReward: 600, minTreeStage: 'arbre',      cost: 0, dropOnly: true, expeditionExclusive: true },
  { id: 'cristal_noir',   labelKey: 'farm.crop.cristal_noir',   emoji: '💎', tasksPerStage: 5, harvestReward: 900, minTreeStage: 'majestueux', cost: 0, dropOnly: true, expeditionExclusive: true },
  { id: 'mousse_etoile',  labelKey: 'farm.crop.mousse_etoile',  emoji: '🌟', tasksPerStage: 3, harvestReward: 350, minTreeStage: 'pousse',     cost: 0, dropOnly: true, expeditionExclusive: true },
  { id: 'racine_geante',  labelKey: 'farm.crop.racine_geante',  emoji: '🌿', tasksPerStage: 5, harvestReward: 1000, minTreeStage: 'majestueux', cost: 0, dropOnly: true, expeditionExclusive: true },
  { id: 'fleur_celeste',  labelKey: 'farm.crop.fleur_celeste',  emoji: '🌸', tasksPerStage: 6, harvestReward: 1500, minTreeStage: 'legendaire', cost: 0, dropOnly: true, expeditionExclusive: true },
];

// ─────────────────────────────────────────────
// Ferme — Batiments productifs (ressources)
// ─────────────────────────────────────────────

/** Types de ressources produites par les batiments */
export type ResourceType = 'oeuf' | 'lait' | 'farine' | 'miel';

/** Inventaire ressources de la ferme */
export interface FarmInventory {
  oeuf: number;
  lait: number;
  farine: number;
  miel: number;
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
  techRequired?: string;   // id du noeud tech requis pour debloquer (optionnel)
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

/** Ordre canonique des stades d'arbre (utilise pour comparaisons et groupements) */
export const TREE_STAGE_ORDER: TreeStage[] = ['graine', 'pousse', 'arbuste', 'arbre', 'majestueux', 'legendaire'];

/** Recette de craft */
export interface CraftRecipe {
  id: string;
  labelKey: string;
  emoji: string;
  sprite?: ReturnType<typeof require>; // sprite pixel art optionnel (fallback: emoji)
  ingredients: CraftIngredient[];
  xpBonus: number;          // XP supplementaire au craft
  sellValue: number;         // feuilles obtenues a la vente (= sum harvestReward x2)
  minTreeStage: TreeStage;  // stade d'arbre minimum pour debloquer la recette
  requiredUnlock?: string;   // ID de déverrouillage requis (via unlockedRecipes dans family-quests.md)
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

/** Inventaire des graines rares (obtenues par drop a la recolte) */
export interface RareSeedInventory {
  [cropId: string]: number;  // ex: { orchidee: 1, truffe: 2 }
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
  {
    id: 'ruche',
    labelKey: 'farm.building.ruche',
    emoji: '🐝',
    cost: 2000,
    dailyIncome: 10,
    minTreeStage: 'pousse',
    resourceType: 'miel',
    techRequired: 'elevage-3',
    tiers: [
      { level: 1, productionRateHours: 12, upgradeCoins: 0,    spriteSuffix: '' },
      { level: 2, productionRateHours: 8,  upgradeCoins: 2000, spriteSuffix: '_lv2' },
      { level: 3, productionRateHours: 5,  upgradeCoins: 4000, spriteSuffix: '_lv3' },
    ],
  },
];
