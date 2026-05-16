/**
 * Feature flag Lightning
 *
 * Off par défaut. Activé localement via SecureStore quand l'utilisateur sauve
 * une config LNbits ET coche l'interrupteur dans Settings → Labo.
 *
 * Garanties :
 *   - Aucun appel réseau LN tant que `isLightningEnabled()` retourne false.
 *   - La ferme classique fonctionne 100% offline indépendamment de ce flag.
 *   - Build prod : laisser `BUILD_DEFAULT_ENABLED = false`. La feature reste
 *     accessible mais cachée derrière Settings → Labo (non promue dans l'UI
 *     principale tant que pas validée App Store — voir spike 003).
 */

import * as SecureStore from 'expo-secure-store';

const FLAG_KEY = 'lightning_enabled_v1';

/** Valeur par défaut au boot si l'utilisateur n'a jamais touché au flag. */
const BUILD_DEFAULT_ENABLED = false;

let cached: boolean | null = null;

export async function isLightningEnabled(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    const raw = await SecureStore.getItemAsync(FLAG_KEY);
    if (raw === null) {
      cached = BUILD_DEFAULT_ENABLED;
      return cached;
    }
    cached = raw === '1';
    return cached;
  } catch {
    cached = BUILD_DEFAULT_ENABLED;
    return cached;
  }
}

export async function setLightningEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(FLAG_KEY, enabled ? '1' : '0');
  cached = enabled;
}

/** Réinitialise le cache mémoire (utile après clear de creds). */
export function resetLightningFlagCache(): void {
  cached = null;
}
