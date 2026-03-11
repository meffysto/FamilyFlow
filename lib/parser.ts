/**
 * parser.ts — Markdown & YAML frontmatter parsers
 *
 * Handles all coffre vault formats:
 * - Obsidian Tasks plugin format: - [ ] Text 🔁 every day 📅 YYYY-MM-DD
 * - RDV frontmatter (gray-matter)
 * - Courses checkboxes
 * - Ménage hebdo sections by day
 * - Journal bébé tables
 * - famille.md / gamification.md custom formats
 */

import matter from 'gray-matter';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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
} from './types';
import { VALID_THEMES, type ProfileTheme } from '../constants/themes';

// ─── Task parsing ───────────────────────────────────────────────────────────

const TASK_REGEX = /^(\s*)-\s+\[([ xX])\]\s+(.+)$/;
const DUE_DATE_REGEX = /📅\s*(\d{4}-\d{2}-\d{2})/;
const COMPLETED_DATE_REGEX = /✅\s*(\d{4}-\d{2}-\d{2})/;
const RECURRENCE_REGEX = /🔁\s*(every\s+(?:\d+\s+)?(?:day|week|month)s?)/;
const TAG_REGEX = /#([a-zA-ZÀ-ÿ0-9_-]+)/g;
const MENTION_REGEX = /@([a-zA-ZÀ-ÿ0-9_-]+)/g;

function stripEmoji(text: string): string {
  return text
    .replace(/📅\s*\d{4}-\d{2}-\d{2}/g, '')
    .replace(/🔁\s*every\s+(?:\d+\s+)?(?:day|week|month)s?/g, '')
    .replace(/✅\s*\d{4}-\d{2}-\d{2}/g, '')
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

/** Parse ménage hebdo tasks for today's day of week */
export function parseMénage(content: string, relativePath: string): Task[] {
  const today = new Date();
  const dayName = format(today, 'EEEE', { locale: fr });
  // Capitalize first letter to match section headers like "Lundi — Cuisine"
  const dayCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);

  const lines = content.split('\n');
  const tasks: Task[] = [];
  let inTodaySection = false;
  let currentSection: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ') || line.startsWith('### ')) {
      const sectionName = line.replace(/^#{2,3}\s+/, '').trim();
      inTodaySection = sectionName.startsWith(dayCapitalized);
      currentSection = sectionName;
    }
    if (inTodaySection) {
      const task = parseTask(line, i, relativePath, currentSection);
      if (task) tasks.push(task);
    }
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
export function parseFamille(content: string): Omit<Profile, 'points' | 'level' | 'streak' | 'lootBoxesAvailable' | 'multiplier' | 'multiplierRemaining' | 'pityCounter'>[] {
  const profiles: Omit<Profile, 'points' | 'level' | 'streak' | 'lootBoxesAvailable' | 'multiplier' | 'multiplierRemaining' | 'pityCounter'>[] = [];
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
        statut,
        dateTerme: currentProps.dateTerme,
        theme,
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

  let currentName: string | null = null;
  let currentProps: Record<string, string> = {};
  let inHistory = false;
  let inActiveRewards = false;

  const RESERVED_SECTIONS = ['Journal des gains', 'Récompenses actives'];

  const flush = () => {
    if (currentName && !RESERVED_SECTIONS.includes(currentName)) {
      profiles.push({
        id: currentName.toLowerCase().replace(/\s+/g, ''),
        name: currentName,
        role: 'adulte',
        avatar: '👤',
        points: parseInt(currentProps.points ?? '0', 10),
        level: parseInt(currentProps.level ?? '1', 10),
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
    } else if (currentName && !inHistory && !inActiveRewards && line.includes(': ')) {
      const colonIdx = line.indexOf(': ');
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 2).trim();
      currentProps[key] = val;
    }
  }
  flush();

  return { profiles, history, activeRewards };
}

/**
 * Serialize gamification data back to Markdown string.
 * Called after any points/loot change.
 */
export function serializeGamification(data: GamificationData): string {
  const profileSections = data.profiles
    .map(
      (p) => `## ${p.name}
points: ${p.points}
level: ${p.level}
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

  return `---
tags:
  - gamification
---
# Gamification

<!-- Family Vault — historique des points et loot boxes. Ne pas modifier manuellement. -->

${profileSections}

## Récompenses actives
${activeRewardLines}

## Journal des gains
${historyLines}
`;
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
      const profileName = entryLines[0].trim();
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

      // Notes + bought
      let extra = item.notes || '';
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

    const cells = line.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
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
  let currentSection: string | undefined;
  let skipSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Track section headers
    if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim();
      skipSection = STOCK_SKIP_SECTIONS.has(currentSection);
      continue;
    }

    if (skipSection) continue;

    // Match table rows: | col1 | col2 | col3 | col4 | col5 |
    if (!line.startsWith('|')) continue;

    const cells = line.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells.length < 4) continue;

    // Skip header and separator rows
    if (cells[0] === 'Produit' || cells[0].startsWith('---')) continue;

    const produit = cells[0].trim();
    if (!produit) continue;

    const detail = cells[1]?.trim() || undefined;
    const quantite = parseInt(cells[2], 10);
    const seuil = parseInt(cells[3], 10);

    // Skip rows where quantite or seuil is not a number
    if (isNaN(quantite) || isNaN(seuil)) continue;

    const rawQteAchat = cells[4] ? parseInt(cells[4], 10) : undefined;
    const qteAchat = rawQteAchat && !isNaN(rawQteAchat) ? rawQteAchat : 1;

    items.push({
      produit,
      detail: detail || undefined,
      quantite,
      seuil,
      qteAchat,
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
  return `| ${item.produit} | ${item.detail ?? ''} | ${item.quantite} | ${item.seuil} | ${item.qteAchat ?? ''} |`;
}

/**
 * Extract available section names from the stock file (excluding skipped sections).
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
 */
export function generateAdultJournalTemplate(prenom: string): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayDisplay = format(new Date(), 'dd/MM/yyyy');

  return `---
date: ${today}
profil: ${prenom}
tags:
  - journal-adulte
---

# Journal — ${prenom} — ${todayDisplay}

## 📝 Notes du jour

## 😊 Humeur

## 🎯 Objectifs
- [ ]
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
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
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
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
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
export function parseRoutines(content: string): { id: string; label: string; emoji: string; steps: { text: string; durationMinutes?: number }[] }[] {
  const routines: { id: string; label: string; emoji: string; steps: { text: string; durationMinutes?: number }[] }[] = [];
  const lines = content.split('\n');
  let current: (typeof routines)[number] | null = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current && current.steps.length > 0) routines.push(current);
      const headerText = line.slice(3).trim();
      // Séparer l'emoji du label
      const parts = headerText.split(/\s+/);
      const emoji = parts[0] || '📋';
      const label = parts.slice(1).join(' ') || headerText;
      const id = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
      current = { label, emoji, id, steps: [] };
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
export function serializeRoutines(routines: { emoji: string; label: string; steps: { text: string; durationMinutes?: number }[] }[]): string {
  const lines = ['# Routines', ''];
  for (const routine of routines) {
    lines.push(`## ${routine.emoji} ${routine.label}`);
    for (const step of routine.steps) {
      const timer = step.durationMinutes ? ` ~${step.durationMinutes}min` : '';
      lines.push(`- ${step.text}${timer}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
