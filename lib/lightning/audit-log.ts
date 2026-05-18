/**
 * Audit log Lightning — persistance AsyncStorage 90 jours glissants (REQ-7).
 *
 * Pitfall #1 RESOLVED — AsyncStorage retenu, PAS SecureStore :
 *   - 90 j × 4 membres × ~3 entrées/jour × ~150 octets ≈ 160 KB
 *   - Limite SecureStore iOS Keychain ≈ 2 KB par clé → explose
 *   - L'audit log n'est pas un secret : `paymentHash` est public sur la blockchain
 *     Lightning, on peut tout reconstruire via l'instance LNbits ou un block
 *     explorer. Pas besoin de chiffrement OS-level.
 *   - Garde la séparation : creds + queue + flag + parent-notif timestamp
 *     restent en SecureStore.
 *
 * Clé : `@lightning_audit_v1` (préfixe `@` convention AsyncStorage).
 *
 * Statuts d'entrée (couvre tous les flux SPEC) :
 *   - paid                : pay-out réussi
 *   - queued              : ajouté à la queue offline (REQ-5)
 *   - capped              : plafond quotidien atteint (REQ-4)
 *   - failed              : échec après 5 tentatives (REQ-5)
 *   - undone              : tâche dé-cochée après pay-out (REQ-6) — Plan 04
 *   - already_paid_today  : re-coche même taskId+date (REQ-6)
 *   - cash_out            : encaissement out vers wallet externe
 *   - attribution_failed  : aucun destinataire résolu (REQ-2 ambigu)
 *
 * Logs `__DEV__` only. JSON corrompu → return [] silencieusement.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUDIT_KEY = '@lightning_audit_v1';
export const RETENTION_DAYS = 90;

export type AuditStatus =
  | 'paid'
  | 'queued'
  | 'capped'
  | 'failed'
  | 'undone'
  | 'already_paid_today'
  | 'cash_out'
  | 'attribution_failed';

export interface AuditEntry {
  /** ISO timestamp en UTC */
  ts: string;
  profileId: string;
  taskId: string;
  sats: number;
  status: AuditStatus;
  /** Présent si paid / cash_out */
  paymentHash?: string;
  /** Présent si failed */
  error?: string;
}

const VALID_STATUSES: ReadonlySet<AuditStatus> = new Set<AuditStatus>([
  'paid',
  'queued',
  'capped',
  'failed',
  'undone',
  'already_paid_today',
  'cash_out',
  'attribution_failed',
]);

function isAuditEntry(value: unknown): value is AuditEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.ts === 'string' &&
    typeof v.profileId === 'string' &&
    typeof v.taskId === 'string' &&
    typeof v.sats === 'number' &&
    typeof v.status === 'string' &&
    VALID_STATUSES.has(v.status as AuditStatus)
  );
}

/**
 * Purge les entrées dont `ts` est > `days` jours en arrière (par rapport
 * à `Date.now()` au moment de l'appel). Idempotente.
 */
export function purgeOlderThan(entries: AuditEntry[], days: number): AuditEntry[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return entries.filter((e) => {
    const t = Date.parse(e.ts);
    if (Number.isNaN(t)) return false;
    return t >= cutoff;
  });
}

export async function loadAudit(): Promise<AuditEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(AUDIT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(isAuditEntry);
    return purgeOlderThan(valid, RETENTION_DAYS);
  } catch (err) {
    if (__DEV__) console.warn('[lightning] loadAudit failed:', err);
    return [];
  }
}

export async function appendAudit(entry: AuditEntry): Promise<void> {
  try {
    const current = await loadAudit();
    current.push(entry);
    await AsyncStorage.setItem(AUDIT_KEY, JSON.stringify(current));
  } catch (err) {
    if (__DEV__) console.warn('[lightning] appendAudit failed:', err);
  }
}

export async function clearAudit(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUDIT_KEY);
  } catch (err) {
    if (__DEV__) console.warn('[lightning] clearAudit failed:', err);
  }
}

/**
 * REQ-6 — vrai si une entrée `paid` existe pour ce taskId à la date
 * locale donnée (YYYY-MM-DD). Utilisé pour court-circuiter le pay-out
 * sur re-coche dans la même journée.
 *
 * Le statut `undone` n'efface PAS le `paid` correspondant (pas de rollback
 * SPEC #6). Donc une tâche paid puis undone puis re-cochée le même jour
 * doit toujours être considérée déjà payée.
 */
export function findPaidEntry(
  audit: AuditEntry[],
  taskId: string,
  dateISO: string,
): boolean {
  return audit.some(
    (e) => e.status === 'paid' && e.taskId === taskId && e.ts.slice(0, 10) === dateISO,
  );
}
