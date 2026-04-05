/**
 * Tests unitaires — task-helpers (fonctions pures)
 *
 * Couvre : compareDateStatus, filterVisibleTasks, splitTasksByStatus,
 * filterTasksByCategory, searchTasks, buildTaskCategories, sortTasks,
 * groupTasksByFile, labelFromSourceFile, toggleTaskLine.
 */

import type { Task, Profile } from '../../packages/core/src/types';

jest.mock('../../packages/core/src/recurrence', () => ({
  nextOccurrence: jest.fn((date: string) => '2024-01-08'),
}));

import {
  compareDateStatus,
  filterVisibleTasks,
  splitTasksByStatus,
  filterTasksByCategory,
  searchTasks,
  buildTaskCategories,
  sortTasks,
  groupTasksByFile,
  labelFromSourceFile,
  toggleTaskLine,
} from '../../packages/core/src/task-helpers';

// ─── Helpers ───────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    text: 'Test task',
    completed: false,
    sourceFile: '02 - Maison/Tâches récurrentes.md',
    lineIndex: 5,
    tags: [],
    mentions: [],
    ...overrides,
  } as Task;
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'papa',
    name: 'Papa',
    role: 'adulte',
    avatar: '👨',
    points: 0,
    coins: 0,
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
  } as Profile;
}

// ─── compareDateStatus ─────────────────────────────────────────────────────

describe('compareDateStatus', () => {
  it('retourne overdue pour une date passée', () => {
    expect(compareDateStatus('2020-01-01')).toBe('overdue');
  });

  it('retourne today pour aujourd\'hui', () => {
    expect(compareDateStatus(TODAY)).toBe('today');
  });

  it('retourne upcoming pour une date future', () => {
    expect(compareDateStatus('2099-01-01')).toBe('upcoming');
  });
});

// ─── filterVisibleTasks ────────────────────────────────────────────────────

