/**
 * Tests daily-cap — REQ-4 (Phase 53).
 *
 * Couvre :
 *   - getCumulSatsToday filtre par profileId + date locale today + status='paid'
 *   - checkDailyCap → 'allowed' si cumul + amount <= cap
 *   - checkDailyCap → 'capped' si cumul + amount > cap
 *   - 10× 100 sats paid → 11ᵉ pay-out 100 sats avec cap 1000 → 'capped'
 *   - status non-paid n'incrémente PAS le cumul
 *   - autres profils n'interfèrent pas
 *   - dates hors today n'interfèrent pas
 */

import { checkDailyCap, getCumulSatsToday } from '../daily-cap';
import type { AuditEntry } from '../audit-log';

function isoToday(now: Date, hour = 12): string {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function todayISO(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function entry(
  now: Date,
  overrides: Partial<AuditEntry> = {},
): AuditEntry {
  return {
    ts: isoToday(now, 12),
    profileId: 'lucas',
    taskId: 't',
    sats: 100,
    status: 'paid',
    ...overrides,
  };
}

describe('getCumulSatsToday', () => {
  it('cumul des sats `paid` aujourd\'hui pour un profil donné', () => {
    const now = new Date('2026-05-18T15:00:00');
    const audit: AuditEntry[] = [
      entry(now, { taskId: 't1', sats: 100 }),
      entry(now, { taskId: 't2', sats: 200 }),
      entry(now, { taskId: 't3', sats: 300 }),
    ];
    expect(getCumulSatsToday('lucas', audit, now)).toBe(600);
  });

  it('ignore les entrées d\'autres profils', () => {
    const now = new Date('2026-05-18T15:00:00');
    const audit: AuditEntry[] = [
      entry(now, { taskId: 't1', sats: 100, profileId: 'lucas' }),
      entry(now, { taskId: 't2', sats: 500, profileId: 'emma' }),
    ];
    expect(getCumulSatsToday('lucas', audit, now)).toBe(100);
    expect(getCumulSatsToday('emma', audit, now)).toBe(500);
  });

  it("ignore les entrées dont status n'est pas 'paid'", () => {
    const now = new Date('2026-05-18T15:00:00');
    const audit: AuditEntry[] = [
      entry(now, { taskId: 't1', sats: 100, status: 'paid' }),
      entry(now, { taskId: 't2', sats: 200, status: 'capped' }),
      entry(now, { taskId: 't3', sats: 300, status: 'queued' }),
      entry(now, { taskId: 't4', sats: 400, status: 'failed' }),
      entry(now, { taskId: 't5', sats: 500, status: 'undone' }),
    ];
    expect(getCumulSatsToday('lucas', audit, now)).toBe(100);
  });

  it("ignore les entrées d'autres dates", () => {
    const now = new Date('2026-05-18T15:00:00');
    const yesterday = new Date('2026-05-17T22:00:00');
    const audit: AuditEntry[] = [
      entry(now, { taskId: 't1', sats: 100 }),
      entry(yesterday, { taskId: 't2', sats: 999, ts: yesterday.toISOString() }),
    ];
    expect(getCumulSatsToday('lucas', audit, now)).toBe(100);
  });

  it('retourne 0 si audit vide', () => {
    expect(getCumulSatsToday('lucas', [], new Date())).toBe(0);
  });

  it('retourne 0 si profil sans entrée today', () => {
    const now = new Date('2026-05-18T15:00:00');
    const audit: AuditEntry[] = [entry(now, { profileId: 'emma' })];
    expect(getCumulSatsToday('lucas', audit, now)).toBe(0);
  });
});

describe('checkDailyCap — REQ-4', () => {
  const now = new Date('2026-05-18T15:00:00');

  it("retourne 'allowed' si cumul + amount <= cap", () => {
    const audit: AuditEntry[] = [entry(now, { sats: 100 })];
    expect(checkDailyCap('lucas', 100, audit, 1000, now)).toBe('allowed');
    expect(checkDailyCap('lucas', 900, audit, 1000, now)).toBe('allowed');
  });

  it("retourne 'capped' si cumul + amount > cap", () => {
    const audit: AuditEntry[] = [entry(now, { sats: 900 })];
    expect(checkDailyCap('lucas', 200, audit, 1000, now)).toBe('capped');
  });

  it('11ᵉ pay-out 100 sats avec 10×100 paid + cap 1000 → capped', () => {
    const audit: AuditEntry[] = Array.from({ length: 10 }, (_, i) =>
      entry(now, { taskId: `t${i}`, sats: 100 }),
    );
    expect(getCumulSatsToday('lucas', audit, now)).toBe(1000);
    expect(checkDailyCap('lucas', 100, audit, 1000, now)).toBe('capped');
  });

  it('amount exactement = cap-cumul → allowed (borne inclusive)', () => {
    const audit: AuditEntry[] = [entry(now, { sats: 800 })];
    expect(checkDailyCap('lucas', 200, audit, 1000, now)).toBe('allowed');
  });

  it('cap = 100 (min) : 1 pay-out 100 sats → allowed, le 2ᵉ → capped', () => {
    let audit: AuditEntry[] = [];
    expect(checkDailyCap('lucas', 100, audit, 100, now)).toBe('allowed');
    audit = [entry(now, { sats: 100 })];
    expect(checkDailyCap('lucas', 100, audit, 100, now)).toBe('capped');
  });

  it('uses today local date (slice 0,10 du ts) — confirme via todayISO match', () => {
    const audit: AuditEntry[] = [
      entry(now, { sats: 100, ts: `${todayISO(now)}T01:00:00Z` }),
    ];
    expect(getCumulSatsToday('lucas', audit, now)).toBe(100);
  });
});
