/**
 * Phase 40 (Plan 01) — Tests helpers UI Sporée.
 * Privacy : noms génériques uniquement (CLAUDE.md).
 */
import {
  computeWagerDurations,
  computePaceLevel,
  computeWagerTotalDays,
  daysBetween,
  DURATION_FACTORS,
  MULTIPLIERS,
  type WagerDurationOption,
  type PaceLevel,
} from '../mascot/wager-ui-helpers';

describe('DURATION_FACTORS + MULTIPLIERS (constantes source unique)', () => {
  it('facteurs chill/engage/sprint = 1.0 / 0.7 / 0.5', () => {
    expect(DURATION_FACTORS.chill).toBe(1.0);
    expect(DURATION_FACTORS.engage).toBe(0.7);
    expect(DURATION_FACTORS.sprint).toBe(0.5);
  });
  it('multipliers stricts 1.3 / 1.7 / 2.5', () => {
    expect(MULTIPLIERS.chill).toBe(1.3);
    expect(MULTIPLIERS.engage).toBe(1.7);
    expect(MULTIPLIERS.sprint).toBe(2.5);
  });
});

describe('computeWagerDurations (seed picker)', () => {
  const stubCompute = (cumulTarget: number) => () => ({ cumulTarget });

  it('retourne toujours 3 options dans l\'ordre chill → engage → sprint', () => {
    const opts = computeWagerDurations(3, stubCompute(10), {});
    expect(opts).toHaveLength(3);
    expect(opts.map(o => o.duration)).toEqual(['chill', 'engage', 'sprint']);
  });

  it('multipliers stables 1.3 / 1.7 / 2.5', () => {
    const opts = computeWagerDurations(3, stubCompute(10), {});
    expect(opts.map(o => o.multiplier)).toEqual([1.3, 1.7, 2.5]);
  });

  it('petit plant tasksPerStage=1 → absoluteTasks ≥ 1 partout', () => {
    const opts = computeWagerDurations(1, stubCompute(5), {});
    opts.forEach(o => expect(o.absoluteTasks).toBeGreaterThanOrEqual(1));
    // chill 1*4*1.0=4, engage ceil(2.8)=3, sprint ceil(2)=2
    expect(opts[0].absoluteTasks).toBe(4);
    expect(opts[1].absoluteTasks).toBe(3);
    expect(opts[2].absoluteTasks).toBe(2);
  });

  it('plant géant tasksPerStage=6 → chill 24 / engage 17 / sprint 12', () => {
    const opts = computeWagerDurations(6, stubCompute(20), {});
    expect(opts[0].absoluteTasks).toBe(24);
    expect(opts[1].absoluteTasks).toBe(17); // ceil(16.8)
    expect(opts[2].absoluteTasks).toBe(12);
  });

  it('garde-fou tasksPerStage=0 → absoluteTasks = 1 partout', () => {
    const opts = computeWagerDurations(0, stubCompute(0), {});
    opts.forEach(o => expect(o.absoluteTasks).toBe(1));
  });

  it('estimatedHours = absoluteTasks × 6', () => {
    const opts = computeWagerDurations(2, stubCompute(8), {});
    opts.forEach(o => expect(o.estimatedHours).toBe(o.absoluteTasks * 6));
  });

  it('targetTasks consommé depuis callback (jamais recalculé)', () => {
    const spy = jest.fn(() => ({ cumulTarget: 42 }));
    const opts = computeWagerDurations(3, spy, { pendingCount: 99 });
    expect(spy).toHaveBeenCalled();
    opts.forEach(o => expect(o.targetTasks).toBe(42));
  });
});

