/**
 * tickAubergeAuto — orchestrateur fire-and-forget Phase 46.
 *
 * Appelé depuis useVault.ts (launch + task complete) — Plan 46-02.
 * Lit le profil ferme, expire les visiteurs périmés (cancel notifs),
 * tente un spawn (schedule notifs), persiste l'état Auberge en 1 seul
 * writeFile farm.
 *
 * Ne throw JAMAIS. Si vault indisponible ou profil introuvable → no-op.
 * Idempotent : le cooldown 6h global du moteur empêche le re-spawn.
 */
import type { VaultManager } from '../vault';
import type { Profile } from '../types';
import { parseFarmProfile, serializeFarmProfile } from '../parser';
import {
  parseAuberge,
  serializeAuberge,
  expireVisitors as engineExpire,
  spawnVisitor as engineSpawn,
  getTotalReputation as engineGetTotalReputation,
} from '../mascot/auberge-engine';
import { getTreeStageInfo } from '../mascot/engine';
import { VISITOR_CATALOG } from '../mascot/visitor-catalog';
import {
  scheduleAubergeVisitorArrival,
  scheduleAubergeVisitorReminder,
  cancelAubergeVisitorNotifs,
} from '../scheduled-notifications';

export interface AutoTickDeps {
  vault: VaultManager;
  profiles: Profile[];
}

export async function tickAubergeAuto(
  profileId: string,
  deps: AutoTickDeps,
): Promise<void> {
  try {
    const { vault, profiles } = deps;
    if (!vault) return;
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    const file = `farm-${profileId}.md`;
    const content = await vault.readFile(file).catch(() => '');
    const farmData = parseFarmProfile(content);

    const currentState = parseAuberge({
      visitors: farmData.auberge_visitors,
      reputations: farmData.auberge_reputations,
      lastSpawn: farmData.auberge_last_spawn,
      totalDeliveries: farmData.auberge_total_deliveries,
    });

    const now = new Date();

    // 1. Expire (cancel notifs des expirés)
    const expireResult = engineExpire(currentState, now);
    let nextState = expireResult.state;
    for (const exp of expireResult.expired) {
      await cancelAubergeVisitorNotifs(exp.instanceId).catch(() => {});
    }

    // 2. Tente spawn
    const treeStage = getTreeStageInfo(profile.level ?? 1).stage;
    const totalRep = engineGetTotalReputation(nextState);
    const spawnResult = engineSpawn(nextState, treeStage, now, totalRep);
    if (spawnResult) {
      nextState = spawnResult.state;
      const v = spawnResult.visitor;
      const def = VISITOR_CATALOG.find(d => d.id === v.visitorId);
      if (def) {
        const deadlineDate = new Date(v.deadlineAt);
        const hours = Math.max(
          1,
          Math.round((deadlineDate.getTime() - now.getTime()) / 3600000),
        );
        // Nom = labelKey i18n non branché Phase 46 → fallback def.id lisible
        const visitorName = humanizeVisitorId(def.id);
        await scheduleAubergeVisitorArrival(v.instanceId, visitorName, def.emoji, hours).catch(() => {});
        await scheduleAubergeVisitorReminder(v.instanceId, visitorName, def.emoji, deadlineDate).catch(() => {});
      }
    }

    // 3. Persist (1 seul writeFile)
    const serialized = serializeAuberge(nextState, now);
    farmData.auberge_visitors = serialized.visitors || undefined;
    farmData.auberge_reputations = serialized.reputations || undefined;
    farmData.auberge_last_spawn = serialized.lastSpawn;
    farmData.auberge_total_deliveries =
      serialized.totalDeliveries > 0 ? serialized.totalDeliveries : undefined;

    await vault.writeFile(file, serializeFarmProfile(profile.name, farmData));
  } catch (e) {
    if (__DEV__) console.warn('[tickAubergeAuto]', e);
  }
}

/** Convertit 'hugo_boulanger' → 'Hugo le boulanger' (fallback i18n absent). */
function humanizeVisitorId(id: string): string {
  const parts = id.split('_');
  if (parts.length === 0) return id;
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  if (parts.length === 1) return first;
  return `${first} ${parts.slice(1).join(' ')}`;
}
