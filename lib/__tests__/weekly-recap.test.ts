/**
 * Tests unitaires — Bilan hebdomadaire et statistiques journal bébé
 *
 * Couvre : buildWeeklyRecapData, formatRecapForAI,
 * parseJournalStats, calculerDuree, parseHeure, parseDureeToMinutes.
 */

import { buildWeeklyRecapData, formatRecapForAI, WeeklyRecapData } from '../weekly-recap';
import {
  parseJournalStats,
  calculerDuree,
  parseHeure,
  parseDureeToMinutes,
  formatMinutes,
} from '../journal-stats';
import type { Task, MealItem, MoodEntry, ChildQuote, Defi, Profile, StockItem, MoodLevel } from '../types';
import { format, startOfWeek, addDays } from 'date-fns';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Retourne une date de la semaine en cours au format YYYY-MM-DD */
function dateDeCetteSemaine(jourOffset: number = 0): string {
  const lundi = startOfWeek(new Date(), { weekStartsOn: 1 });
  return format(addDays(lundi, jourOffset), 'yyyy-MM-dd');
}

/** Crée une tâche complétée cette semaine */
function creerTache(overrides: Partial<Task> = {}): Task {
  return {
    id: `task_${Math.random().toString(36).slice(2)}`,
    text: 'Ranger la chambre',
    completed: true,
    completedDate: dateDeCetteSemaine(0),
    tags: [],
    mentions: [],
    sourceFile: 'taches.md',
    lineIndex: 0,
    ...overrides,
  };
}

/** Crée un repas */
function creerRepas(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: 'lundi:déjeuner',
    day: 'Lundi',
    mealType: 'Déjeuner',
    text: 'Pâtes carbonara',
    lineIndex: 0,
    sourceFile: 'repas.md',
    ...overrides,
  };
}

/** Crée une entrée d'humeur */
function creerHumeur(overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    date: dateDeCetteSemaine(0),
    profileId: 'lucas',
    profileName: 'Lucas',
    level: 4 as MoodLevel,
    sourceFile: 'humeurs.md',
    lineIndex: 0,
    ...overrides,
  };
}

/** Crée un mot d'enfant */
function creerCitation(overrides: Partial<ChildQuote> = {}): ChildQuote {
  return {
    date: dateDeCetteSemaine(1),
    enfant: 'Emma',
    citation: 'Pourquoi les poissons dorment pas ?',
    sourceFile: 'mots.md',
    lineIndex: 0,
    ...overrides,
  };
}

/** Crée un profil minimal */
function creerProfil(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'lucas',
    name: 'Lucas',
    role: 'enfant',
    avatar: '🦊',
    points: 100,
    level: 3,
    streak: 5,
    lootBoxesAvailable: 1,
    multiplier: 1,
    multiplierRemaining: 0,
    pityCounter: 0,
    ...overrides,
  };
}

/** Crée un défi actif avec progression cette semaine */
function creerDefi(overrides: Partial<Defi> = {}): Defi {
  return {
    id: 'defi_test',
    title: 'Lire 30 minutes par jour',
    description: 'Lire chaque soir avant de dormir',
    type: 'daily',
    startDate: dateDeCetteSemaine(0),
    endDate: dateDeCetteSemaine(6),
    targetDays: 7,
    emoji: '📖',
    difficulty: 'moyen',
    participants: ['lucas'],
    status: 'active',
    progress: [
      { date: dateDeCetteSemaine(0), profileId: 'lucas', completed: true },
      { date: dateDeCetteSemaine(1), profileId: 'lucas', completed: true },
      { date: dateDeCetteSemaine(2), profileId: 'lucas', completed: false },
    ],
    rewardPoints: 50,
    rewardLootBoxes: 1,
    ...overrides,
  };
}

