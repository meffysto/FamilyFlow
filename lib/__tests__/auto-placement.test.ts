/**
 * auto-placement.test.ts — Tests chaîne de décision computeAutoSlot.
 *
 * Phase quick-260516-oj6 — Time-blocking mode Journée.
 *
 * Couvre exhaustivement les 5 sources : explicit > time > history > file > nextfit.
 * Couvre aussi : timeToSlot (mapping heure→slot) et getDominantSlot.
 */

import type { Task } from '../types';
import {
  computeAutoSlot,
  computeDayPlacement,
  estimateTaskDuration,
} from '../time-blocking/auto-placement';
import {
  timeToSlot,
  SLOT_DEFINITIONS,
} from '../time-blocking/slot-mapping';
import {
  getDominantSlot,
  saveCompletion,
  loadHistory,
  type CompletionHistory,
} from '../time-blocking/completion-history';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tasks.md:0',
    text: 'Tâche test',
    completed: false,
    tags: [],
    mentions: [],
    sourceFile: 'tasks.md',
    lineIndex: 0,
    ...overrides,
  };
}

// ─── timeToSlot ──────────────────────────────────────────────────────────────

describe('timeToSlot', () => {
  it('06:00 → matin (début)', () => {
    expect(timeToSlot('06:00')).toBe('matin');
  });
  it('11:59 → matin (fin)', () => {
    expect(timeToSlot('11:59')).toBe('matin');
  });
  it('12:00 → midi (début)', () => {
    expect(timeToSlot('12:00')).toBe('midi');
  });
  it('13:59 → midi (fin)', () => {
    expect(timeToSlot('13:59')).toBe('midi');
  });
  it('14:00 → aprem (début)', () => {
    expect(timeToSlot('14:00')).toBe('aprem');
  });
  it('17:59 → aprem (fin)', () => {
    expect(timeToSlot('17:59')).toBe('aprem');
  });
  it('18:00 → soir (début)', () => {
    expect(timeToSlot('18:00')).toBe('soir');
  });
  it('23:59 → soir (fin de journée)', () => {
    expect(timeToSlot('23:59')).toBe('soir');
  });
  it('00:00 → soir (wrap minuit)', () => {
    expect(timeToSlot('00:00')).toBe('soir');
  });
  it('05:59 → soir (wrap nuit)', () => {
    expect(timeToSlot('05:59')).toBe('soir');
  });
  it('format HH:MM:SS supporté', () => {
    expect(timeToSlot('07:30:00')).toBe('matin');
  });
});

// ─── getDominantSlot ─────────────────────────────────────────────────────────

describe('getDominantSlot', () => {
  it('moins de 2 entrées → undefined', () => {
    const history: CompletionHistory = {
      'Méditer': [{ slot: 'soir', timestamp: '2026-05-16T20:00:00Z' }],
    };
    expect(getDominantSlot('Méditer', history)).toBeUndefined();
  });

  it('aucune entrée pour ce titre → undefined', () => {
    expect(getDominantSlot('Inexistant', {})).toBeUndefined();
  });

  it('3 entrées toutes soir → soir', () => {
    const history: CompletionHistory = {
      'Méditer': [
        { slot: 'soir', timestamp: '2026-05-14T20:00:00Z' },
        { slot: 'soir', timestamp: '2026-05-15T20:00:00Z' },
        { slot: 'soir', timestamp: '2026-05-16T20:00:00Z' },
      ],
    };
    expect(getDominantSlot('Méditer', history)).toBe('soir');
  });

  it('2 entrées identiques → ce slot', () => {
    const history: CompletionHistory = {
      'Routine': [
        { slot: 'matin', timestamp: '2026-05-15T07:00:00Z' },
        { slot: 'matin', timestamp: '2026-05-16T07:00:00Z' },
      ],
    };
    expect(getDominantSlot('Routine', history)).toBe('matin');
  });

  it('mode statistique : 3 matin / 1 soir → matin', () => {
    const history: CompletionHistory = {
      'Sport': [
        { slot: 'matin', timestamp: '2026-05-13T07:00:00Z' },
        { slot: 'matin', timestamp: '2026-05-14T07:00:00Z' },
        { slot: 'soir', timestamp: '2026-05-15T20:00:00Z' },
        { slot: 'matin', timestamp: '2026-05-16T07:00:00Z' },
      ],
    };
    expect(getDominantSlot('Sport', history)).toBe('matin');
  });
});

