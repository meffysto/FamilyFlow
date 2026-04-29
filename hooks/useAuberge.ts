/**
 * useAuberge.ts — Hook orchestrateur Auberge (Phase 43)
 *
 * Hook React autonome qui consomme `useVault()` (pattern useExpeditions).
 * Orchestre le moteur pur `lib/mascot/auberge-engine.ts` avec la persistance
 * vault (champs opaques `auberge_*` dans farm-{id}.md) et la gamification (coins).
 *
 * Aucune modification de VaultContext.tsx ou hooks/useVault.ts — toute la logique
 * vit ici (lecture/écriture vault) ou dans le moteur pur.
 *
 * Le hook expose :
 * - Lecture mémoïsée pour le profil actif : visitors / activeVisitors / reputations / totalDeliveries / totalReputation
 * - 3 setters atomiques :
 *   - deliverVisitor(profileId, instanceId)
 *   - dismissVisitor(profileId, instanceId)
 *   - tickAuberge(profileId)
 *
 * Pattern d'écriture : 1 seul `vault.writeFile` par mutation. Pour deliverVisitor,
 * le crédit coins (fichier gami-{id}.md séparé) est appliqué APRÈS la persistance
 * réussie de la ferme — garantit que la livraison est durable avant la récompense
 * (évite double-crédit en cas de retry).
 *
 * Le tickAuberge n'est appelé automatiquement nulle part en Phase 43 — son
 * câblage dans la cascade boot/launch sera fait en Phase 44 (UI).
 */

import { useCallback, useMemo } from 'react';
import { useVault } from '../contexts/VaultContext';
import {
  parseFarmProfile,
  serializeFarmProfile,
  parseGamification,
  serializeGamification,
} from '../lib/parser';
import {
  parseAuberge,
  serializeAuberge,
  deliverVisitor as engineDeliver,
  dismissVisitor as engineDismiss,
  expireVisitors as engineExpire,
  spawnVisitor as engineSpawn,
  canDeliver as engineCanDeliver,
  getActiveVisitors as engineGetActiveVisitors,
  getTotalReputation as engineGetTotalReputation,
} from '../lib/mascot/auberge-engine';
import type {
  AubergeState,
  ActiveVisitor,
  VisitorRequestItem,
  VisitorReputation,
  FarmInventory,
  HarvestInventory,
  CraftedItem,
  ResourceType,
} from '../lib/mascot/types';
import { getTreeStageInfo } from '../lib/mascot/engine';
import { removeFromGradedInventory, countItemByGrade } from '../lib/mascot/grade-engine';
import type { HarvestGrade } from '../lib/mascot/grade-engine';
import type { FarmProfileData } from '../lib/types';

// ─── Helpers chemin fichier ──────────────────────────────────────────────────

function farmFile(profileId: string): string {
  return `farm-${profileId}.md`;
}

function gamiFile(profileId: string): string {
  return `gami-${profileId}.md`;
}

// ─── Hook principal ──────────────────────────────────────────────────────────

