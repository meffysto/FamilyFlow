/**
 * parser.ts — Markdown & YAML frontmatter parsers
 *
 * Handles all coffre vault formats:
 * - Obsidian Tasks plugin format: - [ ] Text 🔁 every day 📅 YYYY-MM-DD
 * - RDV frontmatter (gray-matter)
 * - Courses checkboxes
 * - Ménage hebdomadaire (sections par jour dans Tâches récurrentes)
 * - Journal bébé tables
 * - famille.md / gamification.md custom formats
 */

import matter from 'gray-matter';
import { format } from 'date-fns';
import {
  Task,
  RDV,
  CourseItem,
  MealItem,
  Profile,
  GamificationData,
  GamificationEntry,
  ActiveReward,
  RewardType,
  JournalEntry,
  StockItem,
  Memory,
  MemoryType,
  Defi,
  DefiDayEntry,
  DefiType,
  DefiStatus,
  GratitudeDay,
  GratitudeEntry,
  WishlistItem,
  WishBudget,
  WishOccasion,
  Anniversary,
  Note,
  LoveNote,
  LoveNoteStatus,
  ChildQuote,
  MoodEntry,
  MoodLevel,
  PregnancyWeekEntry,
  SkillTreeData,
  SkillUnlock,
  UsedLoot,
  isValidGender,
  FarmProfileData,
  BedtimeStory,
  StoryUniverseId,
  StoryVoiceConfig,
  ActiveExpedition,
  ExpeditionDifficulty,
  ExpeditionOutcome,
} from './types';
import { VALID_THEMES, type ProfileTheme } from '../constants/themes';
import { parseEmplacementFromHeader, LEGACY_BEBE_SECTIONS, type EmplacementId } from '../constants/stock';
import { parseBuildings, parseInventory, serializeBuildings, serializeInventory } from './mascot/building-engine';
import { parseHarvestInventory, parseCraftedItems, parseRareSeeds, serializeHarvestInventory, serializeCraftedItems, serializeRareSeeds } from './mascot/craft-engine';
import { parseWearEvents, serializeWearEvents } from './mascot/wear-engine';
import type { CompanionData, CompanionSpecies } from './mascot/companion-types';
import { calculateLevel } from './gamification';
import type { TreeSpecies } from './mascot/types';
import type { FamilyQuest } from './quest-types';
import { parseReward, serializeReward } from './quest-types';
import type { GuestProfile } from './dietary/types';

// ─── Task parsing ───────────────────────────────────────────────────────────

const TASK_REGEX = /^(\s*)-\s+\[([ xX])\]\s+(.+)$/;
const DUE_DATE_REGEX = /📅\s*(\d{4}-\d{2}-\d{2})/;
const COMPLETED_DATE_REGEX = /✅\s*(\d{4}-\d{2}-\d{2})/;
const RECURRENCE_REGEX = /🔁\s*(every\s+(?:\d+\s+)?(?:day|week|month)s?)/;
const REMINDER_TIME_REGEX = /⏰\s*(\d{2}:\d{2})/;
const TAG_REGEX = /#([a-zA-ZÀ-ÿ0-9_-]+)/g;
const MENTION_REGEX = /@([a-zA-ZÀ-ÿ0-9_-]+)/g;

function stripEmoji(text: string): string {
  return text
    .replace(/📅\s*\d{4}-\d{2}-\d{2}/g, '')
    .replace(/🔁\s*every\s+(?:\d+\s+)?(?:day|week|month)s?/g, '')
    .replace(/✅\s*\d{4}-\d{2}-\d{2}/g, '')
    .replace(/⏰\s*\d{2}:\d{2}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function parseTask(
  line: string,
  lineIndex: number,
  sourceFile: string,
  section?: string
): Task | null {
  const match = line.match(TASK_REGEX);
  if (!match) return null;

  const [, , checkmark, rawText] = match;
  const completed = checkmark.toLowerCase() === 'x';

  const dueMatch = rawText.match(DUE_DATE_REGEX);
  const completedMatch = rawText.match(COMPLETED_DATE_REGEX);
  const recurrenceMatch = rawText.match(RECURRENCE_REGEX);
  const reminderMatch = rawText.match(REMINDER_TIME_REGEX);

  const tags: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = TAG_REGEX.exec(rawText)) !== null) tags.push(m[1]);

  const mentions: string[] = [];
  while ((m = MENTION_REGEX.exec(rawText)) !== null) mentions.push(m[1]);

  const text = stripEmoji(rawText);

  return {
    id: `${sourceFile}:${lineIndex}`,
    text,
    completed,
    dueDate: dueMatch?.[1],
    completedDate: completedMatch?.[1],
    recurrence: recurrenceMatch?.[1],
    reminderTime: reminderMatch?.[1],
    tags,
    mentions,
    sourceFile,
    lineIndex,
    section,
  };
}

/** Parse all tasks from a file content. Groups by H2/H3 sections. */
export function parseTaskFile(relativePath: string, content: string): Task[] {
  const lines = content.split('\n');
  const tasks: Task[] = [];
  let currentSection: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ') || line.startsWith('### ')) {
      currentSection = line.replace(/^#{2,3}\s+/, '').trim();
    }
    const task = parseTask(line, i, relativePath, currentSection);
    if (task) tasks.push(task);
  }

  return tasks;
}

// ─── Frontmatter ────────────────────────────────────────────────────────────

/**
 * Manual YAML frontmatter parser — fallback for React Native
 * where gray-matter/js-yaml can fail on accented keys (médecin)
 * or quoted values.
 */
function manualParseFrontmatter(content: string): { data: Record<string, string>; content: string } {
  const trimmed = content.trim();
  if (!trimmed.startsWith('---')) return { data: {}, content };

  const secondDash = trimmed.indexOf('---', 3);
  if (secondDash === -1) return { data: {}, content };

  const yamlBlock = trimmed.slice(3, secondDash).trim();
  const body = trimmed.slice(secondDash + 3).trim();
  const data: Record<string, string> = {};

  for (const line of yamlBlock.split('\n')) {
    const raw = line.trim();
    // Skip empty lines, comments, array items (  - value), section headers
    if (!raw || raw.startsWith('#') || raw.startsWith('- ') || raw.startsWith('-\t')) continue;

    const colonIdx = raw.indexOf(':');
    if (colonIdx === -1) continue;

    const key = raw.slice(0, colonIdx).trim();
    let value = raw.slice(colonIdx + 1).trim();

    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key && value) {
      data[key] = value;
    }
  }

  return { data, content: body };
}

export function parseFrontmatter(content: string): { data: Record<string, string>; content: string } {
  // Try gray-matter first
  try {
    const parsed = matter(content);
    const data = parsed.data as Record<string, string>;
    // Verify it actually parsed something — if data is empty but content has frontmatter, fallback
    if (data && Object.keys(data).length > 0) {
      return { data, content: parsed.content };
    }
  } catch {
    // gray-matter failed, fall through to manual parser
  }

  // Fallback: manual parser (handles accented keys, React Native edge cases)
  return manualParseFrontmatter(content);
}

/**
 * Check if an RDV is upcoming (in the future or today but not yet past its time).
 * Compares date AND time for today's RDVs.
 */
export function isRdvUpcoming(rdv: { date_rdv: string; heure?: string; statut: string }): boolean {
  if (rdv.statut !== 'planifié') return false;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  if (rdv.date_rdv > todayStr) return true;   // future day → upcoming
  if (rdv.date_rdv < todayStr) return false;   // past day → not upcoming

  // Same day → check time
  if (!rdv.heure) return true; // no time set → consider still upcoming today

  const [h, m] = rdv.heure.split(':').map(Number);
  if (isNaN(h)) return true;

  const rdvMinutes = h * 60 + (m || 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return rdvMinutes > nowMinutes;
}

// ─── RDV ────────────────────────────────────────────────────────────────────

/**
 * Normalize a date value to YYYY-MM-DD string.
 * Handles: Date objects (from gray-matter YAML auto-parsing),
 *          DD/MM/YYYY strings, YYYY-MM-DD strings.
 */
function normalizeDateRdv(value: unknown): string {
  if (!value) return '';

  // If gray-matter parsed it as a Date object
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const s = String(value).trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  return s;
}

/**
 * Format a YYYY-MM-DD date to DD/MM/YYYY for display.
 */
export function formatDateForDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return dateStr;
}

/**
 * Parse a DD/MM/YYYY input to YYYY-MM-DD for storage.
 * Returns null if the format is invalid.
 */
export function parseDateInput(input: string): string | null {
  const trimmed = input.trim();

  // DD/MM/YYYY or DD-MM-YYYY
  let m = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (m) {
    const [, day, month, year] = m;
    const d = parseInt(day, 10);
    const mo = parseInt(month, 10);
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
    return `${year}-${month}-${day}`;
  }

  // Also accept YYYY-MM-DD for convenience
  m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return trimmed;

  return null;
}

/** Extract raw text content of a `## Section` from a markdown body. */
function extractBodySection(body: string, sectionTitle: string): string {
  const lines = body.split('\n');
  let inSection = false;
  const result: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (inSection) break;
      if (line.slice(3).trim() === sectionTitle) {
        inSection = true;
        continue;
      }
    } else if (inSection) {
      result.push(line);
    }
  }

  return result.join('\n').trim();
}

/** Parse bullet list items from a body section. */
function parseBulletSection(body: string, sectionTitle: string): string[] | undefined {
  const raw = extractBodySection(body, sectionTitle);
  if (!raw) return undefined;
  const items = raw
    .split('\n')
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter((q) => q.length > 0);
  return items.length > 0 ? items : undefined;
}

export function parseRDV(relativePath: string, content: string): RDV | null {
  const { data, content: body } = parseFrontmatter(content);
  if (!data.date_rdv) return null;

  const fileName = relativePath.split('/').pop()?.replace('.md', '') ?? '';

  return {
    title: fileName,
    date_rdv: normalizeDateRdv(data.date_rdv),
    heure: String(data.heure ?? ''),
    type_rdv: String(data.type_rdv ?? ''),
    enfant: String(data.enfant ?? ''),
    médecin: String(data.médecin ?? ''),
    lieu: String(data.lieu ?? ''),
    statut: (data.statut as RDV['statut']) ?? 'planifié',
    sourceFile: relativePath,
    questions: parseBulletSection(body, 'Questions à poser'),
    reponses: extractBodySection(body, 'Réponses du médecin') || undefined,
  };
}

/**
 * Serialize an RDV to markdown with frontmatter.
 * date_rdv is quoted to prevent gray-matter from parsing it as a Date.
 */
export function serializeRDV(rdv: Omit<RDV, 'sourceFile' | 'title'>): string {
  const displayDate = formatDateForDisplay(rdv.date_rdv);
  const lines = [
    '---',
    `date_rdv: "${rdv.date_rdv}"`,
    `heure: "${rdv.heure}"`,
    `type_rdv: ${rdv.type_rdv}`,
    `enfant: ${rdv.enfant}`,
    `médecin: ${rdv.médecin}`,
    `lieu: ${rdv.lieu}`,
    `statut: ${rdv.statut}`,
    'tags:',
    '  - rdv',
    '---',
    '',
    `# Rendez-vous — ${displayDate} ${rdv.type_rdv} ${rdv.enfant}`,
    '',
    '## Questions à poser',
    '',
  ];

  const validQuestions = (rdv.questions ?? []).filter((q) => q.trim().length > 0);
  for (const q of validQuestions) {
    lines.push(`- ${q}`);
  }

  lines.push('');
  lines.push('## Réponses du médecin');
  lines.push('');
  if (rdv.reponses?.trim()) {
    lines.push(rdv.reponses.trim());
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate a filename for an RDV
 */
export function rdvFileName(rdv: { date_rdv: string; type_rdv: string; enfant: string }): string {
  const enfantClean = rdv.enfant.replace(/\s+/g, '-');
  return `${rdv.date_rdv} ${rdv.type_rdv} ${enfantClean}.md`;
}

// ─── Courses ────────────────────────────────────────────────────────────────

/**
 * Parse Liste de courses.md
 *
 * Sample format:
 * ```
 * ## À acheter
 * - [ ] Pain
 * - [ ] Lait
 * - [x] Beurre
 * ```
 */
export function parseCourses(content: string, relativePath: string): CourseItem[] {
  const lines = content.split('\n');
  const items: CourseItem[] = [];
  let currentSection: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track section headers (## 🥩 Frais, etc.)
    if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim();
      continue;
    }

    const match = line.match(/^(\s*)-\s+\[([ xX])\]\s+(.+)$/);
    if (!match) continue;
    const text = match[3].trim();
    if (!text) continue; // skip empty items

    items.push({
      id: `${relativePath}:${i}`,
      text,
      completed: match[2].toLowerCase() === 'x',
      lineIndex: i,
      section: currentSection,
    });
  }

  return items;
}

// ─── Repas de la semaine ────────────────────────────────────────────────────

const MEAL_LINE_REGEX = /^-\s+(.+?):\s*(.*)$/;
const DAYS_ORDER = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/**
 * Parse Repas de la semaine.md
 *
 * Format:
 * ```
 * ## Lundi
 * - Déjeuner: Pâtes carbonara
 * - Dîner: Soupe de légumes [[Plats/Soupe de légumes]]
 * ```
 *
 * The optional [[...]] wiki-link references a recipe in 03 - Cuisine/Recettes/.
 */
export function parseMeals(content: string, sourceFile: string): MealItem[] {
  const lines = content.split('\n');
  const meals: MealItem[] = [];
  let currentDay: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      const day = line.replace('## ', '').trim();
      if (DAYS_ORDER.includes(day)) {
        currentDay = day;
      } else {
        currentDay = null;
      }
    } else if (currentDay) {
      const match = line.match(MEAL_LINE_REGEX);
      if (match) {
        const mealType = match[1].trim();
        let rawText = match[2].trim();

        // Extract optional [[recipe-ref]] wiki-link
        let recipeRef: string | undefined;
        const linkMatch = rawText.match(/\[\[(.+?)\]\]/);
        if (linkMatch) {
          recipeRef = linkMatch[1];
          rawText = rawText.replace(/\s*\[\[.+?\]\]/, '').trim();
        }

        meals.push({
          id: `${currentDay.toLowerCase()}:${mealType.toLowerCase()}`,
          day: currentDay,
          mealType,
          text: rawText,
          recipeRef,
          lineIndex: i,
          sourceFile,
        });
      }
    }
  }

  return meals;
}

