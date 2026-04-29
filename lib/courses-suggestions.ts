/**
 * courses-suggestions.ts — Suggestions cadence-based depuis budgetEntries.
 *
 * Réutilise le tokenize/match flou de courses-prices.ts pour grouper les achats
 * par "produit canonique" (premier token significatif après normalisation),
 * calcule la cadence moyenne entre achats successifs, et suggère les produits
 * dont le délai depuis le dernier achat dépasse la cadence apprise.
 *
 * Aucun ML ni API : pure dérivation statistique sur l'historique budget.
 *
 * Filtres :
 *   - catégorie BudgetEntry contient "courses" (cohérent avec courses-prices)
 *   - au moins 2 achats observés (sinon pas de cadence)
 *   - dernier achat il y a moins de 180 jours (sinon produit oublié)
 *   - exclut les produits déjà présents dans la liste courante
 */

import type { BudgetEntry, CourseItem } from './types';

const COURSES_CATEGORY_TOKEN = 'courses';
const MAX_DAYS_SINCE_LAST = 180;
const MIN_PURCHASES = 2;
/** Score minimal (daysSince / cadence) pour qu'un produit soit suggéré. */
const SUGGESTION_THRESHOLD = 0.8;

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

const ABBREVIATION_MAP: Record<string, string> = {
  'lt': 'lait',
  'pdtt': 'pomme',
  'tomat': 'tomate',
  'fromag': 'fromage',
  'jamb': 'jambon',
  'sauc': 'saucisson',
  'choco': 'chocolat',
  'ecrem': 'ecreme',
  'grap': 'grappe',
};

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function tokenize(label: string): string[] {
  const norm = normalize(label);
  const raw = norm
    .replace(/\d+([.,]\d+)?/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3);
  const out: string[] = [];
  for (const t of raw) {
    if (STOP_WORDS.has(t)) continue;
    out.push(ABBREVIATION_MAP[t] ?? t);
  }
  return out;
}

/**
 * Clé canonique d'un label : premier token significatif tokenisé,
 * tronqué à 5 chars pour fusionner singulier/pluriel ("tomate"/"tomates" → "tomat").
 */
function canonicalKey(label: string): string | null {
  const tokens = tokenize(label);
  if (tokens.length === 0) return null;
  return tokens[0].slice(0, 5);
}

export interface CadenceSuggestion {
  /** Clé canonique (utile pour dédup). */
  key: string;
  /** Label affichable (le plus récent observé, capitalisé). */
  label: string;
  /** Cadence moyenne en jours entre 2 achats. */
  cadenceDays: number;
  /** Jours écoulés depuis le dernier achat. */
  daysSinceLast: number;
  /** Nombre d'achats observés. */
  occurrences: number;
  /** Score normalisé (daysSinceLast / cadenceDays) — plus élevé = plus urgent. */
  score: number;
  /** Phrase Caveat-friendly à afficher en raison ("tu en achètes ~tous les 7j"). */
  reason: string;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatCadence(days: number): string {
  const rounded = Math.round(days);
  if (rounded <= 1) return 'tous les jours';
  if (rounded <= 4) return `tous les ${rounded} jours`;
  if (rounded <= 10) return `~chaque semaine`;
  if (rounded <= 17) return `~toutes les 2 semaines`;
  if (rounded <= 35) return `~chaque mois`;
  return `~tous les ${Math.round(rounded / 30)} mois`;
}

/**
 * Calcule la liste de suggestions à partir de l'historique budget.
 *
 * @param entries  Historique BudgetEntry (idéalement 3-6 mois)
 * @param currentItems  Items actuellement dans la liste (pour exclusion)
 * @param maxResults  Nombre max de suggestions à retourner (défaut 5)
 */
export function computeCadenceSuggestions(
  entries: BudgetEntry[],
  currentItems: CourseItem[],
  maxResults = 5,
): CadenceSuggestion[] {
  // 1. Filtrer les entrées catégorie "courses"
  const courseEntries = entries.filter(
    e => normalize(e.category).includes(COURSES_CATEGORY_TOKEN),
  );

  // 2. Grouper par clé canonique
  const groups = new Map<string, BudgetEntry[]>();
  for (const entry of courseEntries) {
    const key = canonicalKey(entry.label);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  // 3. Clés à exclure : produits déjà dans la liste courante
  const excludedKeys = new Set<string>();
  for (const item of currentItems) {
    const key = canonicalKey(item.text);
    if (key) excludedKeys.add(key);
  }

  // 4. Calcul cadence + score par groupe
  const now = Date.now();
  const suggestions: CadenceSuggestion[] = [];

  for (const [key, groupEntries] of groups) {
    if (excludedKeys.has(key)) continue;
    if (groupEntries.length < MIN_PURCHASES) continue;

    // Tri par date asc
    const sorted = [...groupEntries].sort((a, b) => a.date.localeCompare(b.date));

    // Cadence = moyenne des intervalles
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date).getTime();
      const cur = new Date(sorted[i].date).getTime();
      const days = (cur - prev) / 86400000;
      if (days > 0) intervals.push(days);
    }
    if (intervals.length === 0) continue;
    const cadenceDays = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (cadenceDays < 1 || cadenceDays > MAX_DAYS_SINCE_LAST) continue;

    // Délai depuis dernier achat
    const lastDate = new Date(sorted[sorted.length - 1].date).getTime();
    const daysSinceLast = (now - lastDate) / 86400000;
    if (daysSinceLast > MAX_DAYS_SINCE_LAST) continue;

    const score = daysSinceLast / cadenceDays;
    if (score < SUGGESTION_THRESHOLD) continue;

    // Label le plus récent (souvent le plus propre / récent format ticket)
    const lastEntry = sorted[sorted.length - 1];
    // Préfère un token canonique nettoyé pour l'affichage : retokenize et capitalise
    const tokens = tokenize(lastEntry.label);
    const displayLabel = tokens.length > 0
      ? tokens.slice(0, 2).map(capitalize).join(' ')
      : capitalize(lastEntry.label.toLowerCase());

    suggestions.push({
      key,
      label: displayLabel,
      cadenceDays,
      daysSinceLast,
      occurrences: sorted.length,
      score,
      reason: `${formatCadence(cadenceDays)} · ça fait ${Math.round(daysSinceLast)} j`,
    });
  }

  // 5. Tri par score décroissant + dédup par clé
  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, maxResults);
}