export function useAuberge() {
  const { vault, profiles, activeProfile, refreshFarm, refreshGamification } = useVault();

  // ─── Lecture dérivée (profil actif) ─────────────────────────────────────
  // Les champs auberge_* sont opaques et NE sont PAS mergés sur Profile (volontaire,
  // ferme exclue du cache). On dérive l'AubergeState depuis le snapshot Profile
  // si disponible, sinon état vide. Les setters relisent toujours depuis vault
  // pour la source de vérité.
  const state: AubergeState = useMemo(() => {
    const fa = activeProfile as unknown as Partial<FarmProfileData> | null;
    return parseAuberge({
      visitors: fa?.auberge_visitors,
      reputations: fa?.auberge_reputations,
      lastSpawn: fa?.auberge_last_spawn,
      totalDeliveries: fa?.auberge_total_deliveries,
    });
  }, [
    activeProfile,
  ]);

  const visitors = state.visitors;
  const activeVisitors = useMemo(() => engineGetActiveVisitors(state), [state]);
  const reputations = state.reputations;
  const totalDeliveries = state.totalDeliveries;
  const totalReputation = useMemo(() => engineGetTotalReputation(state), [state]);

  // ─── Crédit coins atomique (gami-{id}.md séparé) ────────────────────────
  // Pattern useExpeditions.addCoins — appelé APRÈS la persistance ferme réussie
  // pour garantir l'ordre delivery-persisted-then-credited.
  const addCoins = useCallback(async (profileId: string, amount: number, note: string): Promise<void> => {
    if (!vault || amount <= 0) return;
    const file = gamiFile(profileId);
    const content = await vault.readFile(file).catch(() => '');
    const gami = parseGamification(content);
    const gamiProfile = gami.profiles.find(
      (p: any) => p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()
    );
    if (!gamiProfile) return;

    gamiProfile.coins = (gamiProfile.coins ?? gamiProfile.points) + amount;
    const newEntry = {
      profileId,
      action: `+${amount}`,
      points: amount,
      note,
      timestamp: new Date().toISOString(),
    };
    const singleData = {
      profiles: [gamiProfile],
      history: [...gami.history.filter((e: any) => e.profileId === profileId), newEntry],
      activeRewards: (gami.activeRewards ?? []).filter((r: any) => r.profileId === profileId),
      usedLoots: (gami.usedLoots ?? []).filter((u: any) => u.profileId === profileId),
    };

    await vault.writeFile(file, serializeGamification(singleData));
  }, [vault]);

  // ─── Helper : applique le state Auberge sérialisé sur farmData ──────────
  const applyAubergeToFarmData = useCallback((farmData: FarmProfileData, nextState: AubergeState, now: Date) => {
    const serialized = serializeAuberge(nextState, now);
    farmData.auberge_visitors = serialized.visitors || undefined;
    farmData.auberge_reputations = serialized.reputations || undefined;
    farmData.auberge_last_spawn = serialized.lastSpawn;
    farmData.auberge_total_deliveries = serialized.totalDeliveries > 0 ? serialized.totalDeliveries : undefined;
  }, []);

  // ─── deliverVisitor — atomique ──────────────────────────────────────────
  const deliverVisitor = useCallback(async (
    profileId: string,
    instanceId: string,
  ): Promise<{ ok: boolean; reward?: { coins: number; loot?: string }; missing?: VisitorRequestItem[] }> => {
    if (!vault) return { ok: false };

    const file = farmFile(profileId);
    const content = await vault.readFile(file).catch(() => '');
    const farmData = parseFarmProfile(content);

    // Reconstruire l'AubergeState depuis le vault (source de vérité)
    const currentState = parseAuberge({
      visitors: farmData.auberge_visitors,
      reputations: farmData.auberge_reputations,
      lastSpawn: farmData.auberge_last_spawn,
      totalDeliveries: farmData.auberge_total_deliveries,
    });

    const visitor = currentState.visitors.find(v => v.instanceId === instanceId);
    if (!visitor) return { ok: false };

    // Inventaires courants depuis farmData (source de vérité)
    const farmInv: FarmInventory = farmData.farmInventory ?? { oeuf: 0, lait: 0, farine: 0, miel: 0 };
    const harvestInv: HarvestInventory = farmData.harvestInventory ?? {};
    const craftedItems: CraftedItem[] = farmData.craftedItems ?? [];

    // Vérifier éligibilité (ré-évaluation côté hook avec inventaires frais)
    const check = engineCanDeliver(visitor, farmInv, harvestInv, craftedItems);
    if (!check.ok) return { ok: false, missing: check.missing };

    // Appel moteur pur — calcule nouvel état + items à déduire + reward
    const now = new Date();
    const result = engineDeliver(
      currentState,
      instanceId,
      { farm: farmInv, harvest: harvestInv, crafted: craftedItems },
      now,
    );
    if (!result) return { ok: false, missing: check.missing };

    // Appliquer la déduction sur les inventaires (mutation in-memory de farmData)
    const updatedFarmInv: FarmInventory = { ...farmInv };
    const updatedHarvestInv: HarvestInventory = { ...harvestInv };
    let updatedCrafted: CraftedItem[] = [...craftedItems];

    for (const item of result.deductedItems) {
      if (item.source === 'building') {
        // Ressource bâtiment (oeuf, lait, farine, miel)
        const key = item.itemId as ResourceType;
        if (key === 'oeuf' || key === 'lait' || key === 'farine' || key === 'miel') {
          updatedFarmInv[key] = Math.max(0, (updatedFarmInv[key] ?? 0) - item.quantity);
        }
      } else if (item.source === 'crop') {
        // Cascade ordinaire → beau → superbe → parfait (pattern useExpeditions/useFarm)
        let toRemove = item.quantity;
        for (const g of ['ordinaire', 'beau', 'superbe', 'parfait'] as HarvestGrade[]) {
          if (toRemove <= 0) break;
          const have = countItemByGrade(updatedHarvestInv, item.itemId, g);
          const take = Math.min(have, toRemove);
          if (take > 0) {
            removeFromGradedInventory(updatedHarvestInv, item.itemId, g, take);
            toRemove -= take;
          }
        }
      } else if (item.source === 'crafted') {
        // Retire les N premiers items craftés correspondants au recipeId
        let toRemove = item.quantity;
        const next: CraftedItem[] = [];
        for (const c of updatedCrafted) {
          if (toRemove > 0 && c.recipeId === item.itemId) {
            toRemove--;
            continue;
          }
          next.push(c);
        }
        updatedCrafted = next;
      }
    }

    // Réinjecter inventaires + AubergeState dans farmData
    farmData.farmInventory = updatedFarmInv;
    farmData.harvestInventory = updatedHarvestInv;
    farmData.craftedItems = updatedCrafted;
    applyAubergeToFarmData(farmData, result.state, now);

    // 1 seul writeFile pour la ferme (atomique côté ferme)
    const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
    await vault.writeFile(file, serializeFarmProfile(profileName, farmData));

    // Crédit coins APRÈS persistance ferme — garantit que la livraison est
    // durable avant la récompense (évite double-crédit en cas de retry).
    if (result.reward.coins > 0) {
      const note = `🍻 Auberge : ${visitor.visitorId} (+${result.reward.coins} 🍃)`;
      await addCoins(profileId, result.reward.coins, note);
    }

    await refreshFarm(profileId);
    await refreshGamification();

    return { ok: true, reward: result.reward };
  }, [vault, profiles, addCoins, applyAubergeToFarmData, refreshFarm, refreshGamification]);

  // ─── dismissVisitor — atomique (pas de gamification) ────────────────────
  const dismissVisitor = useCallback(async (profileId: string, instanceId: string): Promise<void> => {
    if (!vault) return;

    const file = farmFile(profileId);
    const content = await vault.readFile(file).catch(() => '');
    const farmData = parseFarmProfile(content);

    const currentState = parseAuberge({
      visitors: farmData.auberge_visitors,
      reputations: farmData.auberge_reputations,
      lastSpawn: farmData.auberge_last_spawn,
      totalDeliveries: farmData.auberge_total_deliveries,
    });

    const now = new Date();
    const { state: nextState } = engineDismiss(currentState, instanceId, now);
    applyAubergeToFarmData(farmData, nextState, now);

    const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
    await vault.writeFile(file, serializeFarmProfile(profileName, farmData));
    await refreshFarm(profileId);
  }, [vault, profiles, applyAubergeToFarmData, refreshFarm]);

  // ─── tickAuberge — expire puis tente spawn (atomique) ──────────────────
  const tickAuberge = useCallback(async (
    profileId: string,
  ): Promise<{ spawned?: ActiveVisitor; expired: ActiveVisitor[] }> => {
    if (!vault) return { expired: [] };

    const file = farmFile(profileId);
    const content = await vault.readFile(file).catch(() => '');
    const farmData = parseFarmProfile(content);

    const currentState = parseAuberge({
      visitors: farmData.auberge_visitors,
      reputations: farmData.auberge_reputations,
      lastSpawn: farmData.auberge_last_spawn,
      totalDeliveries: farmData.auberge_total_deliveries,
    });

    const now = new Date();

    // 1. Expire les visiteurs dont la deadline est passée
    const expireResult = engineExpire(currentState, now);
    let nextState = expireResult.state;
    const expired = expireResult.expired;

    // 2. Récupère treeStage du profil (depuis level Profile via getTreeStageInfo)
    const profile = profiles.find(p => p.id === profileId);
    const level = profile?.level ?? 1;
    const treeStage = getTreeStageInfo(level).stage;

    // 3. Tente spawn (peut être null si cooldown/cap/aucun candidat)
    const totalRep = engineGetTotalReputation(nextState);
    const spawnResult = engineSpawn(nextState, treeStage, now, totalRep);
    let spawned: ActiveVisitor | undefined;
    if (spawnResult) {
      nextState = spawnResult.state;
      spawned = spawnResult.visitor;
    }

    // 4. Persistance unique
    applyAubergeToFarmData(farmData, nextState, now);
    const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
    await vault.writeFile(file, serializeFarmProfile(profileName, farmData));
    await refreshFarm(profileId);

    return { spawned, expired };
  }, [vault, profiles, applyAubergeToFarmData, refreshFarm]);

  // ─── forceSpawn — debug helper (bypass shouldSpawn / cooldown) ──────────
  // Utilisé par le bouton __DEV__ "Forcer un visiteur" de l'AubergeSheet.
  // Ne consulte PAS shouldSpawnVisitor : appelle engineSpawn directement
  // pour permettre le test E2E sans attendre les conditions naturelles.
  // Note : engineSpawn vérifie lui-même shouldSpawnVisitor en interne (cap stade,
  // cooldown 6h). Pour un vrai bypass debug, on contourne via construction manuelle
  // du nouvel état si engineSpawn refuse à cause du cooldown — mais on respecte
  // le cap stade (graine = 0 visiteur, on retourne null).
  const forceSpawn = useCallback(async (profileId: string): Promise<ActiveVisitor | null> => {
    if (!vault) return null;

    const file = farmFile(profileId);
    const content = await vault.readFile(file).catch(() => '');
    const farmData = parseFarmProfile(content);

    const currentState = parseAuberge({
      visitors: farmData.auberge_visitors,
      reputations: farmData.auberge_reputations,
      lastSpawn: farmData.auberge_last_spawn,
      totalDeliveries: farmData.auberge_total_deliveries,
    });

    const profile = profiles.find(p => p.id === profileId);
    const level = profile?.level ?? 1;
    const treeStage = getTreeStageInfo(level).stage;

    const now = new Date();
    const totalRep = engineGetTotalReputation(currentState);

    // Bypass cooldown global : on temporairement vide lastSpawnAt pour forcer
    // shouldSpawnVisitor à passer (le cap stade reste vérifié — graine = 0 = null)
    const stateForBypass: AubergeState = {
      ...currentState,
      lastSpawnAt: undefined,
    };

    const result = engineSpawn(stateForBypass, treeStage, now, totalRep);
    if (!result) return null;

    // Reconstruire le nouvel état en réinjectant les reputations actualisées
    // et le visiteur, mais en se basant sur l'état d'origine pour ne pas perdre
    // les autres données (tout est déjà géré par engineSpawn qui spread state).
    applyAubergeToFarmData(farmData, result.state, now);
    const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
    await vault.writeFile(file, serializeFarmProfile(profileName, farmData));
    await refreshFarm(profileId);

    return result.visitor;
  }, [vault, profiles, applyAubergeToFarmData, refreshFarm]);

  return {
    visitors,
    activeVisitors,
    reputations,
    totalDeliveries,
    totalReputation,
    deliverVisitor,
    dismissVisitor,
    tickAuberge,
    forceSpawn,
  };
}