/** Format a meal line for writing to the markdown file */
export function formatMealLine(mealType: string, text: string, recipeRef?: string): string {
  const base = `- ${mealType}: ${text}`;
  return recipeRef ? `${base} [[${recipeRef}]]` : base;
}

/**
 * Serialize meals back to Markdown.
 * Preserves the full file structure with frontmatter.
 */
export function serializeMeals(meals: MealItem[]): string {
  const byDay: Record<string, MealItem[]> = {};
  for (const meal of meals) {
    if (!byDay[meal.day]) byDay[meal.day] = [];
    byDay[meal.day].push(meal);
  }

  const sections = DAYS_ORDER
    .filter((day) => byDay[day])
    .map((day) => {
      const dayMeals = byDay[day]
        .map((m) => formatMealLine(m.mealType, m.text, m.recipeRef))
        .join('\n');
      return `## ${day}\n${dayMeals}`;
    })
    .join('\n\n');

  return `# Repas de la semaine\n\n${sections}\n`;
}

// ─── famille.md ─────────────────────────────────────────────────────────────

/**
 * Parse le champ companion d'un profil farm-{id}.md.
 * Format CSV : "activeSpecies:name:unlocked1|unlocked2"
 * Ancien format (backward compat) : "activeSpecies:name:unlocked1|unlocked2:mood" — la 4e partie (mood) est ignorée.
 * Retourne null si la valeur est vide ou invalide.
 */
export function parseCompanion(raw: string | undefined): CompanionData | null {
  if (!raw || !raw.trim()) return null;
  const parts = raw.trim().split(':');
  if (parts.length < 2) return null;
  const activeSpecies = parts[0] as CompanionSpecies;
  const name = parts[1] || '';
  const unlockedRaw = parts[2] || activeSpecies;
  // parts[3] (mood, ancien format) ignoré silencieusement pour backward compat
  return {
    activeSpecies,
    name,
    unlockedSpecies: unlockedRaw.split('|') as CompanionSpecies[],
  };
}

/**
 * Sérialise un CompanionData en chaîne CSV pour farm-{id}.md.
 * Format : "activeSpecies:name:unlocked1|unlocked2"
 */
export function serializeCompanion(data: CompanionData): string {
  const unlocked = data.unlockedSpecies.join('|');
  return `${data.activeSpecies}:${data.name}:${unlocked}`;
}

// ─── Phase 33 — Expeditions CSV ─────────────────────────────────────────────

/**
 * Parse le CSV des expeditions actives depuis farm-{profileId}.md.
 * Format par expedition : missionId:difficulty:ISO_startedAt:durationHours:result|...
 * ATTENTION : startedAt est une date ISO contenant des ':' — reconstruire via slice + join
 */
export function parseActiveExpeditions(csv: string | undefined): ActiveExpedition[] {
  if (!csv) return [];
  return csv.split('|').map(entry => {
    const parts = entry.trim().split(':');
    if (parts.length < 5) return null;
    const missionId = parts[0];
    const difficulty = parts[1] as ExpeditionDifficulty;
    const durationHours = parseInt(parts[parts.length - 2], 10);
    const resultRaw = parts[parts.length - 1] || undefined;
    const startedAt = parts.slice(2, parts.length - 2).join(':');
    if (!missionId || !startedAt || isNaN(durationHours)) return null;
    return {
      missionId,
      difficulty,
      startedAt,
      durationHours,
      result: resultRaw as ExpeditionOutcome | undefined,
    } as ActiveExpedition;
  }).filter((e): e is ActiveExpedition => e !== null);
}

/**
 * Sérialise le tableau d'expeditions actives en CSV pour farm-{profileId}.md.
 */
export function serializeActiveExpeditions(exps: ActiveExpedition[]): string {
  return exps.map(e =>
    `${e.missionId}:${e.difficulty}:${e.startedAt}:${e.durationHours}:${e.result ?? ''}`
    + (e.lootItemId ? `:${e.lootItemId}:${e.lootType ?? ''}` : '')
  ).join('|');
}

// ─── farm-{profileId}.md ────────────────────────────────────────────────────

/**
 * Parse le fichier farm-{profileId}.md.
 * Format : # Farm — {name}\n\nkey: value\nkey: value\n...
 * Un seul profil par fichier (pas de sections ### ).
 */
export function parseFarmProfile(content: string): FarmProfileData {
  const lines = content.split('\n');
  const props: Record<string, string> = {};
  for (const line of lines) {
    if (line.startsWith('#')) continue;
    if (!line.includes(': ')) continue;
    const colonIdx = line.indexOf(': ');
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 2).trim();
    if (key && val) props[key] = val;
  }

  const validSpecies = new Set(['cerisier', 'chene', 'bambou', 'oranger', 'palmier']);
  const treeSpecies = props.tree_species && validSpecies.has(props.tree_species)
    ? (props.tree_species as TreeSpecies)
    : undefined;

  const mascotDecorations = props.mascot_decorations
    ? props.mascot_decorations.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const mascotInhabitants = props.mascot_inhabitants
    ? props.mascot_inhabitants.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const mascotPlacements: Record<string, string> = {};
  if (props.mascot_placements) {
    props.mascot_placements.split(',').forEach((pair) => {
      const [slotId, itemId] = pair.split(':').map((s) => s.trim());
      if (slotId && itemId) mascotPlacements[slotId] = itemId;
    });
  }

  const farmTech = props.farm_tech
    ? props.farm_tech.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    gardenName: props.garden_name || undefined,
    treeSpecies,
    mascotDecorations,
    mascotInhabitants,
    mascotPlacements,
    farmCrops: props.farm_crops ?? '',
    farmBuildings: parseBuildings(props.farm_buildings),
    farmInventory: parseInventory(props.farm_inventory),
    harvestInventory: parseHarvestInventory(props.farm_harvest_inventory),
    craftedItems: parseCraftedItems(props.farm_crafted_items),
    farmTech,
    farmRareSeeds: parseRareSeeds(props.farm_rare_seeds),
    wearEvents: parseWearEvents(props.wear_events),
    companion: parseCompanion(props.companion),
    giftHistory: props.gift_history,
    giftsSentToday: props.gifts_sent_today,
    buildingTurboUntil: props.building_turbo_until || undefined,
    growthSprintUntil: props.growth_sprint_until || undefined,
    capacityBoostUntil: props.capacity_boost_until || undefined,
    nextHarvestGolden: props.next_harvest_golden === 'true',
    unlockedEffectRecipes: props.unlocked_effect_recipes
      ? props.unlocked_effect_recipes.split(',').map(s => s.trim()).filter(Boolean)
      : [],
    village_claimed_week: props.village_claimed_week || undefined,
    trade_claimed_codes: props.trade_claimed_codes
      ? props.trade_claimed_codes.split(',').map(s => s.trim()).filter(Boolean)
      : [],
    trade_sent_today: props.trade_sent_today || undefined,
    activeExpeditions: parseActiveExpeditions(props.active_expeditions),
    expeditionPity: props.expedition_pity ? parseInt(props.expedition_pity, 10) : 0,
    plotLevels: props.plot_levels
      ? props.plot_levels.split(',').map(s => parseInt(s, 10) || 1)
      : undefined,
    dailyDealPurchases: (() => {
      if (!props.daily_deal_purchases) return undefined;
      const parts = props.daily_deal_purchases.split('|');
      if (parts.length !== 3) return undefined;
      const [dateKey, itemId, countRaw] = parts.map(s => s.trim());
      const purchased = parseInt(countRaw, 10);
      if (!dateKey || !itemId || isNaN(purchased)) return undefined;
      return { dateKey, itemId, purchased };
    })(),
  };
}

/**
 * Sérialise les données ferme d'un profil en Markdown pour farm-{profileId}.md.
 * Format : # Farm — {profileName}\n\n{key: value lines}
 * Ne sérialise que les champs non-vides.
 */
