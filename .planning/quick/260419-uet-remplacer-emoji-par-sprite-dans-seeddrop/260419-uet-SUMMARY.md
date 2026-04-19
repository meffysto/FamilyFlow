---
phase: quick-260419-uet
plan: 01
subsystem: mascot-ui
tags: [pixel-art, sprite, seed-drop, overlay, visual-polish]
dependency_graph:
  requires: []
  provides: [RARE_SEED_SPRITES mapping, conditional Image/Text rendering in SeedDropOverlay]
  affects: [components/mascot/HarvestEventOverlay.tsx]
tech_stack:
  added: []
  patterns: [static require() Metro bundler, conditional rendering Image/Text fallback]
key_files:
  modified:
    - components/mascot/HarvestEventOverlay.tsx
decisions:
  - "Static require() obligatoire pour Metro bundler (cf. Phase 30-01 Pitfall 4) — pas de require dynamique"
  - "resizeMode passé en prop Image, pas dans StyleSheet — pattern RN standard"
  - "Fallback emoji Text préservé pour seedId non mappés — zéro crash sur graines inconnues"
metrics:
  duration: 5min
  completed: "2026-04-19"
  tasks: 1
  files: 1
---

# Phase quick-260419-uet Plan 01: Remplacer emoji par sprite dans SeedDropOverlay — Summary

**One-liner:** Rendu conditionnel Image pixel art 80×80 pour les 4 graines rares connues (orchidee, rose_doree, truffe, fruit_dragon) avec fallback emoji Text pour les seedId inconnus dans SeedDropOverlay.

## What Was Built

Modification de `components/mascot/HarvestEventOverlay.tsx` :

1. **Import `Image`** ajouté depuis `'react-native'` sur la ligne d'import existante.

2. **Constante `RARE_SEED_SPRITES`** ajoutée avant `SeedDropOverlay` avec 4 entrées via `require()` statique :
   - `orchidee` → `assets/garden/crops/orchidee/icon.png`
   - `rose_doree` → `assets/garden/crops/rose_doree/icon.png`
   - `truffe` → `assets/garden/crops/truffe/icon.png`
   - `fruit_dragon` → `assets/garden/crops/fruit_dragon/icon.png`

3. **Rendu conditionnel** dans `SeedDropOverlay` : `<Image source={...} style={styles.seedSprite} resizeMode="contain" />` si `RARE_SEED_SPRITES[seedDrop.seedId]` existe, sinon `<Text style={styles.seedEmoji}>{seedDrop.emoji}</Text>` en fallback.

4. **Style `seedSprite`** 80×80 ajouté dans `StyleSheet.create({})`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Ajouter RARE_SEED_SPRITES et Image conditionnelle | 2b9f29a | components/mascot/HarvestEventOverlay.tsx |

## Verification Results

- `npx tsc --noEmit` : aucune erreur sur HarvestEventOverlay.tsx
- `grep -n "RARE_SEED_SPRITES"` : 3 occurrences (déclaration + 2 usages dans ternaire)
- `grep -n "seedSprite"` : 2 occurrences (StyleSheet + usage en prop style)
- Assets vérifiés existants : 4 fichiers PNG (orchidee, rose_doree, truffe, fruit_dragon)

## Deviations from Plan

None - plan exécuté exactement comme écrit.

## Known Stubs

None.

## Self-Check: PASSED

- File modified: `components/mascot/HarvestEventOverlay.tsx` — FOUND
- Commit `2b9f29a` — FOUND
