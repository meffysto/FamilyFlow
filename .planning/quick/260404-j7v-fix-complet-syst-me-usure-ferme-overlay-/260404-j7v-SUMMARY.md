---
phase: quick-260404-j7v
plan: "01"
subsystem: mascot/farm
tags: [wear-engine, farm, ui, repair, toast]
dependency_graph:
  requires: [wear-engine.ts (backend complet), lib/mascot/building-engine.ts (signature collectBuilding avec wearEffects)]
  provides: [overlay orange blockedOverlay, plant() blocage clôture, wearEffects dans collect, toasts détection usure, repair handlers weed/pest/roof, bouton Réparer BuildingDetailSheet]
  affects: [components/mascot/WorldGridView.tsx, hooks/useFarm.ts, app/(tabs)/tree.tsx, components/mascot/BuildingDetailSheet.tsx]
tech_stack:
  added: []
  patterns: [useCallback repair handlers, conditional UI isDamaged prop, toast par WearEventType]
key_files:
  created: []
  modified:
    - components/mascot/WorldGridView.tsx
    - hooks/useFarm.ts
    - app/(tabs)/tree.tsx
    - components/mascot/BuildingDetailSheet.tsx
decisions:
  - "ToastType n'inclut pas 'warning' — broken_fence/damaged_roof → 'error', weeds/pests → 'info'"
  - "Overlay blockedOverlay orange = rgba(255,165,0) — cohérent avec décision cosmétique Phase 4"
  - "handleCropCellPress dans CropCell : onRepairWeed prioritaire sur onPress si hasWeeds && !crop"
  - "handleBuildingPress dans BuildingCell : onRepairPest prioritaire sur onPress si hasPests"
  - "Bouton réparation toit : couleur #FF9800 constante cosmétique (pas dans useThemeColors)"
metrics:
  duration: ~15min
  completed: 2026-04-04
  tasks: 2
  files: 4
---

# Quick Task 260404-j7v: Fix complet système usure ferme — overlay + blocage + repair

**One-liner:** Branche le wear-engine sur l'UI — overlay orange, blocage plant() sur clôture cassée, wearEffects dans collectBuilding, toasts de détection, handlers de réparation herbes/nuisibles/toit, bouton conditionnel dans BuildingDetailSheet.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Overlay orange + blocage plant + wearEffects dans collect | ce60652 | WorldGridView.tsx, useFarm.ts |
| 2 | Toasts détection + handlers réparation + bouton toit BuildingDetailSheet | 544e4c9 | tree.tsx, BuildingDetailSheet.tsx |

## Changes Summary

### WorldGridView.tsx
- `blockedOverlay` couleur : `rgba(239,68,68,0.3)` → `rgba(255,165,0,0.3)` + borderColor identique (orange)
- `WorldGridViewProps` : ajout `onRepairWeed?: (plotIndex: number) => void` et `onRepairPest?: (cellId: string) => void`
- `CropCell` : `handleCropCellPress` — si `hasWeeds && !isBlocked && !crop && onRepairWeed`, appelle `onRepairWeed(plotIndex)` ; sinon `onPress()` normal
- `BuildingCell` : `handleBuildingPress` — si `hasPests && placedBuilding && onRepairPest`, appelle `onRepairPest(cell.id)` ; sinon `onPress()` normal
- Props propagées à tous les `CropCell` et `BuildingCell` (cellules standard + expansion + grande parcelle)

### hooks/useFarm.ts
- `plant()` : check `getActiveWearEffects(freshFarm.wearEvents ?? []).blockedPlots.includes(plotIndex)` avant `plantCrop()` — lève `Error('Cette parcelle est bloquée par une clôture cassée')`
- `collectBuildingResources()` : calcule `wearEffects` et les passe en 6e param à `collectBuilding`
- `collectPassiveIncome()` : calcule `passiveWearEffects` et les passe dans la boucle `collectBuilding`

### app/(tabs)/tree.tsx
- `useFarm()` destructuring : ajout `getWearEvents`
- `checkWear()` : résultat capturé, toast par type (`broken_fence`/`damaged_roof` → `'error'`, `weeds`/`pests` → `'info'`)
- `handleRepairWeed(plotIndex)` : trouve l'event `weeds` non réparé, appelle `repairWear`, toast "Réparé !"
- `handleRepairPest(cellId)` : idem pour `pests`
- `handleRepairRoof()` : idem pour `damaged_roof` sur `selectedBuildingCellId`
- `WorldGridView` : reçoit `onRepairWeed` et `onRepairPest` (guardés par `isOwnTree`)
- `BuildingDetailSheet` : reçoit `isDamaged` (calculé via `getWearEffects`) et `onRepairRoof`

### components/mascot/BuildingDetailSheet.tsx
- `BuildingDetailSheetProps` : ajout `isDamaged?: boolean` et `onRepairRoof?: () => void`
- Bouton orange conditionnel `{isDamaged && onRepairRoof && (...)}` au-dessus de la section amélioration
- Styles `repairBtn` (`#FF9800`) et `repairBtnText` (`#FFFFFF bold`) ajoutés au StyleSheet

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Adaptation] ToastType sans 'warning'**
- **Found during:** Task 2
- **Issue:** `ToastType = 'success' | 'error' | 'info'` — 'warning' n'existe pas
- **Fix:** `broken_fence`/`damaged_roof` → `'error'` (urgent), `weeds`/`pests` → `'info'` (moins critique)
- **Files modified:** app/(tabs)/tree.tsx

## Self-Check: PASSED

- `components/mascot/WorldGridView.tsx` — modifié, existe
- `hooks/useFarm.ts` — modifié, existe
- `app/(tabs)/tree.tsx` — modifié, existe
- `components/mascot/BuildingDetailSheet.tsx` — modifié, existe
- Commit ce60652 — FOUND
- Commit 544e4c9 — FOUND
- `npx tsc --noEmit` — 0 nouvelles erreurs (erreurs pré-existantes dans docs/family-flow-promo.tsx ignorées)
