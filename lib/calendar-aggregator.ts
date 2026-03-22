/**
 * calendar-aggregator.ts — Agrège les sources vault en CalendarEvent[]
 *
 * Fonction pure et testable. Reçoit les données du vault + une plage de dates,
 * retourne un tableau trié d'événements calendrier.
 */

import { format, eachDayOfInterval, parseISO, addDays, addWeeks, addMonths } from 'date-fns';
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
 * Projette une tâche récurrente sur toutes les dates dans la plage.
 * Supporte : "every day", "every week", "every month", "every N days/weeks/months"
 */
function expandRecurrence(startDate: string, recurrence: string, range: DateRange): string[] {
  const match = recurrence.match(/every\s+(\d+\s+)?(day|week|month)s?/);
  if (!match) return [];

  const interval = match[1] ? parseInt(match[1].trim(), 10) : 1;
  const unit = match[2] as 'day' | 'week' | 'month';

  const advanceFn = unit === 'day' ? addDays : unit === 'week' ? addWeeks : addMonths;
  const dates: string[] = [];
  let current = parseISO(startDate);
  const rangeEnd = parseISO(range.end);
  const rangeStart = parseISO(range.start);

  // Avancer jusqu'au début de la plage si la date de départ est avant
  while (current < rangeStart) {
    current = advanceFn(current, interval);
  }

  // Collecter les dates dans la plage
  while (current <= rangeEnd) {
    dates.push(format(current, 'yyyy-MM-dd'));
    current = advanceFn(current, interval);
  }

  return dates;
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
      sublabel: rdv.heure ? `${rdv.heure} — ${rdv.lieu || rdv.médecin || ''}` : rdv.lieu || rdv.médecin || '',
      emoji: EVENT_CONFIG.rdv.emoji,
      colorKey: rdv.statut === 'fait' ? 'success' : 'info',
      route: '/(tabs)/rdv',
      source: rdv,
    });
  }

  // Tâches sans dueDate (récurrentes sans 📅, sections ménage)
  const today = format(new Date(), 'yyyy-MM-dd');
  for (const task of input.tasks) {
    if (!task.dueDate && !task.recurrence) {
      // Tâches sous sections récurrentes ou ménage → aujourd'hui
      const section = (task.section || '').toLowerCase();
      const isMenage = section.includes('ménage') || /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s/i.test(task.section || '');
      const isRecurringSection = section.includes('hebdo') || section.includes('mensuel') || section.includes('tous les') || section.includes('quotid');
      if ((!isMenage && !isRecurringSection) || task.completed || !inRange(today)) continue;
      events.push({
        id: `task-${task.id}`,
        date: today,
        type: 'task',
        label: task.text.trim(),
        sublabel: task.section || undefined,
        emoji: isMenage ? '🧹' : EVENT_CONFIG.task.emoji,
        colorKey: 'warning',
        route: '/(tabs)/tasks',
        source: task,
      });
      continue;
    }
    if (task.completed) continue;
    const label = task.text.replace(/📅\s*\d{4}-\d{2}-\d{2}/, '').replace(/🔁\s*\S+/, '').trim();
    const sublabel = task.section || undefined;

    if (task.recurrence) {
      // Projeter les occurrences dans la plage
      const startDate = task.dueDate || today;
      const dates = expandRecurrence(startDate, task.recurrence, range);
      // Tâche récurrente en retard : ajouter aujourd'hui si aucune occurrence dans la plage
      if (dates.length === 0 && startDate < today && inRange(today)) {
        dates.push(today);
      }
      // Occurrences passées non complétées → remonter à aujourd'hui
      const hasOverdue = dates.some(d => d < today);
      if (hasOverdue && inRange(today) && !dates.includes(today)) {
        dates.push(today);
      }
      const seen = new Set<string>();
      for (const date of dates) {
        if (date < today) continue; // ne pas afficher les dates passées, elles sont remontées
        if (seen.has(date)) continue;
        seen.add(date);
        const isOverdue = date === today && !!task.dueDate && task.dueDate < today;
        events.push({
          id: `task-${task.id}-${date}`,
          date,
          type: 'task',
          label,
          sublabel: isOverdue ? `⚠️ En retard (${task.dueDate})` : sublabel,
          emoji: EVENT_CONFIG.task.emoji,
          colorKey: isOverdue ? 'error' : 'warning',
          route: '/(tabs)/tasks',
          source: task,
        });
      }
    } else if (task.dueDate && (inRange(task.dueDate) || task.dueDate < today)) {
      // Tâches en retard : affichées à aujourd'hui
      const displayDate = task.dueDate < today ? today : task.dueDate;
      events.push({
        id: `task-${task.id}`,
        date: displayDate,
        type: 'task',
        label,
        sublabel: task.dueDate < today ? `⚠️ En retard (${task.dueDate})` : sublabel,
        emoji: EVENT_CONFIG.task.emoji,
        colorKey: task.dueDate < today ? 'error' : 'warning',
        route: '/(tabs)/tasks',
        source: task,
      });
    }
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
