/**
 * courses-prices.ts — Lecture-only des prix d'articles depuis budgetEntries (Phase E)
 *
 * Match flou (token-based) pour gérer les labels de tickets scannés :
 * "TOMAT.GRAP.BIO" matche "tomates" parce que les 2 partagent la racine "tomat".
 * "LT 1/2 ECREM 1L" matche "lait" via le token "lait" en commun (après expansion
 * d'abréviations courantes), ou "ecrem" partageant la racine avec "ecreme".
 *
 * Algorithme :
 *   1. Tokenize chaque côté (lowercase + NFD + retire ponctuation/chiffres/unités/stopwords)
 *   2. Score = nombre de tokens "forts" partagés (préfixe commun ≥ 4 chars)
 *   3. Match si au moins 1 token fort partagé
 *   4. Parmi les matches, prendre la date la plus récente
 *
 * Aucune écriture ici : l'utilisateur saisit ses achats dans l'onglet Budget,
 * la liste de courses se contente de relire pour afficher un estimatif.
 */

import type { BudgetEntry, CourseItem } from './types';

const STALE_DAYS = 30;
const COURSES_CATEGORY_TOKEN = 'courses';

/** Mots vides FR + abréviations supermarché courantes (filtrage à la tokenization). */
const STOP_WORDS = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'au', 'aux', 'et', 'ou',
  'bio', 'pack', 'lot', 'kg', 'kgs', 'g', 'gr', 'grs', 'ml', 'cl', 'l', 'mg',
  'pcs', 'pc', 'pce', 'unite', 'unites', 'sac', 'sachet', 'sachets', 'paquet',
  'paquets', 'boite', 'boites', 'pot', 'pots', 'pack', 'tube', 'tubes',
  'tranche', 'tranches', 'verre', 'verres', 'bouteille', 'bouteilles',
  'frais', 'fraiche', 'fraiches', 'surgele', 'surgelee', 'surgeles', 'surgelees',
  'bte', 'btl', 'std', 'pdt', 'prdt', 'prod', 'art',
  // Abréviations magasin
  'ent', 'entrcot', 'lt', 'lle', 'pte', 'gd', 'gde', 'pet', 'gr',
]);

/** Expansions d'abréviations FR très courantes en ticket de caisse → token canonique. */
const ABBREVIATION_MAP: Record<string, string> = {
  'lt': 'lait',
  'pdt': 'pomme', // pomme de terre — partial, mais utile
  'pdtt': 'pomme',
  'tomat': 'tomate',
  'fromag': 'fromage',
  'jamb': 'jambon',
  'sauc': 'saucisson',
  'choco': 'chocolat',
  'ecrem': 'ecreme',
  'demi': 'demi',
  'grap': 'grappe',
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Tokenize : split sur ponctuation/chiffres, filtre stop-words, expand abréviations. */
function tokenize(label: string): string[] {
  const norm = normalize(label);
  const raw = norm
    .replace(/\d+([.,]\d+)?/g, ' ') // chiffres
    .replace(/[^a-z\s]/g, ' ') // ponctuation et caractères restants
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2);

  const expanded: string[] = [];
  for (const t of raw) {
    if (STOP_WORDS.has(t)) continue;
    expanded.push(ABBREVIATION_MAP[t] ?? t);
  }
  return expanded;
}

/** Match fort entre deux tokens : exact OU préfixe commun ≥ 4 chars. */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.startsWith(a)) return true;
  if (b.length >= 4 && a.startsWith(b)) return true;
  // Racine commune (premier 5 chars) pour gérer "tomate"/"tomates"/"tomat"
  if (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5)) return true;
  return false;
}

/** Score : nombre de tokens forts du premier set qui matchent un token du second. */
function scoreMatch(itemTokens: string[], entryTokens: string[]): number {
  if (itemTokens.length === 0 || entryTokens.length === 0) return 0;
  let score = 0;
  for (const it of itemTokens) {
    if (it.length < 3) continue; // tokens trop courts ignorés du scoring
    if (entryTokens.some(et => tokensMatch(it, et))) score++;
  }
  return score;
}

export interface CoursePriceInfo {
  price: number;
  daysAgo: number;
  stale: boolean;
}

/**
 * Cherche le dernier prix connu pour un article via match flou token-based.
 * Renvoie l'entrée la plus récente parmi les matches (score ≥ 1).
 */
export function getLastPriceFor(
  articleName: string,
  entries: BudgetEntry[],
): CoursePriceInfo | null {
  const itemTokens = tokenize(articleName);
  if (itemTokens.length === 0) return null;

  let best: BudgetEntry | null = null;
  let bestScore = 0;

  for (const entry of entries) {
    if (!normalize(entry.category).includes(COURSES_CATEGORY_TOKEN)) continue;
    const entryTokens = tokenize(entry.label);
    const score = scoreMatch(itemTokens, entryTokens);
    if (score < 1) continue;
    // Préfère le score le plus élevé, à score égal préfère la date la plus récente
    if (
      score > bestScore ||
      (score === bestScore && best && entry.date.localeCompare(best.date) > 0) ||
      !best
    ) {
      best = entry;
      bestScore = score;
    }
  }

  if (!best) return null;
  const daysAgo = Math.max(
    0,
    Math.floor((Date.now() - new Date(best.date).getTime()) / 86400000),
  );
  return { price: best.amount, daysAgo, stale: daysAgo > STALE_DAYS };
}

/**
 * Total estimé pour les items non-cochés. Items sans prix connu : ignorés.
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
