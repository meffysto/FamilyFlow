/**
 * courses-prices.ts — Lecture-only des prix d'articles depuis budgetEntries (Phase E)
 *
 * Tire la dernière dépense connue dans la catégorie "🛒 Courses" pour un nom
 * d'article donné, en matchant le label normalisé (lowercase + NFD + diacritiques).
 *
 * Aucune écriture ici : l'utilisateur saisit ses achats dans l'onglet Budget,
 * la liste de courses se contente de relire pour afficher un estimatif.
 */

import type { BudgetEntry, CourseItem } from './types';

const STALE_DAYS = 30;
const COURSES_CATEGORY_TOKEN = 'courses'; // matche "🛒 Courses" via includes

function normalize(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Extrait le nom "pur" d'un texte d'item courses (retire qty/unité de tête). */
function extractName(text: string): string {
  // "3 tomates" → "tomates" ; "120g de pecorino" → "pecorino" ; "Lait" → "Lait"
  return text
    .replace(/^\s*\d+(?:[.,]\d+)?\s*(?:g|kg|ml|cl|dl|l|cs|cc|càs|càc|tasse|pincée|sachet|tranche|feuille|brin|gousse|botte|paquet|boîte|pot|verre|tbsp|tsp)?\s*(?:de\s+|d')?/i, '')
    .trim();
}

export interface CoursePriceInfo {
  /** Dernier prix unitaire vu dans budget (montant brut de l'entrée). */
  price: number;
  /** Jours écoulés depuis la dépense. */
  daysAgo: number;
  /** True si > STALE_DAYS jours — UI peut griser. */
  stale: boolean;
}

/**
 * Cherche le dernier prix connu pour un article dans la catégorie Courses du budget.
 * Match par label normalisé exact (après extraction du nom pur).
 */
export function getLastPriceFor(
  articleName: string,
  entries: BudgetEntry[],
): CoursePriceInfo | null {
  const target = normalize(extractName(articleName));
  if (target.length < 2) return null;

  let best: BudgetEntry | null = null;
  for (const entry of entries) {
    if (!normalize(entry.category).includes(COURSES_CATEGORY_TOKEN)) continue;
    const label = normalize(entry.label);
    if (label !== target) continue;
    if (!best || entry.date.localeCompare(best.date) > 0) best = entry;
  }

  if (!best) return null;
  const daysAgo = Math.max(
    0,
    Math.floor((Date.now() - new Date(best.date).getTime()) / 86400000),
  );
  return { price: best.amount, daysAgo, stale: daysAgo > STALE_DAYS };
}

/**
 * Total estimé pour les items non-cochés de la liste, basé sur les prix budget.
 * Items sans prix connu : ignorés (n'augmentent pas le total).
 */
export function computeRemainingEstimate(
  items: CourseItem[],
  entries: BudgetEntry[],
): number {
  let total = 0;
  for (const item of items) {
    if (item.completed) continue;
    const info = getLastPriceFor(item.text, entries);
    if (info) total += info.price;
  }
  return total;
}

/** Format "2,50 €" — convention FR. */
export function formatPrice(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}
