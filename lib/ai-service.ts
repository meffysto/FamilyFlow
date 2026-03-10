/**
 * ai-service.ts — Service Claude API (fetch direct, pas de SDK npm)
 *
 * Appels à api.anthropic.com pour :
 * - Recherche conversationnelle (questions sur le vault)
 * - Insights enrichis (analyse IA du contexte familial)
 *
 * Tout est optionnel — sans clé API, rien ne s'exécute.
 *
 * ANONYMISATION : toutes les données personnelles (noms, médecins, lieux)
 * sont remplacées par des pseudonymes avant envoi. La réponse est dé-anonymisée
 * avant affichage. Aucune donnée réelle ne quitte le device.
 */

import type { Task, RDV, StockItem, MealItem, CourseItem, Memory, Defi, Profile, WishlistItem, HealthRecord } from './types';
import type { AppRecipe } from './cooklang';
import type { JournalStats } from './journal-stats';
import { buildAnonymizationMap, anonymize, deanonymize, type AnonymizationMap } from './anonymizer';

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

/** Stats journal par enfant pour le contexte IA */
export interface JournalSummaryEntry {
  enfant: string;
  date: string;
  stats: JournalStats;
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
  /** Stats journal des 7 derniers jours (optionnel, ajouté progressivement) */
  journalStats?: JournalSummaryEntry[];
  /** Dossiers santé (optionnel) */
  healthRecords?: HealthRecord[];
}

// ─── Résumé du vault pour le contexte IA ────────────────────────────────────────

interface VaultSummary {
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
  journal: string[];
  health: string[];
  /** Rôle du profil actif (pour adapter le ton et les données) */
  activeRole: 'adulte' | 'enfant' | 'ado' | null;
  activeProfileName: string | null;
}

/** Calcule l'âge en texte lisible à partir d'une date de naissance */
function ageFromBirthdate(birthdate?: string): string {
  if (!birthdate) return 'âge inconnu';
  const birth = new Date(birthdate);
  if (isNaN(birth.getTime())) return 'âge inconnu';
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (months < 1) return 'nouveau-né';
  if (months < 24) return `${months} mois`;
  const years = Math.floor(months / 12);
  return `${years} ans`;
}

// ─── Filtrage par profil actif ───────────────────────────────────────────────

/**
 * Filtre le contexte vault selon le profil actif :
 * - Adulte → voit TOUT (parent = gestion familiale complète)
 * - Enfant/Ado → voit uniquement ses propres données sensibles
 *   + données partagées (repas, courses, défis, recettes)
 */
function filterByProfile(ctx: VaultContext): VaultContext {
  const { activeProfile } = ctx;

  // Pas de profil actif ou adulte → tout montrer
  if (!activeProfile || activeProfile.role === 'adulte') return ctx;

  // Mode enfant/ado : filtrer les données sensibles
  const name = activeProfile.name;
  const nameLower = name.toLowerCase();
  const id = activeProfile.id;

  return {
    ...ctx,
    // Tâches : seulement les siennes + ménage (partagé)
    tasks: ctx.tasks.filter((t) => {
      const fileLower = t.sourceFile.toLowerCase();
      return fileLower.includes(nameLower) || fileLower.includes('maison');
    }),
    // RDV : seulement les siens
    rdvs: ctx.rdvs.filter((r) => r.enfant.toLowerCase() === nameLower),
    // Souvenirs : seulement les siens
    memories: ctx.memories.filter((m) => m.enfant.toLowerCase() === nameLower),
    // Journal : seulement le sien
    journalStats: ctx.journalStats?.filter((j) => j.enfant.toLowerCase() === nameLower),
    // Santé : seulement la sienne
    healthRecords: ctx.healthRecords?.filter((h) => h.enfant.toLowerCase() === nameLower),
    // Wishlist : seulement la sienne
    wishlistItems: ctx.wishlistItems.filter((w) => w.profileName.toLowerCase() === nameLower),
    // Défis : seulement ceux auxquels il participe
    defis: ctx.defis.filter((d) =>
      d.participants.length === 0 || d.participants.includes(id),
    ),
    // Partagés (pas de filtre) : menageTasks, stock, meals, courses, recipes, profiles
  };
}