// ─── saveCompletion (FIFO 10) ────────────────────────────────────────────────

describe('saveCompletion + loadHistory (FIFO 10 par titre)', () => {
  it('ajoute en FIFO max 10 entrées par titre', async () => {
    // Ajouter 12 entrées
    for (let i = 0; i < 12; i++) {
      await saveCompletion('Test FIFO', 'matin');
    }
    const history = await loadHistory();
    expect(history['Test FIFO']).toBeDefined();
    expect(history['Test FIFO'].length).toBe(10);
  });
});

// ─── computeAutoSlot — chaîne de décision ────────────────────────────────────

describe('computeAutoSlot — chaîne de décision (explicit > time > history > file > nextfit)', () => {
  describe('1. Source explicit (court-circuit)', () => {
    it('timeSlot=soir → { slot: soir, source: explicit }', () => {
      const task = makeTask({ timeSlot: 'soir' });
      const result = computeAutoSlot(task, [], {});
      expect(result).toEqual({ slot: 'soir', source: 'explicit' });
    });

    it('timeSlot court-circuite reminderTime', () => {
      const task = makeTask({ timeSlot: 'soir', reminderTime: '07:00' });
      const result = computeAutoSlot(task, [], {});
      expect(result.source).toBe('explicit');
      expect(result.slot).toBe('soir');
    });
  });

  describe('2. Source time (reminderTime + dueDate ISO)', () => {
    it('reminderTime=07:30 → matin', () => {
      const task = makeTask({ reminderTime: '07:30' });
      const result = computeAutoSlot(task, [], {});
      expect(result).toEqual({ slot: 'matin', source: 'time' });
    });

    it('reminderTime=12:30 → midi', () => {
      const task = makeTask({ reminderTime: '12:30' });
      const result = computeAutoSlot(task, [], {});
      expect(result).toEqual({ slot: 'midi', source: 'time' });
    });

    it('reminderTime=15:00 → aprem', () => {
      const task = makeTask({ reminderTime: '15:00' });
      const result = computeAutoSlot(task, [], {});
      expect(result).toEqual({ slot: 'aprem', source: 'time' });
    });

    it('reminderTime=20:00 → soir', () => {
      const task = makeTask({ reminderTime: '20:00' });
      const result = computeAutoSlot(task, [], {});
      expect(result).toEqual({ slot: 'soir', source: 'time' });
    });

    it('reminderTime=03:00 → soir (wrap nuit)', () => {
      const task = makeTask({ reminderTime: '03:00' });
      const result = computeAutoSlot(task, [], {});
      expect(result).toEqual({ slot: 'soir', source: 'time' });
    });

    it('dueDate ISO 2026-05-16T08:00 → matin', () => {
      const task = makeTask({ dueDate: '2026-05-16T08:00' });
      const result = computeAutoSlot(task, [], {});
      expect(result).toEqual({ slot: 'matin', source: 'time' });
    });

    it('dueDate sans heure (YYYY-MM-DD seul) → ne déclenche pas time', () => {
      const task = makeTask({ dueDate: '2026-05-16' });
      const result = computeAutoSlot(task, [], {});
      // Sans autre signal, tombe en nextfit
      expect(result.source).toBe('nextfit');
    });
  });

  describe('3. Source history (mode statistique)', () => {
    it('history avec 3 entrées slot=soir → history', () => {
      const task = makeTask({ text: 'Méditation' });
      const history: CompletionHistory = {
        'Méditation': [
          { slot: 'soir', timestamp: '2026-05-14T20:00:00Z' },
          { slot: 'soir', timestamp: '2026-05-15T20:00:00Z' },
          { slot: 'soir', timestamp: '2026-05-16T20:00:00Z' },
        ],
      };
      const result = computeAutoSlot(task, [], history);
      expect(result).toEqual({ slot: 'soir', source: 'history' });
    });

    it('history avec 1 entrée seulement → fallback (pas assez de signal)', () => {
      const task = makeTask({ text: 'Méditation' });
      const history: CompletionHistory = {
        'Méditation': [{ slot: 'soir', timestamp: '2026-05-16T20:00:00Z' }],
      };
      const result = computeAutoSlot(task, [], history);
      expect(result.source).not.toBe('history');
    });
  });

  describe('4. Source file (pattern Routine matin/soir)', () => {
    it('sourceFile contient "Routine matin" → matin', () => {
      const task = makeTask({ sourceFile: 'Routines/Routine matin.md', text: 'Brossage' });
      const result = computeAutoSlot(task, [], {});
      expect(result).toEqual({ slot: 'matin', source: 'file' });
    });

    it('sourceFile contient "Routine soir" → soir', () => {
      const task = makeTask({ sourceFile: 'Routines/Routine soir.md', text: 'Pyjama' });
      const result = computeAutoSlot(task, [], {});
      expect(result).toEqual({ slot: 'soir', source: 'file' });
    });

    it('matching case-insensitive', () => {
      const task = makeTask({ sourceFile: 'routines/ROUTINE MATIN.md' });
      const result = computeAutoSlot(task, [], {});
      expect(result).toEqual({ slot: 'matin', source: 'file' });
    });
  });

  describe('5. Source nextfit (premier slot <= 75% chargé)', () => {
    it('aucune source → premier slot vide = matin', () => {
      const task = makeTask({ text: 'Rien' });
      const result = computeAutoSlot(task, [], {});
      expect(result).toEqual({ slot: 'matin', source: 'nextfit' });
    });

    it('matin chargé à >75% → fallback midi', () => {
      // capacité matin = 270min, 75% = 202.5min → on remplit avec 14 tâches × 15min = 210min
      const dayTasks: Task[] = [];
      for (let i = 0; i < 14; i++) {
        dayTasks.push(makeTask({ id: `tasks.md:${i}`, timeSlot: 'matin' }));
      }
      const task = makeTask({ id: 'new', text: 'Nouvelle' });
      const result = computeAutoSlot(task, dayTasks, {});
      expect(result.source).toBe('nextfit');
      expect(result.slot).toBe('midi');
    });
  });

  describe('Priorité : explicit > time > history > file > nextfit', () => {
    it('explicit court-circuite tout', () => {
      const task = makeTask({
        timeSlot: 'aprem',
        reminderTime: '07:00',
        sourceFile: 'Routine soir.md',
        text: 'X',
      });
      const history: CompletionHistory = {
        X: [
          { slot: 'matin', timestamp: '2026-05-15T07:00:00Z' },
          { slot: 'matin', timestamp: '2026-05-16T07:00:00Z' },
        ],
      };
      const result = computeAutoSlot(task, [], history);
      expect(result.source).toBe('explicit');
      expect(result.slot).toBe('aprem');
    });

    it('time court-circuite history et file', () => {
      const task = makeTask({
        reminderTime: '20:00',
        sourceFile: 'Routine matin.md',
        text: 'Y',
      });
      const history: CompletionHistory = {
        Y: [
          { slot: 'aprem', timestamp: '2026-05-15T15:00:00Z' },
          { slot: 'aprem', timestamp: '2026-05-16T15:00:00Z' },
        ],
      };
      const result = computeAutoSlot(task, [], history);
      expect(result).toEqual({ slot: 'soir', source: 'time' });
    });

    it('history court-circuite file', () => {
      const task = makeTask({
        sourceFile: 'Routine matin.md',
        text: 'Z',
      });
      const history: CompletionHistory = {
        Z: [
          { slot: 'soir', timestamp: '2026-05-15T20:00:00Z' },
          { slot: 'soir', timestamp: '2026-05-16T20:00:00Z' },
        ],
      };
      const result = computeAutoSlot(task, [], history);
      expect(result).toEqual({ slot: 'soir', source: 'history' });
    });
  });
});

