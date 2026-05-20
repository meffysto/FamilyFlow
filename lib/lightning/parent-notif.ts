/**
 * Notification parent agrégée — règles D-10 (Phase 53).
 *
 * Objectif : informer le parent UNE SEULE FOIS par jour des événements
 * pay-out (validés / plafonnés / en attente / échecs), sans saturer ni
 * déranger pendant les heures d'école.
 *
 * Règles D-10 verbatim :
 *   1. Silencieuse entre 09h00 et 16h00 locale (heures d'école).
 *   2. Cap 1 notif par jour (vault key SecureStore `lightning_last_parent_notif_v1`
 *      stocke la date `YYYY-MM-DD` du dernier envoi).
 *   3. Wording chaleureux/factuel — pas promotionnel, pas enfantin
 *      ("X pay-outs validés · plafond atteint pour Lucas · 2 en attente").
 *   4. Timestamp stocké en SecureStore (petite valeur, OK pour SecureStore).
 *
 * Le caller (Plan 02 — flushQueue success ou cap event ou batch end)
 * appelle `maybeSendParentNotif(summary)` à chaque fois qu'il pense
 * pouvoir notifier ; cette fonction décide silencieusement de jouer ou
 * pas selon les règles ci-dessus.
 *
 * Errors silencieuses + logs `__DEV__` only.
 */

import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

export const LAST_NOTIF_KEY = 'lightning_last_parent_notif_v1';
export const SCHOOL_HOURS_START = 9;
export const SCHOOL_HOURS_END = 16; // exclusif — à 16h on peut notifier à nouveau

export interface DailySummary {
  paidCount: number;
  cappedProfileNames: string[];
  failedCount: number;
  pendingCount: number;
}

export type NotifResult =
  | { sent: true }
  | { sent: false; reason: 'school_hours' | 'already_sent_today' | 'nothing_to_say' | 'error' };

function todayLocalISO(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Construit le body français factuel selon le contenu du summary.
 *
 * Segments :
 *   - "{N} pay-out{s} validé{s}" si paidCount > 0
 *   - "plafond atteint pour {noms}" si cappedProfileNames non vide
 *   - "{N} en attente" si pendingCount > 0
 *   - "{N} échec{s}" si failedCount > 0
 *
 * Joints par " · " (cohérence UI-SPEC D-10).
 * Retourne string vide si rien à dire (caller skip).
 */
export function buildBody(s: DailySummary): string {
  const segments: string[] = [];

  if (s.paidCount > 0) {
    const plural = s.paidCount > 1 ? 's' : '';
    segments.push(`${s.paidCount} pay-out${plural} validé${plural}`);
  }
  if (s.cappedProfileNames.length > 0) {
    segments.push(`plafond atteint pour ${s.cappedProfileNames.join(', ')}`);
  }
  if (s.pendingCount > 0) {
    segments.push(`${s.pendingCount} en attente`);
  }
  if (s.failedCount > 0) {
    const plural = s.failedCount > 1 ? 's' : '';
    segments.push(`${s.failedCount} échec${plural}`);
  }

  return segments.join(' · ');
}

/**
 * Décide si on notifie le parent. Retour :
 *   - `{ sent: true }` si la notif a bien été planifiée
 *   - `{ sent: false, reason: 'school_hours' }` si on est entre 9h et 16h
 *   - `{ sent: false, reason: 'already_sent_today' }` si déjà notifié today
 *   - `{ sent: false, reason: 'nothing_to_say' }` si summary vide
 *   - `{ sent: false, reason: 'error' }` sur catch
 */
export async function maybeSendParentNotif(
  summary: DailySummary,
  now: Date = new Date(),
): Promise<NotifResult> {
  try {
    const body = buildBody(summary);
    if (!body) return { sent: false, reason: 'nothing_to_say' };

    const hour = now.getHours();
    if (hour >= SCHOOL_HOURS_START && hour < SCHOOL_HOURS_END) {
      return { sent: false, reason: 'school_hours' };
    }

    const todayISO = todayLocalISO(now);
    const lastDate = await SecureStore.getItemAsync(LAST_NOTIF_KEY);
    if (lastDate === todayISO) {
      return { sent: false, reason: 'already_sent_today' };
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Lumière Lightning',
        body,
        sound: false,
      },
      trigger: null,
    });

    await SecureStore.setItemAsync(LAST_NOTIF_KEY, todayISO);
    return { sent: true };
  } catch (err) {
    if (__DEV__) console.warn('[lightning] maybeSendParentNotif failed:', err);
    return { sent: false, reason: 'error' };
  }
}

/**
 * Helper test/debug — réinitialise le timestamp pour autoriser une nouvelle
 * notif aujourd'hui. Pas exposé dans le barrel.
 */
export async function resetLastNotifTimestamp(): Promise<void> {
  await SecureStore.deleteItemAsync(LAST_NOTIF_KEY);
}
