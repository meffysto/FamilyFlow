/**
 * Moteur pur Auberge (Phase 43).
 *
 * 100% pur : sans React, sans I/O, sans dépendance vault.
 * Toutes les fonctions retournent un nouvel état (immutable) — jamais de mutation in-place.
 * Toutes les fonctions time-bounded acceptent `now: Date = new Date()` injectable (testabilité).
 *
 * Voir .planning/phases/43-auberge-mod-le-moteur-visiteurs/43-CONTEXT.md pour les règles.
 * Pitfalls référencés : voir 43-RESEARCH.md §Pitfalls 1-9.
 */
import type {
  AubergeState,
  ActiveVisitor,
  VisitorRequestItem,
  VisitorReputation,
  TreeStage,
  FarmInventory,
  HarvestInventory,
  CraftedItem,
  ResourceType,
} from './types';
import { TREE_STAGE_ORDER } from './types';
import type { VisitorDefinition } from './visitor-catalog';
import { VISITOR_CATALOG } from './visitor-catalog';
import { getEffectiveHarvestReward } from './farm-engine';
import { countItemTotal } from './grade-engine';
import { BUILDING_RESOURCE_VALUE, CRAFT_RECIPES } from './craft-engine';

// ─────────────────────────────────────────────
// Constantes module
// ─────────────────────────────────────────────

const SPAWN_COOLDOWN_MS = 6 * 60 * 60 * 1000;       // 6h cooldown global
const NPC_COOLDOWN_MS = 24 * 60 * 60 * 1000;        // 24h anti-spam même PNJ
const ARCHIVE_DAYS_MS = 7 * 24 * 60 * 60 * 1000;    // archive auto après 7j
const REPUTATION_CAP = 5;                            // niveau max par PNJ
const REPUTATION_FLOOR = 0;                          // niveau min par PNJ

/** Cap actifs simultanés selon le stade d'arbre. */
const CAP_BY_STAGE: Record<TreeStage, number> = {
  graine: 0,
  pousse: 1,
  arbuste: 2,
  arbre: 3,
  majestueux: 3,
  legendaire: 3,
};

/** Bonus de récompense selon la rareté du visiteur. */
const RARITY_BONUS: Record<'common' | 'uncommon' | 'rare', number> = {
  common: 1.0,
  uncommon: 1.15,
  rare: 1.4,
};

/** Probabilité de drop d'un loot rare à la livraison. */
const LOOT_CHANCE: Record<'common' | 'uncommon' | 'rare', number> = {
  common: 0.08,
  uncommon: 0.18,
  rare: 0.35,
};

/** Poids de tirage au spawn — inverse de rareté (les communs apparaissent plus). */
const RARITY_WEIGHT: Record<'common' | 'uncommon' | 'rare', number> = {
  common: 5,
  uncommon: 3,
  rare: 1,
};

// ─────────────────────────────────────────────
// Helpers privés
// ─────────────────────────────────────────────