// ─── estimateTaskDuration ────────────────────────────────────────────────────

describe('estimateTaskDuration', () => {
  it('défaut 15min sans info', () => {
    expect(estimateTaskDuration(makeTask())).toBe(15);
  });

  it('extrait "30min" dans reminderTime', () => {
    expect(estimateTaskDuration(makeTask({ reminderTime: '07:30 · 30min' }))).toBe(30);
  });

  it('SLOT_DEFINITIONS exposées (sanity check)', () => {
    expect(SLOT_DEFINITIONS.matin.capacityMinutes).toBe(270);
    expect(SLOT_DEFINITIONS.midi.capacityMinutes).toBe(90);
  });
});

// ─── computeDayPlacement — répartition cumulative ──────────────────────────

describe('computeDayPlacement', () => {
  const emptyHistory: CompletionHistory = {};

  it('22 tâches sans signal se répartissent dans les 4 slots (anti-régression "tout matin")', () => {
    const tasks = Array.from({ length: 22 }, (_, i) =>
      makeTask({ id: `t${i}`, text: `Tâche ${i}` })
    );
    const placed = computeDayPlacement(tasks, emptyHistory);

    const bySlot = placed.reduce<Record<string, number>>((acc, p) => {
      acc[p.slot] = (acc[p.slot] ?? 0) + 1;
      return acc;
    }, {});

    expect(placed).toHaveLength(22);
    // Matin doit saturer à ~18 tâches (270*0.75/15 = 13.5 → 14 tâches puis on passe)
    // En tout cas pas 22 dans le même slot.
    expect(bySlot.matin ?? 0).toBeLessThan(22);
    // Au moins 2 slots distincts utilisés
    expect(Object.keys(bySlot).length).toBeGreaterThanOrEqual(2);
  });

  it('tâche explicit garde son slot, indépendamment du cumul', () => {
    const t1 = makeTask({ id: 't1', text: 'Lessive', timeSlot: 'soir' });
    const t2 = makeTask({ id: 't2', text: 'Vague' });
    const placed = computeDayPlacement([t1, t2], emptyHistory);
    expect(placed.find(p => p.task.id === 't1')?.slot).toBe('soir');
    expect(placed.find(p => p.task.id === 't1')?.source).toBe('explicit');
  });

  it('tâche avec reminderTime placée par "time"', () => {
    const t = makeTask({ id: 't1', text: 'RDV', reminderTime: '14:30' });
    const placed = computeDayPlacement([t], emptyHistory);
    expect(placed[0].slot).toBe('aprem');
    expect(placed[0].source).toBe('time');
  });

  it('cumul respecte les tâches à signal fort déjà placées', () => {
    // 1 tâche explicit matin 30min + 17 tâches sans signal de 15min
    // Capacité matin = 270*0.75 = 202.5min disponibles
    // 1*30 (explicit) + 11*15 = 195min → 12 dans matin total, le reste passe à midi/aprem
    const explicitMatin = makeTask({
      id: 'exp',
      text: 'Lessive',
      timeSlot: 'matin',
      reminderTime: '07:00 · 30min',
    });
    const vagues = Array.from({ length: 17 }, (_, i) =>
      makeTask({ id: `v${i}`, text: `Tâche vague ${i}` })
    );
    const placed = computeDayPlacement([explicitMatin, ...vagues], emptyHistory);
    const matinCount = placed.filter(p => p.slot === 'matin').length;
    // Ne dépasse pas la capacité raisonnable
    expect(matinCount).toBeLessThanOrEqual(13);
  });
});
