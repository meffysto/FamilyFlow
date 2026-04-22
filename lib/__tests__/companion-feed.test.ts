import {
  getAffinity,
  getBuffForCrop,
  isBuffActive,
  getCooldownRemainingMs,
  COMPANION_PREFERENCES,
  type CompanionData,
} from '../mascot/companion-types';
import { feedCompanion, getActiveFeedBuff, getCompanionXpBonus, buildFeedMessage } from '../mascot/companion-engine';

// ────────────────────────────────────────────────
// Phase 42 — Suite Jest feedCompanion + helpers
// ────────────────────────────────────────────────

const baseCompanion = (): CompanionData => ({
  activeSpecies: 'renard',
  name: 'Foxie',
  unlockedSpecies: ['renard'],
});

describe('Phase 42 — getAffinity', () => {
  it('préféré matche', () => {
    const preferred = COMPANION_PREFERENCES.renard.preferred;
    expect(getAffinity('renard', preferred)).toBe('preferred');
  });
  it('détesté matche', () => {
    const hated = COMPANION_PREFERENCES.renard.hated;
    expect(getAffinity('renard', hated)).toBe('hated');
  });
  it('autres crops = neutre', () => {
    // Pour renard, préféré = beetroot, détesté = wheat
    expect(getAffinity('renard', 'potato')).toBe('neutral');
  });
});

describe('Phase 42 — getBuffForCrop', () => {
  it('perfect + preferred = mul ×1.495 durée 5400s', () => {
    const now = Date.now();
    const preferred = COMPANION_PREFERENCES.renard.preferred;
    const buff = getBuffForCrop('perfect', 'renard', preferred, now);
    expect(buff).not.toBeNull();
    expect(buff!.multiplier).toBeCloseTo(1.15 * 1.3, 3);
    const delta = new Date(buff!.expiresAt).getTime() - now;
    expect(delta).toBeGreaterThanOrEqual(5400 * 1000 - 5);
    expect(delta).toBeLessThanOrEqual(5400 * 1000 + 5);
  });
  it('ordinary + neutral = mul 1.05', () => {
    // Pour chat, strawberry est préféré ; wheat est neutre
    const buff = getBuffForCrop('ordinary', 'chat', 'wheat');
    expect(buff).not.toBeNull();
    expect(buff!.multiplier).toBeCloseTo(1.05, 3);
  });
  it('hated = null', () => {
    const hated = COMPANION_PREFERENCES.lapin.hated;
    expect(getBuffForCrop('good', 'lapin', hated)).toBeNull();
  });
});

describe('Phase 42 — isBuffActive', () => {
  it('expiresAt futur → true', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isBuffActive({ multiplier: 1.1, expiresAt: future })).toBe(true);
  });
  it('expiresAt passé → false', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isBuffActive({ multiplier: 1.1, expiresAt: past })).toBe(false);
  });
  it('null/undefined → false', () => {
    expect(isBuffActive(null)).toBe(false);
    expect(isBuffActive(undefined)).toBe(false);
  });
});

describe('Phase 42 — getCooldownRemainingMs', () => {
  it('lastFedAt undefined → 0', () => {
    expect(getCooldownRemainingMs(undefined)).toBe(0);
  });
  it('lastFedAt il y a 4h → 0', () => {
    const iso = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
    expect(getCooldownRemainingMs(iso)).toBe(0);
  });
  it('lastFedAt il y a 1h → ~2h restantes', () => {
    const iso = new Date(Date.now() - 1 * 3600 * 1000).toISOString();
    const remaining = getCooldownRemainingMs(iso);
    expect(remaining).toBeGreaterThan(1.95 * 3600 * 1000);
    expect(remaining).toBeLessThan(2.05 * 3600 * 1000);
  });
});

