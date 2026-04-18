---
phase: 38-fondation-modifiers-conomie-spor-e
plan: 02
subsystem: mascot/economy
tags: [sporee, economy, drops, shop, pure-functions, jest]
requires:
  - lib/mascot/types.ts (CROP_CATALOG, TREE_STAGE_ORDER, TreeStage)
  - lib/types.ts (ExpeditionDifficulty)
provides:
  - lib/mascot/sporee-economy.ts (moteur pur économie Sporée)
  - lib/__tests__/sporee-economy.test.ts (44 tests Jest)
affects:
  - Plan 38-03 (câblage hooks useFarm/useExpeditions/useGamification)
tech-stack:
  added: []
  patterns:
    - "Math.random() + jest.spyOn pour rolls testables (pattern farm-engine)"
    - "Fonctions pures zéro I/O / zéro état / zéro UI"
    - "Validation via types discriminés (BuySporeeCheck ok/reason)"
key-files:
  created:
    - lib/mascot/sporee-economy.ts
    - lib/__tests__/sporee-economy.test.ts
  modified: []
decisions:
  - "Cap inventaire 10 strict : refus pur si plein (reason:inventory_full), zéro fallback feuilles — préserve Core Value bienveillance"
  - "Clamp partiel accepté sur tryIncrementSporeeCount(8,5) → newCount=10 (pas d'overflow, pas de refus total)"
  - "Reset quotidien via getLocalDateKey (getFullYear/getMonth/getDate) — LOCAL device, PAS UTC — évite décalage timezone"
  - "applyDailyResetIfNeeded déclenché avant check daily_cap dans canBuySporee → corrige state corrompu silencieusement"
  - "Priorité des checks dans canBuySporee : stage > inventory > daily_cap > coins (inventory_full prioritaire sur cap et coins)"
  - "rollSporeeDropOnExpedition court-circuite AVANT Math.random pour 'easy' — garantit zéro drop même avec RNG forcé"
  - "Import ExpeditionDifficulty depuis lib/types.ts (pas lib/mascot/expedition-engine.ts) — le type est dans le barrel global"
metrics:
  duration: "3min"
  completed: "2026-04-18"
  tasks: 2
  tests_added: 44
  tests_passed: 44
---

# Phase 38 Plan 02 : Moteur pur économie Sporée Summary

Moteur économique Sporée livré comme module purement fonctionnel (197 lignes) avec suite Jest exhaustive (44 tests couvrant drops aléatoires via jest.spyOn, cap inventaire, shop daily-reset, gate onboarding).

## Exports livrés (`lib/mascot/sporee-economy.ts`)

### Constantes (7)
- `SPOREE_MAX_INVENTORY = 10`
- `SPOREE_DROP_RATES = { base: 0.03, rare: 0.08, expedition: 0.15 }`
- `SPOREE_SHOP_PRICE = 400`
- `SPOREE_SHOP_DAILY_CAP = 2`
- `SPOREE_SHOP_MIN_TREE_STAGE: TreeStage = 'arbre'`
- `SPOREE_EXPEDITION_DROP_RATE = 0.05`
- `SPOREE_EXPEDITION_ELIGIBLE = ['pousse', 'medium', 'hard', 'expert', 'legendary']`

### Fonctions pures (8)
- `classifyHarvestTier(cropId) → HarvestTier` — lookup CROP_CATALOG
- `rollSporeeDropOnHarvest(tier) → boolean`
- `rollSporeeDropOnExpedition(difficulty) → boolean` (court-circuit 'easy')
- `tryIncrementSporeeCount(current, qty=1) → IncrementResult` (cap + clamp)
- `canBuySporee(opts) → BuySporeeCheck` (matrice validation + projection)
- `applyDailyResetIfNeeded(boughtToday, lastReset, today) → { boughtToday, lastResetDate }`
- `getLocalDateKey(d=new Date()) → 'YYYY-MM-DD'` (local, pas UTC)
- `shouldGiftOnboardingSporee(opts) → boolean` (gate arbuste→arbre)

### Types (5)
- `HarvestTier = 'base' | 'rare' | 'expedition'`
- `IncrementResult`
- `BuySporeeOpts`, `BuySporeeCheck`, `BuySporeeReason`
- `OnboardingGiftOpts`

