---
phase: quick
plan: 260403-q6y
subsystem: famille-queue / hooks
tags: [race-condition, file-io, queue, useVault, useFarm]
dependency_graph:
  requires: []
  provides: [lib/famille-queue.ts]
  affects: [hooks/useFarm.ts, hooks/useVault.ts]
tech_stack:
  added: [lib/famille-queue.ts]
  patterns: [module-level promise queue, shared write serialization]
key_files:
  created:
    - lib/famille-queue.ts
  modified:
    - hooks/useFarm.ts
    - hooks/useVault.ts
decisions:
  - "_familleWriteQueue définie dans lib/famille-queue.ts (module-level singleton) — partagée entre tous les importeurs via le système de modules Node/Metro"
  - "buyMascotItem : seule la partie famille.md est dans enqueueWrite — la partie gami-{profileId}.md reste hors queue (fichier différent, pas de race condition)"
  - "unplaceMascotItem : validation du slot (placements[slotId]) faite avant enqueueWrite pour retourner rapidement sans bloquer la queue"
metrics:
  duration: "5min"
  completed_date: "2026-04-03"
  tasks_completed: 2
  files_changed: 3
---

# Quick 260403-q6y: Fix Race Condition on famille.md Writes — Summary

**One-liner:** File d'attente d'écriture famille.md extraite dans lib/famille-queue.ts et partagée entre useFarm.ts et useVault.ts via un singleton module-level Promise.

## What Was Built

La race condition sur les écritures concurrentes de `famille.md` entre `useFarm.ts` et `useVault.ts` est corrigée. `useFarm.ts` possédait déjà une queue locale (`_familleWriteQueue`), mais `useVault.ts` faisait des read-modify-write bruts sans passer par cette queue. Résultat : données farm (niveaux bâtiments, récoltes) potentiellement écrasées lors de mutations simultanées.

**Solution :** Extraire la queue dans `lib/famille-queue.ts` (pure TS, pas de React) pour qu'elle soit un singleton partagé via le système de modules.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extraire enqueueWrite dans lib/famille-queue.ts | ae1939a | lib/famille-queue.ts (créé), hooks/useFarm.ts (import) |
| 2 | Wrapper les 5 fonctions useVault.ts avec enqueueWrite | a62b191 | hooks/useVault.ts |

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

Exception : dans `buyMascotItem`, la variable `updatedGamiProfile` a été déplacée avant le bloc `enqueueWrite` (elle était déclarée après dans le plan d'exemple mais référencée à l'intérieur du callback — correction nécessaire pour la closure TypeScript).

## Verification

```
grep -n "enqueueWrite" hooks/useVault.ts
# → import ligne 100 + 5 usages (1206, 1248, 1341, 1422, 1498)

grep -n "enqueueWrite" hooks/useFarm.ts
# → import ligne 44 (plus de définition locale)

grep -n "export function" lib/famille-queue.ts
# → enqueueWrite, patchProfileField, patchProfileFields

grep -c "_familleWriteQueue" hooks/useFarm.ts
# → 0 (supprimé)

grep -c "_familleWriteQueue" lib/famille-queue.ts
# → 1 (déplacé ici)
```

## Known Stubs

None.

## Self-Check: PASSED

- [x] `lib/famille-queue.ts` existe avec les 3 exports
- [x] `hooks/useFarm.ts` importe depuis lib/famille-queue.ts (0 définitions locales)
- [x] `hooks/useVault.ts` importe enqueueWrite + 5 usages
- [x] `npx tsc --noEmit` : 0 nouvelles erreurs dans les fichiers modifiés
- [x] Commits ae1939a et a62b191 existent