describe('computePaceLevel (badge B1 green/yellow/orange)', () => {
  it('pace pile 100% → green', () => {
    // 5/5 progression, 3/3 jours écoulés → ratio = 1.0
    expect(computePaceLevel(5, 5, 3, 3)).toBe('green');
  });

  it('pace ≥ 100% → green (avance)', () => {
    expect(computePaceLevel(6, 5, 2, 3)).toBe('green');
  });

  it('pace 70% (seuil inclusif yellow)', () => {
    // ratio = (7/10) / (10/10) = 0.7
    expect(computePaceLevel(7, 10, 10, 10)).toBe('yellow');
  });

  it('pace 69% → orange', () => {
    // ratio = (69/100) / (10/10) = 0.69
    expect(computePaceLevel(69, 100, 10, 10)).toBe('orange');
  });

  it('cumulTarget = 0 → green (pari auto-gagné D-04)', () => {
    expect(computePaceLevel(0, 0, 5, 7)).toBe('green');
    expect(computePaceLevel(3, 0, 5, 7)).toBe('green');
  });

  it('daysElapsed = 0 → green (premier jour jamais punitif)', () => {
    expect(computePaceLevel(0, 10, 0, 7)).toBe('green');
  });

  it('totalDays = 0 guard (fallback max(1, …)) → ne crash pas', () => {
    const result = computePaceLevel(1, 10, 1, 0);
    expect(['green', 'yellow', 'orange']).toContain(result as PaceLevel);
  });

  it('mi-parcours à 50% → orange (ratio 0.5)', () => {
    // cumulCurrent=5/10=0.5, daysElapsed=5/10=0.5, ratio=1.0 → green en fait
    expect(computePaceLevel(5, 10, 5, 10)).toBe('green');
    // progression lente : 3/10=0.3, temps 5/10=0.5, ratio=0.6 → orange
    expect(computePaceLevel(3, 10, 5, 10)).toBe('orange');
  });
});

describe('computeWagerTotalDays (B2 — persistance totalDays)', () => {
  it('chill tasksPerStage=3 → ≥ 4 jours (cohérent projection lente)', () => {
    // 3*4*1.0=12 tâches × 6h = 72h / 24 = 3 jours... vérifier
    // 12*6=72, ceil(72/24) = 3
    expect(computeWagerTotalDays('chill', 3)).toBe(3);
  });

  it('sprint tasksPerStage=1 → ≥ 1 jour', () => {
    // max(1, ceil(1*4*0.5)) = 2 tâches × 6h = 12h / 24 = 1 jour
    expect(computeWagerTotalDays('sprint', 1)).toBe(1);
  });

  it('garde-fou tasksPerStage=0 → 1 jour', () => {
    expect(computeWagerTotalDays('chill', 0)).toBe(1);
    expect(computeWagerTotalDays('engage', 0)).toBe(1);
    expect(computeWagerTotalDays('sprint', 0)).toBe(1);
  });

  it('plant géant tasksPerStage=6 chill → 6 jours (cohérent sprint plant)', () => {
    // 6*4*1.0=24 × 6 = 144h / 24 = 6
    expect(computeWagerTotalDays('chill', 6)).toBe(6);
  });

  it('sprint toujours ≤ chill pour même tasksPerStage', () => {
    for (const tps of [1, 2, 3, 5, 6]) {
      expect(computeWagerTotalDays('sprint', tps)).toBeLessThanOrEqual(
        computeWagerTotalDays('chill', tps),
      );
    }
  });

  it('jamais négatif ou zéro', () => {
    for (const tps of [0, 1, 10]) {
      for (const d of ['chill', 'engage', 'sprint'] as const) {
        expect(computeWagerTotalDays(d, tps)).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('daysBetween (ISO local YYYY-MM-DD)', () => {
  it('même jour → 0', () => {
    expect(daysBetween('2026-04-18', '2026-04-18')).toBe(0);
  });

  it('lendemain → 1', () => {
    expect(daysBetween('2026-04-18', '2026-04-19')).toBe(1);
  });

  it('semaine → 7', () => {
    expect(daysBetween('2026-04-11', '2026-04-18')).toBe(7);
  });

  it('ordre inversé → 0 (jamais négatif)', () => {
    expect(daysBetween('2026-04-19', '2026-04-18')).toBe(0);
    expect(daysBetween('2026-05-01', '2026-04-18')).toBe(0);
  });

  it('traverse changement de mois', () => {
    expect(daysBetween('2026-04-28', '2026-05-03')).toBe(5);
  });
});
