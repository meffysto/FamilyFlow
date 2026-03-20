/**
 * auto-courses.ts — Calcul automatique des ingrédients manquants
 *
 * Quand un repas est planifié avec une recette, on compare les ingrédients
 * de la recette avec le stock actuel, puis on retourne le delta à ajouter
 * aux courses. La dédup courses est gérée par mergeCourseIngredients().
 */

import type { AppIngredient } from './cooklang';
import type { StockItem } from './types';
import { categorizeIngredient, formatIngredient } from './cooklang';

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/** Produits de base qu'on a toujours — jamais ajoutés aux courses automatiquement */
const BASIC_INGREDIENTS = new Set(
  [
    'sel', 'poivre', 'poivre noir', 'poivre blanc',
    'huile', "huile d'olive", 'huile de tournesol', 'huile végétale',
    'eau', 'eau froide', 'eau chaude', 'eau tiède',
  ].map(normalize),
);

function isBasicIngredient(name: string): boolean {
  return BASIC_INGREDIENTS.has(normalize(name));
}

/** Vérifie si un ingrédient est déjà couvert par le stock actuel (fuzzy) */
function isInStock(ingredientName: string, stock: StockItem[]): boolean {
  const norm = normalize(ingredientName);
  for (const item of stock) {
    if (item.quantite <= 0) continue;
    const prodNorm = normalize(item.produit);
    if (norm === prodNorm) return true;
    if (norm.includes(prodNorm) && prodNorm.length >= 3) return true;
    if (prodNorm.includes(norm) && norm.length >= 3) return true;
  }
  return false;
}

export interface CourseIngredientItem {
  text: string;
  name: string;
  quantity: number | null;
  section: string;
}

/**
 * Calcule les ingrédients manquants d'une recette par rapport au stock.
 * La dédup vs courses existantes est gérée par mergeCourseIngredients().
 */
export function computeMissingIngredients(
  ingredients: AppIngredient[],
  stock: StockItem[],
): CourseIngredientItem[] {
  const missing: CourseIngredientItem[] = [];

  for (const ing of ingredients) {
    if (isBasicIngredient(ing.name)) continue;
    if (isInStock(ing.name, stock)) continue;

    missing.push({
      text: formatIngredient(ing),
      name: ing.name,
      quantity: ing.quantity,
      section: categorizeIngredient(ing.name),
    });
  }

  return missing;
}
