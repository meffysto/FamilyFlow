/**
 * useGarden.ts — Hook domaine Village / Jardin Familial (Phase 26, v1.4)
 *
 * Encapsule toute la logique village : parsing, génération de l'objectif
 * hebdomadaire, ajout de contributions, claim de récompense avec anti-double-claim.
 *
 * Pattern D-01 : consomme useVault() directement, sans créer de provider.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { startOfWeek, format } from 'date-fns';
import { useVault } from '../contexts/VaultContext';
import {
  parseGardenFile,
  serializeGardenFile,
  appendContributionToVault,
  appendBuilding,
  VILLAGE_FILE,
  computeWeekTarget,
  computeBuildingsToUnlock,
  OBJECTIVE_TEMPLATES,
  BUILDINGS_CATALOG,
  VILLAGE_RECIPES,
  canCraftVillageRecipe,
  canUnlockVillageTech,
  applyTechCost,
  applyRecipeCost,
  computeVillageTechBonuses,
  VILLAGE_TECH_TREE,
  encodeTrade,
  decodeTrade,
  isTradeExpired,
  isTradeAlreadyClaimed,
  canSendTradeToday,
  incrementTradesSent,
  tradesRemainingToday,
  MAX_TRADES_PER_DAY,
  getTradeItemMeta,
  type TradeCategory,
} from '../lib/village';
import { parseFarmProfile, serializeFarmProfile } from '../lib/parser';
import type {
  VillageData,
  VillageWeekRecord,
  ContributionType,
  ObjectiveTemplate,
  UnlockedBuilding,
  VillageInventory,
  BuildingProductionState,
  VillageAtelierCraft,
} from '../lib/village';
import type { VillageTechBonuses } from '../lib/village/atelier-engine';

// ---------------------------------------------------------------------------
// Fonctions utilitaires (hors hook)
// ---------------------------------------------------------------------------

/**
 * Retourne la date du lundi courant au format YYYY-MM-DD.
 * Utilise date-fns startOfWeek avec weekStartsOn:1 (lundi).
 */
