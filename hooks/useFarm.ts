/**
 * useFarm.ts — Hook pour la gestion de la ferme (planter, recolter)
 *
 * Lit/ecrit farm_crops dans famille.md et deduit les feuilles dans gamification.md.
 */

import { useCallback } from 'react';
import { useVault } from '../contexts/VaultContext';
import { plantCrop, harvestCrop, parseCrops, serializeCrops } from '../lib/mascot/farm-engine';
import { CROP_CATALOG } from '../lib/mascot/types';
import { parseGamification, serializeGamification } from '../lib/parser';

const FAMILLE_FILE = 'famille.md';
const GAMI_FILE = 'gamification.md';

export function useFarm() {
  const { vault, profiles, refresh } = useVault();

  /** Ecrire farm_crops dans la section du profil */
  const writeFarmCrops = useCallback(async (profileId: string, cropsCSV: string) => {
    if (!vault) return;
    const content = await vault.readFile(FAMILLE_FILE);
    const lines = content.split('\n');
    let inSection = false;
    let fieldLine = -1;
    let lastPropIdx = -1;
    const fieldKey = 'farm_crops';

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('### ')) {
        if (inSection) break;
        if (lines[i].replace('### ', '').trim() === profileId) inSection = true;
      } else if (inSection && lines[i].includes(': ')) {
        lastPropIdx = i;
        if (lines[i].trim().startsWith(`${fieldKey}:`)) fieldLine = i;
      }
    }

    const newValue = `${fieldKey}: ${cropsCSV}`;
    if (fieldLine >= 0) {
      lines[fieldLine] = newValue;
    } else if (lastPropIdx >= 0) {
      lines.splice(lastPropIdx + 1, 0, newValue);
    }

    await vault.writeFile(FAMILLE_FILE, lines.join('\n'));
  }, [vault]);

  /** Deduire des feuilles dans gamification.md */
  const deductCoins = useCallback(async (profileId: string, amount: number, note: string) => {
    if (!vault || amount <= 0) return;
    const gamiContent = await vault.readFile(GAMI_FILE);
    const gami = parseGamification(gamiContent);
    const gamiProfile = gami.profiles.find(
      (p: any) => p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()
    );
    if (!gamiProfile) return;

    gamiProfile.coins = (gamiProfile.coins ?? gamiProfile.points) - amount;
    gami.history.push({
      profileId,
      action: `-${amount}`,
      points: -amount,
      note,
      timestamp: new Date().toISOString(),
    });

    await vault.writeFile(GAMI_FILE, serializeGamification(gami));
  }, [vault]);

  /** Ajouter des feuilles dans gamification.md */
  const addCoins = useCallback(async (profileId: string, amount: number, note: string) => {
    if (!vault || amount <= 0) return;
    const gamiContent = await vault.readFile(GAMI_FILE);
    const gami = parseGamification(gamiContent);
    const gamiProfile = gami.profiles.find(
      (p: any) => p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()
    );
    if (!gamiProfile) return;

    gamiProfile.coins = (gamiProfile.coins ?? gamiProfile.points) + amount;
    gami.history.push({
      profileId,
      action: `+${amount}`,
      points: amount,
      note,
      timestamp: new Date().toISOString(),
    });

    await vault.writeFile(GAMI_FILE, serializeGamification(gami));
  }, [vault]);

  /** Planter une culture sur une parcelle */
  const plant = useCallback(async (profileId: string, plotIndex: number, cropId: string) => {
    const profile = profiles?.find(p => p.id === profileId);
    if (!profile) return;

    const cropDef = CROP_CATALOG.find(c => c.id === cropId);
    if (!cropDef) return;

    // Verifier les feuilles
    const coins = profile.coins ?? 0;
    if (coins < cropDef.cost) throw new Error('Pas assez de feuilles');

    const currentCrops = parseCrops(profile.farmCrops ?? '');
    const newCrops = plantCrop(currentCrops, plotIndex, cropId);
    if (newCrops.length === currentCrops.length) return;

    // Ecrire les cultures + deduire les feuilles
    await writeFarmCrops(profileId, serializeCrops(newCrops));
    await deductCoins(profileId, cropDef.cost, `🌱 Graine : ${cropId}`);
    await refresh();
  }, [profiles, writeFarmCrops, deductCoins, refresh]);

  /** Recolter une culture mature */
  const harvest = useCallback(async (profileId: string, plotIndex: number) => {
    const profile = profiles?.find(p => p.id === profileId);
    if (!profile) return 0;

    const currentCrops = parseCrops(profile.farmCrops ?? '');
    const result = harvestCrop(currentCrops, plotIndex);
    if (result.reward === 0) return 0;

    // Supprimer la culture + ajouter les feuilles
    await writeFarmCrops(profileId, serializeCrops(result.crops));
    const crop = currentCrops.find(c => c.plotIndex === plotIndex);
    await addCoins(profileId, result.reward, `🌾 Recolte : ${crop?.cropId ?? '?'}`);
    await refresh();
    return result.reward;
  }, [profiles, writeFarmCrops, addCoins, refresh]);

  return { plant, harvest };
}
