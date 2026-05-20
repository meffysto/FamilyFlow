/**
 * Daily cap par membre — fonctions pures (REQ-4).
 *
 * Cumul des sats `paid` aujourd'hui (date LOCALE, pas UTC — un pay-out à
 * 23h55 puis 00h05 doit bien tomber dans deux jours différents) pour un
 * profil donné.
 *
 * Le check du cap est atomic AVANT tout appel réseau pay-out (SPEC
 * Constraint #6 — plafonnage par construction). Le caller (Plan 02) doit :
 *   1. loadAudit()
 *   2. checkDailyCap(profileId, sats, audit, cap) → 'allowed' | 'capped'
 *   3. si 'capped' → appendAudit({status:'capped'}) + skip
 *   4. si 'allowed' → procéder au pay-out
 *
 * Race condition Pitfall #3 : le Plan 02 ajoutera un lock global pour
 * sérialiser les pay-outs. Ici on n'expose que la fonction pure.
 */

import type { AuditEntry } from './audit-log';

/**
 * Retourne la date locale au format YYYY-MM-DD (timezone du device).
 * Pas UTC — voir STATE.md Phase 38 `getLocalDateKey`.
 */
function todayLocalISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Cumul des sats `paid` aujourd'hui pour un profil donné.
 *
 * Filtrage :
 *   - status === 'paid' (seuls les pay-outs effectifs comptent ;
 *     les `capped`, `queued`, `failed`, `undone` ne consomment pas le quota)
 *   - profileId match
 *   - date locale du `ts` (slice 0,10) === today local
 */
export function getCumulSatsToday(
  profileId: string,
  audit: AuditEntry[],
  now: Date = new Date(),
): number {
  const today = todayLocalISO(now);
  return audit
    .filter((e) => e.status === 'paid' && e.profileId === profileId && e.ts.slice(0, 10) === today)
    .reduce((sum, e) => sum + (Number.isFinite(e.sats) ? e.sats : 0), 0);
}

/**
 * Décision atomic : autoriser ou refuser un pay-out de `satsAmount` pour
 * un profil en fonction du cumul actuel et du plafond configuré.
 *
 * `(cumul + amount) <= cap` ⇒ 'allowed'
 * sinon ⇒ 'capped'
 */
export function checkDailyCap(
  profileId: string,
  satsAmount: number,
  audit: AuditEntry[],
  capPerMember: number,
  now: Date = new Date(),
): 'allowed' | 'capped' {
  const cumul = getCumulSatsToday(profileId, audit, now);
  return cumul + satsAmount <= capPerMember ? 'allowed' : 'capped';
}
