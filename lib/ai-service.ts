/**
 * ai-service.ts — Service Claude API (fetch direct, pas de SDK npm)
 *
 * Appels à api.anthropic.com pour :
 * - Recherche conversationnelle (questions sur le vault)
 * - Insights enrichis (analyse IA du contexte familial)
 *
 * Tout est optionnel — sans clé API, rien ne s'exécute.
 */

import type { Task, RDV, StockItem, MealItem, CourseItem, Memory, Defi, Profile, WishlistItem } from './types';
import type { AppRecipe } from './cooklang';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface AIConfig {
  apiKey: string;
  model: string;
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  text: string;
  error?: string;
}

export interface VaultSummary {
  tasks: { total: number; overdue: number; pending: number };
  menage: { pending: number };
  rdvs: { upcoming: string[] };
  stock: { low: string[] };
  meals: { today: string[] };
  courses: { pending: number; items: string[] };
  recipes: { count: number };
  memories: { count: number; recent: string[] };
  defis: { active: string[] };
  wishlist: { count: number };
  profiles: { names: string[]; roles: string[] };
}

export interface VaultContext {
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
  profiles: Profile[];
  activeProfile: Profile | null;
}

// ─── Résumé du vault pour le contexte IA ────────────────────────────────────────

/** Construit un résumé compact du vault pour le contexte IA (évite d'envoyer toutes les données brutes) */
export function buildVaultSummary(ctx: VaultContext): VaultSummary {
  const todayStr = new Date().toISOString().slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const todayDay = dayNames[new Date().getDay()];

  return {
    tasks: {
      total: ctx.tasks.length,
      overdue: ctx.tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < todayStr).length,
      pending: ctx.tasks.filter((t) => !t.completed).length,
    },
    menage: {
      pending: ctx.menageTasks.filter((t) => !t.completed).length,
    },
    rdvs: {
      upcoming: ctx.rdvs
        .filter((r) => r.statut === 'planifié' && r.date_rdv >= todayStr && r.date_rdv <= in7Days)
        .map((r) => `${r.date_rdv} ${r.heure} — ${r.type_rdv} ${r.enfant} (${r.lieu || r.médecin || ''})`),
    },
    stock: {
      low: ctx.stock.filter((s) => s.quantite <= s.seuil).map((s) => `${s.produit} (${s.quantite}/${s.seuil})`),
    },
    meals: {
      today: ctx.meals
        .filter((m) => m.day === todayDay && m.text.trim())
        .map((m) => `${m.mealType}: ${m.text}`),
    },
    courses: {
      pending: ctx.courses.filter((c) => !c.completed).length,
      items: ctx.courses.filter((c) => !c.completed).slice(0, 10).map((c) => c.text),
    },
    recipes: { count: ctx.recipes.length },
    memories: {
      count: ctx.memories.length,
      recent: ctx.memories
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5)
        .map((m) => `${m.date} — ${m.title} (${m.enfant})`),
    },
    defis: {
      active: ctx.defis.filter((d) => d.status === 'active').map((d) => `${d.emoji} ${d.title}`),
    },
    wishlist: {
      count: ctx.wishlistItems.filter((w) => !w.bought).length,
    },
    profiles: {
      names: ctx.profiles.map((p) => p.name),
      roles: ctx.profiles.map((p) => `${p.name} (${p.role})`),
    },
  };
}

// ─── Prompts système ────────────────────────────────────────────────────────────

function buildSystemPrompt(summary: VaultSummary): string {
  return `Tu es l'assistant familial de l'application Family Vault. Tu aides une famille à s'organiser au quotidien.

Voici l'état actuel de leur organisation familiale :

**Famille** : ${summary.profiles.roles.join(', ')}

**Tâches** : ${summary.tasks.pending} en attente, ${summary.tasks.overdue} en retard
**Ménage** : ${summary.menage.pending} tâches du jour
**RDV à venir** : ${summary.rdvs.upcoming.length > 0 ? summary.rdvs.upcoming.join(' | ') : 'Aucun'}
**Stock bas** : ${summary.stock.low.length > 0 ? summary.stock.low.join(', ') : 'Tout OK'}
**Repas du jour** : ${summary.meals.today.length > 0 ? summary.meals.today.join(', ') : 'Non planifiés'}
**Courses** : ${summary.courses.pending} articles (${summary.courses.items.slice(0, 5).join(', ')}${summary.courses.pending > 5 ? '...' : ''})
**Recettes** : ${summary.recipes.count} disponibles
**Souvenirs récents** : ${summary.memories.recent.length > 0 ? summary.memories.recent.join(' | ') : 'Aucun'}
**Défis actifs** : ${summary.defis.active.length > 0 ? summary.defis.active.join(', ') : 'Aucun'}
**Souhaits** : ${summary.wishlist.count} idées non achetées

Règles :
- Réponds toujours en français
- Sois concis et pratique (3-5 phrases max)
- Donne des conseils actionnables
- Ne suggère pas de modifier l'app — donne des conseils d'organisation
- Tu ne peux pas modifier les données — tu peux seulement conseiller`;
}

// ─── Appel API ──────────────────────────────────────────────────────────────────

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MAX_TOKENS = 512;

/** Appelle l'API Claude. Retourne le texte ou une erreur. */
export async function callClaude(
  config: AIConfig,
  systemPrompt: string,
  messages: AIMessage[],
): Promise<AIResponse> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      if (response.status === 401) {
        return { text: '', error: 'Clé API invalide. Vérifiez dans les réglages.' };
      }
      if (response.status === 429) {
        return { text: '', error: 'Trop de requêtes. Réessayez dans un moment.' };
      }
      return { text: '', error: `Erreur API (${response.status})` };
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '';
    return { text };
  } catch (e: any) {
    if (e?.message?.includes('Network')) {
      return { text: '', error: 'Pas de connexion internet.' };
    }
    return { text: '', error: `Erreur : ${e?.message ?? String(e)}` };
  }
}

// ─── Fonctions haut niveau ──────────────────────────────────────────────────────

/** Recherche conversationnelle : l'utilisateur pose une question sur son organisation */
export async function askVault(
  config: AIConfig,
  question: string,
  vaultCtx: VaultContext,
  history: AIMessage[] = [],
): Promise<AIResponse> {
  const summary = buildVaultSummary(vaultCtx);
  const systemPrompt = buildSystemPrompt(summary);
  const messages: AIMessage[] = [
    ...history,
    { role: 'user', content: question },
  ];
  return callClaude(config, systemPrompt, messages);
}

/** Génère des suggestions IA basées sur le contexte vault */
export async function generateAISuggestions(
  config: AIConfig,
  vaultCtx: VaultContext,
): Promise<AIResponse> {
  const summary = buildVaultSummary(vaultCtx);
  const systemPrompt = buildSystemPrompt(summary);
  const messages: AIMessage[] = [
    {
      role: 'user',
      content: `Analyse l'état actuel de l'organisation familiale et donne 2-3 suggestions pratiques et prioritaires pour aujourd'hui. Format : une suggestion par ligne, commençant par un emoji pertinent. Pas de numérotation.`,
    },
  ];
  return callClaude(config, systemPrompt, messages);
}
