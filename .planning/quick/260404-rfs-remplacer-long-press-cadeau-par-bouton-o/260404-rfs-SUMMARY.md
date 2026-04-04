---
phase: quick-260404-rfs
plan: "01"
subsystem: mascot/inventory
tags: [ux, gift, inventory, craftsheet]
dependency_graph:
  requires: []
  provides: [bouton-offrir-visible-inventaire]
  affects: [components/mascot/CraftSheet.tsx]
tech_stack:
  added: []
  patterns: [TouchableOpacity onPress remplace Pressable onLongPress]
key_files:
  created: []
  modified:
    - components/mascot/CraftSheet.tsx
decisions:
  - "Bouton 🎁 compact (emoji seul, pas de texte) pour ne pas surcharger la ligne qui a déjà un bouton Vendre"
  - "View remplace Pressable sur les lignes — le conteneur n'a plus besoin de geste long"
  - "giftBtn style sans bordure ni fond coloré — visuellement discret, distinct du bouton Vendre"
metrics:
  duration: "5min"
  completed_date: "2026-04-04T17:49:01Z"
  tasks_completed: 1
  files_modified: 1
---

# Phase quick-260404-rfs Plan 01: Remplacer long-press cadeau par bouton visible — Summary

**One-liner:** Bouton 🎁 TouchableOpacity visible remplace le long-press invisible sur les 3 types de lignes inventaire CraftSheet (harvest, building_resource, crafted).

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Remplacer long-press par bouton offrir sur les 3 types de lignes inventaire | 19f051b | components/mascot/CraftSheet.tsx |

## Decisions Made

- **Bouton emoji seul:** `🎁` sans texte "Offrir" pour ne pas surcharger les lignes qui ont déjà un bouton Vendre.
- **View remplace Pressable:** Le conteneur de ligne n'a plus besoin de geste — `View` suffit, plus simple et sans conflit de geste.
- **Styles giftBtn/giftBtnText:** Padding compact (`Spacing.sm` vertical, `Spacing.md` horizontal), `FontSize.body` pour le emoji — cohérent avec la densité des lignes.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- components/mascot/CraftSheet.tsx modified: confirmed
- Commit 19f051b exists: confirmed
- No `onLongPress` in renderInventaire/renderCreations: confirmed (grep returns 0 results)
- 3 occurrences of `onOfferItem` via `onPress` (harvest, building_resource, crafted): confirmed
- TypeScript: no new errors (pre-existing errors in docs/video folders only)
