---
phase: quick-260405-0wx
plan: 01
subsystem: desktop-farm
tags: [desktop, farm, wear, fifo, core-sync]
dependency_graph:
  requires: [mobile-farm-engine, mobile-wear-engine]
  provides: [desktop-wear-system, desktop-fifo-indicator]
  affects: [packages/core/src/mascot, apps/desktop/src/pages/Tree.tsx, apps/desktop/src/lib/farm-vault.ts]
tech_stack:
  added: []
  patterns: [wear-overlay-css, wear-repair-handler, fifo-main-plot-indicator]
key_files:
  created:
    - packages/core/src/mascot/wear-engine.ts
  modified:
    - packages/core/src/mascot/farm-engine.ts
    - packages/core/src/mascot/index.ts
    - apps/desktop/src/lib/farm-vault.ts
    - apps/desktop/src/pages/Tree.tsx
    - apps/desktop/src/pages/Tree.css
decisions:
  - "wear-engine.ts copie directement du mobile (fichier pur, pas de dependance React)"
  - "checkWearInVault simplifie fullBuildingSince a {} (pas de tracking idle cote desktop)"
  - "Wear events lus depuis famille.md via readProfileField (pas de champ Profile type)"
metrics:
  duration: 13min
  completed: "2026-04-04T22:57:29Z"
---

# Quick 260405-0wx: Repliquer changements ferme mobile sur desktop

Synchronisation core farm-engine (FIFO hybride, wearEffects, getMainPlotIndex, parseFloat) + copie wear-engine.ts dans le core + integration UI desktop avec overlays usure et indicateur plot principal FIFO.

## Tache 1: Synchroniser core engines

**Commit:** 1274e5f

- `farm-engine.ts` mis a jour avec les 4 changements du mobile :
  1. Import WearEffects + parametre wearEffects optionnel sur plantCrop
  2. advanceFarmCrops hybride FIFO (plot principal pleine vitesse, autres demi-vitesse)
  3. getMainPlotIndex export function
  4. parseCrops utilise parseFloat au lieu de parseInt pour tasksCompleted
- `wear-engine.ts` copie integralement du mobile vers packages/core/src/mascot/
- `index.ts` barrel export mis a jour avec wear-engine

## Tache 2: Integrer wear operations + UI desktop

**Commit:** 85ee148

- `farm-vault.ts` : 2 nouvelles fonctions exportees (checkWearInVault, repairWearInVault)
- `farm-vault.ts` : plantCropInVault lit wear_events et passe wearEffects a plantCrop (bloque parcelles cassees)
- `Tree.tsx` : FarmCrops et BuildingLayer acceptent wearEffects/wearEvents/mainPlotIdx
- `Tree.tsx` : overlays visuels sur parcelles (orange cloture cassee, vert herbes) et batiments (rouge toit abime, brun nuisibles)
- `Tree.tsx` : boutons de reparation inline dans les overlays
- `Tree.tsx` : indicateur FIFO (bordure doree) sur le plot principal
- `Tree.tsx` : handleRepairWear appelle repairWearInVault et rafraichit
- `Tree.tsx` : chargement des wear events au mount + check once per session
- `Tree.css` : wear-overlay, wear-overlay--fence/weeds/roof/pests, wear-repair-btn, main-plot-indicator

## Deviations from Plan

None - plan execute exactement comme ecrit.

## Known Stubs

None.

## Self-Check: PASSED
