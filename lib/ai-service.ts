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
import type { DietaryExtraction, DietarySeverity } from './dietary/types';
import { EU_ALLERGENS, COMMON_INTOLERANCES, COMMON_REGIMES } from './dietary/catalogs';

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
  recipes: { count: number; list: string[] };
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
    // Tâches : seulement les siennes + maison (partagé)
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
    // Partagés (pas de filtre) : stock, meals, courses, recipes, profiles
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
      if (s.medications && s.medications.length > 0) {
        parts.push(`médicaments: ${s.medications.map(m => `${m.medicament}${m.dose ? ` (${m.dose})` : ''}`).join(', ')}`);
      }
      if (s.observations && s.observations.length > 0) {
        parts.push(`notes: ${s.observations.join('. ')}`);
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
      pending: ctx.tasks.filter(t =>
        t.section != null && t.section.toLowerCase().includes('ménage') && !t.completed
      ).length,
    },
    rdvs: {
      upcoming: ctx.rdvs
        .filter((r) => r.statut === 'planifié' && r.date_rdv >= todayStr && r.date_rdv <= in7Days)
        .map((r) => `${r.date_rdv} ${r.heure} — ${r.type_rdv} ${r.enfant} (${r.lieu || r.médecin || ''})`),
    },
    stock: {
      low: ctx.stock.filter((s) => s.tracked !== false && s.seuil > 0 && s.quantite <= s.seuil).map((s) => `${s.produit} (${s.quantite}/${s.seuil})`),
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
    recipes: {
      count: ctx.recipes.length,
      list: ctx.recipes.map(r => {
        const ingr = r.ingredients.map(i => i.name).join(', ');
        return `${r.title} (${r.category})${ingr ? ` — ${ingr}` : ''}`;
      }),
    },
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
**Recettes** : ${summary.recipes.count} disponibles${summary.recipes.list.length > 0 ? `\n${summary.recipes.list.join('\n')}` : ''}
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
    ctx.memories,
    ctx.tasks,
  );

  // 3. Construire le résumé à partir des données filtrées
  const summary = buildVaultSummary(filtered);
  const rawPrompt = buildSystemPrompt(summary);
  const systemPrompt = anonymize(rawPrompt, anonMap);

  if (__DEV__) {
    if (__DEV__) console.log('🔒 [ANON] Mapping: ', anonMap.forward.size, 'entrées');
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

/** Image en base64 pour l'API Vision */
interface ImageBlock {
  base64: string;
  mediaType: string;
}

/** Appelle l'API Claude. Retourne le texte ou une erreur. */
async function callClaude(
  config: AIConfig,
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens: number = MAX_TOKENS,
  images?: ImageBlock[],
): Promise<AIResponse> {
  try {
    // Construire les messages — ajout des blocs image si fournis
    const formattedMessages = (!images || images.length === 0)
      ? messages.map((m) => ({ role: m.role, content: m.content }))
      : messages.map((m, idx) => {
          const isLastUser = m.role === 'user' && idx === messages.length - 1;
          if (isLastUser) {
            const content: Array<
              | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
              | { type: 'text'; text: string }
            > = images.map((img) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: img.mediaType, data: img.base64 },
            }));
            content.push({ type: 'text' as const, text: m.content });
            return { role: m.role, content };
          }
          return { role: m.role, content: m.content };
        });

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
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: formattedMessages,
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
    if (__DEV__) console.log('🔒 [ANON] Question envoyée (anonymisée)');
  }

  const resp = await callClaude(config, systemPrompt, messages);
  if (resp.error) return resp;

  const deanoText = deanonymize(resp.text, anonMap);
  if (__DEV__) {
    if (__DEV__) console.log('🔓 [ANON] Réponse reçue, longueur:', deanoText.length);
  }

  return { text: deanoText };
}

