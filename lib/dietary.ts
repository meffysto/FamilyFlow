// ─────────────────────────────────────────────────────────────────────────────
// lib/dietary.ts
// Fonction pure checkAllergens — cœur de la sécurité allergène (ARCH-03).
//
// Croise les ingrédients d'une recette avec les contraintes des convives
// (profils enregistrés + invités) et retourne la liste des conflits.
//
// Règle de conservatisme (PREF-11) : en cas de match ambigu, déclencher.
// Un faux positif est préférable à un faux négatif sur une allergie vitale.
//
// Aucune nouvelle dépendance npm (ARCH-05).
// ─────────────────────────────────────────────────────────────────────────────

import type { DietarySeverity, DietaryConflict, GuestProfile } from './dietary/types';
import type { Profile } from './types';
import type { AppRecipe } from './cooklang';
import { EU_ALLERGENS, COMMON_INTOLERANCES, COMMON_REGIMES } from './dietary/catalogs';

// ─── Normalisation ───────────────────────────────────────────────────────────

/**
 * Normalise un texte pour le matching :
 * - mise en minuscules
 * - suppression des diacritiques (accents)
 * - normalisation des apostrophes
 * - suppression des espaces en début/fin
 *
 * Exemples :
 *   "Crème Fraîche" → "creme fraiche"
 *   "Cacahuètes" → "cacahuetes"
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, "'")
    .trim();
}

// ─── Résolution des aliases ──────────────────────────────────────────────────

/**
 * Pour un ID de contrainte et une sévérité, retourne la liste d'aliases
 * normalisés à utiliser pour le matching dans les ingrédients.
 *
 * Logique de résolution :
 *   1. Chercher l'ID dans le catalogue correspondant à la sévérité.
 *   2. Si trouvé : retourner [id, ...aliases] normalisés.
 *   3. Si non trouvé dans le catalogue (texte libre ou aversion) :
 *      retourner [normalizeText(constraintId)] — matching direct par substring.
 */
function resolveConstraintAliases(constraintId: string, severity: DietarySeverity): string[] {
  // Sélectionner le catalogue selon la sévérité
  let catalog = EU_ALLERGENS;
  if (severity === 'intolerance') catalog = COMMON_INTOLERANCES;
  else if (severity === 'regime') catalog = COMMON_REGIMES;
  else if (severity === 'aversion') {
    // Les aversions sont du texte libre — matching direct par substring
    return [normalizeText(constraintId)];
  }

  // Chercher l'entrée par ID dans le catalogue
  const entry = catalog.find(item => item.id === constraintId);
  if (entry) {
    // Inclure l'ID lui-même ET tous ses aliases normalisés
    const allTerms = [entry.id, ...(entry.aliases ?? [])].map(normalizeText);
    return allTerms;
  }

  // ID non trouvé dans le catalogue (ex : texte libre ou ID inconnu)
  // Matching conservateur : tenter quand même un match par substring
  return [normalizeText(constraintId)];
}

// ─── Matching substring ──────────────────────────────────────────────────────

/**
 * Vérifie si un ingrédient normalisé contient l'un des termes de matching.
 * Matching substring : conservateur par design (PREF-11).
 *
 * @param normalizedIngredient - Nom de l'ingrédient normalisé
 * @param terms - Liste de termes normalisés à chercher (aliases)
 * @returns Le premier terme trouvé, ou null si aucun match
 */
function matchTerms(normalizedIngredient: string, terms: string[]): string | null {
  for (const term of terms) {
    if (term.length > 0 && normalizedIngredient.includes(term)) {
      return term;
    }
  }
  return null;
}

// ─── Convive unifié ──────────────────────────────────────────────────────────

/**
 * Représentation interne d'un convive (profil ou invité) avec ses contraintes.
 */
interface Convive {
  id: string;
  name: string;
  /** Contraintes par sévérité */
  allergens: string[];
  intolerances: string[];
  regimes: string[];
  aversions: string[];
}

/**
 * Convertit un Profile en Convive interne.
 * Les champs foodAllergies etc. peuvent être absents sur des profils anciens.
 */
