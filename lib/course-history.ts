/**
 * course-history.ts — Historique de fréquence des articles de courses
 *
 * Persiste le compteur d'utilisation de chaque article via expo-secure-store.
 * Retourne les articles les plus fréquents pour le bandeau de chips.
 */

import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'course_history_v1';
const MAX_ENTRIES = 100;
const STALE_DAYS = 30;

interface CourseEntry {
  displayName: string;
  count: number;
  lastUsedAt: string; // ISO date string
}

type CourseHistoryMap = Record<string, CourseEntry>;

/**
 * Normalise une clé d'article : lowercase + trim + retrait des diacritiques
 */
function normalizeKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

async function loadHistory(): Promise<CourseHistoryMap> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CourseHistoryMap;
  } catch {
    if (__DEV__) console.warn('[course-history] Erreur lecture SecureStore');
    return {};
  }
}

async function saveHistory(map: CourseHistoryMap): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(map));
  } catch {
    if (__DEV__) console.warn('[course-history] Erreur écriture SecureStore');
  }
}

/**
 * Incrémente le compteur d'utilisation d'un article
 */
export async function trackCourseAdd(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;

  const key = normalizeKey(trimmed);
  const map = await loadHistory();

  const existing = map[key];
  map[key] = {
    displayName: existing?.displayName ?? trimmed,
    count: (existing?.count ?? 0) + 1,
    lastUsedAt: new Date().toISOString(),
  };

  // Cap : garder max MAX_ENTRIES entrées (drop les plus anciennes)
  const entries = Object.entries(map);
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) =>
      new Date(a[1].lastUsedAt).getTime() - new Date(b[1].lastUsedAt).getTime()
    );
    const toRemove = entries.slice(0, entries.length - MAX_ENTRIES);
    for (const [k] of toRemove) {
      delete map[k];
    }
  }

  await saveHistory(map);
}

/**
 * Retourne les articles les plus fréquents (triés par count desc puis lastUsedAt desc)
 * Filtre les articles non utilisés depuis STALE_DAYS jours
 */
export async function getFrequentCourses(limit = 8): Promise<{ name: string; count: number }[]> {
  try {
    const map = await loadHistory();
    const staleThreshold = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;

    return Object.values(map)
      .filter(entry => new Date(entry.lastUsedAt).getTime() >= staleThreshold)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
      })
      .slice(0, limit)
      .map(entry => ({ name: entry.displayName, count: entry.count }));
  } catch {
    if (__DEV__) console.warn('[course-history] Erreur getFrequentCourses');
    return [];
  }
}

/**
 * Réinitialise l'historique (debug)
 */
export async function clearCourseHistory(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch {
    if (__DEV__) console.warn('[course-history] Erreur clearCourseHistory');
  }
}
