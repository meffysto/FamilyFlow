/**
 * Phase 39 Plan 02 (SPOR-13) — Suite Jest moteur prorata Sporée.
 * Couverture SPOR-03 / SPOR-04 / SPOR-05 / SPOR-06 + bornes D-02 / D-03 / D-04 / D-05 / D-06.
 * Privacy : noms génériques Lucas / Emma / Sofia / Noah / Leo uniquement (CLAUDE.md).
 */
import {
  computeAgeCategory,
  resolveWeight,
  isProfileActive7d,
  filterTasksForWager,
  computeCumulTarget,
  canSealWager,
  shouldRecompute,
  maybeRecompute,
  validateWagerOnHarvest,
  yearsDiff,
  WEIGHT_BY_CATEGORY,
} from '../mascot/wager-engine';
import type { Profile, Task } from '../types';

// ─────────────────────────────────────────────
// Helpers factories
// ─────────────────────────────────────────────

const makeProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'lucas_adulte',
  name: 'Lucas',
  role: 'adulte',
  avatar: '👨',
  mascotDecorations: [],
  mascotInhabitants: [],
  mascotPlacements: {},
  points: 0,
  coins: 0,
  level: 1,
  streak: 0,
  lootBoxesAvailable: 0,
  multiplier: 1,
  multiplierRemaining: 0,
  pityCounter: 0,
  ...overrides,
});

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  text: 'test',
  completed: false,
  tags: [],
  mentions: [],
  sourceFile: '',
  lineIndex: 0,
  ...overrides,
});

// ─────────────────────────────────────────────
// 1. computeAgeCategory (D-02)
// ─────────────────────────────────────────────

describe('computeAgeCategory (D-02 — bornes inclusives)', () => {
  it('0 an révolu → bebe', () => {
    expect(computeAgeCategory('2026-01-15', '2026-04-18')).toBe('bebe');
  });
  it('1 an → bebe', () => {
    expect(computeAgeCategory('2025-01-15', '2026-04-18')).toBe('bebe');
  });
  it('2 ans révolus → bebe (borne haute)', () => {
    expect(computeAgeCategory('2024-01-15', '2026-04-18')).toBe('bebe');
  });
  it('3 ans → jeune (borne basse)', () => {
    expect(computeAgeCategory('2023-01-15', '2026-04-18')).toBe('jeune');
  });
  it('5 ans → jeune (borne haute)', () => {
    expect(computeAgeCategory('2021-01-15', '2026-04-18')).toBe('jeune');
  });
  it('6 ans → enfant (borne basse)', () => {
    expect(computeAgeCategory('2020-01-15', '2026-04-18')).toBe('enfant');
  });
  it('12 ans → enfant (borne haute)', () => {
    expect(computeAgeCategory('2014-01-15', '2026-04-18')).toBe('enfant');
  });
  it('13 ans → ado (borne basse)', () => {
    expect(computeAgeCategory('2013-01-15', '2026-04-18')).toBe('ado');
  });
  it('17 ans → ado (borne haute)', () => {
    expect(computeAgeCategory('2009-01-15', '2026-04-18')).toBe('ado');
  });
  it('18 ans → adulte (borne basse)', () => {
    expect(computeAgeCategory('2008-01-15', '2026-04-18')).toBe('adulte');
  });
  it('35 ans → adulte', () => {
    expect(computeAgeCategory('1991-01-15', '2026-04-18')).toBe('adulte');
  });
  it('65 ans → adulte', () => {
    expect(computeAgeCategory('1961-01-15', '2026-04-18')).toBe('adulte');
  });
  it('Format YYYY seul ("1990") → parsé comme 1990-01-01', () => {
    expect(computeAgeCategory('1990', '2026-04-18')).toBe('adulte');
  });
  it("Anniversaire non passé dans l'année — né 2020-06-15, today 2026-04-18 → 5 ans (jeune)", () => {
    // 2026 - 2020 = 6 brut, mais anniversaire 2026-06-15 pas encore atteint → 5 ans.
    expect(computeAgeCategory('2020-06-15', '2026-04-18')).toBe('jeune');
  });
  it('Anniversaire juste passé — né 2020-06-15, today 2026-06-16 → 6 ans (enfant)', () => {
    expect(computeAgeCategory('2020-06-15', '2026-06-16')).toBe('enfant');
  });
  it('yearsDiff exposé pour usage externe', () => {
    expect(yearsDiff(new Date('2020-01-01T00:00:00'), new Date('2026-04-18T00:00:00'))).toBe(6);
    expect(yearsDiff(new Date('2020-06-15T00:00:00'), new Date('2026-04-18T00:00:00'))).toBe(5);
  });
});

