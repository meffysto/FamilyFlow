/**
 * quota-parser.test.ts — Round-trip loss-less + coercions défensives du parser quota.
 *
 * Garde-fou T-54-05 (Tampering) : parseQuota coerce les valeurs corrompues
 * (string → number, fallback DEFAULT_QUOTA pour fichier vide).
 */

import { parseQuota, serializeQuota, DEFAULT_QUOTA, QUOTA_FILE } from '../quota-parser';
import type { QuotaData } from '../types';

describe('round-trip parseQuota(serializeQuota(q))', () => {
  const cases: QuotaData[] = [
    {
      grandfather: true,
      grandfatherDetectedAt: '2026-06-24T08:00:00.000Z',
      storyCredits: 30,
      storyUsedThisMonth: 2,
      storyResetMonth: '2026-06',
    },
    { ...DEFAULT_QUOTA },
  ];

  it.each(cases)('est loss-less pour %o', (q) => {
    expect(parseQuota(serializeQuota(q))).toEqual(q);
  });
});

describe('parseQuota — défensif', () => {
  it('retourne DEFAULT_QUOTA pour un fichier vide', () => {
    expect(parseQuota('')).toEqual(DEFAULT_QUOTA);
  });

  it('coerce story_credits string "30" → number 30', () => {
    const content = [
      '---',
      'grandfather: false',
      'story_credits: "30"',
      'story_used_this_month: "1"',
      'story_reset_month: "2026-06"',
      '---',
      '',
    ].join('\n');
    const q = parseQuota(content);
    expect(q.storyCredits).toBe(30);
    expect(typeof q.storyCredits).toBe('number');
    expect(q.storyUsedThisMonth).toBe(1);
  });

  it('coerce grandfather "true" string → boolean true', () => {
    const content = ['---', 'grandfather: "true"', '---', ''].join('\n');
    expect(parseQuota(content).grandfather).toBe(true);
  });

  it('coerce grandfather true bool → boolean true', () => {
    const content = ['---', 'grandfather: true', '---', ''].join('\n');
    expect(parseQuota(content).grandfather).toBe(true);
  });
});

describe('serializeQuota', () => {
  it('produit un frontmatter avec les 5 clés + tags entitlements', () => {
    const out = serializeQuota(DEFAULT_QUOTA);
    expect(out.startsWith('---')).toBe(true);
    expect(out).toContain('grandfather:');
    expect(out).toContain('grandfather_detected_at:');
    expect(out).toContain('story_credits:');
    expect(out).toContain('story_used_this_month:');
    expect(out).toContain('story_reset_month:');
    expect(out).toContain('- entitlements');
    expect(out).toContain('ne pas modifier manuellement');
  });
});

describe('QUOTA_FILE', () => {
  it('pointe vers le dossier vault dédié', () => {
    expect(QUOTA_FILE).toBe('09 - Entitlements/quota.md');
  });
});
