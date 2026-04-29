/**
 * Phase 43 (Auberge) — Round-trip farm parser avec champs auberge_*.
 * Privacy : noms génériques (Lucas/Emma).
 *
 * Couvre :
 * - Backward compat : profil legacy sans champs auberge_* parse sans erreur.
 * - Round-trip lossless des 4 champs.
 * - Sérialisation conditionnelle : skip si vide / 0.
 */
import { parseFarmProfile, serializeFarmProfile } from '../parser';
import type { FarmProfileData } from '../types';

const baseData: FarmProfileData = {
  mascotDecorations: [],
  mascotInhabitants: [],
  mascotPlacements: {},
};

describe('Phase 43 — Persistance Auberge dans farm-{id}.md', () => {
  describe('Backward compat', () => {
    it('parse un profil legacy sans champs auberge_* sans erreur', () => {
      const md = '# Farm — Lucas\n\nfarm_crops: 0:carrot:2:1:2026-04-29:\n';
      const data = parseFarmProfile(md);
      expect(data.auberge_visitors).toBeUndefined();
      expect(data.auberge_reputations).toBeUndefined();
      expect(data.auberge_last_spawn).toBeUndefined();
      expect(data.auberge_total_deliveries).toBeUndefined();
    });
  });

  describe('Lecture individuelle', () => {
    it('parse auberge_visitors (chaîne opaque)', () => {
      const md = '# Farm — Lucas\n\nauberge_visitors: vis_1234_abcd:hugo_boulanger:active\n';
      expect(parseFarmProfile(md).auberge_visitors).toBe('vis_1234_abcd:hugo_boulanger:active');
    });

    it('parse auberge_reputations', () => {
      const md = '# Farm — Lucas\n\nauberge_reputations: hugo_boulanger:2:1:0\n';
      expect(parseFarmProfile(md).auberge_reputations).toBe('hugo_boulanger:2:1:0');
    });

    it('parse auberge_last_spawn (ISO datetime avec ":")', () => {
      const md = '# Farm — Lucas\n\nauberge_last_spawn: 2026-04-29T10:00:00.000Z\n';
      // Le parser de farm utilise indexOf(': ') donc tout après le 1er ': ' est conservé.
      expect(parseFarmProfile(md).auberge_last_spawn).toBe('2026-04-29T10:00:00.000Z');
    });

    it('parse auberge_total_deliveries: 7', () => {
      const md = '# Farm — Lucas\n\nauberge_total_deliveries: 7\n';
      expect(parseFarmProfile(md).auberge_total_deliveries).toBe(7);
    });
  });

  describe('Round-trip', () => {
    it('round-trip lossless des 4 champs auberge_*', () => {
      const original: FarmProfileData = {
        ...baseData,
        auberge_visitors: 'vis_1234_abcd:hugo_boulanger:active|vis_5678_efgh:meme_lucette:active',
        auberge_reputations: 'hugo_boulanger:2:1:0:2026-04-29T10:00:00Z|meme_lucette:0:0:0:2026-04-28T08:00:00Z',
        auberge_last_spawn: '2026-04-29T10:00:00.000Z',
        auberge_total_deliveries: 7,
      };
      const md = serializeFarmProfile('Lucas', original);
      const parsed = parseFarmProfile(md);
      expect(parsed.auberge_visitors).toBe(original.auberge_visitors);
      expect(parsed.auberge_reputations).toBe(original.auberge_reputations);
      expect(parsed.auberge_last_spawn).toBe(original.auberge_last_spawn);
      expect(parsed.auberge_total_deliveries).toBe(7);
    });
  });

  describe('Sérialisation conditionnelle', () => {
    it('skip auberge_total_deliveries si === 0', () => {
      const md = serializeFarmProfile('Lucas', { ...baseData, auberge_total_deliveries: 0 });
      expect(md).not.toContain('auberge_total_deliveries');
    });

    it('skip auberge_total_deliveries si undefined', () => {
      const md = serializeFarmProfile('Lucas', baseData);
      expect(md).not.toContain('auberge_total_deliveries');
    });

    it('skip auberge_visitors si chaîne vide', () => {
      const md = serializeFarmProfile('Lucas', { ...baseData, auberge_visitors: '' });
      expect(md).not.toContain('auberge_visitors:');
    });

    it('skip auberge_reputations si chaîne vide', () => {
      const md = serializeFarmProfile('Lucas', { ...baseData, auberge_reputations: '' });
      expect(md).not.toContain('auberge_reputations:');
    });

    it('skip auberge_last_spawn si undefined', () => {
      const md = serializeFarmProfile('Lucas', baseData);
      expect(md).not.toContain('auberge_last_spawn:');
    });

    it('écrit auberge_total_deliveries si > 0', () => {
      const md = serializeFarmProfile('Emma', { ...baseData, auberge_total_deliveries: 3 });
      expect(md).toContain('auberge_total_deliveries: 3');
    });
  });
});