/** Résume une transcription de consultation médicale en notes structurées */
export async function summarizeConsultation(
  config: AIConfig,
  transcript: string,
  rdv: { type_rdv: string; enfant: string; médecin: string; questions?: string[] },
  vaultCtx: VaultContext,
): Promise<AIResponse> {
  // Anonymiser la transcription
  const anonMap = buildAnonymizationMap(
    vaultCtx.profiles,
    vaultCtx.rdvs,
    vaultCtx.healthRecords,
    vaultCtx.memories,
    vaultCtx.tasks,
  );

  const anonTranscript = anonymize(transcript, anonMap);
  const anonEnfant = anonymize(rdv.enfant, anonMap);
  const anonMedecin = anonymize(rdv.médecin, anonMap);
  const anonQuestions = rdv.questions?.map((q) => anonymize(q, anonMap)) ?? [];

  const questionsBlock = anonQuestions.length > 0
    ? `\nQuestions posées :\n${anonQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
    : '';

  const systemPrompt = `Tu es un assistant médical qui structure des notes de consultation.
Tu reçois la transcription brute d'une consultation ${rdv.type_rdv} pour ${anonEnfant} avec ${anonMedecin}.${questionsBlock}

Règles :
- Résume en français, de façon claire et concise
- Structure avec des sections (Diagnostic, Prescriptions, Recommandations, Suivi)
- Omets les sections vides
- Si des questions ont été posées, inclus les réponses correspondantes
- Garde uniquement les informations médicalement pertinentes
- N'invente rien — ne mets que ce qui est dans la transcription
- Les noms utilisés sont des pseudonymes — utilise-les tels quels
- Maximum 300 mots
- Termine toujours par : "⚠️ Ce résumé est fourni à titre informatif uniquement et ne remplace pas un avis médical professionnel."`;

  const messages: AIMessage[] = [
    { role: 'user', content: `Voici la transcription de la consultation :\n\n${anonTranscript}` },
  ];

  // Utiliser Haiku pour le coût minimal
  const haikiConfig = { ...config, model: 'claude-haiku-4-5-20251001' };
  const resp = await callClaude(haikiConfig, systemPrompt, messages);
  if (resp.error) return resp;

  return { text: deanonymize(resp.text, anonMap) };
}

const MEDICAL_RDV_TYPES = new Set(['pédiatre', 'vaccin', 'pmi', 'dentiste', 'urgences']);

/** Génère un briefing de préparation avant un RDV (médical ou vie courante) */
export async function generateRDVBriefing(
  config: AIConfig,
  rdv: { type_rdv: string; enfant: string; médecin: string; date_rdv: string },
  vaultCtx: VaultContext,
): Promise<AIResponse> {
  const anonMap = buildAnonymizationMap(
    vaultCtx.profiles,
    vaultCtx.rdvs,
    vaultCtx.healthRecords,
    vaultCtx.memories,
    vaultCtx.tasks,
  );

  const anonEnfant = anonymize(rdv.enfant, anonMap);
  const anonContact = anonymize(rdv.médecin, anonMap);
  const isMedical = MEDICAL_RDV_TYPES.has(rdv.type_rdv);

  const enfantProfile = vaultCtx.profiles.find(p => p.name === rdv.enfant);
  const ageInfo = enfantProfile?.birthdate ? `Date de naissance : ${enfantProfile.birthdate}` : '';

  let contextBlock = '';
  let roleDescription = '';
  let rulesBlock = '';
  let userMessage = '';

  if (isMedical) {
    // Contexte santé pour les RDV médicaux
    const healthRecord = vaultCtx.healthRecords?.find(h => h.enfant === rdv.enfant);
    if (healthRecord) {
      const lastGrowth = healthRecord.croissance.slice(-1)[0];
      const recentVaccins = healthRecord.vaccins.slice(-5);
      const parts: string[] = [];
      if (healthRecord.allergies.length > 0) parts.push(`Allergies : ${healthRecord.allergies.join(', ')}`);
      if (healthRecord.medicamentsEnCours.length > 0) parts.push(`Médicaments en cours : ${healthRecord.medicamentsEnCours.join(', ')}`);
      if (lastGrowth) parts.push(`Dernière mesure : ${lastGrowth.date} — ${lastGrowth.poids ? lastGrowth.poids + ' kg' : ''} ${lastGrowth.taille ? lastGrowth.taille + ' cm' : ''}`);
      if (recentVaccins.length > 0) parts.push(`Derniers vaccins : ${recentVaccins.map(v => `${v.nom} (${v.date})`).join(', ')}`);
      if (healthRecord.antecedents.length > 0) parts.push(`Antécédents : ${healthRecord.antecedents.join(', ')}`);
      contextBlock = `Dossier santé :\n${anonymize(parts.join('\n'), anonMap)}`;
    } else {
      contextBlock = 'Pas de dossier santé disponible.';
    }

    roleDescription = 'Tu es un assistant qui aide les parents à préparer un rendez-vous médical.\nTu génères une liste de questions pertinentes à poser au médecin, basée sur le type de RDV, l\'âge de l\'enfant et son dossier santé.';
    rulesBlock = `Règles :
- Génère 5 à 8 questions pertinentes, numérotées
- Adapte les questions au type de RDV et à l'âge de l'enfant
- Inclus des rappels si des vaccins semblent en retard
- Si des allergies ou médicaments sont listés, pose des questions de suivi
- Sois concis, pratique, en français
- Les noms utilisés sont des pseudonymes — utilise-les tels quels
- Maximum 200 mots`;
    userMessage = 'Prépare-moi pour ce rendez-vous médical.';
  } else if (rdv.type_rdv === 'école') {
    roleDescription = 'Tu es un assistant qui aide les parents à préparer une réunion scolaire (parents/profs, conseil de classe, etc.).\nTu génères une liste de questions et points à aborder avec l\'enseignant.';
    rulesBlock = `Règles :
- Génère 5 à 8 questions/points pertinents, numérotés
- Adapte au niveau scolaire de l'enfant selon son âge
- Couvre : résultats, comportement, intégration sociale, points forts/à améliorer, devoirs
- Sois concis, pratique, en français
- Les noms utilisés sont des pseudonymes — utilise-les tels quels
- Maximum 200 mots`;
    userMessage = 'Prépare-moi pour cette réunion scolaire.';
  } else if (rdv.type_rdv === 'activité') {
    roleDescription = 'Tu es un assistant qui aide les parents à préparer un rendez-vous lié à une activité extra-scolaire (sport, musique, danse, etc.).\nTu génères une liste de points à aborder avec le responsable.';
    rulesBlock = `Règles :
- Génère 4 à 6 points pertinents, numérotés
- Couvre : progression, planning, équipement nécessaire, objectifs, comportement en groupe
- Sois concis, pratique, en français
- Les noms utilisés sont des pseudonymes — utilise-les tels quels
- Maximum 150 mots`;
    userMessage = 'Prépare-moi pour ce rendez-vous d\'activité.';
  } else if (rdv.type_rdv === 'administratif') {
    roleDescription = 'Tu es un assistant qui aide les parents à préparer un rendez-vous administratif (mairie, CAF, assurance, mutuelle, etc.).\nTu génères une liste de documents à préparer et points à vérifier.';
    rulesBlock = `Règles :
- Génère 5 à 8 points pertinents, numérotés
- Couvre : documents à apporter, questions à poser, pièces justificatives, délais, démarches à prévoir
- Sois concis, pratique, en français
- Les noms utilisés sont des pseudonymes — utilise-les tels quels
- Maximum 200 mots`;
    userMessage = 'Prépare-moi pour ce rendez-vous administratif.';
  } else {
    roleDescription = 'Tu es un assistant qui aide les parents à préparer un rendez-vous.\nTu génères une liste de points à aborder ou questions à poser.';
    rulesBlock = `Règles :
- Génère 4 à 6 points pertinents, numérotés
- Sois concis, pratique, en français
- Les noms utilisés sont des pseudonymes — utilise-les tels quels
- Maximum 150 mots`;
    userMessage = 'Prépare-moi pour ce rendez-vous.';
  }

  const systemPrompt = `${roleDescription}

Rendez-vous : ${rdv.type_rdv} pour ${anonEnfant} avec ${anonContact}
Date : ${rdv.date_rdv}
${ageInfo ? anonymize(ageInfo, anonMap) : ''}

${contextBlock}

${rulesBlock}`;

  const messages: AIMessage[] = [
    { role: 'user', content: userMessage },
  ];

  const haikiConfig = { ...config, model: 'claude-haiku-4-5-20251001' };
  const resp = await callClaude(haikiConfig, systemPrompt, messages);
  if (resp.error) return resp;

  return { text: deanonymize(resp.text, anonMap) };
}

/** Résume une transcription vocale générique en note structurée */
export async function summarizeTranscription(
  config: AIConfig,
  transcript: string,
  title?: string,
  vaultCtx?: VaultContext,
): Promise<AIResponse> {
  const anonMap = vaultCtx
    ? buildAnonymizationMap(
        vaultCtx.profiles,
        vaultCtx.rdvs,
        vaultCtx.healthRecords,
        vaultCtx.memories,
        vaultCtx.tasks,
      )
    : { forward: new Map(), reverse: new Map() };

  const anonTranscript = anonymize(transcript, anonMap);
  const anonTitle = title ? anonymize(title, anonMap) : '';

  const titleHint = anonTitle ? `\nContexte : "${anonTitle}"` : '';

  const systemPrompt = `Tu es un assistant qui structure des notes dictées oralement.
Tu reçois la transcription brute d'une dictée vocale.${titleHint}

Règles :
- Résume en français, de façon claire et concise
- Corrige les erreurs de transcription évidentes
- Structure le texte avec des paragraphes ou des listes si pertinent
- N'invente rien — ne mets que ce qui est dans la transcription
- Les noms utilisés sont des pseudonymes — utilise-les tels quels
- Maximum 300 mots`;

  const messages: AIMessage[] = [
    { role: 'user', content: `Voici la transcription :\n\n${anonTranscript}` },
  ];

  const haikiConfig = { ...config, model: 'claude-haiku-4-5-20251001' };
  const resp = await callClaude(haikiConfig, systemPrompt, messages);
  if (resp.error) return resp;

  return { text: deanonymize(resp.text, anonMap) };
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

// ─── Suggestion de recettes à partir du stock ───────────────────────────────

/** Suggère des recettes réalisables avec le stock actuel */
export async function suggestRecipesFromStock(
  config: AIConfig,
  stock: StockItem[],
  recipes: AppRecipe[],
  profiles: Profile[],
  meals?: MealItem[],
  healthRecords?: HealthRecord[],
): Promise<AIResponse> {
  const available = stock
    .filter(s => s.quantite > 0)
    .map(s => `${s.produit} (${s.quantite})`)
    .join(', ');

  const recipeList = recipes
    .slice(0, 50)
    .map(r => `- ${r.title} (${r.ingredients.map(i => i.name).join(', ')})`)
    .join('\n');

  const family = profiles
    .filter(p => p.statut !== 'grossesse')
    .map(p => `${p.name} (${p.role})`)
    .join(', ');

  // Repas récents (7 derniers jours) pour éviter les doublons
  const recentMeals = (meals || [])
    .filter(m => m.text.trim().length > 0)
    .map(m => `${m.day} ${m.mealType}: ${m.text}`)
    .join('\n');

  // Allergies de toute la famille
  const allergies = (healthRecords || [])
    .filter(h => h.allergies.length > 0)
    .map(h => `${h.enfant}: ${h.allergies.join(', ')}`)
    .join('; ');

  let systemPrompt = `Tu es un assistant cuisine familial. La famille : ${family}.`;
  if (allergies) systemPrompt += `\n⚠️ Allergies/restrictions : ${allergies}. Ne suggère JAMAIS de recettes contenant ces allergènes.`;

  let userContent = `Voici mon stock actuel :\n${available}\n\nVoici mes recettes disponibles :\n${recipeList}`;
  if (recentMeals) userContent += `\n\nRepas déjà planifiés cette semaine (évite les doublons) :\n${recentMeals}`;
  userContent += `\n\nSuggère 2-3 recettes que je peux faire avec ce que j'ai en stock (ou presque). Pour chaque suggestion :\n- Nom de la recette\n- Ce que j'ai déjà\n- Ce qu'il manque éventuellement (1-2 ingrédients max)\n\nFormat court, une recette par paragraphe, emoji en début de ligne. Si aucune recette ne colle, suggère une recette simple faisable avec le stock.`;

  const messages: AIMessage[] = [{ role: 'user', content: userContent }];

  return callClaude(config, systemPrompt, messages);
}

