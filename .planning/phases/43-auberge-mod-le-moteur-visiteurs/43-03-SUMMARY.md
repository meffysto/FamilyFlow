---
phase: 43-auberge-mod-le-moteur-visiteurs
plan: 03
subsystem: mascot/auberge-engine
tags: [auberge, engine, pure, jest, visitors, serialize, parse]
dependency_graph:
  requires:
    - "Plan 43-01 (types AubergeState/ActiveVisitor/VisitorReputation/VisitorRequestItem + VISITOR_CATALOG)"
    - "Plan 43-02 (4 chaînes opaques auberge_* dans FarmProfileData)"
  provides:
    - "lib/mascot/auberge-engine.ts → 12 fonctions API publique pures"
    - "serializeAuberge/parseAuberge (helpers persistance pour Plan 04)"
    - "estimatedSellValue exporté pour réutilisation potentielle"
  affects:
    - "Plan 43-04 (hook useAuberge) consomme spawnVisitor/deliverVisitor/dismissVisitor/expireVisitors + serialize/parse"
tech_stack:
  added: []
  patterns:
    - "Moteur 100% pur (sans React, Expo, FS) — pattern expedition-engine.ts/building-engine.ts"
    - "Injection now/rng pour tests déterministes (pattern companion-feed.test.ts)"
    - "CSV plat pour reputations (pattern building-engine.ts:33), JSON-escape ||/§ pour visitors (pattern farm-engine.ts:228)"
    - "Archive auto +7j filtrée à serialize, totalDeliveries indépendant (Pitfall 8)"
key_files:
  created:
    - "lib/mascot/auberge-engine.ts (692 lignes — 12 fonctions API + 3 helpers privés + 2 persistance)"
    - "lib/__tests__/auberge-engine.test.ts (620 lignes, 45 tests Jest)"
  modified: []
decisions:
  - "Format auberge_visitors : JSON.stringify + escape `,`→`|` puis `:`→`§`, séparateur `||` (double pipe) entre visiteurs — évite tout conflit avec `|` post-escape interne, supporte les request[] imbriqués sans hand-rolling de parser"
  - "Format auberge_reputations : CSV plat `visitorId:level:successCount:failureCount:lastSeenAt` séparateur `|`, ISO reconstitué par `slice(4).join(':')` (Pitfall 1)"
  - "dismissVisitor → mise à jour de state.lastSpawnAt = now (note plan-checker #1) ET reputation.lastSeenAt — honore le cooldown 6h global même sur refus"
  - "serializeAuberge accepte `now: Date = new Date()` injectable (note plan-checker #2) pour tests déterministes du filtre archive +7j"
  - "Loot roll : silent skip explicite si `preferredLoot` absent ou vide (note plan-checker #3) — branche typée, pas de fallthrough"
  - "Types FarmInventory/HarvestInventory/CraftedItem importés depuis types.ts (vérifié note plan-checker #4) ; CraftedItem.recipeId utilisé pour comptage"
  - "STAGE_ORDER : réutilisation directe de TREE_STAGE_ORDER (lib/mascot/types.ts:470) via `indexOf` — pas de duplication (note plan-checker #5)"
  - "estimatedSellValue dispatche sur source : 'crop' → getEffectiveHarvestReward (farm-engine.ts:277), 'building' → BUILDING_RESOURCE_VALUE (craft-engine.ts:27), 'crafted' → CRAFT_RECIPES.find().sellValue (note plan-checker #6)"
  - "UUID : `vis_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` (convention codebase, note plan-checker #7)"
  - "pickWeighted<T> avec rng injectable (signature `(items: T[], weight: (t: T) => number, rng?: () => number) => T | null`) (note plan-checker #8)"
metrics:
  duration: "~12 min"
  completed_date: "2026-04-29"
  tasks: 2
  files: 2
  tests_added: 45
---

# Phase 43 Plan 03 : Moteur pur Auberge — Summary

**One-liner :** Moteur 100% pur `lib/mascot/auberge-engine.ts` livre les 12 fonctions verrouillées par CONTEXT.md (spawn/deliver/dismiss/expire + lectures) plus serialize/parse pour les chaînes opaques du Plan 02 — 45 tests Jest verts couvrent spawn, deliver, dismiss, expire, round-trip persistance, et les 9 pitfalls du RESEARCH.

## Tasks Completed

