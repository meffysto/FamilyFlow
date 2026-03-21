/**
 * Tests unitaires — calendar-aggregator.ts
 *
 * Couvre l'agrégation de toutes les sources vault en événements calendrier :
 * - aggregateCalendarEvents (RDVs, tâches, anniversaires, repas, vacances, défis, souvenirs, humeurs, mots)
 * - resolveMealsForRange (résolution des repas par jour de semaine en dates absolues)
 * - indexByDate (indexation O(1) par date)
 */

import {
  aggregateCalendarEvents,
  resolveMealsForRange,
  indexByDate,
  type AggregatorInput,
  type DateRange,
} from '../calendar-aggregator';
import type { RDV, Task, Anniversary, MealItem, Defi, Memory, MoodEntry, ChildQuote, VacationConfig } from '../types';
import { EVENT_CONFIG } from '../calendar-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyInput(): AggregatorInput {
  return {
    rdvs: [],
    tasks: [],
    anniversaries: [],
    resolvedMeals: [],
    vacationConfig: null,
    defis: [],
    memories: [],
    moods: [],
    quotes: [],
  };
}

const defaultRange: DateRange = { start: '2026-03-01', end: '2026-03-31' };

function makeRDV(overrides: Partial<RDV> = {}): RDV {
  return {
    title: 'Visite pédiatre',
    date_rdv: '2026-03-15',
    heure: '10:00',
    type_rdv: 'pédiatre',
    enfant: 'Lucas',
    médecin: 'Dr Dupont',
    lieu: 'Cabinet médical',
    statut: 'planifié',
    sourceFile: 'rdv/lucas-pediatre.md',
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    text: 'Acheter des couches 📅 2026-03-20',
    completed: false,
    tags: [],
    mentions: [],
    sourceFile: 'tasks.md',
    lineIndex: 0,
    dueDate: '2026-03-20',
    ...overrides,
  };
}

function makeAnniversary(overrides: Partial<Anniversary> = {}): Anniversary {
  return {
    name: 'Emma Dupont',
    date: '03-10',
    birthYear: 2020,
    sourceFile: 'anniversaires.md',
    ...overrides,
  };
}

function makeDefi(overrides: Partial<Defi> = {}): Defi {
  return {
    id: 'defi-1',
    title: '30 jours sans écran',
    description: 'Pas de tablette ni télé',
    type: 'abstinence',
    startDate: '2026-03-01',
    endDate: '2026-03-30',
    targetDays: 30,
    emoji: '📵',
    difficulty: 'difficile',
    participants: [],
    status: 'active',
    progress: [],
    rewardPoints: 100,
    rewardLootBoxes: 1,
    ...overrides,
  };
}

function makeMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    date: '2026-03-05',
    title: 'Premier pas',
    description: 'Lucas a fait ses premiers pas !',
    type: 'premières-fois',
    enfant: 'Lucas',
    enfantId: 'lucas',
    ...overrides,
  };
}

function makeMood(overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    date: '2026-03-10',
    profileId: 'lucas',
    profileName: 'Lucas',
    level: 4,
    sourceFile: 'humeurs.md',
    lineIndex: 0,
    ...overrides,
  };
}

function makeQuote(overrides: Partial<ChildQuote> = {}): ChildQuote {
  return {
    date: '2026-03-12',
    enfant: 'Emma',
    citation: 'Les étoiles, c\'est les veilleuses du ciel !',
    sourceFile: 'mots.md',
    lineIndex: 0,
    ...overrides,
  };
}

// ─── aggregateCalendarEvents ────────────────────────────────────────────────