/** UUID convention codebase (wear-engine.ts:60, gamification/engine.ts:304). */
function generateInstanceId(): string {
  return `vis_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Tirage pondéré générique. `rng` injectable pour tests déterministes.
 * Retourne null si liste vide ou somme des poids ≤ 0.
 */
function pickWeighted<T>(
  items: T[],
  weight: (item: T) => number,
  rng: () => number = Math.random,
): T | null {
  if (items.length === 0) return null;
  const weights = items.map(weight);
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/** randint inclusif [min, max] avec rng injectable. */
function randInt(min: number, max: number, rng: () => number = Math.random): number {
  if (max < min) return min;
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Estime le sellValue unitaire d'un item demandé, dispatch sur la source.
 * - 'crop'     → CROP_CATALOG.harvestReward (via getEffectiveHarvestReward)
 * - 'building' → BUILDING_RESOURCE_VALUE (oeuf=80, lait=100, farine=90, miel=120)
 * - 'crafted'  → CRAFT_RECIPES.sellValue
 */
export function estimatedSellValue(item: VisitorRequestItem): number {
  switch (item.source) {
    case 'crop':
      return getEffectiveHarvestReward(item.itemId);
    case 'building':
      return (BUILDING_RESOURCE_VALUE as Record<string, number>)[item.itemId] ?? 0;
    case 'crafted': {
      const recipe = CRAFT_RECIPES.find(r => r.id === item.itemId);
      return recipe?.sellValue ?? 0;
    }
    default:
      return 0;
  }
}

/** Compare deux stades d'arbre via TREE_STAGE_ORDER (ordre canonique). */
function stageAtLeast(actual: TreeStage, required: TreeStage): boolean {
  return TREE_STAGE_ORDER.indexOf(actual) >= TREE_STAGE_ORDER.indexOf(required);
}

/** Compte les CraftedItem matchant un recipeId. */
function countCrafted(craftedItems: CraftedItem[], recipeId: string): number {
  let n = 0;
  for (const c of craftedItems) {
    if (c.recipeId === recipeId) n++;
  }
  return n;
}

/** Compte une ressource bâtiment dans FarmInventory (oeuf|lait|farine|miel). */
function countBuildingResource(inventory: FarmInventory, itemId: string): number {
  if (itemId === 'oeuf' || itemId === 'lait' || itemId === 'farine' || itemId === 'miel') {
    return inventory[itemId as ResourceType] ?? 0;
  }
  return 0;
}

/** Lit la quantité disponible pour un item, dispatch source. */
function availableQuantity(
  item: VisitorRequestItem,
  inventory: FarmInventory,
  harvestInv: HarvestInventory,
  craftedItems: CraftedItem[],
): number {
  switch (item.source) {
    case 'building':
      return countBuildingResource(inventory, item.itemId);
    case 'crop':
      return countItemTotal(harvestInv, item.itemId);
    case 'crafted':
      return countCrafted(craftedItems, item.itemId);
    default:
      return 0;
  }
}

// ─────────────────────────────────────────────
// API publique — Eligibilité & spawn
// ─────────────────────────────────────────────

/**
 * Visiteurs éligibles au spawn — filtre par stade min, gating réputation totale,
 * cooldown anti-spam 24h par PNJ, et exclusion des visiteurs déjà actifs (Pitfall 4).
 *
 * NE regarde PAS l'inventaire courant (CONTEXT.md verrouille).
 */
export function getEligibleVisitors(
  state: AubergeState,
  treeStage: TreeStage,
  totalReputation: number,
  now: Date = new Date(),
): VisitorDefinition[] {
  const nowMs = now.getTime();
  // IDs actuellement actifs — exclus pour éviter doublons (Pitfall 4)
  const activeIds = new Set(
    state.visitors
      .filter(v => v.status === 'active' && nowMs < new Date(v.deadlineAt).getTime())
      .map(v => v.visitorId),
  );

  return VISITOR_CATALOG.filter(def => {
    // Stade min
    if (!stageAtLeast(treeStage, def.minTreeStage)) return false;
    // Gating réputation totale
    if ((def.unlockMinReputation ?? 0) > totalReputation) return false;
    // Pas déjà actif
    if (activeIds.has(def.id)) return false;
    // Cooldown PNJ 24h
    const rep = state.reputations.find(r => r.visitorId === def.id);
    if (rep && rep.lastSeenAt) {
      const last = new Date(rep.lastSeenAt).getTime();
      if (nowMs - last < NPC_COOLDOWN_MS) return false;
    }
    return true;
  });
}

/**
 * Vrai si on peut spawn un visiteur maintenant :
 * - cooldown global 6h respecté
 * - cap actifs simultanés (1/2/3 selon stade) non atteint
 */
export function shouldSpawnVisitor(
  state: AubergeState,
  now: Date,
  treeStage: TreeStage,
): boolean {
  const cap = CAP_BY_STAGE[treeStage] ?? 0;
  if (cap <= 0) return false;
  const active = getActiveVisitors(state, now);
  if (active.length >= cap) return false;
  if (state.lastSpawnAt) {
    const last = new Date(state.lastSpawnAt).getTime();
    if (now.getTime() - last < SPAWN_COOLDOWN_MS) return false;
  }
  return true;
}

/**
 * Tire un visiteur éligible et instancie un ActiveVisitor.
 * - Pondération inverse de rareté (commun > uncommon > rare).
 * - Tire un template du `requestPool` pondéré, résout les quantités random [min,max].
 * - Snapshot `rewardCoins` au spawn (Pitfall 3) — jamais recalculé.
 *
 * Retourne null si shouldSpawnVisitor false ou aucun candidat éligible.
 *
 * `rng` injectable pour tests déterministes (defaults Math.random).
 */
export function spawnVisitor(
  state: AubergeState,
  treeStage: TreeStage,
  now: Date,
  totalReputation: number,
  rng: () => number = Math.random,
): { state: AubergeState; visitor: ActiveVisitor } | null {
  if (!shouldSpawnVisitor(state, now, treeStage)) return null;

  const eligible = getEligibleVisitors(state, treeStage, totalReputation, now);
  if (eligible.length === 0) return null;

  // Tirage visiteur pondéré inverse rareté
  const def = pickWeighted(eligible, v => RARITY_WEIGHT[v.rarity], rng);
  if (!def) return null;

  // Tirage template
  const tpl = pickWeighted(def.requestPool, t => t.weight, rng);
  if (!tpl) return null;

  // Résolution des quantités
  const request: VisitorRequestItem[] = tpl.items.map(it => ({
    itemId: it.itemId,
    source: it.source,
    quantity: randInt(it.quantity[0], it.quantity[1], rng),
  }));

  // Calcul reward (snapshot)
  const baseValue = request.reduce((sum, it) => sum + it.quantity * estimatedSellValue(it), 0);
  const rewardCoins = Math.round(baseValue * def.rewardMultiplier * RARITY_BONUS[def.rarity]);

  // Deadline absolue
  const deadlineAt = new Date(now.getTime() + def.deadlineHours * 60 * 60 * 1000).toISOString();
  const arrivedAt = now.toISOString();

  const visitor: ActiveVisitor = {
    visitorId: def.id,
    instanceId: generateInstanceId(),
    arrivedAt,
    deadlineAt,
    request,
    status: 'active',
    rewardCoins,
    lootChance: LOOT_CHANCE[def.rarity],
  };

  // Met à jour reputation.lastSeenAt (créer si absent)
  const reputations = upsertReputationLastSeen(state.reputations, def.id, arrivedAt);

  const newState: AubergeState = {
    ...state,
    visitors: [...state.visitors, visitor],
    reputations,
    lastSpawnAt: arrivedAt,
  };

  return { state: newState, visitor };
}

// ─────────────────────────────────────────────
// API publique — Livraison / refus / expiration
// ─────────────────────────────────────────────

/**
 * Vérifie si l'inventaire combiné permet de livrer le visiteur.
 * Retourne la liste des items manquants (avec qty manquante).
 */
export function canDeliver(
  visitor: ActiveVisitor,
  inventory: FarmInventory,
  harvestInv: HarvestInventory,
  craftedItems: CraftedItem[],
): { ok: boolean; missing: VisitorRequestItem[] } {
  const missing: VisitorRequestItem[] = [];
  for (const item of visitor.request) {
    const have = availableQuantity(item, inventory, harvestInv, craftedItems);
    if (have < item.quantity) {
      missing.push({
        itemId: item.itemId,
        source: item.source,
        quantity: item.quantity - have,
      });
    }
  }
  return { ok: missing.length === 0, missing };
}

/** Minutes restantes avant deadline (0 si déjà passé). */
export function getRemainingMinutes(visitor: ActiveVisitor, now: Date = new Date()): number {
  const dl = new Date(visitor.deadlineAt).getTime();
  if (now.getTime() >= dl) return 0;
  return Math.ceil((dl - now.getTime()) / 60000);
}

/**
 * Visiteurs visibles UI — actifs ET deadline non encore passée (Pitfall 5 silencieux).
 * `expireVisitors` est lazy : un actif dont la deadline est passée mais pas encore tickté
 * est filtré ici pour éviter l'écran "livrer" trompeur.
 */
export function getActiveVisitors(state: AubergeState, now: Date = new Date()): ActiveVisitor[] {
  const nowMs = now.getTime();
  return state.visitors.filter(
    v => v.status === 'active' && nowMs < new Date(v.deadlineAt).getTime(),
  );
}

/**
 * Tente la livraison. Retourne `null` si non livrable (canDeliver false).
 * Sinon : marque status='delivered', +1 réputation (cap 5), +1 totalDeliveries,
 * roll loot selon rarity. `deductedItems` retourne les items à déduire — la déduction
 * sur farm/harvest/crafted est faite par le hook (pas le moteur pur).
 */
export function deliverVisitor(
  state: AubergeState,
  instanceId: string,
  inventories: { farm: FarmInventory; harvest: HarvestInventory; crafted: CraftedItem[] },
  now: Date,
  rng: () => number = Math.random,
): {
  state: AubergeState;
  deductedItems: VisitorRequestItem[];
  reward: { coins: number; loot?: string };
  reputationDelta: 1;
} | null {
  const visitor = state.visitors.find(v => v.instanceId === instanceId);
  if (!visitor) return null;
  if (visitor.status !== 'active') return null;

  // Vérifier deadline non passée
  if (now.getTime() >= new Date(visitor.deadlineAt).getTime()) return null;

  // Vérifier inventaire suffisant
  const check = canDeliver(visitor, inventories.farm, inventories.harvest, inventories.crafted);
  if (!check.ok) return null;

  const def = VISITOR_CATALOG.find(d => d.id === visitor.visitorId);

  // Roll loot — uniquement si visiteur a un preferredLoot non vide
  let lootKey: string | undefined;
  if (def && def.preferredLoot && def.preferredLoot.length > 0) {
    if (rng() < LOOT_CHANCE[def.rarity]) {
      const idx = Math.floor(rng() * def.preferredLoot.length);
      lootKey = def.preferredLoot[Math.min(idx, def.preferredLoot.length - 1)];
    }
  }
  // Si pas de preferredLoot : pas de loot — silent skip explicite (note plan-checker #3).

  // Mutation immuable des visiteurs : marque celui-ci delivered
  const visitors = state.visitors.map(v =>
    v.instanceId === instanceId
      ? { ...v, status: 'delivered' as const, rewardLootKey: lootKey }
      : v,
  );

  // Réputation : +1 cap 5, +1 successCount
  const reputations = upsertReputationOnSuccess(state.reputations, visitor.visitorId, now);

  const newState: AubergeState = {
    ...state,
    visitors,
    reputations,
    totalDeliveries: state.totalDeliveries + 1,
  };

  return {
    state: newState,
    deductedItems: visitor.request.map(it => ({ ...it })),
    reward: { coins: visitor.rewardCoins, ...(lootKey ? { loot: lootKey } : {}) },
    reputationDelta: 1,
  };
}

/**
 * Refuse le visiteur sans pénalité réputation.
 * Met à jour `lastSpawnAt` (cooldown global 6h, cf. note plan-checker #1)
 * et `reputation.lastSeenAt` (anti-spam PNJ 24h).
 */
export function dismissVisitor(
  state: AubergeState,
  instanceId: string,
  now: Date,
): { state: AubergeState } {
  const visitor = state.visitors.find(v => v.instanceId === instanceId);
  if (!visitor) return { state };

  // Retire le visiteur du tableau opérationnel (CONTEXT.md ne précise pas — on retire pour ne pas polluer)
  const visitors = state.visitors.filter(v => v.instanceId !== instanceId);

  // Met à jour lastSeenAt du PNJ (cooldown spawn 24h)
  const reputations = upsertReputationLastSeen(state.reputations, visitor.visitorId, now.toISOString());

  return {
    state: {
      ...state,
      visitors,
      reputations,
      lastSpawnAt: now.toISOString(),
    },
  };
}

/**
 * Ticke les visiteurs expirés (deadline dépassée mais encore status='active').
 * Pour chacun : status='expired', −1 réputation (floor 0), +1 failureCount.
 */
export function expireVisitors(
  state: AubergeState,
  now: Date,
): { state: AubergeState; expired: ActiveVisitor[] } {
  const nowMs = now.getTime();
  const expired: ActiveVisitor[] = [];
  const visitors = state.visitors.map(v => {
    if (v.status === 'active' && nowMs >= new Date(v.deadlineAt).getTime()) {
      const updated: ActiveVisitor = { ...v, status: 'expired' };
      expired.push(updated);
      return updated;
    }
    return v;
  });

  // Décrémente réputation pour chaque expiré
  let reputations = state.reputations;
  for (const exp of expired) {
    reputations = upsertReputationOnFailure(reputations, exp.visitorId, now);
  }

  return {
    state: { ...state, visitors, reputations },
    expired,
  };
}

// ─────────────────────────────────────────────
// API publique — Lectures
// ─────────────────────────────────────────────

export function getReputation(state: AubergeState, visitorId: string): number {
  const rep = state.reputations.find(r => r.visitorId === visitorId);
  return rep?.level ?? 0;
}

export function getTotalReputation(state: AubergeState): number {
  return state.reputations.reduce((sum, r) => sum + r.level, 0);
}

/**
 * Vrai si le visiteur est débloqué pour ce stade et la réputation totale courante.
 * Comtesse : `unlockMinReputation: 15` → bloqué tant que totalReputation < 15.
 */
export function isVisitorUnlocked(
  visitorId: string,
  state: AubergeState,
  treeStage: TreeStage,
): boolean {
  const def = VISITOR_CATALOG.find(d => d.id === visitorId);
  if (!def) return false;
  if (!stageAtLeast(treeStage, def.minTreeStage)) return false;
  const total = getTotalReputation(state);
  if ((def.unlockMinReputation ?? 0) > total) return false;
  return true;
}

// ─────────────────────────────────────────────
// Helpers réputation (privés)
// ─────────────────────────────────────────────

function upsertReputationLastSeen(
  reputations: VisitorReputation[],
  visitorId: string,
  iso: string,
): VisitorReputation[] {
  const idx = reputations.findIndex(r => r.visitorId === visitorId);
  if (idx === -1) {
    return [
      ...reputations,
      { visitorId, level: 0, successCount: 0, failureCount: 0, lastSeenAt: iso },
    ];
  }
  const next = [...reputations];
  next[idx] = { ...next[idx], lastSeenAt: iso };
  return next;
}

function upsertReputationOnSuccess(
  reputations: VisitorReputation[],
  visitorId: string,
  now: Date,
): VisitorReputation[] {
  const idx = reputations.findIndex(r => r.visitorId === visitorId);
  const iso = now.toISOString();
  if (idx === -1) {
    return [
      ...reputations,
      { visitorId, level: 1, successCount: 1, failureCount: 0, lastSeenAt: iso },
    ];
  }
  const cur = reputations[idx];
  const next = [...reputations];
  next[idx] = {
    ...cur,
    level: Math.min(REPUTATION_CAP, cur.level + 1),
    successCount: cur.successCount + 1,
    lastSeenAt: iso,
  };
  return next;
}

function upsertReputationOnFailure(
  reputations: VisitorReputation[],
  visitorId: string,
  now: Date,
): VisitorReputation[] {
  const idx = reputations.findIndex(r => r.visitorId === visitorId);
  const iso = now.toISOString();
  if (idx === -1) {
    return [
      ...reputations,
      { visitorId, level: REPUTATION_FLOOR, successCount: 0, failureCount: 1, lastSeenAt: iso },
    ];
  }
  const cur = reputations[idx];
  const next = [...reputations];
  next[idx] = {
    ...cur,
    level: Math.max(REPUTATION_FLOOR, cur.level - 1),
    failureCount: cur.failureCount + 1,
    lastSeenAt: iso,
  };
  return next;
}

// ─────────────────────────────────────────────
// Persistance — serialize / parse
// ─────────────────────────────────────────────
//
// Format choisi (Claude's Discretion, RESEARCH §Open Question 1) :
// - `auberge_reputations` : CSV plat
//     `visitorId:level:successCount:failureCount:lastSeenAt|...`
//     ISO contient `:` → reconstruction `slice(4).join(':')` au parse
//     (pattern building-engine.ts:74).
// - `auberge_visitors` : chaque visiteur encodé via JSON.stringify puis double-escape
//     `,` → `|` et `:` → `§` (pattern farm-engine.ts:228), séparateur entre
//     visiteurs `||` (double pipe) — évite tout conflit avec `|` interne post-escape.
// - Archive auto +7j : visiteurs `delivered`/`expired` avec `arrivedAt < now - 7j`
//     ne sont plus persistés. Le compteur `totalDeliveries` les agrège (Pitfall 8).

const VISITOR_FIELD_SEP = '||'; // double pipe entre visiteurs encodés

function encodeVisitor(v: ActiveVisitor): string {
  return JSON.stringify(v).replace(/,/g, '|').replace(/:/g, '§');
}

function decodeVisitor(raw: string): ActiveVisitor | null {
  if (!raw) return null;
  try {
    const restored = raw.replace(/§/g, ':').replace(/\|/g, ',');
    const parsed = JSON.parse(restored) as ActiveVisitor;
    // Validation minimale + filtre PNJ inconnu (Pitfall 6)
    if (!parsed.visitorId || !parsed.instanceId) return null;
    if (!VISITOR_CATALOG.find(d => d.id === parsed.visitorId)) return null;
    if (!Array.isArray(parsed.request)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function encodeReputation(r: VisitorReputation): string {
  return `${r.visitorId}:${r.level}:${r.successCount}:${r.failureCount}:${r.lastSeenAt}`;
}

function decodeReputation(raw: string): VisitorReputation | null {
  if (!raw) return null;
  const parts = raw.split(':');
  if (parts.length < 5) return null;
  const [visitorId, levelStr, successStr, failureStr, ...rest] = parts;
  const lastSeenAt = rest.join(':'); // reconstruit ISO (Pitfall 1)
  const level = parseInt(levelStr, 10);
  const successCount = parseInt(successStr, 10);
  const failureCount = parseInt(failureStr, 10);
  if (!visitorId || isNaN(level) || isNaN(successCount) || isNaN(failureCount)) return null;
  return { visitorId, level, successCount, failureCount, lastSeenAt };
}

/**
 * Sérialise l'AubergeState vers les 4 chaînes opaques persistées dans farm-{id}.md.
 * Filtre l'archive auto +7j : delivered/expired plus vieux que 7j ne sont plus persistés
 * (le compteur `totalDeliveries` les agrège, voir Pitfall 8).
 *
 * `now` injectable pour tests déterministes.
 */
export function serializeAuberge(
  state: AubergeState,
  now: Date = new Date(),
): {
  visitors: string;
  reputations: string;
  lastSpawn?: string;
  totalDeliveries: number;
} {
  const archiveCutoff = now.getTime() - ARCHIVE_DAYS_MS;

  // Filtre : on garde tous les actifs + delivered/expired récents (< 7j)
  const persistedVisitors = state.visitors.filter(v => {
    if (v.status === 'active') return true;
    const arrived = new Date(v.arrivedAt).getTime();
    return arrived >= archiveCutoff;
  });

  const visitors = persistedVisitors.map(encodeVisitor).join(VISITOR_FIELD_SEP);
  const reputations = state.reputations.map(encodeReputation).join('|');

  return {
    visitors,
    reputations,
    ...(state.lastSpawnAt ? { lastSpawn: state.lastSpawnAt } : {}),
    totalDeliveries: state.totalDeliveries,
  };
}

/**
 * Reconstruit un AubergeState depuis les 4 chaînes opaques.
 * Tolérant : visiteur avec `visitorId` introuvable au catalogue → filtré silencieusement (Pitfall 6).
 * Reputations malformées → ignorées.
 */
export function parseAuberge(serialized: {
  visitors?: string;
  reputations?: string;
  lastSpawn?: string;
  totalDeliveries?: number;
}): AubergeState {
  const visitors: ActiveVisitor[] = [];
  if (serialized.visitors && serialized.visitors.trim() !== '') {
    for (const chunk of serialized.visitors.split(VISITOR_FIELD_SEP)) {
      const v = decodeVisitor(chunk);
      if (v) visitors.push(v);
    }
  }

  const reputations: VisitorReputation[] = [];
  if (serialized.reputations && serialized.reputations.trim() !== '') {
    for (const chunk of serialized.reputations.split('|')) {
      const r = decodeReputation(chunk);
      if (r) reputations.push(r);
    }
  }

  return {
    visitors,
    reputations,
    ...(serialized.lastSpawn ? { lastSpawnAt: serialized.lastSpawn } : {}),
    totalDeliveries: typeof serialized.totalDeliveries === 'number' ? serialized.totalDeliveries : 0,
  };
}
