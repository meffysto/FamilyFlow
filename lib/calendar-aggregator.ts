/**
 * calendar-aggregator.ts — Agrège les sources vault en CalendarEvent[]
 *
 * Fonction pure et testable. Reçoit les données du vault + une plage de dates,
 * retourne un tableau trié d'événements calendrier.
 */

import { format, eachDayOfInterval, parseISO, addDays } from 'date-fns';
import type { RDV, Task, Anniversary, MealItem, Defi, Memory, MoodEntry, ChildQuote, VacationConfig } from './types';
import { MOOD_EMOJIS } from './types';
import type { CalendarEvent, CalendarEventType } from './calendar-types';
import { EVENT_CONFIG, DAYS_ORDER_FR } from './calendar-types';

export interface AggregatorInput {
  rdvs: RDV[];
  tasks: Task[];
  anniversaries: Anniversary[];
  /** Repas déjà résolus en dates absolues via resolveMealsForRange */
  resolvedMeals: { date: string; meal: MealItem }[];
  vacationConfig: VacationConfig | null;
  defis: Defi[];
  memories: Memory[];
  moods: MoodEntry[];
  quotes: ChildQuote[];
}

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

/**
 * Résout les repas (par jour de la semaine) en dates absolues.
 * mealsPerWeek: { mondayDate: string, meals: MealItem[] }[]
 */
export function resolveMealsForRange(
  mealsPerWeek: { mondayDate: string; meals: MealItem[] }[],
): { date: string; meal: MealItem }[] {
  const resolved: { date: string; meal: MealItem }[] = [];
  for (const { mondayDate, meals } of mealsPerWeek) {
    const monday = parseISO(mondayDate);
    for (const meal of meals) {
      if (!meal.text.trim()) continue; // pas de repas planifié
      const dayIndex = DAYS_ORDER_FR.indexOf(meal.day);
      if (dayIndex < 0) continue;
      const date = format(addDays(monday, dayIndex), 'yyyy-MM-dd');
      resolved.push({ date, meal });
    }
  }
  return resolved;
}

/**
 * Agrège toutes les sources en CalendarEvent[] triés par date + heure.
 */
