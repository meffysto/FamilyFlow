// ─────────────────────────────────────────────
// Compagnon Mascotte — Types & constantes
// ─────────────────────────────────────────────

/** 5 espèces de compagnons disponibles */
export type CompanionSpecies = 'chat' | 'chien' | 'lapin' | 'renard' | 'herisson';

/** 3 stades de croissance du compagnon */
export type CompanionStage = 'bebe' | 'jeune' | 'adulte';

/** Humeur du compagnon */
export type CompanionMood = 'content' | 'endormi' | 'excite' | 'triste';

/** Événements déclenchant un message du compagnon */
export type CompanionEvent =
  | 'task_completed'
  | 'loot_opened'
  | 'level_up'
  | 'greeting'
  | 'streak_milestone'
  | 'harvest'
  | 'craft'
  // Événements enrichis
  | 'routine_completed'
  | 'budget_alert'
  | 'meal_planned'
  | 'gratitude_written'
  | 'photo_added'
  | 'defi_completed'
  | 'family_milestone'
  | 'weekly_recap'
  // Messages proactifs
  | 'morning_greeting'
  | 'gentle_nudge'
  | 'comeback'
  | 'celebration'
  // Événements d'usure & bâtiments
  | 'building_full'
  | 'fence_broken'
  | 'roof_damaged'
  | 'weeds_growing'
  | 'pests_attacking'
  | 'wear_repaired';

/** Données persistées du compagnon dans le profil */
export interface CompanionData {
  activeSpecies: CompanionSpecies;
  name: string;
  unlockedSpecies: CompanionSpecies[];
  // Phase 20 — propagation événement sémantique (EFFECTS-04)
  lastEventType?: string;  // ex: 'task_completed' — rendu Phase 21
  lastEventAt?: string;    // ISO datetime du dernier événement
}

/** Mapping stade → plage de niveaux */
export interface CompanionStageInfo {
  stage: CompanionStage;
  minLevel: number;
  maxLevel: number;
  labelKey: string;
}

/** Informations sur une espèce de compagnon */
export interface CompanionSpeciesInfo {
  id: CompanionSpecies;
  nameKey: string;
  descriptionKey: string;
  rarity: 'initial' | 'rare' | 'epique';
}

/** Contexte passé aux fonctions de message */
export interface CompanionMessageContext {
  profileName: string;
  companionName: string;
  companionSpecies: CompanionSpecies;
  tasksToday: number;
  streak: number;
  level: number;
  lastAction?: string;
  recentTasks?: string[];       // noms des dernières tâches complétées aujourd'hui
  nextRdv?: { title: string; date: string } | null;  // prochain RDV à venir
  todayMeals?: string[];        // repas planifiés aujourd'hui (ex: "Pâtes carbonara")
  recentMessages?: string[];    // 3 derniers messages du compagnon (mémoire courte)
  mood?: CompanionMood;          // humeur actuelle du compagnon
  moodScore?: number;            // score numérique de mood
  pendingTasks?: string[];       // tâches à faire aujourd'hui (pas encore complétées)
  timeOfDay?: 'matin' | 'apres-midi' | 'soir' | 'nuit';
  subType?: string;  // Phase 21 — CategoryId de la tache semantique, passe a pickCompanionMessage pour templates sub-type
}

/** Personnalité propre à chaque espèce de compagnon */
export interface CompanionPersonality {
  tone: string;       // description du ton pour le prompt IA
  traits: string[];   // traits de caractère
  quirk: string;      // particularité comportementale unique
}

/** Personnalités par espèce — injectées dans le prompt IA */
export const SPECIES_PERSONALITY: Record<CompanionSpecies, CompanionPersonality> = {
  chat: {
    tone: 'nonchalant et un peu moqueur, mais affectueux au fond',
    traits: ['indépendant', 'curieux', 'joueur'],
    quirk: 'fait parfois des remarques ironiques ou parle de siestes',
  },
  chien: {
    tone: 'enthousiaste et loyal, débordant de joie',
    traits: ['fidèle', 'énergique', 'protecteur'],
    quirk: 'célèbre chaque petite victoire comme un exploit énorme',
  },
  lapin: {
    tone: 'doux et timide, toujours encourageant',
    traits: ['calme', 'attentionné', 'sensible'],
    quirk: 'fait souvent référence à la nature, aux saisons ou au jardin',
  },
  renard: {
    tone: 'malin et stratégique, donne des astuces',
    traits: ['rusé', 'observateur', 'complice'],
    quirk: 'propose des stratégies ou remarque des détails que les autres manquent',
  },
  herisson: {
    tone: 'sage et philosophe, parle avec douceur',
    traits: ['patient', 'réfléchi', 'bienveillant'],
    quirk: 'partage parfois de petites sagesses ou métaphores sur la vie',
  },
};

/** Niveau requis pour débloquer le système compagnon */
export const COMPANION_UNLOCK_LEVEL = 1;

/** Bonus XP apporté par la présence d'un compagnon actif (+5%) */
export const COMPANION_XP_BONUS = 1.05;

/**
 * Les 3 stades du compagnon avec leurs plages de niveaux.
 * Bébé : 1-5, Jeune : 6-10, Adulte : 11+
 */
export const COMPANION_STAGES: CompanionStageInfo[] = [
  { stage: 'bebe',   minLevel: 1,  maxLevel: 5,  labelKey: 'companion.stage.bebe' },
  { stage: 'jeune',  minLevel: 6,  maxLevel: 10, labelKey: 'companion.stage.jeune' },
  { stage: 'adulte', minLevel: 11, maxLevel: 99, labelKey: 'companion.stage.adulte' },
];

/**
 * Catalogue des 5 espèces de compagnons.
 * chat/chien/lapin : disponibles au choix initial (per D-01 et D-03)
 * renard : rare (via lootbox)
 * herisson : épique (via lootbox)
 */
export const COMPANION_SPECIES_CATALOG: CompanionSpeciesInfo[] = [
  { id: 'chat',     nameKey: 'companion.species.chat',     descriptionKey: 'companion.speciesDesc.chat',     rarity: 'initial' },
  { id: 'chien',    nameKey: 'companion.species.chien',    descriptionKey: 'companion.speciesDesc.chien',    rarity: 'initial' },
  { id: 'lapin',    nameKey: 'companion.species.lapin',    descriptionKey: 'companion.speciesDesc.lapin',    rarity: 'initial' },
  { id: 'renard',   nameKey: 'companion.species.renard',   descriptionKey: 'companion.speciesDesc.renard',   rarity: 'rare' },
  { id: 'herisson', nameKey: 'companion.species.herisson', descriptionKey: 'companion.speciesDesc.herisson', rarity: 'epique' },
];
