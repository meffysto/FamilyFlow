/**
 * weekly-recap.ts — Agrégation des données de la semaine pour le bilan familial
 *
 * Construit un résumé structuré de la semaine (lundi → dimanche)
 * utilisable pour générer un bilan IA via generateWeeklyBilan.
 */

import { startOfWeek, endOfWeek, isWithinInterval, parseISO, format } from 'date-fns';
import type { Task, MealItem, MoodEntry, ChildQuote, Defi, Profile, StockItem } from './types';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface WeeklyRecapData {
  weekStart: string;           // YYYY-MM-DD (lundi)
  weekEnd: string;             // YYYY-MM-DD (dimanche)
  tasksCompleted: number;
  menageTasksCompleted: number;
  mealsCookedCount: number;    // repas avec un texte non vide
  mealsHighlights: string[];   // jusqu'à 5 noms de plats
  moodsAverage: number | null; // moyenne 1-5
  quotesOfWeek: { citation: string; enfant: string }[];
  defisProgress: { title: string; emoji: string; progress: number }[];
  pointsTotal: number;         // approximatif depuis tâches complétées
  recipesUsed: string[];
  stockAlerts: string[];       // produits sous le seuil
}

// ─── Helpers internes ───────────────────────────────────────────────────────────

/** Vérifie si une date YYYY-MM-DD tombe dans l'intervalle de la semaine */
function estDansLaSemaine(dateStr: string | undefined, debut: Date, fin: Date): boolean {
  if (!dateStr) return false;
  try {
    const d = parseISO(dateStr);
    return isWithinInterval(d, { start: debut, end: fin });
  } catch {
    return false;
  }
}

/** Compte les tâches complétées dans la semaine */
function compterTachesCompletees(tasks: Task[], debut: Date, fin: Date): number {
  return tasks.filter(t => t.completed && estDansLaSemaine(t.completedDate, debut, fin)).length;
}

/** Extrait les plats non vides de la semaine (jusqu'à 5) */
function extrairePlats(meals: MealItem[]): { count: number; highlights: string[] } {
  const platsNonVides = meals
    .map(m => m.text.trim())
    .filter(t => t.length > 0 && t !== '-');

  // Dédupliquer pour les highlights
  const unique = [...new Set(platsNonVides)];

  return {
    count: platsNonVides.length,
    highlights: unique.slice(0, 5),
  };
}

/** Calcule la moyenne des humeurs de la semaine */
function calculerMoyenneHumeurs(moods: MoodEntry[], debut: Date, fin: Date): number | null {
  const humeursSemaine = moods.filter(m => estDansLaSemaine(m.date, debut, fin));
  if (humeursSemaine.length === 0) return null;

  const somme = humeursSemaine.reduce((acc, m) => acc + m.level, 0);
  return Math.round((somme / humeursSemaine.length) * 10) / 10;
}

/** Récupère les mots d'enfants de la semaine */
function extraireCitations(quotes: ChildQuote[], debut: Date, fin: Date): { citation: string; enfant: string }[] {
  return quotes
    .filter(q => estDansLaSemaine(q.date, debut, fin))
    .map(q => ({ citation: q.citation, enfant: q.enfant }));
}

/** Calcule la progression des défis actifs */
function calculerProgressionDefis(defis: Defi[], debut: Date, fin: Date): { title: string; emoji: string; progress: number }[] {
  return defis
    .filter(d => d.status === 'active')
    .map(d => {
      const joursProgres = d.progress.filter(p =>
        p.completed && estDansLaSemaine(p.date, debut, fin)
      ).length;

      // Progression globale du défi (pas seulement la semaine)
      const totalCompletes = d.progress.filter(p => p.completed).length;
      const progressPct = d.targetDays > 0
        ? Math.round((totalCompletes / d.targetDays) * 100)
        : 0;

      return {
        title: d.title,
        emoji: d.emoji,
        progress: Math.min(progressPct, 100),
      };
    })
    .filter(d => d.progress > 0); // Ne garder que ceux avec de la progression
}

/** Extrait les recettes référencées dans les repas */
function extraireRecettesUtilisees(meals: MealItem[]): string[] {
  const recettes = meals
    .filter(m => m.recipeRef && m.recipeRef.length > 0)
    .map(m => {
      // Extraire le nom de la recette depuis le chemin (ex: "Plats/Pates Carbonara" → "Pates Carbonara")
      const parts = m.recipeRef!.split('/');
      return parts[parts.length - 1];
    });

  return [...new Set(recettes)];
}

