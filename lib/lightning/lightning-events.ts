/**
 * Bus d'événements local Lightning (Phase 53 — Pattern 3 RESEARCH).
 *
 * Découple la logique pay-out (hook domaine) de la UI feedback (toast + pulse
 * sur le bouton HUD ferme + tout écran wallet). Le hook émet, la UI consomme.
 *
 * Module-level singleton — pas de hook React, pas de Context. C'est un Set
 * d'écouteurs partagé pour toute la session app. Inspiré du pattern Set<Listener>
 * de `hooks/useVaultTasks.ts:76-82` mais hissé au niveau module pour pouvoir
 * être consommé par tree.tsx sans passer par un provider.
 *
 * Erreurs des écouteurs : try/catch `__DEV__` only — un écouteur qui throw
 * ne doit jamais casser un pay-out.
 */

export type PayoutSuccessEvent = {
  profileId: string;
  profileName: string;
  sats: number;
  taskId: string;
};

export type PayoutFailedReason =
  | 'network'
  | 'capped'
  | 'attribution'
  | 'biometric'
  | 'lnbits_error';

export type PayoutFailedEvent = {
  profileId: string;
  taskId: string;
  reason: PayoutFailedReason;
  message?: string;
};

type SuccessListener = (event: PayoutSuccessEvent) => void;
type FailedListener = (event: PayoutFailedEvent) => void;

const successListeners: Set<SuccessListener> = new Set();
const failedListeners: Set<FailedListener> = new Set();

export function onPayoutSuccess(listener: SuccessListener): () => void {
  successListeners.add(listener);
  return () => {
    successListeners.delete(listener);
  };
}

export function emitPayoutSuccess(event: PayoutSuccessEvent): void {
  for (const l of Array.from(successListeners)) {
    try {
      l(event);
    } catch (e) {
      if (__DEV__) console.warn('[lightning] success listener error:', e);
    }
  }
}

export function onPayoutFailed(listener: FailedListener): () => void {
  failedListeners.add(listener);
  return () => {
    failedListeners.delete(listener);
  };
}

export function emitPayoutFailed(event: PayoutFailedEvent): void {
  for (const l of Array.from(failedListeners)) {
    try {
      l(event);
    } catch (e) {
      if (__DEV__) console.warn('[lightning] failed listener error:', e);
    }
  }
}
