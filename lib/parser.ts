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
} from './types';

// ─── Task parsing ───────────────────────────────────────────────────────────

const TASK_REGEX = /^(\s*)-\s+\[([ xX])\]\s+(.+)$/;
const DUE_DATE_REGEX = /📅\s*(\d{4}-\d{2}-\d{2})/;
const COMPLETED_DATE_REGEX = /✅\s*(\d{4}-\d{2}-\d{2})/;
const RECURRENCE_REGEX = /🔁\s*(every\s+\S+(?:\s+\S+)?)/;
const TAG_REGEX = /#([a-zA-ZÀ-ÿ0-9_-]+)/g;
const MENTION_REGEX = /@([a-zA-ZÀ-ÿ0-9_-]+)/g;

function stripEmoji(text: string): string {
  return text
    .replace(/📅\s*\d{4}-\d{2}-\d{2}/g, '')
    .replace(/🔁\s*every\s+\S+(?:\s+\S+)?/g, '')
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

export function parseFrontmatter(content: string): { data: Record<string, string>; content: string } {
  try {
    const parsed = matter(content);
    return {
      data: parsed.data as Record<string, string>,
      content: parsed.content,
    };
  } catch {
    return { data: {}, content };
  }
}

// ─── RDV ────────────────────────────────────────────────────────────────────

export function parseRDV(relativePath: string, content: string): RDV | null {
  const { data } = parseFrontmatter(content);
  if (!data.date_rdv) return null;

  const fileName = relativePath.split('/').pop()?.replace('.md', '') ?? '';

  return {
    title: fileName,
    date_rdv: String(data.date_rdv ?? ''),
    heure: String(data.heure ?? ''),
    type_rdv: String(data.type_rdv ?? ''),
    enfant: String(data.enfant ?? ''),
    médecin: String(data.médecin ?? ''),
    lieu: String(data.lieu ?? ''),
    statut: (data.statut as RDV['statut']) ?? 'planifié',
    sourceFile: relativePath,
  };
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\s*)-\s+\[([ xX])\]\s+(.+)$/);
    if (!match) continue;
    const text = match[3].trim();
    if (!text) continue; // skip empty items

    items.push({
      id: `${relativePath}:${i}`,
      text,
      completed: match[2].toLowerCase() === 'x',
      lineIndex: i,
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
 * - Dîner: Soupe de légumes
 * ```
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
        const text = match[2].trim();
        meals.push({
          id: `${currentDay.toLowerCase()}:${mealType.toLowerCase()}`,
          day: currentDay,
          mealType,
          text,
          lineIndex: i,
          sourceFile,
        });
      }
    }
  }

  return meals;
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
        .map((m) => `- ${m.mealType}: ${m.text}`)
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
      profiles.push({
        id: currentId,
        name: currentProps.name,
        role: currentProps.role as Profile['role'],
        avatar: currentProps.avatar ?? '👤',
        birthdate: currentProps.birthdate,
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

// ─── Journal bébé ───────────────────────────────────────────────────────────

/** Check if a journal file exists for today */
export function todayJournalPath(enfant: string): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  const enfantDir = enfant.replace(' ', ' ');
  return `03 - Journal/${enfant}/${today} ${enfant}.md`;
}

/** Generate a new journal entry from template */
export function generateJournalTemplate(enfant: string): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayDisplay = format(new Date(), 'dd/MM/yyyy');

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
|       | Biberon | | |
|       | Biberon | | |
|       | Biberon | | |
|       | Biberon | | |
|       | Tétée | | |

## Couches
| Heure | Type | Notes |
| ----- | ---- | ----- |
|       | | |
|       | | |
|       | | |
|       | | |

## Sommeil
| Début | Fin | Durée | Notes |
| ----- | --- | ----- | ----- |
|       |     |       |       |
|       |     |       |       |
|       |     |       |       |

## Humeur & observations
1.
2.
3.

## Médicaments / Soins
| Heure | Médicament | Dose | Notes |
| ----- | ---------- | ---- | ----- |
|       | | | |
`;
}
