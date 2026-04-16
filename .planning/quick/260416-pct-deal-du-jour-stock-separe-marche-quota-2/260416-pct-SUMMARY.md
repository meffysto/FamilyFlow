---
phase: quick-260416-pct
plan: 01
subsystem: village-market
tags: [deal-du-jour, marché, quota, persistance, farm-profile]
dependency_graph:
  requires: []
  provides:
    - DAILY_DEAL_STOCK_PER_PROFILE constant
    - getDailyDeal extended signature with profileDealPurchases
    - FarmProfileData.dailyDealPurchases field
    - parseFarmProfile/serializeFarmProfile daily_deal_purchases
    - useGarden.buyDailyDeal
    - MarketSheet.onBuyDeal + profileDealPurchases props
  affects:
    - hooks/useGarden.ts
    - components/village/MarketSheet.tsx
    - app/(tabs)/village.tsx
tech_stack:
  added: []
  patterns:
    - Pool stable basé sur initialStock > 0 (exclut items initialStock=0)
    - Quota per-profil sérialisé en CSV (dateKey|itemId|count) dans farm-{id}.md
    - Flux achat séparé sans mutation marketStock
    - Défense en profondeur quota (UI + hook)
key_files:
  created:
    - lib/__tests__/market-engine-daily-deal.test.ts
  modified:
    - lib/village/market-engine.ts
    - lib/types.ts
    - lib/parser.ts
    - hooks/useGarden.ts
    - components/village/MarketSheet.tsx
    - app/(tabs)/village.tsx
decisions:
  - Pool deal basé sur initialStock > 0 (pas stock courant) — deal stable même à rupture marché
  - Format persistance daily_deal_purchases dateKey|itemId|count — cohérent avec trade_sent_today
  - buyDailyDeal ne touche PAS marketStock — l'item reste achetable au prix normal via onBuy
  - Transaction logée dans marketTransactions même pour deal — cohérence comptable
metrics:
  duration: ~25min
  completed: 2026-04-16
  tasks_completed: 2
  files_modified: 6
  files_created: 1
---

# Quick Task 260416-pct: Deal du jour — stock séparé du marché + quota 2 achats/profil/jour

## One-liner

Deal du jour sur pool stable (57 items, initialStock > 0), quota 2 achats/profil persisté dans farm-{id}.md, flux buyDailyDeal séparé du marché sans décrémentation marketStock.

## What Was Built

### Task 1: Moteur marché — pool stable + quota per-profil

**lib/village/market-engine.ts**
- `DAILY_DEAL_STOCK_PER_PROFILE = 2` exporté
- `DailyDeal.remaining: number` ajouté à l'interface
- `getDailyDeal` étendu avec 3e param optionnel `profileDealPurchases?`
- Pool filtré sur `item.initialStock > 0` — exclut `tresor_familial` et `grand_festin` (57/59 items éligibles)
- `remaining` calculé seulement si même `dateKey` ET même `itemId` — reset automatique à minuit ou changement d'item

**lib/types.ts**
- `FarmProfileData.dailyDealPurchases?: { dateKey: string; itemId: string; purchased: number }` ajouté

**lib/parser.ts**
- `parseFarmProfile` lit `daily_deal_purchases: YYYY-MM-DD|itemId|count` avec tolérance (malformé → undefined)
- `serializeFarmProfile` écrit le champ uniquement si défini

**lib/__tests__/market-engine-daily-deal.test.ts** (nouveau)
- 13 tests Jest couvrant pool, signature étendue, round-trip parser — tous verts

### Task 2: Flux achat deal séparé

**hooks/useGarden.ts**
- `buyDailyDeal(itemId, unitPrice, profileId)` — flux isolé :
  - Vérifie rate-limit global (10 txns/jour)
  - Vérifie coins suffisants
  - Calcule `nextPurchased` en défense (bloque si quota dépassé)
  - Loge la transaction dans `marketTransactions` (cohérence comptable) SANS toucher `marketStock`
  - Persiste `dailyDealPurchases` dans `farm-{profileId}.md`
  - Distribue l'item selon catégorie (farm/harvest/crafted/village)
  - Déduit les coins via `gami-{id}.md` (même pattern que `buyFromMarket`)
- `buyDailyDeal` exposé dans l'interface `UseGardenReturn` et le `return`

**components/village/MarketSheet.tsx**
- `MarketSheetProps` étendu avec `onBuyDeal` (requis) + `profileDealPurchases` (optionnel)
- `dailyDeal` useMemo passe `profileDealPurchases` à `getDailyDeal` — remaining réactif
- `handleBuyDeal` appelle `onBuyDeal(itemId, qty, deal.discountedPrice)` au lieu de `onBuy`
- `DailyDealCard` affiche `deal.remaining/DAILY_DEAL_STOCK_PER_PROFILE restants` (bonus UX)

**app/(tabs)/village.tsx**
- `buyDailyDeal` déstructuré depuis `useGarden()`
- State `dailyDealPurchases` (`FarmProfileData['dailyDealPurchases']`) ajouté
- `loadFarmInventories` lit `farmData.dailyDealPurchases` et appelle `setDailyDealPurchases`
- `<MarketSheet>` reçoit `onBuyDeal` (branché sur `buyDailyDeal`) + `profileDealPurchases`
- `onBuy` marché normal INCHANGÉ

## Success Criteria — Vérification

| Critère | Statut |
|---------|--------|
| Pool stable 57 items (initialStock > 0) | ✅ |
| tresor_familial/grand_festin jamais tirés | ✅ (test 400 jours) |
| remaining=2 sans achat, remaining=1 après 1, null après 2 | ✅ |
| Reset à minuit (dateKey change) | ✅ |
| Reset si itemId du deal change | ✅ |
| marketStock INTACT dans buyDailyDeal | ✅ (grep: newStock absent dans buyDailyDeal) |
| Persistance daily_deal_purchases round-trip | ✅ (3 tests parser) |
| onBuy marché normal non régressé | ✅ |
| npx tsc --noEmit propre | ✅ |
| 13 tests Jest verts | ✅ |

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

## Commits

| Tâche | Hash | Message |
|-------|------|---------|
| Task 1 | 368401f | feat(260416-pct-01): deal du jour — pool stable + quota per-profil |
| Task 2 | 1bb4895 | feat(260416-pct-02): flux achat deal séparé — useGarden.buyDailyDeal + MarketSheet wiring |

## Known Stubs

None.

## Self-Check: PASSED
