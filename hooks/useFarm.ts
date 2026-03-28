/**
 * useFarm.ts — Hook pour la gestion de la ferme (planter, recolter)
 *
 * Lit/ecrit farm_crops dans famille.md via le vault.
 */

import { useCallback } from 'react';
import { useVault } from '../contexts/VaultContext';
import { plantCrop, harvestCrop, parseCrops, serializeCrops } from '../lib/mascot/farm-engine';
import { CROP_CATALOG } from '../lib/mascot/types';

const FAMILLE_FILE = 'famille.md';

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
    await refresh();
  }, [vault, refresh]);

  /** Planter une culture sur une parcelle */
  const plant = useCallback(async (profileId: string, plotIndex: number, cropId: string) => {
    const profile = profiles?.find(p => p.id === profileId);
    if (!profile) return;

    const cropDef = CROP_CATALOG.find(c => c.id === cropId);
    if (!cropDef) return;

    const currentCrops = parseCrops(profile.farmCrops ?? '');
    const newCrops = plantCrop(currentCrops, plotIndex, cropId);

    if (newCrops.length === currentCrops.length) return; // parcelle deja occupee

    await writeFarmCrops(profileId, serializeCrops(newCrops));
  }, [profiles, writeFarmCrops]);

  /** Recolter une culture mature */
  const harvest = useCallback(async (profileId: string, plotIndex: number) => {
    const profile = profiles?.find(p => p.id === profileId);
    if (!profile) return 0;

    const currentCrops = parseCrops(profile.farmCrops ?? '');
    const result = harvestCrop(currentCrops, plotIndex);

    if (result.reward === 0) return 0; // pas mature

    await writeFarmCrops(profileId, serializeCrops(result.crops));
    return result.reward;
  }, [profiles, writeFarmCrops]);

  return { plant, harvest };
}