| # | Task | Commit  | Files |
|---|------|---------|-------|
| 1 | Implémenter `auberge-engine.ts` (12 fonctions + serialize/parse) | `5d6e58f` | lib/mascot/auberge-engine.ts |
| 2 | Suite Jest `auberge-engine.test.ts` (45 tests) | `43d772d` | lib/__tests__/auberge-engine.test.ts |

## API publique — 12 fonctions verrouillées (+ helpers persistance)

```typescript
// Eligibilité & spawn
export function getEligibleVisitors(state, treeStage, totalReputation, now?): VisitorDefinition[];
export function shouldSpawnVisitor(state, now, treeStage): boolean;
export function spawnVisitor(state, treeStage, now, totalReputation, rng?): { state, visitor } | null;

// Livraison / refus / expiration
export function canDeliver(visitor, inventory, harvestInv, craftedItems): { ok, missing };
export function getRemainingMinutes(visitor, now?): number;
export function getActiveVisitors(state, now?): ActiveVisitor[];
export function deliverVisitor(state, instanceId, inventories, now, rng?): { state, deductedItems, reward, reputationDelta: 1 } | null;
export function dismissVisitor(state, instanceId, now): { state };
export function expireVisitors(state, now): { state, expired };

// Lectures
export function getReputation(state, visitorId): number;
export function getTotalReputation(state): number;
export function isVisitorUnlocked(visitorId, state, treeStage): boolean;

// Bonus exporté + persistance
export function estimatedSellValue(item: VisitorRequestItem): number;
export function serializeAuberge(state, now?): { visitors, reputations, lastSpawn?, totalDeliveries };
export function parseAuberge({ visitors?, reputations?, lastSpawn?, totalDeliveries? }): AubergeState;
```

## Constantes module (verrouillées)

| Constante | Valeur | Source |
|-----------|--------|--------|
| `SPAWN_COOLDOWN_MS` | 6h | CONTEXT.md |
| `NPC_COOLDOWN_MS` | 24h | CONTEXT.md |
| `ARCHIVE_DAYS_MS` | 7j | CONTEXT.md |
| `REPUTATION_CAP` | 5 | CONTEXT.md |
| `REPUTATION_FLOOR` | 0 | CONTEXT.md (Pitfall 2) |
| `CAP_BY_STAGE` | graine:0, pousse:1, arbuste:2, arbre/majestueux/legendaire:3 | CONTEXT.md |
| `RARITY_BONUS` | common:1.0, uncommon:1.15, rare:1.4 | CONTEXT.md |
| `LOOT_CHANCE` | common:0.08, uncommon:0.18, rare:0.35 | CONTEXT.md |
| `RARITY_WEIGHT` | common:5, uncommon:3, rare:1 | Inverse de rareté |

## Format CSV final retenu

### `auberge_reputations` — CSV plat (pattern building-engine.ts)

```
visitorId:level:successCount:failureCount:lastSeenAt|visitorId2:...
```
Exemple : `hugo_boulanger:3:3:0:2026-04-28T10:30:00.000Z|meme_lucette:2:2:0:2026-04-29T08:15:00.000Z`

L'ISO date contient `:` → reconstruction au parse via `slice(4).join(':')` (Pitfall 1).

### `auberge_visitors` — JSON-escape avec séparateur `||`

```
<json-escape>||<json-escape>||...
```

Chaque visiteur est encodé `JSON.stringify(v).replace(/,/g, '|').replace(/:/g, '§')`. Le séparateur entre visiteurs est `||` (double pipe) — pas de conflit avec les `|` internes post-escape.

**Rationale** : `request: VisitorRequestItem[]` est trop imbriqué pour CSV plat propre. JSON-stringify garde la fidélité, le double-escape rend la chaîne mono-ligne markdown-safe. Pattern direct de `farm-engine.ts:228` (encodeModifiers).

## Plan-Checker Notes Addressed (8/8)

