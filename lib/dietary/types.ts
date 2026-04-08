// ─────────────────────────────────────────────────────────────────────────────
// lib/dietary/types.ts
// Types fondamentaux pour la gestion des préférences alimentaires (Phase 15).
// Ce fichier est purement déclaratif — aucun import runtime, aucune logique.
// Tous les autres plans de la phase 15 importent depuis ce fichier.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les 4 niveaux de sévérité d'une contrainte alimentaire.
 *
 * - allergie    : réaction potentiellement vitale (badge rouge non-dismissible PREF-11)
 * - intolerance : inconfort digestif sans danger vital (badge orange)
 * - regime      : choix délibéré éthique, religieux ou médical (badge jaune)
 * - aversion    : préférence personnelle / dégoût (badge neutre)
 */
export type DietarySeverity = 'allergie' | 'intolerance' | 'regime' | 'aversion';

/**
 * Entrée d'un catalogue canonique (allergènes UE, intolérances, régimes).
 *
 * - id      : identifiant stable, snake_case, ne jamais renommer après livraison
 * - label   : libellé affiché en français
 * - aliases : variants FR permettant le matching dans les ingrédients .cook
 */
export interface DietaryItem {
  id: string;
  label: string;
  aliases?: string[];
}

/**
 * Résultat de la fonction pure `checkAllergens` (Plan 02).
 *
 * - ingredientName  : nom brut de l'ingrédient dans la recette .cook
 * - matchedAllergen : id canonique du DietaryItem ayant déclenché le conflit
 * - severity        : sévérité la plus haute parmi les profils concernés
 * - profileIds      : liste des IDs de profils ayant cette contrainte
 * - profileNames    : noms correspondants pour affichage direct dans le bandeau
 *                     (évite un lookup supplémentaire côté UI)
 */
export interface DietaryConflict {
  ingredientName: string;
  matchedAllergen: string;
  severity: DietarySeverity;
  profileIds: string[];
  profileNames: string[];
}

/**
 * Profil invité récurrent — stocké dans `02 - Famille/Invités.md`.
 *
 * Intentionnellement allégé : pas de gamification, pas de role, pas d'avatar.
 * Ne doit PAS étendre l'interface `Profile` (invités sans progression).
 * Voir D-03 et PREF-06 dans 15-CONTEXT.md.
 *
 * Les 4 tableaux `food_*` suivent exactement les mêmes sévérités que Profile.
 */
export interface GuestProfile {
  id: string;
  name: string;
  foodAllergies: string[];
  foodIntolerances: string[];
  foodRegimes: string[];
  foodAversions: string[];
}

/**
 * Extraction structurée produite par `extractDietaryConstraints` dans lib/ai-service.ts
 * à partir de la dictée vocale (Plan 06, D-13/D-14).
 *
 * - profileId   : ID du profil ciblé (null si l'IA n'a pas pu le déterminer)
 * - profileName : nom du profil tel que compris par l'IA (pour affichage dans la modale preview)
 * - category    : sévérité détectée
 * - item        : libellé de la contrainte extraite (ID canonique si détecté, texte libre sinon)
 * - confidence  : niveau de confiance de l'extraction IA
 */
export interface DietaryExtraction {
  profileId: string | null;
  profileName: string;
  category: DietarySeverity;
  item: string;
  confidence: 'high' | 'medium' | 'low';
}
