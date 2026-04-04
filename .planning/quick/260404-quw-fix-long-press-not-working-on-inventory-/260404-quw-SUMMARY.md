---
phase: quick
plan: 260404-quw
subsystem: mascot/craft
tags: [fix, gesture, pressable, inventory, craftsheet]
dependency_graph:
  requires: []
  provides: [long-press-inventory-items]
  affects: [components/mascot/CraftSheet.tsx]
tech_stack:
  added: []
  patterns: [Pressable instead of TouchableOpacity for long-press inside ScrollView]
key_files:
  created: []
  modified:
    - components/mascot/CraftSheet.tsx
decisions:
  - Pressable remplace TouchableOpacity pour les 3 rows inventaire — TouchableOpacity bloque le timer 400ms long-press à cause du conflit de geste avec ScrollView
metrics:
  duration: 3min
  completed: "2026-04-04"
  tasks: 1
  files: 1
---

# Quick 260404-quw: Fix long-press not working on inventory items (CraftSheet) — Summary

**One-liner:** Remplacement de TouchableOpacity par Pressable sur les 3 types de rows inventaire pour résoudre le conflit de geste avec ScrollView et permettre le long-press onOfferItem.

## What Was Done

Task 1 completed: Remplacement des 3 TouchableOpacity englobants des items inventaire par Pressable dans `CraftSheet.tsx`.

- Import `Pressable` ajouté dans react-native (ligne 15)
- Harvest items (ligne ~551) : `TouchableOpacity` → `Pressable`, `activeOpacity={1}` retiré
- Building resource items (ligne ~598) : `TouchableOpacity` → `Pressable`, `activeOpacity={1}` retiré
- Crafted items (ligne ~686) : `TouchableOpacity` → `Pressable`, `activeOpacity={1}` retiré
- Boutons Vendre imbriqués (`TouchableOpacity`) restent inchangés
- Autres `TouchableOpacity` du fichier (navigation, tabs, close) non touchés

## Why This Fix Works

`TouchableOpacity` à l'intérieur d'un `ScrollView` souffre d'un conflit de geste : le ScrollView capture le touch event avant que le timer 400ms de long-press puisse se déclencher. `Pressable` de react-native gère cela correctement avec une logique de priorité de geste différente.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1    | ae62fc6 | fix(260404-quw): remplacer TouchableOpacity par Pressable sur les items inventaire |

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

## Verification

- `npx tsc --noEmit` : OK — aucune erreur dans CraftSheet
- 3 `onLongPress` confirmés via grep : harvest, building_resource, crafted
- Boutons Vendre restent `TouchableOpacity` avec `activeOpacity={0.7}`

## Self-Check: PASSED

- [x] `components/mascot/CraftSheet.tsx` modifié et commité (ae62fc6)
- [x] 3 Pressable avec onLongPress présents
- [x] TypeScript compilation OK
