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

import type { Task, RDV, StockItem, MealItem, CourseItem, Memory, Defi, WishlistItem, Profile } from './types';
import type { AppRecipe } from './cooklang';
import { formatDateForDisplay } from './parser';
import { startOfWeek, endOfWeek, addDays, format as fnsFormat } from 'date-fns';

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
  rdvs: RDV[];
  stock: StockItem[];
  meals: MealItem[];
  courses: CourseItem[];
  memories: Memory[];
  defis: Defi[];
  wishlistItems: WishlistItem[];
  recipes: AppRecipe[];
  profiles?: Profile[];
}

/** Résultat enrichi avec les filtres actifs */
export interface SearchOutput {
  results: SearchResult[];
  filters: ParsedFilters;
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

// ─── Filtres date & personne ────────────────────────────────────────────────────

/** Filtre de date extrait de la requête */
export interface DateFilter {
  month?: number;   // 1-12
  day?: number;     // 1-31
  year?: number;    // ex: 2026
  from?: string;    // YYYY-MM-DD (plage)
  to?: string;      // YYYY-MM-DD (plage)
  label: string;    // libellé pour affichage (ex: "Mars 2026", "Aujourd'hui")
}

/** Filtre de personne extrait de la requête */
export interface PersonFilter {
  name: string;     // nom original (avec casse/accents)
  normalized: string; // normalisé pour comparaison
}

/** Résultat du parsing des filtres */
export interface ParsedFilters {
  dateFilter?: DateFilter;
  personFilter?: PersonFilter;
  contentTokens: string[];  // tokens restants pour la recherche textuelle
}

/** Noms de mois français → numéro (1-12) */
const FRENCH_MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

/** Labels affichés pour les mois */
const MONTH_LABELS = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/**
 * Parse les filtres date et personne dans la requête.
 * Retourne les filtres détectés et les tokens restants pour la recherche texte.
 */
export function parseFilters(rawQuery: string, profiles: Profile[]): ParsedFilters {
  const tokens = tokenize(rawQuery);
  const usedIndices = new Set<number>();
  let dateFilter: DateFilter | undefined;
  let personFilter: PersonFilter | undefined;

  const today = new Date();

  // --- Détection des dates relatives (multi-tokens d'abord) ---
  const normalized = normalize(rawQuery);

  if (normalized.includes('cette semaine')) {
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    dateFilter = {
      from: formatISO(weekStart),
      to: formatISO(weekEnd),
      label: 'Cette semaine',
    };
    // Marquer les tokens "cette" et "semaine" comme utilisés
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === 'cette' || tokens[i] === 'semaine') usedIndices.add(i);
    }
  } else if (normalized.includes('ce mois')) {
    const m = today.getMonth() + 1;
    const y = today.getFullYear();
    dateFilter = { month: m, year: y, label: `${MONTH_LABELS[m]} ${y}` };
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === 'ce' || tokens[i] === 'mois') usedIndices.add(i);
    }
  }

  // --- Détection mots-clés simples (aujourd'hui, demain, hier) ---
  if (!dateFilter) {
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t === "aujourd'hui" || t === 'aujourdhui' || t === "aujourd\u2019hui") {
        dateFilter = { day: today.getDate(), month: today.getMonth() + 1, year: today.getFullYear(), label: "Aujourd'hui" };
        usedIndices.add(i);
        break;
      }
      if (t === 'demain') {
        const tom = addDays(today, 1);
        dateFilter = { day: tom.getDate(), month: tom.getMonth() + 1, year: tom.getFullYear(), label: 'Demain' };
        usedIndices.add(i);
        break;
      }
      if (t === 'hier') {
        const yest = addDays(today, -1);
        dateFilter = { day: yest.getDate(), month: yest.getMonth() + 1, year: yest.getFullYear(), label: 'Hier' };
        usedIndices.add(i);
        break;
      }
    }
  }

  // --- Détection mois (+ jour optionnel avant, + année optionnelle après) ---
  if (!dateFilter) {
    for (let i = 0; i < tokens.length; i++) {
      const monthNum = FRENCH_MONTHS[tokens[i]];
      if (!monthNum) continue;

      let day: number | undefined;
      let year: number | undefined;

      // Vérifier un jour avant le mois : "5 mars"
      if (i > 0 && /^\d{1,2}$/.test(tokens[i - 1])) {
        const d = parseInt(tokens[i - 1], 10);
        if (d >= 1 && d <= 31) { day = d; usedIndices.add(i - 1); }
      }

      // Vérifier une année après le mois : "mars 2026"
      if (i + 1 < tokens.length && /^\d{4}$/.test(tokens[i + 1])) {
        year = parseInt(tokens[i + 1], 10);
        usedIndices.add(i + 1);
      }

      let label = MONTH_LABELS[monthNum];
      if (day) label = `${day} ${label}`;
      if (year) label += ` ${year}`;

      dateFilter = { month: monthNum, day, year, label };
      usedIndices.add(i);
      break;
    }
  }

  // --- Détection pattern JJ/MM ou JJ/MM/AAAA ---
  if (!dateFilter) {
    for (let i = 0; i < tokens.length; i++) {
      const match = tokens[i].match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
      if (match) {
        const d = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          let y: number | undefined;
          if (match[3]) {
            y = parseInt(match[3], 10);
            if (y < 100) y += 2000; // 26 → 2026
          }
          let label = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
          if (y) label += `/${y}`;
          dateFilter = { day: d, month: m, year: y, label };
          usedIndices.add(i);
        }
      }
    }
  }

  // --- Détection personne ---
  const profilesNorm = profiles.map((p) => ({
    name: p.name,
    normalized: normalize(p.name),
  }));

  for (let i = 0; i < tokens.length; i++) {
    if (usedIndices.has(i)) continue;
    const t = tokens[i];
    const match = profilesNorm.find((p) => p.normalized === t);
    if (match) {
      personFilter = { name: match.name, normalized: match.normalized };
      usedIndices.add(i);
      break;
    }
  }

  // Tokens restants (ni filtres de date, ni personne, ni type keywords)
  const contentTokens = tokens.filter((_, i) => !usedIndices.has(i));

  return { dateFilter, personFilter, contentTokens };
}