export function serializeFarmProfile(profileName: string, data: FarmProfileData): string {
  const lines: string[] = [`# Farm — ${profileName}`, ''];

  if (data.gardenName) lines.push(`garden_name: ${data.gardenName}`);
  if (data.treeSpecies) lines.push(`tree_species: ${data.treeSpecies}`);
  if (data.mascotDecorations.length > 0) lines.push(`mascot_decorations: ${data.mascotDecorations.join(',')}`);
  if (data.mascotInhabitants.length > 0) lines.push(`mascot_inhabitants: ${data.mascotInhabitants.join(',')}`);
  const placementsStr = Object.entries(data.mascotPlacements ?? {}).map(([s, i]) => `${s}:${i}`).join(',');
  if (placementsStr) lines.push(`mascot_placements: ${placementsStr}`);
  if (data.farmCrops) lines.push(`farm_crops: ${data.farmCrops}`);
  if (data.farmBuildings && data.farmBuildings.length > 0) lines.push(`farm_buildings: ${serializeBuildings(data.farmBuildings)}`);
  if (data.farmInventory) {
    const invStr = serializeInventory(data.farmInventory);
    if (invStr) lines.push(`farm_inventory: ${invStr}`);
  }
  if (data.harvestInventory) {
    const harvestStr = serializeHarvestInventory(data.harvestInventory);
    if (harvestStr) lines.push(`farm_harvest_inventory: ${harvestStr}`);
  }
  if (data.craftedItems && data.craftedItems.length > 0) lines.push(`farm_crafted_items: ${serializeCraftedItems(data.craftedItems)}`);
  if (data.farmTech && data.farmTech.length > 0) lines.push(`farm_tech: ${data.farmTech.join(',')}`);
  if (data.farmRareSeeds) {
    const seedsStr = serializeRareSeeds(data.farmRareSeeds);
    if (seedsStr) lines.push(`farm_rare_seeds: ${seedsStr}`);
  }
  if (data.wearEvents && data.wearEvents.length > 0) lines.push(`wear_events: ${serializeWearEvents(data.wearEvents)}`);
  if (data.companion) lines.push(`companion: ${serializeCompanion(data.companion)}`);
  if (data.giftHistory) lines.push(`gift_history: ${data.giftHistory}`);
  if (data.giftsSentToday) lines.push(`gifts_sent_today: ${data.giftsSentToday}`);
  if (data.buildingTurboUntil) lines.push(`building_turbo_until: ${data.buildingTurboUntil}`);
  if (data.growthSprintUntil) lines.push(`growth_sprint_until: ${data.growthSprintUntil}`);
  if (data.capacityBoostUntil) lines.push(`capacity_boost_until: ${data.capacityBoostUntil}`);
  if (data.nextHarvestGolden) lines.push(`next_harvest_golden: true`);
  if (data.unlockedEffectRecipes && data.unlockedEffectRecipes.length > 0) {
    lines.push(`unlocked_effect_recipes: ${data.unlockedEffectRecipes.join(',')}`);
  }
  if (data.village_claimed_week) lines.push(`village_claimed_week: ${data.village_claimed_week}`);
  if (data.trade_claimed_codes && data.trade_claimed_codes.length > 0) {
    lines.push(`trade_claimed_codes: ${data.trade_claimed_codes.join(',')}`);
  }
  if (data.trade_sent_today) lines.push(`trade_sent_today: ${data.trade_sent_today}`);
  if (data.activeExpeditions && data.activeExpeditions.length > 0) {
    lines.push(`active_expeditions: ${serializeActiveExpeditions(data.activeExpeditions)}`);
  }
  if (data.expeditionPity && data.expeditionPity > 0) {
    lines.push(`expedition_pity: ${data.expeditionPity}`);
  }
  if (data.plotLevels && data.plotLevels.some(l => l > 1)) {
    lines.push(`plot_levels: ${data.plotLevels.join(',')}`);
  }
  if (data.dailyDealPurchases) {
    const { dateKey, itemId, purchased } = data.dailyDealPurchases;
    lines.push(`daily_deal_purchases: ${dateKey}|${itemId}|${purchased}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Parse une valeur brute en tableau de chaînes.
 * Gère le format CSV (`gluten,lait`) ET le format YAML liste (Array natif).
 * Échappement : `\,` = virgule littérale dans un item, `\\` = backslash littéral.
 * Permet aux items de contenir des virgules (ex: "lait, fromages au lait cru").
 * Utilisé par parseFamille (food_*) et parseInvites.
 */
function parseFoodCsv(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(v => String(v).trim()).filter(Boolean);
  if (typeof raw !== 'string') return [];
  const items: string[] = [];
  let buf = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '\\' && i + 1 < raw.length) {
      buf += raw[i + 1];
      i++;
      continue;
    }
    if (ch === ',') {
      items.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  items.push(buf.trim());
  return items.filter(Boolean);
}

/**
 * Sérialise un tableau d'items food_* en chaîne CSV échappée.
 * Échappe les backslashes et les virgules pour préserver les items multi-mots
 * contenant des virgules (ex: "lait, fromages au lait cru" reste 1 seul item).
 */
export function serializeFoodCsv(items: string[]): string {
  return items
    .map(s => s.replace(/\\/g, '\\\\').replace(/,/g, '\\,'))
    .join(',');
}

/**
 * Parse famille.md custom format:
 *
 * ```
 * ### papa
 * name: Papa
 * role: adulte
 * avatar: 👨‍💻
 * birthdate: 1990-01-01
 * ```
 */
export function parseFamille(content: string): Omit<Profile, 'points' | 'coins' | 'level' | 'streak' | 'lootBoxesAvailable' | 'multiplier' | 'multiplierRemaining' | 'pityCounter'>[] {
  const profiles: Omit<Profile, 'points' | 'coins' | 'level' | 'streak' | 'lootBoxesAvailable' | 'multiplier' | 'multiplierRemaining' | 'pityCounter'>[] = [];
  const lines = content.split('\n');
  let currentId: string | null = null;
  let currentProps: Record<string, string> = {};

  const flush = () => {
    if (currentId && currentProps.name && currentProps.role) {
      const theme = currentProps.theme && VALID_THEMES.has(currentProps.theme)
        ? (currentProps.theme as ProfileTheme)
        : undefined;
      const validAgeCategories = new Set(['bebe', 'petit', 'enfant', 'ado']);
      const ageCategory = currentProps.ageCategory && validAgeCategories.has(currentProps.ageCategory)
        ? (currentProps.ageCategory as Profile['ageCategory'])
        : undefined;
      const statut = currentProps.statut === 'grossesse' ? 'grossesse' as const : undefined;
      profiles.push({
        id: currentId,
        name: currentProps.name,
        role: currentProps.role as Profile['role'],
        avatar: currentProps.avatar ?? '👤',
        birthdate: currentProps.birthdate,
        ageCategory,
        propre: currentProps.propre === 'true',
        gender: isValidGender(currentProps.gender) ? currentProps.gender : undefined,
        statut,
        dateTerme: currentProps.dateTerme,
        theme,
        // ─── Voix TTS (IVC ElevenLabs + iOS Personal Voice) ───────────
        voiceElevenLabsId: currentProps.voiceElevenLabsId || undefined,
        voiceFishAudioId: currentProps.voiceFishAudioId || undefined,
        voicePersonalId: currentProps.voicePersonalId || undefined,
        voiceSource: (['ios-personal', 'elevenlabs-cloned', 'elevenlabs-preset', 'fish-audio-cloned', 'expo-speech'].includes(currentProps.voiceSource)
          ? (currentProps.voiceSource as Profile['voiceSource'])
          : undefined),
        // Farm/mascot/companion fields live in farm-{profileId}.md — defaults here
        treeSpecies: undefined,
        mascotDecorations: [],
        mascotInhabitants: [],
        mascotPlacements: {},
        farmCrops: '',
        farmBuildings: undefined,
        farmInventory: undefined,
        harvestInventory: undefined,
        craftedItems: undefined,
        farmTech: undefined,
        farmRareSeeds: undefined,
        wearEvents: undefined,
        // Préférences alimentaires (PREF-02) — lecture des 4 clés food_* depuis famille.md
        foodAllergies: parseFoodCsv(currentProps.food_allergies),
        foodIntolerances: parseFoodCsv(currentProps.food_intolerances),
        foodRegimes: parseFoodCsv(currentProps.food_regimes),
        foodAversions: parseFoodCsv(currentProps.food_aversions),
      });
    }
  };

  for (const line of lines) {
    if (line.startsWith('### ')) {
      flush();
      currentId = line.replace('### ', '').trim();
      currentProps = {};
    } else if (currentId && line.includes(': ')) {
      const colonIdx = line.indexOf(': ');
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 2).trim();
      currentProps[key] = val;
    }
  }
  flush();

  return profiles;
}

/**
 * Sérialise les profils en Markdown famille.md.
 * Écrit les 4 clés food_* UNIQUEMENT si non-vides (compatibilité Obsidian — PREF-05).
 * Format : sections ### {id} avec clés key: value.
 */
export function serializeFamille(
  profiles: Omit<Profile, 'points' | 'coins' | 'level' | 'streak' | 'lootBoxesAvailable' | 'multiplier' | 'multiplierRemaining' | 'pityCounter'>[]
): string {
  const sections: string[] = [];
  for (const profile of profiles) {
    const lines: string[] = [`### ${profile.id}`];
    lines.push(`name: ${profile.name}`);
    lines.push(`role: ${profile.role}`);
    lines.push(`avatar: ${profile.avatar}`);
    if (profile.birthdate) lines.push(`birthdate: ${profile.birthdate}`);
    if (profile.ageCategory) lines.push(`ageCategory: ${profile.ageCategory}`);
    if (profile.propre) lines.push(`propre: ${profile.propre}`);
    if (profile.gender) lines.push(`gender: ${profile.gender}`);
    if (profile.statut) lines.push(`statut: ${profile.statut}`);
    if (profile.dateTerme) lines.push(`dateTerme: ${profile.dateTerme}`);
    if (profile.theme) lines.push(`theme: ${profile.theme}`);
    // Voix TTS — omises si vides (lisibilité Obsidian)
    if (profile.voiceElevenLabsId) lines.push(`voiceElevenLabsId: ${profile.voiceElevenLabsId}`);
    if (profile.voiceFishAudioId) lines.push(`voiceFishAudioId: ${profile.voiceFishAudioId}`);
    if (profile.voicePersonalId) lines.push(`voicePersonalId: ${profile.voicePersonalId}`);
    if (profile.voiceSource) lines.push(`voiceSource: ${profile.voiceSource}`);
    if (profile.sagaTitle) lines.push(`sagaTitle: ${profile.sagaTitle}`);
    // Préférences alimentaires — omises si vides (lisibilité Obsidian)
    if (profile.foodAllergies && profile.foodAllergies.length > 0) {
      lines.push(`food_allergies: ${serializeFoodCsv(profile.foodAllergies)}`);
    }
    if (profile.foodIntolerances && profile.foodIntolerances.length > 0) {
      lines.push(`food_intolerances: ${serializeFoodCsv(profile.foodIntolerances)}`);
    }
    if (profile.foodRegimes && profile.foodRegimes.length > 0) {
      lines.push(`food_regimes: ${serializeFoodCsv(profile.foodRegimes)}`);
    }
    if (profile.foodAversions && profile.foodAversions.length > 0) {
      lines.push(`food_aversions: ${serializeFoodCsv(profile.foodAversions)}`);
    }
    sections.push(lines.join('\n'));
  }
  return sections.join('\n\n') + '\n';
}

// ─── gamification.md ────────────────────────────────────────────────────────

/**
 * Parse gamification.md custom format:
 *
 * ```
 * ## Papa
 * points: 150
 * level: 2
 * streak: 3
 * loot_boxes_available: 1
 * multiplier: 1
 * multiplier_remaining: 0
 * ```
 */
export function parseGamification(content: string): GamificationData {
  const lines = content.split('\n');
  const profiles: Profile[] = [];
  const history: GamificationEntry[] = [];
  const activeRewards: ActiveReward[] = [];
  const usedLoots: UsedLoot[] = [];

  let currentName: string | null = null;
  let currentProps: Record<string, string> = {};
  let inHistory = false;
  let inActiveRewards = false;
  let inUsedLoots = false;

  const RESERVED_SECTIONS = ['Journal des gains', 'Récompenses actives', 'Récompenses utilisées', 'Musée'];

  const flush = () => {
    if (currentName && !RESERVED_SECTIONS.includes(currentName)) {
      profiles.push({
        id: currentName.toLowerCase().replace(/\s+/g, ''),
        name: currentName,
        role: 'adulte',
        avatar: '👤',
        mascotDecorations: [],
        mascotInhabitants: [],
        mascotPlacements: {},
        points: parseInt(currentProps.points ?? '0', 10),
        coins: parseInt(currentProps.coins ?? currentProps.points ?? '0', 10),
        level: calculateLevel(parseInt(currentProps.points ?? '0', 10)),
        streak: parseInt(currentProps.streak ?? '0', 10),
        lootBoxesAvailable: parseInt(currentProps.loot_boxes_available ?? '0', 10),
        multiplier: parseFloat(currentProps.multiplier ?? '1'),
        multiplierRemaining: parseInt(currentProps.multiplier_remaining ?? '0', 10),
        pityCounter: parseInt(currentProps.pity_counter ?? '0', 10),
      });
    }
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush();
      currentName = line.replace('## ', '').trim();
      currentProps = {};
      inHistory = currentName === 'Journal des gains';
      inActiveRewards = currentName === 'Récompenses actives';
      inUsedLoots = currentName === 'Récompenses utilisées';
    } else if (inHistory && line.startsWith('- ')) {
      // Format: - 2026-03-06T10:30:00Z | Papa | +10 | Tâche: Ménage cuisine
      const parts = line.slice(2).split(' | ');
      if (parts.length >= 4) {
        const points = parts[2].startsWith('+') ? parseInt(parts[2].slice(1), 10) : 0;
        history.push({
          profileId: parts[1].trim().toLowerCase().replace(/\s+/g, ''),
          action: parts[2].trim(),
          points,
          note: parts[3].trim(),
          timestamp: parts[0].trim(),
        });
      }
    } else if (inActiveRewards && line.startsWith('- ')) {
      // Format: - id | profileId | type | emoji | label | expiresAt | remainingDays | remainingTasks
      const parts = line.slice(2).split(' | ');
      if (parts.length >= 5) {
        activeRewards.push({
          id: parts[0].trim(),
          profileId: parts[1].trim(),
          type: parts[2].trim() as RewardType,
          emoji: parts[3].trim(),
          label: parts[4].trim(),
          expiresAt: parts[5]?.trim() || undefined,
          remainingDays: parts[6]?.trim() ? parseInt(parts[6].trim(), 10) : undefined,
          remainingTasks: parts[7]?.trim() ? parseInt(parts[7].trim(), 10) : undefined,
        });
      }
    } else if (inUsedLoots && line.startsWith('- ')) {
      // Format: - {id} | {profileId} | {emoji} | {label} | {usedAt} | {earnedAt}
      const parts = line.slice(2).split(' | ');
      if (parts.length >= 6) {
        usedLoots.push({
          id: parts[0].trim(),
          profileId: parts[1].trim(),
          emoji: parts[2].trim(),
          label: parts[3].trim(),
          usedAt: parts[4].trim(),
          earnedAt: parts[5].trim(),
        });
      }
    } else if (currentName && !inHistory && !inActiveRewards && !inUsedLoots && line.includes(': ')) {
      const colonIdx = line.indexOf(': ');
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 2).trim();
      currentProps[key] = val;
    }
  }
  flush();

  return { profiles, history, activeRewards, usedLoots };
}

/**
 * Serialize gamification data back to Markdown string.
 * Called after any points/loot change.
 */
export function serializeGamification(data: GamificationData, museumSection?: string): string {
  const profileSections = data.profiles
    .map(
      (p) => `## ${p.name}
points: ${p.points}
coins: ${p.coins ?? p.points}
streak: ${p.streak}
loot_boxes_available: ${p.lootBoxesAvailable}
multiplier: ${p.multiplier}
multiplier_remaining: ${p.multiplierRemaining}
pity_counter: ${p.pityCounter ?? 0}`
    )
    .join('\n\n');

  const activeRewardLines = (data.activeRewards ?? [])
    .map(
      (r) =>
        `- ${r.id} | ${r.profileId} | ${r.type} | ${r.emoji} | ${r.label} | ${r.expiresAt ?? ''} | ${r.remainingDays ?? ''} | ${r.remainingTasks ?? ''}`
    )
    .join('\n');

  const historyLines = data.history
    .slice(-100) // keep last 100 entries
    .map(
      (h) =>
        `- ${h.timestamp} | ${h.profileId} | ${h.action} | ${h.note}`
    )
    .join('\n');

  const usedLootLines = (data.usedLoots ?? [])
    .map(
      (u) =>
        `- ${u.id} | ${u.profileId} | ${u.emoji} | ${u.label} | ${u.usedAt} | ${u.earnedAt}`
    )
    .join('\n');

  // Phase 23 : Préserver la section ## Musée si elle existait (MUSEUM-03)
  const museumSuffix = museumSection && museumSection.trim()
    ? `\n\n${museumSection.trim()}\n`
    : '';

  return `---
tags:
  - gamification
---
# Gamification

<!-- Family Vault — historique des points et loot boxes. Ne pas modifier manuellement. -->

${profileSections}

## Récompenses actives
${activeRewardLines}

## Récompenses utilisées
${usedLootLines}

## Journal des gains
${historyLines}${museumSuffix}`;
}

/**
 * Parse famille.md and gamification.md together into full Profile[].
 * gamification.md is the source of truth for points/level/streak.
 * famille.md provides name/role/avatar/birthdate.
 */
export function mergeProfiles(
  familleContent: string,
  gamiContent: string
): Profile[] {
  const baseProfiles = parseFamille(familleContent);
  const { profiles: gamiProfiles } = parseGamification(gamiContent);

  return baseProfiles.map((base) => {
    const gami = gamiProfiles.find((g) => g.name.toLowerCase().replace(/\s+/g, '') === base.id.toLowerCase());
    return {
      ...base,
      points: gami?.points ?? 0,
      coins: gami?.coins ?? gami?.points ?? 0,
      level: gami?.level ?? 1,
      streak: gami?.streak ?? 0,
      lootBoxesAvailable: gami?.lootBoxesAvailable ?? 0,
      multiplier: gami?.multiplier ?? 1,
      multiplierRemaining: gami?.multiplierRemaining ?? 0,
      pityCounter: gami?.pityCounter ?? 0,
    };
  });
}

