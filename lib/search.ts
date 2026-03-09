/**
 * search.ts — Recherche locale multi-type dans le vault
 *
 * Recherche textuelle intelligente sans IA :
 * - Normalisation accents/casse
 * - Détection de type par mots-clés
 * - Scoring par pertinence
 *
 * Aucune dépendance externe — fonctionne hors-ligne.
 */

import type { Task, RDV, StockItem, MealItem, CourseItem, Memory, Defi, WishlistItem } from './types';
import type { AppRecipe } from './cooklang';
import { formatDateForDisplay } from './parser';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type SearchResultType = 'task' | 'rdv' | 'recipe' | 'stock' | 'meal' | 'memory' | 'course' | 'defi' | 'wishlist';

export interface SearchResult {
  type: SearchResultType;
  title: string;
  snippet: string;
  route?: string;
  relevance: number;
  icon: string;
}

export interface SearchInput {
  tasks: Task[];
  menageTasks: Task[];
  rdvs: RDV[];
  stock: StockItem[];
  meals: MealItem[];
  courses: CourseItem[];
  memories: Memory[];
  defis: Defi[];
  wishlistItems: WishlistItem[];
  recipes: AppRecipe[];
}

// ─── Normalisation ──────────────────────────────────────────────────────────────

/** Supprime accents et passe en minuscule */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Découpe la requête en tokens normalisés */
function tokenize(query: string): string[] {
  return normalize(query)
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/** Score : combien de tokens matchent dans le texte */
function matchScore(tokens: string[], ...texts: string[]): number {
  const combined = normalize(texts.join(' '));
  let score = 0;
  for (const token of tokens) {
    if (combined.includes(token)) score++;
  }
  return score;
}

// ─── Détection de type ──────────────────────────────────────────────────────────

const TYPE_KEYWORDS: Record<string, SearchResultType[]> = {
  tache: ['task'],
  taches: ['task'],
  menage: ['task'],
  rdv: ['rdv'],
  rendezvous: ['rdv'],
  medecin: ['rdv'],
  pediatre: ['rdv'],
  vaccin: ['rdv'],
  dentiste: ['rdv'],
  recette: ['recipe'],
  cuisine: ['recipe'],
  plat: ['recipe'],
  repas: ['meal'],
  dejeuner: ['meal'],
  diner: ['meal'],
  petitdej: ['meal'],
  stock: ['stock'],
  couche: ['stock'],
  couches: ['stock'],
  course: ['course'],
  courses: ['course'],
  liste: ['course'],
  souvenir: ['memory'],
  jalon: ['memory'],
  premiere: ['memory'],
  defi: ['defi'],
  challenge: ['defi'],
  souhait: ['wishlist'],
  cadeau: ['wishlist'],
  idee: ['wishlist'],
};

function detectTypes(tokens: string[]): Set<SearchResultType> {
  const types = new Set<SearchResultType>();
  for (const token of tokens) {
    const mapped = TYPE_KEYWORDS[token];
    if (mapped) mapped.forEach((t) => types.add(t));
  }
  return types;
}

// ─── Recherche générique ────────────────────────────────────────────────────────

interface SearchEntityConfig<T> {
  type: SearchResultType;
  icon: string;
  route: string;
  getFields: (item: T) => string[];
  getTitle: (item: T) => string;
  getSnippet: (item: T) => string;
  getBonus?: (item: T) => number;
}

function searchEntities<T>(tokens: string[], items: T[], config: SearchEntityConfig<T>): SearchResult[] {
  const results: SearchResult[] = [];
  for (const item of items) {
    const score = matchScore(tokens, ...config.getFields(item));
    if (score === 0) continue;
    results.push({
      type: config.type,
      icon: config.icon,
      route: config.route,
      title: config.getTitle(item),
      snippet: config.getSnippet(item),
      relevance: score + (config.getBonus?.(item) ?? 0),
    });
  }
  return results;
}

// ─── Configurations par type ────────────────────────────────────────────────────

const taskConfig: SearchEntityConfig<Task> = {
  type: 'task',
  icon: '✅',
  route: '/(tabs)/tasks',
  getFields: (t) => [t.text, t.section || '', t.sourceFile],
  getTitle: (t) => t.text,
  getSnippet: (t) => `${t.completed ? '✅' : '⬜'} ${t.sourceFile.split('/').pop()?.replace('.md', '') || ''}${t.dueDate ? ` — ${formatDateForDisplay(t.dueDate)}` : ''}`,
  getBonus: (t) => t.completed ? 0 : 0.5,
};

const rdvConfig: SearchEntityConfig<RDV> = {
  type: 'rdv',
  icon: '🏥',
  route: '/(tabs)/rdv',
  getFields: (r) => [r.enfant, r.type_rdv, r.médecin, r.lieu, r.statut],
  getTitle: (r) => `${r.type_rdv} ${r.enfant}`,
  getSnippet: (r) => `${formatDateForDisplay(r.date_rdv)} ${r.heure} — ${r.lieu || r.médecin || ''} (${r.statut})`,
  getBonus: (r) => r.statut === 'planifié' ? 1 : 0,
};

const recipeConfig: SearchEntityConfig<AppRecipe> = {
  type: 'recipe',
  icon: '📖',
  route: '/(tabs)/more',
  getFields: (r) => [r.title, r.ingredients?.map((i) => i.name).join(' ') || '', r.tags?.join(' ') || '', r.category || ''],
  getTitle: (r) => r.title,
  getSnippet: (r) => `${r.category || ''}${r.servings ? ` — ${r.servings} portions` : ''}`,
};

const stockConfig: SearchEntityConfig<StockItem> = {
  type: 'stock',
  icon: '📦',
  route: '/(tabs)/more',
  getFields: (s) => [s.produit, s.detail || '', s.section || ''],
  getTitle: (s) => s.produit,
  getSnippet: (s) => `${s.quantite}/${s.seuil} — ${s.section || ''}`,
  getBonus: (s) => s.quantite <= s.seuil ? 0.5 : 0,
};

const mealConfig: SearchEntityConfig<MealItem> = {
  type: 'meal',
  icon: '🍽️',
  route: '/(tabs)/more',
  getFields: (m) => [m.text, m.day, m.mealType, m.recipeRef || ''],
  getTitle: (m) => `${m.day} — ${m.mealType}`,
  getSnippet: (m) => m.text,
};

const courseConfig: SearchEntityConfig<CourseItem> = {
  type: 'course',
  icon: '🛒',
  route: '/(tabs)/more',
  getFields: (c) => [c.text, c.section || ''],
  getTitle: (c) => c.text,
  getSnippet: (c) => `${c.completed ? '✅' : '⬜'} ${c.section || 'Sans catégorie'}`,
  getBonus: (c) => c.completed ? 0 : 0.3,
};

const memoryConfig: SearchEntityConfig<Memory> = {
  type: 'memory',
  icon: '💫',
  route: '/(tabs)/more',
  getFields: (m) => [m.title, m.description, m.enfant, m.type],
  getTitle: (m) => m.title,
  getSnippet: (m) => `${m.enfant} — ${formatDateForDisplay(m.date)} — ${m.description}`,
};

const defiConfig: SearchEntityConfig<Defi> = {
  type: 'defi',
  icon: '🏅',
  route: '/(tabs)/more',
  getFields: (d) => [d.title, d.description, d.emoji],
  getTitle: (d) => `${d.emoji} ${d.title}`,
  getSnippet: (d) => `${d.status} — ${d.difficulty}`,
  getBonus: (d) => d.status === 'active' ? 1 : 0,
};

const wishlistConfig: SearchEntityConfig<WishlistItem> = {
  type: 'wishlist',
  icon: '🎁',
  route: '/(tabs)/more',
  getFields: (w) => [w.text, w.profileName, w.notes || ''],
  getTitle: (w) => w.text,
  getSnippet: (w) => `${w.profileName} ${w.budget} ${w.occasion}`.trim(),
  getBonus: (w) => w.bought ? 0 : 0.3,
};

// ─── Moteur principal ───────────────────────────────────────────────────────────

const SEARCH_CONFIGS: { type: SearchResultType; getItems: (input: SearchInput) => any[]; config: SearchEntityConfig<any> }[] = [
  { type: 'task', getItems: (i) => [...i.tasks, ...i.menageTasks], config: taskConfig },
  { type: 'rdv', getItems: (i) => i.rdvs, config: rdvConfig },
  { type: 'recipe', getItems: (i) => i.recipes, config: recipeConfig },
  { type: 'stock', getItems: (i) => i.stock, config: stockConfig },
  { type: 'meal', getItems: (i) => i.meals.filter((m: MealItem) => m.text && m.text.trim() !== ''), config: mealConfig },
  { type: 'course', getItems: (i) => i.courses, config: courseConfig },
  { type: 'memory', getItems: (i) => i.memories, config: memoryConfig },
  { type: 'defi', getItems: (i) => i.defis, config: defiConfig },
  { type: 'wishlist', getItems: (i) => i.wishlistItems, config: wishlistConfig },
];

/**
 * Recherche dans tout le vault.
 * Détecte le type de données via les mots-clés, puis cherche partout ou
 * dans le sous-ensemble pertinent.
 * Retourne les résultats triés par pertinence décroissante.
 */
export function searchVault(query: string, input: SearchInput): SearchResult[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return [];

  const detectedTypes = detectTypes(tokens);
  // Tokens sans les mots-clés de type (pour ne pas scorer sur "recette" quand on cherche "recette courgette")
  const contentTokens = tokens.filter((t) => !TYPE_KEYWORDS[t]);
  const searchTokens = contentTokens.length > 0 ? contentTokens : tokens;

  const searchAll = detectedTypes.size === 0;
  const results: SearchResult[] = [];

  for (const { type, getItems, config } of SEARCH_CONFIGS) {
    if (searchAll || detectedTypes.has(type)) {
      results.push(...searchEntities(searchTokens, getItems(input), config));
    }
  }

  // Tri par pertinence décroissante
  results.sort((a, b) => b.relevance - a.relevance);

  return results.slice(0, 20);
}
