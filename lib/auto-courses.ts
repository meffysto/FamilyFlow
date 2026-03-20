/**
 * auto-courses.ts — Automatisations du flux recettes→courses→stock
 *
 * Phase 1 : Recette planifiée → ingrédients manquants ajoutés aux courses
 * Phase 2 : Course cochée → stock incrémenté ou créé (si catégorie stockable)
 */

import type { AppIngredient } from './cooklang';
import type { StockItem, CourseItem } from './types';
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

/** Trouve un produit stock correspondant au texte donné (fuzzy match) */
function findStockMatch(text: string, stock: StockItem[]): StockItem | null {
  const norm = normalize(text);
  for (const item of stock) {
    const prodNorm = normalize(item.produit);
    if (norm === prodNorm) return item;
    if (norm.includes(prodNorm) && prodNorm.length >= 3) return item;
    if (prodNorm.includes(norm) && norm.length >= 3) return item;
  }
  return null;
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
    if (findStockMatch(ing.name, stock.filter(s => s.quantite > 0))) continue;

    missing.push({
      text: formatIngredient(ing),
      name: ing.name,
      quantity: ing.quantity,
      section: categorizeIngredient(ing.name),
    });
  }

  return missing;
}

// ─── Phase 2 : Course cochée → Stock ────────────────────────────────────────

/** Catégories dont les produits méritent d'être trackés en stock */
const STOCKABLE_CATEGORIES = new Set([
  '🥩 Viandes', '🐟 Poissons', '🧀 Crèmerie', '🥚 Œufs',
  '🥬 Légumes', '🍎 Fruits', '🍝 Féculents', '🧁 Pâtisserie',
  '🫙 Condiments', '🌿 Épices', '🥖 Boulangerie', '🥤 Boissons',
  '🧊 Surgelés', '👶 Bébé',
]);

/** Déduit l'emplacement stock depuis la catégorie courses */
function emplacementFromCategory(category: string): string {
  if (category === '🧊 Surgelés') return 'congelateur';
  if (category === '👶 Bébé') return 'bebe';
  if (['🧀 Crèmerie', '🥚 Œufs', '🥩 Viandes', '🐟 Poissons'].includes(category))
    return 'frigo';
  return 'placards';
}

export interface StockUpdateResult {
  /** Produit stock existant → incrémenté */
  incremented: StockItem | null;
  /** Produit nouveau → à créer dans le stock */
  newItem: Omit<StockItem, 'lineIndex'> | null;
}

/** Regex alignée sur parseIngredientText() de cooklang.ts */
const QUANTITY_PREFIX_RE = /^(?:\d+(?:[.,]\d+)?\s*(?:g|kg|ml|cl|dl|l|cs|cc|CS|CC|càs|càc|c\.?\s*à\s*s\.?|c\.?\s*à\s*c\.?|tasse|pincée|sachet|tranche|feuille|brin|gousse|botte|paquet|boîte|pot|verre|tbsp|tsp)?\s*(?:de\s+|d')?)?(.+)/i;

/**
 * Détermine l'action stock quand une course est cochée.
 * - Si le produit existe dans le stock → incrémenter
 * - Si le produit n'existe pas mais est dans une catégorie stockable → créer
 * - Sinon → rien (hygiène, entretien, etc.)
 *
 * Note : le décochage ne décrémente pas le stock — une course cochée = achetée.
 */
export function resolveStockAction(
  courseItem: CourseItem,
  stock: StockItem[],
): StockUpdateResult {
  // Chercher un match dans le stock existant
  const match = findStockMatch(courseItem.text, stock);
  if (match) return { incremented: match, newItem: null };

  // Pas dans le stock — vérifier si la catégorie est stockable
  const category = courseItem.section || categorizeIngredient(courseItem.text);
  if (!STOCKABLE_CATEGORIES.has(category)) return { incremented: null, newItem: null };

  // Extraire le nom propre (sans quantité/unité) pour le produit stock
  const nameMatch = courseItem.text.match(QUANTITY_PREFIX_RE);
  const produit = nameMatch ? nameMatch[1].trim() : courseItem.text;

  return {
    incremented: null,
    newItem: {
      produit,
      quantite: 1,
      seuil: 1,
      qteAchat: 1,
      emplacement: emplacementFromCategory(category),
    },
  };
}
