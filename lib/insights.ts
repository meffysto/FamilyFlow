/**
 * insights.ts — Moteur d'insights locaux (pur code, zéro réseau)
 *
 * Analyse déterministe du vault state pour générer des cartes
 * intelligentes : alertes, rappels, suggestions, stats.
 *
 * Aucune dépendance externe — fonctionne hors-ligne.
 */

import { format, differenceInCalendarDays, isToday, isTomorrow, isYesterday, parseISO, addDays } from 'date-fns';
import type { Task, RDV, StockItem, MealItem, CourseItem, Profile, Defi, GratitudeDay, Memory, VacationConfig, GamificationData } from './types';
import { formatDateForDisplay } from './parser';
import { LOOT_THRESHOLD } from '../constants/rewards';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type InsightCategory = 'alert' | 'reminder' | 'suggestion' | 'stat';
export type InsightPriority = 'high' | 'medium' | 'low';

export interface InsightAction {
  label: string;
  type: 'navigate' | 'addCourse' | 'dismiss';
  route?: string;
  payload?: any;
}

export interface Insight {
  id: string;
  icon: string;
  title: string;
  body: string;
  priority: InsightPriority;
  category: InsightCategory;
  action?: InsightAction;
}

// ─── Input (sous-ensemble du VaultState) ────────────────────────────────────────

export interface InsightInput {
  tasks: Task[];
  menageTasks: Task[];
  courses: CourseItem[];
  stock: StockItem[];
  meals: MealItem[];
  rdvs: RDV[];
  profiles: Profile[];
  activeProfile: Profile | null;
  defis: Defi[];
  gratitudeDays: GratitudeDay[];
  memories: Memory[];
  vacationConfig: VacationConfig | null;
  isVacationActive: boolean;
  gamiData: GamificationData | null;
  photoDates: Record<string, string[]>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function daysSince(now: Date, dateStr: string): number {
  return differenceInCalendarDays(now, parseISO(dateStr));
}

function daysUntil(now: Date, dateStr: string): number {
  return differenceInCalendarDays(parseISO(dateStr), now);
}

function formatRelativeDate(now: Date, dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return "aujourd'hui";
  if (isTomorrow(d)) return 'demain';
  if (isYesterday(d)) return 'hier';
  const days = daysUntil(now, dateStr);
  if (days > 0 && days <= 7) return `dans ${days} jour${days > 1 ? 's' : ''}`;
  if (days < 0) return `il y a ${Math.abs(days)} jour${Math.abs(days) > 1 ? 's' : ''}`;
  return formatDateForDisplay(dateStr);
}

/** Contexte temporel calculé une seule fois par appel à generateInsights */
interface TimeContext {
  now: Date;
  todayStr: string;
  yesterdayStr: string;
  hour: number;
}

// ─── Règles d'insights ─────────────────────────────────────────────────────────

function overdueTaskInsights(input: InsightInput, tc: TimeContext): Insight[] {
  const insights: Insight[] = [];
  const overdue = input.tasks.filter(
    (t) => !t.completed && t.dueDate && daysSince(tc.now, t.dueDate) > 0,
  );

  if (overdue.length === 0) return insights;

  // Tâches en retard critique (> 3 jours)
  const critical = overdue.filter((t) => daysSince(tc.now, t.dueDate!) > 3);
  if (critical.length > 0) {
    const oldest = Math.max(...critical.map((t) => daysSince(tc.now, t.dueDate!)));
    insights.push({
      id: 'overdue-critical',
      icon: '🚨',
      title: `${critical.length} tâche${critical.length > 1 ? 's' : ''} en retard critique`,
      body: `Retard max : ${oldest} jours. Pensez à les traiter ou reporter.`,
      priority: 'high',
      category: 'alert',
      action: { label: 'Voir les tâches', type: 'navigate', route: '/(tabs)/tasks' },
    });
  } else if (overdue.length > 0) {
    insights.push({
      id: 'overdue-tasks',
      icon: '⚠️',
      title: `${overdue.length} tâche${overdue.length > 1 ? 's' : ''} en retard`,
      body: overdue.slice(0, 3).map((t) => t.text).join(', '),
      priority: 'medium',
      category: 'alert',
      action: { label: 'Voir les tâches', type: 'navigate', route: '/(tabs)/tasks' },
    });
  }

  return insights;
}

function rdvInsights(input: InsightInput, tc: TimeContext): Insight[] {
  const insights: Insight[] = [];

  const upcoming = input.rdvs.filter(
    (r) => r.statut === 'planifié' && r.date_rdv >= tc.todayStr,
  );

  // RDV dans les 48h
  const imminent = upcoming.filter((r) => daysUntil(tc.now, r.date_rdv) <= 2);
  for (const rdv of imminent.slice(0, 2)) {
    const quand = formatRelativeDate(tc.now, rdv.date_rdv);
    const questionsNote = rdv.questions && rdv.questions.length > 0
      ? '' : ' — pensez à préparer vos questions';
    insights.push({
      id: `rdv-imminent-${rdv.sourceFile}`,
      icon: '🏥',
      title: `${rdv.type_rdv} ${rdv.enfant} ${quand}`,
      body: `${rdv.heure} — ${rdv.lieu || rdv.médecin || ''}${questionsNote}`,
      priority: 'high',
      category: 'reminder',
      action: { label: 'Voir le RDV', type: 'navigate', route: '/(tabs)/rdv' },
    });
  }

  // RDV vaccin à venir (7 jours)
  const vaccins = upcoming.filter((r) => {
    const d = daysUntil(tc.now, r.date_rdv);
    return r.type_rdv === 'vaccin' && d <= 7 && d > 2;
  });
  for (const rdv of vaccins) {
    insights.push({
      id: `rdv-vaccin-${rdv.sourceFile}`,
      icon: '💉',
      title: `Vaccin ${rdv.enfant} ${formatRelativeDate(tc.now, rdv.date_rdv)}`,
      body: `${rdv.heure} chez ${rdv.médecin || rdv.lieu || 'le médecin'}`,
      priority: 'medium',
      category: 'reminder',
    });
  }

  return insights;
}

function stockInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const low = input.stock.filter((s) => s.quantite <= s.seuil && s.seuil > 0);