## Décisions clés

### Overflow inventaire
**Cap strict 10 avec refus pur** (conforme 38-RESEARCH §9). Si `currentCount >= 10` : `{ accepted:false, reason:'inventory_full' }`. Zéro conversion en feuilles, zéro auto-spawn. Si `qty` pousse partiellement (ex. 8+5), on accepte avec clamp à 10 — le drop partiel est sauvé, l'excès perdu silencieusement.

### Reset quotidien minuit local
`getLocalDateKey` utilise `getFullYear/getMonth/getDate` (pas `toISOString()` UTC). Le reset s'applique dans `canBuySporee` via `applyDailyResetIfNeeded(boughtToday, lastResetDate, today)` AVANT le check `daily_cap` — cela répare tout state corrompu (ex. `boughtToday=5` d'un jour passé) silencieusement à la prochaine tentative d'achat.

### Court-circuit expedition 'easy'
`rollSporeeDropOnExpedition('easy')` retourne `false` sans appeler `Math.random()` — testé via spy qui vérifie `spy.not.toHaveBeenCalled()`. Garantit 0% strict même si RNG est forcé à 0.

## Tests Jest : 44/44 passed (1.77s)

| Describe | Tests | Focus |
|----------|-------|-------|
| Constantes | 4 | Valeurs exactes SPOR-08/SPOR-09 |
| classifyHarvestTier | 7 | base/rare/expedition/inconnu |
| rollSporeeDropOnHarvest | 6 | spy Math.random sur 3 tiers × seuils |
| rollSporeeDropOnExpedition | 4 | easy court-circuité + pousse+ |
| tryIncrementSporeeCount | 5 | cap/clamp/refus/qty défaut |
| applyDailyResetIfNeeded | 3 | day change / no-op / init |
| canBuySporee | 8 | matrice stage/coins/cap/inv + projection |
| shouldGiftOnboardingSporee | 5 | transitions + claim flag |
| getLocalDateKey | 2 | format padding + pas UTC |

Privacy : aucun nom personnel dans les tests (Lucas/Emma/parent1 convention CLAUDE.md respectée).

## Deviations from Plan

### Ajustement imports (Rule 3 — blocking)

Le plan référence `import { TREE_STAGE_ORDER } from './engine'` et `import type { ExpeditionDifficulty } from './expedition-engine'`. En réalité :
- `TREE_STAGE_ORDER` est exporté depuis `lib/mascot/types.ts:442` (pas `engine.ts`)
- `ExpeditionDifficulty` est exporté depuis `lib/types.ts:650` (pas `lib/mascot/expedition-engine.ts`)

**Fix appliqué :** imports corrigés :
```ts
import { CROP_CATALOG, TREE_STAGE_ORDER } from './types';
import type { TreeStage } from './types';
import type { ExpeditionDifficulty } from '../types';
```

Aucune autre déviation. Toutes les valeurs constantes et signatures de fonctions sont conformes verbatim au plan.

## Prêt pour Plan 38-03

Toutes les fonctions pures sont livrées, testées, et typées pour consommation directe par :
- `hooks/useFarm.ts` → `rollSporeeDropOnHarvest(classifyHarvestTier(cropId))` post-récolte
- `hooks/useExpeditions.ts` → `rollSporeeDropOnExpedition(difficulty)` post-expedition
- `hooks/useGamification.ts` → `shouldGiftOnboardingSporee({ fromStage, toStage, alreadyClaimed })` sur evolution event
- `canBuySporee()` consommable directement par un futur ShopSheet (Plan suivant v1.7 ou UI dédiée)

## Commits

- `d37089f` feat(38-02): moteur pur économie Sporée (constantes + fonctions)
- `a162674` test(38-02): suite Jest exhaustive sporee-economy (44 tests)

## Self-Check: PASSED

- FOUND: lib/mascot/sporee-economy.ts
- FOUND: lib/__tests__/sporee-economy.test.ts
- FOUND: commit d37089f
- FOUND: commit a162674
- Jest: 44/44 passed
- tsc: clean sur les 2 fichiers
