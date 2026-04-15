---
phase: quick-260415-pdq
plan: "01"
subsystem: village
tags: [bug-fix, village, production, pending-items]
dependency_graph:
  requires: []
  provides: [pending-items-village-aligned]
  affects: [app/(tabs)/village.tsx, components/village/VillageBuildingModal.tsx]
tech_stack:
  added: []
  patterns: [effectiveRate = Math.max(1, Math.floor(ratePerItem * multiplier))]
key_files:
  modified:
    - app/(tabs)/village.tsx
    - components/village/VillageBuildingModal.tsx
decisions:
  - "Prop techMultiplier optionnelle avec default=1 dans VillageBuildingModal pour retrocompat"
  - "effectiveRate calculé inline dans village.tsx map — pas de helper dédié (scope limité)"
metrics:
  duration: "5min"
  completed: "2026-04-15"
  tasks: 1
  files: 2
---

# Phase quick-260415-pdq Plan 01: Aligner calcul pending items village Summary

**One-liner:** Correction du calcul des pending items dans village.tsx et VillageBuildingModal.tsx pour appliquer `productionRateMultiplier` (formule identique à `getPendingItems` dans useGarden.ts).

## What Was Done

Le badge sur les bâtiments village et le modal de collecte affichaient 0 items en attente car ils divisaient `available` par `ratePerItem` brut, ignorant le multiplicateur de production issu des technologies du village (`villageTechBonuses.productionRateMultiplier`).

### Tâche 1: Appliquer le multiplier tech dans village.tsx et VillageBuildingModal.tsx

**Commit:** 94cd0e8

**village.tsx (badge):** La ligne 748 calculait `Math.floor(available / catalogEntry.production.ratePerItem)`. Remplacé par la formule de référence :
```typescript
const multiplier = villageTechBonuses.productionRateMultiplier[ub.buildingId] ?? 1;
const effectiveRate = Math.max(1, Math.floor((catalogEntry?.production?.ratePerItem ?? 1) * multiplier));
const pending = catalogEntry?.production ? Math.floor(available / effectiveRate) : 0;
```

**VillageBuildingModal.tsx (modal):**
- Ajout prop `techMultiplier?: number` (optionnelle, default 1)
- Destructuré dans la signature du composant avec `techMultiplier = 1`
- Lignes 175-178 remplacées par le calcul avec `effectiveRate` :
```typescript
const effectiveRate = Math.max(1, Math.floor(production.ratePerItem * techMultiplier));
const pendingItems = Math.floor(available / effectiveRate);
const progressInCycle = available % effectiveRate;
const progressRatio = effectiveRate > 0 ? progressInCycle / effectiveRate : 0;
const contribsUntilNext = effectiveRate - progressInCycle;
```

**village.tsx (prop au modal):** Ajout de `techMultiplier={villageTechBonuses.productionRateMultiplier[selectedBuilding.buildingId] ?? 1}` sur le composant `VillageBuildingModal`.

## Verification

- `npx tsc --noEmit` — aucune erreur

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- Commit 94cd0e8 existe: FOUND
- `app/(tabs)/village.tsx` contient `productionRateMultiplier`: FOUND
- `components/village/VillageBuildingModal.tsx` contient `productionRateMultiplier`: FOUND