  if (low.length === 0) return insights;

  const critical = low.filter((s) => s.quantite === 0);
  if (critical.length > 0) {
    insights.push({
      id: 'stock-critical',
      icon: '🔴',
      title: `Stock épuisé : ${critical.map((s) => s.produit).join(', ')}`,
      body: 'Pensez à réapprovisionner rapidement.',
      priority: 'high',
      category: 'alert',
      action: { label: 'Voir le stock', type: 'navigate', route: '/(tabs)/more' },
    });
  }

  const warning = low.filter((s) => s.quantite > 0);
  if (warning.length > 0) {
    // Vérifier si déjà dans les courses
    const courseTexts = input.courses.map((c) => c.text.toLowerCase());
    const notInCourses = warning.filter(
      (s) => !courseTexts.some((t) => t.includes(s.produit.toLowerCase())),
    );

    if (notInCourses.length > 0) {
      insights.push({
        id: 'stock-low',
        icon: '📦',
        title: `Stock bas : ${notInCourses.length} produit${notInCourses.length > 1 ? 's' : ''}`,
        body: notInCourses.map((s) => `${s.produit} (${s.quantite}/${s.seuil})`).join(', '),
        priority: 'medium',
        category: 'alert',
        action: {
          label: 'Ajouter aux courses',
          type: 'addCourse',
          payload: notInCourses.map((s) => `${s.produit}${s.qteAchat ? ` x${s.qteAchat}` : ''}`),
        },
      });
    }
  }

  return insights;
}

function mealInsights(input: InsightInput, tc: TimeContext): Insight[] {
  const insights: Insight[] = [];
  if (input.meals.length === 0) return insights;

  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const todayDay = dayNames[tc.now.getDay()];

  // Repas non planifiés aujourd'hui
  const todayMeals = input.meals.filter(
    (m) => m.day.toLowerCase() === todayDay.toLowerCase(),
  );
  const missing = todayMeals.filter((m) => !m.text || m.text.trim() === '');

  if (missing.length > 0) {
    // Filtrer les repas déjà passés
    const relevant = missing.filter((m) => {
      if (m.mealType === 'Petit-déj' && tc.hour >= 11) return false;
      if (m.mealType === 'Déjeuner' && tc.hour >= 15) return false;
      return true;
    });

    if (relevant.length > 0) {
      insights.push({
        id: 'meals-missing',
        icon: '🍽️',
        title: `${relevant.length} repas non prévu${relevant.length > 1 ? 's' : ''}`,
        body: relevant.map((m) => m.mealType).join(', ') + ` — ${todayDay}`,
        priority: 'medium',
        category: 'suggestion',
        action: { label: 'Planifier', type: 'navigate', route: '/(tabs)/more' },
      });
    }
  }

  // Repas non planifiés demain (le soir, pour anticiper)
  if (tc.hour >= 18) {
    const tomorrowDay = dayNames[(tc.now.getDay() + 1) % 7];
    const tomorrowMeals = input.meals.filter(
      (m) => m.day.toLowerCase() === tomorrowDay.toLowerCase(),
    );
    const tomorrowMissing = tomorrowMeals.filter((m) => !m.text || m.text.trim() === '');

    if (tomorrowMissing.length >= 2) {
      insights.push({
        id: 'meals-tomorrow',
        icon: '📋',
        title: `${tomorrowMissing.length} repas non prévu${tomorrowMissing.length > 1 ? 's' : ''} demain`,
        body: `${tomorrowDay} : ${tomorrowMissing.map((m) => m.mealType).join(', ')}`,
        priority: 'low',
        category: 'suggestion',
      });
    }
  }

  return insights;
}

