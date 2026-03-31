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
  | 'craft';

/** Données persistées du compagnon dans le profil */
export interface CompanionData {
  activeSpecies: CompanionSpecies;
  name: string;
  unlockedSpecies: CompanionSpecies[];
  mood: CompanionMood;
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
}

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