// ─── Scan ticket de caisse (Vision) ──────────────────────────────────────────

/** Résultat structuré d'un scan de ticket de caisse */
export interface ReceiptScanResult {
  store: string;
  date: string; // YYYY-MM-DD
  items: Array<{ label: string; amount: number; category: string }>;
  total: number;
}

/** Erreur spécifique au scan pour remonter le message à l'UI */
export class ReceiptScanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReceiptScanError';
  }
}

/** Scanne un ticket de caisse via Claude Vision et extrait les articles */
export async function scanReceiptImage(
  config: AIConfig,
  imageBase64: string,
  mediaType: string,
  categories: string[],
): Promise<ReceiptScanResult> {
  const categoriesList = categories.join(', ');
  const today = new Date().toISOString().slice(0, 10);

  const systemPrompt = `Tu es un assistant spécialisé dans l'extraction de données de tickets de caisse français.
Tu réponds UNIQUEMENT avec du JSON valide, sans markdown, sans backticks, sans texte avant ou après.

Format de réponse :
{
  "store": "Nom du magasin",
  "date": "YYYY-MM-DD",
  "items": [
    { "label": "Nom article", "amount": 3.99, "category": "catégorie" }
  ],
  "total": 42.50
}

Règles :
- Le ticket peut être orienté dans n'importe quel sens (horizontal, vertical, tourné) — adapte ta lecture
- Le montant (amount) est le prix total de la ligne (prix unitaire × quantité si indiqué)
- Ignore les lignes de remise, sous-totaux intermédiaires, TVA, et moyens de paiement
- La date doit être au format YYYY-MM-DD. Si illisible, utilise ${today}
- Catégories disponibles : ${categoriesList}
- Choisis la catégorie la plus pertinente pour chaque article
- Si le magasin n'est pas lisible, mets une chaîne vide
- Inclus TOUS les articles visibles, même partiellement lisibles
- Si l'image n'est pas un ticket de caisse, réponds {"store":"","date":"","items":[],"total":0}`;

  const messages: AIMessage[] = [
    { role: 'user', content: 'Extrais les données de ce ticket de caisse.' },
  ];

  // Utiliser Sonnet pour la qualité Vision
  const sonnetConfig = { ...config, model: 'claude-sonnet-4-6' };
  const resp = await callClaude(
    sonnetConfig,
    systemPrompt,
    messages,
    4096,
    [{ base64: imageBase64, mediaType }],
  );

  if (resp.error) {
    if (__DEV__) console.log('🧾 [RECEIPT] Erreur Vision:', resp.error);
    throw new ReceiptScanError(resp.error);
  }

  // Parser la réponse JSON
  try {
    // Nettoyer les éventuels blocs markdown
    const cleaned = resp.text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    if (__DEV__) console.log('🧾 [RECEIPT] Réponse brute (100 premiers chars):', cleaned.slice(0, 100));

    const parsed = JSON.parse(cleaned);

    return {
      store: typeof parsed.store === 'string' ? parsed.store : '',
      date: typeof parsed.date === 'string' ? parsed.date : '',
      items: Array.isArray(parsed.items)
        ? parsed.items.map((item: any) => ({
            label: typeof item.label === 'string' ? item.label : '',
            amount: typeof item.amount === 'number' ? item.amount : 0,
            category: typeof item.category === 'string' ? item.category : categories[0] || '',
          }))
        : [],
      total: typeof parsed.total === 'number' ? parsed.total : 0,
    };
  } catch (e) {
    if (__DEV__) console.log('🧾 [RECEIPT] Erreur parsing JSON:', e, '\nRéponse brute:', resp.text);
    throw new ReceiptScanError('Impossible de lire la réponse IA');
  }
}

