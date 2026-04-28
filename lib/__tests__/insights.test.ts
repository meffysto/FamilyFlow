/**
 * Tests unitaires — insights.ts
 *
 * Couvre les règles déterministes du moteur d'insights locaux.
 * On teste les règles individuellement via generateInsights avec des inputs ciblés.
 */

import '../i18n';
import { generateInsights, type InsightInput } from '../insights';
import type { Task, RDV, StockItem, CourseItem, MealItem, Profile, Defi, GratitudeDay, Memory, VacationConfig, GamificationData } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Crée un InsightInput minimal (tous les champs vides) */
function emptyInput(overrides: Partial<InsightInput> = {}): InsightInput {
  return {
    tasks: [],
    courses: [],
    stock: [],
    meals: [],
    rdvs: [],
    profiles: [],
    activeProfile: null,
    defis: [],
    gratitudeDays: [],
    memories: [],
    vacationConfig: null,
    isVacationActive: false,
    gamiData: null,
    photoDates: {},
    ...overrides,
  };
}

/** Date d'hier au format YYYY-MM-DD */
function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Date d'il y a N jours au format YYYY-MM-DD */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Date dans N jours au format YYYY-MM-DD */
function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Aujourd'hui au format YYYY-MM-DD */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test:0',
    text: 'Tâche test',
    completed: false,
    tags: [],
    mentions: [],
    sourceFile: 'test.md',
    lineIndex: 0,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'papa',
    name: 'Papa',
    role: 'adulte',
    avatar: '👨',
    points: 50,
    coins: 50,
    level: 1,
    streak: 0,
    lootBoxesAvailable: 0,
    multiplier: 1,
    multiplierRemaining: 0,
    pityCounter: 0,
    mascotDecorations: [],
    mascotInhabitants: [],
    mascotPlacements: {},
    ...overrides,
  };
}

// ─── Règle 1 : Tâches en retard ─────────────────────────────────────────────

describe('insight — tâches en retard', () => {
  it('génère une alerte pour tâches en retard (> 0 jours)', () => {
    const insights = generateInsights(emptyInput({
      tasks: [
        makeTask({ dueDate: yesterday(), completed: false }),
        makeTask({ id: 'test:1', dueDate: daysAgo(2), completed: false }),
      ],
    }));
    const overdue = insights.find(i => i.id === 'overdue-tasks' || i.id === 'overdue-critical');
    expect(overdue).toBeDefined();
    expect(overdue!.category).toBe('alert');
  });

  it('génère une alerte critique si retard > 3 jours', () => {
    const insights = generateInsights(emptyInput({
      tasks: [
        makeTask({ dueDate: daysAgo(5), completed: false }),
      ],
    }));
    const critical = insights.find(i => i.id === 'overdue-critical');
    expect(critical).toBeDefined();
    expect(critical!.priority).toBe('high');
  });

  it('ne génère pas d\'alerte si toutes les tâches sont complétées', () => {
    const insights = generateInsights(emptyInput({
      tasks: [
        makeTask({ dueDate: yesterday(), completed: true }),
      ],
    }));
    const overdue = insights.find(i => i.id.startsWith('overdue'));
    expect(overdue).toBeUndefined();
  });

  it('ne génère pas d\'alerte si aucune tâche en retard', () => {
    const insights = generateInsights(emptyInput({
      tasks: [
        makeTask({ dueDate: inDays(3), completed: false }),
      ],
    }));
    const overdue = insights.find(i => i.id.startsWith('overdue'));
    expect(overdue).toBeUndefined();
  });
});

// ─── Règle 3 : Stock bas ────────────────────────────────────────────────────