/** Trouve les produits en stock sous le seuil */
function trouverAlertesStock(stock: StockItem[]): string[] {
  return stock
    .filter(s => s.quantite < s.seuil)
    .map(s => s.produit)
    .slice(0, 10); // Limiter à 10 alertes
}

// ─── Fonction principale ────────────────────────────────────────────────────────

/** Points approximatifs par tâche complétée */
const POINTS_PAR_TACHE = 10;

/**
 * Construit les données récapitulatives de la semaine en cours (lundi → dimanche).
 */
export function buildWeeklyRecapData(
  tasks: Task[],
  menageTasks: Task[],
  meals: MealItem[],
  moods: MoodEntry[],
  quotes: ChildQuote[],
  defis: Defi[],
  profiles: Profile[],
  stock: StockItem[],
): WeeklyRecapData {
  const maintenant = new Date();

  // Semaine lundi → dimanche
  const debut = startOfWeek(maintenant, { weekStartsOn: 1 });
  debut.setHours(0, 0, 0, 0);

  const fin = endOfWeek(maintenant, { weekStartsOn: 1 });
  fin.setHours(23, 59, 59, 999);

  const tachesCompletees = compterTachesCompletees(tasks, debut, fin);
  const menageCompletees = compterTachesCompletees(menageTasks, debut, fin);
  const { count: repasCount, highlights: repasHighlights } = extrairePlats(meals);
  const moyenneHumeurs = calculerMoyenneHumeurs(moods, debut, fin);
  const citations = extraireCitations(quotes, debut, fin);
  const defisProgress = calculerProgressionDefis(defis, debut, fin);
  const recettes = extraireRecettesUtilisees(meals);
  const alertes = trouverAlertesStock(stock);
  const pointsTotal = (tachesCompletees + menageCompletees) * POINTS_PAR_TACHE;

  return {
    weekStart: format(debut, 'yyyy-MM-dd'),
    weekEnd: format(fin, 'yyyy-MM-dd'),
    tasksCompleted: tachesCompletees,
    menageTasksCompleted: menageCompletees,
    mealsCookedCount: repasCount,
    mealsHighlights: repasHighlights,
    moodsAverage: moyenneHumeurs,
    quotesOfWeek: citations,
    defisProgress,
    pointsTotal,
    recipesUsed: recettes,
    stockAlerts: alertes,
  };
}

// ─── Formatage pour le prompt IA ─────────────────────────────────────────────────

/**
 * Formate les données du récap en texte structuré pour le prompt IA.
 * Les noms ne sont pas anonymisés ici — c'est géré par l'appelant.
 */
export function formatRecapForAI(data: WeeklyRecapData): string {
  const lignes: string[] = [];

  lignes.push(`Bilan de la semaine du ${data.weekStart} au ${data.weekEnd}`);
  lignes.push('');

  // Tâches
  const totalTaches = data.tasksCompleted + data.menageTasksCompleted;
  lignes.push(`Tâches complétées : ${totalTaches} (dont ${data.menageTasksCompleted} ménage)`);

  // Points
  if (data.pointsTotal > 0) {
    lignes.push(`Points gagnés : ~${data.pointsTotal}`);
  }

  // Repas
  if (data.mealsCookedCount > 0) {
    lignes.push(`Repas planifiés : ${data.mealsCookedCount}`);
    if (data.mealsHighlights.length > 0) {
      lignes.push(`Plats de la semaine : ${data.mealsHighlights.join(', ')}`);
    }
  }

  // Recettes utilisées
  if (data.recipesUsed.length > 0) {
    lignes.push(`Recettes utilisées : ${data.recipesUsed.join(', ')}`);
  }

  // Humeurs
  if (data.moodsAverage !== null) {
    lignes.push(`Humeur moyenne : ${data.moodsAverage}/5`);
  }

  // Mots d'enfants
  if (data.quotesOfWeek.length > 0) {
    lignes.push('');
    lignes.push('Mots d\'enfants de la semaine :');
    for (const q of data.quotesOfWeek) {
      lignes.push(`- ${q.enfant} : « ${q.citation} »`);
    }
  }

  // Défis
  if (data.defisProgress.length > 0) {
    lignes.push('');
    lignes.push('Défis en cours :');
    for (const d of data.defisProgress) {
      lignes.push(`- ${d.emoji} ${d.title} : ${d.progress}%`);
    }
  }

  // Alertes stock
  if (data.stockAlerts.length > 0) {
    lignes.push('');
    lignes.push(`Stocks bas : ${data.stockAlerts.join(', ')}`);
  }

  return lignes.join('\n');
}
