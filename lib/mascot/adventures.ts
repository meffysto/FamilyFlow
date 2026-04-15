// ─────────────────────────────────────────────
// Mascotte Arbre — Aventures quotidiennes
// ─────────────────────────────────────────────

/** Définition d'une aventure */
export interface Adventure {
  id: string;
  emoji: string;
  titleKey: string;       // clé i18n
  descriptionKey: string; // clé i18n
  choiceA: AdventureChoice;
  choiceB: AdventureChoice;
}

export interface AdventureChoice {
  labelKey: string;   // clé i18n du bouton
  emoji: string;
  points: number;     // récompense en points
}

/** Résultat d'un choix d'aventure stocké */
export interface AdventureResult {
  date: string;       // YYYY-MM-DD
  adventureId: string;
  choiceId: 'A' | 'B';
  profileId: string;
}

import { simpleHash, formatDateStr } from './utils';

/** Pool d'aventures */
export const ADVENTURES: Adventure[] = [
  {
    id: 'tresor_ecureuil',
    emoji: '🐿️',
    titleKey: 'mascot.adventure.tresor_ecureuil.title',
    descriptionKey: 'mascot.adventure.tresor_ecureuil.desc',
    choiceA: { labelKey: 'mascot.adventure.tresor_ecureuil.choiceA', emoji: '🔍', points: 15 },
    choiceB: { labelKey: 'mascot.adventure.tresor_ecureuil.choiceB', emoji: '👋', points: 5 },
  },
  {
    id: 'tempete',
    emoji: '🌪️',
    titleKey: 'mascot.adventure.tempete.title',
    descriptionKey: 'mascot.adventure.tempete.desc',
    choiceA: { labelKey: 'mascot.adventure.tempete.choiceA', emoji: '🛡️', points: 12 },
    choiceB: { labelKey: 'mascot.adventure.tempete.choiceB', emoji: '🌬️', points: 5 },
  },
  {
    id: 'voyageur',
    emoji: '🧙',
    titleKey: 'mascot.adventure.voyageur.title',
    descriptionKey: 'mascot.adventure.voyageur.desc',
    choiceA: { labelKey: 'mascot.adventure.voyageur.choiceA', emoji: '🏡', points: 20 },
    choiceB: { labelKey: 'mascot.adventure.voyageur.choiceB', emoji: '👋', points: 8 },
  },
  {
    id: 'lucioles',
    emoji: '✨',
    titleKey: 'mascot.adventure.lucioles.title',
    descriptionKey: 'mascot.adventure.lucioles.desc',
    choiceA: { labelKey: 'mascot.adventure.lucioles.choiceA', emoji: '👀', points: 10 },
    choiceB: { labelKey: 'mascot.adventure.lucioles.choiceB', emoji: '📸', points: 8 },
  },
  {
    id: 'graine_magique',
    emoji: '🌱',
    titleKey: 'mascot.adventure.graine_magique.title',
    descriptionKey: 'mascot.adventure.graine_magique.desc',
    choiceA: { labelKey: 'mascot.adventure.graine_magique.choiceA', emoji: '🌍', points: 20 },
    choiceB: { labelKey: 'mascot.adventure.graine_magique.choiceB', emoji: '🎁', points: 10 },
  },
  {
    id: 'arc_en_ciel',
    emoji: '🌈',
    titleKey: 'mascot.adventure.arc_en_ciel.title',
    descriptionKey: 'mascot.adventure.arc_en_ciel.desc',
    choiceA: { labelKey: 'mascot.adventure.arc_en_ciel.choiceA', emoji: '🎨', points: 12 },
    choiceB: { labelKey: 'mascot.adventure.arc_en_ciel.choiceB', emoji: '📖', points: 8 },
  },
  {
    id: 'hibou_sage',
    emoji: '🦉',
    titleKey: 'mascot.adventure.hibou_sage.title',
    descriptionKey: 'mascot.adventure.hibou_sage.desc',
    choiceA: { labelKey: 'mascot.adventure.hibou_sage.choiceA', emoji: '🧠', points: 15 },
    choiceB: { labelKey: 'mascot.adventure.hibou_sage.choiceB', emoji: '🍪', points: 8 },
  },
  {
    id: 'tresor_pirate',
    emoji: '🏴‍☠️',
    titleKey: 'mascot.adventure.tresor_pirate.title',
    descriptionKey: 'mascot.adventure.tresor_pirate.desc',
    choiceA: { labelKey: 'mascot.adventure.tresor_pirate.choiceA', emoji: '⛏️', points: 18 },
    choiceB: { labelKey: 'mascot.adventure.tresor_pirate.choiceB', emoji: '🗺️', points: 10 },
  },
  {
    id: 'fee_egaree',
    emoji: '🧚',
    titleKey: 'mascot.adventure.fee_egaree.title',
    descriptionKey: 'mascot.adventure.fee_egaree.desc',
    choiceA: { labelKey: 'mascot.adventure.fee_egaree.choiceA', emoji: '🏠', points: 15 },
    choiceB: { labelKey: 'mascot.adventure.fee_egaree.choiceB', emoji: '💫', points: 10 },
  },
  {
    id: 'pluie_etoiles',
    emoji: '🌠',
    titleKey: 'mascot.adventure.pluie_etoiles.title',
    descriptionKey: 'mascot.adventure.pluie_etoiles.desc',
    choiceA: { labelKey: 'mascot.adventure.pluie_etoiles.choiceA', emoji: '🙏', points: 12 },
    choiceB: { labelKey: 'mascot.adventure.pluie_etoiles.choiceB', emoji: '🧪', points: 15 },
  },
  {
    id: 'papillon_geant',
    emoji: '🦋',
    titleKey: 'mascot.adventure.papillon_geant.title',
    descriptionKey: 'mascot.adventure.papillon_geant.desc',
    choiceA: { labelKey: 'mascot.adventure.papillon_geant.choiceA', emoji: '🤲', points: 10 },
    choiceB: { labelKey: 'mascot.adventure.papillon_geant.choiceB', emoji: '📷', points: 8 },
  },
  {
    id: 'concert_oiseaux',
    emoji: '🎵',
    titleKey: 'mascot.adventure.concert_oiseaux.title',
    descriptionKey: 'mascot.adventure.concert_oiseaux.desc',
    choiceA: { labelKey: 'mascot.adventure.concert_oiseaux.choiceA', emoji: '🎶', points: 10 },
    choiceB: { labelKey: 'mascot.adventure.concert_oiseaux.choiceB', emoji: '💃', points: 12 },
  },
  {
    id: 'neige_magique',
    emoji: '❄️',
    titleKey: 'mascot.adventure.neige_magique.title',
    descriptionKey: 'mascot.adventure.neige_magique.desc',
    choiceA: { labelKey: 'mascot.adventure.neige_magique.choiceA', emoji: '⛄', points: 12 },
    choiceB: { labelKey: 'mascot.adventure.neige_magique.choiceB', emoji: '☕', points: 8 },
  },
  {
    id: 'champignon_dore',
    emoji: '🍄',
    titleKey: 'mascot.adventure.champignon_dore.title',
    descriptionKey: 'mascot.adventure.champignon_dore.desc',
    choiceA: { labelKey: 'mascot.adventure.champignon_dore.choiceA', emoji: '🧑‍🍳', points: 15 },
    choiceB: { labelKey: 'mascot.adventure.champignon_dore.choiceB', emoji: '🏛️', points: 10 },
  },
  {
    id: 'lettre_mysterieuse',
    emoji: '✉️',
    titleKey: 'mascot.adventure.lettre_mysterieuse.title',
    descriptionKey: 'mascot.adventure.lettre_mysterieuse.desc',
    choiceA: { labelKey: 'mascot.adventure.lettre_mysterieuse.choiceA', emoji: '📖', points: 12 },
    choiceB: { labelKey: 'mascot.adventure.lettre_mysterieuse.choiceB', emoji: '🔒', points: 8 },
  },
];

/**
 * Retourne l'aventure du jour pour un profil donné.
 * Déterministe : même date + même profil → même aventure.
 */
export function getDailyAdventure(profileId: string, date: Date = new Date()): Adventure {
  const dateStr = formatDateStr(date);
  const hash = simpleHash(`${dateStr}:${profileId}`);
  const idx = hash % ADVENTURES.length;
  return ADVENTURES[idx];
}
