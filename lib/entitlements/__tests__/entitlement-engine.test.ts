/**
 * entitlement-engine.test.ts — Tests de non-régression de la logique pure d'entitlements.
 *
 * Couvre la règle d'or IA (SC-7) : aucun chemin n'autorise une génération sans
 * slot/crédit/lifetime. Cap dur 3 histoires/mois (SC-4), reset mensuel,
 * priorité crédits Pack, no-decrement LIFETIME, détection grandfather.
 */

import {
  currentLocalMonth,
  shouldResetMonth,
  canGenerateStory,
  decrementQuota,
  detectGrandfatherEligibility,
  quotaExceededMessage,
} from '../entitlement-engine';
import type { QuotaData } from '../types';

const baseQuota = (overrides: Partial<QuotaData> = {}): QuotaData => ({
  grandfather: false,
  grandfatherDetectedAt: '',
  storyCredits: 0,
  storyUsedThisMonth: 0,
  storyResetMonth: currentLocalMonth(),
  ...overrides,
});

describe('currentLocalMonth', () => {
  it('retourne le mois local au format YYYY-MM', () => {
    expect(currentLocalMonth()).toMatch(/^\d{4}-\d{2}$/);
  });

  it('correspond au mois local de new Date() (PAS UTC)', () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    expect(currentLocalMonth()).toBe(expected);
  });
});

describe('shouldResetMonth', () => {
  it('true pour un mois passé figé', () => {
    expect(shouldResetMonth('2000-01')).toBe(true);
  });

  it('false pour le mois courant', () => {
    expect(shouldResetMonth(currentLocalMonth())).toBe(false);
  });

  it('true pour une chaîne vide (jamais initialisé)', () => {
    expect(shouldResetMonth('')).toBe(true);
  });
});

describe('canGenerateStory — LIFETIME', () => {
  it('autorise toujours, même à 3/3 et 0 crédit', () => {
    const q = baseQuota({ storyUsedThisMonth: 3, storyCredits: 0 });
    expect(canGenerateStory(q, true)).toBe(true);
  });
});

describe('canGenerateStory — free tier', () => {
  it('true tant que < 3 histoires utilisées ce mois', () => {
    expect(canGenerateStory(baseQuota({ storyUsedThisMonth: 0 }), false)).toBe(true);
    expect(canGenerateStory(baseQuota({ storyUsedThisMonth: 2 }), false)).toBe(true);
  });

  it('false quand 3/3 utilisées ET 0 crédit', () => {
    const q = baseQuota({ storyUsedThisMonth: 3, storyCredits: 0 });
    expect(canGenerateStory(q, false)).toBe(false);
  });

  it('true à 3/3 si crédits Pack disponibles', () => {
    const q = baseQuota({ storyUsedThisMonth: 3, storyCredits: 5 });
    expect(canGenerateStory(q, false)).toBe(true);
  });

  it('true après reset : mois stocké passé → usedThisMonth ignoré', () => {
    const q = baseQuota({ storyResetMonth: '2000-01', storyUsedThisMonth: 3, storyCredits: 0 });
    expect(canGenerateStory(q, false)).toBe(true);
  });
});

describe('decrementQuota — LIFETIME', () => {
  it('ne décompte jamais (D-06)', () => {
    const q = baseQuota({ storyUsedThisMonth: 1, storyCredits: 10 });
    expect(decrementQuota(q, true)).toEqual(q);
  });
});

describe('decrementQuota — free tier', () => {
  it('épuise les crédits Pack EN PRIORITÉ', () => {
    const q = baseQuota({ storyCredits: 5, storyUsedThisMonth: 0 });
    const next = decrementQuota(q, false);
    expect(next.storyCredits).toBe(4);
    expect(next.storyUsedThisMonth).toBe(0);
  });

  it('incrémente usedThisMonth quand 0 crédit', () => {
    const q = baseQuota({ storyCredits: 0, storyUsedThisMonth: 1 });
    const next = decrementQuota(q, false);
    expect(next.storyCredits).toBe(0);
    expect(next.storyUsedThisMonth).toBe(2);
  });

  it('applique le reset mensuel avant incrément (mois passé)', () => {
    const q = baseQuota({ storyResetMonth: '2000-01', storyUsedThisMonth: 3, storyCredits: 0 });
    const next = decrementQuota(q, false);
    expect(next.storyResetMonth).toBe(currentLocalMonth());
    expect(next.storyUsedThisMonth).toBe(1);
  });

  it('est immutable (ne mute pas l\'objet source)', () => {
    const q = baseQuota({ storyCredits: 5 });
    decrementQuota(q, false);
    expect(q.storyCredits).toBe(5);
  });
});

describe('detectGrandfatherEligibility', () => {
  it('true si au moins un domaine a des données', () => {
    expect(
      detectGrandfatherEligibility({ tasks: [1], meals: [], profiles: [], memories: [] }),
    ).toBe(true);
    expect(
      detectGrandfatherEligibility({ tasks: [], meals: [], profiles: [{}], memories: [] }),
    ).toBe(true);
  });

  it('false si tous les domaines sont vides', () => {
    expect(
      detectGrandfatherEligibility({ tasks: [], meals: [], profiles: [], memories: [] }),
    ).toBe(false);
  });
});

describe('quotaExceededMessage', () => {
  it('retourne un message FR non vide', () => {
    const msg = quotaExceededMessage();
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});
