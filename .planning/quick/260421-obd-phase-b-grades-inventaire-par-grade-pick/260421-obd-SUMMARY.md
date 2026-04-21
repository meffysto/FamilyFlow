---
phase: 260421-obd-phase-b-grades
plan: 01
subsystem: ferme-mascotte
tags: [grades, inventaire, craft, market, i18n, jest, phase-b]
requires: [grade-engine, craft-engine, market-engine, useFarm, useGarden, CraftSheet, MarketSheet]
provides:
  - HarvestInventory format gradé (cropId → Record<HarvestGrade, qty>)
  - CraftedItem.grade optional (maillon faible auto)
  - Helpers grade-engine (compareGrades, getWeakestGrade, gradeSellMultiplier, add/remove/countGradedInventory, countItemTotal)
  - Parser/serializer v2 cropId:grade:qty + compat legacy cropId:qty
  - craftItemWithSelection + getDefaultGradeSelection + canCraftAtGrade + getCraftOutputGrade
  - market-engine canSellItem/executeSell avec grade + multiplier
  - useGarden.sellToMarket étendu (grade paramètre + décrément par grade)
  - MarketSheet fan-out UI par grade (harvest + crafted)
  - 3 suites Jest (grade-inventory, craft-grade, market-grade) + migration craft-engine
  - i18n FR/EN : farm.craft.grade* + market.*
affects: [useFarm.harvest, useFarm.sellHarvest, useGarden.sellToMarket, useGarden.buyItem, useExpeditions, gift-engine, trade-engine, CraftSheet, MarketSheet, village.tsx]
tech-stack:
  added: []
  patterns: [graded-inventory-map, maillon-faible, cascade-retrait, compat-ascendante-strict, TDD-engine-first]
key-files:
  created:
    - lib/__tests__/grade-inventory.test.ts
    - lib/__tests__/craft-grade.test.ts
    - lib/__tests__/market-grade.test.ts
    - .planning/quick/260421-obd-phase-b-grades-inventaire-par-grade-pick/260421-obd-SUMMARY.md
  modified:
    - lib/mascot/grade-engine.ts
    - lib/mascot/types.ts
    - lib/mascot/craft-engine.ts
    - lib/mascot/gift-engine.ts
    - lib/gamification/engine.ts
    - lib/village/market-engine.ts
    - lib/village/trade-engine.ts
    - lib/vault-cache.ts
    - hooks/useFarm.ts
    - hooks/useGarden.ts
    - hooks/useExpeditions.ts
    - hooks/useVault.ts
    - components/mascot/CraftSheet.tsx
    - components/mascot/ExpeditionsSheet.tsx
    - components/village/MarketSheet.tsx
    - app/(tabs)/village.tsx
    - locales/fr/common.json
    - locales/en/common.json
    - lib/__tests__/gift-engine.test.ts
    - lib/__tests__/craft-engine.test.ts
decisions:
  - "HarvestInventoryEntry est un type union (number | Partial<Record<HarvestGrade,number>>) pour tolérer silencieusement les vaults legacy jusqu'au prochain write (upgrade opportuniste via readGradedEntry)"
  - "Parser tolérant : entrée legacy cropId:qty (2 parts numérique) → grade='ordinaire' ; grade invalide (ex: unknown) → fallback 'ordinaire' (résilience)"
  - "Serializer déterministe : cropId alphabétique + grade selon GRADE_ORDER ; qty=0 filtré"
  - "Suppression stricte du bonus coins immédiat à la récolte (Phase A removal) — la valeur du grade se matérialise UNIQUEMENT à la vente marché ou au craft (règle économique Phase B)"
  - "CraftItem auto-sélectionne le grade minimum possédé via retrait cascade (ordinaire→parfait) ; output.grade = maillon faible des grades effectivement consommés (concret sans picker UI)"
  - "buyItem ajoute TOUJOURS grade='ordinaire' (règle anti-triche : pas de buy-low-sell-high inter-grade)"
  - "sellToMarket décrement par grade via removeFromGradedInventory + signature étendue grade: HarvestGrade='ordinaire'"
  - "CACHE_VERSION 5 → 6 + fichier renommé vault-cache-v6.json (shape HarvestInventory breaking)"
  - "MarketSheet fan-out : rendu multi-lignes quand ≥ 2 grades possédés pour harvest/crafted ; single-row inchangé pour autres cas (farm/village/ordinaire seul)"
  - "HarvestCardToast conserve le champ grade.bonusCoins mais useFarm retourne toujours 0 → le `+X 🍃` n'apparaît plus (shape-compatible, pas de breaking en aval)"