// ─── Défis familiaux ────────────────────────────────────────────────────────

/**
 * Parse defis.md into Defi[].
 * Format: H2 per défi, key-value props, ### Progression section with entries.
 */
export function parseDefis(content: string): Defi[] {
  const lines = content.split('\n');
  const defis: Defi[] = [];
  let current: Record<string, string> | null = null;
  let currentTitle = '';
  let progress: DefiDayEntry[] = [];
  let inProgress = false;

  const flush = () => {
    if (current && current.id) {
      defis.push({
        id: current.id,
        title: currentTitle,
        description: current.description ?? '',
        type: (current.type ?? 'daily') as DefiType,
        startDate: current.startDate ?? '',
        endDate: current.endDate ?? '',
        targetDays: parseInt(current.targetDays ?? '7', 10),
        targetMetric: current.targetMetric ? parseInt(current.targetMetric, 10) : undefined,
        metricUnit: current.metricUnit || undefined,
        emoji: current.emoji ?? '🏅',
        difficulty: (current.difficulty ?? 'moyen') as 'facile' | 'moyen' | 'difficile',
        participants: current.participants ? current.participants.split(',').map((s) => s.trim()).filter(Boolean) : [],
        status: (current.status ?? 'active') as DefiStatus,
        progress,
        rewardPoints: parseInt(current.rewardPoints ?? '30', 10),
        rewardLootBoxes: parseInt(current.rewardLootBoxes ?? '0', 10),
        templateId: current.templateId || undefined,
      });
    }
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush();
      currentTitle = line.slice(3).trim();
      current = {};
      progress = [];
      inProgress = false;
    } else if (line.startsWith('### Progression')) {
      inProgress = true;
    } else if (line.startsWith('### ') || line.startsWith('## ')) {
      inProgress = false;
    } else if (inProgress && line.startsWith('- ')) {
      // Format: - 2026-03-10 | papa | true | 30 | Super journée
      const parts = line.slice(2).split(' | ');
      if (parts.length >= 3) {
        const entry: DefiDayEntry = {
          date: parts[0].trim(),
          profileId: parts[1].trim(),
          completed: parts[2].trim() === 'true',
          value: parts[3]?.trim() ? parseFloat(parts[3].trim()) || undefined : undefined,
          note: parts[4]?.trim() || undefined,
        };
        progress.push(entry);
      }
    } else if (current && !inProgress && line.includes(': ')) {
      const colonIdx = line.indexOf(': ');
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 2).trim();
      current[key] = val;
    }
  }
  flush();

  return defis;
}

/**
 * Serialize Defi[] back to Markdown string.
 */
export function serializeDefis(defis: Defi[]): string {
  const sections = defis.map((d) => {
    const props = [
      `id: ${d.id}`,
      `type: ${d.type}`,
      `emoji: ${d.emoji}`,
      `difficulty: ${d.difficulty}`,
      `startDate: ${d.startDate}`,
      `endDate: ${d.endDate}`,
      `targetDays: ${d.targetDays}`,
      ...(d.targetMetric !== undefined ? [`targetMetric: ${d.targetMetric}`] : []),
      ...(d.metricUnit ? [`metricUnit: ${d.metricUnit}`] : []),
      `participants: ${d.participants.join(',')}`,
      `status: ${d.status}`,
      `rewardPoints: ${d.rewardPoints}`,
      `rewardLootBoxes: ${d.rewardLootBoxes}`,
      ...(d.templateId ? [`templateId: ${d.templateId}`] : []),
      `description: ${d.description}`,
    ].join('\n');

    const progressLines = d.progress
      .map((p) => `- ${p.date} | ${p.profileId} | ${p.completed} | ${p.value ?? ''} | ${p.note ?? ''}`)
      .join('\n');

    return `## ${d.title}\n${props}\n\n### Progression\n${progressLines}`;
  });

  return `---\ntags:\n  - defis\n---\n# Défis familiaux\n\n${sections.join('\n\n')}
`;
}

// ─── Quêtes coopératives familiales ─────────────────────────────────────────

export const FAMILY_QUESTS_FILE = 'family-quests.md';

export interface FamilyQuestsMeta {
  activeEffect: { type: 'rain_bonus' | 'golden_rain' | 'production_boost'; expiresAt: string } | null;
  unlockedRecipes: string[];
  trophies: string[];
  unlockedDecorations: string[];
}

/**
 * Parse les champs meta de family-quests.md (lignes avant le premier ## heading).
 * Exemple : "activeEffect: rain_bonus:2026-04-08T12:00:00.000Z"
 */
export function parseFamilyQuestsMeta(content: string): FamilyQuestsMeta {
  const meta: FamilyQuestsMeta = { activeEffect: null, unlockedRecipes: [], trophies: [], unlockedDecorations: [] };
  for (const line of content.split('\n')) {
    if (line.startsWith('## ')) break;
    if (line.startsWith('activeEffect: ')) {
      const val = line.slice('activeEffect: '.length).trim();
      const idx = val.indexOf(':');
      if (idx !== -1) {
        const type = val.slice(0, idx) as FamilyQuestsMeta['activeEffect'] extends { type: infer T } | null ? T : never;
        meta.activeEffect = { type, expiresAt: val.slice(idx + 1) };
      }
    } else if (line.startsWith('unlockedRecipes: ')) {
      meta.unlockedRecipes = line.slice('unlockedRecipes: '.length).split(',').map(s => s.trim()).filter(Boolean);
    } else if (line.startsWith('trophies: ')) {
      meta.trophies = line.slice('trophies: '.length).split(',').map(s => s.trim()).filter(Boolean);
    } else if (line.startsWith('unlockedDecorations: ')) {
      meta.unlockedDecorations = line.slice('unlockedDecorations: '.length).split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return meta;
}

/** Retourne l'effet actif si non expiré, null sinon. */
export function getActiveQuestEffect(meta: FamilyQuestsMeta): FamilyQuestsMeta['activeEffect'] {
  if (!meta.activeEffect) return null;
  return new Date(meta.activeEffect.expiresAt) > new Date() ? meta.activeEffect : null;
}

/**
 * Parse family-quests.md en FamilyQuest[].
 * Format : H2 = titre quête, clés/valeurs ligne par ligne.
 * contributions: emma:5,lucas:4 → Record<string, number>
 */
export function parseFamilyQuests(content: string): FamilyQuest[] {
  const lines = content.split('\n');
  const quests: FamilyQuest[] = [];
  let current: Record<string, string> | null = null;
  let currentTitle = '';

  const flush = () => {
    if (current && current.id) {
      // Parse contributions: "emma:5,lucas:4" → Record<string, number>
      const contributions: Record<string, number> = {};
      if (current.contributions) {
        current.contributions.split(',').forEach((part) => {
          const colonIdx = part.indexOf(':');
          if (colonIdx !== -1) {
            const key = part.slice(0, colonIdx).trim();
            const val = parseInt(part.slice(colonIdx + 1).trim(), 10);
            if (key && !isNaN(val)) contributions[key] = val;
          }
        });
      }

      let farmReward;
      try {
        farmReward = parseReward(current.farmReward ?? 'loot_legendary:1');
      } catch {
        farmReward = { type: 'loot_legendary' as const, count: 1 };
      }

      quests.push({
        id: current.id,
        title: currentTitle,
        description: current.description ?? '',
        emoji: current.emoji ?? '🌾',
        type: (current.type ?? 'tasks') as FamilyQuest['type'],
        target: parseInt(current.target ?? '1', 10),
        current: parseInt(current.current ?? '0', 10),
        contributions,
        farmReward,
        status: (current.status ?? 'active') as FamilyQuest['status'],
        startDate: current.startDate ?? '',
        endDate: current.endDate ?? '',
        completedDate: current.completedDate || undefined,
      });
    }
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush();
      currentTitle = line.slice(3).trim();
      current = {};
    } else if (current && line.includes(': ')) {
      const colonIdx = line.indexOf(': ');
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 2).trim();
      current[key] = val;
    }
  }
  flush();

  return quests;
}

/**
 * Sérialise FamilyQuest[] en Markdown string.
 * Même pattern que serializeDefis.
 * meta optionnel ajoute des champs après le H1.
 */
export function serializeFamilyQuests(
  quests: FamilyQuest[],
  meta?: {
    activeEffect?: string;
    trophies?: string[];
    unlockedRecipes?: string[];
    unlockedDecorations?: string[];
  },
): string {
  const metaLines: string[] = [];
  if (meta?.activeEffect) metaLines.push(`activeEffect: ${meta.activeEffect}`);
  if (meta?.trophies?.length) metaLines.push(`trophies: ${meta.trophies.join(', ')}`);
  if (meta?.unlockedRecipes?.length) metaLines.push(`unlockedRecipes: ${meta.unlockedRecipes.join(', ')}`);
  if (meta?.unlockedDecorations?.length) metaLines.push(`unlockedDecorations: ${meta.unlockedDecorations.join(', ')}`);
  const metaBlock = metaLines.length > 0 ? '\n' + metaLines.join('\n') : '';

  const sections = quests.map((q) => {
    // Sérialiser contributions en "emma:5,lucas:4"
    const contributionStr = Object.entries(q.contributions)
      .map(([k, v]) => `${k}:${v}`)
      .join(',');

    const props = [
      `id: ${q.id}`,
      `emoji: ${q.emoji}`,
      `type: ${q.type}`,
      `target: ${q.target}`,
      `current: ${q.current}`,
      `contributions: ${contributionStr}`,
      `farmReward: ${serializeReward(q.farmReward)}`,
      `status: ${q.status}`,
      `startDate: ${q.startDate}`,
      `endDate: ${q.endDate}`,
      ...(q.completedDate ? [`completedDate: ${q.completedDate}`] : []),
      `description: ${q.description}`,
    ].join('\n');

    return `## ${q.title}\n${props}`;
  });

  return `---\ntags:\n  - quests\n---\n# Quetes familiales${metaBlock}\n\n${sections.join('\n\n')}\n`;
}

// ─── Gratitude familiale ────────────────────────────────────────────────────

export const GRATITUDE_FILE = '06 - Mémoires/Gratitude familiale.md';

/**
 * Parse le fichier Gratitude familiale.md en GratitudeDay[].
 * H2 = date (DD/MM/YYYY), H3 = 🙏 profil, texte libre entre H3.
 */
export function parseGratitude(content: string): GratitudeDay[] {
  const { content: body } = parseFrontmatter(content);
  const days: GratitudeDay[] = [];

  // Splitter par H2 (date)
  const dayBlocks = body.split(/^## /m).filter((b) => b.trim());

  for (const block of dayBlocks) {
    const lines = block.split('\n');
    const firstLine = lines[0].trim();

    // Extraire date DD/MM/YYYY
    const dateMatch = firstLine.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (!dateMatch) continue;
    const [, dd, mm, yyyy] = dateMatch;
    const dateISO = `${yyyy}-${mm}-${dd}`;

    // Splitter par H3 🙏
    const entries: GratitudeEntry[] = [];
    const entryBlocks = block.split(/^### 🙏 /m).slice(1);

    for (const entryBlock of entryBlocks) {
      const entryLines = entryBlock.split('\n');
      const profileName = entryLines[0]?.trim() ?? '';
      const text = entryLines
        .slice(1)
        .map((l) => l.trim())
        .filter((l) => l && l !== '---')
        .join('\n')
        .trim();

      if (!profileName) continue;

      const profileId = profileName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-');

      entries.push({ date: dateISO, profileId, profileName, text });
    }

    days.push({ date: dateISO, entries });
  }

  // Tri par date desc
  days.sort((a, b) => b.date.localeCompare(a.date));
  return days;
}

/**
 * Sérialise GratitudeDay[] en Markdown.
 */
export function serializeGratitude(days: GratitudeDay[]): string {
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));

  const parts: string[] = [];
  parts.push('---\ntags:\n  - gratitude\n---\n');
  parts.push('# Livre d\'or familial\n');

  for (let i = 0; i < sorted.length; i++) {
    const day = sorted[i];
    // YYYY-MM-DD → DD/MM/YYYY
    const [yyyy, mm, dd] = day.date.split('-');
    parts.push(`## ${dd}/${mm}/${yyyy}\n`);

    for (const entry of day.entries) {
      parts.push(`### 🙏 ${entry.profileName}`);
      parts.push(entry.text + '\n');
    }

    if (i < sorted.length - 1) {
      parts.push('---\n');
    }
  }

  return parts.join('\n');
}

// ─── Mots d'enfants ─────────────────────────────────────────────────────────

export const QUOTES_FILE = '06 - Mémoires/Mots d\'enfants.md';

/**
 * Parse le fichier Mots d'enfants (table markdown).
 * Format : | Date | Enfant | Citation | Contexte |
 */
