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
import type { ContributionType } from '../lib/village';
import {
  parseGamification,
  serializeGamification,
  mergeProfiles,
} from '../lib/parser';
import { advanceFarmCrops, parseCrops, serializeCrops, type QuestFarmEffect } from '../lib/mascot/farm-engine';
import { parseFamilyQuestsMeta, getActiveQuestEffect, FAMILY_QUESTS_FILE } from '../lib/parser';
import { getTechBonuses } from '../lib/mascot/tech-engine';
import { getCompanionXpBonus } from '../lib/mascot/companion-engine';
import { parseFarmProfile, serializeFarmProfile } from '../lib/parser';
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
import {
  deriveTaskCategory,
  isSemanticCouplingEnabled,
  applyTaskEffect,
  loadCaps,
  saveCaps,
  isCapExceeded,
  incrementCap,
} from '../lib/semantic';
import type { EffectResult, CategoryMatch, CategoryId } from '../lib/semantic';
import { loadOverrides, isCategoryEnabled, incrementWeekStat } from '../lib/semantic/coupling-overrides';
import type { Task } from '../lib/types';
import { loadSagaProgress, saveSagaProgress } from '../lib/mascot/sagas-storage';
import type { SagaTrait } from '../lib/mascot/sagas-types';
import { EFFECT_TOASTS, CATEGORY_HAPTIC_FN } from '../lib/semantic/effect-toasts';
import { appendMuseumEntryToVault, extractMuseumSection } from '../lib/museum/engine';
import type { MuseumEntry } from '../lib/museum/engine';
import i18n from '../lib/i18n';
import * as SecureStore from 'expo-secure-store';

interface UseGamificationArgs {
  vault: VaultManager | null;
  notifPrefs: NotificationPreferences;
  onDataChange?: (profiles: Profile[]) => void;
  onQuestProgress?: (profileId: string, type: string, amount: number) => Promise<void>;
  onContribution?: (type: ContributionType, profileId: string) => Promise<void>;
}