function photoInsights(input: InsightInput, tc: TimeContext): Insight[] {
  const insights: Insight[] = [];
  const enfants = input.profiles.filter((p) => p.role === 'enfant' && (!p.statut || p.statut === 'ne'));

  const missingPhoto = enfants.filter((e) => {
    const dates = input.photoDates[e.id] || [];
    return !dates.includes(tc.todayStr);
  });

  if (missingPhoto.length > 0) {
    // Vérifier depuis combien de jours la photo manque
    const streaks = missingPhoto.map((e) => {
      const dates = input.photoDates[e.id] || [];
      if (dates.length === 0) return { name: e.name, days: 999 };
      // Trouver la date la plus récente sans trier
      const latest = dates.reduce((a, b) => a > b ? a : b);
      return { name: e.name, days: daysSince(tc.now, latest) };
    });

    const longMissing = streaks.filter((s) => s.days >= 3);
    if (longMissing.length > 0) {
      insights.push({
        id: 'photos-missing-long',
        icon: '📸',
        title: 'Photo du jour manquante',
        body: longMissing.map((s) => `${s.name} : ${s.days} jour${s.days > 1 ? 's' : ''} sans photo`).join(', '),
        priority: 'medium',
        category: 'reminder',
      });
    } else if (missingPhoto.length > 0) {
      insights.push({
        id: 'photos-missing-today',
        icon: '📸',
        title: "Photo du jour",
        body: `Pas encore de photo pour ${missingPhoto.map((e) => e.name).join(', ')}`,
        priority: 'low',
        category: 'reminder',
      });
    }
  }

  return insights;
}

function streakInsights(input: InsightInput, tc: TimeContext): Insight[] {
  const insights: Insight[] = [];
  const profile = input.activeProfile;
  if (!profile) return insights;

  // Streak de tâches
  if (profile.streak >= 5) {
    insights.push({
      id: 'streak-tasks',
      icon: '🔥',
      title: `Streak de ${profile.streak} jours !`,
      body: 'Continuez sur cette lancée, ne cassez pas la série.',
      priority: 'low',
      category: 'stat',
    });
  }

  // Gratitude streak
  const hasGratitudeToday = input.gratitudeDays.some(
    (d) => d.date === tc.todayStr && d.entries.some((e) => e.profileId === profile.id),
  );
  const hasGratitudeYesterday = input.gratitudeDays.some(
    (d) => d.date === tc.yesterdayStr && d.entries.some((e) => e.profileId === profile.id),
  );

  if (!hasGratitudeToday && hasGratitudeYesterday) {
    insights.push({
      id: 'gratitude-reminder',
      icon: '🙏',
      title: "Gratitude du jour",
      body: "Vous avez écrit hier — continuez la série !",
      priority: 'low',
      category: 'reminder',
    });
  }

  return insights;
}