// ─── Bilan hebdomadaire IA ──────────────────────────────────────────────────────

/**
 * Génère un bilan de semaine chaleureux à partir du récap formaté.
 * Le texte recapText doit déjà être anonymisé par l'appelant si nécessaire.
 */
export async function generateWeeklyBilan(
  config: AIConfig,
  recapText: string,
): Promise<AIResponse> {
  const systemPrompt = 'Tu es un assistant familial chaleureux. Tu rédiges des bilans de semaine pour une famille française.';

  const messages: AIMessage[] = [
    {
      role: 'user',
      content: `Voici le résumé de notre semaine :\n\n${recapText}\n\nRédige un bilan de semaine en 2-3 paragraphes courts, ton chaleureux et bienveillant. Maximum 200 mots. Mets en valeur les mots d'enfants s'il y en a. Termine par un encouragement pour la semaine prochaine. Pas de markdown, pas de listes à puces, 2-3 emojis max. Utilise les prénoms tels quels.`,
    },
  ];

  // Utiliser Haiku pour le coût minimal
  const haikiConfig = { ...config, model: 'claude-haiku-4-5-20251001' };
  const resp = await callClaude(haikiConfig, systemPrompt, messages);
  if (resp.error) return resp;

  return { text: resp.text };
}

// ─── Message compagnon mascotte ─────────────────────────────────────────────────