export function aggregateCalendarEvents(
  input: AggregatorInput,
  range: DateRange,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const inRange = (d: string) => d >= range.start && d <= range.end;

  // RDVs
  for (const rdv of input.rdvs) {
    if (!inRange(rdv.date_rdv) || rdv.statut === 'annulé') continue;
    events.push({
      id: `rdv-${rdv.sourceFile}`,
      date: rdv.date_rdv,
      time: rdv.heure || undefined,
      type: 'rdv',
      label: `${rdv.type_rdv} ${rdv.enfant}`,
      sublabel: rdv.heure ? `${rdv.heure} — ${rdv.lieu || rdv.médecin}` : rdv.lieu || rdv.médecin,
      emoji: EVENT_CONFIG.rdv.emoji,
      colorKey: rdv.statut === 'fait' ? 'success' : 'info',
      route: '/(tabs)/rdv',
      source: rdv,
    });
  }

  // Tâches avec deadline
  for (const task of input.tasks) {
    if (!task.dueDate || !inRange(task.dueDate) || task.completed) continue;
    events.push({
      id: `task-${task.id}`,
      date: task.dueDate,
      type: 'task',
      label: task.text.replace(/📅\s*\d{4}-\d{2}-\d{2}/, '').replace(/🔁\s*\S+/, '').trim(),
      sublabel: task.section || undefined,
      emoji: EVENT_CONFIG.task.emoji,
      colorKey: 'warning',
      route: '/(tabs)/tasks',
      source: task,
    });
  }

  // Anniversaires (récurrents annuels)
  const rangeStart = parseISO(range.start);
  const rangeEnd = parseISO(range.end);
  for (const ann of input.anniversaries) {
    // Projeter le MM-DD sur chaque année dans la plage
    const [mm, dd] = ann.date.split('-');
    const startYear = rangeStart.getFullYear();
    const endYear = rangeEnd.getFullYear();
    for (let y = startYear; y <= endYear; y++) {
      const dateStr = `${y}-${mm}-${dd}`;
      if (!inRange(dateStr)) continue;
      const age = ann.birthYear ? y - ann.birthYear : undefined;
      events.push({
        id: `ann-${ann.name}-${y}`,
        date: dateStr,
        type: 'anniversary',
        label: ann.name,
        sublabel: age ? `${age} ans` : undefined,
        emoji: EVENT_CONFIG.anniversary.emoji,
        colorKey: 'accentPink',
        route: '/(tabs)/anniversaires',
        source: ann,
        age,
      });
    }
  }

  // Repas (déjà résolus en dates)
  for (const { date, meal } of input.resolvedMeals) {
    if (!inRange(date)) continue;
    events.push({
      id: `meal-${date}-${meal.mealType}`,
      date,
      type: 'meal',
      label: meal.text,
      sublabel: meal.mealType,
      emoji: EVENT_CONFIG.meal.emoji,
      colorKey: 'success',
      route: '/(tabs)/meals',
      source: meal,
    });
  }

  // Vacances (plage → un event par jour)
  if (input.vacationConfig?.active) {
    const vacStart = input.vacationConfig.startDate;
    const vacEnd = input.vacationConfig.endDate;
    try {
      const days = eachDayOfInterval({ start: parseISO(vacStart), end: parseISO(vacEnd) });
      for (const d of days) {
        const dateStr = format(d, 'yyyy-MM-dd');
        if (!inRange(dateStr)) continue;
        events.push({
          id: `vac-${dateStr}`,
          date: dateStr,
          type: 'vacation',
          label: 'Vacances',
          emoji: EVENT_CONFIG.vacation.emoji,
          colorKey: 'warning',
        });
      }
    } catch { /* dates invalides */ }
  }

  // Défis actifs
  for (const defi of input.defis) {
    if (defi.status !== 'active') continue;
    if (inRange(defi.startDate)) {
      events.push({
        id: `defi-start-${defi.id}`,
        date: defi.startDate,
        type: 'defi',
        label: `${defi.title} (début)`,
        emoji: EVENT_CONFIG.defi.emoji,
        colorKey: 'primary',
        route: '/(tabs)/defis',
        source: defi,
      });
    }
    if (inRange(defi.endDate)) {
      events.push({
        id: `defi-end-${defi.id}`,
        date: defi.endDate,
        type: 'defi',
        label: `${defi.title} (fin)`,
        emoji: EVENT_CONFIG.defi.emoji,
        colorKey: 'primary',
        route: '/(tabs)/defis',
        source: defi,
      });
    }
  }

  // Souvenirs
  for (const mem of input.memories) {
    if (!inRange(mem.date)) continue;
    events.push({
      id: `mem-${mem.date}-${mem.title}`,
      date: mem.date,
      type: 'memory',
      label: mem.title,
      sublabel: mem.enfant,
      emoji: EVENT_CONFIG.memory.emoji,
      colorKey: 'accentPink',
      source: mem,
    });
  }

  // Humeurs (une seule entrée par jour, résumé)
  const moodsByDate = new Map<string, MoodEntry[]>();
  for (const m of input.moods) {
    if (!inRange(m.date)) continue;
    if (!moodsByDate.has(m.date)) moodsByDate.set(m.date, []);
    moodsByDate.get(m.date)!.push(m);
  }
  for (const [date, entries] of moodsByDate) {
    const avg = Math.round(entries.reduce((s, e) => s + e.level, 0) / entries.length) as 1 | 2 | 3 | 4 | 5;
    events.push({
      id: `mood-${date}`,
      date,
      type: 'mood',
      label: `Humeur famille : ${MOOD_EMOJIS[avg]}`,
      sublabel: entries.map(e => `${e.profileName} ${MOOD_EMOJIS[e.level]}`).join(', '),
      emoji: MOOD_EMOJIS[avg],
      colorKey: 'info',
      route: '/(tabs)/moods',
      source: entries[0],
    });
  }

  // Mots d'enfants
  for (const q of input.quotes) {
    if (!inRange(q.date)) continue;
    events.push({
      id: `quote-${q.date}-${q.lineIndex}`,
      date: q.date,
      type: 'quote',
      label: `« ${q.citation} »`,
      sublabel: q.enfant,
      emoji: EVENT_CONFIG.quote.emoji,
      colorKey: 'info',
      route: '/(tabs)/quotes',
      source: q,
    });
  }

  // Tri : date ASC, puis events avec heure avant events sans heure, puis par heure
  events.sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    if (a.time && b.time) return a.time.localeCompare(b.time);
    return 0;
  });

  return events;
}

/**
 * Indexe les événements par date pour un accès O(1) dans la grille.
 */
export function indexByDate(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const map: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    if (!map[e.date]) map[e.date] = [];
    map[e.date].push(e);
  }
  return map;
}