export function parseQuotes(content: string, sourceFile: string = QUOTES_FILE): ChildQuote[] {
  const lines = content.split('\n');
  const quotes: ChildQuote[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Détecter le header de table
    if (line.startsWith('| Date')) { inTable = true; continue; }
    // Sauter le séparateur
    if (line.startsWith('| ---') || line.startsWith('|---')) continue;
    // Parser les lignes de données
    if (inTable && line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (cells.length < 3) continue;
      const [dateRaw, enfant, citation, contexte] = cells;
      // Date DD/MM/YYYY → YYYY-MM-DD
      const dateMatch = dateRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : dateRaw;
      if (!enfant || !citation) continue;
      quotes.push({
        date,
        enfant,
        citation,
        contexte: contexte || undefined,
        sourceFile,
        lineIndex: i,
      });
    } else if (inTable && !line.startsWith('|')) {
      inTable = false;
    }
  }

  return quotes.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Sérialise ChildQuote[] en Markdown.
 */
export function serializeQuotes(quotes: ChildQuote[]): string {
  const sorted = [...quotes].sort((a, b) => b.date.localeCompare(a.date));
  const parts: string[] = [];
  parts.push('---\ntags:\n  - mots-enfants\n---\n');
  parts.push('# Mots d\'enfants\n');
  parts.push('| Date | Enfant | Citation | Contexte |');
  parts.push('| --- | --- | --- | --- |');
  for (const q of sorted) {
    parts.push(`| ${formatDateForDisplay(q.date)} | ${q.enfant} | ${q.citation} | ${q.contexte || ''} |`);
  }
  return parts.join('\n') + '\n';
}

// ─── Météo des humeurs ──────────────────────────────────────────────────────

export const MOODS_FILE = '05 - Famille/Humeurs.md';

/**
 * Parse le fichier Humeurs (table markdown).
 * Format : | Date | Profil | Humeur | Note |
 */
export function parseMoods(content: string, sourceFile: string = MOODS_FILE): MoodEntry[] {
  const lines = content.split('\n');
  const entries: MoodEntry[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('| Date')) { inTable = true; continue; }
    if (line.startsWith('| ---') || line.startsWith('|---')) continue;
    if (inTable && line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (cells.length < 4) continue;
      const [dateRaw, profileId, profileName, levelStr, note] = cells;
      const dateMatch = dateRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : dateRaw;
      const level = parseInt(levelStr, 10);
      if (!profileId || !profileName || isNaN(level) || level < 1 || level > 5) continue;
      entries.push({
        date,
        profileId,
        profileName,
        level: level as MoodLevel,
        note: note || undefined,
        sourceFile,
        lineIndex: i,
      });
    } else if (inTable && !line.startsWith('|')) {
      inTable = false;
    }
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date) || a.profileName.localeCompare(b.profileName));
}

export function serializeMoods(entries: MoodEntry[]): string {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || a.profileName.localeCompare(b.profileName));
  const parts: string[] = [];
  parts.push('---\ntags:\n  - humeurs\n---\n');
  parts.push('# Météo des humeurs\n');
  parts.push('| Date | ID | Profil | Humeur | Note |');
  parts.push('| --- | --- | --- | --- | --- |');
  for (const e of sorted) {
    parts.push(`| ${formatDateForDisplay(e.date)} | ${e.profileId} | ${e.profileName} | ${e.level} | ${e.note || ''} |`);
  }
  return parts.join('\n') + '\n';
}

// ─── Journal grossesse ──────────────────────────────────────────────────────

export function pregnancyJournalPath(enfant: string): string {
  return `03 - Journal/Grossesse/${enfant}.md`;
}

export function parsePregnancyJournal(content: string, sourceFile: string): PregnancyWeekEntry[] {
  const lines = content.split('\n');
  const entries: PregnancyWeekEntry[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('| SA')) { inTable = true; continue; }
    if (line.startsWith('| ---') || line.startsWith('|---')) continue;
    if (inTable && line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (cells.length < 3) continue;
      const [weekStr, dateRaw, poidsStr, symptomes, notes] = cells;
      const week = parseInt(weekStr, 10);
      if (isNaN(week)) continue;
      const dateMatch = dateRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : dateRaw;
      const poids = poidsStr ? parseFloat(poidsStr) : undefined;
      entries.push({
        week,
        date,
        poids: poids && !isNaN(poids) ? poids : undefined,
        symptomes: symptomes || undefined,
        notes: notes || undefined,
        sourceFile,
        lineIndex: i,
      });
    } else if (inTable && !line.startsWith('|')) {
      inTable = false;
    }
  }

  return entries.sort((a, b) => a.week - b.week);
}

export function serializePregnancyJournal(entries: PregnancyWeekEntry[], enfant: string): string {
  const sorted = [...entries].sort((a, b) => a.week - b.week);
  const parts: string[] = [];
  parts.push('---\ntags:\n  - grossesse\n---\n');
  parts.push(`# Journal de grossesse — ${enfant}\n`);
  parts.push('| SA | Date | Poids (kg) | Symptômes | Notes |');
  parts.push('| --- | --- | --- | --- | --- |');
  for (const e of sorted) {
    parts.push(`| ${e.week} | ${formatDateForDisplay(e.date)} | ${e.poids ?? ''} | ${e.symptomes ?? ''} | ${e.notes ?? ''} |`);
  }
  return parts.join('\n') + '\n';
}

// ─── Wishlist / Idées cadeaux ────────────────────────────────────────────────

export const WISHLIST_FILE = '05 - Famille/Souhaits.md';

/**
 * Parse le fichier Souhaits.md en WishlistItem[].
 * H2 = profileName, chaque ligne : - [ ] texte | budget | occasion | notes | 🔒 achetéPar
 */
export function parseWishlist(content: string): WishlistItem[] {
  const { content: body } = parseFrontmatter(content);
  const items: WishlistItem[] = [];
  const lines = body.split('\n');

  let currentProfile = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Détecter les sections ## profileName
    const h2Match = line.match(/^## (.+)$/);
    if (h2Match) {
      currentProfile = h2Match[1].trim();
      continue;
    }

    if (!currentProfile) continue;

    // Ligne checkbox : - [ ] texte | ... | ... | ...
    const checkMatch = line.match(/^- \[([ xX])\] (.+)$/);
    if (!checkMatch) continue;

    const completed = checkMatch[1] !== ' ';
    const rest = checkMatch[2];

    // Split par |
    const parts = rest.split('|').map((p) => p.trim());
    const text = parts[0] || '';
    const budgetRaw = parts[1] || '';
    const occasionRaw = parts[2] || '';
    const notesAndBought = parts.slice(3).join('|').trim();

    // Extraire 🔒 achetéPar
    let bought = false;
    let boughtBy = '';
    let notes = notesAndBought;

    const boughtMatch = notesAndBought.match(/🔒\s*(.+)$/);
    if (boughtMatch) {
      bought = true;
      boughtBy = boughtMatch[1].trim();
      notes = notesAndBought.replace(/\|?\s*🔒\s*.+$/, '').trim();
    }

    // Extraire 🔗 URL
    let url = '';
    const urlMatch = notes.match(/🔗\s*(https?:\/\/\S+)/);
    if (urlMatch) {
      url = urlMatch[1].trim();
      notes = notes.replace(/🔗\s*https?:\/\/\S+/, '').trim();
    }

    // Normaliser budget
    let budget: WishBudget = '';
    if (budgetRaw.includes('💰💰💰')) budget = '💰💰💰';
    else if (budgetRaw.includes('💰💰')) budget = '💰💰';
    else if (budgetRaw.includes('💰')) budget = '💰';

    // Normaliser occasion
    let occasion: WishOccasion = '';
    if (occasionRaw.includes('🎂')) occasion = '🎂';
    else if (occasionRaw.includes('🎄')) occasion = '🎄';

    items.push({
      id: `wish_${i}`,
      text,
      budget,
      occasion,
      notes,
      url,
      bought,
      boughtBy,
      profileName: currentProfile,
      sourceFile: WISHLIST_FILE,
      lineIndex: i,
    });
  }

  return items;
}

/**
 * Sérialise WishlistItem[] en Markdown.
 */
