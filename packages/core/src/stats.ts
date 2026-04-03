/**
 * stats.ts — Fonctions d'agrégation pures pour les statistiques
 */

import { Task, BudgetEntry, MealItem, RDV, MoodEntry, MoodLevel, MOOD_EMOJIS, StockItem } from './types';
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
 * @param dayLabels — libellés courts des jours (lun→dim), par défaut FR
 */
export function aggregateTasksByWeek(tasks: Task[], weekStart: Date, dayLabels = JOURS_COURTS): DataPoint[] {
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

  return counts.map((count, i) => ({ label: dayLabels[i], value: count }));
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

/**
 * Jours les plus chargés du mois courant (tâches + RDV)
 * Retourne les 7 jours avec le plus d'événements, triés par date
 */
export function aggregateBusiestDays(
  tasks: Task[],
  rdvs: RDV[],
  month?: string,
): DataPoint[] {
  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const counts: Record<string, number> = {};

  for (const task of tasks) {
    const d = task.completedDate || task.dueDate;
    if (d?.startsWith(targetMonth)) {
      counts[d] = (counts[d] ?? 0) + 1;
    }
  }
  for (const rdv of rdvs) {
    if (rdv.date_rdv?.startsWith(targetMonth)) {
      counts[rdv.date_rdv] = (counts[rdv.date_rdv] ?? 0) + 1;
    }
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({
      label: date.slice(8, 10),
      value: count,
    }));
}

/**
 * Tendance humeur sur 30 jours (moyenne par jour, tous profils confondus)
 */
export function aggregateMoodTrend(moods: MoodEntry[], days = 30): DataPoint[] {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const byDay: Record<string, { sum: number; count: number }> = {};
  for (const m of moods) {
    if (m.date < cutoffStr) continue;
    if (!byDay[m.date]) byDay[m.date] = { sum: 0, count: 0 };
    byDay[m.date].sum += m.level;
    byDay[m.date].count += 1;
  }

  const result: DataPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = dateStr.slice(8, 10);
    const entry = byDay[dateStr];
    result.push({
      label: dayLabel,
      value: entry ? Math.round((entry.sum / entry.count) * 10) / 10 : 0,
    });
  }
  return result;
}

/**
 * Retourne le mood emoji pour une valeur moyenne
 */
export function moodAvgEmoji(avg: number): string {
  const level = Math.round(avg) as MoodLevel;
  return MOOD_EMOJIS[level] ?? '😊';
}

/**
 * Top N produits stock les plus consommés (quantité basse / seuil élevé ratio)
 * Calcule un score de rotation : (seuil - quantite) / seuil
 */
export function aggregateStockTurnover(stock: StockItem[], topN = 8): DataPoint[] {
  return stock
    .filter((s) => s.tracked !== false && s.seuil > 0)
    .map((s) => ({
      label: s.produit.length > 14 ? s.produit.slice(0, 13) + '…' : s.produit,
      value: Math.max(0, s.seuil - s.quantite),
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);
}