function defiInsights(input: InsightInput, tc: TimeContext): Insight[] {
  const insights: Insight[] = [];
  const profile = input.activeProfile;

  const active = input.defis.filter((d) => d.status === 'active');

  for (const defi of active.slice(0, 2)) {
    const daysLeft = daysUntil(tc.now, defi.endDate);

    // Défi qui se termine bientôt
    if (daysLeft <= 2 && daysLeft >= 0) {
      insights.push({
        id: `defi-ending-${defi.id}`,
        icon: '🏅',
        title: `Défi "${defi.title}" se termine ${formatRelativeDate(tc.now, defi.endDate)}`,
        body: `${defi.emoji} Plus que ${daysLeft} jour${daysLeft > 1 ? 's' : ''} !`,
        priority: 'high',
        category: 'reminder',
        action: { label: 'Voir le défi', type: 'navigate', route: '/(tabs)/more' },
      });
    }

    // Check-in manquant aujourd'hui
    if (profile) {
      const todayEntry = defi.progress.find(
        (p) => p.date === tc.todayStr && p.profileId === profile.id,
      );
      if (!todayEntry && daysLeft >= 0) {
        insights.push({
          id: `defi-checkin-${defi.id}`,
          icon: defi.emoji,
          title: `Check-in "${defi.title}"`,
          body: "Vous n'avez pas encore validé aujourd'hui.",
          priority: 'medium',
          category: 'reminder',
        });
      }
    }
  }

  return insights;
}

function coursesInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const pending = input.courses.filter((c) => !c.completed);

  if (pending.length >= 15) {
    insights.push({
      id: 'courses-long',
      icon: '🛒',
      title: `${pending.length} articles en attente`,
      body: 'La liste de courses est longue — pensez à faire les courses bientôt.',
      priority: 'medium',
      category: 'suggestion',
      action: { label: 'Voir la liste', type: 'navigate', route: '/(tabs)/more' },
    });
  }

  return insights;
}

function vacationInsights(input: InsightInput, tc: TimeContext): Insight[] {
  const insights: Insight[] = [];

  if (!input.vacationConfig || !input.isVacationActive) return insights;

  const daysLeft = daysUntil(tc.now, input.vacationConfig.endDate);
  if (daysLeft <= 1 && daysLeft >= 0) {
    insights.push({
      id: 'vacation-ending',
      icon: '🏠',
      title: 'Fin des vacances',
      body: daysLeft === 0 ? 'Dernier jour de vacances !' : 'Les vacances se terminent demain.',
      priority: 'medium',
      category: 'reminder',
    });
  }

  return insights;
}

function gamificationInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const profile = input.activeProfile;
  if (!profile) return insights;

  // Proche d'une loot box
  const gami = input.gamiData;
  if (gami) {
    const threshold = LOOT_THRESHOLD[profile.role] ?? 100;
    const pointsInBox = profile.points % threshold;
    const remaining = threshold - pointsInBox;

    if (remaining <= 20 && remaining > 0) {
      insights.push({
        id: 'loot-close',
        icon: '🎁',
        title: `Plus que ${remaining} points !`,
        body: 'Encore quelques tâches pour débloquer une loot box.',
        priority: 'low',
        category: 'stat',
      });
    }
  }

  // Loot boxes non ouvertes
  if (profile.lootBoxesAvailable > 0) {
    insights.push({
      id: 'loot-available',
      icon: '🎁',
      title: `${profile.lootBoxesAvailable} loot box${profile.lootBoxesAvailable > 1 ? 'es' : ''} disponible${profile.lootBoxesAvailable > 1 ? 's' : ''}`,
      body: 'Ouvrez-la pour découvrir votre récompense !',
      priority: 'medium',
      category: 'suggestion',
      action: { label: 'Ouvrir', type: 'navigate', route: '/(tabs)/more' },
    });
  }

  return insights;
}

// ─── Moteur principal ───────────────────────────────────────────────────────────

/**
 * Génère tous les insights locaux à partir du vault state.
 * Retourne une liste triée par priorité (high → medium → low).
 */
export function generateInsights(input: InsightInput): Insight[] {
  const now = new Date();
  const tc: TimeContext = {
    now,
    todayStr: format(now, 'yyyy-MM-dd'),
    yesterdayStr: format(addDays(now, -1), 'yyyy-MM-dd'),
    hour: now.getHours(),
  };

  const all: Insight[] = [
    ...overdueTaskInsights(input, tc),
    ...rdvInsights(input, tc),
    ...stockInsights(input),
    ...mealInsights(input, tc),
    ...photoInsights(input, tc),
    ...streakInsights(input, tc),
    ...defiInsights(input, tc),
    ...coursesInsights(input),
    ...vacationInsights(input, tc),
    ...gamificationInsights(input),
  ];

  // Tri par priorité
  const priorityOrder: Record<InsightPriority, number> = { high: 0, medium: 1, low: 2 };
  all.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return all;
}
