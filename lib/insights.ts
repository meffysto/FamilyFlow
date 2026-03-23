/**
 * insights.ts — Moteur d'insights locaux (pur code, zéro réseau)
 *
 * Analyse déterministe du vault state pour générer des cartes
 * intelligentes : alertes, rappels, suggestions, stats.
 *
 * Aucune dépendance externe — fonctionne hors-ligne.
 */

import { format, differenceInCalendarDays, isToday, isTomorrow, isYesterday, parseISO, addDays } from 'date-fns';
import { t } from 'i18next';
import type { Task, RDV, StockItem, MealItem, CourseItem, Profile, Defi, GratitudeDay, Memory, VacationConfig, GamificationData, Anniversary } from './types';
import { isRdvUpcoming } from './parser';
import { formatDateLocalized } from './date-locale';
import { LOOT_THRESHOLD } from './gamification';
import { SKILL_TREE, SKILL_CATEGORIES, detectAgeBracket, type SkillDefinition } from './gamification/skill-tree';
import type { SkillTreeData } from './types';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type InsightCategory = 'alert' | 'reminder' | 'suggestion' | 'stat';
export type InsightPriority = 'high' | 'medium' | 'low';

export interface InsightAction {
  label: string;
  type: 'navigate' | 'addCourse' | 'dismiss';
  route?: string;
  params?: Record<string, string>;
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
  anniversaries?: Anniversary[];
  skillTrees?: SkillTreeData[];
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
  if (isToday(d)) return t('insights:relative.today');
  if (isTomorrow(d)) return t('insights:relative.tomorrow');
  if (isYesterday(d)) return t('insights:relative.yesterday');
  const days = daysUntil(now, dateStr);
  if (days > 0 && days <= 7) return t('insights:relative.inDays', { count: days });
  if (days < 0) return t('insights:relative.daysAgo', { count: Math.abs(days) });
  return formatDateLocalized(dateStr);
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
    (tk) => !tk.completed && tk.dueDate && daysSince(tc.now, tk.dueDate) > 0,
  );

  if (overdue.length === 0) return insights;

  // Tâches en retard critique (> 3 jours)
  const critical = overdue.filter((tk) => daysSince(tc.now, tk.dueDate!) > 3);
  if (critical.length > 0) {
    const oldest = Math.max(...critical.map((tk) => daysSince(tc.now, tk.dueDate!)));
    insights.push({
      id: 'overdue-critical',
      icon: '🚨',
      title: t('insights:overdueCritical.title', { count: critical.length }),
      body: t('insights:overdueCritical.body', { days: oldest }),
      priority: 'high',
      category: 'alert',
      action: { label: t('insights:actions.viewTasks'), type: 'navigate', route: '/(tabs)/tasks' },
    });
  } else if (overdue.length > 0) {
    insights.push({
      id: 'overdue-tasks',
      icon: '⚠️',
      title: t('insights:overdueTasks.title', { count: overdue.length }),
      body: overdue.slice(0, 3).map((tk) => tk.text).join(', '),
      priority: 'medium',
      category: 'alert',
      action: { label: t('insights:actions.viewTasks'), type: 'navigate', route: '/(tabs)/tasks' },
    });
  }

  return insights;
}

function rdvInsights(input: InsightInput, tc: TimeContext): Insight[] {
  const insights: Insight[] = [];

  const upcoming = input.rdvs.filter(
    (r) => isRdvUpcoming(r),
  );

  // RDV dans les 48h
  const imminent = upcoming.filter((r) => daysUntil(tc.now, r.date_rdv) <= 2);
  for (const rdv of imminent.slice(0, 2)) {
    const quand = formatRelativeDate(tc.now, rdv.date_rdv);
    const questionsNote = rdv.questions && rdv.questions.length > 0
      ? '' : t('insights:rdvImminent.prepareQuestions');
    insights.push({
      id: `rdv-imminent-${rdv.sourceFile}`,
      icon: '🏥',
      title: `${rdv.type_rdv} ${rdv.enfant} ${quand}`,
      body: `${rdv.heure || ''} — ${rdv.lieu || rdv.médecin || ''}${questionsNote}`,
      priority: 'high',
      category: 'reminder',
      action: { label: t('insights:actions.viewRdv'), type: 'navigate', route: '/(tabs)/rdv' },
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
      title: t('insights:rdvVaccin.title', { child: rdv.enfant, when: formatRelativeDate(tc.now, rdv.date_rdv) }),
      body: t('insights:rdvVaccin.body', { time: rdv.heure, doctor: rdv.médecin || rdv.lieu || '' }),
      priority: 'medium',
      category: 'reminder',
    });
  }

  return insights;
}

function stockInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const low = input.stock.filter((s) => s.tracked !== false && s.quantite <= s.seuil && s.seuil > 0);

  if (low.length === 0) return insights;

  const critical = low.filter((s) => s.quantite === 0);
  if (critical.length > 0) {
    insights.push({
      id: 'stock-critical',
      icon: '🔴',
      title: t('insights:stockCritical.title', { products: critical.map((s) => s.produit).join(', ') }),
      body: t('insights:stockCritical.body'),
      priority: 'high',
      category: 'alert',
      action: { label: t('insights:actions.viewStock'), type: 'navigate', route: '/(tabs)/stock' },
    });
  }

  const warning = low.filter((s) => s.quantite > 0);
  if (warning.length > 0) {
    // Vérifier si déjà dans les courses
    const courseTexts = input.courses.map((c) => c.text.toLowerCase());
    const notInCourses = warning.filter(
      (s) => !courseTexts.some((ct) => ct.includes(s.produit.toLowerCase())),
    );

    if (notInCourses.length > 0) {
      insights.push({
        id: 'stock-low',
        icon: '📦',
        title: t('insights:stockLow.title', { count: notInCourses.length }),
        body: notInCourses.map((s) => `${s.produit} (${s.quantite}/${s.seuil})`).join(', '),
        priority: 'medium',
        category: 'alert',
        action: {
          label: t('insights:actions.addToShopping'),
          type: 'addCourse',
          payload: notInCourses.map((s) => ({
            text: `${s.produit}${s.qteAchat ? ` x${s.qteAchat}` : ''}`,
            section: s.section ?? 'Produits bébé',
          })),
        },
      });
    }
  }

  return insights;
}

function mealInsights(input: InsightInput, tc: TimeContext): Insight[] {
  const insights: Insight[] = [];
  if (input.meals.length === 0) return insights;

  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  // Day names used for matching meal data (always French in vault)
  const dayNamesFR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const todayDayFR = dayNamesFR[tc.now.getDay()];
  const todayDayDisplay = t(`insights:days.${dayKeys[tc.now.getDay()]}`);

  // Repas non planifiés aujourd'hui
  const todayMeals = input.meals.filter(
    (m) => m.day.toLowerCase() === todayDayFR.toLowerCase(),
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
        title: t('insights:mealsMissing.title', { count: relevant.length }),
        body: relevant.map((m) => m.mealType).join(', ') + ` — ${todayDayDisplay}`,
        priority: 'medium',
        category: 'suggestion',
        action: { label: t('insights:actions.plan'), type: 'navigate', route: '/(tabs)/meals' },
      });
    }
  }

  // Repas non planifiés demain (le soir, pour anticiper)
  if (tc.hour >= 18) {
    const tomorrowIdx = (tc.now.getDay() + 1) % 7;
    const tomorrowDayFR = dayNamesFR[tomorrowIdx];
    const tomorrowDayDisplay = t(`insights:days.${dayKeys[tomorrowIdx]}`);
    const tomorrowMeals = input.meals.filter(
      (m) => m.day.toLowerCase() === tomorrowDayFR.toLowerCase(),
    );
    const tomorrowMissing = tomorrowMeals.filter((m) => !m.text || m.text.trim() === '');

    if (tomorrowMissing.length >= 2) {
      insights.push({
        id: 'meals-tomorrow',
        icon: '📋',
        title: t('insights:mealsTomorrow.title', { count: tomorrowMissing.length }),
        body: `${tomorrowDayDisplay} : ${tomorrowMissing.map((m) => m.mealType).join(', ')}`,
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
      if (dates.length === 0) return { name: e.name, days: -1 };
      // Trouver la date la plus récente sans trier
      const latest = dates.reduce((a, b) => a > b ? a : b);
      return { name: e.name, days: daysSince(tc.now, latest) };
    });

    const noPhotos = streaks.filter((s) => s.days === -1);
    const longMissing = streaks.filter((s) => s.days >= 3);
    const bodyParts: string[] = [];
    if (noPhotos.length > 0) {
      bodyParts.push(noPhotos.map((s) => t('insights:photosMissingLong.noPhotos', { name: s.name })).join(', '));
    }
    if (longMissing.length > 0) {
      bodyParts.push(longMissing.map((s) => t('insights:photosMissingLong.daysMissing', { name: s.name, count: s.days })).join(', '));
    }
    if (bodyParts.length > 0) {
      insights.push({
        id: 'photos-missing-long',
        icon: '📸',
        title: t('insights:photosMissingLong.title'),
        body: bodyParts.join(', '),
        priority: 'medium',
        category: 'reminder',
        action: { label: t('insights:actions.viewPhotos'), type: 'navigate', route: '/(tabs)/photos' },
      });
    } else if (missingPhoto.length > 0) {
      insights.push({
        id: 'photos-missing-today',
        icon: '📸',
        title: t('insights:photosMissingToday.title'),
        body: t('insights:photosMissingToday.body', { names: missingPhoto.map((e) => e.name).join(', ') }),
        priority: 'low',
        category: 'reminder',
        action: { label: t('insights:actions.addPhoto'), type: 'navigate', route: '/(tabs)/photos' },
      });
    }
  }

  return insights;
}

