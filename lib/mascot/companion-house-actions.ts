/**
 * companion-house-actions.ts — actions vault de la maison du compagnon.
 *
 * Fonctions autonomes (pas des hooks), façon `addVillageBonus` du village :
 * elles lisent/écrivent directement le vault. L'écran appelant rafraîchit ensuite
 * l'état (refreshGamification + reload profils).
 *
 * Monnaie 🍃 = profile.coins, persistée dans gami-{id}.md.
 * État maison (déblocage + meublage) persisté dans farm-{id}.md.
 *
 * Atomicité : on débite les coins (gami) PUIS on écrit la maison (farm).
 * Si l'écriture farm échoue, on rembourse les coins pour éviter une désync.
 */

import type { VaultManager } from '../vault';
import type { Profile } from '../types';
import {
  parseGamification,
  serializeGamification,
  parseFarmProfile,
  serializeFarmProfile,
} from '../parser';
import {
  canUnlockCompanionHouse,
  canBuyFurniture,
  placeFurniture,
} from './companion-house-engine';
import type { CompanionHouseData, PlacedFurniture } from './companion-house-types';

function gamiPath(id: string): string { return `gami-${id}.md`; }
function farmPath(id: string): string { return `farm-${id}.md`; }

/**
 * Débite (montant > 0) ou crédite (montant < 0 pour rembourser) les coins du profil
 * dans gami-{id}.md, avec une entrée d'historique. Renvoie le solde mis à jour.
 * Lève si le profil gami est introuvable.
 */
async function adjustCoins(
  vault: VaultManager,
  profile: Profile,
  delta: number,    // négatif = dépense
  note: string,
): Promise<number> {
  const path = gamiPath(profile.id);
  const raw = await vault.readFile(path).catch(() => '');
  const gami = parseGamification(raw);
  const match = (p: Profile) =>
    p.id === profile.id || p.name.toLowerCase().replace(/\s+/g, '') === profile.id.toLowerCase();
  const gamiProfile = gami.profiles.find(match);
  if (!gamiProfile) throw new Error('Profil gami introuvable');

  gamiProfile.coins = (gamiProfile.coins ?? gamiProfile.points) + delta;
  gami.history.push({
    profileId: profile.id,
    action: delta >= 0 ? `+${delta}` : `${delta}`,
    points: delta,
    note,
    timestamp: new Date().toISOString(),
  });

  const singleData = {
    profiles: gami.profiles.filter(match),
    history: gami.history.filter(e => e.profileId === profile.id),
    activeRewards: (gami.activeRewards ?? []).filter(r => r.profileId === profile.id),
    usedLoots: (gami.usedLoots ?? []).filter(u => u.profileId === profile.id),
  };
  await vault.writeFile(path, serializeGamification(singleData));
  return gamiProfile.coins ?? gamiProfile.points;
}

/** Lit l'état maison courant depuis farm-{id}.md (null si absent). */
async function readHouse(vault: VaultManager, profile: Profile): Promise<CompanionHouseData | null> {
  const raw = await vault.readFile(farmPath(profile.id)).catch(() => '');
  return parseFarmProfile(raw).companionHouse ?? null;
}

/** Écrit l'état maison dans farm-{id}.md (préserve tous les autres champs ferme). */
async function writeHouse(vault: VaultManager, profile: Profile, house: CompanionHouseData): Promise<void> {
  const raw = await vault.readFile(farmPath(profile.id)).catch(() => '');
  const farm = parseFarmProfile(raw);
  farm.companionHouse = house;
  await vault.writeFile(farmPath(profile.id), serializeFarmProfile(profile.name, farm));
}

/**
 * Débloque la maison (one-shot, 100 000 🍃). Lève si solde insuffisant ou déjà débloquée.
 * Renvoie le solde de coins mis à jour.
 */
export async function unlockCompanionHouse(vault: VaultManager, profile: Profile): Promise<number> {
  const current = await readHouse(vault, profile);
  const check = canUnlockCompanionHouse(profile.coins ?? profile.points, current?.unlocked ?? false);
  if (!check.ok) throw new Error(check.reason ?? 'Déblocage impossible');

  const newCoins = await adjustCoins(vault, profile, -check.cost, '🏡 Déblocage maison du compagnon');
  try {
    await writeHouse(vault, profile, {
      unlocked: true,
      unlockedAt: new Date().toISOString(),
      placedFurniture: current?.placedFurniture ?? [],
    });
  } catch (e) {
    await adjustCoins(vault, profile, check.cost, '↩️ Remboursement (échec déblocage maison)');
    throw e;
  }
  return newCoins;
}

/**
 * Achète un meuble et le pose (coords fractionnaires 0-1, défaut centre).
 * Lève si solde insuffisant, meuble inconnu, ou maison non débloquée.
 * Renvoie le solde de coins mis à jour.
 */
export async function buyAndPlaceFurniture(
  vault: VaultManager,
  profile: Profile,
  furnitureId: string,
  x: number = 0.5,
  y: number = 0.5,
): Promise<number> {
  const current = await readHouse(vault, profile);
  if (!current?.unlocked) throw new Error('Maison non débloquée');

  const check = canBuyFurniture(furnitureId, profile.coins ?? profile.points);
  if (!check.ok) throw new Error(check.reason ?? 'Achat impossible');

  const newCoins = await adjustCoins(vault, profile, -check.cost, `🪑 Achat meuble : ${furnitureId}`);
  try {
    const placed = placeFurniture(current.placedFurniture, furnitureId, x, y, new Date().toISOString());
    await writeHouse(vault, profile, { ...current, placedFurniture: placed });
  } catch (e) {
    await adjustCoins(vault, profile, check.cost, '↩️ Remboursement (échec placement meuble)');
    throw e;
  }
  return newCoins;
}

/**
 * Persiste un nouveau layout de meubles (après drag/déplacement/suppression).
 * Ne touche PAS aux coins. Maison supposée débloquée.
 */
export async function saveFurnitureLayout(
  vault: VaultManager,
  profile: Profile,
  placedFurniture: PlacedFurniture[],
): Promise<void> {
  const current = await readHouse(vault, profile);
  await writeHouse(vault, profile, {
    unlocked: current?.unlocked ?? true,
    unlockedAt: current?.unlockedAt,
    placedFurniture,
  });
}

/**
 * DEBUG (__DEV__ uniquement) — force le déblocage de la maison SANS débiter de
 * feuilles, pour tester le meublage/drag sans grinder 100k. À ne jamais exposer
 * en production.
 */
export async function debugForceUnlock(vault: VaultManager, profile: Profile): Promise<void> {
  const current = await readHouse(vault, profile);
  await writeHouse(vault, profile, {
    unlocked: true,
    unlockedAt: current?.unlockedAt ?? new Date().toISOString(),
    placedFurniture: current?.placedFurniture ?? [],
  });
}