/** Formate une date en YYYY-MM-DD (utilise date-fns) */
function formatISO(d: Date): string {
  return fnsFormat(d, 'yyyy-MM-dd');
}

/** Vérifie si une date YYYY-MM-DD correspond au filtre */
function matchesDateFilter(dateStr: string | undefined, filter: DateFilter): boolean {
  if (!dateStr) return false;

  // Plage de dates (cette semaine)
  if (filter.from && filter.to) {
    return dateStr >= filter.from && dateStr <= filter.to;
  }

  // Date exacte ou partielle
  const parts = dateStr.split('-');
  if (parts.length < 2) return false;

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parts.length >= 3 ? parseInt(parts[2], 10) : undefined;

  if (filter.year && y !== filter.year) return false;
  if (filter.month && m !== filter.month) return false;
  if (filter.day && d !== filter.day) return false;

  return true;
}

/** Vérifie si un résultat correspond au filtre personne */
function matchesPersonFilter(item: any, type: SearchResultType, filter: PersonFilter): boolean {
  const norm = filter.normalized;
  switch (type) {
    case 'task': {
      const task = item as Task;
      // Vérifier mentions ou dossier source
      if (task.mentions?.some((m: string) => normalize(m) === norm)) return true;
      if (normalize(task.sourceFile).includes(norm)) return true;
      return false;
    }
    case 'rdv': {
      const rdv = item as RDV;
      return normalize(rdv.enfant) === norm;
    }
    case 'memory': {
      const mem = item as Memory;
      return normalize(mem.enfant) === norm;
    }
    case 'wishlist': {
      const wish = item as WishlistItem;
      return normalize(wish.profileName) === norm;
    }
    case 'defi': {
      const defi = item as Defi;
      // Vérifier participants (par nom ou id normalisé)
      return defi.participants.length === 0 || defi.participants.some((p: string) => normalize(p) === norm);
    }
    default:
      // Types sans filtre personne : on les laisse passer
      return true;
  }
}

/** Extrait la date d'un item selon son type */
function getItemDate(item: any, type: SearchResultType): string | undefined {
  switch (type) {
    case 'task': return (item as Task).dueDate;
    case 'rdv': return (item as RDV).date_rdv;
    case 'memory': return (item as Memory).date;
    case 'defi': return (item as Defi).startDate; // Filtre sur startDate ou endDate
    default: return undefined;
  }
}

