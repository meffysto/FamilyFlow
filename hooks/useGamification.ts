/**
 * useGamification.ts — Gamification state hook
 *
 * Wraps points, loot box opening, and streak logic.
 * Reads/writes gamification.md and famille.md in the vault.
 * Uses dispatchNotification for all Telegram messages.
 * Handles active rewards (vacation, crown, multiplier, etc.)
 */

import { useCallback, useEffect, useState } from 'react';
import { VaultManager } from '../lib/vault';
import {
  parseGamification,
  serializeGamification,
  mergeProfiles,
} from '../lib/parser';
import { advanceFarmCrops, parseCrops, serializeCrops } from '../lib/mascot/farm-engine';
import { getTechBonuses } from '../lib/mascot/tech-engine';
import { getCompanionXpBonus } from '../lib/mascot/companion-engine';
import { parseFamille, serializeCompanion } from '../lib/parser';
import type { CompanionSpecies } from '../lib/mascot/companion-types';
import {
  awardTaskCompletion,
  openLootBox as doOpenLootBox,
  updateProfileInData,
  applyFamilyBonus,
  calculateStreak,
  loadGamiConfig,
} from '../lib/gamification';
import {
  dispatchNotificationAsync,
  buildTaskCompletedContext,
  buildLootBoxContext,
} from '../lib/notifications';
import { Profile, LootBox, GamificationData, NotificationPreferences } from '../lib/types';

interface UseGamificationArgs {
  vault: VaultManager | null;
  notifPrefs: NotificationPreferences;
  onDataChange?: (profiles: Profile[]) => void;
}

interface UseGamificationResult {
  completeTask: (profile: Profile, taskText: string) => Promise<{
    updatedProfile: Profile;
    lootAwarded: boolean;
    pointsGained: number;
    cropsMatured: string[];  // IDs des cultures pretes a recolter
  }>;
  openLootBox: (profile: Profile, gamiData: GamificationData) => Promise<{
    box: LootBox;
    updatedProfile: Profile;
    newGamiData: GamificationData;
  }>;
  isProcessing: boolean;
}

/** Helper : retourne le chemin du fichier gamification per-profil */
function gamiFile(profileId: string): string {
  return `gami-${profileId}.md`;
}

const FAMILLE_FILE = 'famille.md';

