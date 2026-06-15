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
  serializeCompanionHouse,
} from '../mascot/companion-house-engine';
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

  describe('parseCompanionHouse / serializeCompanionHouse', () => {
    it('renvoie null si aucun meuble', () => {
      expect(parseCompanionHouse(undefined)).toBeNull();
      expect(parseCompanionHouse('')).toBeNull();
    });

    it('roundtrip avec meubles', () => {
      const data = {
        placedFurniture: [
          { furnitureId: 'tapis', x: 0.15, y: 0.25, placedAt: '2026-06-15T10:00:00Z' },
        ],
      };
      const csv = serializeCompanionHouse(data);
      expect(parseCompanionHouse(csv)).toEqual(data);
    });
  });
});