describe('aggregateCalendarEvents', () => {
  it('retourne un tableau vide pour des sources vides', () => {
    const result = aggregateCalendarEvents(emptyInput(), defaultRange);
    expect(result).toEqual([]);
  });

  // ── RDVs ──

  it('agrège les RDVs dans la plage de dates', () => {
    const input = { ...emptyInput(), rdvs: [makeRDV()] };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('rdv');
    expect(result[0].label).toContain('Lucas');
    expect(result[0].emoji).toBe(EVENT_CONFIG.rdv.emoji);
  });

  it('exclut les RDVs annulés', () => {
    const input = { ...emptyInput(), rdvs: [makeRDV({ statut: 'annulé' })] };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result).toHaveLength(0);
  });

  it('exclut les RDVs hors plage de dates', () => {
    const input = { ...emptyInput(), rdvs: [makeRDV({ date_rdv: '2026-04-15' })] };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result).toHaveLength(0);
  });

  it('attribue colorKey "success" aux RDVs faits', () => {
    const input = { ...emptyInput(), rdvs: [makeRDV({ statut: 'fait' })] };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result[0].colorKey).toBe('success');
  });

  it('attribue colorKey "info" aux RDVs planifiés', () => {
    const input = { ...emptyInput(), rdvs: [makeRDV({ statut: 'planifié' })] };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result[0].colorKey).toBe('info');
  });

  it('gère le sublabel quand lieu et médecin sont undefined', () => {
    const input = { ...emptyInput(), rdvs: [makeRDV({ lieu: '', médecin: '', heure: '14:00' })] };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result[0].sublabel).toBe('14:00 — ');
  });

  it('utilise le lieu dans le sublabel quand disponible', () => {
    const input = { ...emptyInput(), rdvs: [makeRDV({ heure: '' })] };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result[0].sublabel).toBe('Cabinet médical');
  });

  // ── Tâches ──

  it('agrège les tâches avec deadline dans la plage', () => {
    const input = { ...emptyInput(), tasks: [makeTask()] };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('task');
    expect(result[0].colorKey).toBe('warning');
  });

  it('exclut les tâches complétées', () => {
    const input = { ...emptyInput(), tasks: [makeTask({ completed: true })] };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result).toHaveLength(0);
  });

  it('exclut les tâches sans dueDate', () => {
    const input = { ...emptyInput(), tasks: [makeTask({ dueDate: undefined })] };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result).toHaveLength(0);
  });

  // ── Anniversaires ──

  it('agrège les anniversaires sur l\'année de la plage', () => {
    const input = { ...emptyInput(), anniversaries: [makeAnniversary()] };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('anniversary');
    expect(result[0].label).toBe('Emma Dupont');
    expect(result[0].colorKey).toBe('accentPink');
  });

  it('calcule l\'âge pour les anniversaires avec birthYear', () => {
    const input = { ...emptyInput(), anniversaries: [makeAnniversary({ birthYear: 2020 })] };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result[0].sublabel).toBe('6 ans');
    expect((result[0] as any).age).toBe(6);
  });

  it('pas de sublabel âge quand birthYear est absent', () => {
    const input = { ...emptyInput(), anniversaries: [makeAnniversary({ birthYear: undefined })] };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result[0].sublabel).toBeUndefined();
  });

  it('exclut les anniversaires hors mois de la plage', () => {
    const input = { ...emptyInput(), anniversaries: [makeAnniversary({ date: '07-15' })] };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result).toHaveLength(0);
  });

  // ── Repas ──

  it('agrège les repas résolus dans la plage', () => {
    const input = {
      ...emptyInput(),
      resolvedMeals: [{ date: '2026-03-10', meal: { id: 'lundi:déjeuner', day: 'Lundi', mealType: 'Déjeuner', text: 'Pâtes carbonara', lineIndex: 0, sourceFile: 'meals.md' } as MealItem }],
    };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('meal');
    expect(result[0].label).toBe('Pâtes carbonara');
    expect(result[0].colorKey).toBe('success');
  });

  // ── Vacances ──

  it('crée un événement par jour de vacances dans la plage', () => {
    const input = {
      ...emptyInput(),
      vacationConfig: { active: true, startDate: '2026-03-10', endDate: '2026-03-12' },
    };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result).toHaveLength(3); // 10, 11, 12 mars
    expect(result[0].type).toBe('vacation');
    expect(result[0].label).toBe('Vacances');
  });

  it('ignore les vacances inactives', () => {
    const input = {
      ...emptyInput(),
      vacationConfig: { active: false, startDate: '2026-03-10', endDate: '2026-03-12' },
    };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result).toHaveLength(0);
  });

  it('ignore les vacances null', () => {
    const input = { ...emptyInput(), vacationConfig: null };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result).toHaveLength(0);
  });

  // ── Défis ──

  it('crée des événements début et fin pour un défi actif', () => {
    const input = { ...emptyInput(), defis: [makeDefi()] };
    const result = aggregateCalendarEvents(input, defaultRange);
    const defiEvents = result.filter((e) => e.type === 'defi');
    expect(defiEvents).toHaveLength(2);
    expect(defiEvents[0].label).toContain('(début)');
    expect(defiEvents[1].label).toContain('(fin)');
  });

  it('ignore les défis non actifs', () => {
    const input = { ...emptyInput(), defis: [makeDefi({ status: 'completed' })] };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result).toHaveLength(0);
  });

  // ── Souvenirs ──

  it('agrège les souvenirs dans la plage', () => {
    const input = { ...emptyInput(), memories: [makeMemory()] };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('memory');
    expect(result[0].label).toBe('Premier pas');
    expect(result[0].sublabel).toBe('Lucas');
    expect(result[0].colorKey).toBe('accentPink');
  });

  // ── Humeurs ──

  it('agrège les humeurs et calcule la moyenne par jour', () => {
    const input = {
      ...emptyInput(),
      moods: [
        makeMood({ profileName: 'Lucas', level: 4 }),
        makeMood({ profileName: 'Emma', profileId: 'emma', level: 2 }),
      ],
    };
    const result = aggregateCalendarEvents(input, defaultRange);
    const moodEvents = result.filter((e) => e.type === 'mood');
    expect(moodEvents).toHaveLength(1); // une seule entrée par jour
    // Moyenne : (4 + 2) / 2 = 3 → 😊
    expect(moodEvents[0].label).toContain('😊');
    expect(moodEvents[0].sublabel).toContain('Lucas');
    expect(moodEvents[0].sublabel).toContain('Emma');
  });

  // ── Mots d'enfants ──

  it('agrège les mots d\'enfants dans la plage', () => {
    const input = { ...emptyInput(), quotes: [makeQuote()] };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('quote');
    expect(result[0].label).toContain('veilleuses du ciel');
    expect(result[0].sublabel).toBe('Emma');
  });

  // ── Tri ──

  it('trie par date ASC puis événements avec heure avant sans heure', () => {
    const input = {
      ...emptyInput(),
      rdvs: [makeRDV({ date_rdv: '2026-03-15', heure: '14:00' })],
      memories: [makeMemory({ date: '2026-03-15' })],
      tasks: [makeTask({ dueDate: '2026-03-10' })],
    };
    const result = aggregateCalendarEvents(input, defaultRange);
    // Tâche le 10 avant RDV et souvenir le 15
    expect(result[0].date).toBe('2026-03-10');
    // RDV (avec heure) avant souvenir (sans heure) le même jour
    const march15 = result.filter((e) => e.date === '2026-03-15');
    expect(march15[0].type).toBe('rdv');
    expect(march15[1].type).toBe('memory');
  });

  it('trie les événements avec heure par ordre chronologique', () => {
    const input = {
      ...emptyInput(),
      rdvs: [
        makeRDV({ date_rdv: '2026-03-15', heure: '16:00', sourceFile: 'rdv2.md' }),
        makeRDV({ date_rdv: '2026-03-15', heure: '09:00', sourceFile: 'rdv1.md' }),
      ],
    };
    const result = aggregateCalendarEvents(input, defaultRange);
    expect(result[0].time).toBe('09:00');
    expect(result[1].time).toBe('16:00');
  });

  // ── Sources multiples ──

  it('agrège correctement toutes les sources ensemble', () => {
    const input: AggregatorInput = {
      rdvs: [makeRDV()],
      tasks: [makeTask()],
      anniversaries: [makeAnniversary()],
      resolvedMeals: [{ date: '2026-03-10', meal: { id: 'lundi:déjeuner', day: 'Lundi', mealType: 'Déjeuner', text: 'Salade', lineIndex: 0, sourceFile: 'meals.md' } as MealItem }],
      vacationConfig: null,
      defis: [makeDefi()],
      memories: [makeMemory()],
      moods: [makeMood()],
      quotes: [makeQuote()],
    };
    const result = aggregateCalendarEvents(input, defaultRange);
    const types = new Set(result.map((e) => e.type));
    expect(types.has('rdv')).toBe(true);
    expect(types.has('task')).toBe(true);
    expect(types.has('anniversary')).toBe(true);
    expect(types.has('meal')).toBe(true);
    expect(types.has('defi')).toBe(true);
    expect(types.has('memory')).toBe(true);
    expect(types.has('mood')).toBe(true);
    expect(types.has('quote')).toBe(true);
  });
});

