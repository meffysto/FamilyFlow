// lib/__tests__/caps.test.ts
// Tests unitaires du système de caps anti-abus daily/weekly — Phase 20 v1.3 Seed.
// Couvre SEMANTIC-07 (daily, weekly, cross-day reset, cross-week reset).
// Pure functions testables sans SecureStore (fonctions pures uniquement).
//
// Note : getWeekStart() utilise getDay()/getDate() (heure locale) mais sort un
// toISOString() (UTC). Les tests calculent les valeurs attendues dynamiquement
// via getWeekStart() elle-même pour être insensibles au fuseau horaire du runner.

import {
  isCapExceeded,
  incrementCap,
  getWeekStart,
  DAILY_CAPS,
  WEEKLY_CAPS,
} from '../semantic/caps';
import type { CouplingCaps } from '../semantic/caps';

// ── Dates de test fixes ──────────────────────────────────────────────────────

// Lundi 06-04-2026 — toutes les dates ci-dessous sont dans la même semaine
const monday     = new Date('2026-04-06T10:00:00Z');
const tuesday    = new Date('2026-04-07T10:00:00Z');
const wednesday  = new Date('2026-04-08T10:00:00Z');
const sunday     = new Date('2026-04-12T10:00:00Z');
const nextMonday = new Date('2026-04-13T10:00:00Z'); // lundi suivant

// Valeurs calculées dynamiquement (timezone-agnostic)
const todayStr    = monday.toISOString().slice(0, 10);    // '2026-04-06'
const tomorrowStr = tuesday.toISOString().slice(0, 10);   // '2026-04-07'
const thisWeekStr = getWeekStart(monday);                  // lundi de la semaine de monday
const nextWeekStr = getWeekStart(nextMonday);              // lundi de la semaine suivante

// ── getWeekStart ─────────────────────────────────────────────────────────────

