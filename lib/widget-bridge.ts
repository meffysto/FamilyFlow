/**
 * widget-bridge.ts — Prépare et envoie les données aux widgets iOS et Android
 *
 * iOS : JSON dans le container App Group partagé, lu par WidgetKit.
 * Android : JSON dans le FileSystem, lu par le widget task handler +
 *           requestWidgetUpdate pour déclencher le rafraîchissement.
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { MealItem, Task, RDV, Profile } from './types';
import { isBabyProfile } from './types';
import { isRdvUpcoming } from './parser';

// Import conditionnel des modules natifs
let updateWidgetDataNative: ((json: string) => Promise<void>) | null = null;
let updateJournalWidgetDataNative: ((json: string) => Promise<void>) | null = null;
let updateWidgetLanguageNative: ((json: string) => Promise<void>) | null = null;
if (Platform.OS === 'ios') {
  try {
    const mod = require('../modules/vault-access/src');
    updateWidgetDataNative = mod.updateWidgetData;
    updateJournalWidgetDataNative = mod.updateJournalWidgetData;
    updateWidgetLanguageNative = mod.updateWidgetLanguage;
  } catch {
    // Module non disponible
  }
}

const ANDROID_WIDGET_CACHE = `${FileSystem.documentDirectory}widget-data.json`;
const ANDROID_JOURNAL_CACHE = `${FileSystem.documentDirectory}journal-widget-data.json`;

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

export interface WidgetProgressOverride {
  done: number;
  total: number;
}

function buildWidgetData(
  meals: MealItem[],
  rdvs: RDV[],
  allTasks: Task[],
  progressOverride?: WidgetProgressOverride,
): WidgetData {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const dayName = DAYS_FR[now.getDay()];

  // Repas du jour
  const todayMeals = meals.filter(m => m.day === dayName);
  const dejeuner = todayMeals.find(m => m.mealType === 'Déjeuner')?.text || null;
  const diner = todayMeals.find(m => m.mealType === 'Dîner')?.text || null;

  // Tâches du jour : récurrentes dues aujourd'hui/retard + ponctuelles dues aujourd'hui.
  // Garde les completed pour qu'elles comptent dans `done` (ponctuelles cochées).
  const todayTasks = allTasks.filter(t => {
    if (t.recurrence) return t.dueDate && t.dueDate <= todayStr;
    return t.dueDate === todayStr;
  });
  const pending = todayTasks.filter(t => !t.completed);
  // progressOverride fourni par useVault (counter événementiel qui comptabilise les récurrentes
  // cochées dont le dueDate a été bumpé au lendemain). Sinon fallback sur done depuis les tasks.
  const done = progressOverride?.done ?? todayTasks.filter(t => t.completed).length;
  const total = progressOverride?.total ?? pending.length + done;
  const nextTasks = pending.slice(0, 3).map(t => t.text);

  // Prochains RDVs planifiés
  const upcoming = rdvs
    .filter(r => isRdvUpcoming(r))
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
 * Met à jour les données des widgets iOS et Android.
 * Fire-and-forget — ne bloque jamais l'app.
 */
export function refreshWidget(
  meals: MealItem[],
  rdvs: RDV[],
  allTasks: Task[] = [],
  progressOverride?: WidgetProgressOverride,
): void {
  const data = buildWidgetData(meals, rdvs, allTasks, progressOverride);
  const jsonData = JSON.stringify(data);

  if (Platform.OS === 'ios' && updateWidgetDataNative) {
    updateWidgetDataNative(jsonData).catch(() => {});
  } else if (Platform.OS === 'android') {
    // Écrire le cache JSON + déclencher le rafraîchissement du widget
    FileSystem.writeAsStringAsync(ANDROID_WIDGET_CACHE, jsonData)
      .then(() => {
        const { requestWidgetUpdate } = require('react-native-android-widget');
        requestWidgetUpdate({ widgetName: 'MaJourneeWidget' }).catch(() => {});
      })
      .catch(() => {});
  }
}

/**
 * Met à jour le widget Journal bébé avec le nom du premier bébé.
 * Le widget gère lui-même les feedings via AppIntent.
 * Fire-and-forget — ne bloque jamais l'app.
 */
export function refreshJournalWidget(profiles: Profile[]): void {
  // Trouver le premier profil bébé
  const baby = profiles.find(p =>
    p.role === 'enfant' &&
    p.statut !== 'grossesse' &&
    isBabyProfile(p)
  );

  if (!baby) return;

  const data = { childName: baby.name };
  const jsonData = JSON.stringify(data);

  if (Platform.OS === 'ios' && updateJournalWidgetDataNative) {
    updateJournalWidgetDataNative(jsonData).catch(() => {});
  } else if (Platform.OS === 'android') {
    FileSystem.writeAsStringAsync(ANDROID_JOURNAL_CACHE, jsonData)
      .then(() => {
        const { requestWidgetUpdate } = require('react-native-android-widget');
        requestWidgetUpdate({ widgetName: 'JournalBebeWidget' }).catch(() => {});
      })
      .catch(() => {});
  }
}

/**
 * Met à jour la langue des widgets iOS (widget-language.json dans App Group).
 * Appelé quand l'utilisateur change la langue dans les réglages.
 * Fire-and-forget — ne bloque jamais l'app.
 */
export function refreshWidgetLanguage(language: string): void {
  if (Platform.OS === 'ios' && updateWidgetLanguageNative) {
    const jsonData = JSON.stringify({ language });
    updateWidgetLanguageNative(jsonData).catch(() => {});
  }
}
