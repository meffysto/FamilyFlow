// lib/mascot/companion-storage.ts
// Persistance des messages compagnon dans SecureStore (COMPANION-06 / Phase 24).
// Décisions : D-01 (fire-and-forget — non-bloquant), D-02 (garder les 5 derniers),
// D-03 (timestamp ISO pour chaque message), D-04 (hydratation au mount depuis SecureStore).
//
// Module pur — zéro import vault/hook. Pattern identique à caps.ts.
// Clé SecureStore : companion_messages_{profileId} (chaîne JSON).

import * as SecureStore from 'expo-secure-store';

// ---------------------------------------------------------------------------
// Types exportés
// ---------------------------------------------------------------------------

/** Un message compagnon persisté avec son contexte d'événement. */
export interface PersistedCompanionMessage {
  text: string;       // message affiché (traduit)
  event: string;      // CompanionEvent type (string pour flexibilité)
  timestamp: string;  // ISO datetime
}

// ---------------------------------------------------------------------------
// Clé SecureStore
// ---------------------------------------------------------------------------

const MESSAGES_KEY_PREFIX = 'companion_messages_';

// ---------------------------------------------------------------------------
// I/O SecureStore
// ---------------------------------------------------------------------------

/**
 * Charge les messages compagnon persistés pour un profil.
 * Retourne [] si aucun message n'a encore été enregistré ou si SecureStore
 * est indisponible.
 */
export async function loadCompanionMessages(profileId: string): Promise<PersistedCompanionMessage[]> {
  try {
    const raw = await SecureStore.getItemAsync(`${MESSAGES_KEY_PREFIX}${profileId}`);
    if (!raw) return [];
    return JSON.parse(raw) as PersistedCompanionMessage[];
  } catch {
    return [];
  }
}

/**
 * Persiste les messages compagnon d'un profil. Silencieux en cas d'erreur
 * (non-critical). D-02 : garder seulement les 5 derniers messages.
 */
export async function saveCompanionMessages(
  profileId: string,
  messages: PersistedCompanionMessage[],
): Promise<void> {
  try {
    const toSave = messages.slice(-5); // D-02 : garder les 5 derniers
    await SecureStore.setItemAsync(
      `${MESSAGES_KEY_PREFIX}${profileId}`,
      JSON.stringify(toSave),
    );
  } catch { /* non-critical */ }
}

// ---------------------------------------------------------------------------
// Nudge flag (D-10) — max 1 gentle_nudge par jour
// ---------------------------------------------------------------------------

const NUDGE_FLAG_KEY_PREFIX = 'companion_nudge_shown_';

/**
 * Vérifie si un gentle_nudge a déjà été affiché aujourd'hui pour ce profil.
 * Retourne false en cas d'erreur (fail-open — mieux afficher qu'ignorer).
 */
export async function hasNudgeShownToday(profileId: string): Promise<boolean> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const stored = await SecureStore.getItemAsync(`${NUDGE_FLAG_KEY_PREFIX}${profileId}`);
    return stored === today;
  } catch {
    return false;
  }
}

/**
 * Marque le gentle_nudge comme affiché aujourd'hui pour ce profil.
 * Fire-and-forget — silencieux en cas d'erreur (D-01).
 */
export async function markNudgeShownToday(profileId: string): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    await SecureStore.setItemAsync(`${NUDGE_FLAG_KEY_PREFIX}${profileId}`, today);
  } catch { /* non-critical */ }
}