interface UseGamificationResult {
  completeTask: (profile: Profile, taskText: string, taskMeta?: { tags?: string[]; section?: string; sourceFile?: string }) => Promise<{
    updatedProfile: Profile;
    lootAwarded: boolean;
    pointsGained: number;
    cropsMatured: string[];  // IDs des cultures pretes a recolter
    effectResult?: EffectResult | null;  // Phase 20 — resultat de l'effet semantique
    effectCategoryId?: CategoryId | null;  // Phase 21 — pour HarvestBurst variant
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

/** Helper : retourne le chemin du fichier ferme per-profil */
function farmFile(profileId: string): string {
  return `farm-${profileId}.md`;
}

export function useGamification({ vault, notifPrefs, onDataChange, onQuestProgress, onContribution }: UseGamificationArgs): UseGamificationResult {
  const [isProcessing, setIsProcessing] = useState(false);

  // Charger la config gamification au montage (remplit le cache synchrone)
  useEffect(() => { loadGamiConfig(); }, []);

  const completeTask = useCallback(
    async (profile: Profile, taskText: string, taskMeta?: { tags?: string[]; section?: string; sourceFile?: string }) => {
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
        let profileWithCompanionBonus: Profile = companionBonus !== 1.0
          ? { ...profileWithStreak, points: Math.round(profileWithStreak.points) }
          : profileWithStreak;

        // Phase 20 : Multiplier urgent x2 pour 5 taches (SEMANTIC-08)
        if (taskMeta?.tags?.includes('urgent') && profileWithCompanionBonus.multiplierRemaining === 0) {
          profileWithCompanionBonus = {
            ...profileWithCompanionBonus,
            multiplier: 2,
            multiplierRemaining: 5,
          };
        }

        const { profile: updatedProfileRaw, entry: entryRaw, lootAwarded } = awardTaskCompletion(profileWithCompanionBonus, taskText);
        // Appliquer le bonus compagnon sur les points gagnés (delta)
        const basePointsGained = updatedProfileRaw.points - profileWithCompanionBonus.points;
        const bonusPoints = companionBonus !== 1.0 ? Math.round(basePointsGained * companionBonus) - basePointsGained : 0;
        let updatedProfile: Profile = bonusPoints > 0
          ? { ...updatedProfileRaw, points: updatedProfileRaw.points + bonusPoints }
          : updatedProfileRaw;
        const entry = bonusPoints > 0
          ? { ...entryRaw, points: entryRaw.points + bonusPoints }
          : entryRaw;

        // Update data
        let newData = updateProfileInData(gamiData, updatedProfile, [entry]);

        // Phase 20 : Double Loot Cascade si streak > 7j (SEMANTIC-09)
        if ((currentStreak + 1) > 7 && lootAwarded) {
          try {
            const cascadeResult = doOpenLootBox(updatedProfile, newData);
            // Mettre a jour les donnees avec le second loot box
            newData = updateProfileInData(newData, cascadeResult.profile, cascadeResult.entries);
            if (cascadeResult.newActiveRewards.length > 0) {
              newData = {
                ...newData,
                activeRewards: [...(newData.activeRewards ?? []), ...cascadeResult.newActiveRewards],
              };
            }
            // Mettre a jour le profil pour refleter le second loot box
            const cascadeProfile = newData.profiles.find((p: Profile) => p.id === profile.id);
            if (cascadeProfile) {
              updatedProfile = cascadeProfile;
            }
          } catch {
            if (__DEV__) console.warn('Double Loot Cascade — non-critical');
          }
        }

        // Filtrer pour n'ecrire que les donnees de ce profil
        const singleData = {
          profiles: newData.profiles.filter((p: Profile) => p.id === profile.id),
          history: newData.history.filter((e: any) => e.profileId === profile.id),
          activeRewards: (newData.activeRewards ?? []).filter((r: any) => r.profileId === profile.id),
          usedLoots: (newData.usedLoots ?? []).filter((u: any) => u.profileId === profile.id),
        };

        // Write back to vault (fichier per-profil)
        // Phase 23 : Extraire la section ## Musée pour la préserver (MUSEUM-03)
        const museumSection = extractMuseumSection(gamiContent);
        await vault.writeFile(file, serializeGamification(singleData, museumSection));

        // Progression quêtes coopératives (tasks)
        if (onQuestProgress) {
          try { await onQuestProgress(profile.id, 'tasks', 1); } catch { /* Quest — non-critical */ }
        }

        // --- Bloc farm restructure (un seul write farm-{id}.md — Pitfall 2) ---
        let cropsMatured: string[] = [];
        let effectResult: EffectResult | null = null;
        let derivedCategory: CategoryMatch | null = null;

        const fp = farmFile(profile.id);
        const farmContent = await vault.readFile(fp).catch(() => '');
        let farmData = parseFarmProfile(farmContent);

        // 1. Avancer les cultures (existant)
        const currentCrops = parseCrops(farmData.farmCrops ?? '');
        if (currentCrops.length > 0) {
          const profileTechBonuses = getTechBonuses(profile.farmTech ?? []);
          // Phase 20 : Growth Sprint bonus temporel (EFFECTS-05)
          if (farmData.growthSprintUntil && new Date(farmData.growthSprintUntil) > new Date()) {
            profileTechBonuses.tasksPerStageReduction = (profileTechBonuses.tasksPerStageReduction ?? 0) + 1;
          }
          let questFarmEffect: QuestFarmEffect | undefined;
          try {
            const questsContent = await vault.readFile(FAMILY_QUESTS_FILE).catch(() => '');
            const questsMeta = parseFamilyQuestsMeta(questsContent);
            const activeEffect = getActiveQuestEffect(questsMeta);
            if (activeEffect?.type === 'rain_bonus' || activeEffect?.type === 'golden_rain') {
              questFarmEffect = activeEffect.type;
            }
          } catch { /* Quest — non-critical */ }
          const farmResult = advanceFarmCrops(currentCrops, profileTechBonuses, questFarmEffect, farmData.plotLevels);
          cropsMatured = farmResult.matured.map(c => c.cropId);
          farmData.farmCrops = serializeCrops(farmResult.crops);
        }

        // 2. Phase 20 : Appliquer l'effet semantique (SEMANTIC-06..10, EFFECTS-01..10)
        try {
          const enabled = await isSemanticCouplingEnabled();
          if (enabled && taskMeta) {
            const task: Pick<Task, 'text' | 'tags' | 'section' | 'sourceFile'> = {
              text: taskText,
              tags: taskMeta.tags ?? [],
              section: taskMeta.section,
              sourceFile: taskMeta.sourceFile ?? '',
            };
            const category = deriveTaskCategory(task as Task);
            derivedCategory = category;
            if (category) {
              const caps = await loadCaps(profile.id);
              // Phase 22 COUPLING-03 : check override per-categorie (D-02c)
              const overrides = await loadOverrides();
              if (!isCategoryEnabled(category.id, overrides)) {
                // Categorie desactivee par l'utilisateur → skip effet (D-02c)
              } else if (!isCapExceeded(category.id, caps)) {
                effectResult = applyTaskEffect(category, farmData);
                if (effectResult.effectApplied) {
                  farmData = effectResult.farmData;
                  await saveCaps(profile.id, incrementCap(caps, category.id));
                  // Phase 22 COUPLING-05 : incrementer stats semaine (D-04b)
                  try { await incrementWeekStat(category.id); } catch { /* stats — non-critical */ }

                  // EFFECTS-07 : Appliquer sagaTraitDelta a la saga active
                  if (effectResult.sagaTraitDelta) {
                    try {
                      const sagaProgress = await loadSagaProgress(profile.id);
                      if (sagaProgress && sagaProgress.status === 'active') {
                        const traitKey = effectResult.sagaTraitDelta.trait as SagaTrait;
                        if (traitKey in sagaProgress.traits) {
                          sagaProgress.traits[traitKey] += effectResult.sagaTraitDelta.amount;
                          await saveSagaProgress(sagaProgress);
                        }
                      }
                    } catch {
                      if (__DEV__) console.warn('Saga trait boost — non-critical');
                    }
                  }

                  // EFFECTS-04 : Propager companionEvent au companion data
                  // Phase 20 propage l'evenement (stocke dans companion data).
                  // Phase 21 rendra le feedback visuel (mood spike animation + message IA).
                  if (effectResult.companionEvent && farmData.companion) {
                    farmData.companion = {
                      ...farmData.companion,
                      lastEventType: effectResult.companionEvent,
                      lastEventAt: new Date().toISOString(),
                    };
                  }
                }
              }
            }
          }
        } catch {
          if (__DEV__) console.warn('Semantic coupling — non-critical error');
        }

        // Phase 21 : Feedback visuel + haptique (FEEDBACK-01, FEEDBACK-02)
        // Toast remplacé par RewardCardToast dans tasks.tsx — seul le haptic reste ici
        if (effectResult?.effectApplied && derivedCategory) {
          try {
            const catId = derivedCategory.id;
            // Haptic fire-and-forget (non-critical)
            try { CATEGORY_HAPTIC_FN[catId]?.(); } catch { /* haptic — non-critical */ }
            // Phase 21 FEEDBACK-04 : Bridge SecureStore pour subType compagnon (tree.tsx le lira)
            SecureStore.setItemAsync('last_semantic_category', catId).catch(() => {});
          } catch {
            if (__DEV__) console.warn('Effect feedback — non-critical');
          }
        }

        // Phase 23 : Musée des effets (MUSEUM-01, MUSEUM-03)
        if (effectResult?.effectApplied && derivedCategory) {
          try {
            const catId = derivedCategory.id;
            const toastDef = EFFECT_TOASTS[catId];
            if (toastDef) {
              const lang = i18n.language?.startsWith('en') ? 'en' : 'fr';
              const label = lang === 'en' ? toastDef.en : toastDef.fr;
              const museumEntry: MuseumEntry = {
                date: new Date(),
                categoryId: catId,
                icon: toastDef.icon,
                label,
              };
              appendMuseumEntryToVault(vault, profile.id, museumEntry).catch(() => {});
            }
          } catch { /* Musée — non-critical */ }
        }

        // Contribution village (COOP-02) -- fire-and-forget non-critical
        if (onContribution) {
          try { await onContribution('task', profile.id); } catch { /* Village -- non-critical */ }
        }

        // 3. Ecrire farm-{id}.md UNE SEULE FOIS (crops + effets combines)
        await vault.writeFile(fp, serializeFarmProfile(profile.name, farmData));

        // Send task completed notification (fire-and-forget)
        dispatchNotificationAsync(
          'task_completed',
          buildTaskCompletedContext(updatedProfile, taskText, entry.points),
          notifPrefs
        );

        // Notify parent if needed
        if (onDataChange) {
          const familleContent = await vault.readFile('famille.md').catch(() => '');
          const gamiUpdatedContent = serializeGamification(singleData);
          const merged = mergeProfiles(familleContent, gamiUpdatedContent);
          onDataChange(merged);
        }

        return {
          updatedProfile,
          lootAwarded,
          pointsGained: entry.points,
          cropsMatured,
          effectResult,  // Phase 20
          effectCategoryId: derivedCategory?.id ?? null,  // Phase 21 — pour HarvestBurst variant
        };
      } finally {
        setIsProcessing(false);
      }
    },
    [vault, notifPrefs, onDataChange, onQuestProgress, onContribution]
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
        // Phase 23 : Lire le contenu brut pour préserver la section ## Musée (MUSEUM-03)
        const gamiRawContent = await vault.readFile(file).catch(() => '');
        const lootMuseumSection = extractMuseumSection(gamiRawContent);
        const singleData = {
          profiles: newData.profiles.filter((p: Profile) => p.id === profile.id),
          history: newData.history.filter((e: any) => e.profileId === profile.id),
          activeRewards: (newData.activeRewards ?? []).filter((r: any) => r.profileId === profile.id),
          usedLoots: (newData.usedLoots ?? []).filter((u: any) => u.profileId === profile.id),
        };
        await vault.writeFile(file, serializeGamification(singleData, lootMuseumSection));

        // Persister les items mascotte droppés dans farm-{id}.md
        if (box.mascotItemId && (box.rewardType === 'mascot_deco' || box.rewardType === 'mascot_hab')) {
          try {
            const fp = farmFile(profile.id);
            const farmContent = await vault.readFile(fp).catch(() => '');
            const farmData = parseFarmProfile(farmContent);
            if (box.rewardType === 'mascot_deco') {
              farmData.mascotDecorations = updatedProfile.mascotDecorations;
            } else {
              farmData.mascotInhabitants = updatedProfile.mascotInhabitants;
            }
            await vault.writeFile(fp, serializeFarmProfile(profile.name, farmData));
          } catch {}
        }

        // Débloquer le compagnon droppé via lootbox
        if (box.mascotItemId && box.rewardType === 'companion') {
          try {
            const speciesId = box.mascotItemId as CompanionSpecies;
            const fp = farmFile(profile.id);
            const farmContent = await vault.readFile(fp).catch(() => '');
            const farmData = parseFarmProfile(farmContent);
            if (farmData.companion) {
              if (!farmData.companion.unlockedSpecies.includes(speciesId)) {
                farmData.companion = {
                  ...farmData.companion,
                  unlockedSpecies: [...farmData.companion.unlockedSpecies, speciesId],
                };
                await vault.writeFile(fp, serializeFarmProfile(profile.name, farmData));
              }
            }
          } catch {}
        }

        if (onDataChange) {
          const familleContent = await vault.readFile('famille.md').catch(() => '');
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
