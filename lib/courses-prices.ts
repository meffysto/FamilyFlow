/**
 * courses-prices.ts — Lecture-only des prix d'articles depuis budgetEntries (Phase E)
 *
 * Match en 2 passes :
 *   Passe 1 — canonical strict : `parseCanonical` (lemmatise + strip unités/articles).
 *             confidence: 'high'
 *   Passe 2 — fuzzy fallback : `tokenize` historique, tolère 1 token manquant.
 *             confidence: 'low'
 *
 * Le prix renvoyé est un **ordre de grandeur** (médiane des 3 derniers achats,
 * unitPrice = montant / quantité extraite du label). L'UI doit l'afficher
 * comme estimation, pas comme prix exact.
 */

import type { BudgetEntry, CourseItem } from './types';

const STALE_DAYS = 30;
const SHOPPING_CATEGORY_TOKENS = ['courses', 'bebe', 'maison'];

/** Mots vides FR + abréviations supermarché courantes (filtrage à la tokenization fuzzy). */
const STOP_WORDS = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'au', 'aux', 'et', 'ou',
  'bio', 'pack', 'lot', 'kg', 'kgs', 'g', 'gr', 'grs', 'ml', 'cl', 'l', 'mg',
  'pcs', 'pc', 'pce', 'unite', 'unites', 'sac', 'sachet', 'sachets', 'paquet',
  'paquets', 'boite', 'boites', 'pot', 'pots', 'tube', 'tubes',
  'tranche', 'tranches', 'verre', 'verres', 'bouteille', 'bouteilles',
  'frais', 'fraiche', 'fraiches', 'surgele', 'surgelee', 'surgeles', 'surgelees',
  'bte', 'btl', 'std', 'pdt', 'prdt', 'prod', 'art',
  'ent', 'entrcot', 'lt', 'lle', 'pte', 'gd', 'gde', 'pet',
]);

/** Expansions d'abréviations FR très courantes en ticket de caisse → token canonique. */
const ABBREVIATION_MAP: Record<string, string> = {
  'lt': 'lait',
  'pdt': 'pomme',
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

/** Articles + unités à dégager côté `parseCanonical` (input utilisateur propre). */
const CANONICAL_ARTICLES = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'au', 'aux', 'et', 'ou', 'a',
]);
const CANONICAL_UNITS = new Set([
  'g', 'gr', 'kg', 'mg', 'ml', 'cl', 'dl', 'l', 'litre', 'litres',
  'boite', 'brique', 'sachet', 'paquet', 'pot', 'tube', 'tranche',
  'piece', 'pieces', 'unite', 'unites', 'rouleau', 'barquette', 'filet', 'bouteille',
]);

/** Pluriels FR invariants ou irréguliers — on les laisse intacts (ou règle dédiée). */
const INVARIANT_TOKENS = new Set([
  'pois', 'pates', 'noix', 'fois', 'bois', 'corps', 'jus', 'riz',
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Singularise un token FR (best-effort, règles ordonnées). */
function singularize(token: string): string {
  if (INVARIANT_TOKENS.has(token)) return token;
  if (token.length < 4) return token;
  // -eaux → -eau (poireaux → poireau)
  if (token.endsWith('eaux')) return token.slice(0, -1);
  // -aux → -al (journaux → journal). Volontairement après -eaux.
  if (token.endsWith('aux')) return token.slice(0, -3) + 'al';
  // -eux invariant
  if (token.endsWith('eux')) return token;
  // -s final
  if (token.endsWith('s')) return token.slice(0, -1);
  return token;
}

/**
 * Parse un nom d'article saisi par l'utilisateur en tokens canoniques propres.
 * Pipeline : lower+NFD → strip qty → split → strip units/articles → singularize → expand abbr.
 */
export function parseCanonical(input: string): string[] {
  if (!input) return [];
  let s = normalize(input);
  // Strip quantité leading ("2 yaourts" → " yaourts")
  s = s.replace(/^\d+\s*/, '');
  // Split sur tout ce qui n'est pas une lettre
  const raw = s
    .replace(/[^a-z]+/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2);

  const out: string[] = [];
  for (const t of raw) {
    if (CANONICAL_ARTICLES.has(t)) continue;
    const sing = singularize(t);
    if (CANONICAL_UNITS.has(sing) || CANONICAL_UNITS.has(t)) continue;
    if (sing.length < 2) continue;
    const expanded = ABBREVIATION_MAP[sing] ?? sing;
    out.push(expanded);
  }
  return out;
}

/** Tokenize fuzzy (passe 2) — comportement historique, conservé à l'identique. */
function tokenize(label: string): string[] {
  const norm = normalize(label);
  const raw = norm
    .replace(/\d+([.,]\d+)?/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
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

/**
 * Extrait la quantité (multiplicateur) depuis un label de ticket.
 * Best-effort, fallback à 1. Plafonné à 100 pour éviter les regex qui matchent un poids.
 */
export function extractQuantityFromLabel(label: string): number {
  if (!label) return 1;
  const patterns: RegExp[] = [
    /(\d+)\s*x\s*\d+(?:[.,]\d+)?\s*(?:g|gr|kg|ml|cl|l)\b/i,
    /\bx\s*(\d+)\b/i,
    /\blot\s+(?:de\s+)?(\d+)\b/i,
    /\b(\d+)\s+(?:pi[èe]ces?|pcs|unit[ée]s?)\b/i,
    /\b(?:pack|lot)\s+(\d+)\b/i,
  ];
  for (const re of patterns) {
    const m = label.match(re);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 0 && n <= 100) return n;
    }
  }
  return 1;
}

interface PriceMatch {
  unitPrice: number;
  date: string;
}

/**
 * Réduit jusqu'à 3 matches (les plus récents) en un prix d'ordre de grandeur.
 * 1 match → ce prix. 2 matches → moyenne. 3+ matches → médiane (anti-outlier).
 */
export function priceFromMatches(matches: PriceMatch[]): number {
  if (matches.length === 0) return 0;
  const sorted = [...matches].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  if (sorted.length === 1) return sorted[0].unitPrice;
  if (sorted.length === 2) return (sorted[0].unitPrice + sorted[1].unitPrice) / 2;
  const prices = sorted.map(m => m.unitPrice).sort((a, b) => a - b);
  return prices[1];
}

/** Match fort entre deux tokens : exact OU préfixe commun ≥ 4 chars. */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.startsWith(a)) return true;
  if (b.length >= 4 && a.startsWith(b)) return true;
  if (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5)) return true;
  return false;
}

