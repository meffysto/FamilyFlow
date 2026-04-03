---
phase: quick
plan: 260403-qoo
subsystem: gamification / famille-queue
tags: [race-condition, file-io, serialization, gamification]
dependency_graph:
  requires: [lib/famille-queue.ts]
  provides: [race-condition-free writes on famille.md for completeTask/openLootBox/completeSagaChapter]
  affects: [hooks/useGamification.ts, hooks/useVault.ts]
tech_stack:
  added: []
  patterns: [enqueueWrite, patchProfileField, atomic combined writes]
key_files:
  modified:
    - hooks/useGamification.ts
    - hooks/useVault.ts
decisions:
  - "completeTask/openLootBox: import enqueueWrite + patchProfileField pour simplifier les blocs inline"
  - "completeSagaChapter: combiner saga_items + farm_harvest_inventory en un seul enqueueWrite + un seul writeFile"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-03T17:18:10Z"
  tasks: 2
  files: 2
---

# Quick Task 260403-qoo Summary

**One-liner:** Toutes les écritures famille.md dans completeTask, openLootBox et completeSagaChapter sérialisées via enqueueWrite — élimine les race conditions restantes.

## Objective

Wrapper les 3 derniers appels à risque de race condition sur famille.md avec enqueueWrite de lib/famille-queue. Les fonctions completeTask, openLootBox et completeSagaChapter faisaient des read-modify-write sur famille.md sans passer par la queue partagée.

## Tasks Completed

### Task 1: Wrapper completeTask et openLootBox dans useGamification.ts

**Commit:** dc04366

**Changes:**
- Ajout import `enqueueWrite, patchProfileField` depuis `../lib/famille-queue`
- `completeTask`: bloc farm_crops (lignes ~126-148) wrappé dans `enqueueWrite`
- `openLootBox`: bloc mascot_deco/mascot_hab wrappé dans `enqueueWrite`
- `openLootBox`: bloc companion wrappé dans `enqueueWrite`
- Utilisation de `patchProfileField` pour remplacer ~30 lignes de code inline par bloc (simplification bonus)

**Files modified:** `hooks/useGamification.ts` (+28 / -75 lignes)

### Task 2: Wrapper completeSagaChapter dans useVault.ts

**Commit:** 72db03b

**Changes:**
- Les deux blocs saga_items et farm_harvest_inventory combinés en un seul `enqueueWrite`
- Lecture de famille.md à l'intérieur du enqueueWrite (version la plus récente garantie)
- Une seule mutation sur le même array `lines[]` → un seul `writeFile` atomique
- Suppression de la lecture intermédiaire redondante (réduction I/O)

**Files modified:** `hooks/useVault.ts` (+69 / -64 lignes)

## Verification

- `grep -c "enqueueWrite" hooks/useGamification.ts` → **4** (1 import + 3 blocs wrappés)
- `grep -c "enqueueWrite" hooks/useVault.ts` → **8** (import existant + 5 anciens + 1 nouveau completeSagaChapter)
- Aucun `vault.writeFile(FAMILLE_FILE` en dehors d'un `enqueueWrite` dans les deux fichiers
- `npx tsc --noEmit` → aucune nouvelle erreur (erreurs pré-existantes connues inchangées)

## Deviations from Plan

None — plan executed exactly as written, bonus optimisations incluses comme suggéré.

## Known Stubs

None.

## Self-Check: PASSED

- [x] hooks/useGamification.ts modifié et committé (dc04366)
- [x] hooks/useVault.ts modifié et committé (72db03b)
- [x] 3 blocs famille.md wrappés dans useGamification.ts
- [x] 1 bloc atomique (saga_items + farm_harvest_inventory) wrappé dans useVault.ts
- [x] TypeScript compile sans nouvelles erreurs
