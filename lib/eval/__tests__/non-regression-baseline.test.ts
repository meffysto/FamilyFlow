/**
 * lib/eval/__tests__/non-regression-baseline.test.ts — Phase 52-04 (EVAL-04, EVAL-08)
 *
 * CI gate F1 (AI-SPEC §739) : verrouille la distribution du golden set.
 * Toute PR qui dégrade la rubric (faux négatifs / faux positifs) cassera ce test.
 *
 * Baseline 14/20 flagged ±1 — 6 clean ±1 — D5 tags TTS hard fail ≥ 16/20.
 */
import goldenSet from './fixtures/golden-set.json';
import { evaluateStoryDeterministic } from '../rubric';
import { setEvalEnabledOverride } from '../feature-flag';
import type { BedtimeStory, Profile } from '../../types';

type Fixture = {
  n: number;
  story: BedtimeStory;
  child: Profile;
  recentStories: BedtimeStory[];
  expected: { verdict: '🟢' | '🟡' | '🔴'; hardFail: boolean; rationale: string };
};

const fixtures = goldenSet as unknown as Fixture[];

beforeAll(() => setEvalEnabledOverride(true));
afterAll(() => setEvalEnabledOverride(null));

describe('Phase 52 — Non-régression baseline (F1 CI gate, EVAL-04)', () => {
  it('golden set contient exactement 20 fixtures (garde-fou tampering T-52-04-02)', () => {
    expect(fixtures.length).toBe(20);
  });

  it('distribution flagged ∈ [13, 15] (cible 14/20)', () => {
    let flagged = 0;
    for (const f of fixtures) {
      const r = evaluateStoryDeterministic(f.story, f.child, f.recentStories);
      if (r.hardFail || r.softWarnings.length > 0) flagged++;
    }
    expect(flagged).toBeGreaterThanOrEqual(13);
    expect(flagged).toBeLessThanOrEqual(15);
  });

  it('distribution clean ∈ [5, 7] (cible 6/20)', () => {
    let clean = 0;
    for (const f of fixtures) {
      const r = evaluateStoryDeterministic(f.story, f.child, f.recentStories);
      if (!r.hardFail && r.softWarnings.length === 0) clean++;
    }
    expect(clean).toBeGreaterThanOrEqual(5);
    expect(clean).toBeLessThanOrEqual(7);
  });

  it('aucun false positive — fixtures 🟢 ne doivent pas hardFail', () => {
    const greenFixtures = fixtures.filter((f) => f.expected.verdict === '🟢');
    expect(greenFixtures.length).toBeGreaterThanOrEqual(5);
    for (const f of greenFixtures) {
      const r = evaluateStoryDeterministic(f.story, f.child, f.recentStories);
      expect(r.hardFail).toBe(false);
    }
  });

  it('P1 tags TTS détectés sur ≥ 16 fixtures (baseline 18/20)', () => {
    let tagsHardFail = 0;
    for (const f of fixtures) {
      const r = evaluateStoryDeterministic(f.story, f.child, f.recentStories);
      const tagsDim = r.dimensions.find((d) => d.id === 'tags_tts');
      if (tagsDim?.score === 1) tagsHardFail++;
    }
    expect(tagsHardFail).toBeGreaterThanOrEqual(16);
  });
});

describe('Phase 52-04 — feature flag runtime override (EVAL-07)', () => {
  it('setEvalEnabledOverride(true) active le flag en runtime', () => {
    setEvalEnabledOverride(null);
    const { isEvalEnabled } = require('../feature-flag');
    expect(isEvalEnabled()).toBe(false); // baseline
    setEvalEnabledOverride(true);
    expect(isEvalEnabled()).toBe(true);
    setEvalEnabledOverride(null);
    expect(isEvalEnabled()).toBe(false);
  });

  it('setEvalEnabledOverride(false) force off même si défaut était true', () => {
    setEvalEnabledOverride(false);
    const { isEvalEnabled } = require('../feature-flag');
    expect(isEvalEnabled()).toBe(false);
    setEvalEnabledOverride(null);
  });
});
