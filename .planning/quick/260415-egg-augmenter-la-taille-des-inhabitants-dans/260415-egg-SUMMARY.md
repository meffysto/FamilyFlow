---
phase: quick-260415-egg
plan: "01"
subsystem: mascot/diorama
tags: [ui, diorama, inhabitants, pixel-art]
dependency_graph:
  requires: []
  provides: [tailles-inhabitants-augmentees]
  affects: [components/mascot/NativePlacedItems.tsx]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - components/mascot/NativePlacedItems.tsx
decisions:
  - "Centrage emoji offset ajuste proportionnellement (-12 -> -16) pour rester centre sur le nouveau container 32px"
metrics:
  duration: "2min"
  completed: "2026-04-15"
  tasks_completed: 1
  files_modified: 1
---

# Phase quick-260415-egg Plan 01 : Augmenter la taille des inhabitants — Résumé

**One-liner:** Tailles des animaux pixel art (x2), illustrations et emojis augmentées dans NativePlacedItems pour meilleure visibilité dans le diorama Mon jardin.

## Tâches exécutées

| # | Tâche | Commit | Fichiers |
|---|-------|--------|----------|
| 1 | Augmenter les tailles dans NativePlacedItems.tsx | 5aebf7b | components/mascot/NativePlacedItems.tsx |

## Changements appliqués

| Constante/Style | Avant | Après |
|----------------|-------|-------|
| `ANIMAL_SIZE` | 20 | 40 |
| `ITEM_SIZE` | 32 | 48 |
| emoji `fontSize` | 20 | 26 |
| emoji `width`/`height` | 24 | 32 |
| emoji offset (`left`/`top`) | -12 | -16 |

## Déviations du plan

Aucune — plan exécuté exactement comme écrit.

## Self-Check: PASSED

- [x] `components/mascot/NativePlacedItems.tsx` modifié avec les valeurs attendues
- [x] Commit 5aebf7b présent
- [x] `tsc --noEmit` passe sans erreur
