/**
 * task-helpers.ts — Fonctions pures de filtrage, tri et transformation de tâches.
 *
 * Partagées entre mobile (React Native) et desktop (Tauri/React).
 * Aucune dépendance React ou plateforme — uniquement des types et de la logique pure.
 */

import type { Task, Profile } from './types';
import { nextOccurrence } from './recurrence';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TaskCategory {
  key: string;
  label: string;
  icon: string;
  pending: number;
}

export type TaskDateStatus = 'overdue' | 'today' | 'upcoming';

// ─── Date helpers ───────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Compare une date ISO avec aujourd'hui */
export function compareDateStatus(dueDate: string): TaskDateStatus {
  const today = todayISO();
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'today';
  return 'upcoming';
}

// ─── Filtrage ───────────────────────────────────────────────────────────────

/**
 * Masque les tâches récurrentes dont la date est dans le futur
 * (elles ont déjà été complétées pour la période en cours).
 */
export function filterVisibleTasks(tasks: Task[], today?: string): Task[] {
  const ref = today ?? todayISO();
  return tasks.filter((t) => {
    if (t.recurrence && t.dueDate && t.dueDate > ref) return false;
    return true;
  });
}

/**
 * Sépare les tâches en actives (non-complétées, visibles) et complétées.
 * Les récurrentes avec date future comptent comme complétées.
 */
export function splitTasksByStatus(tasks: Task[], today?: string): { active: Task[]; completed: Task[] } {
  const ref = today ?? todayISO();
  const active: Task[] = [];
  const completed: Task[] = [];
  for (const t of tasks) {
    if (t.completed) {
      completed.push(t);
    } else if (t.recurrence && t.dueDate && t.dueDate > ref) {
      completed.push(t);
    } else {
      active.push(t);
    }
  }
  return { active, completed };
}

/**
 * Filtrer par catégorie (mes-taches, enfant:{name}, maison, tous).
 */
export function filterTasksByCategory(
  tasks: Task[],
  categoryKey: string,
  activeProfileName?: string,
): Task[] {
  if (!categoryKey || categoryKey === 'tous' || categoryKey === 'all') return tasks;

  if (categoryKey === 'mes-taches' || categoryKey === 'mine') {
    if (!activeProfileName) return tasks;
    const nameNorm = activeProfileName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_]+/g, '');
    return tasks.filter((t) =>
      t.mentions?.some((m) =>
        m.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_]+/g, '') === nameNorm,
      ),
    );
  }

  if (categoryKey.startsWith('enfant:')) {
    const enfantName = categoryKey.slice('enfant:'.length);
    return tasks.filter((t) => t.sourceFile.includes(enfantName));
  }

  if (categoryKey === 'maison') {
    return tasks.filter((t) => t.sourceFile.includes('Maison'));
  }

  // Fallback: treat key as a sourceFile path
  return tasks.filter((t) => t.sourceFile === categoryKey);
}

/**
 * Recherche textuelle dans le texte, tags et section.
 */
export function searchTasks(tasks: Task[], query: string): Task[] {
  const q = query.trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter((t) =>
    t.text.toLowerCase().includes(q) ||
    (t.tags && t.tags.some((tag: string) => tag.toLowerCase().includes(q))) ||
    (t.section && t.section.toLowerCase().includes(q)),
  );
}

// ─── Catégories ─────────────────────────────────────────────────────────────

/**
 * Construit la liste des catégories avec compteur de tâches en attente.
 * Compatible mobile et desktop.
 */
