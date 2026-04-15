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
  // Marché boursier
  initializeMarketStock,
  executeBuy,
  executeSell,
  canBuyItem,
  canSellItem,
  canTransactToday,
  transactionsRemainingToday,
  pruneTransactionLog,
  MAX_MARKET_TXN_PER_DAY,
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
  MarketStock,
  MarketTransaction,
} from '../lib/village';
import type { VillageTechBonuses } from '../lib/village/atelier-engine';
import { MARKET_ITEMS } from '../lib/village/market-engine';
import { parseGamification, serializeGamification } from '../lib/parser';
import type { VaultManager } from '../lib/vault';

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

/** Retourne la catégorie marché d'un item */
function findMarketItemCategory(itemId: string): string | null {
  const def = MARKET_ITEMS.find(m => m.itemId === itemId);
  return def?.category ?? null;
}

/** Parse un profil depuis gami-{id}.md pour lire/écrire les coins */
function parseGamificationForMarket(raw: string): { coins: number } | null {
  try {
    const gami = parseGamification(raw);
    const profile = gami.profiles?.[0];
    if (!profile) return null;
    return { coins: profile.coins ?? 0 };
  } catch {
    return null;
  }
}

/** Écrit les coins mis à jour dans gami-{id}.md */
async function writeGamiCoins(
  vaultMgr: VaultManager,
  gamiPath: string,
  rawContent: string,
  newCoins: number,
): Promise<void> {
  const gami = parseGamification(rawContent);
  const profile = gami.profiles?.[0];
  if (!profile) return;
  profile.coins = newCoins;
  await vaultMgr.writeFile(gamiPath, serializeGamification(gami));
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
  receiveTrade: (code: string, profileId: string) => Promise<{ success: boolean; itemLabel?: string; emoji?: string; quantity?: number; category?: string; itemId?: string; error?: string }>;
  canSendTradeToday: boolean;
  tradesSentRemaining: number;
  // Marché boursier
  marketStock: MarketStock;
  marketTransactions: MarketTransaction[];
  buyFromMarket: (itemId: string, quantity: number, profileId: string, priceOverride?: number) => Promise<{ success: boolean; totalCost?: number; error?: string }>;
  sellToMarket: (itemId: string, quantity: number, profileId: string) => Promise<{ success: boolean; totalGain?: number; error?: string }>;
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
  const { vault, gardenRaw, setGardenRaw, profiles, awardProfileXP, refreshGamification, refreshFarm } = useVault();

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

  // ---------------------------------------------------------------------------
  // Marché boursier — stock, transactions, buy/sell
  // ---------------------------------------------------------------------------

  /** Stock du marché — initialisé au premier accès si vide */
  const marketStock = useMemo<MarketStock>(() => {
    const raw = gardenData.marketStock ?? {};
    // Si vide et marché débloqué → initialiser avec le stock par défaut
    if (Object.keys(raw).length === 0 && unlockedBuildings.some(b => b.buildingId === 'marche')) {
      return initializeMarketStock();
    }
    return raw;
  }, [gardenData, unlockedBuildings]);

  /** Log des transactions marché */
  const marketTransactions = useMemo<MarketTransaction[]>(
    () => gardenData.marketTransactions ?? [],
    [gardenData],
  );

  /**
   * Retourne le nombre d'items en attente de collecte pour un bâtiment donné.
   * pendingItems = floor((lifetimeContribs - consumed) / (ratePerItem × prodMultiplier))
   */
  const getPendingItems = useCallback(
    (buildingId: string): number => {
      const entry = BUILDINGS_CATALOG.find(b => b.id === buildingId);
      if (!entry || !entry.production) return 0; // Marché = production null
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
      if (!entry || !entry.production) return; // Marché = production null

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
  // buyFromMarket — Marché boursier
  // ---------------------------------------------------------------------------

  /**
   * Achète un item au marché. Le profil paie des coins, le stock du marché baisse.
   * Écrit dans jardin-familial.md (stock + transaction log).
   * Les coins sont déduits du profil via gami-{id}.md.
   */
  const buyFromMarket = useCallback(
    async (itemId: string, quantity: number, profileId: string, priceOverride?: number): Promise<{ success: boolean; totalCost?: number; error?: string }> => {
      if (!vault) return { success: false, error: 'Vault non disponible' };

      // Vérifier le rate limit
      if (!canTransactToday(marketTransactions, profileId)) {
        return { success: false, error: 'Limite de 10 transactions/jour atteinte' };
      }

      // Trouver le profil pour vérifier les coins
      const profile = profiles.find(p => p.id === profileId);
      if (!profile) return { success: false, error: 'Profil introuvable' };

      // Vérifier l'achat
      const check = canBuyItem(itemId, quantity, marketStock, profile.coins ?? 0, priceOverride);
      if (!check.canBuy) return { success: false, error: check.reason };

      const category = findMarketItemCategory(itemId);

      // Exécuter l'achat
      const { newStock, transaction, totalCost } = executeBuy(itemId, quantity, profileId, marketStock, new Date(), priceOverride);

      // Mettre à jour le stock + log dans jardin-familial.md
      const updatedTxns = pruneTransactionLog([...marketTransactions, transaction]);

      // Items village/village_craft → inventaire collectif
      const isCollective = category === 'village' || category === 'village_craft';
      const updatedData: VillageData = {
        ...gardenData,
        inventory: isCollective
          ? { ...inventory, [itemId]: (inventory[itemId] ?? 0) + quantity }
          : inventory,
        marketStock: newStock,
        marketTransactions: updatedTxns,
      };

      const newContent = serializeGardenFile(updatedData);
      await vault.writeFile(VILLAGE_FILE, newContent);
      setGardenRaw(newContent);

      // Déduire les coins du profil via gami-{id}.md
      try {
        const gamiPath = `gami-${profileId}.md`;
        const gamiRaw = await vault.readFile(gamiPath).catch(() => '');
        if (gamiRaw) {
          const gami = parseGamificationForMarket(gamiRaw);
          if (gami) {
            gami.coins = Math.max(0, (gami.coins ?? 0) - totalCost);
            await writeGamiCoins(vault, gamiPath, gamiRaw, gami.coins);
          }
        }
        refreshGamification();
      } catch { /* Gamification — non-critical */ }

      // Items farm/harvest → ajouter à l'inventaire ferme du profil
      if (category === 'farm' || category === 'harvest') {
        try {
          const farmPath = `farm-${profileId}.md`;
          const farmRaw = await vault.readFile(farmPath).catch(() => '');
          const farmData = parseFarmProfile(farmRaw);
          if (category === 'farm') {
            const farmInvObj = { ...(farmData.farmInventory ?? {}) } as any;
            farmInvObj[itemId] = (farmInvObj[itemId] ?? 0) + quantity;
            const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
            await vault.writeFile(farmPath, serializeFarmProfile(profileName, { ...farmData, farmInventory: farmInvObj }));
          } else {
            const harvestInvObj = { ...(farmData.harvestInventory ?? {}) } as any;
            harvestInvObj[itemId] = (harvestInvObj[itemId] ?? 0) + quantity;
            const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
            await vault.writeFile(farmPath, serializeFarmProfile(profileName, { ...farmData, harvestInventory: harvestInvObj }));
          }
          await refreshFarm(profileId);
        } catch { /* non-critical */ }
      }

      // Items crafted → ajouter au CraftedItem[] du profil
      if (category === 'crafted') {
        try {
          const farmPath = `farm-${profileId}.md`;
          const farmRaw = await vault.readFile(farmPath).catch(() => '');
          const farmData = parseFarmProfile(farmRaw);
          const craftedItems = [...(farmData.craftedItems ?? [])];
          const now = new Date().toISOString();
          for (let i = 0; i < quantity; i++) {
            craftedItems.push({ recipeId: itemId, craftedAt: now });
          }
          const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
          await vault.writeFile(farmPath, serializeFarmProfile(profileName, { ...farmData, craftedItems }));
          await refreshFarm(profileId);
        } catch { /* non-critical */ }
      }

      return { success: true, totalCost };
    },
    [vault, gardenData, inventory, marketStock, marketTransactions, profiles, setGardenRaw, refreshGamification, refreshFarm],
  );

  // ---------------------------------------------------------------------------
  // sellToMarket — Marché boursier
  // ---------------------------------------------------------------------------

  /**
   * Vend un item au marché. Le stock du marché monte, le profil reçoit des coins.
   * Items village : déduit de l'inventaire collectif.
   * Items farm : déduit de l'inventaire ferme du profil.
   */
  const sellToMarket = useCallback(
    async (itemId: string, quantity: number, profileId: string): Promise<{ success: boolean; totalGain?: number; error?: string }> => {
      if (!vault) return { success: false, error: 'Vault non disponible' };

      if (!canTransactToday(marketTransactions, profileId)) {
        return { success: false, error: 'Limite de 10 transactions/jour atteinte' };
      }

      const category = findMarketItemCategory(itemId);

      // Vérifier le stock disponible selon la catégorie
      const isCollective = category === 'village' || category === 'village_craft';
      let profileItemCount = 0;
      if (isCollective) {
        profileItemCount = inventory[itemId] ?? 0;
      } else {
        // Items per-profile : farm, harvest, crafted
        try {
          const farmRaw = await vault.readFile(`farm-${profileId}.md`).catch(() => '');
          const farmData = parseFarmProfile(farmRaw);
          if (category === 'farm') {
            profileItemCount = (farmData.farmInventory as any)?.[itemId] ?? 0;
          } else if (category === 'harvest') {
            profileItemCount = (farmData.harvestInventory as any)?.[itemId] ?? 0;
          } else if (category === 'crafted') {
            profileItemCount = (farmData.craftedItems ?? []).filter((c: any) => c.recipeId === itemId).length;
          }
        } catch {
          profileItemCount = 0;
        }
      }

      const check = canSellItem(itemId, quantity, marketStock, profileItemCount);
      if (!check.canSell) return { success: false, error: check.reason };

      const { newStock, transaction, totalGain } = executeSell(itemId, quantity, profileId, marketStock);

      const updatedTxns = pruneTransactionLog([...marketTransactions, transaction]);

      // Mettre à jour l'inventaire collectif si village/village_craft
      const updatedInventory = isCollective
        ? { ...inventory, [itemId]: Math.max(0, (inventory[itemId] ?? 0) - quantity) }
        : inventory;

      const updatedData: VillageData = {
        ...gardenData,
        inventory: updatedInventory,
        marketStock: newStock,
        marketTransactions: updatedTxns,
      };

      const newContent = serializeGardenFile(updatedData);
      await vault.writeFile(VILLAGE_FILE, newContent);
      setGardenRaw(newContent);

      // Déduire les items per-profile si farm/harvest/crafted
      if (!isCollective) {
        try {
          const farmPath = `farm-${profileId}.md`;
          const farmRaw = await vault.readFile(farmPath).catch(() => '');
          const farmData = parseFarmProfile(farmRaw);
          const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;

          if (category === 'farm') {
            const farmInv = { ...(farmData.farmInventory ?? {}) } as any;
            farmInv[itemId] = Math.max(0, (farmInv[itemId] ?? 0) - quantity);
            await vault.writeFile(farmPath, serializeFarmProfile(profileName, { ...farmData, farmInventory: farmInv }));
          } else if (category === 'harvest') {
            const harvestInv = { ...(farmData.harvestInventory ?? {}) } as any;
            harvestInv[itemId] = Math.max(0, (harvestInv[itemId] ?? 0) - quantity);
            await vault.writeFile(farmPath, serializeFarmProfile(profileName, { ...farmData, harvestInventory: harvestInv }));
          } else if (category === 'crafted') {
            // Retirer N CraftedItem avec ce recipeId (les plus anciens d'abord)
            const craftedItems = [...(farmData.craftedItems ?? [])];
            let removed = 0;
            const filtered = craftedItems.filter((c: any) => {
              if (removed < quantity && c.recipeId === itemId) { removed++; return false; }
              return true;
            });
            await vault.writeFile(farmPath, serializeFarmProfile(profileName, { ...farmData, craftedItems: filtered }));
          }
          await refreshFarm(profileId);
        } catch { /* non-critical */ }
      }

      // Créditer les coins au profil
      try {
        const gamiPath = `gami-${profileId}.md`;
        const gamiRaw = await vault.readFile(gamiPath).catch(() => '');
        if (gamiRaw) {
          const gami = parseGamificationForMarket(gamiRaw);
          if (gami) {
            gami.coins = (gami.coins ?? 0) + totalGain;
            await writeGamiCoins(vault, gamiPath, gamiRaw, gami.coins);
          }
        }
        refreshGamification();
      } catch { /* Gamification — non-critical */ }

      return { success: true, totalGain };
    },
    [vault, gardenData, inventory, marketStock, marketTransactions, profiles, setGardenRaw, refreshGamification, refreshFarm],
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

      const recipe = VILLAGE_RECIPES.find((r) => r.id === recipeId);
      if (recipe && recipe.xpBonus > 0) {
        const activeProfiles = profiles.filter((p) => p.statut !== 'grossesse');
        for (const p of activeProfiles) {
          try {
            await awardProfileXP(p.id, recipe.xpBonus, `Craft: ${recipe.id}`);
          } catch { /* Gamification — non-critical */ }
        }
      }

      return true;
    },
    [vault, gardenData, inventory, villageTechBonuses, setGardenRaw, profiles, awardProfileXP],
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

      const farmPath = `farm-${profileId}.md`;
      const farmContent = await vault.readFile(farmPath).catch(() => '');
      const farmData = parseFarmProfile(farmContent);

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
        await vault.writeFile(farmPath, serializeFarmProfile(profileName, updatedFarmData));
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
        await vault.writeFile(farmPath, serializeFarmProfile(profileName, updatedFarmData));
        await refreshFarm(profileId);
        setTradeSentTodayField(newField);
        const payload = {
          category,
          itemId,
          quantity,
          timestamp: Math.floor(Date.now() / 1000),
          nonce: Math.floor(Math.random() * 9999),
        };
        return encodeTrade(payload);
      } else if (category === 'crafted') {
        const crafted = farmData.craftedItems ?? [];
        // Compter combien on en a de ce recipeId
        const available = crafted.filter(c => c.recipeId === itemId).length;
        if (available < quantity) return null;
        // Retirer `quantity` items de ce recipeId (les plus anciens)
        let removed = 0;
        const updatedCrafted = crafted.filter(c => {
          if (c.recipeId === itemId && removed < quantity) {
            removed++;
            return false;
          }
          return true;
        });
        const newField = incrementTradesSent(tradeSentTodayField);
        const updatedFarmData = {
          ...farmData,
          craftedItems: updatedCrafted,
          trade_sent_today: newField,
        };
        const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
        await vault.writeFile(farmPath, serializeFarmProfile(profileName, updatedFarmData));
        await refreshFarm(profileId);
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

      // Village — écrire jardin-familial.md + farm pour trade_sent_today
      if (gardenUpdated && newGardenData) {
        const newContent = serializeGardenFile(newGardenData);
        await vault.writeFile(VILLAGE_FILE, newContent);
        setGardenRaw(newContent);
        const newField = incrementTradesSent(tradeSentTodayField);
        const updatedFarmData = { ...farmData, trade_sent_today: newField };
        const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
        await vault.writeFile(farmPath, serializeFarmProfile(profileName, updatedFarmData));
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
    async (code: string, profileId: string): Promise<{ success: boolean; itemLabel?: string; emoji?: string; quantity?: number; category?: string; itemId?: string; error?: string }> => {
      if (!vault) return { success: false, error: 'Vault non disponible' };

      const payload = decodeTrade(code);
      if (!payload) return { success: false, error: 'Code invalide' };

      if (isTradeExpired(payload)) return { success: false, error: 'Code expiré (validité 48h)' };

      const farmPath = `farm-${profileId}.md`;
      const farmContent = await vault.readFile(farmPath).catch(() => '');
      const farmData = parseFarmProfile(farmContent);

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
        await vault.writeFile(farmPath, serializeFarmProfile(profileName, updatedFarmData));
        await refreshFarm(profileId);
        return { success: true, itemLabel: label, emoji, quantity: payload.quantity, category: payload.category, itemId: payload.itemId };
      } else if (payload.category === 'harvest') {
        const currentQty = farmData.harvestInventory?.[payload.itemId] ?? 0;
        const updatedHarvest = { ...farmData.harvestInventory, [payload.itemId]: currentQty + payload.quantity };
        const newClaimedCodes = [...claimedCodes, code.trim().toUpperCase()].slice(-200);
        const updatedFarmData = { ...farmData, harvestInventory: updatedHarvest, trade_claimed_codes: newClaimedCodes };
        const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
        await vault.writeFile(farmPath, serializeFarmProfile(profileName, updatedFarmData));
        await refreshFarm(profileId);
        return { success: true, itemLabel: label, emoji, quantity: payload.quantity, category: payload.category, itemId: payload.itemId };
      } else if (payload.category === 'crafted') {
        const crafted = farmData.craftedItems ?? [];
        const newItems: import('../lib/mascot/types').CraftedItem[] = [];
        for (let i = 0; i < payload.quantity; i++) {
          newItems.push({ recipeId: payload.itemId, craftedAt: new Date().toISOString() });
        }
        const newClaimedCodes = [...claimedCodes, code.trim().toUpperCase()].slice(-200);
        const updatedFarmData = { ...farmData, craftedItems: [...crafted, ...newItems], trade_claimed_codes: newClaimedCodes };
        const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
        await vault.writeFile(farmPath, serializeFarmProfile(profileName, updatedFarmData));
        await refreshFarm(profileId);
        return { success: true, itemLabel: label, emoji, quantity: payload.quantity, category: payload.category, itemId: payload.itemId };
      }

      // Village — mettre aussi à jour le claimed code dans farm
      const newClaimedCodes = [...claimedCodes, code.trim().toUpperCase()].slice(-200);
      const updatedFarmData = { ...farmData, trade_claimed_codes: newClaimedCodes };
      const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
      await vault.writeFile(farmPath, serializeFarmProfile(profileName, updatedFarmData));

      return { success: true, itemLabel: label, emoji, quantity: payload.quantity, category: payload.category, itemId: payload.itemId };
    },
    [vault, gardenData, profiles, setGardenRaw, refreshFarm],
  );

  // Charger trade_sent_today du profil actif au mount (et quand vault/profils changent)
  useEffect(() => {
    if (!vault || profiles.length === 0) return;
    const activeProfile = profiles.find(p => p.statut !== 'grossesse');
    if (!activeProfile) return;
    let cancelled = false;
    (async () => {
      try {
        const farmPath = `farm-${activeProfile.id}.md`;
        const content = await vault.readFile(farmPath).catch(() => '');
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
   * Guard anti-double-claim : vérifie village_claimed_week dans farm-{id}.md (D-08).
   * Retourne true si le claim a réussi, false si déjà réclamé ou objectif non atteint.
   */
  const claimReward = useCallback(
    async (profileId: string): Promise<boolean> => {
      if (!vault || !isGoalReached) return false;

      // Lire le fichier farm du profil (village_claimed_week est un champ FarmProfileData)
      const farmPath = `farm-${profileId}.md`;
      const content = await vault.readFile(farmPath).catch(() => '');
      const farmData = parseFarmProfile(content);

      // Guard anti-double-claim (D-08) — village_claimed_week persisté dans farm-{id}.md
      if (farmData.village_claimed_week === gardenData.currentWeekStart) {
        // Réparer la désync : farm dit "déjà réclamé" mais gardenData.rewardClaimed est false
        // → le bouton reste visible indéfiniment. On corrige le flag garden.
        if (!gardenData.rewardClaimed) {
          const fixedData: VillageData = { ...gardenData, rewardClaimed: true };
          const fixedContent = serializeGardenFile(fixedData);
          await vault.writeFile(VILLAGE_FILE, fixedContent);
          setGardenRaw(fixedContent);
        }
        return false;
      }

      // Écrire le flag anti-double-claim dans farm-{id}.md
      const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
      const updated = { ...farmData, village_claimed_week: gardenData.currentWeekStart };
      await vault.writeFile(farmPath, serializeFarmProfile(profileName, updated));

      // Persister rewardClaimed dans jardin-familial.md pour que le bouton reste caché
      const claimedGardenData: VillageData = { ...gardenData, rewardClaimed: true };
      const newContent = serializeGardenFile(claimedGardenData);
      await vault.writeFile(VILLAGE_FILE, newContent);
      setGardenRaw(newContent);

      return true;
    },
    [vault, isGoalReached, gardenData, profiles, setGardenRaw],
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
    // Marché boursier
    marketStock,
    marketTransactions,
    buyFromMarket,
    sellToMarket,
  };
}