describe('filterVisibleTasks', () => {
  it('masque les récurrentes avec date future', () => {
    const tasks = [
      makeTask({ id: 't1', recurrence: 'every week', dueDate: '2099-01-01' }),
      makeTask({ id: 't2', text: 'Normale' }),
    ];
    const result = filterVisibleTasks(tasks, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
  });

  it('garde les récurrentes avec date passée ou aujourd\'hui', () => {
    const tasks = [
      makeTask({ id: 't1', recurrence: 'every week', dueDate: '2020-01-01' }),
      makeTask({ id: 't2', recurrence: 'every day', dueDate: TODAY }),
    ];
    const result = filterVisibleTasks(tasks, TODAY);
    expect(result).toHaveLength(2);
  });

  it('garde les tâches sans récurrence', () => {
    const tasks = [makeTask({ id: 't1', dueDate: '2099-01-01' })];
    const result = filterVisibleTasks(tasks, TODAY);
    expect(result).toHaveLength(1);
  });
});

// ─── splitTasksByStatus ────────────────────────────────────────────────────

describe('splitTasksByStatus', () => {
  it('sépare actives et complétées', () => {
    const tasks = [
      makeTask({ id: 't1', completed: false }),
      makeTask({ id: 't2', completed: true }),
      makeTask({ id: 't3', completed: false }),
    ];
    const { active, completed } = splitTasksByStatus(tasks, TODAY);
    expect(active).toHaveLength(2);
    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe('t2');
  });

  it('récurrentes futures comptent comme complétées', () => {
    const tasks = [
      makeTask({ id: 't1', recurrence: 'every week', dueDate: '2099-01-01', completed: false }),
    ];
    const { active, completed } = splitTasksByStatus(tasks, TODAY);
    expect(active).toHaveLength(0);
    expect(completed).toHaveLength(1);
  });
});

// ─── filterTasksByCategory ─────────────────────────────────────────────────

describe('filterTasksByCategory', () => {
  const tasks = [
    makeTask({ id: 't1', mentions: ['Papa'], sourceFile: '02 - Maison/Tâches récurrentes.md' }),
    makeTask({ id: 't2', mentions: ['Léa'], sourceFile: '01 - Enfants/Lucas/Tâches récurrentes.md' }),
    makeTask({ id: 't3', mentions: [], sourceFile: '01 - Enfants/Lucas/Devoirs.md' }),
  ];

  it('tous retourne toutes les tâches', () => {
    expect(filterTasksByCategory(tasks, 'tous')).toHaveLength(3);
  });

  it('mine filtre par mentions', () => {
    const result = filterTasksByCategory(tasks, 'mine', 'Papa');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('mine gère les accents', () => {
    const result = filterTasksByCategory(tasks, 'mine', 'Lea');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
  });

  it('enfant:Lucas filtre par sourceFile', () => {
    const result = filterTasksByCategory(tasks, 'enfant:Lucas');
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.sourceFile.includes('Lucas'))).toBe(true);
  });

  it('maison filtre par Maison', () => {
    const result = filterTasksByCategory(tasks, 'maison');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });
});

// ─── searchTasks ───────────────────────────────────────────────────────────

describe('searchTasks', () => {
  const tasks = [
    makeTask({ id: 't1', text: 'Changer les couches' }),
    makeTask({ id: 't2', text: 'Faire les courses', tags: ['#urgent'] }),
    makeTask({ id: 't3', text: 'Ranger la chambre', section: 'Ménage' }),
  ];

  it('filtre par texte', () => {
    const result = searchTasks(tasks, 'couche');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('filtre par tag', () => {
    const result = searchTasks(tasks, 'urgent');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
  });

  it('retourne tout si query vide', () => {
    expect(searchTasks(tasks, '')).toHaveLength(3);
    expect(searchTasks(tasks, '   ')).toHaveLength(3);
  });
});

// ─── buildTaskCategories ───────────────────────────────────────────────────

describe('buildTaskCategories', () => {
  it('construit catégories avec compteurs', () => {
    const tasks = [
      makeTask({ id: 't1', mentions: ['Papa'], sourceFile: '02 - Maison/Tâches.md', completed: false }),
      makeTask({ id: 't2', mentions: [], sourceFile: '01 - Enfants/Lucas/Tâches.md', completed: false }),
      makeTask({ id: 't3', mentions: [], sourceFile: '01 - Enfants/Lucas/Tâches.md', completed: true }),
      makeTask({ id: 't4', mentions: [], sourceFile: '02 - Maison/Ménage.md', completed: false }),
    ];
    const activeProfile = makeProfile({ name: 'Papa' });
    const lucasProfile = makeProfile({ id: 'lucas', name: 'Lucas', role: 'enfant' });
    const profiles = [activeProfile, lucasProfile];

    const cats = buildTaskCategories(tasks, profiles, activeProfile);

    // Mine
    const mine = cats.find((c) => c.key === 'mine');
    expect(mine).toBeDefined();
    expect(mine!.pending).toBe(1);

    // Enfant Lucas
    const lucas = cats.find((c) => c.key === 'enfant:Lucas');
    expect(lucas).toBeDefined();
    expect(lucas!.pending).toBe(1); // 1 active, 1 completed

    // Maison
    const maison = cats.find((c) => c.key === 'maison');
    expect(maison).toBeDefined();
    expect(maison!.pending).toBe(2);
  });
});

// ─── sortTasks ─────────────────────────────────────────────────────────────

describe('sortTasks', () => {
  it('récurrentes d\'abord puis par date', () => {
    const tasks = [
      makeTask({ id: 't1', dueDate: '2024-03-01' }),
      makeTask({ id: 't2', recurrence: 'every week', dueDate: '2024-02-01' }),
      makeTask({ id: 't3', dueDate: '2024-01-01' }),
    ];
    const sorted = sortTasks(tasks);
    expect(sorted[0].id).toBe('t2'); // récurrente d'abord
    expect(sorted[1].id).toBe('t3'); // puis date la plus proche
    expect(sorted[2].id).toBe('t1');
  });
});

// ─── groupTasksByFile ──────────────────────────────────────────────────────

describe('groupTasksByFile', () => {
  it('regroupe par sourceFile avec label', () => {
    const tasks = [
      makeTask({ id: 't1', sourceFile: '02 - Maison/Tâches.md' }),
      makeTask({ id: 't2', sourceFile: '02 - Maison/Tâches.md' }),
      makeTask({ id: 't3', sourceFile: '01 - Enfants/Lucas/Devoirs.md' }),
    ];
    const groups = groupTasksByFile(tasks);
    expect(groups).toHaveLength(2);

    const maisonGroup = groups.find((g) => g.file.includes('Maison'));
    expect(maisonGroup).toBeDefined();
    expect(maisonGroup!.tasks).toHaveLength(2);
    expect(maisonGroup!.label).toBe('Maison');

    const lucasGroup = groups.find((g) => g.file.includes('Lucas'));
    expect(lucasGroup).toBeDefined();
    expect(lucasGroup!.tasks).toHaveLength(1);
    expect(lucasGroup!.label).toBe('Lucas');
  });
});

// ─── labelFromSourceFile ───────────────────────────────────────────────────

describe('labelFromSourceFile', () => {
  it('extrait Maison', () => {
    expect(labelFromSourceFile('02 - Maison/Tâches récurrentes.md')).toBe('Maison');
  });

  it('extrait nom enfant', () => {
    expect(labelFromSourceFile('01 - Enfants/Lucas/Tâches récurrentes.md')).toBe('Lucas');
  });

  it('extrait Vacances', () => {
    expect(labelFromSourceFile('02 - Maison/Vacances.md')).toBe('Vacances');
  });
});

// ─── toggleTaskLine ────────────────────────────────────────────────────────

describe('toggleTaskLine', () => {
  it('décoche une tâche complétée', () => {
    const line = '- [x] Ranger la chambre ✅ 2024-01-05';
    const task = { completed: true };
    const result = toggleTaskLine(line, task, '2024-01-06');
    expect(result).toBe('- [ ] Ranger la chambre');
    expect(result).not.toContain('✅');
    expect(result).not.toContain('[x]');
  });

  it('avance la date d\'une récurrente', () => {
    const line = '- [ ] Sortir les poubelles 🔁 every week 📅 2024-01-01';
    const task = { completed: false, recurrence: 'every week', dueDate: '2024-01-01' };
    const result = toggleTaskLine(line, task, '2024-01-06');
    expect(result).toContain('📅 2024-01-08');
    expect(result).toContain('- [ ]'); // reste décochée
  });

  it('coche une tâche simple', () => {
    const line = '- [ ] Acheter du lait';
    const task = { completed: false };
    const result = toggleTaskLine(line, task, '2024-01-06');
    expect(result).toContain('- [x]');
    expect(result).toContain('✅ 2024-01-06');
  });
});