function profileToConvive(p: Profile): Convive {
  const asAny = p as unknown as Record<string, unknown>;
  return {
    id: p.id,
    name: p.name,
    allergens: Array.isArray(asAny['foodAllergies']) ? (asAny['foodAllergies'] as string[]) : [],
    intolerances: Array.isArray(asAny['foodIntolerances']) ? (asAny['foodIntolerances'] as string[]) : [],
    regimes: Array.isArray(asAny['foodRegimes']) ? (asAny['foodRegimes'] as string[]) : [],
    aversions: Array.isArray(asAny['foodAversions']) ? (asAny['foodAversions'] as string[]) : [],
  };
}

/**
 * Convertit un GuestProfile en Convive interne.
 */
function guestToConvive(g: GuestProfile): Convive {
  return {
    id: g.id,
    name: g.name,
    allergens: g.foodAllergies ?? [],
    intolerances: g.foodIntolerances ?? [],
    regimes: g.foodRegimes ?? [],
    aversions: g.foodAversions ?? [],
  };
}

// ─── checkAllergens ──────────────────────────────────────────────────────────

/**
 * Croise les ingrédients d'une recette avec les contraintes des convives.
 *
 * @param recipe     - Recette à analyser (AppRecipe de lib/cooklang.ts)
 * @param profileIds - IDs des profils enregistrés présents (filtre sur allProfiles)
 * @param allProfiles - Tous les profils disponibles dans le vault
 * @param guests     - Invités ponctuels (GuestProfile, sans gamification)
 * @returns Liste des conflits détectés, sans doublons (même ingredient + allergen fusionnés)
 *
 * Algorithme :
 *   1. Filtrer allProfiles sur profileIds, convertir en Convive.
 *   2. Ajouter les invités dont l'ID figure dans profileIds.
 *   3. Pour chaque ingrédient de la recette, normaliser son nom.
 *   4. Pour chaque convive, pour chaque sévérité, résoudre les aliases et tenter un match.
 *   5. Regrouper : même ingredientName + matchedAllergen + severity → fusionner profileIds.
 *   6. Retourner les conflits.
 */
export function checkAllergens(
  recipe: AppRecipe,
  profileIds: string[],
  allProfiles: Profile[],
  guests: GuestProfile[],
): DietaryConflict[] {
  if (profileIds.length === 0) return [];
  if (!recipe.ingredients || recipe.ingredients.length === 0) return [];

  const idSet = new Set(profileIds);

  // 1. Construire la liste des convives actifs
  const convives: Convive[] = [
    // Profils enregistrés filtrés par profileIds
    ...allProfiles.filter(p => idSet.has(p.id)).map(profileToConvive),
    // Invités dont l'ID figure dans profileIds
    ...guests.filter(g => idSet.has(g.id)).map(guestToConvive),
  ];

  if (convives.length === 0) return [];

  // Clé de déduplication : ingredientName|constraintId|severity
  type ConflictKey = string;
  const conflictMap = new Map<ConflictKey, DietaryConflict>();

  for (const ingredient of recipe.ingredients) {
    const normalizedIngredient = normalizeText(ingredient.name);

    for (const convive of convives) {
      // Paires (constraintId, severity) à tester pour ce convive
      const constraintPairs: Array<[string, DietarySeverity]> = [
        ...convive.allergens.map(id => [id, 'allergie'] as [string, DietarySeverity]),
        ...convive.intolerances.map(id => [id, 'intolerance'] as [string, DietarySeverity]),
        ...convive.regimes.map(id => [id, 'regime'] as [string, DietarySeverity]),
        ...convive.aversions.map(id => [id, 'aversion'] as [string, DietarySeverity]),
      ];

      for (const [constraintId, severity] of constraintPairs) {
        const terms = resolveConstraintAliases(constraintId, severity);
        const matched = matchTerms(normalizedIngredient, terms);

        if (matched !== null) {
          // Conflit détecté — chercher si déjà enregistré pour ce triplet
          const key: ConflictKey = `${ingredient.name}|${constraintId}|${severity}`;

          if (conflictMap.has(key)) {
            // Fusionner : ajouter ce convive au conflict existant
            const existing = conflictMap.get(key)!;
            if (!existing.profileIds.includes(convive.id)) {
              existing.profileIds.push(convive.id);
              existing.profileNames.push(convive.name);
            }
          } else {
            // Nouveau conflit
            conflictMap.set(key, {
              ingredientName: ingredient.name,
              matchedAllergen: constraintId,
              severity,
              profileIds: [convive.id],
              profileNames: [convive.name],
            });
          }
        }
      }
    }
  }

  return Array.from(conflictMap.values());
}
