/**
 * stats.ts — Fonctions d'agrégation pures pour les statistiques
 */

import { Task, BudgetEntry, MealItem } from './types';
import { JournalStats, parseDureeToMinutes, formatMinutes } from './journal-stats';
import { totalSpent } from './budget';

// Re-export pour usage externe (stats.tsx importe depuis ici)
export { formatMinutes } from './journal-stats';

export interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

const JOURS_COURTS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

/**
 * Tâches complétées par jour sur une semaine (lundi → dimanche)
 */
export function aggregateTasksByWeek(tasks: Task[], weekStart: Date): DataPoint[] {
  const counts = new Array(7).fill(0);
  const startMs = weekStart.getTime();
  const endMs = startMs + 7 * 86400000;

  for (const task of tasks) {
    if (!task.completedDate) continue;
    const d = new Date(task.completedDate + 'T00:00:00').getTime();
    if (d >= startMs && d < endMs) {
      const dayIndex = Math.floor((d - startMs) / 86400000);
      if (dayIndex >= 0 && dayIndex < 7) counts[dayIndex]++;
    }
  }

  return counts.map((count, i) => ({ label: JOURS_COURTS[i], value: count }));
}

/**
 * Retourne le lundi de la semaine contenant `date`
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Budget total par mois (derniers N mois)
 */
export function aggregateBudgetByMonths(
  monthsData: { month: string; entries: BudgetEntry[] }[],
): DataPoint[] {
  return monthsData.map(({ month, entries }) => {
    const total = totalSpent(entries);
    const monthIndex = parseInt(month.slice(5, 7), 10) - 1;
    return { label: MOIS_COURTS[monthIndex] ?? month, value: Math.round(total) };
  });
}

/**
 * Fréquence des repas (top N plats)
 */
export function aggregateMealFrequency(meals: MealItem[], topN = 5): DataPoint[] {
  const freq: Record<string, number> = {};
  for (const meal of meals) {
    const name = meal.text.trim();
    if (!name || name === '-') continue;
    freq[name] = (freq[name] ?? 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name, count]) => ({
      label: name.length > 12 ? name.slice(0, 11) + '…' : name,
      value: count,
    }));
}

/**
 * Sommeil total par jour (en minutes)
 */
export function aggregateSleepByDays(
  data: { date: string; stats: JournalStats }[],
): DataPoint[] {
  return data.map(({ date, stats }) => {
    const totalMinutes = parseDureeToMinutes(stats.sommeilTotal);
    const dayLabel = date.slice(8, 10);
    return { label: dayLabel, value: totalMinutes };
  });
}
