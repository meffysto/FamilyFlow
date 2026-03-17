/**
 * widget-bridge.ts — Prépare et envoie les données au widget iOS "Ma Journée"
 *
 * Écrit un JSON dans le container App Group partagé, lu par le widget WidgetKit.
 */

import { Platform } from 'react-native';
import type { MealItem, Task, RDV, Profile } from './types';
import { isBabyProfile } from './types';

// Import conditionnel du module natif
let updateWidgetDataNative: ((json: string) => Promise<void>) | null = null;
let updateJournalWidgetDataNative: ((json: string) => Promise<void>) | null = null;
if (Platform.OS === 'ios') {
  try {
    const mod = require('../modules/vault-access/src');
    updateWidgetDataNative = mod.updateWidgetData;
    updateJournalWidgetDataNative = mod.updateJournalWidgetData;
  } catch {
    // Module non disponible
  }
}

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

interface WidgetRDV {
  title: string;
  date: string;
  heure: string;
  lieu: string | null;
}

interface WidgetData {
  date: string;
  dayOfWeek: string;
  meals: {
    dejeuner: string | null;
    diner: string | null;
  };
  tasksProgress: {
    done: number;
    total: number;
  };
  nextTasks: string[];
  nextRDVs: WidgetRDV[];
}

function buildWidgetData(
  meals: MealItem[],
  menageTasks: Task[],
  rdvs: RDV[],
  allTasks: Task[],
): WidgetData {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const dayName = DAYS_FR[now.getDay()];

  // Repas du jour
  const todayMeals = meals.filter(m => m.day === dayName);
  const dejeuner = todayMeals.find(m => m.mealType === 'Déjeuner')?.text || null;
  const diner = todayMeals.find(m => m.mealType === 'Dîner')?.text || null;

  // Tâches du jour : ménage + tâches dues aujourd'hui ou en retard
  const dueTodayOrOverdue = allTasks.filter(t =>
    t.dueDate && t.dueDate <= todayStr && !t.completed
  );
  const allDayTasks = [...menageTasks, ...dueTodayOrOverdue];
  const done = allDayTasks.filter(t => t.completed).length;
  const total = allDayTasks.length;
  const nextTasks = allDayTasks
    .filter(t => !t.completed)
    .slice(0, 3)
    .map(t => t.text);

  // Prochains RDVs planifiés
  const upcoming = rdvs
    .filter(r => r.statut === 'planifié' && r.date_rdv >= todayStr)
    .sort((a, b) => a.date_rdv.localeCompare(b.date_rdv) || a.heure.localeCompare(b.heure));

  const nextRDVs: WidgetRDV[] = upcoming.slice(0, 3).map(r => ({
    title: `${r.type_rdv} — ${r.enfant}`,
    date: formatDateShort(r.date_rdv),
    heure: r.heure.replace(':', 'h'),
    lieu: r.lieu || null,
  }));

  return {
    date: todayStr,
    dayOfWeek: dayName,
    meals: { dejeuner, diner },
    tasksProgress: { done, total },
    nextTasks,
    nextRDVs,
  };
}

function formatDateShort(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${parts[2]}/${parts[1]}`;
}

/**
 * Met à jour les données du widget iOS.
 * Fire-and-forget — ne bloque jamais l'app.
 */
export function refreshWidget(
  meals: MealItem[],
  menageTasks: Task[],
  rdvs: RDV[],
  allTasks: Task[] = [],
): void {
  if (Platform.OS !== 'ios' || !updateWidgetDataNative) return;

  const data = buildWidgetData(meals, menageTasks, rdvs, allTasks);
  updateWidgetDataNative(JSON.stringify(data)).catch(() => {
    // Widget update non critique — on ignore les erreurs
  });
}

/**
 * Met à jour le widget Journal bébé avec le nom du premier bébé.
 * Le widget gère lui-même les feedings via AppIntent.
 * Fire-and-forget — ne bloque jamais l'app.
 */
export function refreshJournalWidget(profiles: Profile[]): void {
  if (Platform.OS !== 'ios' || !updateJournalWidgetDataNative) return;

  // Trouver le premier profil bébé
  const baby = profiles.find(p =>
    p.role === 'enfant' &&
    p.statut !== 'grossesse' &&
    isBabyProfile(p)
  );

  if (!baby) return;

  const data = { childName: baby.name };
  updateJournalWidgetDataNative(JSON.stringify(data)).catch(() => {
    // Widget update non critique — on ignore les erreurs
  });
}
