/**
 * Tests idempotence — REQ-6 (Phase 53).
 *
 * Couvre :
 *   - findPaidEntry retourne true pour un taskId+date payé
 *   - paid + undone même taskId+date → toujours true (undone n'efface pas paid)
 *   - même taskId, date différente → false
 *   - même date, taskId différent → false
 *   - paymentHash récupérable depuis l'entrée paid (Threat T-53-01-03 repudiation)
 */

import { findPaidEntry } from '../audit-log';
import type { AuditEntry } from '../audit-log';

function entry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    ts: '2026-05-18T08:00:00Z',
    profileId: 'lucas',
    taskId: 'T1',
    sats: 100,
    status: 'paid',
    ...overrides,
  };
}

describe('Idempotence — REQ-6', () => {
  it('1 paid → already_paid_today doit être détecté', () => {
    const audit: AuditEntry[] = [entry({ status: 'paid', paymentHash: 'hash-abc' })];
    expect(findPaidEntry(audit, 'T1', '2026-05-18')).toBe(true);
  });

  it('paid + undone même taskId+date → findPaidEntry reste true', () => {
    const audit: AuditEntry[] = [
      entry({ status: 'paid', ts: '2026-05-18T08:00:00Z' }),
      entry({ status: 'undone', ts: '2026-05-18T10:00:00Z' }),
    ];
    expect(findPaidEntry(audit, 'T1', '2026-05-18')).toBe(true);
  });

  it('queued / capped / failed seuls → already_paid_today = false (pas encore payé)', () => {
    const auditQueued: AuditEntry[] = [entry({ status: 'queued' })];
    expect(findPaidEntry(auditQueued, 'T1', '2026-05-18')).toBe(false);

    const auditCapped: AuditEntry[] = [entry({ status: 'capped' })];
    expect(findPaidEntry(auditCapped, 'T1', '2026-05-18')).toBe(false);

    const auditFailed: AuditEntry[] = [entry({ status: 'failed' })];
    expect(findPaidEntry(auditFailed, 'T1', '2026-05-18')).toBe(false);
  });

  it('paid de la veille → already_paid_today aujourd\'hui = false', () => {
    const audit: AuditEntry[] = [entry({ status: 'paid', ts: '2026-05-17T08:00:00Z' })];
    expect(findPaidEntry(audit, 'T1', '2026-05-18')).toBe(false);
  });

  it('paid d\'une autre tâche le même jour → false', () => {
    const audit: AuditEntry[] = [
      entry({ status: 'paid', taskId: 'T2' }),
    ];
    expect(findPaidEntry(audit, 'T1', '2026-05-18')).toBe(false);
  });

  it('paymentHash conservé dans l\'entrée paid (Threat T-53-01-03 non-répudiation)', () => {
    const audit: AuditEntry[] = [
      entry({ status: 'paid', paymentHash: 'a7b3c9d1' }),
    ];
    const found = audit.find((e) => e.status === 'paid' && e.taskId === 'T1');
    expect(found?.paymentHash).toBe('a7b3c9d1');
  });

  it('cas concret : compléter → décocher → re-cocher même jour → already_paid_today', () => {
    // Séquence chronologique SPEC #6 acceptance
    const audit: AuditEntry[] = [
      entry({ status: 'paid', ts: '2026-05-18T08:00:00Z', paymentHash: 'hash-1' }),
      entry({ status: 'undone', ts: '2026-05-18T09:00:00Z' }),
      // re-coche le même jour → caller doit voir already_paid_today, pas créer un 2ᵉ paid
    ];
    expect(findPaidEntry(audit, 'T1', '2026-05-18')).toBe(true);
    // Le caller (Plan 02) skip et écrit un audit entry { status: 'already_paid_today' }
    // mais ne PAS créer un 2ᵉ 'paid'.
  });
});