| # | Note | Résolution |
|---|------|------------|
| 1 | dismissVisitor cooldown 6h | `state.lastSpawnAt = now.toISOString()` ajouté à dismissVisitor (l. 437) |
| 2 | serializeAuberge `now` injectable | Signature `serializeAuberge(state, now: Date = new Date())` (l. 632) |
| 3 | Loot roll silent skip | Branche explicite `if (def.preferredLoot && def.preferredLoot.length > 0)` puis return early sans loot |
| 4 | Type imports vérifiés | `FarmInventory`, `HarvestInventory`, `CraftedItem` importés depuis `./types` (l. 17-19), shape vérifiée à types.ts:399/486/505 |
| 5 | STAGE_ORDER explicite | Réutilisation `TREE_STAGE_ORDER` de types.ts:470 via `indexOf` (helper privé `stageAtLeast`) |
| 6 | estimatedSellValue dispatch | Switch sur `item.source` : crop → getEffectiveHarvestReward, building → BUILDING_RESOURCE_VALUE, crafted → CRAFT_RECIPES.find().sellValue |
| 7 | UUID convention | `vis_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` (helper `generateInstanceId`) |
| 8 | pickWeighted déterministe | Signature `pickWeighted<T>(items, weight, rng = Math.random)` exposée aux fonctions internes (spawnVisitor accepte aussi rng injectable) |

## Pitfalls Couverts (1-9)

| # | Pitfall | Couvert par |
|---|---------|-------------|
| 1 | ISO `:` dans CSV | `decodeReputation` → `parts.slice(4).join(':')` |
| 2 | Réputation négative | `Math.max(REPUTATION_FLOOR, ...)` dans `upsertReputationOnFailure` (test "expire -1 floor 0") |
| 3 | Snapshot reward au mauvais moment | `rewardCoins` calculé dans `spawnVisitor`, jamais recalculé dans `deliverVisitor` |
| 4 | getEligibleVisitors filtre déjà-actifs | `activeIds` set construit au début de `getEligibleVisitors` (test "exclut un visiteur déjà actif") |
| 5 | getActiveVisitors silencieux | Filtre `now < new Date(deadlineAt).getTime()` (test "exclut visiteurs deadline passée non tickté") |
| 6 | PNJ catalogue inconnu | `decodeVisitor` retourne null si VISITOR_CATALOG.find absent (test "Pitfall 6") |
| 7 | Test fragile à Date.now() | `now: Date = new Date()` injectable dans toutes fonctions time-bounded |
| 8 | Archive auto +7j double-count | `totalDeliveries` indépendant du tableau, jamais dérivé (test "archive auto +7j") |
| 9 | Bumper CACHE_VERSION par erreur | Aucune modif `lib/vault-cache.ts` (vérifié — non touché en Plan 03) |

## Output Tests Jest (45/45 verts)

```
Test Suites: 1 passed, 1 total
Tests:       45 passed, 45 total
Snapshots:   0 total
Time:        2.071 s
```

Décomposition par axe :
- shouldSpawnVisitor — cooldown global 6h : 4 tests
- shouldSpawnVisitor — cap actifs : 3 tests
- getEligibleVisitors — anti-spam / déjà-actif / stade : 4 tests
- isVisitorUnlocked — gating Comtesse : 3 tests
- spawnVisitor : 3 tests
- canDeliver / deliverVisitor : 5 tests
- dismissVisitor : 3 tests
- expireVisitors : 3 tests
- getActiveVisitors — Pitfall 5 : 3 tests
- getRemainingMinutes : 2 tests
- estimatedSellValue — dispatch source : 4 tests
- getReputation / getTotalReputation : 2 tests
- Round-trip serializeAuberge / parseAuberge : 6 tests

## Deviations from Plan

None — plan exécuté exactement comme écrit. La seule décision discrétionnaire (format CSV) suit la recommandation du RESEARCH §Open Question 1 et est documentée ci-dessus avec rationale.

## Verification

- `npx tsc --noEmit` : **0 erreur** (baseline 0, post-plan 0).
- `npx jest lib/__tests__/auberge-engine.test.ts --no-coverage` : **45/45 verts**.
- Aucun import React/Expo/expo-*/fs dans `auberge-engine.ts` (vérifié grep).
- 12 fonctions publiques + serialize/parse + estimatedSellValue tous exportés (grep).

## Self-Check: PASSED

- [x] `lib/mascot/auberge-engine.ts` créé : FOUND (15 `export function` détectés)
- [x] `lib/__tests__/auberge-engine.test.ts` créé : FOUND (45 tests Jest)
- [x] Commit `5d6e58f` (Task 1) : FOUND dans git log
- [x] Commit `43d772d` (Task 2) : FOUND dans git log
- [x] tsc clean (0 erreur, baseline 0)
- [x] Aucun import React/Expo/fs dans auberge-engine.ts