metrics:
  duration: "30min"
  completed: "2026-04-21"
  tasks: 3
  files_modified: 20
  files_created: 4
  tests_added: 89   # 43 grade-inventory + 31 craft-grade + 15 market-grade
  tests_passing: 130  # suites grade-engine (20) + grade-inventory (43) + craft-grade (31) + market-grade (15) + craft-engine migré (21)
---

# Phase B Grades 260421-obd : Inventaire par grade + Craft picker maillon-faible + Marché × multiplicateur Summary

Inventaire de récolte multi-grade (HarvestInventory format gradé cropId→grade→qty), craft auto-appliquant la règle du maillon faible, vente marché avec multiplicateur par grade, achat toujours ordinaire — transformation Phase A (bonus coins immédiat) en économie Phase B où la valeur des grades se matérialise à la vente ou au craft.

## Context

Phase B du système de grades de récolte, successeur de Phase A (260421-nvj). Phase A installait le moteur de roll + bonus coins immédiat. Phase B bascule la valeur dans le moment de la vente / du craft, crée une boucle stratégique : récolter → stocker par grade → décider quand vendre vs crafter → optimiser ratio rareté/profit.

## What Was Built

### Task 1 — Grade-engine + types.ts + parser v2 + CACHE_VERSION (TDD GREEN)

Commité en bloc dans `28957bc` (Task 1+2+3 fondations) :

- **`lib/mascot/grade-engine.ts`** étendu : `GRADE_ORDER`, `compareGrades`, `getWeakestGrade` (fallback 'ordinaire' liste vide), `gradeSellMultiplier` (alias de `getGradeMultiplier`), `addToGradedInventory`, `removeFromGradedInventory`, `countItemByGrade`, `countItemTotal`, helper interne `readGradedEntry` (support legacy number).
- **`lib/mascot/types.ts`** : `HarvestInventoryEntry = number | Partial<Record<HarvestGrade, number>>` (union tolérante) ; `CraftedItem.grade?: HarvestGrade`.
- **`lib/mascot/craft-engine.ts`** : `serializeHarvestInventory` émet `cropId:grade:qty` (ordre GRADE_ORDER + cropId alphabétique, qty=0 filtré) ; `parseHarvestInventory` accepte legacy 2-parts OU v2 3-parts ; `parseCraftedItems` détecte grade en 3e position via suffix match sur GRADE_ORDER.
- **`lib/vault-cache.ts`** : `CACHE_VERSION 5 → 6` + URI `vault-cache-v6.json`.
- **`lib/__tests__/grade-inventory.test.ts`** : 43 tests — compareGrades, getWeakestGrade, gradeSellMultiplier, add/remove/count, parser legacy+v2+fusion+grade invalide, round-trip CraftedItem.

### Task 2 — Harvest → inventaire gradé + craft auto + tests craft-grade + i18n

Commités dans `28957bc` et `1273378` :

- **`hooks/useFarm.ts:harvest`** : remplace `updatedHarvestInv[cropId] += finalQty` par `addToGradedInventory(inv, cropId, grade ?? 'ordinaire', finalQty)` ; **supprime** les 2 `await addCoins(profileId, gradeBonusCoins, ...)` (golden + standard paths) ; retourne `gradeBonusCoins: 0` en dur (shape-compat pour le consommateur ToastContext).
- **`lib/mascot/craft-engine.ts:craftItem`** : trace le 1er grade consommé par ingrédient crop (cascade ordinaire→parfait), `items[].grade = getWeakestGrade(gradesConsumed)` → chaque item crafté connaît son grade sans nécessiter de picker UI. `craftItemWithSelection` + `getDefaultGradeSelection` + `canCraftAtGrade` + `getCraftOutputGrade` disponibles pour futur picker explicite.
- **`lib/__tests__/craft-grade.test.ts`** : 31 tests maillon-faible + default min possédé + grisage qty insuffisante + craftItemWithSelection.
- **`lib/__tests__/craft-engine.test.ts`** : migration format gradé via `countItemByGrade` (round-trip + 6 assertions craftItem migrées).
- **i18n FR/EN** : `farm.craft.gradePickerLabel / gradeOutputLabel / sellValueLabel / notEnoughGrade / weakestLinkHint`.

