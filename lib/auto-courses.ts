/**
 * auto-courses.ts — Automatisations du flux recettes→courses→stock
 *
 * Phase 1 : Recette planifiée → ingrédients manquants ajoutés aux courses
 * Phase 2 : Course cochée → stock incrémenté ou créé (si catégorie stockable)
 * Phase 3 : Repas cuisiné → stock décrémenté des ingrédients de la recette
 */

import type { AppIngredient } from './cooklang';
import type { StockItem, CourseItem, Profile } from './types';
import { categorizeIngredient, formatIngredient, scaleIngredients } from './cooklang';
import { isBabyProfile } from './types';

/** Calcule le nombre de portions familiales à partir des profils */
export function computeFamilyServings(profiles: Profile[]): number {
  let total = 0;
  for (const p of profiles) {
    if (p.statut === 'grossesse') continue; // pas encore né
    if (p.role === 'adulte') { total += 1; continue; }
    if (p.role === 'ado') { total += 0.75; continue; }
    // role === 'enfant' → distinguer par âge
    if (isBabyProfile(p)) { total += 0.25; continue; }
    if (p.ageCategory === 'petit') { total += 0.35; continue; }
    total += 0.5; // enfant par défaut
  }
  return Math.max(1, Math.round(total * 4) / 4); // arrondi au quart
}

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

/** Unités de poids/volume — impossible de comparer avec le stock (en unités) */
const WEIGHT_UNIT_RE = /^(g|kg|ml|cl|dl|l|cs|cc|càs|càc|tasse|pincée|tbsp|tsp)$/i;

/**
 * Calcule les ingrédients manquants d'une recette par rapport au stock.
 * - Poids (120g pecorino) : toujours ajouté (on ne sait pas combien il reste)
 * - Comptes (3 œufs) : delta = max(0, besoin - stock)
 * - Sans quantité (persil) : skip si en stock
 * Si targetServings et baseServings sont fournis, les ingrédients sont scalés.
 * La dédup vs courses existantes est gérée par mergeCourseIngredients().
 */
export function computeMissingIngredients(
  ingredients: AppIngredient[],
  stock: StockItem[],
  targetServings?: number,
  baseServings?: number,
): CourseIngredientItem[] {
  const scaled = targetServings && baseServings
    ? scaleIngredients(ingredients, targetServings, baseServings)
    : ingredients;
  const missing: CourseIngredientItem[] = [];

  for (const ing of scaled) {
    if (isBasicIngredient(ing.name)) continue;

    const match = findStockMatch(ing.name, stock);
    const isWeight = ing.unit && WEIGHT_UNIT_RE.test(ing.unit);

    if (isWeight) {
      // Poids → toujours ajouter (on ne peut pas comparer g vs unités stock)
      missing.push({
        text: formatIngredient(ing),
        name: ing.name,
        quantity: ing.quantity,
        section: categorizeIngredient(ing.name),
      });
      continue;
    }

    if (match && match.quantite > 0) {
      if (ing.quantity === null) continue; // "persil" en stock → skip
      // Compte → delta
      const delta = ing.quantity - match.quantite;
      if (delta <= 0) continue; // assez en stock
      missing.push({
        text: `${delta} ${ing.name}`,
        name: ing.name,
        quantity: delta,
        section: categorizeIngredient(ing.name),
      });
      continue;
    }

    // Pas en stock → ajouter tel quel
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

/** Unités de poids/volume — quantité stock = 1 unité (paquet), détail = "120g" */
const WEIGHT_UNITS = /^(g|kg|ml|cl|dl|l|cs|cc|CS|CC|càs|càc|c\.?\s*à\s*s\.?|c\.?\s*à\s*c\.?|tasse|pincée|tbsp|tsp)$/i;

/** Regex pour parser "3 oeufs", "120 g de pecorino", "sachet de levure" */
const COURSE_TEXT_RE = /^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|cl|dl|l|cs|cc|CS|CC|càs|càc|c\.?\s*à\s*s\.?|c\.?\s*à\s*c\.?|tasse|pincée|sachet|tranche|feuille|brin|gousse|botte|paquet|boîte|pot|verre|tbsp|tsp)?\s*(?:de\s+|d')?(.+)/i;

interface ParsedCourseText {
  produit: string;
  detail?: string;
  quantite: number;
}

/** Parse le texte d'une course en produit + quantité + détail */
function parseCourseText(text: string): ParsedCourseText {
  const m = text.match(COURSE_TEXT_RE);
  if (!m) return { produit: text.trim(), quantite: 1 };

  const num = parseFloat(m[1].replace(',', '.')) || 1;
  const unit = (m[2] || '').trim();
  const name = m[3].trim();

  if (unit && WEIGHT_UNITS.test(unit)) {
    // "120 g de pecorino" → produit: pecorino, detail: 120g, quantité: 1 unité
    return { produit: name, detail: `${m[1]}${unit}`, quantite: 1 };
  }
  if (unit) {
    // "2 sachets de levure" → produit: levure, quantité: 2
    return { produit: name, quantite: Math.round(num) };
  }
  // "3 oeufs" → produit: oeufs, quantité: 3
  return { produit: name, quantite: Math.round(num) };
}

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

  const parsed = parseCourseText(courseItem.text);

  return {
    incremented: null,
    newItem: {
      produit: parsed.produit,
      quantite: parsed.quantite,
      seuil: 1,
      qteAchat: parsed.quantite,
      emplacement: emplacementFromCategory(category),
    },
  };
}

// ─── Phase 3 : Repas cuisiné → Stock décrémenté ─────────────────────────────

export interface StockDecrementAction {
  stockItem: StockItem;
  /** Nouvelle quantité après décrémentation (minimum 0) */
  newQuantity: number;
}

/**
 * Calcule les décrémentations stock pour les ingrédients d'une recette cuisinée.
 * Heuristique quantités : si la recette demande < 1 unité stock, on décrémente de 1.
 */
export function computeStockDecrements(
  ingredients: AppIngredient[],
  stock: StockItem[],
): StockDecrementAction[] {
  const actions: StockDecrementAction[] = [];
  const used = new Set<number>(); // lineIndex déjà utilisés (évite double décrémentation)

  for (const ing of ingredients) {
    if (isBasicIngredient(ing.name)) continue;
    const match = findStockMatch(ing.name, stock);
    if (!match || match.quantite <= 0) continue;
    if (used.has(match.lineIndex)) continue;
    used.add(match.lineIndex);

    actions.push({
      stockItem: match,
      newQuantity: Math.max(0, match.quantite - 1),
    });
  }

  return actions;
}
