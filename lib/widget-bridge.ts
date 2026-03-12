/**
 * widget-bridge.ts — Prépare et envoie les données au widget iOS "Ma Journée"
 *
 * Écrit un JSON dans le container App Group partagé, lu par le widget WidgetKit.
 */

import { Platform } from 'react-native';
import type { MealItem, Task, RDV } from './types';

// Import conditionnel du module natif
let updateWidgetDataNative: ((json: string) => Promise<void>) | null = null;
if (Platform.OS === 'ios') {
  try {
    const mod = require('../modules/vault-access/src');
    updateWidgetDataNative = mod.updateWidgetData;
  } catch {
    // Module non disponible
  }
}

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

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
  nextTask: string | null;
  nextRDV: {
    title: string;
    date: string;
    heure: string;
    lieu: string | null;
  } | null;
}

function buildWidgetData(
  meals: MealItem[],
  menageTasks: Task[],
  rdvs: RDV[],
): WidgetData {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const dayName = DAYS_FR[now.getDay()];

  // Repas du jour
  const todayMeals = meals.filter(m => m.day === dayName);
  const dejeuner = todayMeals.find(m => m.mealType === 'Déjeuner')?.text || null;
  const diner = todayMeals.find(m => m.mealType === 'Dîner')?.text || null;

  // Progression ménage
  const done = menageTasks.filter(t => t.completed).length;
  const total = menageTasks.length;
  const nextTask = menageTasks.find(t => !t.completed)?.text || null;

  // Prochain RDV planifié
  const upcoming = rdvs
    .filter(r => r.statut === 'planifié' && r.date_rdv >= todayStr)
    .sort((a, b) => a.date_rdv.localeCompare(b.date_rdv) || a.heure.localeCompare(b.heure));

  const next = upcoming[0];
  const nextRDV = next ? {
    title: `${next.type_rdv} — ${next.enfant}`,
    date: formatDateShort(next.date_rdv),
    heure: next.heure.replace(':', 'h'),
    lieu: next.lieu || null,
  } : null;

  return {
    date: todayStr,
    dayOfWeek: dayName,
    meals: { dejeuner, diner },
    tasksProgress: { done, total },
    nextTask,
    nextRDV,
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
): void {
  if (Platform.OS !== 'ios' || !updateWidgetDataNative) return;

  const data = buildWidgetData(meals, menageTasks, rdvs);
  updateWidgetDataNative(JSON.stringify(data)).catch(() => {
    // Widget update non critique — on ignore les erreurs
  });
}
