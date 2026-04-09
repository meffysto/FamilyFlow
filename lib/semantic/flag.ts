// lib/semantic/flag.ts
// Feature flag family-wide du couplage sémantique (SEMANTIC-05 / ARCH-02).
// Décisions : D-05a (clé SecureStore globale), D-05b (pas par-profil),
// D-05c (helpers async), D-05d (vérifié par l'appelant, pas dans deriveTaskCategory).
//
// Default OFF : si la clé est absente, isSemanticCouplingEnabled() retourne false.
// Stockage string 'true'/'false' pour simplicité (cohérent ParentalControls).

import * as SecureStore from 'expo-secure-store';

/** Clé SecureStore globale (famille-wide, pas par-profil — D-05b). */
export const SEMANTIC_COUPLING_KEY = 'semantic-coupling-enabled';

/**
 * Retourne l'état actuel du flag. Default `false` si la clé est absente,
 * si la valeur lue est `'false'`, ou si la valeur est inattendue.
 * SEMANTIC-05 / ARCH-02 : garantit qu'un reset à `false` désactive
 * instantanément tout le couplage (Phase 20 appelle cette fonction à
 * chaque task completion).
 */
export async function isSemanticCouplingEnabled(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(SEMANTIC_COUPLING_KEY);
    return val === 'true';
  } catch {
    // SecureStore indisponible → fallback sûr : off (ARCH-03)
    return false;
  }
}

/**
 * Persiste l'état du flag. Écrit la chaîne 'true' ou 'false'.
 * Sera appelé par l'écran Réglages Couplage sémantique (Phase 22).
 */
export async function setSemanticCouplingEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(
    SEMANTIC_COUPLING_KEY,
    enabled ? 'true' : 'false',
  );
}