describe('insight — stock bas', () => {
  it('génère une alerte stock épuisé (quantité = 0)', () => {
    const insights = generateInsights(emptyInput({
      stock: [
        { produit: 'Couches', quantite: 0, seuil: 20, emplacement: 'bebe', lineIndex: 0 },
      ],
    }));
    const stockAlert = insights.find(i => i.id === 'stock-critical');
    expect(stockAlert).toBeDefined();
    expect(stockAlert!.priority).toBe('high');
    expect(stockAlert!.title).toContain('Couches');
  });

  it('génère une suggestion stock bas si pas dans les courses', () => {
    const insights = generateInsights(emptyInput({
      stock: [
        { produit: 'Lait', quantite: 1, seuil: 3, emplacement: 'frigo', lineIndex: 0 },
      ],
      courses: [],
    }));
    const stockLow = insights.find(i => i.id === 'stock-low');
    expect(stockLow).toBeDefined();
    expect(stockLow!.category).toBe('alert');
    expect(stockLow!.action?.type).toBe('navigate');
    expect(stockLow!.action?.route).toBe('/(tabs)/stock');
    expect(stockLow!.action?.params?.lowOnly).toBe('1');
  });

  it('ne génère pas si le produit est déjà dans les courses', () => {
    const insights = generateInsights(emptyInput({
      stock: [
        { produit: 'Lait', quantite: 1, seuil: 3, emplacement: 'frigo', lineIndex: 0 },
      ],
      courses: [
        { id: 'c:0', text: 'Lait entier', completed: false, lineIndex: 0 },
      ],
    }));
    const stockLow = insights.find(i => i.id === 'stock-low');
    expect(stockLow).toBeUndefined();
  });

  it('ne génère rien si stock au-dessus du seuil', () => {
    const insights = generateInsights(emptyInput({
      stock: [
        { produit: 'Riz', quantite: 5, seuil: 2, emplacement: 'placards', lineIndex: 0 },
      ],
    }));
    const stockAlerts = insights.filter(i => i.id.startsWith('stock'));
    expect(stockAlerts).toHaveLength(0);
  });
});

// ─── Règle 8 : Courses longues ──────────────────────────────────────────────

describe('insight — courses longues', () => {
  it('génère une suggestion si >= 15 articles en attente', () => {
    const courses: CourseItem[] = Array.from({ length: 16 }, (_, i) => ({
      id: `c:${i}`,
      text: `Article ${i}`,
      completed: false,
      lineIndex: i,
    }));
    const insights = generateInsights(emptyInput({ courses }));
    const coursesInsight = insights.find(i => i.id === 'courses-long');
    expect(coursesInsight).toBeDefined();
    expect(coursesInsight!.title).toContain('16');
  });

  it('ne génère rien si < 15 articles', () => {
    const courses: CourseItem[] = Array.from({ length: 10 }, (_, i) => ({
      id: `c:${i}`,
      text: `Article ${i}`,
      completed: false,
      lineIndex: i,
    }));
    const insights = generateInsights(emptyInput({ courses }));
    const coursesInsight = insights.find(i => i.id === 'courses-long');
    expect(coursesInsight).toBeUndefined();
  });

  it('ne compte pas les articles complétés', () => {
    const courses: CourseItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: `c:${i}`,
      text: `Article ${i}`,
      completed: true, // tous complétés
      lineIndex: i,
    }));
    const insights = generateInsights(emptyInput({ courses }));
    const coursesInsight = insights.find(i => i.id === 'courses-long');
    expect(coursesInsight).toBeUndefined();
  });
});

// ─── Règle 10 : Gamification / Loot box ─────────────────────────────────────

describe('insight — gamification', () => {
  it('génère une suggestion si loot box disponible', () => {
    const profile = makeProfile({ lootBoxesAvailable: 2 });
    const insights = generateInsights(emptyInput({
      activeProfile: profile,
      gamiData: { profiles: [profile], history: [], activeRewards: [] },
    }));
    const loot = insights.find(i => i.id === 'loot-available');
    expect(loot).toBeDefined();
    expect(loot!.title).toContain('2 loot boxes');
  });

  it('ne génère pas si 0 loot box', () => {
    const profile = makeProfile({ lootBoxesAvailable: 0 });
    const insights = generateInsights(emptyInput({
      activeProfile: profile,
      gamiData: { profiles: [profile], history: [], activeRewards: [] },
    }));
    const loot = insights.find(i => i.id === 'loot-available');
    expect(loot).toBeUndefined();
  });
});

// ─── Tri par priorité ────────────────────────────────────────────────────────

describe('insight — tri par priorité', () => {
  it('trie high > medium > low', () => {
    const insights = generateInsights(emptyInput({
      tasks: [
        makeTask({ dueDate: daysAgo(5), completed: false }), // high (critical)
      ],
      stock: [
        { produit: 'Lait', quantite: 1, seuil: 3, emplacement: 'frigo', lineIndex: 0 }, // medium
      ],
    }));
    if (insights.length >= 2) {
      const priorities = insights.map(i => i.priority);
      const order = { high: 0, medium: 1, low: 2 };
      for (let i = 1; i < priorities.length; i++) {
        expect(order[priorities[i]]).toBeGreaterThanOrEqual(order[priorities[i - 1]]);
      }
    }
  });
});

// ─── Aucune donnée ───────────────────────────────────────────────────────────

describe('insight — vault vide', () => {
  it('retourne un tableau vide si aucune donnée', () => {
    const insights = generateInsights(emptyInput());
    expect(insights).toEqual([]);
  });
});
