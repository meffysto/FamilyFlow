---
phase: 33-exp-ditions
plan: "02"
subsystem: expeditions
tags: [hook, vault, orchestration, ferme, gamification]
dependency_graph:
  requires: [33-01]
  provides: [useExpeditions, CAMP_EXPLORATION_CELL, expeditionExclusive items]
  affects: [hooks/useExpeditions.ts, lib/mascot/world-grid.ts, lib/mascot/types.ts]
tech_stack:
  added: []
  patterns: [readFile-modify-writeFile, useCallback, useMemo, Alert.alert, expo-haptics]
key_files:
  created:
    - hooks/useExpeditions.ts
  modified:
    - lib/mascot/world-grid.ts
    - lib/mascot/types.ts
decisions:
  - Hook useExpeditions lit depuis currentProfile (adulte) — cohérent avec useFarm sans ajouter un farmRaw supplémentaire dans VaultState
  - CAMP_EXPLORATION_CELL non ajouté dans WORLD_GRID — cellule spéciale rendue séparément dans tree.tsx (per RESEARCH)
  - expeditionPity incrément pour failure ET partial — partial compte comme demi-échec OGame-style
metrics:
  duration: "3 min"
  completed: "2026-04-14"
  tasks: 2
  files: 3
requirements: [VILL-16, VILL-17, VILL-19, VILL-20]
---

# Phase 33 Plan 02: Hook useExpeditions + Grille + Items Exclusifs Summary

**One-liner:** Hook useExpeditions orchestrant launch/collect/dismiss avec double-sink coins+récoltes vault, cellule Camp d'exploration bas-gauche, 4 habitants et 2 graines exclusifs expédition.

## What Was Built

### Task 1 — Hook useExpeditions (hooks/useExpeditions.ts)

Hook complet exposant :

- `dailyPool` — pool déterministe du jour via `getDailyExpeditionPool()`
- `activeExpeditions`, `completedExpeditions`, `pendingResults`, `activeCount`, `canLaunch` — dérivées depuis farmData du profil courant
- `pityCount` — compteur pity depuis `expeditionPity` dans farmData
- `launchExpedition(mission)` — vérif ressources + confirmation OGame avec Haptics + double-sink (gami coins / farm harvestInventory) + écriture vault
- `collectExpedition(missionId)` — roll résultat + pity update + distribution loot (habitant → mascotInhabitants, graine → farmRareSeeds, booster → délais ISO) + écriture vault
- `dismissExpedition(missionId)` — filtre hors liste activeExpeditions + écriture vault

Pattern d'accès vault : `readFile → parseFarmProfile → muter → serializeFarmProfile → writeFile`, identique à `useFarm.ts`.

### Task 2 — Cellule Camp + Items Catalogue

**world-grid.ts :** `CAMP_EXPLORATION_CELL` exportée comme constante standalone (non dans WORLD_GRID). Position bas-gauche `x: 0.10, y: 0.90`, `unlockOrder: 0` (toujours visible), size `'large'`.

**types.ts :**
- `MascotInhabitant` + `CropDefinition` : champ `expeditionExclusive?: boolean` ajouté
- 4 habitants exclusifs : `renard_arctique` 🦊 (rare), `aigle_dore` 🦅 (épique), `lynx_mystere` 🐱 (rare), `dragon_glace` 🐉 (épique)
- 2 graines exclusives : `fleur_lave` 🌺 (4 stades / 600 🍃), `cristal_noir` 💎 (5 stades / 900 🍃)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | b178c64 | feat(33-02): hook useExpeditions — orchestration vault expéditions |
| Task 2 | adcea7d | feat(33-02): cellule Camp d'exploration + items exclusifs expédition |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — le hook lit les données ferme depuis `currentProfile` (profil adulte courant). Lorsque Plan 03 câblera l'UI, il passera le bon `profileId` explicitement si nécessaire. Le hook fonctionne pleinement mais l'UI n'existe pas encore (Plan 03).

## Self-Check: PASSED

- hooks/useExpeditions.ts : FOUND
- lib/mascot/world-grid.ts : FOUND
- lib/mascot/types.ts : FOUND
- Commit b178c64 : FOUND
- Commit adcea7d : FOUND
