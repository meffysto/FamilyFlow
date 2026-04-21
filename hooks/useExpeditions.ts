/**
 * useExpeditions.ts — Hook d'orchestration des expéditions
 * Phase 33 — Système d'expéditions à risque
 *
 * Gère toutes les mutations vault pour les expéditions :
 * lancement, collecte du résultat, renvoi en liste active.
 * S'appuie sur expedition-engine.ts pour la logique pure.
 */

import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useVault } from '../contexts/VaultContext';
import { parseFarmProfile, serializeFarmProfile, parseGamification, serializeGamification } from '../lib/parser';
import {
  MAX_ACTIVE_EXPEDITIONS,
  EXPEDITION_CATALOG,
  PARTIAL_REFUND_RATIO,
  getDailyExpeditionPool,
  filterExpeditionsByTreeStage,
  canAffordExpedition,
  getExpeditionCostDescription,
  isExpeditionComplete,
  rollExpeditionResult,
  rollExpeditionLoot,
  type ExpeditionMission,
  type ExpeditionLoot,
} from '../lib/mascot/expedition-engine';
import { type TreeStage } from '../lib/mascot/types';
import type { ActiveExpedition } from '../lib/types';
import { rollSporeeDropOnExpedition, tryIncrementSporeeCount } from '../lib/mascot/sporee-economy';
import { useToast } from '../contexts/ToastContext';

// ─── Helpers chemin fichier ──────────────────────────────────────────────────

function farmFilePath(profileId: string): string {
  return `farm-${profileId}.md`;
}

function gamiFilePath(profileId: string): string {
  return `gami-${profileId}.md`;
}

// ─── Hook principal ──────────────────────────────────────────────────────────