function streakInsights(input: InsightInput, tc: TimeContext): Insight[] {
  const insights: Insight[] = [];
  const profile = input.activeProfile;
  if (!profile) return insights;

  // Série de tâches complétées
  if (profile.streak >= 5) {
    insights.push({
      id: 'streak-tasks',
      icon: '🔥',
      title: t('insights:streakTasks.title', { count: profile.streak }),
      body: t('insights:streakTasks.body'),
      priority: 'low',
      category: 'stat',
    });
  }

  // Série de gratitudes
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
      title: t('insights:gratitudeReminder.title'),
      body: t('insights:gratitudeReminder.body'),
      priority: 'low',
      category: 'reminder',
      action: { label: t('insights:actions.write'), type: 'navigate', route: '/(tabs)/gratitude' },
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
        title: t('insights:defiEnding.title', { title: defi.title, when: formatRelativeDate(tc.now, defi.endDate) }),
        body: t('insights:defiEnding.body', { emoji: defi.emoji, count: daysLeft }),
        priority: 'high',
        category: 'reminder',
        action: { label: t('insights:actions.viewChallenge'), type: 'navigate', route: '/(tabs)/defis' },
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
          title: t('insights:defiCheckin.title', { title: defi.title }),
          body: t('insights:defiCheckin.body'),
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
      title: t('insights:coursesLong.title', { count: pending.length }),
      body: t('insights:coursesLong.body'),
      priority: 'medium',
      category: 'suggestion',
      action: { label: t('insights:actions.viewList'), type: 'navigate', route: '/(tabs)/meals', params: { tab: 'courses' } },
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
      title: t('insights:vacationEnding.title'),
      body: daysLeft === 0 ? t('insights:vacationEnding.bodyToday') : t('insights:vacationEnding.bodyTomorrow'),
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
        title: t('insights:lootClose.title', { remaining }),
        body: t('insights:lootClose.body'),
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
      title: t('insights:lootAvailable.title', { count: profile.lootBoxesAvailable }),
      body: t('insights:lootAvailable.body'),
      priority: 'medium',
      category: 'suggestion',
      action: { label: t('insights:actions.open'), type: 'navigate', route: '/(tabs)/loot' },
    });
  }

  return insights;
}