/**
 * Appelle Claude Haiku pour générer un message court du compagnon mascotte.
 * Utilisé par companion-engine.ts via un callback depuis tree.tsx.
 *
 * @param config - Config IA (apiKey + model)
 * @param prompt - Prompt court généré par buildCompanionPrompt
 * @returns Le texte généré ou une chaîne vide en cas d'erreur
 */
export async function callCompanionMessage(config: AIConfig, prompt: string): Promise<string> {
  const haikuConfig = { ...config, model: 'claude-haiku-4-5-20251001' };
  const resp = await callClaude(
    haikuConfig,
    'Tu incarnes un petit animal de compagnie dans un jeu familial. Tu parles en une phrase courte et naturelle, comme un ami. Ne mentionne jamais ce que tu es.',
    [{ role: 'user', content: prompt }],
    100,
  );
  if (resp.error || !resp.text) return '';
  return resp.text.trim();
}

// ─── Extraction des préférences alimentaires (PREF-13) ───────────────────────

/** Contexte de profils fourni au caller pour l'extraction vocale */
export interface ExtractDietaryContext {
  profiles: { id: string; name: string }[];
  guests: { id: string; name: string }[];
}

/**
 * PREF-13 : Interprète une transcription vocale libre pour extraire des préférences
 * alimentaires structurées. Utilise claude-haiku (rapide + moins coûteux).
 *
 * Retourne un tableau d'extractions. En cas d'erreur ou JSON invalide, throw
 * pour que le caller puisse fallback vers la modale manuelle (D-15).
 */