describe('Phase 42 — feedCompanion', () => {
  it('jamais nourri + preferred perfect → applied, buff set', () => {
    const comp = baseCompanion();
    const preferred = COMPANION_PREFERENCES.renard.preferred;
    const result = feedCompanion(comp, preferred, 'perfect');
    expect(result.applied).toBe(true);
    expect(result.affinity).toBe('preferred');
    expect(result.updated.lastFedAt).toBeDefined();
    expect(result.updated.feedBuff).not.toBeNull();
    expect(result.newBuff!.multiplier).toBeCloseTo(1.15 * 1.3, 3);
    // Immutabilité — l'argument d'origine n'est pas muté
    expect(comp.lastFedAt).toBeUndefined();
    expect(comp.feedBuff).toBeUndefined();
  });

  it('cooldown actif → applied=false, pas de mutation', () => {
    const recent = new Date(Date.now() - 1 * 3600 * 1000).toISOString();
    const comp: CompanionData = { ...baseCompanion(), lastFedAt: recent };
    const result = feedCompanion(comp, 'potato', 'good');
    expect(result.applied).toBe(false);
    expect(result.cooldownMs).toBeGreaterThan(0);
    expect(result.newBuff).toBeNull();
    expect(result.updated.lastFedAt).toBe(recent);
  });

  it('hated → applied=true mais feedBuff null', () => {
    const hated = COMPANION_PREFERENCES.lapin.hated;
    const comp: CompanionData = {
      ...baseCompanion(),
      activeSpecies: 'lapin',
      unlockedSpecies: ['lapin'],
    };
    const result = feedCompanion(comp, hated, 'ordinary');
    expect(result.applied).toBe(true);
    expect(result.affinity).toBe('hated');
    expect(result.updated.feedBuff).toBeNull();
    expect(result.updated.lastFedAt).toBeDefined();
    expect(result.newBuff).toBeNull();
  });

  it('remplace un buff existant (D-09)', () => {
    const oldExp = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const oldFed = new Date(Date.now() - 4 * 3600 * 1000).toISOString(); // cooldown écoulé
    const comp: CompanionData = {
      ...baseCompanion(),
      lastFedAt: oldFed,
      feedBuff: { multiplier: 1.05, expiresAt: oldExp },
    };
    const preferred = COMPANION_PREFERENCES.renard.preferred;
    const result = feedCompanion(comp, preferred, 'perfect');
    expect(result.applied).toBe(true);
    expect(result.updated.feedBuff).not.toBeNull();
    expect(result.updated.feedBuff!.multiplier).toBeCloseTo(1.15 * 1.3, 3);
    // Ancien buff écrasé
    expect(result.updated.feedBuff!.expiresAt).not.toBe(oldExp);
  });

  it('ne mute pas l\'argument d\'origine (strict equality)', () => {
    const comp = baseCompanion();
    const snapshot = { ...comp };
    feedCompanion(comp, 'potato', 'good');
    expect(comp.lastFedAt).toBe(snapshot.lastFedAt);
    expect(comp.feedBuff).toBe(snapshot.feedBuff);
    expect(comp.activeSpecies).toBe(snapshot.activeSpecies);
  });
});

describe('Phase 42 — getActiveFeedBuff', () => {
  it('buff futur → retourné', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const comp: CompanionData = {
      ...baseCompanion(),
      feedBuff: { multiplier: 1.1, expiresAt: future },
    };
    expect(getActiveFeedBuff(comp)).not.toBeNull();
  });
  it('buff expiré → null (expiration lazy, pas d\'écriture)', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const comp: CompanionData = {
      ...baseCompanion(),
      feedBuff: { multiplier: 1.1, expiresAt: past },
    };
    expect(getActiveFeedBuff(comp)).toBeNull();
    // L'argument n'est pas modifié (lazy read-only)
    expect(comp.feedBuff).not.toBeNull();
  });
  it('compagnon null → null', () => {
    expect(getActiveFeedBuff(null)).toBeNull();
    expect(getActiveFeedBuff(undefined)).toBeNull();
  });
});

describe('Phase 42 — getCompanionXpBonus stacking', () => {
  it('null → 1.0', () => {
    expect(getCompanionXpBonus(null)).toBe(1.0);
  });
  it('undefined → 1.0', () => {
    expect(getCompanionXpBonus(undefined)).toBe(1.0);
  });
  it('pas de feedBuff → 1.05', () => {
    expect(getCompanionXpBonus(baseCompanion())).toBeCloseTo(1.05, 3);
  });
  it('feedBuff actif mul 1.15 → 1.05 × 1.15', () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const comp: CompanionData = {
      ...baseCompanion(),
      feedBuff: { multiplier: 1.15, expiresAt: future },
    };
    expect(getCompanionXpBonus(comp)).toBeCloseTo(1.05 * 1.15, 3);
  });
  it('feedBuff expiré → 1.05 (expiration lazy)', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const comp: CompanionData = {
      ...baseCompanion(),
      feedBuff: { multiplier: 1.15, expiresAt: past },
    };
    expect(getCompanionXpBonus(comp)).toBeCloseTo(1.05, 3);
  });
  it('stacking max (preferred + perfect) → 1.05 × 1.495', () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const comp: CompanionData = {
      ...baseCompanion(),
      feedBuff: { multiplier: 1.15 * 1.3, expiresAt: future },
    };
    expect(getCompanionXpBonus(comp)).toBeCloseTo(1.05 * 1.15 * 1.3, 3);
  });
});

describe('Phase 42 — buildFeedMessage', () => {
  it('preferred + perfect → mention parfaite + crop label', () => {
    const msg = buildFeedMessage({ affinity: 'preferred', grade: 'perfect', cropLabel: 'fraise', cropEmoji: '🍓' });
    expect(msg).toContain('parfaite');
    expect(msg).toContain('fraise');
  });
  it('hated → Berk', () => {
    const msg = buildFeedMessage({ affinity: 'hated', grade: 'good', cropLabel: 'maïs', cropEmoji: '🌽' });
    expect(msg).toContain('Berk');
  });
  it('neutral → merci sobre', () => {
    expect(buildFeedMessage({ affinity: 'neutral', grade: 'good', cropLabel: 'blé', cropEmoji: '🌾' }))
      .toContain('Merci');
  });
  it('preferred non-perfect → préférée', () => {
    expect(buildFeedMessage({ affinity: 'preferred', grade: 'good', cropLabel: 'betterave', cropEmoji: '🫜' }))
      .toContain('préférée');
  });
});