function getMondayISO(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

/**
 * Sélectionne le template d'objectif par index rotatif déterministe.
 * Deux profils qui triggent en même temps obtiennent le même template — pas de corruption.
 */
function pickTemplate(weekIndex: number): ObjectiveTemplate {
  return OBJECTIVE_TEMPLATES[weekIndex % OBJECTIVE_TEMPLATES.length];
}

// ---------------------------------------------------------------------------
// useGarden
// ---------------------------------------------------------------------------

export interface UseGardenReturn {
  gardenData: VillageData;
  currentTarget: number;
  progress: number;
  isGoalReached: boolean;
  currentTemplate: ObjectiveTemplate;
  addContribution: (type: ContributionType, profileId: string) => Promise<void>;
  claimReward: (profileId: string) => Promise<boolean>;
  weekHistory: VillageWeekRecord[];
  isLoading: boolean;
  // Phase 30 — bâtiments persistants (VILL-04, VILL-05)
  familyLifetimeLeaves: number;
  unlockedBuildings: UnlockedBuilding[];
  // Phase 31+ — inventaire collectif + production par effort
  inventory: VillageInventory;
  productionState: BuildingProductionState;
  lifetimeContributions: number;
  getPendingItems: (buildingId: string) => number;
  collectBuildingProduction: (buildingId: string) => Promise<void>;
  // Atelier village
  atelierCrafts: VillageAtelierCraft[];
  atelierTechs: string[];
  villageTechBonuses: VillageTechBonuses;
  craftVillageItem: (recipeId: string, profileId: string) => Promise<boolean>;
  unlockVillageTech: (techId: string) => Promise<boolean>;
  // Q49 — Échange inter-familles via Port
  sendTrade: (category: TradeCategory, itemId: string, quantity: number, profileId: string) => Promise<string | null>;
  receiveTrade: (code: string, profileId: string) => Promise<{ success: boolean; itemLabel?: string; emoji?: string; quantity?: number; error?: string }>;
  canSendTradeToday: boolean;
  tradesSentRemaining: number;
}

/**
 * Hook domaine village complet.
 *
 * - Génère automatiquement l'objectif hebdomadaire au premier accès de la semaine.
 * - Archive la semaine précédente dans pastWeeks avant génération.
 * - Expose addContribution pour enregistrer les contributions (récoltes + tâches).
 * - Expose claimReward avec anti-double-claim via village_claimed_week dans gami-{id}.md.
 */
export function useGarden(): UseGardenReturn {
  // Consommation useVault (per D-01 — pas de nouveau provider)
  const { vault, gardenRaw, setGardenRaw, profiles } = useVault();

  // État local chargement
  const [isLoading, setIsLoading] = useState(false);

  // Q49 — État trade journalier (chargé au mount depuis le profil actif)
  const [tradeSentTodayField, setTradeSentTodayField] = useState<string | undefined>(undefined);

  // ---------------------------------------------------------------------------
  // Derived state via useMemo
  // ---------------------------------------------------------------------------

  /** Données village parsées depuis le contenu brut */
  const gardenData = useMemo(() => parseGardenFile(gardenRaw), [gardenRaw]);

  /** Nombre de profils actifs (hors grossesse — per Pitfall 6) */
  const activeProfileCount = useMemo(
    () => profiles.filter(p => p.statut !== 'grossesse').length,
    [profiles],
  );

  /**
   * Somme des profile.points sur tous les profils (feuilles lifetime famille).
   * Per D-05 CONTEXT.md. Monotone croissant — `points` est XP lifetime, jamais déduit.
   * `p.points ?? 0` pour profils grossesse / nouvellement créés (Pitfall 7).
   */
  const familyLifetimeLeaves = useMemo(
    () => profiles.reduce((sum, p) => sum + (p.points ?? 0), 0),
    [profiles],
  );

  /** Cible hebdomadaire — calculée dynamiquement selon le nombre de profils */
  const currentTarget = useMemo(
    () => computeWeekTarget(activeProfileCount),
    [activeProfileCount],
  );

  /** Nombre de contributions cette semaine */
  const progress = useMemo(
    () => gardenData.contributions?.length ?? 0,
    [gardenData],
  );

  /** Objectif atteint si progress >= currentTarget */
  const isGoalReached = useMemo(
    () => progress >= currentTarget,
    [progress, currentTarget],
  );

  /** Template actif pour la semaine courante */
  const currentTemplate = useMemo(() => {
    const found = OBJECTIVE_TEMPLATES[gardenData.currentThemeIndex];
    return found ?? pickTemplate(gardenData.pastWeeks?.length ?? 0);
  }, [gardenData]);

  /** Historique des semaines passées */
  const weekHistory = useMemo(
    () => gardenData.pastWeeks ?? [],
    [gardenData],
  );

  /** Bâtiments déjà débloqués (parsés depuis jardin-familial.md) — Phase 30 */
  const unlockedBuildings = useMemo<UnlockedBuilding[]>(
    () => gardenData.unlockedBuildings ?? [],
    [gardenData],
  );

  /** Inventaire collectif — Phase 31+ */
  const inventory = useMemo<VillageInventory>(
    () => gardenData.inventory ?? {},
    [gardenData],
  );

  /** État de production (contributions consommées par bâtiment) — Phase 31+ */
  const productionState = useMemo<BuildingProductionState>(
    () => gardenData.productionState ?? {},
    [gardenData],
  );

  /**
   * Total contributions lifetime = semaine courante + cumul des semaines passées.
   * Sert de base au calcul de production — monotone croissant.
   */
  const lifetimeContributions = useMemo(
    () =>
      (gardenData.contributions?.length ?? 0) +
      (gardenData.pastWeeks ?? []).reduce((sum, w) => sum + (w.total ?? 0), 0),
    [gardenData],
  );

  /** Historique crafts atelier village */
  const atelierCrafts = useMemo<VillageAtelierCraft[]>(
    () => gardenData.atelierCrafts ?? [],
    [gardenData],
  );

  /** Techs village débloquées */
  const atelierTechs = useMemo<string[]>(
    () => gardenData.atelierTechs ?? [],
    [gardenData],
  );

  /** Bonus agrégés des techs village */
  const villageTechBonuses = useMemo<VillageTechBonuses>(
    () => computeVillageTechBonuses(atelierTechs),
    [atelierTechs],
  );

  /**
   * Retourne le nombre d'items en attente de collecte pour un bâtiment donné.
   * pendingItems = floor((lifetimeContribs - consumed) / (ratePerItem × prodMultiplier))
   */
  const getPendingItems = useCallback(
    (buildingId: string): number => {
      const entry = BUILDINGS_CATALOG.find(b => b.id === buildingId);
      if (!entry) return 0;
      const consumed = productionState[buildingId] ?? 0;
      const available = Math.max(0, lifetimeContributions - consumed);
      const multiplier = villageTechBonuses.productionRateMultiplier[buildingId] ?? 1;
      const effectiveRate = Math.max(1, Math.floor(entry.production.ratePerItem * multiplier));
      return Math.floor(available / effectiveRate);
    },
    [productionState, lifetimeContributions, villageTechBonuses],
  );

  // ---------------------------------------------------------------------------
  // Génération objectif hebdomadaire (per D-04, D-05, D-06, D-07)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!vault) return;

    const currentMonday = getMondayISO(new Date());

    // Lire le fichier fraîchement — NE PAS dépendre de gardenRaw pour éviter
    // la race condition où addContribution → setGardenRaw → re-trigger de cet
    // effet → reset contributions: [] avant que la semaine soit initialisée.
    // Dépendances intentionnellement restreintes à [vault, activeProfileCount].
    let cancelled = false;
    (async () => {
      try {
        const freshContent = await vault.readFile(VILLAGE_FILE).catch(() => '');
        const freshData = parseGardenFile(freshContent);

        // Guard anti-boucle infinie (per D-07, Pitfall 2) — vérifié sur données fraîches.
        if (freshData.currentWeekStart === currentMonday) return;

        setIsLoading(true);

        // Index de la prochaine semaine (pour la rotation déterministe du template)
        const nextWeekIndex =
          (freshData.pastWeeks?.length ?? 0) + (freshData.currentWeekStart ? 1 : 0);
        const nextThemeIndex = nextWeekIndex % OBJECTIVE_TEMPLATES.length;

        // Archiver la semaine passée si elle avait un objectif (D-05)
        const updatedPastWeeks: VillageWeekRecord[] = [...(freshData.pastWeeks ?? [])];
        if (freshData.currentWeekStart) {
          // Calculer les contributions par membre avant archivage (HIST-02)
          const byMember: Record<string, number> = {};
          for (const c of freshData.contributions ?? []) {
            byMember[c.profileId] = (byMember[c.profileId] ?? 0) + c.amount;
          }
          const weekRecord: VillageWeekRecord = {
            weekStart: freshData.currentWeekStart,
            target: computeWeekTarget(activeProfileCount),
            total: freshData.contributions?.length ?? 0,
            claimed: freshData.rewardClaimed,
            contributionsByMember: Object.keys(byMember).length > 0 ? byMember : undefined,
          };
          updatedPastWeeks.push(weekRecord);
        }

        // Construire le nouveau VillageData (contributions vidées pour la nouvelle semaine)
        const newData: VillageData = {
          ...freshData,
          currentWeekStart: currentMonday,
          currentThemeIndex: nextThemeIndex,
          rewardClaimed: false,
          contributions: [],
          pastWeeks: updatedPastWeeks,
        };

        const newContent = serializeGardenFile(newData);
        if (cancelled) return;
        await vault.writeFile(VILLAGE_FILE, newContent);
        setGardenRaw(newContent);
      } catch (e) {
        if (__DEV__) console.warn('useGarden — génération objectif:', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault, activeProfileCount]); // gardenRaw intentionnellement absent — voir commentaire ci-dessus

  // ---------------------------------------------------------------------------
  // Phase 30 — Effet unlock-on-threshold (VILL-04, VILL-05)
  // ---------------------------------------------------------------------------
  // Détecte quand familyLifetimeLeaves franchit un palier catalogue et
  // append le bâtiment correspondant dans jardin-familial.md (append-only).
  //
  // Idempotence stricte : computeBuildingsToUnlock retourne [] si tout est déjà
  // débloqué → early return, pas d'écriture, pas de boucle infinie (Pitfall 1).
  //
  // Multi-paliers simultanés : cascade d'appels appendBuilding sur currentContent
  // local (pur) puis UN SEUL writeFile + setGardenRaw à la fin.
  useEffect(() => {
    if (!vault) return;
    const toUnlock = computeBuildingsToUnlock(familyLifetimeLeaves, unlockedBuildings);
    if (toUnlock.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        let currentContent = await vault.readFile(VILLAGE_FILE).catch(() => '');
        const now = new Date().toISOString();
        for (const entry of toUnlock) {
          const building: UnlockedBuilding = {
            timestamp: now,
            buildingId: entry.id,
            palier: entry.palier,
          };
          currentContent = appendBuilding(currentContent, building);
        }
        if (cancelled) return;
        await vault.writeFile(VILLAGE_FILE, currentContent);
        setGardenRaw(currentContent);
      } catch {
        /* Constructions — non-critical */
      }
    })();

    return () => { cancelled = true; };
  }, [vault, familyLifetimeLeaves, unlockedBuildings, setGardenRaw]);

  // ---------------------------------------------------------------------------
  // addContribution (per D-09)
  // ---------------------------------------------------------------------------

  /**
   * Enregistre une contribution (récolte ferme ou tâche IRL) dans jardin-familial.md.
   * Utilise appendContributionToVault puis relit le fichier pour mettre à jour l'état.
   */
  const addContribution = useCallback(
    async (type: ContributionType, profileId: string): Promise<void> => {
      if (!vault) return;

      const contribution = {
        timestamp: new Date().toISOString(),
        profileId,
        type,
        amount: 1,
      };

      // appendContributionToVault retourne void — relire le fichier après écriture
      await appendContributionToVault(vault, contribution);
      const updated = await vault.readFile(VILLAGE_FILE).catch(() => '');
      setGardenRaw(updated);
    },
    [vault, setGardenRaw],
  );

  // ---------------------------------------------------------------------------
  // collectBuildingProduction — Phase 31+
  // ---------------------------------------------------------------------------

  /**
   * Collecte les items produits par un bâtiment village.
   * - Calcule les items en attente (lifetimeContribs - consumed) / rate
   * - Ajoute les items à l'inventaire collectif
   * - Met à jour productionState (contributions consommées)
   * - Écrit jardin-familial.md en une seule passe
   */
  const collectBuildingProduction = useCallback(
    async (buildingId: string): Promise<void> => {
      if (!vault) return;
      const entry = BUILDINGS_CATALOG.find(b => b.id === buildingId);
      if (!entry) return;

      const pending = getPendingItems(buildingId);
      if (pending === 0) return;

      const consumed = productionState[buildingId] ?? 0;
      const newConsumed = consumed + pending * entry.production.ratePerItem;
      const { itemId } = entry.production;
      const currentQty = inventory[itemId] ?? 0;

      const updatedData: VillageData = {
        ...gardenData,
        inventory: { ...inventory, [itemId]: currentQty + pending },
        productionState: { ...productionState, [buildingId]: newConsumed },
      };

      const newContent = serializeGardenFile(updatedData);
      await vault.writeFile(VILLAGE_FILE, newContent);
      setGardenRaw(newContent);
    },
    [vault, gardenData, inventory, productionState, getPendingItems, setGardenRaw],
  );

  // ---------------------------------------------------------------------------
  // craftVillageItem — Phase 31+
  // ---------------------------------------------------------------------------

  /**
   * Crée un item dans l'atelier village.
   * Vérifie les ingrédients, déduit l'inventaire, append dans ## Atelier Crafts.
   * Retourne true si réussi.
   */
  const craftVillageItem = useCallback(
    async (recipeId: string, profileId: string): Promise<boolean> => {
      if (!vault) return false;
      const { canCraft: ok } = canCraftVillageRecipe(
        recipeId, inventory, villageTechBonuses.unlockedRecipeTier,
      );
      if (!ok) return false;

      const updatedInventory = applyRecipeCost(inventory, recipeId);
      const newCraft: VillageAtelierCraft = {
        timestamp: new Date().toISOString(),
        recipeId,
        profileId,
      };
      const updatedData: VillageData = {
        ...gardenData,
        inventory: updatedInventory,
        atelierCrafts: [...(gardenData.atelierCrafts ?? []), newCraft],
      };
      const newContent = serializeGardenFile(updatedData);
      await vault.writeFile(VILLAGE_FILE, newContent);
      setGardenRaw(newContent);
      return true;
    },
    [vault, gardenData, inventory, villageTechBonuses, setGardenRaw],
  );

  // ---------------------------------------------------------------------------
  // unlockVillageTech — Phase 31+
  // ---------------------------------------------------------------------------

  /**
   * Débloque une tech village en dépensant les items requis.
   * Retourne true si réussi.
   */
  const unlockVillageTech = useCallback(
    async (techId: string): Promise<boolean> => {
      if (!vault) return false;
      const { canUnlock } = canUnlockVillageTech(techId, atelierTechs, inventory);
      if (!canUnlock) return false;

      const updatedInventory = applyTechCost(inventory, techId);
      const updatedTechs = [...atelierTechs, techId];
      const updatedData: VillageData = {
        ...gardenData,
        inventory: updatedInventory,
        atelierTechs: updatedTechs,
      };
      const newContent = serializeGardenFile(updatedData);
      await vault.writeFile(VILLAGE_FILE, newContent);
      setGardenRaw(newContent);
      return true;
    },
    [vault, gardenData, inventory, atelierTechs, setGardenRaw],
  );

  // ---------------------------------------------------------------------------
  // Q49 — Trade inter-familles via Port
  // ---------------------------------------------------------------------------

  /** Dérive canSendTradeToday et tradesSentRemaining depuis tradeSentTodayField */
  const canSendTradeTodayValue = useMemo(
    () => canSendTradeToday(tradeSentTodayField),
    [tradeSentTodayField],
  );

  const tradesSentRemainingValue = useMemo(
    () => tradesRemainingToday(tradeSentTodayField),
    [tradeSentTodayField],
  );

  /**
   * Envoie un colis inter-familles.
   * Vérifie le quota journalier, déduit le stock, incrémente le compteur, encode le code.
   * Retourne le code ou null si impossible.
   */
  const sendTrade = useCallback(
    async (category: TradeCategory, itemId: string, quantity: number, profileId: string): Promise<string | null> => {
      if (!vault) return null;
      if (!canSendTradeToday(tradeSentTodayField)) return null;

      const gamiPath = `gami-${profileId}.md`;
      const gamiContent = await vault.readFile(gamiPath).catch(() => '');
      const farmData = parseFarmProfile(gamiContent);

      // Vérifier et déduire le stock selon catégorie
      let gardenUpdated = false;
      let newGardenData: VillageData | null = null;

      if (category === 'village') {
        const currentQty = gardenData.inventory[itemId] ?? 0;
        if (currentQty < quantity) return null;
        newGardenData = {
          ...gardenData,
          inventory: { ...gardenData.inventory, [itemId]: currentQty - quantity },
        };
        gardenUpdated = true;
      } else if (category === 'farm') {
        const invKey = itemId as keyof import('../lib/mascot/types').FarmInventory;
        const currentQty = (farmData.farmInventory?.[invKey] ?? 0);
        if (currentQty < quantity) return null;
        const updatedFarmInv = {
          ...farmData.farmInventory,
          oeuf: farmData.farmInventory?.oeuf ?? 0,
          lait: farmData.farmInventory?.lait ?? 0,
          farine: farmData.farmInventory?.farine ?? 0,
          miel: farmData.farmInventory?.miel ?? 0,
          [invKey]: currentQty - quantity,
        };
        const newField = incrementTradesSent(tradeSentTodayField);
        const updatedFarmData = {
          ...farmData,
          farmInventory: updatedFarmInv,
          trade_sent_today: newField,
        };
        const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
        await vault.writeFile(gamiPath, serializeFarmProfile(profileName, updatedFarmData));
        setTradeSentTodayField(newField);
        // Encoder le code
        const payload = {
          category,
          itemId,
          quantity,
          timestamp: Math.floor(Date.now() / 1000),
          nonce: Math.floor(Math.random() * 9999),
        };
        return encodeTrade(payload);
      } else if (category === 'harvest') {
        const currentQty = farmData.harvestInventory?.[itemId] ?? 0;
        if (currentQty < quantity) return null;
        const updatedHarvest = {
          ...farmData.harvestInventory,
          [itemId]: currentQty - quantity,
        };
        const newField = incrementTradesSent(tradeSentTodayField);
        const updatedFarmData = {
          ...farmData,
          harvestInventory: updatedHarvest,
          trade_sent_today: newField,
        };
        const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
        await vault.writeFile(gamiPath, serializeFarmProfile(profileName, updatedFarmData));
        setTradeSentTodayField(newField);
        const payload = {
          category,
          itemId,
          quantity,
          timestamp: Math.floor(Date.now() / 1000),
          nonce: Math.floor(Math.random() * 9999),
        };
        return encodeTrade(payload);
      }

      // Village — écrire jardin-familial.md + gami pour trade_sent_today
      if (gardenUpdated && newGardenData) {
        const newContent = serializeGardenFile(newGardenData);
        await vault.writeFile(VILLAGE_FILE, newContent);
        setGardenRaw(newContent);
        const newField = incrementTradesSent(tradeSentTodayField);
        const updatedFarmData = { ...farmData, trade_sent_today: newField };
        const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
        await vault.writeFile(gamiPath, serializeFarmProfile(profileName, updatedFarmData));
        setTradeSentTodayField(newField);
        const payload = {
          category,
          itemId,
          quantity,
          timestamp: Math.floor(Date.now() / 1000),
          nonce: Math.floor(Math.random() * 9999),
        };
        return encodeTrade(payload);
      }

      return null;
    },
    [vault, gardenData, tradeSentTodayField, profiles, setGardenRaw],
  );

  /**
   * Reçoit un colis via un code-cadeau.
   * Valide le code, vérifie expiration + double-claim, ajoute l'item à l'inventaire.
   */
  const receiveTrade = useCallback(
    async (code: string, profileId: string): Promise<{ success: boolean; itemLabel?: string; emoji?: string; quantity?: number; error?: string }> => {
      if (!vault) return { success: false, error: 'Vault non disponible' };

      const payload = decodeTrade(code);
      if (!payload) return { success: false, error: 'Code invalide' };

      if (isTradeExpired(payload)) return { success: false, error: 'Code expiré (validité 48h)' };

      const gamiPath = `gami-${profileId}.md`;
      const gamiContent = await vault.readFile(gamiPath).catch(() => '');
      const farmData = parseFarmProfile(gamiContent);

      const claimedCodes = farmData.trade_claimed_codes ?? [];
      if (isTradeAlreadyClaimed(code, claimedCodes)) {
        return { success: false, error: 'Ce code a déjà été utilisé' };
      }

      const { label, emoji } = getTradeItemMeta(payload.category, payload.itemId);

      // Ajouter l'item selon la catégorie
      if (payload.category === 'village') {
        const currentQty = gardenData.inventory[payload.itemId] ?? 0;
        const newGardenData = {
          ...gardenData,
          inventory: { ...gardenData.inventory, [payload.itemId]: currentQty + payload.quantity },
        };
        const newContent = serializeGardenFile(newGardenData);
        await vault.writeFile(VILLAGE_FILE, newContent);
        setGardenRaw(newContent);
      } else if (payload.category === 'farm') {
        const invKey = payload.itemId as keyof import('../lib/mascot/types').FarmInventory;
        const currentQty = farmData.farmInventory?.[invKey] ?? 0;
        const updatedFarmInv = {
          oeuf: farmData.farmInventory?.oeuf ?? 0,
          lait: farmData.farmInventory?.lait ?? 0,
          farine: farmData.farmInventory?.farine ?? 0,
          miel: farmData.farmInventory?.miel ?? 0,
          ...farmData.farmInventory,
          [invKey]: currentQty + payload.quantity,
        };
        const newClaimedCodes = [...claimedCodes, code.trim().toUpperCase()].slice(-200);
        const updatedFarmData = { ...farmData, farmInventory: updatedFarmInv, trade_claimed_codes: newClaimedCodes };
        const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
        await vault.writeFile(gamiPath, serializeFarmProfile(profileName, updatedFarmData));
        return { success: true, itemLabel: label, emoji, quantity: payload.quantity };
      } else if (payload.category === 'harvest') {
        const currentQty = farmData.harvestInventory?.[payload.itemId] ?? 0;
        const updatedHarvest = { ...farmData.harvestInventory, [payload.itemId]: currentQty + payload.quantity };
        const newClaimedCodes = [...claimedCodes, code.trim().toUpperCase()].slice(-200);
        const updatedFarmData = { ...farmData, harvestInventory: updatedHarvest, trade_claimed_codes: newClaimedCodes };
        const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
        await vault.writeFile(gamiPath, serializeFarmProfile(profileName, updatedFarmData));
        return { success: true, itemLabel: label, emoji, quantity: payload.quantity };
      }

      // Village — mettre aussi à jour le claimed code dans gami
      const newClaimedCodes = [...claimedCodes, code.trim().toUpperCase()].slice(-200);
      const updatedFarmData = { ...farmData, trade_claimed_codes: newClaimedCodes };
      const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
      await vault.writeFile(gamiPath, serializeFarmProfile(profileName, updatedFarmData));

      return { success: true, itemLabel: label, emoji, quantity: payload.quantity };
    },
    [vault, gardenData, profiles, setGardenRaw],
  );

  // Charger trade_sent_today du profil actif au mount (et quand vault/profils changent)
  useEffect(() => {
    if (!vault || profiles.length === 0) return;
    const activeProfile = profiles.find(p => p.statut !== 'grossesse');
    if (!activeProfile) return;
    let cancelled = false;
    (async () => {
      try {
        const gamiPath = `gami-${activeProfile.id}.md`;
        const content = await vault.readFile(gamiPath).catch(() => '');
        const farmData = parseFarmProfile(content);
        if (!cancelled) setTradeSentTodayField(farmData.trade_sent_today);
      } catch {
        /* non-critique */
      }
    })();
    return () => { cancelled = true; };
  }, [vault, profiles]);

  // ---------------------------------------------------------------------------
  // claimReward (per D-08, D-09)
  // ---------------------------------------------------------------------------

  /**
   * Réclame la récompense collective si l'objectif est atteint.
   * Guard anti-double-claim : vérifie village_claimed_week dans gami-{id}.md (D-08).
   * Retourne true si le claim a réussi, false si déjà réclamé ou objectif non atteint.
   */
  const claimReward = useCallback(
    async (profileId: string): Promise<boolean> => {
      if (!vault || !isGoalReached) return false;

      // Lire le fichier gami du profil
      const gamiPath = `gami-${profileId}.md`;
      const content = await vault.readFile(gamiPath).catch(() => '');
      const farmData = parseFarmProfile(content);

      // Guard anti-double-claim (D-08) — village_claimed_week persisté par profil
      if (farmData.village_claimed_week === gardenData.currentWeekStart) return false;

      // Écrire le flag anti-double-claim dans gami-{id}.md
      const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
      const updated = { ...farmData, village_claimed_week: gardenData.currentWeekStart };
      await vault.writeFile(gamiPath, serializeFarmProfile(profileName, updated));

      return true;
    },
    [vault, isGoalReached, gardenData, profiles],
  );

  // ---------------------------------------------------------------------------
  // Return API complète (per D-09)
  // ---------------------------------------------------------------------------

  return {
    gardenData,
    currentTarget,
    progress,
    isGoalReached,
    currentTemplate,
    addContribution,
    claimReward,
    weekHistory,
    isLoading,
    // Phase 30
    familyLifetimeLeaves,
    unlockedBuildings,
    // Phase 31+
    inventory,
    productionState,
    lifetimeContributions,
    getPendingItems,
    collectBuildingProduction,
    atelierCrafts,
    atelierTechs,
    villageTechBonuses,
    craftVillageItem,
    unlockVillageTech,
    // Q49 — Trade inter-familles
    sendTrade,
    receiveTrade,
    canSendTradeToday: canSendTradeTodayValue,
    tradesSentRemaining: tradesSentRemainingValue,
  };
}