export function useExpeditions(treeStage: TreeStage = 'graine') {
  const { vault, profiles, activeProfile, refreshFarm } = useVault();
  const { t } = useTranslation();
  const { showToast } = useToast();

  // Profil actif — utilise le profil actif sélectionné (sinon premier profil adulte)
  const currentProfile = useMemo(
    () => activeProfile ?? profiles.find(p => p.role === 'adulte') ?? profiles[0],
    [activeProfile, profiles]
  );

  // ─── Pool quotidien ────────────────────────────────────────────────────────

  const dailyPool: ExpeditionMission[] = useMemo(
    () => filterExpeditionsByTreeStage(getDailyExpeditionPool(), treeStage),
    // Pool filtré par stade d'arbre du profil courant
    [treeStage]
  );

  // ─── Données ferme en temps réel ──────────────────────────────────────────

  const farmData = useMemo(() => {
    if (!currentProfile) return null;
    // farmRaw n'existe pas directement dans VaultState — on lit depuis le profil courant
    return {
      activeExpeditions: (currentProfile as any).activeExpeditions as ActiveExpedition[] | undefined,
      expeditionPity: (currentProfile as any).expeditionPity as number | undefined,
      harvestInventory: currentProfile.harvestInventory ?? {},
      coins: currentProfile.coins ?? 0,
    };
  }, [currentProfile]);

  // ─── Dérivées ─────────────────────────────────────────────────────────────

  const activeExpeditions: ActiveExpedition[] = useMemo(
    () => farmData?.activeExpeditions ?? [],
    [farmData]
  );

  const completedExpeditions: ActiveExpedition[] = useMemo(
    () => activeExpeditions.filter(e => e.result !== undefined),
    [activeExpeditions]
  );

  const pendingResults: ActiveExpedition[] = useMemo(
    () => activeExpeditions.filter(e => isExpeditionComplete(e) && e.result === undefined),
    [activeExpeditions]
  );

  const activeCount: number = useMemo(
    () => activeExpeditions.filter(e => e.result === undefined).length,
    [activeExpeditions]
  );

  const canLaunch: boolean = activeCount < MAX_ACTIVE_EXPEDITIONS;

  const pityCount: number = farmData?.expeditionPity ?? 0;

  // ─── Déduire des feuilles (gami-{id}.md) ─────────────────────────────────

  const deductCoins = useCallback(async (profileId: string, amount: number): Promise<void> => {
    if (!vault || amount <= 0) return;
    const file = gamiFilePath(profileId);
    const content = await vault.readFile(file).catch(() => '');
    const gami = parseGamification(content);
    const gamiProfile = gami.profiles.find(
      (p: any) => p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()
    );
    if (!gamiProfile) return;

    gamiProfile.coins = (gamiProfile.coins ?? gamiProfile.points) - amount;
    const singleData = {
      profiles: [gamiProfile],
      history: [
        ...gami.history.filter((e: any) => e.profileId === profileId),
        {
          profileId,
          action: `-${amount}`,
          points: -amount,
          note: `🗺️ Expédition lancée (mise -${amount} 🍃)`,
          timestamp: new Date().toISOString(),
        },
      ],
      activeRewards: (gami.activeRewards ?? []).filter((r: any) => r.profileId === profileId),
      usedLoots: (gami.usedLoots ?? []).filter((u: any) => u.profileId === profileId),
    };

    await vault.writeFile(file, serializeGamification(singleData));
  }, [vault]);

  // ─── Créditer des feuilles (remboursement partiel) ───────────────────────

  const addCoins = useCallback(async (profileId: string, amount: number, note: string): Promise<void> => {
    if (!vault || amount <= 0) return;
    const file = gamiFilePath(profileId);
    const content = await vault.readFile(file).catch(() => '');
    const gami = parseGamification(content);
    const gamiProfile = gami.profiles.find(
      (p: any) => p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()
    );
    if (!gamiProfile) return;

    gamiProfile.coins = (gamiProfile.coins ?? gamiProfile.points) + amount;
    const singleData = {
      profiles: [gamiProfile],
      history: [
        ...gami.history.filter((e: any) => e.profileId === profileId),
        {
          profileId,
          action: `+${amount}`,
          points: amount,
          note,
          timestamp: new Date().toISOString(),
        },
      ],
      activeRewards: (gami.activeRewards ?? []).filter((r: any) => r.profileId === profileId),
      usedLoots: (gami.usedLoots ?? []).filter((u: any) => u.profileId === profileId),
    };

    await vault.writeFile(file, serializeGamification(singleData));
  }, [vault]);

  // ─── Lancer une expédition ────────────────────────────────────────────────

  const launchExpedition = useCallback(async (mission: ExpeditionMission): Promise<boolean> => {
    if (!vault || !currentProfile) return false;

    // Vérifier les ressources
    const coins = currentProfile.coins ?? 0;
    const harvestInventory = currentProfile.harvestInventory ?? {};
    if (!canAffordExpedition(mission, coins, harvestInventory)) {
      Alert.alert(
        'Ressources insuffisantes',
        "Tu n'as pas assez de feuilles ou de récoltes pour cette expédition."
      );
      return false;
    }

    // Vérifier le nombre max d'expéditions actives
    if (activeCount >= MAX_ACTIVE_EXPEDITIONS) {
      Alert.alert(
        'Expéditions complètes',
        "Tu as déjà 2 expéditions en cours. Attends le retour d'une mission."
      );
      return false;
    }

    // Confirmation déportée dans l'UI (modal Farm-styled côté ExpeditionsSheet).
    // Ici on exécute directement le launch — l'appelant est responsable d'avoir confirmé.
    try {
      await Haptics.impactAsync(ImpactFeedbackStyle.Medium);

      // Déduire les feuilles
      await deductCoins(currentProfile.id, mission.costCoins);

      // Lire la ferme, muter, réécrire
      const farmPath = farmFilePath(currentProfile.id);
      const farmContent = await vault.readFile(farmPath).catch(() => '');
      const farm = parseFarmProfile(farmContent);

      // Déduire les récoltes
      const harvest = { ...(farm.harvestInventory ?? {}) };
      for (const cost of mission.costCrops) {
        harvest[cost.cropId] = Math.max(0, (harvest[cost.cropId] ?? 0) - cost.quantity);
      }
      farm.harvestInventory = harvest;

      // Ajouter l'expédition active
      const newExp: ActiveExpedition = {
        missionId: mission.id,
        difficulty: mission.difficulty,
        startedAt: new Date().toISOString(),
        durationHours: mission.durationHours,
      };
      farm.activeExpeditions = [...(farm.activeExpeditions ?? []), newExp];

      const profileName = profiles.find(p => p.id === currentProfile.id)?.name ?? currentProfile.id;
      await vault.writeFile(farmPath, serializeFarmProfile(profileName, farm));
      await refreshFarm(currentProfile.id);

      return true;
    } catch {
      /* Expédition — non-critical */
      return false;
    }
  }, [vault, currentProfile, activeCount, profiles, deductCoins, refreshFarm]);

  // ─── Collecter le résultat d'une expédition ───────────────────────────────

  const collectExpedition = useCallback(async (
    missionId: string
  ): Promise<{
    outcome: ActiveExpedition['result'];
    loot?: ExpeditionLoot;
    sporeeFirstObtained?: boolean;
    refundedCoins?: number;
    refundedCrops?: { cropId: string; quantity: number }[];
  }> => {
    if (!vault || !currentProfile) return { outcome: undefined };

    const farmPath = farmFilePath(currentProfile.id);
    const farmContent = await vault.readFile(farmPath).catch(() => '');
    const farm = parseFarmProfile(farmContent);

    const expeditions = farm.activeExpeditions ?? [];
    const expIdx = expeditions.findIndex(
      e => e.missionId === missionId && isExpeditionComplete(e) && e.result === undefined
    );
    if (expIdx === -1) return { outcome: undefined };

    const exp = expeditions[expIdx];
    const currentPity = farm.expeditionPity ?? 0;

    // Roll du résultat
    const outcome = rollExpeditionResult(exp.difficulty, currentPity);

    // Mise à jour du compteur de pity
    if (outcome === 'success' || outcome === 'rare_discovery') {
      farm.expeditionPity = 0;
    } else {
      // failure et partial comptent comme échec
      farm.expeditionPity = currentPity + 1;
    }

    // Roll du loot
    const loot = rollExpeditionLoot(exp.difficulty, outcome);

    // Remboursement partiel (50 % de la mise coins + récoltes)
    let refundedCoins = 0;
    const refundedCrops: { cropId: string; quantity: number }[] = [];
    if (outcome === 'partial') {
      const mission = EXPEDITION_CATALOG.find(m => m.id === exp.missionId);
      if (mission) {
        refundedCoins = Math.floor(mission.costCoins * PARTIAL_REFUND_RATIO);
        const harvest = { ...(farm.harvestInventory ?? {}) };
        for (const cost of mission.costCrops) {
          const qty = Math.floor(cost.quantity * PARTIAL_REFUND_RATIO);
          if (qty > 0) {
            harvest[cost.cropId] = (harvest[cost.cropId] ?? 0) + qty;
            refundedCrops.push({ cropId: cost.cropId, quantity: qty });
          }
        }
        farm.harvestInventory = harvest;
      }
    }

    // Phase 38 (SPOR-08) — Drop Sporée post-expedition (5% sur Pousse+)
    // Indépendant de l'outcome : une mission ratée peut donner une Sporée (loot séparé).
    let sporeeRefused = false;
    let sporeeFirstObtained = false; // Phase 41 (SPOR-10) — signal tooltip one-shot
    if (rollSporeeDropOnExpedition(exp.difficulty)) {
      const currentSporee = farm.sporeeCount ?? 0;
      const inc = tryIncrementSporeeCount(currentSporee, 1);
      if (inc.accepted) {
        farm.sporeeCount = inc.newCount;
        sporeeFirstObtained = true;
      } else {
        sporeeRefused = true;
      }
    }

    // Distribuer le loot
    if (loot) {
      if (loot.type === 'inhabitant') {
        farm.mascotInhabitants = [...(farm.mascotInhabitants ?? []), loot.itemId];
      } else if (loot.type === 'seed') {
        const seeds = { ...(farm.farmRareSeeds ?? {}) };
        seeds[loot.itemId] = (seeds[loot.itemId] ?? 0) + 1;
        farm.farmRareSeeds = seeds;
      } else if (loot.type === 'booster') {
        const now = new Date();
        if (loot.itemId === 'boost_recolte_2x' || loot.itemId === 'boost_chance_doree') {
          // Boost croissance +12h
          const until = new Date(now.getTime() + 12 * 60 * 60 * 1000);
          farm.growthSprintUntil = until.toISOString();
        } else if (loot.itemId === 'boost_mega_recolte_3x') {
          // Boost croissance ×3 → +24h (version améliorée)
          const until = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          farm.growthSprintUntil = until.toISOString();
        } else if (loot.itemId === 'boost_production_2x') {
          // Boost bâtiments +24h
          const until = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          farm.buildingTurboUntil = until.toISOString();
        } else if (loot.itemId === 'boost_production_3x') {
          // Boost bâtiments ×3 → +48h (version améliorée)
          const until = new Date(now.getTime() + 48 * 60 * 60 * 1000);
          farm.buildingTurboUntil = until.toISOString();
        } else {
          // Booster générique → capacité +48h
          const until = new Date(now.getTime() + 48 * 60 * 60 * 1000);
          farm.capacityBoostUntil = until.toISOString();
        }
      }
    }

    // Mettre à jour l'expédition avec le résultat
    const updatedExp: ActiveExpedition = {
      ...exp,
      result: outcome,
      lootItemId: loot?.itemId,
      lootType: loot?.type,
    };
    farm.activeExpeditions = expeditions.map((e, i) => (i === expIdx ? updatedExp : e));

    const profileName = profiles.find(p => p.id === currentProfile.id)?.name ?? currentProfile.id;
    await vault.writeFile(farmPath, serializeFarmProfile(profileName, farm));

    if (refundedCoins > 0) {
      await addCoins(currentProfile.id, refundedCoins, `🗺️ Retour partiel (remboursement +${refundedCoins} 🍃)`);
    }

    await refreshFarm(currentProfile.id);

    if (sporeeRefused) {
      showToast('Inventaire Sporée plein', 'error');
    }

    return { outcome, loot, sporeeFirstObtained, refundedCoins, refundedCrops };
  }, [vault, currentProfile, profiles, addCoins, refreshFarm, showToast]);

  // ─── Renvoyer une expédition (dismiss après collecte) ─────────────────────

  const dismissExpedition = useCallback(async (missionId: string): Promise<void> => {
    if (!vault || !currentProfile) return;

    const farmPath = farmFilePath(currentProfile.id);
    const farmContent = await vault.readFile(farmPath).catch(() => '');
    const farm = parseFarmProfile(farmContent);

    farm.activeExpeditions = (farm.activeExpeditions ?? []).filter(
      e => e.missionId !== missionId
    );

    const profileName = profiles.find(p => p.id === currentProfile.id)?.name ?? currentProfile.id;
    await vault.writeFile(farmPath, serializeFarmProfile(profileName, farm));
    await refreshFarm(currentProfile.id);
  }, [vault, currentProfile, profiles, refreshFarm]);

  // ─── Retour du hook ───────────────────────────────────────────────────────

  const harvestInventory = useMemo(
    () => farmData?.harvestInventory ?? {},
    [farmData]
  );

  return {
    dailyPool,
    activeExpeditions,
    completedExpeditions,
    pendingResults,
    activeCount,
    canLaunch,
    pityCount,
    harvestInventory,
    launchExpedition,
    collectExpedition,
    dismissExpedition,
  };
}
