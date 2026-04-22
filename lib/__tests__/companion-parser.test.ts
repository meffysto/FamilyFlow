import { parseCompanion, serializeCompanion } from '../parser';
import type { CompanionData } from '../mascot/companion-types';

describe('Phase 42 — parseCompanion / serializeCompanion', () => {
  describe('Backward compat v1/v2', () => {
    it('format v2 3-parts (pas Phase 42) → pas de lastFedAt/feedBuff', () => {
      const d = parseCompanion('chat:Mimi:chat|chien');
      expect(d).not.toBeNull();
      expect(d!.activeSpecies).toBe('chat');
      expect(d!.name).toBe('Mimi');
      expect(d!.unlockedSpecies).toEqual(['chat', 'chien']);
      expect(d!.lastFedAt).toBeUndefined();
      expect(d!.feedBuff).toBeUndefined();
    });

    it('format v1 4-parts legacy (mood) → ignoré, pas de Phase 42', () => {
      const d = parseCompanion('chat:Mimi:chat:joyeux');
      expect(d).not.toBeNull();
      expect(d!.lastFedAt).toBeUndefined();
      expect(d!.feedBuff).toBeUndefined();
    });

    it('format v2 minimal (2 parts) sans unlocked → unlockedSpecies fallback à activeSpecies', () => {
      const d = parseCompanion('chat:Mimi');
      expect(d).not.toBeNull();
      expect(d!.unlockedSpecies).toEqual(['chat']);
    });

    it('empty string / undefined → null', () => {
      expect(parseCompanion('')).toBeNull();
      expect(parseCompanion(undefined)).toBeNull();
      expect(parseCompanion('   ')).toBeNull();
    });

    it('serializeCompanion sans Phase 42 → format v2 inchangé', () => {
      const data: CompanionData = {
        activeSpecies: 'chat',
        name: 'Mimi',
        unlockedSpecies: ['chat', 'chien'],
      };
      expect(serializeCompanion(data)).toBe('chat:Mimi:chat|chien');
    });
  });

  describe('Round-trip v3', () => {
    it('lastFedAt seul (buff null)', () => {
      const data: CompanionData = {
        activeSpecies: 'renard',
        name: 'Foxie',
        unlockedSpecies: ['renard'],
        lastFedAt: '2026-04-22T10:00:00.000Z',
      };
      const s = serializeCompanion(data);
      const parsed = parseCompanion(s);
      expect(parsed).not.toBeNull();
      expect(parsed!.lastFedAt).toBe('2026-04-22T10:00:00.000Z');
      expect(parsed!.feedBuff).toBeUndefined();
    });

    it('lastFedAt + feedBuff complet round-trip', () => {
      const data: CompanionData = {
        activeSpecies: 'chat',
        name: 'Mimi',
        unlockedSpecies: ['chat'],
        lastFedAt: '2026-04-22T10:00:00.000Z',
        feedBuff: { multiplier: 1.495, expiresAt: '2026-04-22T11:30:00.000Z' },
      };
      const s = serializeCompanion(data);
      const parsed = parseCompanion(s);
      expect(parsed!.lastFedAt).toBe(data.lastFedAt);
      expect(parsed!.feedBuff!.multiplier).toBeCloseTo(1.495, 3);
      expect(parsed!.feedBuff!.expiresAt).toBe(data.feedBuff!.expiresAt);
    });

    it('unlockedSpecies multi + buff complet', () => {
      const data: CompanionData = {
        activeSpecies: 'herisson',
        name: 'Sonic',
        unlockedSpecies: ['chat', 'chien', 'lapin', 'renard', 'herisson'],
        lastFedAt: '2026-04-22T10:00:00.000Z',
        feedBuff: { multiplier: 1.15, expiresAt: '2026-04-22T11:30:00.000Z' },
      };
      const parsed = parseCompanion(serializeCompanion(data));
      expect(parsed!.unlockedSpecies).toEqual(data.unlockedSpecies);
      expect(parsed!.feedBuff!.multiplier).toBeCloseTo(1.15, 4);
    });
  });

  describe('Edge cases ISO', () => {
    it('ISO sans millisecondes round-trip', () => {
      const data: CompanionData = {
        activeSpecies: 'chien',
        name: 'Rex',
        unlockedSpecies: ['chien'],
        lastFedAt: '2026-04-22T10:00:00Z',
      };
      const s = serializeCompanion(data);
      const parsed = parseCompanion(s);
      expect(parsed!.lastFedAt).toBe('2026-04-22T10:00:00Z');
    });

    it('ISO timezone offset +02:00 round-trip', () => {
      const data: CompanionData = {
        activeSpecies: 'lapin',
        name: 'Hop',
        unlockedSpecies: ['lapin'],
        lastFedAt: '2026-04-22T10:00:00+02:00',
      };
      const s = serializeCompanion(data);
      const parsed = parseCompanion(s);
      expect(parsed!.lastFedAt).toBe('2026-04-22T10:00:00+02:00');
    });

    it('Multiplicateur 1.05 → toFixed(4) stable "1.0500"', () => {
      const data: CompanionData = {
        activeSpecies: 'chat',
        name: 'Mimi',
        unlockedSpecies: ['chat'],
        lastFedAt: '2026-04-22T10:00:00.000Z',
        feedBuff: { multiplier: 1.05, expiresAt: '2026-04-22T10:30:00.000Z' },
      };
      const s = serializeCompanion(data);
      expect(s).toContain('1.0500');
      const parsed = parseCompanion(s);
      expect(parsed!.feedBuff!.multiplier).toBeCloseTo(1.05, 4);
    });

    it('Multiplicateur 1.495 (préféré parfait) round-trip précis', () => {
      const data: CompanionData = {
        activeSpecies: 'renard',
        name: 'Foxie',
        unlockedSpecies: ['renard'],
        lastFedAt: '2026-04-22T10:00:00.000Z',
        feedBuff: { multiplier: 1.495, expiresAt: '2026-04-22T11:30:00.000Z' },
      };
      const s = serializeCompanion(data);
      expect(s).toContain('1.4950');
      const parsed = parseCompanion(s);
      expect(parsed!.feedBuff!.multiplier).toBeCloseTo(1.495, 4);
    });
  });

  describe('Corruption tolérée', () => {
    it('chaîne dégénérée ne crash pas', () => {
      expect(() => parseCompanion(':::::')).not.toThrow();
      expect(() => parseCompanion('chat::::::::::')).not.toThrow();
      expect(() => parseCompanion('chat:Mimi:chat:garbage:nope:here:also:bad')).not.toThrow();
    });

    it('lastFedAt ISO invalide dans v3 → ignoré sans crash', () => {
      // 8 parts mais lastFed invalide
      const d = parseCompanion('chat:Mimi:chat:not-a-date-at-all:::');
      expect(d).not.toBeNull();
      expect(d!.lastFedAt).toBeUndefined();
    });
  });
});