/** Pour les défis, vérifier si le filtre date tombe dans la période start-end */
function defiMatchesDateFilter(defi: Defi, filter: DateFilter): boolean {
  // Vérifier si startDate ou endDate match
  if (matchesDateFilter(defi.startDate, filter)) return true;
  if (matchesDateFilter(defi.endDate, filter)) return true;
  // Vérifier si le filtre tombe dans la plage du défi
  if (filter.year && filter.month && filter.day) {
    const dateStr = `${filter.year}-${String(filter.month).padStart(2, '0')}-${String(filter.day).padStart(2, '0')}`;
    return dateStr >= defi.startDate && dateStr <= defi.endDate;
  }
  return false;
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

/** Résultat interne avec référence à l'item source pour le post-filtrage */
interface InternalResult<T = any> extends SearchResult {
  _item: T;
}

function searchEntities<T>(tokens: string[], items: T[], config: SearchEntityConfig<T>): InternalResult<T>[] {
  const results: InternalResult<T>[] = [];
  for (const item of items) {
    // Si aucun token texte, on accepte tout (filtrage uniquement par date/personne)
    const score = tokens.length === 0 ? 1 : matchScore(tokens, ...config.getFields(item));
    if (score === 0) continue;
    results.push({
      type: config.type,
      icon: config.icon,
      route: config.route,
      title: config.getTitle(item),
      snippet: config.getSnippet(item),
      relevance: score + (config.getBonus?.(item) ?? 0),
      _item: item,
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
  { type: 'task', getItems: (i) => i.tasks, config: taskConfig },
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
 * Supporte les filtres de date et de personne extraits de la requête.
 * Retourne les résultats triés par pertinence décroissante.
 */
export function searchVault(query: string, input: SearchInput): SearchResult[] {
  const output = searchVaultWithFilters(query, input);
  return output.results;
}

/**
 * Recherche enrichie : retourne les résultats ET les filtres détectés.
 * Utilisé par GlobalSearch pour afficher les badges de filtres actifs.
 */
export function searchVaultWithFilters(query: string, input: SearchInput): SearchOutput {
  const trimmed = query.trim();
  const emptyOutput: SearchOutput = { results: [], filters: { contentTokens: [] } };
  if (trimmed.length < 2) return emptyOutput;

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return emptyOutput;

  // Extraction des filtres date/personne
  const filters = parseFilters(trimmed, input.profiles ?? []);
  const hasDateFilter = !!filters.dateFilter;
  const hasPersonFilter = !!filters.personFilter;

  // Détection de type sur les tokens restants + tokens originaux
  const detectedTypes = detectTypes(tokens);
  // Tokens sans mots-clés de type ni filtres déjà extraits
  const contentTokens = filters.contentTokens.filter((t) => !TYPE_KEYWORDS[t]);
  // Si on a des filtres mais pas de tokens texte, chercher partout (filtrage seul)
  const searchTokens = contentTokens.length > 0 ? contentTokens :
    (hasDateFilter || hasPersonFilter) ? [] : tokens;

  const searchAll = detectedTypes.size === 0;
  const results: InternalResult[] = [];

  for (const { type, getItems, config } of SEARCH_CONFIGS) {
    if (searchAll || detectedTypes.has(type)) {
      results.push(...searchEntities(searchTokens, getItems(input), config));
    }
  }

  // Post-filtrage par date
  let filtered: InternalResult[] = results;
  if (hasDateFilter) {
    filtered = filtered.filter((r) => {
      // Les types sans champ date ne sont pas filtrés par date
      const itemDate = getItemDate(r._item, r.type);
      if (r.type === 'defi') return defiMatchesDateFilter(r._item as Defi, filters.dateFilter!);
      if (!itemDate && ['task', 'rdv', 'memory'].includes(r.type)) return false;
      if (!itemDate) return true; // recettes, stock, courses, repas : pas de filtre date
      return matchesDateFilter(itemDate, filters.dateFilter!);
    });
  }

  // Post-filtrage par personne
  if (hasPersonFilter) {
    filtered = filtered.filter((r) => matchesPersonFilter(r._item, r.type, filters.personFilter!));
  }

  // Nettoyage du champ _item interne avant retour
  const cleanResults: SearchResult[] = filtered.map(({ _item, ...rest }) => rest);

  // Tri par pertinence décroissante
  cleanResults.sort((a, b) => b.relevance - a.relevance);

  return { results: cleanResults.slice(0, 30), filters };
}
