/**
 * Tests unitaires — companion-house-engine.ts
 *
 * Couvre la (dé)sérialisation du meublage de la maison du compagnon :
 * roundtrip CSV, clamp/validation des coords [0,1], duplicatas, ISO avec `:`.
 */

import {
  parsePlacedFurniture,
  serializePlacedFurniture,
  parseCompanionHouse,
  serializeCompanionHouseLines,
  canUnlockCompanionHouse,
  canBuyFurniture,
  placeFurniture,
  moveFurniture,
  removeFurniture,
} from '../mascot/companion-house-engine';
import { COMPANION_HOUSE_UNLOCK_COST } from '../mascot/companion-house-types';
import type { PlacedFurniture } from '../mascot/companion-house-types';

describe('companion-house-engine', () => {
  describe('parsePlacedFurniture', () => {
    it('renvoie [] pour vide/undefined', () => {
      expect(parsePlacedFurniture(undefined)).toEqual([]);
      expect(parsePlacedFurniture('')).toEqual([]);
      expect(parsePlacedFurniture('   ')).toEqual([]);
    });

    it('parse une entrée simple', () => {
      const r = parsePlacedFurniture('tapis:0.1500:0.2500:2026-06-15T10:00:00Z');
      expect(r).toHaveLength(1);
      expect(r[0]).toEqual({ furnitureId: 'tapis', x: 0.15, y: 0.25, placedAt: '2026-06-15T10:00:00Z' });
    });

    it('autorise les duplicatas (sink infini)', () => {
      const r = parsePlacedFurniture('plante:0.1:0.1:2026-06-15|plante:0.9:0.9:2026-06-15');
      expect(r).toHaveLength(2);
      expect(r[0].furnitureId).toBe('plante');
      expect(r[1].furnitureId).toBe('plante');
    });

    it('rejette les coords hors [0,1]', () => {
      expect(parsePlacedFurniture('tapis:-0.1:0.5:2026-06-15')).toEqual([]);
      expect(parsePlacedFurniture('tapis:0.5:1.5:2026-06-15')).toEqual([]);
    });

    it('rejette les entrées malformées (NaN, id manquant, trop courtes)', () => {
      expect(parsePlacedFurniture('tapis:abc:0.5:2026-06-15')).toEqual([]);
      expect(parsePlacedFurniture(':0.5:0.5:2026-06-15')).toEqual([]);
      expect(parsePlacedFurniture('tapis:0.5')).toEqual([]);
    });

    it('préserve un placedAt ISO contenant des `:`', () => {
      const r = parsePlacedFurniture('lampe:0.5:0.5:2026-06-15T14:30:45+02:00');
      expect(r[0].placedAt).toBe('2026-06-15T14:30:45+02:00');
    });

    it('ne garde que les entrées valides dans un lot mixte', () => {
      const r = parsePlacedFurniture('tapis:0.1:0.1:2026-06-15|BAD:9:9:x|coussin:0.8:0.8:2026-06-15');
      expect(r.map(f => f.furnitureId)).toEqual(['tapis', 'coussin']);
    });
  });

  describe('serializePlacedFurniture', () => {
    it('arrondit les coords à 4 décimales', () => {
      const items: PlacedFurniture[] = [{ furnitureId: 'tapis', x: 0.123456, y: 0.999999, placedAt: '2026-06-15' }];
      expect(serializePlacedFurniture(items)).toBe('tapis:0.1235:1.0000:2026-06-15');
    });

    it('clampe les coords hors bornes à la sérialisation', () => {
      const items: PlacedFurniture[] = [{ furnitureId: 'tapis', x: -2, y: 5, placedAt: '2026-06-15' }];
      expect(serializePlacedFurniture(items)).toBe('tapis:0.0000:1.0000:2026-06-15');
    });
  });

  describe('roundtrip', () => {
    it('parse(serialize(x)) === x (coords arrondies)', () => {
      const items: PlacedFurniture[] = [
        { furnitureId: 'tapis', x: 0.15, y: 0.25, placedAt: '2026-06-15T10:00:00Z' },
        { furnitureId: 'plante', x: 0.5, y: 0.5, placedAt: '2026-06-16T08:30:00Z' },
        { furnitureId: 'plante', x: 0.9, y: 0.1, placedAt: '2026-06-16T09:00:00Z' },
      ];
      expect(parsePlacedFurniture(serializePlacedFurniture(items))).toEqual(items);
    });
  });

  describe('parseCompanionHouse / serializeCompanionHouseLines', () => {
    it('renvoie null si ni débloquée ni meublée', () => {
      expect(parseCompanionHouse({})).toBeNull();
      expect(parseCompanionHouse({ unlocked: 'false', furniture: '' })).toBeNull();
    });

    it('débloquée mais vide → état présent, pièce vide', () => {
      const r = parseCompanionHouse({ unlocked: 'true', unlockedAt: '2026-06-16T09:00:00Z' });
      expect(r).toEqual({ unlocked: true, unlockedAt: '2026-06-16T09:00:00Z', placedFurniture: [] });
    });

    it('meublée sans flag unlock reste exploitable (unlocked=false)', () => {
      const r = parseCompanionHouse({ furniture: 'tapis:0.1:0.1:2026-06-15' });
      expect(r?.unlocked).toBe(false);
      expect(r?.placedFurniture).toHaveLength(1);
    });

    it('roundtrip lignes frontmatter', () => {
      const data = {
        unlocked: true,
        unlockedAt: '2026-06-16T09:00:00Z',
        placedFurniture: [{ furnitureId: 'tapis', x: 0.15, y: 0.25, placedAt: '2026-06-15T10:00:00Z' }],
      };
      const lines = serializeCompanionHouseLines(data);
      expect(lines).toEqual([
        'companion_house_unlocked: true',
        'companion_house_unlocked_at: 2026-06-16T09:00:00Z',
        'companion_house: tapis:0.1500:0.2500:2026-06-15T10:00:00Z',
      ]);
      // reparse depuis les valeurs des lignes
      const reparsed = parseCompanionHouse({
        unlocked: 'true',
        unlockedAt: '2026-06-16T09:00:00Z',
        furniture: 'tapis:0.1500:0.2500:2026-06-15T10:00:00Z',
      });
      expect(reparsed).toEqual(data);
    });
  });

  describe('helpers achat (façon marché)', () => {
    it('canUnlockCompanionHouse : solde, anti-rejeu', () => {
      expect(canUnlockCompanionHouse(COMPANION_HOUSE_UNLOCK_COST, false).ok).toBe(true);
      expect(canUnlockCompanionHouse(COMPANION_HOUSE_UNLOCK_COST - 1, false).ok).toBe(false);
      expect(canUnlockCompanionHouse(COMPANION_HOUSE_UNLOCK_COST, true).reason).toMatch(/déjà/);
    });

    it('canBuyFurniture : solde + meuble inconnu', () => {
      expect(canBuyFurniture('tapis', 40)).toEqual({ ok: true, cost: 40 });
      expect(canBuyFurniture('tapis', 39).ok).toBe(false);
      expect(canBuyFurniture('inconnu', 999).ok).toBe(false);
    });
  });

  describe('helpers placement (pur)', () => {
    const base: PlacedFurniture[] = [{ furnitureId: 'tapis', x: 0.2, y: 0.2, placedAt: '2026-06-15' }];

    it('placeFurniture ajoute + clampe', () => {
      const r = placeFurniture(base, 'plante', 1.5, -0.5, '2026-06-16');
      expect(r).toHaveLength(2);
      expect(r[1]).toEqual({ furnitureId: 'plante', x: 1, y: 0, placedAt: '2026-06-16' });
    });

    it('moveFurniture déplace par index + clampe, no-op si invalide', () => {
      expect(moveFurniture(base, 0, 0.9, 0.9)[0]).toMatchObject({ x: 0.9, y: 0.9 });
      expect(moveFurniture(base, 5, 0.1, 0.1)).toBe(base);
    });

    it('removeFurniture retire par index, no-op si invalide', () => {
      expect(removeFurniture(base, 0)).toHaveLength(0);
      expect(removeFurniture(base, 9)).toBe(base);
    });
  });
});
