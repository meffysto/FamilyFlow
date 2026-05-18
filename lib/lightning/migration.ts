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
 * Le legacy `loadLnbitsConfig` / `clearLnbitsConfig` vit encore dans
 * `./credentials.ts` ; ce fichier sera supprimé en Plan 04. La migration
 * dépend de ces fonctions pendant la transition.
 *
 * Threat T-53-01-06 : on garantit qu'un attaquant qui ré-injecterait
 * un single dans SecureStore ne peut PAS retirer les members d'une family
 * existante — le check family-first bloque ça.
 *
 * Errors silencieuses + logs `__DEV__` only.
 */

import { clearLnbitsConfig, loadLnbitsConfig } from './credentials';
import {
  clearFamilyConfig as _clearFamilyConfig, // pas utilisé mais déclaré pour cohérence
  loadFamilyConfig,
  saveFamilyConfig,
} from './family-credentials';
import type { FamilyLightningConfig } from './types';

export type MigrationOutcome =
  | { migrated: true; reason: 'migrated' }
  | { migrated: false; reason: 'no_single' | 'family_exists' };

void _clearFamilyConfig; // référence pour ESLint — supprimable une fois Plan 04 livré

export async function migrateSingleToFamily(): Promise<MigrationOutcome> {
  try {
    // Cas A : family existe déjà → cleanup single (idempotent) sans toucher family.
    const family = await loadFamilyConfig();
    if (family !== null) {
      await clearLnbitsConfig();
      return { migrated: false, reason: 'family_exists' };
    }

    // Cas B : pas de family, pas de single → no-op.
    const single = await loadLnbitsConfig();
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
    };
    await saveFamilyConfig(newFamily);
    await clearLnbitsConfig();
    return { migrated: true, reason: 'migrated' };
  } catch (err) {
    if (__DEV__) console.warn('[lightning] migrateSingleToFamily failed:', err);
    // En cas d'échec, on retourne no_single (no-op safe) pour ne pas
    // bloquer le boot. La prochaine tentative au boot suivant ré-essayera.
    return { migrated: false, reason: 'no_single' };
  }
}