export async function extractDietaryConstraints(
  config: AIConfig,
  transcript: string,
  ctx: ExtractDietaryContext,
): Promise<DietaryExtraction[]> {
  if (!transcript.trim()) return [];

  const profilesList = ctx.profiles.map(p => `- ${p.name} (id: ${p.id}, type: famille)`).join('\n');
  const guestsList = ctx.guests.map(g => `- ${g.name} (id: ${g.id}, type: invité)`).join('\n');
  const allergenIds = EU_ALLERGENS.map(a => a.id).join(', ');
  const intoleranceIds = COMMON_INTOLERANCES.map(i => i.id).join(', ');
  const regimeIds = COMMON_REGIMES.map(r => r.id).join(', ');

  const systemPrompt = `Tu es un assistant qui extrait des préférences alimentaires depuis une transcription vocale en français.
Convives disponibles :
${profilesList}
${guestsList}

Catalogues d'IDs canoniques à préférer :
- Allergies : ${allergenIds}
- Intolérances : ${intoleranceIds}
- Régimes : ${regimeIds}
- Aversions : texte libre (pas de catalogue)

Réponds UNIQUEMENT avec un JSON valide de la forme :
{"extractions": [{"profileId": "lucas", "profileName": "Lucas", "category": "allergie", "item": "arachides", "confidence": "high"}]}

Règles :
- category est exactement "allergie" | "intolerance" | "regime" | "aversion"
- Si l'item correspond à un ID canonique, utilise cet ID. Sinon, utilise le texte libre en minuscules.
- profileId null si le nom du convive n'est pas reconnaissable dans la liste.
- confidence "high" si item+profil clairs, "medium" si une ambiguïté, "low" si très incertain.
- Une transcription peut produire plusieurs extractions.`;

  const haikuConfig = { ...config, model: 'claude-haiku-4-5-20251001' };
  const response = await callClaude(haikuConfig, systemPrompt, [{ role: 'user', content: transcript }]);

  if (response.error) {
    throw new Error(`extractDietaryConstraints: erreur API — ${response.error}`);
  }

  // Parse le JSON (tolérant aux code fences)
  const cleaned = response.text.replace(/```json\s*|\s*```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed.extractions || !Array.isArray(parsed.extractions)) {
    throw new Error('extractDietaryConstraints: format JSON invalide');
  }

  // Validation des champs et coerce category
  const validCategories: DietarySeverity[] = ['allergie', 'intolerance', 'regime', 'aversion'];
  return parsed.extractions.filter((e: any) =>
    typeof e.item === 'string' &&
    validCategories.includes(e.category) &&
    typeof e.profileName === 'string',
  );
}