/** Crée un article en stock */
function creerStock(overrides: Partial<StockItem> = {}): StockItem {
  return {
    produit: 'Lait',
    quantite: 1,
    seuil: 2,
    emplacement: 'frigo',
    lineIndex: 0,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// parseHeure
// ═══════════════════════════════════════════════════════════════════════════════

describe('parseHeure', () => {
  test('parse le format "7h30" correctement', () => {
    expect(parseHeure('7h30')).toBe(7 * 60 + 30);
  });

  test('parse le format "14:30" correctement', () => {
    expect(parseHeure('14:30')).toBe(14 * 60 + 30);
  });

  test('parse le format "7h" (sans minutes)', () => {
    expect(parseHeure('7h')).toBe(7 * 60);
  });

  test('parse le format "0:00" (minuit)', () => {
    expect(parseHeure('0:00')).toBe(0);
  });

  test('parse le format "23h59"', () => {
    expect(parseHeure('23h59')).toBe(23 * 60 + 59);
  });

  test('retourne null pour une chaîne vide', () => {
    expect(parseHeure('')).toBeNull();
  });

  test('retourne null pour un format invalide', () => {
    expect(parseHeure('abc')).toBeNull();
  });

  test('accepte les heures hors plage (pas de validation 0-23)', () => {
    // parseHeure parse le format sans valider la plage horaire
    expect(parseHeure('25:00')).toBe(25 * 60);
  });

  test('gère les espaces autour', () => {
    expect(parseHeure('  7h30  ')).toBe(7 * 60 + 30);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculerDuree
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculerDuree', () => {
  test('calcule une durée normale', () => {
    expect(calculerDuree('7h30', '9h00')).toBe('1h30');
  });

  test('calcule une durée courte (minutes seulement)', () => {
    expect(calculerDuree('14:00', '14:45')).toBe('45min');
  });

  test('calcule une durée d\'heures exactes', () => {
    expect(calculerDuree('10h', '12h')).toBe('2h');
  });

  test('gère le passage de minuit', () => {
    const result = calculerDuree('22h00', '6h00');
    expect(result).toBe('8h');
  });

  test('gère le passage de minuit avec minutes', () => {
    const result = calculerDuree('23h30', '7h00');
    expect(result).toBe('7h30');
  });

  test('retourne null avec une entrée invalide', () => {
    expect(calculerDuree('abc', '7h00')).toBeNull();
    expect(calculerDuree('7h00', 'xyz')).toBeNull();
  });

  test('retourne null pour deux entrées invalides', () => {
    expect(calculerDuree('', '')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// parseDureeToMinutes
// ═══════════════════════════════════════════════════════════════════════════════

describe('parseDureeToMinutes', () => {
  test('parse "2h30" → 150 minutes', () => {
    expect(parseDureeToMinutes('2h30')).toBe(150);
  });

  test('parse "45min" → 45 minutes', () => {
    expect(parseDureeToMinutes('45min')).toBe(45);
  });

  test('parse "1h" → 60 minutes', () => {
    expect(parseDureeToMinutes('1h')).toBe(60);
  });

  test('parse "11h30" → 690 minutes', () => {
    expect(parseDureeToMinutes('11h30')).toBe(690);
  });

  test('retourne 0 pour une chaîne vide', () => {
    expect(parseDureeToMinutes('')).toBe(0);
  });

  test('retourne 0 pour un format non reconnu', () => {
    expect(parseDureeToMinutes('abc')).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// formatMinutes
// ═══════════════════════════════════════════════════════════════════════════════

describe('formatMinutes', () => {
  test('0 minutes → chaîne vide', () => {
    expect(formatMinutes(0)).toBe('');
  });

  test('45 minutes → "45min"', () => {
    expect(formatMinutes(45)).toBe('45min');
  });

  test('60 minutes → "1h"', () => {
    expect(formatMinutes(60)).toBe('1h');
  });

  test('150 minutes → "2h30"', () => {
    expect(formatMinutes(150)).toBe('2h30');
  });

  test('minutes négatives → chaîne vide', () => {
    expect(formatMinutes(-10)).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// parseJournalStats
// ═══════════════════════════════════════════════════════════════════════════════

describe('parseJournalStats', () => {
  test('retourne des stats vides pour un contenu vide', () => {
    const stats = parseJournalStats('');
    expect(stats.biberons).toBe(0);
    expect(stats.tetees).toBe(0);
    expect(stats.couches).toBe(0);
    expect(stats.siestes).toEqual([]);
  });

  test('compte les biberons et le volume total', () => {
    const content = `## Alimentation
| Heure | Type | Détail |
|-------|------|--------|
| 7h00 | Biberon | 180ml |
| 10h30 | Biberon | 150ml |
| 14h00 | Tétée | Sein gauche |`;

    const stats = parseJournalStats(content);
    expect(stats.biberons).toBe(2);
    expect(stats.totalMl).toBe(330);
    expect(stats.tetees).toBe(1);
  });

  test('compte les couches par type', () => {
    const content = `## Couches
| Heure | Type |
|-------|------|
| 8h00 | Pipi |
| 10h00 | Selle |
| 12h00 | Mixte |
| 15h00 | Pipi |`;

    const stats = parseJournalStats(content);
    expect(stats.couches).toBe(4);
    expect(stats.couchesDetail.pipi).toBe(2);
    expect(stats.couchesDetail.selle).toBe(1);
    expect(stats.couchesDetail.mixte).toBe(1);
  });

  test('calcule le sommeil jour/nuit', () => {
    const content = `## Sommeil
| Début | Fin | Durée |
|-------|-----|-------|
| 9h30 | 11h00 | 1h30 |
| 13h00 | 14h30 | 1h30 |
| 20h00 | 7h00 | 11h |`;

    const stats = parseJournalStats(content);
    expect(stats.siestes).toHaveLength(3);
    // 9h30-11h et 13h-14h30 sont des siestes jour
    // 20h-7h est sommeil nuit
    expect(stats.sommeilJour).toBe('3h');
    expect(stats.sommeilNuit).toBe('11h');
    expect(stats.sommeilTotal).toBe('14h');
  });

  test('auto-calcule la durée si absente', () => {
    const content = `## Sommeil
| Début | Fin | Durée |
|-------|-----|-------|
| 9h00 | 10h30 | |`;

    const stats = parseJournalStats(content);
    expect(stats.siestes).toHaveLength(1);
    expect(stats.siestes[0].duree).toBe('1h30');
  });

  test('ignore les lignes sans heure', () => {
    const content = `## Alimentation
| Heure | Type | Détail |
|-------|------|--------|
| 7h00 | Biberon | 180ml |
| | Biberon | 150ml |`;

    const stats = parseJournalStats(content);
    expect(stats.biberons).toBe(1);
    expect(stats.totalMl).toBe(180);
  });

  test('gère un journal complet avec toutes les sections', () => {
    const content = `## Alimentation
| Heure | Type | Détail |
|-------|------|--------|
| 7h00 | Biberon | 210ml |
| 10h00 | Tétée | Sein droit |

## Couches
| Heure | Type |
|-------|------|
| 8h30 | Pipi |
| 11h00 | Selle |

## Sommeil
| Début | Fin | Durée |
|-------|-----|-------|
| 12h30 | 14h00 | 1h30 |`;

    const stats = parseJournalStats(content);
    expect(stats.biberons).toBe(1);
    expect(stats.totalMl).toBe(210);
    expect(stats.tetees).toBe(1);
    expect(stats.couches).toBe(2);
    expect(stats.siestes).toHaveLength(1);
    expect(stats.sommeilJour).toBe('1h30');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildWeeklyRecapData
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildWeeklyRecapData', () => {
  test('avec des données complètes, retourne un résumé structuré', () => {
    const tasks = [
      creerTache({ text: 'Ranger la chambre', completedDate: dateDeCetteSemaine(0) }),
      creerTache({ text: 'Faire la vaisselle', completedDate: dateDeCetteSemaine(1) }),
      creerTache({ text: 'Tâche non complétée', completed: false }),
    ];
    const menageTasks = [
      creerTache({ text: 'Aspirer le salon', completedDate: dateDeCetteSemaine(2) }),
    ];
    const meals = [
      creerRepas({ text: 'Pâtes carbonara' }),
      creerRepas({ id: 'mardi:dîner', text: 'Gratin dauphinois' }),
      creerRepas({ id: 'mercredi:déjeuner', text: '' }), // repas vide
    ];
    const moods = [
      creerHumeur({ level: 4 as MoodLevel, date: dateDeCetteSemaine(0) }),
      creerHumeur({ level: 3 as MoodLevel, date: dateDeCetteSemaine(1) }),
    ];
    const quotes = [
      creerCitation({ citation: 'Les nuages sont le coussin du ciel', enfant: 'Emma' }),
    ];
    const defis = [creerDefi()];
    const profiles = [creerProfil()];
    const stock = [
      creerStock({ produit: 'Lait', quantite: 1, seuil: 2 }),
      creerStock({ produit: 'Beurre', quantite: 5, seuil: 2 }),
    ];

    const recap = buildWeeklyRecapData(tasks, menageTasks, meals, moods, quotes, defis, profiles, stock);

    expect(recap.tasksCompleted).toBe(2);
    expect(recap.menageTasksCompleted).toBe(1);
    expect(recap.mealsCookedCount).toBe(2); // le repas vide est exclu
    expect(recap.mealsHighlights).toContain('Pâtes carbonara');
    expect(recap.mealsHighlights).toContain('Gratin dauphinois');
    expect(recap.moodsAverage).toBe(3.5);
    expect(recap.quotesOfWeek).toHaveLength(1);
    expect(recap.quotesOfWeek[0].enfant).toBe('Emma');
    expect(recap.defisProgress.length).toBeGreaterThanOrEqual(0);
    expect(recap.stockAlerts).toContain('Lait');
    expect(recap.stockAlerts).not.toContain('Beurre');
    expect(recap.pointsTotal).toBe(30); // (2 + 1) * 10
    expect(recap.weekStart).toBeDefined();
    expect(recap.weekEnd).toBeDefined();
  });

  test('avec des données vides, retourne des valeurs par défaut', () => {
    const recap = buildWeeklyRecapData([], [], [], [], [], [], [], []);

    expect(recap.tasksCompleted).toBe(0);
    expect(recap.menageTasksCompleted).toBe(0);
    expect(recap.mealsCookedCount).toBe(0);
    expect(recap.mealsHighlights).toEqual([]);
    expect(recap.moodsAverage).toBeNull();
    expect(recap.quotesOfWeek).toEqual([]);
    expect(recap.defisProgress).toEqual([]);
    expect(recap.pointsTotal).toBe(0);
    expect(recap.recipesUsed).toEqual([]);
    expect(recap.stockAlerts).toEqual([]);
  });

  test('avec des données partielles (seulement des tâches)', () => {
    const tasks = [
      creerTache({ completedDate: dateDeCetteSemaine(0) }),
      creerTache({ completedDate: dateDeCetteSemaine(2) }),
    ];
    const recap = buildWeeklyRecapData(tasks, [], [], [], [], [], [], []);

    expect(recap.tasksCompleted).toBe(2);
    expect(recap.mealsCookedCount).toBe(0);
    expect(recap.moodsAverage).toBeNull();
    expect(recap.pointsTotal).toBe(20);
  });

  test('ignore les tâches complétées en dehors de la semaine', () => {
    const tasks = [
      creerTache({ completedDate: '2020-01-01' }), // hors semaine
      creerTache({ completedDate: dateDeCetteSemaine(0) }), // cette semaine
    ];
    const recap = buildWeeklyRecapData(tasks, [], [], [], [], [], [], []);
    expect(recap.tasksCompleted).toBe(1);
  });

  test('ignore les tâches non complétées', () => {
    const tasks = [
      creerTache({ completed: false }),
      creerTache({ completed: true, completedDate: dateDeCetteSemaine(0) }),
    ];
    const recap = buildWeeklyRecapData(tasks, [], [], [], [], [], [], []);
    expect(recap.tasksCompleted).toBe(1);
  });

  test('déduplique les plats dans les highlights', () => {
    const meals = [
      creerRepas({ id: 'lundi:déjeuner', text: 'Pâtes carbonara' }),
      creerRepas({ id: 'mardi:déjeuner', text: 'Pâtes carbonara' }),
      creerRepas({ id: 'mercredi:déjeuner', text: 'Gratin' }),
    ];
    const recap = buildWeeklyRecapData([], [], meals, [], [], [], [], []);
    expect(recap.mealsCookedCount).toBe(3);
    expect(recap.mealsHighlights).toEqual(['Pâtes carbonara', 'Gratin']);
  });

  test('limite les highlights à 5 plats', () => {
    const meals = Array.from({ length: 10 }, (_, i) =>
      creerRepas({ id: `jour${i}:déjeuner`, text: `Plat ${i + 1}` })
    );
    const recap = buildWeeklyRecapData([], [], meals, [], [], [], [], []);
    expect(recap.mealsHighlights.length).toBeLessThanOrEqual(5);
  });

  test('extrait les recettes référencées', () => {
    const meals = [
      creerRepas({ text: 'Carbonara', recipeRef: 'Plats/Pates Carbonara' }),
      creerRepas({ id: 'mardi:dîner', text: 'Gratin', recipeRef: 'Plats/Gratin Dauphinois' }),
    ];
    const recap = buildWeeklyRecapData([], [], meals, [], [], [], [], []);
    expect(recap.recipesUsed).toContain('Pates Carbonara');
    expect(recap.recipesUsed).toContain('Gratin Dauphinois');
  });

  test('calcule la moyenne des humeurs correctement', () => {
    const moods = [
      creerHumeur({ level: 5 as MoodLevel, date: dateDeCetteSemaine(0) }),
      creerHumeur({ level: 3 as MoodLevel, date: dateDeCetteSemaine(1) }),
      creerHumeur({ level: 4 as MoodLevel, date: dateDeCetteSemaine(2) }),
    ];
    const recap = buildWeeklyRecapData([], [], [], moods, [], [], [], []);
    expect(recap.moodsAverage).toBe(4); // (5+3+4)/3 = 4
  });

  test('limite les alertes stock à 10', () => {
    const stock = Array.from({ length: 15 }, (_, i) =>
      creerStock({ produit: `Produit ${i + 1}`, quantite: 0, seuil: 5 })
    );
    const recap = buildWeeklyRecapData([], [], [], [], [], [], [], stock);
    expect(recap.stockAlerts.length).toBeLessThanOrEqual(10);
  });

  test('le weekStart est un lundi et weekEnd est un dimanche', () => {
    const recap = buildWeeklyRecapData([], [], [], [], [], [], [], []);
    const start = new Date(recap.weekStart);
    const end = new Date(recap.weekEnd);
    expect(start.getDay()).toBe(1); // lundi
    expect(end.getDay()).toBe(0); // dimanche
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// formatRecapForAI
// ═══════════════════════════════════════════════════════════════════════════════

describe('formatRecapForAI', () => {
  test('contient le titre avec les dates', () => {
    const data: WeeklyRecapData = {
      weekStart: '2026-03-16',
      weekEnd: '2026-03-22',
      tasksCompleted: 5,
      menageTasksCompleted: 2,
      mealsCookedCount: 0,
      mealsHighlights: [],
      moodsAverage: null,
      quotesOfWeek: [],
      defisProgress: [],
      pointsTotal: 70,
      recipesUsed: [],
      stockAlerts: [],
    };
    const output = formatRecapForAI(data);
    expect(output).toContain('2026-03-16');
    expect(output).toContain('2026-03-22');
  });

  test('affiche le nombre de tâches complétées', () => {
    const data: WeeklyRecapData = {
      weekStart: '2026-03-16',
      weekEnd: '2026-03-22',
      tasksCompleted: 8,
      menageTasksCompleted: 3,
      mealsCookedCount: 0,
      mealsHighlights: [],
      moodsAverage: null,
      quotesOfWeek: [],
      defisProgress: [],
      pointsTotal: 110,
      recipesUsed: [],
      stockAlerts: [],
    };
    const output = formatRecapForAI(data);
    expect(output).toContain('11'); // 8 + 3
    expect(output).toContain('3 ménage');
  });

  test('affiche les points gagnés', () => {
    const data: WeeklyRecapData = {
      weekStart: '2026-03-16',
      weekEnd: '2026-03-22',
      tasksCompleted: 5,
      menageTasksCompleted: 0,
      mealsCookedCount: 0,
      mealsHighlights: [],
      moodsAverage: null,
      quotesOfWeek: [],
      defisProgress: [],
      pointsTotal: 50,
      recipesUsed: [],
      stockAlerts: [],
    };
    const output = formatRecapForAI(data);
    expect(output).toContain('~50');
  });

  test('affiche les repas et plats highlights', () => {
    const data: WeeklyRecapData = {
      weekStart: '2026-03-16',
      weekEnd: '2026-03-22',
      tasksCompleted: 0,
      menageTasksCompleted: 0,
      mealsCookedCount: 5,
      mealsHighlights: ['Gratin dauphinois', 'Quiche lorraine'],
      moodsAverage: null,
      quotesOfWeek: [],
      defisProgress: [],
      pointsTotal: 0,
      recipesUsed: [],
      stockAlerts: [],
    };
    const output = formatRecapForAI(data);
    expect(output).toContain('Repas planifiés : 5');
    expect(output).toContain('Gratin dauphinois');
    expect(output).toContain('Quiche lorraine');
  });

  test('affiche la moyenne d\'humeur', () => {
    const data: WeeklyRecapData = {
      weekStart: '2026-03-16',
      weekEnd: '2026-03-22',
      tasksCompleted: 0,
      menageTasksCompleted: 0,
      mealsCookedCount: 0,
      mealsHighlights: [],
      moodsAverage: 3.8,
      quotesOfWeek: [],
      defisProgress: [],
      pointsTotal: 0,
      recipesUsed: [],
      stockAlerts: [],
    };
    const output = formatRecapForAI(data);
    expect(output).toContain('3.8/5');
  });

  test('n\'affiche pas la section humeur si moodsAverage est null', () => {
    const data: WeeklyRecapData = {
      weekStart: '2026-03-16',
      weekEnd: '2026-03-22',
      tasksCompleted: 0,
      menageTasksCompleted: 0,
      mealsCookedCount: 0,
      mealsHighlights: [],
      moodsAverage: null,
      quotesOfWeek: [],
      defisProgress: [],
      pointsTotal: 0,
      recipesUsed: [],
      stockAlerts: [],
    };
    const output = formatRecapForAI(data);
    expect(output).not.toContain('Humeur moyenne');
  });

  test('affiche les mots d\'enfants', () => {
    const data: WeeklyRecapData = {
      weekStart: '2026-03-16',
      weekEnd: '2026-03-22',
      tasksCompleted: 0,
      menageTasksCompleted: 0,
      mealsCookedCount: 0,
      mealsHighlights: [],
      moodsAverage: null,
      quotesOfWeek: [
        { citation: 'Les étoiles sont les veilleuses du ciel', enfant: 'Emma' },
      ],
      defisProgress: [],
      pointsTotal: 0,
      recipesUsed: [],
      stockAlerts: [],
    };
    const output = formatRecapForAI(data);
    expect(output).toContain('Mots d\'enfants');
    expect(output).toContain('Emma');
    expect(output).toContain('Les étoiles sont les veilleuses du ciel');
  });

  test('affiche les défis en cours', () => {
    const data: WeeklyRecapData = {
      weekStart: '2026-03-16',
      weekEnd: '2026-03-22',
      tasksCompleted: 0,
      menageTasksCompleted: 0,
      mealsCookedCount: 0,
      mealsHighlights: [],
      moodsAverage: null,
      quotesOfWeek: [],
      defisProgress: [{ title: 'Lire 30 min/jour', emoji: '📖', progress: 57 }],
      pointsTotal: 0,
      recipesUsed: [],
      stockAlerts: [],
    };
    const output = formatRecapForAI(data);
    expect(output).toContain('Défis en cours');
    expect(output).toContain('Lire 30 min/jour');
    expect(output).toContain('57%');
  });

  test('affiche les alertes stock', () => {
    const data: WeeklyRecapData = {
      weekStart: '2026-03-16',
      weekEnd: '2026-03-22',
      tasksCompleted: 0,
      menageTasksCompleted: 0,
      mealsCookedCount: 0,
      mealsHighlights: [],
      moodsAverage: null,
      quotesOfWeek: [],
      defisProgress: [],
      pointsTotal: 0,
      recipesUsed: [],
      stockAlerts: ['Lait', 'Couches taille 4'],
    };
    const output = formatRecapForAI(data);
    expect(output).toContain('Stocks bas');
    expect(output).toContain('Lait');
    expect(output).toContain('Couches taille 4');
  });

  test('gère toutes les sections vides sans erreur', () => {
    const data: WeeklyRecapData = {
      weekStart: '2026-03-16',
      weekEnd: '2026-03-22',
      tasksCompleted: 0,
      menageTasksCompleted: 0,
      mealsCookedCount: 0,
      mealsHighlights: [],
      moodsAverage: null,
      quotesOfWeek: [],
      defisProgress: [],
      pointsTotal: 0,
      recipesUsed: [],
      stockAlerts: [],
    };
    const output = formatRecapForAI(data);
    expect(typeof output).toBe('string');
    expect(output).toContain('Bilan de la semaine');
    // Ne doit pas contenir les sections optionnelles
    expect(output).not.toContain('Repas planifiés');
    expect(output).not.toContain('Humeur moyenne');
    expect(output).not.toContain('Mots d\'enfants');
    expect(output).not.toContain('Défis en cours');
    expect(output).not.toContain('Stocks bas');
  });

  test('affiche les recettes utilisées', () => {
    const data: WeeklyRecapData = {
      weekStart: '2026-03-16',
      weekEnd: '2026-03-22',
      tasksCompleted: 0,
      menageTasksCompleted: 0,
      mealsCookedCount: 2,
      mealsHighlights: ['Carbonara'],
      moodsAverage: null,
      quotesOfWeek: [],
      defisProgress: [],
      pointsTotal: 0,
      recipesUsed: ['Pates Carbonara', 'Gratin Dauphinois'],
      stockAlerts: [],
    };
    const output = formatRecapForAI(data);
    expect(output).toContain('Recettes utilisées');
    expect(output).toContain('Pates Carbonara');
    expect(output).toContain('Gratin Dauphinois');
  });
});