export function buildTaskCategories(
  tasks: Task[],
  profiles: Profile[],
  activeProfile: Profile | null,
  options?: {
    /** Labels traduits (sinon français par défaut) */
    labels?: { all?: string; myTasks?: string; home?: string };
  },
): TaskCategory[] {
  const visible = filterVisibleTasks(tasks);
  const cats: TaskCategory[] = [];
  const labels = options?.labels ?? {};

  // "Mes tâches" — tâches mentionnant le profil actif
  if (activeProfile?.name) {
    const nameNorm = activeProfile.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_]+/g, '');
    const myPending = visible.filter(
      (t) => !t.completed && t.mentions?.some((m) =>
        m.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_]+/g, '') === nameNorm,
      ),
    ).length;
    cats.push({ key: 'mine', label: labels.myTasks ?? 'Mes tâches', icon: activeProfile.avatar ?? '👤', pending: myPending });
  }

  // Par enfant (depuis les profils, comme le mobile — exclut les grossesses)
  const enfants = profiles.filter((p) => p.role === 'enfant' && p.statut !== 'grossesse');
  for (const child of enfants) {
    const pending = visible.filter(
      (t) => !t.completed && t.sourceFile.includes(`Enfants/${child.name}/`),
    ).length;
    cats.push({ key: `enfant:${child.name}`, label: child.name, icon: child.avatar ?? '👶', pending });
  }

  // Maison
  const hasMaison = visible.some((t) => t.sourceFile.startsWith('02 - Maison/'));
  if (hasMaison) {
    const pending = visible.filter(
      (t) => !t.completed && t.sourceFile.startsWith('02 - Maison/'),
    ).length;
    cats.push({ key: 'maison', label: labels.home ?? 'Maison', icon: '🏠', pending });
  }

  return cats;
}

// ─── Tri ────────────────────────────────────────────────────────────────────

/**
 * Tri standard : récurrentes d'abord, puis par date (plus proche en premier).
 */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // Récurrentes d'abord
    const aRec = a.recurrence ? 0 : 1;
    const bRec = b.recurrence ? 0 : 1;
    if (aRec !== bRec) return aRec - bRec;
    // Puis par date d'échéance
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
}

/**
 * Regrouper les tâches par sourceFile.
 */
export function groupTasksByFile(tasks: Task[]): { file: string; label: string; tasks: Task[] }[] {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = t.sourceFile || '';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return Array.from(map.entries()).map(([file, list]) => ({
    file,
    label: file ? labelFromSourceFile(file) : 'Sans fichier',
    tasks: list,
  }));
}

// ─── Labels ─────────────────────────────────────────────────────────────────

/**
 * Extraire un label lisible d'un chemin de fichier vault.
 * "02 - Maison/Tâches récurrentes.md" → "Maison"
 * "01 - Enfants/Lucas/Tâches récurrentes.md" → "Lucas"
 */
export function labelFromSourceFile(path: string): string {
  if (path.includes('Vacances')) return 'Vacances';
  if (path.includes('Maison')) return 'Maison';
  // Enfants: extraire le nom du dossier enfant
  if (path.includes('Enfants/')) {
    const parts = path.split('/');
    const enfantsIdx = parts.findIndex((p) => p.includes('Enfants'));
    if (enfantsIdx >= 0 && parts[enfantsIdx + 1]) {
      return parts[enfantsIdx + 1];
    }
  }
  // Fallback: nom du dossier parent sans préfixe numérique
  const parts = path.split('/');
  const segment = parts.length > 1 ? parts[parts.length - 2] : parts[0];
  return segment.replace(/^\d+\s*-\s*/, '').trim() || segment;
}

// ─── Transformation de contenu ──────────────────────────────────────────────

/**
 * Transforme une ligne markdown de tâche pour toggle check/uncheck.
 * Retourne la ligne modifiée.
 *
 * - Tâche complétée → décoche, retire ✅ date
 * - Tâche récurrente non-complétée → avance la date, reste décochée
 * - Tâche simple non-complétée → coche, ajoute ✅ date
 */
export function toggleTaskLine(
  line: string,
  task: { completed: boolean; recurrence?: string; dueDate?: string },
  today?: string,
): string {
  const ref = today ?? todayISO();

  if (task.completed) {
    // Décocher : [x] → [ ], retirer ✅ date
    return line
      .replace(/^(\s*- \[)[xX](\])/, '$1 $2')
      .replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, '');
  }

  if (task.recurrence && task.dueDate) {
    // Récurrente : avancer la date sans cocher
    const newDate = nextOccurrence(task.dueDate, task.recurrence);
    return line.replace(/📅\s*\d{4}-\d{2}-\d{2}/, `📅 ${newDate}`);
  }

  // Simple : cocher + ajouter ✅ date
  let updated = line
    .replace(/^(\s*- \[)\s(\])/, '$1x$2')
    .replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, '');
  return `${updated} ✅ ${ref}`;
}