// ─── resolveMealsForRange ───────────────────────────────────────────────────

describe('resolveMealsForRange', () => {
  it('résout les repas par jour de la semaine en dates absolues', () => {
    const meals: MealItem[] = [
      { id: 'lundi:déjeuner', day: 'Lundi', mealType: 'Déjeuner', text: 'Pâtes', lineIndex: 0, sourceFile: 'meals.md' },
      { id: 'mercredi:dîner', day: 'Mercredi', mealType: 'Dîner', text: 'Soupe', lineIndex: 1, sourceFile: 'meals.md' },
    ];
    const result = resolveMealsForRange([{ mondayDate: '2026-03-09', meals }]);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-03-09'); // Lundi
    expect(result[1].date).toBe('2026-03-11'); // Mercredi
  });

  it('ignore les repas avec texte vide', () => {
    const meals: MealItem[] = [
      { id: 'lundi:déjeuner', day: 'Lundi', mealType: 'Déjeuner', text: '', lineIndex: 0, sourceFile: 'meals.md' },
      { id: 'lundi:dîner', day: 'Lundi', mealType: 'Dîner', text: '  ', lineIndex: 1, sourceFile: 'meals.md' },
    ];
    const result = resolveMealsForRange([{ mondayDate: '2026-03-09', meals }]);
    expect(result).toHaveLength(0);
  });

  it('ignore les jours invalides', () => {
    const meals: MealItem[] = [
      { id: 'x:déjeuner', day: 'Lundy', mealType: 'Déjeuner', text: 'Salade', lineIndex: 0, sourceFile: 'meals.md' },
    ];
    const result = resolveMealsForRange([{ mondayDate: '2026-03-09', meals }]);
    expect(result).toHaveLength(0);
  });

  it('retourne un tableau vide pour des semaines vides', () => {
    const result = resolveMealsForRange([]);
    expect(result).toEqual([]);
  });
});

// ─── indexByDate ────────────────────────────────────────────────────────────

describe('indexByDate', () => {
  it('indexe les événements par date', () => {
    const input = {
      ...emptyInput(),
      rdvs: [makeRDV({ date_rdv: '2026-03-15' })],
      tasks: [makeTask({ dueDate: '2026-03-15' }), makeTask({ id: 'task-2', dueDate: '2026-03-20' })],
    };
    const events = aggregateCalendarEvents(input, defaultRange);
    const indexed = indexByDate(events);
    expect(indexed['2026-03-15']).toHaveLength(2);
    expect(indexed['2026-03-20']).toHaveLength(1);
    expect(indexed['2026-03-01']).toBeUndefined();
  });

  it('retourne un objet vide pour un tableau vide', () => {
    const indexed = indexByDate([]);
    expect(indexed).toEqual({});
  });
});