// ─── Histoires du soir ──────────────────────────────────────────────────────

export interface StoryPersonalizationContext {
  recentMoods: Array<{ level: number; note?: string; date: string }>;
  recentQuotes: Array<{ citation: string; contexte?: string; date: string }>;
  recentMemories: Array<{ titre: string; description?: string; date: string }>;
  allergies: string[];
  gender?: 'garçon' | 'fille';
}

export interface StoryGenerationConfig {
  enfantAnon: string;
  enfantAge: string;
  universId: string;
  universTitre: string;
  detail?: string;
  language: 'fr' | 'en';
  context: StoryPersonalizationContext;
}

export async function generateBedtimeStory(
  config: AIConfig,
  story: StoryGenerationConfig,
): Promise<AIResponse> {
  const langInstr = story.language === 'en'
    ? 'Write the story in English.'
    : 'Écris l\'histoire en français.';

  const moodContext = story.context.recentMoods.length > 0
    ? `Humeurs récentes de l'enfant (du plus récent): ${story.context.recentMoods.map(m => `niveau ${m.level}/5${m.note ? ` ("${m.note}")` : ''}`).join(', ')}.`
    : '';

  const quotesContext = story.context.recentQuotes.length > 0
    ? `Mots d'enfants récents: ${story.context.recentQuotes.map(q => `"${q.citation}"${q.contexte ? ` (${q.contexte})` : ''}`).join('; ')}.`
    : '';

  const memoriesContext = story.context.recentMemories.length > 0
    ? `Souvenirs récents: ${story.context.recentMemories.map(m => m.description ? `"${m.titre}" — ${m.description}` : `"${m.titre}"`).join('; ')}.`
    : '';

  const systemPrompt = `Tu es un conteur d'histoires pour enfants expert. Tu crées des histoires du soir courtes, douces et apaisantes, parfaites pour endormir un enfant de ${story.enfantAge}.

RÈGLES STRICTES :
- ${langInstr}
- Vocabulaire adapté à ${story.enfantAge}
- Longueur : exactement 3 paragraphes bien distincts (~150 mots total)
- Ton : doux, rassurant, poétique, jamais effrayant
- Fin : paisible — le héros rentre chez lui ou s'endort après l'aventure
- Le héros s'appelle "${story.enfantAnon}"
- Univers imposé : "${story.universTitre}"
${moodContext ? `- Adapte le ton selon l'humeur : ${moodContext}` : ''}
${quotesContext ? `- Intègre subtilement une expression de l'enfant : ${quotesContext}` : ''}
${memoriesContext ? `- Crée un écho avec un souvenir récent : ${memoriesContext}` : ''}
- Répondre UNIQUEMENT en JSON valide : { "titre": "...", "texte": "paragraphe1\\n\\nparagraphe2\\n\\nparagraphe3" }
- Aucun texte en dehors du JSON`;

  const userMessage = `Crée une histoire du soir pour ${story.enfantAnon} (${story.enfantAge}) dans l'univers "${story.universTitre}"${story.detail ? `. Détail du jour à intégrer : ${story.detail}` : ''}.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      return { text: '', error: `Erreur API (${response.status})` };
    }

    const data = await response.json();
    const rawText: string = data.content?.[0]?.text ?? '';

    // Extraire le JSON de la réponse
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { text: JSON.stringify({ titre: 'Histoire du soir', texte: rawText }), error: undefined };
    }

    return { text: jsonMatch[0], error: undefined };
  } catch (e) {
    return { text: '', error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}