/** Construit un résumé compact du vault pour le contexte IA */
function buildVaultSummary(ctx: VaultContext): VaultSummary {
  const todayStr = new Date().toISOString().slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const todayDay = dayNames[new Date().getDay()];

  // ── Journal bébé (stats des derniers jours) ──
  const journalLines: string[] = [];
  if (ctx.journalStats && ctx.journalStats.length > 0) {
    for (const entry of ctx.journalStats) {
      const s = entry.stats;
      const parts: string[] = [];
      if (s.biberons > 0) parts.push(`${s.biberons} biberons (${s.totalMl}ml)`);
      if (s.tetees > 0) parts.push(`${s.tetees} tétées`);
      if (s.couchesDetail.total > 0) {
        const d = s.couchesDetail;
        const typeParts: string[] = [];
        if (d.pipi > 0) typeParts.push(`${d.pipi} pipi`);
        if (d.selle > 0) typeParts.push(`${d.selle} selle`);
        if (d.mixte > 0) typeParts.push(`${d.mixte} mixte`);
        parts.push(`${d.total} couches (${typeParts.join(', ')})`);
      }
      if (s.sommeilTotal) {
        parts.push(`sommeil ${s.sommeilTotal} (nuit ${s.sommeilNuit || '—'}, jour ${s.sommeilJour || '—'})`);
      }
      if (parts.length > 0) {
        journalLines.push(`${entry.date} ${entry.enfant} : ${parts.join(' | ')}`);
      }
    }
  }

  // ── Santé ──
  const healthLines: string[] = [];
  if (ctx.healthRecords) {
    for (const h of ctx.healthRecords) {
      const parts: string[] = [];
      if (h.allergies.length > 0) parts.push(`allergies: ${h.allergies.join(', ')}`);
      if (h.antecedents.length > 0) parts.push(`antécédents: ${h.antecedents.join(', ')}`);
      if (h.medicamentsEnCours.length > 0) parts.push(`médicaments: ${h.medicamentsEnCours.join(', ')}`);
      if (h.groupeSanguin) parts.push(`groupe: ${h.groupeSanguin}`);
      const lastGrowth = h.croissance[h.croissance.length - 1];
      if (lastGrowth) {
        const gParts: string[] = [];
        if (lastGrowth.poids) gParts.push(`${lastGrowth.poids}kg`);
        if (lastGrowth.taille) gParts.push(`${lastGrowth.taille}cm`);
        if (gParts.length > 0) parts.push(`dernière mesure (${lastGrowth.date}): ${gParts.join(', ')}`);
      }
      if (parts.length > 0) {
        healthLines.push(`${h.enfant} : ${parts.join(' | ')}`);
      }
    }
  }

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
      roles: ctx.profiles.map((p) => `${p.name} (${p.role}, ${ageFromBirthdate(p.birthdate)})`),
    },
    journal: journalLines,
    health: healthLines,
    activeRole: ctx.activeProfile?.role ?? null,
    activeProfileName: ctx.activeProfile?.name ?? null,
  };
}

// ─── Prompts système ────────────────────────────────────────────────────────────

function buildSystemPrompt(summary: VaultSummary): string {
  const isChild = summary.activeRole === 'enfant' || summary.activeRole === 'ado';

  let prompt = isChild
    ? `Tu es un assistant sympa dans l'application Family Vault. Tu parles à ${summary.activeProfileName || 'un enfant'} et tu l'aides à s'organiser.

Voici ce qui le/la concerne :`
    : `Tu es l'assistant familial de l'application Family Vault. Tu aides une famille à s'organiser au quotidien.

Voici l'état actuel de leur organisation familiale :

**Famille** : ${summary.profiles.roles.join(', ')}`;

  prompt += `\n
**Tâches** : ${summary.tasks.pending} en attente, ${summary.tasks.overdue} en retard
**Ménage** : ${summary.menage.pending} tâches du jour
**RDV à venir** : ${summary.rdvs.upcoming.length > 0 ? summary.rdvs.upcoming.join(' | ') : 'Aucun'}`;

  // Sections adultes uniquement
  if (!isChild) {
    prompt += `
**Stock bas** : ${summary.stock.low.length > 0 ? summary.stock.low.join(', ') : 'Tout OK'}
**Courses** : ${summary.courses.pending} articles (${summary.courses.items.slice(0, 5).join(', ')}${summary.courses.pending > 5 ? '...' : ''})`;
  }

  prompt += `
**Repas du jour** : ${summary.meals.today.length > 0 ? summary.meals.today.join(', ') : 'Non planifiés'}
**Recettes** : ${summary.recipes.count} disponibles
**Souvenirs récents** : ${summary.memories.recent.length > 0 ? summary.memories.recent.join(' | ') : 'Aucun'}
**Défis actifs** : ${summary.defis.active.length > 0 ? summary.defis.active.join(', ') : 'Aucun'}
**Souhaits** : ${summary.wishlist.count} idées non achetées`;

  if (summary.journal.length > 0) {
    prompt += `\n\n**Journal bébé (7 derniers jours)** :\n${summary.journal.join('\n')}`;
  }

  if (summary.health.length > 0) {
    prompt += `\n\n**Santé** :\n${summary.health.join('\n')}`;
  }

  // Règles adaptées au rôle
  if (isChild) {
    prompt += `

Règles :
- Réponds toujours en français
- Sois encourageant et bienveillant, adapte ton vocabulaire
- Sois concis (2-3 phrases max)
- Rappelle les tâches et défis, encourage la progression
- Tu ne peux pas modifier les données — tu peux seulement conseiller
- Les noms utilisés sont des pseudonymes pour protéger la vie privée — utilise-les tels quels`;
  } else {
    prompt += `

Règles :
- Réponds toujours en français
- Sois concis et pratique (3-5 phrases max)
- Donne des conseils actionnables
- Ne suggère pas de modifier l'app — donne des conseils d'organisation
- Tu ne peux pas modifier les données — tu peux seulement conseiller
- Les noms utilisés sont des pseudonymes (Enfant 1, Parent 1, etc.) pour protéger la vie privée — utilise-les tels quels`;
  }

  return prompt;
}