function anniversaryInsights(input: InsightInput, tc: TimeContext): Insight[] {
  const insights: Insight[] = [];
  const anniversaries = input.anniversaries;
  if (!anniversaries || anniversaries.length === 0) return insights;

  const now = tc.now;
  const currentYear = now.getFullYear();

  for (const a of anniversaries) {
    const [mm, dd] = a.date.split('-').map(Number);
    if (!mm || !dd) continue;

    const thisYear = new Date(currentYear, mm - 1, dd);
    thisYear.setHours(0, 0, 0, 0);
    const today = new Date(currentYear, now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);

    let days = Math.round((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) continue; // passé cette année → pas imminent

    // Uniquement les 3 prochains jours pour les insights
    if (days > 3) continue;

    const age = a.birthYear ? currentYear - a.birthYear : null;
    const ageText = age !== null ? ` (${age})` : '';

    if (days === 0) {
      insights.push({
        id: `anniversary-today-${a.name}`,
        icon: '🎂',
        title: t('insights:anniversaryToday.title', { name: a.name }),
        body: t('insights:anniversaryToday.body', { name: a.name, age: ageText }),
        priority: 'high',
        category: 'reminder',
      });
    } else {
      const quand = days === 1 ? t('insights:relative.tomorrow') : t('insights:relative.inDays', { count: days });
      insights.push({
        id: `anniversary-soon-${a.name}`,
        icon: '🎈',
        title: t('insights:anniversarySoon.title', { name: a.name, when: quand }),
        body: `${a.name}${ageText}${a.category ? ` · ${a.category}` : ''}`,
        priority: days === 1 ? 'medium' : 'low',
        category: 'reminder',
      });
    }
  }

  return insights;
}

// ─── Jalons développementaux ─────────────────────────────────────────────────

/** Calcule l'âge en mois depuis une date de naissance */
function ageInMonths(birthdate: string): number {
  const now = new Date();
  const parts = birthdate.split('-').map(Number);
  const birth = new Date(parts[0], (parts[1] ?? 1) - 1, parts[2] ?? 1);
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) return months - 1;
  return months;
}

function skillTreeInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  if (!input.skillTrees) return insights;

  const children = input.profiles.filter((p) => p.role === 'enfant' && p.birthdate);

  for (const child of children) {
    const months = ageInMonths(child.birthdate!);
    const bracket = detectAgeBracket(child.birthdate!);
    const tree = input.skillTrees.find((st) => st.profileId === child.id);
    const unlockedIds = new Set(tree?.unlocked.map((u) => u.skillId) ?? []);

    // Jalons attendus pour cet âge, non encore débloqués
    const dueJalons = SKILL_TREE.filter((s) =>
      s.ageBracketId === bracket &&
      s.type === 'jalon' &&
      s.expectedMonths != null &&
      s.expectedMonths <= months &&
      !unlockedIds.has(s.id)
    );

    // Drapeaux rouges : jalons avec redFlagMonths <= âge actuel (toujours affichés)
    const redFlags = dueJalons.filter((s) => s.redFlagMonths != null && s.redFlagMonths <= months);

    if (redFlags.length > 0) {
      const first = redFlags[0];
      insights.push({
        id: `skill-redflag-${child.id}`,
        icon: '⚠️',
        title: t('insights:skillRedFlag.title', { name: child.name }),
        body: t('insights:skillRedFlag.body', { label: first.label, months: months - first.expectedMonths! }),
        priority: 'high',
        category: 'alert',
        action: { label: t('insights:actions.viewSkills'), type: 'navigate', route: '/(tabs)/skills' },
      });
    }

    // Suggestions : adapter le message selon le nombre de jalons en attente
    if (dueJalons.length > 5 && unlockedIds.size === 0) {
      // Nouveau profil avec beaucoup de jalons en retard → message d'accueil
      insights.push({
        id: `skill-onboard-${child.id}`,
        icon: '🌳',
        title: t('insights:skillOnboard.title', { name: child.name, months }),
        body: t('insights:skillOnboard.body', { count: dueJalons.length }),
        priority: 'medium',
        category: 'suggestion',
        action: { label: t('insights:actions.start'), type: 'navigate', route: '/(tabs)/skills' },
      });
    } else if (dueJalons.length > 0) {
      // Profil en cours → prochain jalon le plus récent (le plus proche de l'âge actuel)
      const mostRecent = dueJalons.reduce((best, s) =>
        (s.expectedMonths ?? 0) > (best.expectedMonths ?? 0) ? s : best
      , dueJalons[0]);
      const cat = SKILL_CATEGORIES.find((c) => c.id === mostRecent.categoryId);
      insights.push({
        id: `skill-due-${child.id}`,
        icon: cat?.emoji ?? '🌳',
        title: t('insights:skillDue.title', { name: child.name }),
        body: t('insights:skillDue.body', { label: mostRecent.label, months: mostRecent.expectedMonths }),
        priority: 'medium',
        category: 'suggestion',
        action: { label: t('insights:actions.viewSkills'), type: 'navigate', route: '/(tabs)/skills' },
      });
    }
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
    ...anniversaryInsights(input, tc),
    ...skillTreeInsights(input),
  ];

  // Tri par priorité
  const priorityOrder: Record<InsightPriority, number> = { high: 0, medium: 1, low: 2 };
  all.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return all;
}