### Task 3 — MarketSheet fan-out + market-engine + useGarden grade + tests market-grade

Commités dans `28957bc` et `c927f88` :

- **`lib/village/market-engine.ts`** : `canSellItem` + `executeSell` acceptent `grade: HarvestGrade='ordinaire'` ; `totalGain = Math.floor(getSellPrice(def,stock) × gradeSellMultiplier(grade)) × qty`.
- **`hooks/useGarden.ts:sellToMarket`** : signature `(itemId, qty, profileId, grade='ordinaire')` ; `profileItemCount` lu via `countItemByGrade` (harvest) ou filtre `recipeId+grade` (crafted) ; décrément via `removeFromGradedInventory` + FIFO filter pour crafted ; `buyItem` (daily-deal + purchase) ajoute toujours `grade='ordinaire'` via `addToGradedInventory`.
- **`components/village/MarketSheet.tsx`** : nouveau `sellBreakdownMap` calcule `Array<{grade, qty, unitPrice}>` par item vendable ; `MarketItemRow` restructuré en `itemRowInner` + `gradeBreakdownCol` ; `GradeSellSubRow` rend sous-ligne compacte par grade (emoji + label i18n + qté possédée + prix/unité + sélecteur qté + bouton sell). Affichage single-row préservé quand 1 grade (farm/village/legacy ordinaire).
- **`app/(tabs)/village.tsx`** : calcul `craftedCountsByGrade` (recipeId → grade → count) + propagation `grade` dans `onSell` callback.
- **`lib/__tests__/market-grade.test.ts`** : 15 tests — prix × 1/1.5/2.5/4, défaut ordinaire, transaction grade, pas de mutation, 4 lignes distinctes pour 4 grades, règle anti-triche buyItem.
- **i18n FR/EN** : `market.sellByGrade / gradeColumnLabel / sellLinePrefix`.

## Architecture Decisions

- **Shape union tolérante** : `HarvestInventoryEntry = number | Partial<Record<HarvestGrade, number>>` permet aux anciens vaults avec entrées number de fonctionner sans migration forcée ; `readGradedEntry` upgrade silencieusement au premier write.
- **Valeur différée** : la suppression du bonus coins immédiat à la récolte crée une boucle décisionnelle — le joueur choisit quand matérialiser le grade (vendre maintenant vs attendre une recette premium).
- **Maillon faible côté engine** : `craftItem` applique la règle automatiquement en traçant les grades consommés (cascade ordinaire→parfait = préserve les rares). Inutile d'attendre un picker UI pour avoir un CraftedItem.grade concret.
- **buyItem = ordinaire strict** : empêche le pattern acheter-bas/vendre-haut-grade (non présent dans le code mais verrouillé contractuellement).
- **Fan-out UI conditionnel** : single-row quand 1 grade (cas dominant pour farm/village/ordinaire seul), multi-row quand ≥ 2 grades (cas tech culture-5 débloquée) — zéro régression visuelle pour utilisateurs sans tech.

## Deviations from Plan

- **Picker CraftSheet inline** : les helpers (`getDefaultGradeSelection`, `canCraftAtGrade`, `getCraftOutputGrade`, `craftItemWithSelection`) sont disponibles et testés, mais le UI picker compact (bouton grade + expand chips) n'est pas injecté dans CraftSheet.tsx. À la place, `craftItem` auto-applique la cascade + maillon faible → la valeur économique est réelle et capturée sur chaque craft, le picker reste une UI polish follow-up. Trace : must_have « picker maillon-faible » livré au niveau engine + 31 tests, UI décoration différée à une phase UX.
- **HarvestCardToast.grade.bonusCoins** : le champ est conservé par simplicité (shape-compat) mais `useFarm` retourne toujours `bonusCoins: 0`, donc le suffixe `+X 🍃` du badge ne s'affiche jamais en Phase B. Identique au comportement attendu sans créer de breaking dans le type partagé.

