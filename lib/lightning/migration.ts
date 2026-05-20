/**
 * Migration single-wallet → family Lightning (REQ-11, Pitfall #9).
 *
 * Au boot Phase 53 (caller = Plan 02 VaultProvider effect), on appelle
 * `migrateSingleToFamily()` une fois. La fonction est idempotente — on
 * peut l'appeler à chaque boot sans effet de bord.
 *
 * 3 cas (Pitfall #9 — check family FIRST pour ne JAMAIS écraser une
 * config family existante avec les données d'un single legacy) :
 *
 *   A. family présente :
 *      → on supprime juste la clé single (cleanup) et on retourne
 *        `family_exists`. La family est intouchée.
 *
 *   B. ni single ni family :
 *      → no-op, return `no_single`.
 *
 *   C. single présent SEUL :
 *      → on crée une family minimale héritant du single (baseUrl +
 *        invoiceKey en family.invoiceKey), avec adminKey vide (à compléter
 *        manuellement), members=[], triggerMode='instant',
 *        dailyCapPerMember=1000. On supprime ensuite le single. Return
 *        `migrated`.
 *
 * Plan 04 — Le module `./credentials.ts` a été supprimé (cleanup REQ-12).
 * La migration lit/écrit directement via `expo-secure-store` sur la clé
 * legacy `lightning_lnbits_config_v1`. Helpers `readSingleLegacy` et
 * `clearSingleLegacy` privés au fichier — pas d'export public.
 *
 * Threat T-53-01-06 : on garantit qu'un attaquant qui ré-injecterait
 * un single dans SecureStore ne peut PAS retirer les members d'une family
 * existante — le check family-first bloque ça.
 *
 * Errors silencieuses + logs `__DEV__` only.
 */

import * as SecureStore from 'expo-secure-store';
import { loadFamilyConfig, saveFamilyConfig } from './family-credentials';
import type { FamilyLightningConfig } from './types';

export type MigrationOutcome =
  | { migrated: true; reason: 'migrated' }
  | { migrated: false; reason: 'no_single' | 'family_exists' };

/** Clé SecureStore single-wallet legacy (Phase < 53). Conservée verbatim
 *  pour que les utilisateurs avec un single existant déclenchent la
 *  migration au prochain boot. Plan 04 — le fichier credentials.ts qui
 *  utilisait cette clé a été supprimé ; on lit/écrit ici en direct. */
const SINGLE_KEY = 'lightning_lnbits_config_v1';

interface SingleLegacyShape {
  baseUrl: string;
  invoiceKey: string;
}

async function readSingleLegacy(): Promise<SingleLegacyShape | null> {
  try {
    const raw = await SecureStore.getItemAsync(SINGLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SingleLegacyShape>;
    if (
      typeof parsed.baseUrl !== 'string' ||
      typeof parsed.invoiceKey !== 'string'
    ) {
      return null;
    }
    if (!parsed.baseUrl.trim() || !parsed.invoiceKey.trim()) {
      return null;
    }
    return { baseUrl: parsed.baseUrl, invoiceKey: parsed.invoiceKey };
  } catch (err) {
    if (__DEV__) console.warn('[lightning] readSingleLegacy failed:', err);
    return null;
  }
}

async function clearSingleLegacy(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SINGLE_KEY);
  } catch (err) {
    if (__DEV__) console.warn('[lightning] clearSingleLegacy failed:', err);
  }
}

export async function migrateSingleToFamily(): Promise<MigrationOutcome> {
  try {
    // Cas A : family existe déjà → cleanup single (idempotent) sans toucher family.
    const family = await loadFamilyConfig();
    if (family !== null) {
      await clearSingleLegacy();
      return { migrated: false, reason: 'family_exists' };
    }

    // Cas B : pas de family, pas de single → no-op.
    const single = await readSingleLegacy();
    if (single === null) {
      return { migrated: false, reason: 'no_single' };
    }

    // Cas C : single seul → créer family minimale puis supprimer single.
    const newFamily: FamilyLightningConfig = {
      baseUrl: single.baseUrl,
      family: {
        name: 'Famille',
        invoiceKey: single.invoiceKey,
        adminKey: '',
      },
      members: [],
      triggerMode: 'instant',
      dailyCapPerMember: 1000,
      hybridThresholdSats: 500,
    };
    await saveFamilyConfig(newFamily);
    await clearSingleLegacy();
    return { migrated: true, reason: 'migrated' };
  } catch (err) {
    if (__DEV__) console.warn('[lightning] migrateSingleToFamily failed:', err);
    // En cas d'échec, on retourne no_single (no-op safe) pour ne pas
    // bloquer le boot. La prochaine tentative au boot suivant ré-essayera.
    return { migrated: false, reason: 'no_single' };
  }
}
