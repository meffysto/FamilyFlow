---
phase: 260404-kbd
plan: 01
subsystem: mascot/farm
tags: [farm, hybrid-advance, visual-indicator, fifo]
dependency_graph:
  requires: []
  provides: [advanceFarmCrops-hybrid, getMainPlotIndex, main-plot-indicator]
  affects: [lib/mascot/farm-engine.ts, components/mascot/FarmPlots.tsx]
tech_stack:
  added: []
  patterns: [FIFO hybrid speed, parseFloat for decimal task progress]
key_files:
  created: []
  modified:
    - lib/mascot/farm-engine.ts
    - components/mascot/FarmPlots.tsx
decisions:
  - "advanceFarmCrops: boucle sur TOUS les crops non-matures au lieu de seul le premier — increment plein pour le plot principal, demi-vitesse pour les autres"
  - "parseFloat pour tasksCompleted dans parseCrops — supporte les valeurs decimales issues de la demi-vitesse"
  - "getMainPlotIndex retourne plotIndex (stable) et non l'index dans sorted — coherent avec le reste de l'API farm"
  - "isMainPlot false sur crops matures et vides — pas d'indicateur superflu"
metrics:
  duration: ~5min
  completed_date: "2026-04-04"
  tasks: 2
  files: 2
---

# Quick Task 260404-kbd Summary

**One-liner:** Systeme hybride ferme FIFO — plot principal vitesse pleine, autres demi-vitesse via `advanceFarmCrops` reecrit + indicateur visuel border bleue/eclair dans `FarmPlots`.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Logique hybride advanceFarmCrops + getMainPlotIndex + parseFloat | 5df172a | lib/mascot/farm-engine.ts |
| 2 | Indicateur visuel plot principal dans FarmPlots.tsx | b51efd8 | components/mascot/FarmPlots.tsx |

## Changes Made

### lib/mascot/farm-engine.ts

- **parseCrops** : `parseInt` → `parseFloat` pour `tasksCompleted` (support decimales)
- **advanceFarmCrops** : remplace la logique "seul le premier crop avance" par une boucle sur tous les crops non-matures
  - Plot principal (targetIdx, FIFO le plus ancien) : `+= seasonBonus` (vitesse pleine)
  - Autres plots non-matures : `+= seasonBonus * 0.5` (demi-vitesse)
  - Chaque crop verifie son propre seuil `effectiveTasksPerStage` et avance de stade si atteint
  - Collecte tous les crops devenus matures dans le tableau `matured`
- **getMainPlotIndex** (nouvelle fonction exportee) : retourne le `plotIndex` du crop le plus ancien non-mature (FIFO), ou `null` si tous matures

### components/mascot/FarmPlots.tsx

- Import `getMainPlotIndex` ajoute depuis `farm-engine`
- `FarmPlots` : calcule `mainPlotIndex = getMainPlotIndex(crops)` et passe `isMainPlot` a chaque `FarmPlot`
- `FarmPlot` : prop `isMainPlot: boolean` ajoutee
- Rendu conditionnel `{isMainPlot && ...}` : `View` border bleue (#60A5FA) + `Text` badge ⚡ en coin superieur droit
- Styles : `mainPlotBorder` (border 2px #60A5FA, fond rgba(96,165,250,0.08)) + `mainPlotBadge` (position absolute top:-2 right:-2, fontSize:10)

## Deviations from Plan

None — plan execute exactement tel qu'ecrit.

## Verification

- `npx tsc --noEmit` : aucune erreur nouvelle dans farm-engine.ts ou FarmPlots.tsx
- `getMainPlotIndex` exporte et importe correctement
- `advanceFarmCrops` modifie tous les crops non-matures
- `parseCrops` utilise `parseFloat` pour `tasksCompleted`
- Indicateur absent sur plots matures (isMature=true) et plots vides (crop=null)

## Self-Check: PASSED
