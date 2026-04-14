/**
 * Tests TDD — parseActiveExpeditions / serializeActiveExpeditions
 * Phase 33-01 — Couche data expeditions
 */

import {
  parseActiveExpeditions,
  serializeActiveExpeditions,
} from '../parser';
import type { ActiveExpedition } from '../types';

// ─── parseActiveExpeditions ──────────────────────────────────────────────────

describe('parseActiveExpeditions', () => {
  it('retourne [] si csv est undefined', () => {
    expect(parseActiveExpeditions(undefined)).toEqual([]);
  });

  it('retourne [] si csv est vide', () => {
    expect(parseActiveExpeditions('')).toEqual([]);
  });

  it('parse une expedition sans resultat', () => {
    const result = parseActiveExpeditions('foret_facile:easy:2026-04-14T10:30:00.000Z:4:');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      missionId: 'foret_facile',
      difficulty: 'easy',
      startedAt: '2026-04-14T10:30:00.000Z',
      durationHours: 4,
      result: undefined,
    });
  });

  it('parse une expedition avec resultat success', () => {
    const result = parseActiveExpeditions('foret_facile:easy:2026-04-14T10:30:00.000Z:4:success');
    expect(result).toHaveLength(1);
    expect(result[0].result).toBe('success');
  });

  it('parse deux expeditions séparées par |', () => {
    const result = parseActiveExpeditions(
      'a:easy:2026-04-14T10:30:00.000Z:4:|b:hard:2026-04-14T12:00:00.000Z:24:'
    );
    expect(result).toHaveLength(2);
    expect(result[0].missionId).toBe('a');
    expect(result[1].missionId).toBe('b');
    expect(result[1].difficulty).toBe('hard');
    expect(result[1].durationHours).toBe(24);
  });
});

// ─── serializeActiveExpeditions ─────────────────────────────────────────────

describe('serializeActiveExpeditions', () => {
  it('sérialise une expedition sans resultat', () => {
    const exp: ActiveExpedition = {
      missionId: 'foret_facile',
      difficulty: 'easy',
      startedAt: '2026-04-14T10:30:00.000Z',
      durationHours: 4,
    };
    expect(serializeActiveExpeditions([exp])).toBe(
      'foret_facile:easy:2026-04-14T10:30:00.000Z:4:'
    );
  });

  it('round-trip: serialize puis parse retourne les memes donnees', () => {
    const exps: ActiveExpedition[] = [
      {
        missionId: 'foret_facile',
        difficulty: 'easy',
        startedAt: '2026-04-14T10:30:00.000Z',
        durationHours: 4,
      },
      {
        missionId: 'montagne_moyen',
        difficulty: 'medium',
        startedAt: '2026-04-14T12:00:00.000Z',
        durationHours: 12,
        result: 'partial',
      },
    ];
    const csv = serializeActiveExpeditions(exps);
    const parsed = parseActiveExpeditions(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].missionId).toBe('foret_facile');
    expect(parsed[0].durationHours).toBe(4);
    expect(parsed[0].result).toBeUndefined();
    expect(parsed[1].missionId).toBe('montagne_moyen');
    expect(parsed[1].result).toBe('partial');
  });
});