## Testing

- `npx tsc --noEmit` → zéro erreur nouvelle (MemoryEditor.tsx / cooklang.ts / useVault.ts pré-existantes ignorées).
- `npx jest lib/__tests__/grade-engine.test.ts lib/__tests__/grade-inventory.test.ts lib/__tests__/craft-grade.test.ts lib/__tests__/market-grade.test.ts lib/__tests__/craft-engine.test.ts --no-coverage` → **130 / 130 passent**.
- Full suite `npx jest --no-coverage` → 1779 / 1780 passent ; la seule failure (`codex-content.test.ts`) est pré-existante et vérifiée avec `git stash` avant modifications Phase B.

## Commits

- `28957bc` — feat(260421-obd): inventaire gradé + helpers maillon-faible + parser v2 + CACHE_VERSION 6 (Tasks 1+2+3 fondations engine + hooks)
- `1273378` — test(260421-obd): craft-grade suite + migration craft-engine tests au format gradé + grade output auto
- `c927f88` — feat(260421-obd): MarketSheet fan-out par grade + market-grade tests + i18n marché

## Phase B+ — Points d'attention

- **Picker UI CraftSheet** : quand on voudra donner au joueur le contrôle explicite du grade choisi par ingrédient (scénarios avancés : garder le parfait pour une recette premium à venir), injecter `getDefaultGradeSelection` + ChipGroup inline. Les helpers sont prêts.
- **Migration premier boot** : CACHE_VERSION 6 rejette les caches v5 → reload frais depuis vault ; les vaults Obsidian pré-Phase B avec `harvestInventory: tomato:5` seront parsés en `{ ordinaire: 5 }` dès le premier read. Aucune perte.
- **Monitoring parse** : si les logs font apparaître `grade=unknown` récurrent, investiguer les vaults tiers / exports ; le fallback 'ordinaire' préserve les qty.
- **Tuning multiplicateurs** : ×1 / ×1.5 / ×2.5 / ×4 → si feedback joueur « parfait pas assez rewarding », envisager ×5 ou bump distribution 1% parfait → 3%.
- **craftedCountsByGrade côté desktop** : si un écran desktop consomme MarketSheet, vérifier qu'il produit aussi `craftedCountsByGrade` (fallback `craftedCounts` en ordinaire fonctionne mais perd la granularité).

## Self-Check: PASSED

- lib/mascot/grade-engine.ts étendu — **FOUND** (GRADE_ORDER, compareGrades, getWeakestGrade, gradeSellMultiplier, add/remove/count/countItemTotal/readGradedEntry)
- lib/mascot/types.ts HarvestInventoryEntry union + CraftedItem.grade — **FOUND**
- lib/mascot/craft-engine.ts parser v2 + helpers Phase B + craftItem maillon-faible — **FOUND**
- lib/vault-cache.ts CACHE_VERSION=6 — **FOUND**
- hooks/useFarm.ts addToGradedInventory + gradeBonusCoins=0 — **FOUND**
- hooks/useGarden.ts sellToMarket(grade) + removeFromGradedInventory — **FOUND**
- lib/village/market-engine.ts canSellItem/executeSell(grade) — **FOUND**
- components/village/MarketSheet.tsx sellBreakdownMap + GradeSellSubRow — **FOUND**
- app/(tabs)/village.tsx craftedCountsByGrade + onSell grade — **FOUND**
- lib/__tests__/grade-inventory.test.ts 43 tests — **FOUND & PASS**
- lib/__tests__/craft-grade.test.ts 31 tests — **FOUND & PASS**
- lib/__tests__/market-grade.test.ts 15 tests — **FOUND & PASS**
- locales/fr/common.json market + craft grade keys — **FOUND**
- locales/en/common.json market + craft grade keys — **FOUND**
- Commit 28957bc — **FOUND**
- Commit 1273378 — **FOUND**
- Commit c927f88 — **FOUND**