export function serializeWishlist(items: WishlistItem[]): string {
  const parts: string[] = [];
  parts.push('---\ntags:\n  - souhaits\n---\n');
  parts.push('# Souhaits familiaux\n');

  // Grouper par profileName, préserver l'ordre d'apparition
  const profileOrder: string[] = [];
  const byProfile = new Map<string, WishlistItem[]>();
  for (const item of items) {
    if (!byProfile.has(item.profileName)) {
      profileOrder.push(item.profileName);
      byProfile.set(item.profileName, []);
    }
    byProfile.get(item.profileName)!.push(item);
  }

  for (const name of profileOrder) {
    parts.push(`## ${name}\n`);
    for (const item of byProfile.get(name)!) {
      const check = item.bought ? 'x' : ' ';
      const segments = [item.text];
      segments.push(item.budget || '');
      segments.push(item.occasion || '');

      // Notes + URL + bought
      let extra = item.notes || '';
      if (item.url) {
        extra = extra ? `${extra} 🔗 ${item.url}` : `🔗 ${item.url}`;
      }
      if (item.bought && item.boughtBy) {
        extra = extra ? `${extra} | 🔒 ${item.boughtBy}` : `🔒 ${item.boughtBy}`;
      }
      segments.push(extra);

      // Nettoyer les segments vides en fin
      while (segments.length > 1 && !segments[segments.length - 1]) {
        segments.pop();
      }

      parts.push(`- [${check}] ${segments.join(' | ')}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

// ─── Anniversaires ──────────────────────────────────────────────────────────

export const ANNIVERSAIRES_FILE = '01 - Famille/Anniversaires.md';

/**
 * Parse le fichier Anniversaires.md (table markdown) en Anniversary[].
 * Retourne [] si le contenu est vide ou inexistant.
 */
export function parseAnniversaries(content: string): Anniversary[] {
  if (!content || !content.trim()) return [];

  const lines = content.split('\n');
  const items: Anniversary[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Ne traiter que les lignes de table
    if (!line.startsWith('|')) continue;

    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;

    // Skip header et separator
    if (cells[0] === 'Nom' || cells[0].startsWith('---')) continue;

    const name = cells[0];
    if (!name) continue;

    const dateRaw = cells[1]?.trim() || '';
    // Valider le format MM-DD
    if (!/^\d{2}-\d{2}$/.test(dateRaw)) continue;

    const yearRaw = cells[2]?.trim() || '';
    const birthYear = yearRaw ? parseInt(yearRaw, 10) : undefined;

    const category = cells[3]?.trim() || undefined;
    const contactId = cells[4]?.trim() || undefined;
    const notes = cells[5]?.trim() || undefined;

    items.push({
      name,
      date: dateRaw,
      birthYear: birthYear && !isNaN(birthYear) ? birthYear : undefined,
      category: category || undefined,
      contactId: contactId || undefined,
      notes: notes || undefined,
      sourceFile: ANNIVERSAIRES_FILE,
    });
  }

  return items;
}

/**
 * Sérialise Anniversary[] en Markdown (header + table).
 */
export function serializeAnniversaries(anniversaries: Anniversary[]): string {
  const parts: string[] = [];
  parts.push('# Anniversaires\n');
  parts.push('| Nom | Date | Année | Catégorie | Contact ID | Notes |');
  parts.push('|-----|------|-------|-----------|------------|-------|');

  for (const a of anniversaries) {
    const row = [
      a.name,
      a.date,
      a.birthYear != null ? String(a.birthYear) : '',
      a.category || '',
      a.contactId || '',
      a.notes || '',
    ];
    parts.push(`| ${row.join(' | ')} |`);
  }

  parts.push('');
  return parts.join('\n');
}

// ─── Journal bébé ───────────────────────────────────────────────────────────

/** Check if a journal file exists for today */
export function todayJournalPath(enfant: string): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  return `03 - Journal/${enfant}/${today} ${enfant}.md`;
}

/** Journal path for an arbitrary date */
export function journalPathForDate(enfant: string, date: string): string {
  return `03 - Journal/${enfant}/${date} ${enfant}.md`;
}

/** Generate a new journal entry from template */
export function generateJournalTemplate(enfant: string, options?: { propre?: boolean }): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayDisplay = format(new Date(), 'dd/MM/yyyy');

  const couchesSection = options?.propre ? '' : `
## Couches
| Heure | Type | Notes |
| ----- | ---- | ----- |
`;

  return `---
date: ${today}
enfant: ${enfant}
tags:
  - journal-bebe
---

# Journal bébé — ${todayDisplay}

> ← [[00 - Dashboard/Dashboard|Dashboard]]

## Alimentation
| Heure | Type | Détail (ml) | Notes |
| ----- | ---- | ----------- | ----- |
${couchesSection}
## Sommeil
| Début | Fin | Durée | Notes |
| ----- | --- | ----- | ----- |

## Humeur & observations

> [!tip] Notez ici les moments marquants de la journée

## Médicaments / Soins
| Heure | Médicament | Dose | Notes |
| ----- | ---------- | ---- | ----- |
`;
}

// ─── Mode nuit — helpers alimentation ────────────────────────────────────────

import type { NightFeedEntry } from './types';

/** Parse les entrées Tétée/Biberon de la section Alimentation d'un journal */
export function parseNightFeeds(content: string, enfant: string = '', enfantId: string = ''): NightFeedEntry[] {
  const lines = content.split('\n');
  const entries: NightFeedEntry[] = [];
  let inAlimentation = false;

  for (const line of lines) {
    if (line.startsWith('## Alimentation')) { inAlimentation = true; continue; }
    if (line.startsWith('## ') && inAlimentation) break;
    if (!inAlimentation || !line.startsWith('|')) continue;

    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    if (cells[0] === 'Heure' || cells[0].startsWith('---')) continue;

    const heure = cells[0]; // "01:15"
    const type = cells[1];  // "Tétée" ou "Biberon"
    const detail = cells[2]; // "Gauche — 12 min" ou "120 ml — 8 min"
    const notes = cells[3] || '';

    if (type !== 'Tétée' && type !== 'Biberon') continue;

    const feedType = type === 'Tétée' ? 'allaitement' : 'biberon';
    const durationMatch = detail.match(/(\d+)\s*min/);
    const durationSeconds = durationMatch ? parseInt(durationMatch[1], 10) * 60 : 0;

    const entry: NightFeedEntry = {
      id: `feed-${heure}`,
      type: feedType as NightFeedEntry['type'],
      startedAt: heure,
      durationSeconds,
      enfant,
      enfantId,
    };

    if (feedType === 'allaitement') {
      if (detail.toLowerCase().includes('gauche')) entry.side = 'gauche';
      else if (detail.toLowerCase().includes('droit')) entry.side = 'droite';
    } else {
      const mlMatch = detail.match(/(\d+)\s*ml/);
      if (mlMatch) entry.volumeMl = parseInt(mlMatch[1], 10);
    }

    if (notes) entry.note = notes;
    entries.push(entry);
  }

  return entries;
}

/** Insère une ligne dans la table Alimentation du journal. Retourne le contenu modifié. */
export function insertAlimentationRow(
  content: string,
  heure: string,
  type: 'Tétée' | 'Biberon',
  detail: string,
  notes: string = '',
): string {
  const lines = content.split('\n');
  let insertIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## Alimentation')) {
      // Trouver la fin de la table (après le header + separator + lignes existantes)
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith('|')) {
          insertIndex = j + 1; // après cette ligne
        } else if (lines[j].trim() === '') {
          if (insertIndex === -1) insertIndex = j;
          break;
        } else {
          // Nouvelle section
          if (insertIndex === -1) insertIndex = j;
          break;
        }
      }
      break;
    }
  }

  if (insertIndex === -1) return content; // section non trouvée

  const row = `| ${heure} | ${type} | ${detail} | ${notes} |`;
  lines.splice(insertIndex, 0, row);
  return lines.join('\n');
}

// ─── Stock ──────────────────────────────────────────────────────────────────

/**
 * Parse Stock & fournitures.md
 *
 * Reads markdown tables with columns:
 * | Produit | Détail/Taille | Paquets restants | Seuil | Qté/achat |
 *
 * Skips "Matériel" section (no numeric quantity) and "À racheter" section.
 */
const STOCK_SKIP_SECTIONS = new Set(['Matériel', 'À racheter bientôt']);

export function parseStock(content: string): StockItem[] {
  const lines = content.split('\n');
  const items: StockItem[] = [];
  let currentEmplacement: EmplacementId = 'bebe'; // défaut rétrocompatible
  let currentSection: string | undefined;
  let skipSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Détection des headers de section
    if (line.startsWith('## ')) {
      const headerText = line.slice(3).trim();
      skipSection = STOCK_SKIP_SECTIONS.has(headerText);
      if (skipSection) continue;

      // Essayer de parser comme emplacement connu
      const parsed = parseEmplacementFromHeader(headerText);
      if (parsed) {
        currentEmplacement = parsed.emplacement;
        currentSection = parsed.section;
      } else if (LEGACY_BEBE_SECTIONS.has(headerText)) {
        // Rétrocompatibilité : anciens headers bébé
        currentEmplacement = 'bebe';
        currentSection = headerText;
      } else {
        // Header inconnu → placards par défaut
        currentEmplacement = 'placards';
        currentSection = headerText;
      }
      continue;
    }

    if (skipSection) continue;

    // Lignes de table : | col1 | col2 | col3 | col4 | col5 |
    if (!line.startsWith('|')) continue;

    // split('|') sans filter pour préserver les cellules vides (ex: détail vide)
    const rawCells = line.split('|');
    // Retirer la première et dernière cellule vide (avant/après les |)
    const cells = rawCells.slice(1, rawCells.length - 1).map((c) => c.trim());
    if (cells.length < 4) continue;

    // Ignorer les lignes d'en-tête et de séparation
    if (cells[0] === 'Produit' || cells[0].startsWith('---')) continue;

    const produit = cells[0];
    if (!produit) continue;

    const detail = cells[1] || undefined;
    const quantite = parseInt(cells[2], 10);
    const seuil = parseInt(cells[3], 10);

    // Ignorer les lignes où quantité ou seuil n'est pas un nombre
    if (isNaN(quantite) || isNaN(seuil)) continue;

    const rawQteAchat = cells[4] ? parseInt(cells[4], 10) : undefined;
    const qteAchat = rawQteAchat && !isNaN(rawQteAchat) ? rawQteAchat : 1;
    const trackedRaw = cells[5]?.trim().toLowerCase();
    const tracked = trackedRaw === 'non' || trackedRaw === 'no' ? false : true;

    items.push({
      produit,
      detail: detail || undefined,
      quantite,
      seuil,
      qteAchat,
      tracked,
      emplacement: currentEmplacement,
      section: currentSection,
      lineIndex: i,
    });
  }

  return items;
}

/**
 * Serialize a stock item as a markdown table row.
 */
export function serializeStockRow(item: Omit<StockItem, 'lineIndex'>): string {
  const trackedStr = item.tracked === false ? 'non' : '';
  return `| ${item.produit} | ${item.detail ?? ''} | ${item.quantite} | ${item.seuil} | ${item.qteAchat ?? ''} | ${trackedStr} |`;
}

/**
 * Extrait les noms de sections disponibles dans le fichier stock (hors sections ignorées).
 * Retourne les headers complets (ex: "Placards — Épicerie", "Frigo").
 */
export function parseStockSections(content: string): string[] {
  const sections: string[] = [];
  for (const line of content.split('\n')) {
    if (line.startsWith('## ')) {
      const name = line.slice(3).trim();
      if (!STOCK_SKIP_SECTIONS.has(name)) {
        sections.push(name);
      }
    }
  }
  return sections;
}

// ─── Souvenirs / Jalons ─────────────────────────────────────────────────────

const JALON_HEADER_REGEX = /^### (\d{4}-\d{2}-\d{2}) — (.+)$/;
const JALON_DESC_REGEX = /^\*(.+)\*$/;

const SECTION_TO_TYPE: Record<string, MemoryType> = {
  '🌟 Premières fois': 'premières-fois',
  '💛 Moments forts': 'moment-fort',
};

const TYPE_TO_SECTION: Record<MemoryType, string> = {
  'premières-fois': '🌟 Premières fois',
  'moment-fort': '💛 Moments forts',
};

/**
 * Parse a Jalons.md file into Memory entries.
 */
export function parseJalons(enfant: string, enfantId: string, content: string): Memory[] {
  const memories: Memory[] = [];
  const lines = content.split('\n');
  let currentType: MemoryType = 'moment-fort';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect section change
    if (line.startsWith('## ')) {
      const sectionName = line.slice(3).trim();
      if (SECTION_TO_TYPE[sectionName]) {
        currentType = SECTION_TO_TYPE[sectionName];
      }
      continue;
    }

    // Match entry header: ### YYYY-MM-DD — Titre
    const headerMatch = line.match(JALON_HEADER_REGEX);
    if (!headerMatch) continue;

    const date = headerMatch[1];
    const title = headerMatch[2].trim();

    // Look for description on next non-empty line
    let description = '';
    for (let j = i + 1; j < lines.length && j <= i + 3; j++) {
      const nextLine = lines[j].trim();
      if (!nextLine) continue;
      if (nextLine === '---') break;
      const descMatch = nextLine.match(JALON_DESC_REGEX);
      if (descMatch) {
        description = descMatch[1].trim();
      }
      break;
    }

    memories.push({ date, title, description, type: currentType, enfant, enfantId });
  }

  return memories;
}

/**
 * Serialize a memory entry to the Jalons.md markdown format.
 */
export function serializeJalonEntry(memory: Omit<Memory, 'enfant' | 'enfantId'>): string {
  const lines = [`### ${memory.date} — ${memory.title}`];
  if (memory.description) {
    lines.push(`*${memory.description}*`);
  }
  lines.push('');
  lines.push('---');
  return lines.join('\n');
}

/**
 * Remove a jalon entry from a Jalons.md content string.
 * Matches on date + title header. Returns updated content.
 */
export function removeJalonFromContent(
  content: string,
  memory: Omit<Memory, 'enfant' | 'enfantId'>
): string {
  const header = `### ${memory.date} — ${memory.title}`;
  const lines = content.split('\n');

  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === header) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return content;

  // Find end of entry: stop at next ### header, ## section, or EOF
  let endIdx = headerIdx + 1;
  while (endIdx < lines.length) {
    const trimmed = lines[endIdx].trim();
    if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) break;
    if (trimmed === '---') { endIdx++; break; }
    endIdx++;
  }
  // Skip one trailing blank line
  if (endIdx < lines.length && lines[endIdx].trim() === '') endIdx++;

  lines.splice(headerIdx, endIdx - headerIdx);
  return lines.join('\n');
}

/**
 * Update an existing jalon entry in a Jalons.md file.
 * Removes the old entry and inserts the new one (handles type/section changes).
 */
export function updateJalonInContent(
  content: string,
  oldMemory: Omit<Memory, 'enfant' | 'enfantId'>,
  newMemory: Omit<Memory, 'enfant' | 'enfantId'>
): string {
  const removed = removeJalonFromContent(content, oldMemory);
  return insertJalonInContent(removed, newMemory);
}

/**
 * Insert a new jalon entry into the correct section of a Jalons.md file.
 * Returns the updated content string.
 */
export function insertJalonInContent(
  content: string,
  memory: Omit<Memory, 'enfant' | 'enfantId'>
): string {
  const sectionTitle = TYPE_TO_SECTION[memory.type];
  const entry = serializeJalonEntry(memory);
  const lines = content.split('\n');

  // Find the section header
  let sectionIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === `## ${sectionTitle}`) {
      sectionIdx = i;
      break;
    }
  }

  if (sectionIdx === -1) {
    // Section doesn't exist — append it at the end
    lines.push('', `## ${sectionTitle}`, '', entry, '');
    return lines.join('\n');
  }

  // Skip empty lines after section header, then insert
  let insertIdx = sectionIdx + 1;
  while (insertIdx < lines.length && lines[insertIdx].trim() === '') {
    insertIdx++;
  }

  // Insert entry + blank line
  lines.splice(insertIdx, 0, entry, '');
  return lines.join('\n');
}

// ─── Journal adulte ──────────────────────────────────────────────────────────

/**
 * Path for today's adult/ado journal file (one file per day, like baby journal).
 */
export function todayAdultJournalPath(prenom: string): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  return `01 - Adultes/${prenom}/Journal/${today} ${prenom}.md`;
}

/** Adult journal path for an arbitrary date */
export function adultJournalPathForDate(prenom: string, date: string): string {
  return `01 - Adultes/${prenom}/Journal/${date} ${prenom}.md`;
}

/**
 * Generate a new adult/ado journal from template.
 * @param prenom - Prénom du profil adulte
 * @param options - Options du template (grossesse: true pour suivi grossesse)
 */
export function generateAdultJournalTemplate(prenom: string, options?: { grossesse?: boolean }): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayDisplay = format(new Date(), 'dd/MM/yyyy');

  if (options?.grossesse) {
    return `---
date: ${today}
profil: ${prenom}
tags:
  - journal-adulte
  - journal-grossesse
---

# Journal — ${prenom} — ${todayDisplay}

## 😴 Suivi Sommeil

> **Coucher**:
> **Lever**:
> **Qualité** (1-5):
> **Notes**:

## 🤒 Symptômes

1.

## 😊 Humeur & Observations

> Comment te sens-tu aujourd'hui ?

## 🎯 Objectifs
- [ ]

## 🙏 Gratitude

> [!tip] 3 choses positives aujourd'hui
`;
  }

  return `---
date: ${today}
profil: ${prenom}
tags:
  - journal-adulte
---

# Journal — ${prenom} — ${todayDisplay}

## 📝 Notes du jour

## 😊 Humeur

> Comment s'est passée la journée ?

## 🎯 Objectifs
- [ ]

## 🙏 Gratitude

> [!tip] 3 choses positives aujourd'hui
`;
}

// ─── Carnet de santé ──────────────────────────────────────────────────────────

/**
 * Parse un fichier Carnet de santé.md en HealthRecord.
 *
 * Format attendu :
 * ```
 * # Carnet de santé — Maxence
 *
 * ## Informations
 * - Groupe sanguin: A+
 * - Médecin: Dr. Martin — 01 23 45 67 89
 * - Pédiatre: Dr. Dupont — 01 98 76 54 32
 * - Urgences: 15 / 112
 *
 * ## Allergies
 * - Arachides
 * - Pollen
 *
 * ## Antécédents
 * - Varicelle (2025-06)
 *
 * ## Médicaments en cours
 * - Vitamine D 1000UI/jour
 *
 * ## Croissance
 * | Date | Poids (kg) | Taille (cm) | PC (cm) | Notes |
 * | ---- | ---------- | ----------- | ------- | ----- |
 * | 2026-03-01 | 12.5 | 85 | 48 | RAS |
 *
 * ## Vaccins
 * | Vaccin | Date | Dose | Notes |
 * | ------ | ---- | ---- | ----- |
 * | DTP | 2025-06-15 | 1ère dose | OK |
 * ```
 */