// ─────────────────────────────────────────────
// 2. resolveWeight (D-03)
// ─────────────────────────────────────────────

describe('resolveWeight (D-03 — override prioritaire)', () => {
  it('Constantes WEIGHT_BY_CATEGORY exactes', () => {
    expect(WEIGHT_BY_CATEGORY).toEqual({
      adulte: 1.0,
      ado: 0.7,
      enfant: 0.4,
      jeune: 0.15,
      bebe: 0.0,
    });
  });
  it("override='adulte' → 1.0 même sans birthdate", () => {
    const p = makeProfile({ weight_override: 'adulte' });
    expect(resolveWeight(p, '2026-04-18')).toBe(1.0);
  });
  it("override='bebe' → 0.0", () => {
    const p = makeProfile({ weight_override: 'bebe' });
    expect(resolveWeight(p, '2026-04-18')).toBe(0.0);
  });
  it("override='jeune' écrase birthdate adulte", () => {
    const p = makeProfile({ birthdate: '1990-01-01', weight_override: 'jeune' });
    expect(resolveWeight(p, '2026-04-18')).toBe(0.15);
  });
  it('Pas d\'override + birthdate 2018-01-01 + today 2026-04-18 → 0.4 (enfant)', () => {
    const p = makeProfile({ id: 'sofia_enfant', name: 'Sofia', birthdate: '2018-01-01' });
    expect(resolveWeight(p, '2026-04-18')).toBe(0.4);
  });
  it('Pas d\'override ni birthdate → fallback 1.0 + console.warn (sous __DEV__)', () => {
    const prevDev = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const p = makeProfile({ id: 'unknown', name: 'X', birthdate: undefined });
    expect(resolveWeight(p, '2026-04-18')).toBe(1.0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('unknown');
    warnSpy.mockRestore();
    (globalThis as { __DEV__?: boolean }).__DEV__ = prevDev;
  });
  it("Ado via birthdate 2010-03-01, today 2026-04-18 → 0.7", () => {
    const p = makeProfile({ id: 'noah_ado', name: 'Noah', birthdate: '2010-03-01' });
    expect(resolveWeight(p, '2026-04-18')).toBe(0.7);
  });
});

// ─────────────────────────────────────────────
// 3. isProfileActive7d (SPOR-05)
// ─────────────────────────────────────────────

describe('isProfileActive7d (SPOR-05 — fenêtre 7j glissants)', () => {
  const lucas = makeProfile({ id: 'lucas_adulte', name: 'Lucas' });

  it('1 tâche completed today avec mention id → true', () => {
    const tasks = [
      makeTask({ completed: true, completedDate: '2026-04-18', mentions: ['lucas_adulte'] }),
    ];
    expect(isProfileActive7d(tasks, lucas, '2026-04-18')).toBe(true);
  });
  it('1 tâche completed il y a 7j pile → true (borne inclusive)', () => {
    const tasks = [
      makeTask({ completed: true, completedDate: '2026-04-11', mentions: ['lucas_adulte'] }),
    ];
    expect(isProfileActive7d(tasks, lucas, '2026-04-18')).toBe(true);
  });
  it('1 tâche completed il y a 8j → false (hors fenêtre)', () => {
    const tasks = [
      makeTask({ completed: true, completedDate: '2026-04-10', mentions: ['lucas_adulte'] }),
    ];
    expect(isProfileActive7d(tasks, lucas, '2026-04-18')).toBe(false);
  });
  it('Pitfall 3 : completed=true mais completedDate absent → false', () => {
    const tasks = [
      makeTask({ completed: true, completedDate: undefined, mentions: ['lucas_adulte'] }),
    ];
    expect(isProfileActive7d(tasks, lucas, '2026-04-18')).toBe(false);
  });
  it("completed=false (même si completedDate dans fenêtre) → false", () => {
    const tasks = [
      makeTask({ completed: false, completedDate: '2026-04-17', mentions: ['lucas_adulte'] }),
    ];
    expect(isProfileActive7d(tasks, lucas, '2026-04-18')).toBe(false);
  });
  it('Aucune tâche associée au profil → false', () => {
    const tasks = [
      makeTask({ completed: true, completedDate: '2026-04-18', mentions: ['emma_adulte'] }),
    ];
    expect(isProfileActive7d(tasks, lucas, '2026-04-18')).toBe(false);
  });
  it('Attribution par mentions.includes(name) → true', () => {
    const tasks = [
      makeTask({ completed: true, completedDate: '2026-04-17', mentions: ['Lucas'] }),
    ];
    expect(isProfileActive7d(tasks, lucas, '2026-04-18')).toBe(true);
  });
  it('Attribution par sourceFile contenant le name (case-insensitive) → true', () => {
    const tasks = [
      makeTask({
        completed: true,
        completedDate: '2026-04-17',
        mentions: [],
        sourceFile: '01 - Enfants/LUCAS/Tâches récurrentes.md',
      }),
    ];
    expect(isProfileActive7d(tasks, lucas, '2026-04-18')).toBe(true);
  });
  it('completedDate dans le futur (today+1) → false', () => {
    const tasks = [
      makeTask({ completed: true, completedDate: '2026-04-19', mentions: ['lucas_adulte'] }),
    ];
    expect(isProfileActive7d(tasks, lucas, '2026-04-18')).toBe(false);
  });
  it('Liste vide → false', () => {
    expect(isProfileActive7d([], lucas, '2026-04-18')).toBe(false);
  });
});

// ─────────────────────────────────────────────
// 4. filterTasksForWager (SPOR-06)
// ─────────────────────────────────────────────

describe('filterTasksForWager (SPOR-06 — filtre domaine Tasks)', () => {
  it('sourceFile "01 - Enfants/Lucas/Tâches récurrentes.md" → gardée', () => {
    const t = makeTask({ sourceFile: '01 - Enfants/Lucas/Tâches récurrentes.md' });
    expect(filterTasksForWager([t])).toHaveLength(1);
  });
  it('sourceFile "02 - Maison/Tâches récurrentes.md" → gardée', () => {
    const t = makeTask({ sourceFile: '02 - Maison/Tâches récurrentes.md' });
    expect(filterTasksForWager([t])).toHaveLength(1);
  });
  it('sourceFile sans accent "taches recurrentes" → gardée (tolérance)', () => {
    const t = makeTask({ sourceFile: '02 - Maison/taches recurrentes.md' });
    expect(filterTasksForWager([t])).toHaveLength(1);
  });
  it('sourceFile "03 - Cuisine/Liste de courses.md" → exclue', () => {
    const t = makeTask({ sourceFile: '03 - Cuisine/Liste de courses.md' });
    expect(filterTasksForWager([t])).toHaveLength(0);
  });
  it('sourceFile "04 - Gamification/routines.md" → exclue', () => {
    const t = makeTask({ sourceFile: '04 - Gamification/routines.md' });
    expect(filterTasksForWager([t])).toHaveLength(0);
  });
  it('sourceFile "05 - Journal/moods.md" → exclue', () => {
    const t = makeTask({ sourceFile: '05 - Journal/moods.md' });
    expect(filterTasksForWager([t])).toHaveLength(0);
  });
  it('sourceFile "02 - Maison/anniversaires.md" → exclue', () => {
    const t = makeTask({ sourceFile: '02 - Maison/anniversaires.md' });
    expect(filterTasksForWager([t])).toHaveLength(0);
  });
  it('Mix de 7 tâches → seules les 2 "Tâches récurrentes" sortent', () => {
    const tasks = [
      makeTask({ id: 'a', sourceFile: '01 - Enfants/Lucas/Tâches récurrentes.md' }),
      makeTask({ id: 'b', sourceFile: '02 - Maison/Tâches récurrentes.md' }),
      makeTask({ id: 'c', sourceFile: '03 - Cuisine/Liste de courses.md' }),
      makeTask({ id: 'd', sourceFile: '03 - Cuisine/Repas/2026-04-18.md' }),
      makeTask({ id: 'e', sourceFile: '04 - Gamification/routines.md' }),
      makeTask({ id: 'f', sourceFile: '05 - Journal/moods.md' }),
      makeTask({ id: 'g', sourceFile: '02 - Maison/anniversaires.md' }),
    ];
    const kept = filterTasksForWager(tasks);
    expect(kept.map(t => t.id).sort()).toEqual(['a', 'b']);
  });
});

// ─────────────────────────────────────────────
// 5. computeCumulTarget (SPOR-03/04 + formule prorata D-04)
// ─────────────────────────────────────────────

describe('computeCumulTarget (formule prorata D-04)', () => {
  const today = '2026-04-18';
  const recentDate = '2026-04-17';

  const activeTask = (profileId: string): Task =>
    makeTask({ id: `t_${profileId}`, completed: true, completedDate: recentDate, mentions: [profileId] });

  it('2 adultes actifs (1.0+1.0) + sealeur adulte + 20 pending → cumulTarget = 10', () => {
    const lucas = makeProfile({ id: 'lucas_adulte', name: 'Lucas', birthdate: '1990-01-01' });
    const emma = makeProfile({ id: 'emma_adulte', name: 'Emma', birthdate: '1992-01-01' });
    const tasks = [activeTask('lucas_adulte'), activeTask('emma_adulte')];
    const res = computeCumulTarget({
      sealerProfileId: 'lucas_adulte',
      allProfiles: [lucas, emma],
      tasks,
      today,
      pendingCount: 20,
    });
    expect(res.cumulTarget).toBe(10);
    expect(res.familyWeightSum).toBe(2.0);
    expect(res.sealerWeight).toBe(1.0);
    expect(res.activeProfileIds.sort()).toEqual(['emma_adulte', 'lucas_adulte']);
  });

  it('1 adulte sealeur seul actif + 10 pending → cumulTarget = 10 (prorata=1.0)', () => {
    const lucas = makeProfile({ id: 'lucas_adulte', name: 'Lucas', birthdate: '1990-01-01' });
    const res = computeCumulTarget({
      sealerProfileId: 'lucas_adulte',
      allProfiles: [lucas],
      tasks: [],
      today,
      pendingCount: 10,
    });
    expect(res.cumulTarget).toBe(10);
    expect(res.familyWeightSum).toBe(1.0);
    expect(res.activeProfileIds).toEqual(['lucas_adulte']);
  });

  it('1 adulte sealeur + 1 ado actif (0.7) + 15 pending → Math.ceil(1.0/1.7 × 15) = 9', () => {
    const lucas = makeProfile({ id: 'lucas_adulte', name: 'Lucas', birthdate: '1990-01-01' });
    const noah = makeProfile({ id: 'noah_ado', name: 'Noah', role: 'ado', birthdate: '2010-01-01' });
    const tasks = [activeTask('noah_ado')];
    const res = computeCumulTarget({
      sealerProfileId: 'lucas_adulte',
      allProfiles: [lucas, noah],
      tasks,
      today,
      pendingCount: 15,
    });
    expect(res.cumulTarget).toBe(9); // 1.0/1.7 * 15 = 8.82 → ceil = 9
    expect(res.familyWeightSum).toBeCloseTo(1.7, 5);
  });

  it('Profils grossesse exclus — 2 adultes + 1 grossesse → somme = 2.0 (grossesse ignorée)', () => {
    const lucas = makeProfile({ id: 'lucas_adulte', name: 'Lucas', birthdate: '1990-01-01' });
    const emma = makeProfile({ id: 'emma_adulte', name: 'Emma', birthdate: '1992-01-01' });
    const futur = makeProfile({ id: 'futur_bebe', name: 'Futur', statut: 'grossesse', birthdate: '2026-09-01' });
    const tasks = [activeTask('lucas_adulte'), activeTask('emma_adulte')];
    const res = computeCumulTarget({
      sealerProfileId: 'lucas_adulte',
      allProfiles: [lucas, emma, futur],
      tasks,
      today,
      pendingCount: 10,
    });
    expect(res.familyWeightSum).toBe(2.0);
    expect(res.activeProfileIds).not.toContain('futur_bebe');
    expect(res.weights['futur_bebe']).toBeUndefined();
  });

  it('Diviseur = 0 (sealeur bébé sans co-actifs) → cumulTarget = pendingCount (fallback D-04)', () => {
    const leo = makeProfile({ id: 'bebe_leo', name: 'Leo', role: 'enfant', weight_override: 'bebe' });
    const res = computeCumulTarget({
      sealerProfileId: 'bebe_leo',
      allProfiles: [leo],
      tasks: [],
      today,
      pendingCount: 7,
    });
    expect(res.cumulTarget).toBe(7);
    expect(res.familyWeightSum).toBe(0);
    expect(res.sealerWeight).toBe(0);
  });

  it('pendingCount = 0 → cumulTarget = 0', () => {
    const lucas = makeProfile({ id: 'lucas_adulte', name: 'Lucas', birthdate: '1990-01-01' });
    const res = computeCumulTarget({
      sealerProfileId: 'lucas_adulte',
      allProfiles: [lucas],
      tasks: [],
      today,
      pendingCount: 0,
    });
    expect(res.cumulTarget).toBe(0);
  });

  it('Sealeur introuvable → cumulTarget = pendingCount (fallback)', () => {
    const emma = makeProfile({ id: 'emma_adulte', name: 'Emma', birthdate: '1992-01-01' });
    const tasks = [activeTask('emma_adulte')];
    const res = computeCumulTarget({
      sealerProfileId: 'ghost_profile',
      allProfiles: [emma],
      tasks,
      today,
      pendingCount: 12,
    });
    expect(res.cumulTarget).toBe(12);
    expect(res.sealerWeight).toBe(0);
  });

  it('Prorata fractionnaire — 3 adultes actifs + 10 pending → Math.ceil(1/3 × 10) = 4', () => {
    const lucas = makeProfile({ id: 'lucas_adulte', name: 'Lucas', birthdate: '1990-01-01' });
    const emma = makeProfile({ id: 'emma_adulte', name: 'Emma', birthdate: '1992-01-01' });
    const parent3 = makeProfile({ id: 'parent3_adulte', name: 'Parent3', birthdate: '1985-01-01' });
    const tasks = [
      activeTask('lucas_adulte'),
      activeTask('emma_adulte'),
      activeTask('parent3_adulte'),
    ];
    const res = computeCumulTarget({
      sealerProfileId: 'lucas_adulte',
      allProfiles: [lucas, emma, parent3],
      tasks,
      today,
      pendingCount: 10,
    });
    expect(res.cumulTarget).toBe(4); // 1/3 * 10 = 3.33 → ceil = 4
    expect(res.familyWeightSum).toBe(3.0);
  });

  it('Famille mixte : 2 adultes + 1 enfant actif (0.4) + 1 bébé (0) + 10 pending, sealeur adulte → 4', () => {
    const lucas = makeProfile({ id: 'lucas_adulte', name: 'Lucas', birthdate: '1990-01-01' });
    const emma = makeProfile({ id: 'emma_adulte', name: 'Emma', birthdate: '1992-01-01' });
    const sofia = makeProfile({ id: 'sofia_enfant', name: 'Sofia', role: 'enfant', birthdate: '2018-01-01' });
    const leo = makeProfile({ id: 'bebe_leo', name: 'Leo', role: 'enfant', birthdate: '2025-01-01' });
    const tasks = [
      activeTask('lucas_adulte'),
      activeTask('emma_adulte'),
      activeTask('sofia_enfant'),
    ];
    const res = computeCumulTarget({
      sealerProfileId: 'lucas_adulte',
      allProfiles: [lucas, emma, sofia, leo],
      tasks,
      today,
      pendingCount: 10,
    });
    // Somme actifs à poids > 0 : 1.0 + 1.0 + 0.4 = 2.4 (leo exclu car poids 0)
    expect(res.familyWeightSum).toBeCloseTo(2.4, 5);
    // 1.0 / 2.4 * 10 = 4.166 → ceil = 5
    expect(res.cumulTarget).toBe(5);
    expect(res.activeProfileIds).not.toContain('bebe_leo');
  });
});

// ─────────────────────────────────────────────
// 6. canSealWager (D-04)
// ─────────────────────────────────────────────

describe('canSealWager (D-04 — refus poids 0)', () => {
  const today = '2026-04-18';

  it('Adulte poids 1.0 → { ok: true }', () => {
    const lucas = makeProfile({ id: 'lucas_adulte', name: 'Lucas', birthdate: '1990-01-01' });
    expect(canSealWager({ sealerProfileId: 'lucas_adulte', allProfiles: [lucas], today })).toEqual({ ok: true });
  });

  it('Bébé poids 0 via birthdate → { ok: false, reason: zero_weight }', () => {
    const leo = makeProfile({ id: 'bebe_leo', name: 'Leo', role: 'enfant', birthdate: '2025-01-01' });
    expect(canSealWager({ sealerProfileId: 'bebe_leo', allProfiles: [leo], today })).toEqual({
      ok: false,
      reason: 'zero_weight',
    });
  });

  it("Override='bebe' sur adulte → { ok: false, reason: zero_weight }", () => {
    const weird = makeProfile({ id: 'weird', name: 'W', birthdate: '1990-01-01', weight_override: 'bebe' });
    expect(canSealWager({ sealerProfileId: 'weird', allProfiles: [weird], today })).toEqual({
      ok: false,
      reason: 'zero_weight',
    });
  });

  it('Profil inexistant → { ok: false, reason: profile_not_found }', () => {
    const lucas = makeProfile({ id: 'lucas_adulte', name: 'Lucas', birthdate: '1990-01-01' });
    expect(canSealWager({ sealerProfileId: 'ghost', allProfiles: [lucas], today })).toEqual({
      ok: false,
      reason: 'profile_not_found',
    });
  });

  it("Ado (poids 0.7) → { ok: true }", () => {
    const noah = makeProfile({ id: 'noah_ado', name: 'Noah', role: 'ado', birthdate: '2010-01-01' });
    expect(canSealWager({ sealerProfileId: 'noah_ado', allProfiles: [noah], today })).toEqual({ ok: true });
  });
});

// ─────────────────────────────────────────────
// 7. shouldRecompute + maybeRecompute + validateWagerOnHarvest (D-05, D-06)
// ─────────────────────────────────────────────

describe('shouldRecompute / maybeRecompute / validateWagerOnHarvest (D-05, D-06)', () => {
  // 2026-04-18 à 10h00 LOCAL — getLocalDateKey retourne '2026-04-18'
  const now10h = new Date(2026, 3, 18, 10, 0, 0);
  // 2026-04-18 à 23h45 LOCAL
  const now2345 = new Date(2026, 3, 18, 23, 45, 0);

  it('shouldRecompute : lastRecomputeDate === today → false (no-op même jour)', () => {
    expect(shouldRecompute(now10h, '2026-04-18')).toBe(false);
    expect(shouldRecompute(now2345, '2026-04-18')).toBe(false);
  });

  it('shouldRecompute : lastRecomputeDate < today (jour passé) → true (catchup)', () => {
    expect(shouldRecompute(now10h, '2026-04-17')).toBe(true);
    expect(shouldRecompute(now10h, '2026-04-10')).toBe(true);
  });

  it('shouldRecompute : lastRecomputeDate > today (défensif) → false', () => {
    expect(shouldRecompute(now10h, '2026-04-19')).toBe(false);
  });

  it("shouldRecompute : lastRecomputeDate vide ('') → true (premier compute)", () => {
    expect(shouldRecompute(now10h, '')).toBe(true);
  });

  it('maybeRecompute : shouldRecompute=false → { recomputed: false }', () => {
    const lucas = makeProfile({ id: 'lucas_adulte', name: 'Lucas', birthdate: '1990-01-01' });
    const result = maybeRecompute({
      now: now10h,
      lastRecomputeDate: '2026-04-18',
      snapshot: null,
      sealerProfileId: 'lucas_adulte',
      allProfiles: [lucas],
      tasks: [],
    });
    expect(result).toEqual({ recomputed: false });
  });

  it('maybeRecompute : shouldRecompute=true → recomputed true + newRecomputeDate = today local', () => {
    const lucas = makeProfile({ id: 'lucas_adulte', name: 'Lucas', birthdate: '1990-01-01' });
    const result = maybeRecompute({
      now: now10h,
      lastRecomputeDate: '2026-04-17',
      snapshot: { date: '2026-04-18', pending: 12, activeProfileIds: ['lucas_adulte'] },
      sealerProfileId: 'lucas_adulte',
      allProfiles: [lucas],
      tasks: [],
    });
    expect(result.recomputed).toBe(true);
    if (result.recomputed) {
      expect(result.newRecomputeDate).toBe('2026-04-18');
      expect(result.result.cumulTarget).toBe(12); // seul actif → prorata 1.0
    }
  });

  it('maybeRecompute : snapshot null → pendingCount=0 → cumulTarget=0', () => {
    const lucas = makeProfile({ id: 'lucas_adulte', name: 'Lucas', birthdate: '1990-01-01' });
    const result = maybeRecompute({
      now: now10h,
      lastRecomputeDate: '',
      snapshot: null,
      sealerProfileId: 'lucas_adulte',
      allProfiles: [lucas],
      tasks: [],
    });
    expect(result.recomputed).toBe(true);
    if (result.recomputed) {
      expect(result.result.cumulTarget).toBe(0);
    }
  });

  it('validateWagerOnHarvest : cumulCurrent >= cumulTarget → won=true', () => {
    expect(validateWagerOnHarvest(10, 10)).toEqual({ won: true, cumulCurrent: 10, cumulTarget: 10 });
    expect(validateWagerOnHarvest(15, 10)).toEqual({ won: true, cumulCurrent: 15, cumulTarget: 10 });
  });

  it('validateWagerOnHarvest : cumulCurrent < cumulTarget → won=false', () => {
    expect(validateWagerOnHarvest(9, 10)).toEqual({ won: false, cumulCurrent: 9, cumulTarget: 10 });
    expect(validateWagerOnHarvest(0, 5)).toEqual({ won: false, cumulCurrent: 0, cumulTarget: 5 });
  });

  it('validateWagerOnHarvest : cumulTarget=0 → won=true (pari auto-gagné D-04)', () => {
    expect(validateWagerOnHarvest(0, 0)).toEqual({ won: true, cumulCurrent: 0, cumulTarget: 0 });
    expect(validateWagerOnHarvest(5, 0)).toEqual({ won: true, cumulCurrent: 5, cumulTarget: 0 });
  });
});
