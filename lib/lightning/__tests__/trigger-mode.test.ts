/**
 * Tests dispatchTrigger — REQ-3 (Phase 53).
 *
 * Couvre :
 *   - mode 'instant' → toujours 'instant'
 *   - mode 'daily-review' → toujours 'queue'
 *   - mode 'hybrid' :
 *     - cumul=0  + amount=100 → 'instant'
 *     - cumul=99 + amount=100 → 'instant' (seuil STRICT)
 *     - cumul=100 + amount=100 → 'queue'
 *     - cumul=500 + amount=100 → 'queue'
 */

import { dispatchTrigger, HYBRID_THRESHOLD_SATS } from '../trigger-mode';

describe('dispatchTrigger — mode instant', () => {
  it("retourne 'instant' quel que soit le cumul", () => {
    expect(dispatchTrigger(0, 'instant', 100)).toBe('instant');
    expect(dispatchTrigger(500, 'instant', 100)).toBe('instant');
    expect(dispatchTrigger(99999, 'instant', 1)).toBe('instant');
  });
});

describe('dispatchTrigger — mode daily-review', () => {
  it("retourne 'queue' quel que soit le cumul", () => {
    expect(dispatchTrigger(0, 'daily-review', 100)).toBe('queue');
    expect(dispatchTrigger(50, 'daily-review', 100)).toBe('queue');
    expect(dispatchTrigger(1000, 'daily-review', 100)).toBe('queue');
  });
});

describe('dispatchTrigger — mode hybrid (seuil 100 STRICT)', () => {
  it('cumul=0 + amount=100 → instant', () => {
    expect(dispatchTrigger(0, 'hybrid', 100)).toBe('instant');
  });

  it('cumul=99 + amount=100 → instant (seuil strict <)', () => {
    expect(dispatchTrigger(99, 'hybrid', 100)).toBe('instant');
  });

  it('cumul=100 + amount=100 → queue', () => {
    expect(dispatchTrigger(100, 'hybrid', 100)).toBe('queue');
  });

  it('cumul=500 + amount=100 → queue', () => {
    expect(dispatchTrigger(500, 'hybrid', 100)).toBe('queue');
  });

  it('cumul exactement à HYBRID_THRESHOLD_SATS = 100 → queue', () => {
    expect(HYBRID_THRESHOLD_SATS).toBe(100);
    expect(dispatchTrigger(HYBRID_THRESHOLD_SATS, 'hybrid', 100)).toBe('queue');
  });
});