export function parseHealthRecord(enfant: string, enfantId: string, content: string): {
  enfant: string;
  enfantId: string;
  allergies: string[];
  antecedents: string[];
  medicamentsEnCours: string[];
  groupeSanguin?: string;
  contactMedecin?: string;
  contactPediatre?: string;
  contactUrgences?: string;
  croissance: { date: string; poids?: number; taille?: number; perimetre?: number; note?: string }[];
  vaccins: { nom: string; date: string; dose?: string; note?: string }[];
} {
  const lines = content.split('\n');
  let currentSection = '';

  const allergies: string[] = [];
  const antecedents: string[] = [];
  const medicamentsEnCours: string[] = [];
  let groupeSanguin: string | undefined;
  let contactMedecin: string | undefined;
  let contactPediatre: string | undefined;
  let contactUrgences: string | undefined;
  const croissance: { date: string; poids?: number; taille?: number; perimetre?: number; note?: string }[] = [];
  const vaccins: { nom: string; date: string; dose?: string; note?: string }[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim().toLowerCase();
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)/);

    if (currentSection === 'informations' && bulletMatch) {
      const text = bulletMatch[1].trim();
      if (text.toLowerCase().startsWith('groupe sanguin')) {
        groupeSanguin = text.split(':').slice(1).join(':').trim();
      } else if (text.toLowerCase().startsWith('médecin') || text.toLowerCase().startsWith('medecin')) {
        contactMedecin = text.split(':').slice(1).join(':').trim();
      } else if (text.toLowerCase().startsWith('pédiatre') || text.toLowerCase().startsWith('pediatre')) {
        contactPediatre = text.split(':').slice(1).join(':').trim();
      } else if (text.toLowerCase().startsWith('urgences')) {
        contactUrgences = text.split(':').slice(1).join(':').trim();
      }
      continue;
    }

    if (currentSection === 'allergies' && bulletMatch) {
      allergies.push(bulletMatch[1].trim());
      continue;
    }

    if (currentSection === 'antécédents' && bulletMatch) {
      antecedents.push(bulletMatch[1].trim());
      continue;
    }

    if ((currentSection === 'médicaments en cours' || currentSection === 'medicaments en cours') && bulletMatch) {
      medicamentsEnCours.push(bulletMatch[1].trim());
      continue;
    }

    // Parse table rows for croissance
    if (currentSection === 'croissance' && line.startsWith('|') && !line.includes('----') && !line.toLowerCase().includes('date')) {
      const cols = line.split('|').slice(1, -1).map(c => c.trim());
      if (cols.length >= 2) {
        const date = cols[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const poids = cols[1] ? parseFloat(cols[1]) : undefined;
        const taille = cols[2] ? parseFloat(cols[2]) : undefined;
        const perimetre = cols[3] ? parseFloat(cols[3]) : undefined;
        const note = cols[4] || undefined;
        croissance.push({
          date,
          poids: isNaN(poids!) ? undefined : poids,
          taille: isNaN(taille!) ? undefined : taille,
          perimetre: isNaN(perimetre!) ? undefined : perimetre,
          note,
        });
      }
      continue;
    }

    // Parse table rows for vaccins
    if (currentSection === 'vaccins' && line.startsWith('|') && !line.includes('----') && !line.toLowerCase().includes('vaccin')) {
      const cols = line.split('|').slice(1, -1).map(c => c.trim());
      if (cols.length >= 2) {
        const nom = cols[0];
        const date = cols[1];
        if (!nom || !date) continue;
        vaccins.push({
          nom,
          date,
          dose: cols[2] || undefined,
          note: cols[3] || undefined,
        });
      }
      continue;
    }
  }

  return {
    enfant,
    enfantId,
    allergies,
    antecedents,
    medicamentsEnCours,
    groupeSanguin,
    contactMedecin,
    contactPediatre,
    contactUrgences,
    croissance,
    vaccins,
  };
}

/**
 * Sérialise un HealthRecord en Markdown.
 */
export function serializeHealthRecord(record: {
  enfant: string;
  allergies: string[];
  antecedents: string[];
  medicamentsEnCours: string[];
  groupeSanguin?: string;
  contactMedecin?: string;
  contactPediatre?: string;
  contactUrgences?: string;
  croissance: { date: string; poids?: number; taille?: number; perimetre?: number; note?: string }[];
  vaccins: { nom: string; date: string; dose?: string; note?: string }[];
}): string {
  const lines: string[] = [];
  lines.push(`# Carnet de santé — ${record.enfant}`, '');

  // Informations
  lines.push('## Informations');
  if (record.groupeSanguin) lines.push(`- Groupe sanguin: ${record.groupeSanguin}`);
  if (record.contactMedecin) lines.push(`- Médecin: ${record.contactMedecin}`);
  if (record.contactPediatre) lines.push(`- Pédiatre: ${record.contactPediatre}`);
  if (record.contactUrgences) lines.push(`- Urgences: ${record.contactUrgences}`);
  lines.push('');

  // Allergies
  lines.push('## Allergies');
  if (record.allergies.length > 0) {
    for (const a of record.allergies) lines.push(`- ${a}`);
  } else {
    lines.push('*Aucune allergie connue*');
  }
  lines.push('');

  // Antécédents
  lines.push('## Antécédents');
  if (record.antecedents.length > 0) {
    for (const a of record.antecedents) lines.push(`- ${a}`);
  } else {
    lines.push('*Aucun antécédent*');
  }
  lines.push('');

  // Médicaments
  lines.push('## Médicaments en cours');
  if (record.medicamentsEnCours.length > 0) {
    for (const m of record.medicamentsEnCours) lines.push(`- ${m}`);
  } else {
    lines.push('*Aucun médicament*');
  }
  lines.push('');

  // Croissance
  lines.push('## Croissance');
  lines.push('| Date | Poids (kg) | Taille (cm) | PC (cm) | Notes |');
  lines.push('| ---- | ---------- | ----------- | ------- | ----- |');
  for (const g of record.croissance) {
    const poids = g.poids != null ? String(g.poids) : '';
    const taille = g.taille != null ? String(g.taille) : '';
    const pc = g.perimetre != null ? String(g.perimetre) : '';
    const note = g.note || '';
    lines.push(`| ${g.date} | ${poids} | ${taille} | ${pc} | ${note} |`);
  }
  lines.push('');

  // Vaccins
  lines.push('## Vaccins');
  lines.push('| Vaccin | Date | Dose | Notes |');
  lines.push('| ------ | ---- | ---- | ----- |');
  for (const v of record.vaccins) {
    lines.push(`| ${v.nom} | ${v.date} | ${v.dose || ''} | ${v.note || ''} |`);
  }
  lines.push('');

  return lines.join('\n');
}

// ─── Routines ─────────────────────────────────────────────────────────────────

/**
 * Parse un fichier Routines.md en liste de Routine.
 *
 * Format attendu :
 * ```
 * ## ☀️ Matin
 * - Se brosser les dents ~3min
 * - S'habiller ~5min
 *
 * ## 🌙 Soir
 * - Bain / douche ~15min
 * ```
 */
export function parseRoutines(content: string): { id: string; label: string; emoji: string; steps: { text: string; durationMinutes?: number }[]; profileId?: string; timeOfDay?: 'matin' | 'soir'; isVisual?: boolean }[] {
  type ParsedRoutine = { id: string; label: string; emoji: string; steps: { text: string; durationMinutes?: number }[]; profileId?: string; timeOfDay?: 'matin' | 'soir'; isVisual?: boolean };
  const routines: ParsedRoutine[] = [];
  const lines = content.split('\n');
  let current: ParsedRoutine | null = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current && current.steps.length > 0) routines.push(current);
      const headerText = line.slice(3).trim();
      // Séparer l'emoji du label
      const parts = headerText.split(/\s+/);
      const emoji = parts[0] || '📋';
      const rawLabel = parts.slice(1).join(' ') || headerText;

      // Extraire métadonnées optionnelles : "Matin — lucas [visuel]"
      const isVisual = /\[visuel\]/i.test(rawLabel);
      const cleanLabel = rawLabel.replace(/\s*\[visuel\]/i, '').trim();
      const metaMatch = cleanLabel.match(/^(.+?)\s*(?:—\s*(\w+))?\s*$/);
      const label = metaMatch ? metaMatch[1].trim() : cleanLabel;
      const profileId = metaMatch?.[2] || undefined;

      // Détecter timeOfDay depuis le label
      const labelLower = label.toLowerCase();
      const timeOfDay: 'matin' | 'soir' | undefined = labelLower.includes('matin') ? 'matin' : labelLower.includes('soir') ? 'soir' : undefined;

      const id = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
      current = { label, emoji, id, steps: [], ...(profileId && { profileId }), ...(timeOfDay && { timeOfDay }), ...(isVisual && { isVisual }) };
      continue;
    }

    if (current && /^[-*]\s+/.test(line)) {
      const stepText = line.replace(/^[-*]\s+/, '').trim();
      if (!stepText) continue;
      const timerMatch = stepText.match(/~(\d+)\s*min/i);
      const durationMinutes = timerMatch ? parseInt(timerMatch[1], 10) : undefined;
      const text = stepText.replace(/~\d+\s*min/i, '').trim();
      current.steps.push({ text, durationMinutes });
    }
  }

  if (current && current.steps.length > 0) routines.push(current);
  return routines;
}

/**
 * Sérialise des routines en contenu Markdown.
 */
export function serializeRoutines(routines: { emoji: string; label: string; steps: { text: string; durationMinutes?: number }[]; profileId?: string; isVisual?: boolean }[]): string {
  const lines = ['# Routines', ''];
  for (const routine of routines) {
    // Reconstruire le header avec métadonnées optionnelles
    let header = `## ${routine.emoji} ${routine.label}`;
    if (routine.profileId) header += ` — ${routine.profileId}`;
    if (routine.isVisual) header += ' [visuel]';
    lines.push(header);
    for (const step of routine.steps) {
      const timer = step.durationMinutes ? ` ~${step.durationMinutes}min` : '';
      lines.push(`- ${step.text}${timer}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ─── Notes & Articles ────────────────────────────────────────────────────────

export const NOTES_DIR = '08 - Notes';

/** Extrait le label sans emoji d'une catégorie (ex: "🏥 Santé" → "Santé") */
export function noteCategoryLabel(category: string): string {
  return category.replace(/^[^\w\s]*\s*/, '').trim() || category;
}

/** Génère un nom de fichier slug à partir du titre */
export function noteFileName(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // retirer accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')     // non-alphanum → tiret
    .replace(/^-+|-+$/g, '')          // trim tirets
    + '.md';
}

/** Parse une note markdown avec frontmatter */
export function parseNote(relativePath: string, content: string): Note | null {
  const { data, content: body } = parseFrontmatter(content);
  if (!data.title) return null;

  return {
    title: String(data.title),
    url: data.url ? String(data.url) : undefined,
    category: String(data.category ?? '📌 Divers'),
    created: String(data.created ?? ''),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    content: body.trim(),
    sourceFile: relativePath,
  };
}

/** Sérialise une note en markdown avec frontmatter YAML */
export function serializeNote(note: Omit<Note, 'sourceFile'>): string {
  const lines = [
    '---',
    `title: "${note.title.replace(/"/g, '\\"')}"`,
  ];

  if (note.url) {
    lines.push(`url: "${note.url}"`);
  }

  lines.push(`category: "${note.category}"`);
  lines.push(`created: "${note.created}"`);

  if (note.tags.length > 0) {
    lines.push('tags:');
    for (const tag of note.tags) {
      lines.push(`  - ${tag}`);
    }
  } else {
    lines.push('tags: []');
  }

  lines.push('---');
  lines.push('');
  lines.push(note.content);
  lines.push('');

  return lines.join('\n');
}

// ─── Love Notes (messages affectifs programmes — Phase 34) ──────────────────

/** Repertoire racine des love notes dans le vault (classement par destinataire) */
export const LOVENOTES_DIR = '03 - Famille/LoveNotes';

/**
 * Genere un nom de fichier slug a partir d'un timestamp createdAt ISO.
 * Format : YYYY-MM-DD-{suffix}.md ou suffix est le base36 des 9 caracteres HHMMSSmmm
 * (heure:minute:seconde:ms sans separateurs). Collision-safe a la milliseconde pres.
 * Ex: createdAt='2026-04-16T14:32:17.123' -> '2026-04-16-8bzn7f.md' (deterministe).
 */
export function loveNoteFileName(createdAt: string): string {
  const datePart = createdAt.slice(0, 10); // YYYY-MM-DD
  // Hash base36 des caracteres HH:mm:ss.mmm (9 chiffres apres slice+replace)
  const timePart = createdAt.slice(11).replace(/[:.]/g, '').slice(0, 9);
  const digits = timePart.padEnd(9, '0'); // garantit au moins 9 chiffres si ms manquant
  const suffix = Number(digits).toString(36);
  return `${datePart}-${suffix}.md`;
}

/**
 * Construit le chemin relatif complet d'une love note pour un destinataire donne.
 * Pattern : 03 - Famille/LoveNotes/{toProfileId}/{YYYY-MM-DD-suffix}.md (LOVE-01).
 */
export function loveNotePath(toProfileId: string, createdAt: string): string {
  return `${LOVENOTES_DIR}/${toProfileId}/${loveNoteFileName(createdAt)}`;
}

/**
 * Parse une love note markdown avec frontmatter YAML.
 * Retourne null si un champ requis manque ou si le statut est invalide.
 */
export function parseLoveNote(relativePath: string, content: string): LoveNote | null {
  const { data, content: body } = parseFrontmatter(content);

  // Validation stricte — tous les champs requis doivent etre presents
  if (!data.from || !data.to || !data.createdAt || !data.revealAt || !data.status) return null;

  const status = String(data.status);
  if (status !== 'pending' && status !== 'revealed' && status !== 'read' && status !== 'archived') return null;

  return {
    from: String(data.from),
    to: String(data.to),
    createdAt: String(data.createdAt),
    revealAt: String(data.revealAt),
    status: status as LoveNoteStatus,
    readAt: data.readAt ? String(data.readAt) : undefined,
    body: body.trim(),
    sourceFile: relativePath,
  };
}