describe('getWeekStart', () => {
  it('mercredi et lundi de la même semaine retournent la même valeur', () => {
    expect(getWeekStart(wednesday)).toBe(getWeekStart(monday));
  });

  it('lundi retourne lui-même (calcul lundi de la semaine)', () => {
    // Le lundi est le début de semaine — getWeekStart(lundi) doit être identique
    // à getWeekStart(n'importe quel jour de cette semaine)
    expect(getWeekStart(monday)).toBe(getWeekStart(tuesday));
    expect(getWeekStart(monday)).toBe(getWeekStart(wednesday));
    expect(getWeekStart(monday)).toBe(getWeekStart(sunday));
  });

  it('dimanche de la semaine retourne la même valeur que le lundi de la semaine', () => {
    expect(getWeekStart(sunday)).toBe(getWeekStart(monday));
  });

  it('le lundi suivant retourne une valeur différente de la semaine courante', () => {
    expect(getWeekStart(nextMonday)).not.toBe(getWeekStart(monday));
  });

  it('retourne une chaîne au format YYYY-MM-DD', () => {
    const result = getWeekStart(wednesday);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── isCapExceeded — daily ────────────────────────────────────────────────────

describe('isCapExceeded — daily', () => {
  it('retourne true quand compteur daily = cap (menage_quotidien cap=1)', () => {
    const caps: CouplingCaps = {
      menage_quotidien: { daily: 1, weekly: 1, dayStart: todayStr, weekStart: thisWeekStr },
    };
    expect(isCapExceeded('menage_quotidien', caps, monday)).toBe(true);
  });

  it('retourne false quand compteur daily < cap (menage_quotidien cap=1, daily=0)', () => {
    const caps: CouplingCaps = {
      menage_quotidien: { daily: 0, weekly: 0, dayStart: todayStr, weekStart: thisWeekStr },
    };
    expect(isCapExceeded('menage_quotidien', caps, monday)).toBe(false);
  });

  it('retourne false quand compteur daily = 1 sur cap=2 (enfants_routines)', () => {
    const caps: CouplingCaps = {
      enfants_routines: { daily: 1, weekly: 1, dayStart: todayStr, weekStart: thisWeekStr },
    };
    expect(isCapExceeded('enfants_routines', caps, monday)).toBe(false);
  });

  it('retourne true quand compteur daily = 2 sur cap=2 (enfants_routines)', () => {
    const caps: CouplingCaps = {
      enfants_routines: { daily: 2, weekly: 2, dayStart: todayStr, weekStart: thisWeekStr },
    };
    expect(isCapExceeded('enfants_routines', caps, monday)).toBe(true);
  });

  it('cuisine_repas : DAILY_CAP=0 → jamais bloqué en daily même avec compteur élevé', () => {
    const caps: CouplingCaps = {
      cuisine_repas: { daily: 99, weekly: 0, dayStart: todayStr, weekStart: thisWeekStr },
    };
    // daily cap = 0 → skip la vérification daily, regarde weekly uniquement
    expect(isCapExceeded('cuisine_repas', caps, monday)).toBe(false);
  });
});

// ── isCapExceeded — weekly ───────────────────────────────────────────────────

describe('isCapExceeded — weekly', () => {
  it('retourne true quand compteur weekly = cap (menage_quotidien cap=5)', () => {
    const caps: CouplingCaps = {
      menage_quotidien: { daily: 0, weekly: 5, dayStart: todayStr, weekStart: thisWeekStr },
    };
    expect(isCapExceeded('menage_quotidien', caps, monday)).toBe(true);
  });

  it('retourne false quand compteur weekly < cap (menage_quotidien cap=5, weekly=4)', () => {
    const caps: CouplingCaps = {
      menage_quotidien: { daily: 0, weekly: 4, dayStart: todayStr, weekStart: thisWeekStr },
    };
    expect(isCapExceeded('menage_quotidien', caps, monday)).toBe(false);
  });

  it('cuisine_repas : bloqué après 1 usage weekly (cap=1)', () => {
    const caps: CouplingCaps = {
      cuisine_repas: { daily: 0, weekly: 1, dayStart: todayStr, weekStart: thisWeekStr },
    };
    expect(isCapExceeded('cuisine_repas', caps, monday)).toBe(true);
  });

  it('cuisine_repas : pas bloqué avant d\'atteindre weekly cap=1', () => {
    const caps: CouplingCaps = {
      cuisine_repas: { daily: 0, weekly: 0, dayStart: todayStr, weekStart: thisWeekStr },
    };
    expect(isCapExceeded('cuisine_repas', caps, monday)).toBe(false);
  });
});

// ── isCapExceeded — cross-day reset (SEMANTIC-07) ────────────────────────────

describe('isCapExceeded — cross-day reset (SEMANTIC-07)', () => {
  it('retourne false le lendemain même si daily était atteint (dayStart=hier)', () => {
    const caps: CouplingCaps = {
      menage_quotidien: { daily: 1, weekly: 3, dayStart: todayStr, weekStart: thisWeekStr },
    };
    // On teste avec tuesday (lendemain de monday)
    expect(isCapExceeded('menage_quotidien', caps, tuesday)).toBe(false);
  });

  it('retourne false quand dayStart est une date ancienne', () => {
    const caps: CouplingCaps = {
      enfants_devoirs: { daily: 5, weekly: 2, dayStart: '2026-01-01', weekStart: '2026-01-05' },
    };
    expect(isCapExceeded('enfants_devoirs', caps, monday)).toBe(false);
  });
});

// ── isCapExceeded — cross-week reset (SEMANTIC-07) ───────────────────────────

describe('isCapExceeded — cross-week reset (SEMANTIC-07)', () => {
  it('retourne false la semaine suivante même si weekly était atteint', () => {
    const caps: CouplingCaps = {
      menage_quotidien: { daily: 0, weekly: 5, dayStart: todayStr, weekStart: thisWeekStr },
    };
    // On teste avec nextMonday (semaine suivante)
    expect(isCapExceeded('menage_quotidien', caps, nextMonday)).toBe(false);
  });

  it('retourne false quand weekStart est une semaine ancienne', () => {
    const caps: CouplingCaps = {
      cuisine_repas: { daily: 0, weekly: 1, dayStart: '2026-01-01', weekStart: '2025-01-05' },
    };
    expect(isCapExceeded('cuisine_repas', caps, monday)).toBe(false);
  });
});

// ── isCapExceeded — caps vide ────────────────────────────────────────────────

describe('isCapExceeded — caps vide (jamais utilisé)', () => {
  it('retourne false pour une catégorie jamais déclenchée', () => {
    expect(isCapExceeded('menage_quotidien', {}, monday)).toBe(false);
  });

  it('retourne false pour caps={} et toutes les catégories', () => {
    const categories = Object.keys(DAILY_CAPS) as Array<keyof typeof DAILY_CAPS>;
    for (const cat of categories) {
      expect(isCapExceeded(cat, {}, monday)).toBe(false);
    }
  });
});

// ── incrementCap ─────────────────────────────────────────────────────────────

describe('incrementCap', () => {
  it('caps vide → { daily: 1, weekly: 1, dayStart: today, weekStart: thisWeek }', () => {
    const result = incrementCap({}, 'menage_quotidien', monday);
    expect(result.menage_quotidien).toEqual({
      daily: 1,
      weekly: 1,
      dayStart: todayStr,
      weekStart: thisWeekStr,
    });
  });

  it('même jour → incrémente daily + weekly de +1', () => {
    const caps: CouplingCaps = {
      menage_quotidien: { daily: 2, weekly: 4, dayStart: todayStr, weekStart: thisWeekStr },
    };
    const result = incrementCap(caps, 'menage_quotidien', monday);
    expect(result.menage_quotidien?.daily).toBe(3);
    expect(result.menage_quotidien?.weekly).toBe(5);
  });

  it('dayStart différent → remet daily à 1 (reset jour), weekly continue', () => {
    // dayStart = hier, weekStart = cette semaine
    const caps: CouplingCaps = {
      menage_quotidien: { daily: 1, weekly: 3, dayStart: '2026-04-05', weekStart: thisWeekStr },
    };
    const result = incrementCap(caps, 'menage_quotidien', monday);
    expect(result.menage_quotidien?.daily).toBe(1);   // reset jour → 0+1
    expect(result.menage_quotidien?.weekly).toBe(4);  // même semaine → 3+1
  });

  it('weekStart différent → remet weekly à 1 (reset semaine)', () => {
    const caps: CouplingCaps = {
      menage_quotidien: { daily: 0, weekly: 5, dayStart: nextMonday.toISOString().slice(0, 10), weekStart: thisWeekStr },
    };
    const result = incrementCap(caps, 'menage_quotidien', nextMonday);
    expect(result.menage_quotidien?.weekly).toBe(1);  // reset semaine → 0+1
  });

  it('retourne un nouvel objet (pas de mutation)', () => {
    const caps: CouplingCaps = {};
    const result = incrementCap(caps, 'courses', monday);
    // caps original non modifié
    expect(caps.courses).toBeUndefined();
    // résultat a la nouvelle valeur
    expect(result.courses?.daily).toBe(1);
  });

  it('ne touche pas les autres catégories', () => {
    const caps: CouplingCaps = {
      menage_quotidien: { daily: 2, weekly: 4, dayStart: todayStr, weekStart: thisWeekStr },
    };
    const result = incrementCap(caps, 'courses', monday);
    // menage_quotidien inchangé
    expect(result.menage_quotidien).toEqual(caps.menage_quotidien);
    // courses initialisé
    expect(result.courses?.daily).toBe(1);
  });
});

// ── DAILY_CAPS / WEEKLY_CAPS constants ───────────────────────────────────────

describe('DAILY_CAPS / WEEKLY_CAPS constants', () => {
  it('DAILY_CAPS a exactement 10 clés (une par CategoryId)', () => {
    expect(Object.keys(DAILY_CAPS)).toHaveLength(10);
  });

  it('WEEKLY_CAPS a exactement 10 clés (une par CategoryId)', () => {
    expect(Object.keys(WEEKLY_CAPS)).toHaveLength(10);
  });

  it('DAILY_CAPS.cuisine_repas === 0 (pas de cap daily — EFFECTS-10)', () => {
    expect(DAILY_CAPS.cuisine_repas).toBe(0);
  });

  it('WEEKLY_CAPS.cuisine_repas === 1 (max 1 recipe unlock/semaine)', () => {
    expect(WEEKLY_CAPS.cuisine_repas).toBe(1);
  });

  it('DAILY_CAPS.menage_quotidien === 1', () => {
    expect(DAILY_CAPS.menage_quotidien).toBe(1);
  });

  it('WEEKLY_CAPS.menage_quotidien === 5', () => {
    expect(WEEKLY_CAPS.menage_quotidien).toBe(5);
  });

  it('toutes les valeurs DAILY_CAPS sont des entiers >= 0', () => {
    for (const [, val] of Object.entries(DAILY_CAPS)) {
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThanOrEqual(0);
    }
  });

  it('toutes les valeurs WEEKLY_CAPS sont des entiers > 0', () => {
    for (const [, val] of Object.entries(WEEKLY_CAPS)) {
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThan(0);
    }
  });
});