function scoreMatch(itemTokens: string[], entryTokens: string[]): { matched: number; total: number } {
  const significant = itemTokens.filter(t => t.length >= 3);
  if (significant.length === 0 || entryTokens.length === 0) {
    return { matched: 0, total: significant.length };
  }
  let matched = 0;
  for (const it of significant) {
    if (entryTokens.some(et => tokensMatch(it, et))) matched++;
  }
  return { matched, total: significant.length };
}

export interface CoursePriceInfo {
  price: number;
  daysAgo: number;
  stale: boolean;
  confidence: 'high' | 'low';
  sampleSize: 1 | 2 | 3;
}

interface FoundEntry {
  entry: BudgetEntry;
  ratio: number;
}

/**
 * Cherche tous les BudgetEntry (catégorie "courses") dont les tokens matchent
 * `queryTokens` selon le seuil demandé.
 */
function findMatches(
  queryTokens: string[],
  entries: BudgetEntry[],
  strict: boolean,
  tokenizeEntry: (label: string) => string[],
): FoundEntry[] {
  const significantCount = queryTokens.filter(t => t.length >= 3).length;
  if (significantCount === 0) return [];
  const requiredMatch = strict
    ? significantCount
    : Math.max(1, significantCount - 1);

  const out: FoundEntry[] = [];
  for (const entry of entries) {
    const normCat = normalize(entry.category);
    if (!SHOPPING_CATEGORY_TOKENS.some(tok => normCat.includes(tok))) continue;
    const entryTokens = tokenizeEntry(entry.label);
    const { matched, total } = scoreMatch(queryTokens, entryTokens);
    if (matched < requiredMatch || total === 0) continue;
    out.push({ entry, ratio: matched / total });
  }
  return out;
}

function buildInfo(found: FoundEntry[], confidence: 'high' | 'low'): CoursePriceInfo | null {
  if (found.length === 0) return null;
  const matches: PriceMatch[] = found.map(({ entry }) => {
    const qty = extractQuantityFromLabel(entry.label);
    return { unitPrice: entry.amount / qty, date: entry.date };
  });
  const price = priceFromMatches(matches);
  const sortedByDate = [...matches].sort((a, b) => b.date.localeCompare(a.date));
  const mostRecent = sortedByDate[0];
  const daysAgo = Math.max(
    0,
    Math.floor((Date.now() - new Date(mostRecent.date).getTime()) / 86400000),
  );
  const sampleSize = (Math.min(matches.length, 3) as 1 | 2 | 3);
  return {
    price,
    daysAgo,
    stale: daysAgo > STALE_DAYS,
    confidence,
    sampleSize,
  };
}

/**
 * Cherche le dernier prix connu pour un article. Algo 2 passes :
 *   1. canonical strict (parseCanonical sur l'input user, tokenize fuzzy sur l'entrée)
 *   2. fuzzy fallback (tokenize des deux côtés, tolérance 1 miss)
 */
export function getLastPriceFor(
  articleName: string,
  entries: BudgetEntry[],
): CoursePriceInfo | null {
  const canonical = parseCanonical(articleName);
  if (canonical.length > 0) {
    const matches = findMatches(canonical, entries, true, tokenize);
    if (matches.length > 0) {
      const info = buildInfo(matches, 'high');
      if (info) return info;
    }
  }

  const fuzzy = tokenize(articleName);
  if (fuzzy.length > 0) {
    const matches = findMatches(fuzzy, entries, false, tokenize);
    if (matches.length > 0) {
      const info = buildInfo(matches, 'low');
      if (info) return info;
    }
  }

  return null;
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

/** Format "2,50 €" — convention FR (par-item, garde les centimes). */
export function formatPrice(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

/** Format "≈ 85 €" — total estimé arrondi, sans centimes (ordre de grandeur). */
export function formatTotalEstimate(amount: number): string {
  return `≈ ${Math.round(amount)} €`;
}