/**
 * Serialise une love note en markdown avec frontmatter YAML propre.
 * Construction manuelle (PAS matter.stringify — Pitfall: coerce les dates ISO en Date).
 * readAt n'est emis que si defini (pas de string 'undefined' literal — Pitfall 7).
 */
export function serializeLoveNote(note: Omit<LoveNote, 'sourceFile'>): string {
  const lines = [
    '---',
    `from: "${note.from}"`,
    `to: "${note.to}"`,
    `createdAt: "${note.createdAt}"`,
    `revealAt: "${note.revealAt}"`,
    `status: "${note.status}"`,
  ];
  if (note.readAt) {
    lines.push(`readAt: "${note.readAt}"`);
  }
  lines.push('---');
  lines.push('');
  lines.push(note.body);
  lines.push('');
  return lines.join('\n');
}

// ─── Arbre de compétences ───────────────────────────────────────────────────

export const SKILLS_DIR = '08 - Compétences';

/** Parse un fichier compétences enfant (pipe-delimited) */
export function parseSkillTree(content: string): SkillTreeData {
  const { data } = parseFrontmatter(content);
  const profileId = String(data.profil ?? '');
  const profileName = String(data.nom ?? profileId);

  const unlocked: SkillUnlock[] = [];
  let inUnlocked = false;

  for (const line of content.split('\n')) {
    if (line.startsWith('## Compétences débloquées')) {
      inUnlocked = true;
      continue;
    }
    if (line.startsWith('## ') && inUnlocked) break;

    if (inUnlocked && line.startsWith('- ')) {
      const parts = line.slice(2).split('|').map((c) => c.trim());
      if (parts.length >= 3) {
        unlocked.push({
          skillId: parts[0],
          unlockedAt: parts[1],
          unlockedBy: parts[2],
        });
      }
    }
  }

  return { profileId, profileName, unlocked };
}

/** Sérialise les données compétences en markdown */
export function serializeSkillTree(data: SkillTreeData): string {
  const unlockLines = data.unlocked
    .map((u) => `- ${u.skillId} | ${u.unlockedAt} | ${u.unlockedBy}`)
    .join('\n');

  return `---
tags:
  - competences
profil: ${data.profileId}
nom: ${data.profileName}
---
# Arbre de compétences — ${data.profileName}

## Compétences débloquées
${unlockLines}
`;
}

// ─── Missions secrètes ──────────────────────────────────────────────────────

export const SECRET_MISSIONS_FILE = '05 - Famille/Missions secrètes.md';

/**
 * Parse le fichier Missions secrètes.
 *
 * Format attendu :
 * ## {profileId}
 * - [ ] Mission texte 📅2026-03-21
 * - [p] Mission pending 📅2026-03-20
 * - [x] Mission validée ✅2026-03-19
 */
export function parseSecretMissions(content: string, sourceFile: string = SECRET_MISSIONS_FILE): Task[] {
  const lines = content.split('\n');
  const missions: Task[] = [];
  let currentProfileId: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Détecter les sections ## profileId
    if (line.startsWith('## ')) {
      currentProfileId = line.replace(/^##\s+/, '').trim();
      continue;
    }

    if (!currentProfileId) continue;

    // Parser les missions : - [ ], - [p], - [x]
    const missionMatch = line.match(/^-\s+\[([xXp ])\]\s+(.+)$/);
    if (!missionMatch) continue;

    const [, checkmark, rawText] = missionMatch;

    let secretStatus: 'active' | 'pending' | 'validated';
    let completed = false;
    if (checkmark.toLowerCase() === 'x') {
      secretStatus = 'validated';
      completed = true;
    } else if (checkmark === 'p') {
      secretStatus = 'pending';
    } else {
      secretStatus = 'active';
    }

    // Extraire la date de création (📅YYYY-MM-DD)
    const dateMatch = rawText.match(/📅(\d{4}-\d{2}-\d{2})/);
    const dueDate = dateMatch?.[1];

    // Extraire la date de validation (✅YYYY-MM-DD)
    const completedMatch = rawText.match(/✅(\d{4}-\d{2}-\d{2})/);
    const completedDate = completedMatch?.[1];

    // Nettoyer le texte (enlever les marqueurs de date)
    const text = rawText
      .replace(/📅\d{4}-\d{2}-\d{2}/, '')
      .replace(/✅\d{4}-\d{2}-\d{2}/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    missions.push({
      id: `${sourceFile}:${i}`,
      text,
      completed,
      dueDate,
      completedDate,
      tags: [],
      mentions: [],
      sourceFile,
      lineIndex: i,
      section: currentProfileId,
      secret: true,
      targetProfileId: currentProfileId,
      secretStatus,
    });
  }

  return missions;
}

/**
 * Sérialise les missions secrètes en Markdown, groupées par targetProfileId.
 */
export function serializeSecretMissions(missions: Task[], profiles: Profile[]): string {
  const parts: string[] = [];
  parts.push('# Missions secrètes\n');

  // Grouper par targetProfileId
  const grouped = new Map<string, Task[]>();
  for (const m of missions) {
    const pid = m.targetProfileId ?? 'inconnu';
    if (!grouped.has(pid)) grouped.set(pid, []);
    grouped.get(pid)!.push(m);
  }

  // Trier les profils dans l'ordre des profiles fournis, puis les inconnus
  const profileOrder = profiles.map(p => p.id);
  const sortedKeys = [...grouped.keys()].sort((a, b) => {
    const ia = profileOrder.indexOf(a);
    const ib = profileOrder.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  for (const profileId of sortedKeys) {
    const profileMissions = grouped.get(profileId)!;
    parts.push(`## ${profileId}`);

    for (const m of profileMissions) {
      let checkbox: string;
      if (m.secretStatus === 'validated') {
        checkbox = '[x]';
      } else if (m.secretStatus === 'pending') {
        checkbox = '[p]';
      } else {
        checkbox = '[ ]';
      }

      let line = `- ${checkbox} ${m.text}`;
      if (m.dueDate) line += ` 📅${m.dueDate}`;
      if (m.completedDate) line += ` ✅${m.completedDate}`;
      parts.push(line);
    }

    parts.push('');
  }

  return parts.join('\n');
}

// ─── Invités récurrents ──────────────────────────────────────────────────────

/** Chemin du fichier invités dans le vault. */
export const INVITES_FILE = '02 - Famille/Invités.md';

/**
 * Slugifie un nom pour générer un ID stable : lowercase, accents → base ASCII,
 * espaces et caractères spéciaux → underscore.
 */
function slugifyInviteName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // supprimer les diacritiques
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Parse `02 - Famille/Invités.md` en tableau de GuestProfile.
 * Format : sections H2 (## Nom) avec clés key: value sous chaque section.
 * Utilise parseFoodCsv pour les 4 clés food_* (CSV et YAML liste supportés).
 */
export function parseInvites(content: string): GuestProfile[] {
  const guests: GuestProfile[] = [];
  if (!content || !content.trim()) return [];

  const lines = content.split('\n');
  let currentName: string | null = null;
  let currentProps: Record<string, string> = {};
  const usedIds = new Map<string, number>();

  const flush = () => {
    if (!currentName) return;
    // Générer un ID unique depuis le nom
    const baseId = slugifyInviteName(currentName);
    const count = (usedIds.get(baseId) ?? 0) + 1;
    usedIds.set(baseId, count);
    const id = count === 1 ? baseId : `${baseId}_${count}`;

    guests.push({
      id,
      name: currentName,
      foodAllergies: parseFoodCsv(currentProps.food_allergies),
      foodIntolerances: parseFoodCsv(currentProps.food_intolerances),
      foodRegimes: parseFoodCsv(currentProps.food_regimes),
      foodAversions: parseFoodCsv(currentProps.food_aversions),
    });
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush();
      currentName = line.slice(3).trim();
      currentProps = {};
    } else if (currentName && line.includes(': ')) {
      const colonIdx = line.indexOf(': ');
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 2).trim();
      currentProps[key] = val;
    }
  }
  flush();

  return guests;
}

/**
 * Sérialise un tableau de GuestProfile en Markdown pour `02 - Famille/Invités.md`.
 * Omet les clés food_* vides (compatibilité Obsidian).
 */
export function serializeInvites(guests: GuestProfile[]): string {
  const parts: string[] = ['# Invités récurrents', ''];

  for (const guest of guests) {
    const lines: string[] = [`## ${guest.name}`];
    if (guest.foodAllergies.length > 0) {
      lines.push(`food_allergies: ${serializeFoodCsv(guest.foodAllergies)}`);
    }
    if (guest.foodIntolerances.length > 0) {
      lines.push(`food_intolerances: ${serializeFoodCsv(guest.foodIntolerances)}`);
    }
    if (guest.foodRegimes.length > 0) {
      lines.push(`food_regimes: ${serializeFoodCsv(guest.foodRegimes)}`);
    }
    if (guest.foodAversions.length > 0) {
      lines.push(`food_aversions: ${serializeFoodCsv(guest.foodAversions)}`);
    }
    parts.push(lines.join('\n'));
    parts.push('');
  }

  return parts.join('\n');
}

// ─── Histoires du soir ──────────────────────────────────────────────────────

export function serializeBedtimeStory(story: BedtimeStory): string {
  const lines: string[] = [
    '---',
    `title: ${story.titre}`,
    `enfant: ${story.enfant}`,
    `enfant_id: ${story.enfantId}`,
    `univers: ${story.univers}`,
  ];
  if (story.detail) lines.push(`detail: "${story.detail.replace(/"/g, "'")}"`);
  lines.push(
    `date: ${story.date}`,
    `duree_lecture: ${story.duree_lecture}`,
    `voice_engine: ${story.voice.engine}`,
    `voice_language: ${story.voice.language}`,
  );
  if (story.voice.elevenLabsVoiceId) lines.push(`voice_id: ${story.voice.elevenLabsVoiceId}`);
  if (story.voice.fishAudioReferenceId) lines.push(`fish_audio_ref: ${story.voice.fishAudioReferenceId}`);
  if (story.length) lines.push(`length: ${story.length}`);
  lines.push(
    `version: ${story.version}`,
    '---',
    '',
    `# ${story.titre}`,
    '',
    story.texte,
    '',
  );
  return lines.join('\n');
}

/**
 * Parseur frontmatter minimal pour BedtimeStory — évite gray-matter qui crash
 * sous Hermes (Property 'Buffer' doesn't exist). Le format BedtimeStory est
 * strictement `key: value` ligne par ligne, sans structures imbriquées.
 */
function parseStoryFrontmatter(content: string): { data: Record<string, string>; body: string } | null {
  if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) return null;
  const afterFirst = content.indexOf('\n', 3) + 1;
  const endIdx = content.indexOf('\n---', afterFirst);
  if (endIdx === -1) return null;

  const yamlBlock = content.slice(afterFirst, endIdx);
  // Saute le marker fermant + son retour ligne éventuel
  const bodyStart = content.indexOf('\n', endIdx + 4);
  const body = bodyStart === -1 ? '' : content.slice(bodyStart + 1);

  const data: Record<string, string> = {};
  for (const rawLine of yamlBlock.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1).replace(/\\'/g, "'");
    }
    data[key] = value;
  }

  return { data, body };
}

export function parseBedtimeStory(sourceFile: string, content: string): BedtimeStory | null {
  try {
    const parsed = parseStoryFrontmatter(content);
    if (!parsed) {
      if (__DEV__) console.warn(`[parseBedtimeStory] ${sourceFile} — frontmatter absent ou malformé`);
      return null;
    }
    const d = parsed.data;
    if (!d.title || !d.enfant || !d.univers || !d.date) {
      if (__DEV__) {
        console.warn(`[parseBedtimeStory] ${sourceFile} — champs manquants:`, {
          title: d.title,
          enfant: d.enfant,
          univers: d.univers,
          date: d.date,
          toutesLesCles: Object.keys(d),
        });
      }
      return null;
    }
    const engine = d.voice_engine === 'elevenlabs' ? 'elevenlabs'
      : d.voice_engine === 'fish-audio' ? 'fish-audio'
      : 'expo-speech';
    const voiceConfig: StoryVoiceConfig = {
      engine: engine as StoryVoiceConfig['engine'],
      language: (d.voice_language === 'en' ? 'en' : 'fr') as 'fr' | 'en',
      elevenLabsVoiceId: d.voice_id || undefined,
      fishAudioReferenceId: d.fish_audio_ref || undefined,
    };
    const validLengths = new Set(['courte', 'moyenne', 'longue', 'tres-longue']);
    const length = d.length && validLengths.has(d.length)
      ? (d.length as import('./types').StoryLength)
      : undefined;
    return {
      id: `${d.date}-${d.univers}`,
      titre: d.title,
      enfant: d.enfant,
      enfantId: d.enfant_id || d.enfant.toLowerCase().replace(/\s+/g, '_'),
      univers: d.univers as StoryUniverseId,
      detail: d.detail || undefined,
      texte: parsed.body.replace(/^#[^\n]*\n+/, '').trim(),
      date: d.date,
      duree_lecture: Number(d.duree_lecture || 0),
      voice: voiceConfig,
      length,
      version: Number(d.version || 1),
      sourceFile,
    };
  } catch (e) {
    if (__DEV__) console.warn(`[parseBedtimeStory] ${sourceFile} — exception:`, e);
    return null;
  }
}