// ─── Anonymisation du contexte complet ──────────────────────────────────────────

/** Construit le mapping et anonymise le prompt système + les messages */
function prepareAnonymized(
  ctx: VaultContext,
): { systemPrompt: string; anonMap: AnonymizationMap } {
  // 1. Filtrer selon le profil actif (enfant voit que ses données)
  const filtered = filterByProfile(ctx);

  // 2. Anonymiser sur la base de TOUS les profils (pour couvrir les noms dans les textes libres)
  const anonMap = buildAnonymizationMap(
    ctx.profiles,
    ctx.rdvs,
    ctx.healthRecords,
  );

  // 3. Construire le résumé à partir des données filtrées
  const summary = buildVaultSummary(filtered);
  const rawPrompt = buildSystemPrompt(summary);
  const systemPrompt = anonymize(rawPrompt, anonMap);

  if (__DEV__) {
    console.log('🔒 [ANON] Mapping:', Object.fromEntries(anonMap.forward));
    console.log('🔒 [ANON] Prompt envoyé à l\'API:\n', systemPrompt);
  }

  return { systemPrompt, anonMap };
}

/** Anonymise un tableau de messages */
function anonymizeMessages(messages: AIMessage[], map: AnonymizationMap): AIMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: anonymize(m.content, map),
  }));
}

// ─── Appel API ──────────────────────────────────────────────────────────────────

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MAX_TOKENS = 512;

/** Appelle l'API Claude. Retourne le texte ou une erreur. */
async function callClaude(
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
  const { systemPrompt, anonMap } = prepareAnonymized(vaultCtx);

  const messages = anonymizeMessages([
    ...history,
    { role: 'user', content: question },
  ], anonMap);

  if (__DEV__) {
    console.log('🔒 [ANON] Question envoyée:', messages[messages.length - 1].content);
  }

  const resp = await callClaude(config, systemPrompt, messages);
  if (resp.error) return resp;

  const deanoText = deanonymize(resp.text, anonMap);
  if (__DEV__) {
    console.log('🔓 [ANON] Réponse brute API:', resp.text);
    console.log('🔓 [ANON] Réponse dé-anonymisée:', deanoText);
  }

  return { text: deanoText };
}

/** Génère des suggestions IA basées sur le contexte vault */
export async function generateAISuggestions(
  config: AIConfig,
  vaultCtx: VaultContext,
): Promise<AIResponse> {
  const { systemPrompt, anonMap } = prepareAnonymized(vaultCtx);

  const messages: AIMessage[] = [
    {
      role: 'user',
      content: `Analyse l'état actuel de l'organisation familiale et donne 2-3 suggestions pratiques et prioritaires pour aujourd'hui. Format : une suggestion par ligne, commençant par un emoji pertinent. Pas de numérotation.`,
    },
  ];

  const resp = await callClaude(config, systemPrompt, messages);
  if (resp.error) return resp;

  return { text: deanonymize(resp.text, anonMap) };
}