export function useGamification({ vault, notifPrefs, onDataChange }: UseGamificationArgs): UseGamificationResult {
  const [isProcessing, setIsProcessing] = useState(false);

  // Charger la config gamification au montage (remplit le cache synchrone)
  useEffect(() => { loadGamiConfig(); }, []);

  const completeTask = useCallback(
    async (profile: Profile, taskText: string) => {
      if (!vault) throw new Error('Vault non initialisé');
      setIsProcessing(true);

      try {
        // Read current gamification data (fichier per-profil)
        const file = gamiFile(profile.id);
        const gamiContent = await vault.readFile(file).catch(() => '');
        const gamiData = parseGamification(gamiContent);

        // Update streak before awarding points (so streak bonus applies correctly)
        const currentStreak = calculateStreak(gamiData.history, profile.id);
        const profileWithStreak: Profile = { ...profile, streak: currentStreak + 1 };

        // Calculate new points (uses updated streak for bonus)
        // Bonus compagnon +5% XP (per D-09)
        const companionBonus = getCompanionXpBonus(profileWithStreak.companion);
        const profileWithCompanionBonus: Profile = companionBonus !== 1.0
          ? { ...profileWithStreak, points: Math.round(profileWithStreak.points) }
          : profileWithStreak;
        const { profile: updatedProfileRaw, entry: entryRaw, lootAwarded } = awardTaskCompletion(profileWithCompanionBonus, taskText);
        // Appliquer le bonus compagnon sur les points gagnés (delta)
        const basePointsGained = updatedProfileRaw.points - profileWithCompanionBonus.points;
        const bonusPoints = companionBonus !== 1.0 ? Math.round(basePointsGained * companionBonus) - basePointsGained : 0;
        const updatedProfile: Profile = bonusPoints > 0
          ? { ...updatedProfileRaw, points: updatedProfileRaw.points + bonusPoints }
          : updatedProfileRaw;
        const entry = bonusPoints > 0
          ? { ...entryRaw, points: entryRaw.points + bonusPoints }
          : entryRaw;

        // Update data
        const newData = updateProfileInData(gamiData, updatedProfile, [entry]);

        // Filtrer pour n'ecrire que les donnees de ce profil
        const singleData = {
          profiles: newData.profiles.filter((p: Profile) => p.id === profile.id),
          history: newData.history.filter((e: any) => e.profileId === profile.id),
          activeRewards: (newData.activeRewards ?? []).filter((r: any) => r.profileId === profile.id),
          usedLoots: (newData.usedLoots ?? []).filter((u: any) => u.profileId === profile.id),
        };

        // Write back to vault (fichier per-profil)
        await vault.writeFile(file, serializeGamification(singleData));

        // Avancer les cultures de la ferme (FIFO)
        let cropsMatured: string[] = [];
        const currentCrops = parseCrops(profile.farmCrops ?? '');
        if (currentCrops.length > 0) {
          const profileTechBonuses = getTechBonuses(profile.farmTech ?? []);
          const farmResult = advanceFarmCrops(currentCrops, profileTechBonuses);
          cropsMatured = farmResult.matured.map(c => c.cropId);
          // Persister les cultures mises a jour dans famille.md
          const updatedCropsCSV = serializeCrops(farmResult.crops);
          const familleContent = await vault.readFile(FAMILLE_FILE);
          const farmFieldKey = 'farm_crops';
          const lines = familleContent.split('\n');
          let inSection = false;
          let fieldLine = -1;
          let lastPropIdx = -1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('### ')) {
              if (inSection) break;
              if (lines[i].replace('### ', '').trim() === profile.id) inSection = true;
            } else if (inSection && lines[i].includes(': ')) {
              lastPropIdx = i;
              if (lines[i].trim().startsWith(`${farmFieldKey}:`)) fieldLine = i;
            }
          }
          const newValue = `${farmFieldKey}: ${updatedCropsCSV}`;
          if (fieldLine >= 0) {
            lines[fieldLine] = newValue;
          } else if (lastPropIdx >= 0) {
            lines.splice(lastPropIdx + 1, 0, newValue);
          }
          await vault.writeFile(FAMILLE_FILE, lines.join('\n'));
        }

        // Send task completed notification (fire-and-forget)
        dispatchNotificationAsync(
          'task_completed',
          buildTaskCompletedContext(updatedProfile, taskText, entry.points),
          notifPrefs
        );

        // Notify parent if needed
        if (onDataChange) {
          const familleContent = await vault.readFile(FAMILLE_FILE);
          const gamiUpdatedContent = serializeGamification(singleData);
          const merged = mergeProfiles(familleContent, gamiUpdatedContent);
          onDataChange(merged);
        }

        return {
          updatedProfile,
          lootAwarded,
          pointsGained: entry.points,
          cropsMatured,
        };
      } finally {
        setIsProcessing(false);
      }
    },
    [vault, notifPrefs, onDataChange]
  );

  const openLootBox = useCallback(
    async (profile: Profile, gamiData: GamificationData) => {
      if (!vault) throw new Error('Vault non initialisé');
      setIsProcessing(true);

      try {
        const {
          box,
          profile: updatedProfile,
          entries,
          newActiveRewards,
          extraLootBoxes,
        } = doOpenLootBox(profile, gamiData);

        let newData = updateProfileInData(gamiData, updatedProfile, entries);

        // Add new active rewards to data
        if (newActiveRewards.length > 0) {
          newData = {
            ...newData,
            activeRewards: [...(newData.activeRewards ?? []), ...newActiveRewards],
          };
        }

        // Handle family_bonus: add points to ALL profiles
        if (box.rewardType === 'family_bonus' && box.bonusPoints > 0) {
          const { data: withBonus } = applyFamilyBonus(newData, box.bonusPoints, profile.id);
          newData = withBonus;
        }

        // Ecrire uniquement les donnees du profil actif dans son fichier per-profil
        const file = gamiFile(profile.id);
        const singleData = {
          profiles: newData.profiles.filter((p: Profile) => p.id === profile.id),
          history: newData.history.filter((e: any) => e.profileId === profile.id),
          activeRewards: (newData.activeRewards ?? []).filter((r: any) => r.profileId === profile.id),
          usedLoots: (newData.usedLoots ?? []).filter((u: any) => u.profileId === profile.id),
        };
        await vault.writeFile(file, serializeGamification(singleData));

        // Persister les items mascotte droppés dans famille.md
        if (box.mascotItemId && (box.rewardType === 'mascot_deco' || box.rewardType === 'mascot_hab')) {
          try {
            const familleRaw = await vault.readFile(FAMILLE_FILE);
            const lines = familleRaw.split('\n');
            const fieldKey = box.rewardType === 'mascot_deco' ? 'mascot_decorations' : 'mascot_inhabitants';
            const list = box.rewardType === 'mascot_deco' ? updatedProfile.mascotDecorations : updatedProfile.mascotInhabitants;
            let inSection = false;
            let fieldLine = -1;
            let lastPropIdx = -1;

            for (let i = 0; i < lines.length; i++) {
              if (lines[i].startsWith('### ')) {
                if (inSection) break;
                if (lines[i].replace('### ', '').trim() === profile.id) inSection = true;
              } else if (inSection && lines[i].includes(': ')) {
                lastPropIdx = i;
                if (lines[i].trim().startsWith(`${fieldKey}:`)) fieldLine = i;
              }
            }

            const newValue = `${fieldKey}: ${list.join(',')}`;
            if (fieldLine >= 0) {
              lines[fieldLine] = newValue;
            } else if (lastPropIdx >= 0) {
              lines.splice(lastPropIdx + 1, 0, newValue);
            }
            await vault.writeFile(FAMILLE_FILE, lines.join('\n'));
          } catch {}
        }

        // Débloquer le compagnon droppé via lootbox
        if (box.mascotItemId && box.rewardType === 'companion') {
          try {
            const speciesId = box.mascotItemId as CompanionSpecies;
            const familleRaw = await vault.readFile(FAMILLE_FILE);
            const currentProfiles = parseFamille(familleRaw);
            const currentProfile = currentProfiles.find((p) => p.id === profile.id);
            if (currentProfile?.companion) {
              // Ajouter l'espèce à unlockedSpecies si pas encore débloquée
              if (!currentProfile.companion.unlockedSpecies.includes(speciesId)) {
                const updatedCompanion = {
                  ...currentProfile.companion,
                  unlockedSpecies: [...currentProfile.companion.unlockedSpecies, speciesId],
                };
                const lines = familleRaw.split('\n');
                let inSection = false;
                let fieldLine = -1;
                let lastPropIdx = -1;
                for (let i = 0; i < lines.length; i++) {
                  if (lines[i].startsWith('### ')) {
                    if (inSection) break;
                    if (lines[i].replace('### ', '').trim() === profile.id) inSection = true;
                  } else if (inSection && lines[i].includes(': ')) {
                    lastPropIdx = i;
                    if (lines[i].trim().startsWith('companion:')) fieldLine = i;
                  }
                }
                const newValue = `companion: ${serializeCompanion(updatedCompanion)}`;
                if (fieldLine >= 0) {
                  lines[fieldLine] = newValue;
                } else if (lastPropIdx >= 0) {
                  lines.splice(lastPropIdx + 1, 0, newValue);
                }
                await vault.writeFile(FAMILLE_FILE, lines.join('\n'));
              }
            }
          } catch {}
        }

        if (onDataChange) {
          const familleContent = await vault.readFile(FAMILLE_FILE);
          const merged = mergeProfiles(familleContent, serializeGamification(singleData));
          onDataChange(merged);
        }

        // Send loot box notification (fire-and-forget)
        dispatchNotificationAsync(
          'loot_box_opened',
          buildLootBoxContext(updatedProfile, box),
          notifPrefs
        );

        return { box, updatedProfile, newGamiData: newData };
      } finally {
        setIsProcessing(false);
      }
    },
    [vault, notifPrefs, onDataChange]
  );

  return { completeTask, openLootBox, isProcessing };
}
