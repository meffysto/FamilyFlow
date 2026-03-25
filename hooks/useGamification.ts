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
  }>;
  openLootBox: (profile: Profile, gamiData: GamificationData) => Promise<{
    box: LootBox;
    updatedProfile: Profile;
    newGamiData: GamificationData;
  }>;
  isProcessing: boolean;
}

const GAMI_FILE = 'gamification.md';
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
        // Read current gamification data
        const gamiContent = await vault.readFile(GAMI_FILE);
        const gamiData = parseGamification(gamiContent);

        // Update streak before awarding points (so streak bonus applies correctly)
        const currentStreak = calculateStreak(gamiData.history, profile.id);
        const profileWithStreak: Profile = { ...profile, streak: currentStreak + 1 };

        // Calculate new points (uses updated streak for bonus)
        const { profile: updatedProfile, entry, lootAwarded } = awardTaskCompletion(profileWithStreak, taskText);

        // Update data
        const newData = updateProfileInData(gamiData, updatedProfile, [entry]);

        // Write back to vault
        await vault.writeFile(GAMI_FILE, serializeGamification(newData));

        // Send task completed notification (fire-and-forget)
        dispatchNotificationAsync(
          'task_completed',
          buildTaskCompletedContext(updatedProfile, taskText, entry.points),
          notifPrefs
        );

        // Notify parent if needed
        if (onDataChange) {
          const familleContent = await vault.readFile(FAMILLE_FILE);
          const gamiUpdatedContent = serializeGamification(newData);
          const merged = mergeProfiles(familleContent, gamiUpdatedContent);
          onDataChange(merged);
        }

        return {
          updatedProfile,
          lootAwarded,
          pointsGained: entry.points,
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

        await vault.writeFile(GAMI_FILE, serializeGamification(newData));

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

        if (onDataChange) {
          const familleContent = await vault.readFile(FAMILLE_FILE);
          const merged = mergeProfiles(familleContent, serializeGamification(newData));
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
