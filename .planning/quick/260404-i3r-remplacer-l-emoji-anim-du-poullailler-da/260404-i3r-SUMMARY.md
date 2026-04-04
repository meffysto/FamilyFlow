---
phase: quick
plan: 260404-i3r
subsystem: mascot/farm
tags: [sprite, pixel-art, poulailler, worldgrid, animated-image]
tech-stack:
  added: []
  patterns: [Animated.Image avec require() local, StyleSheet sprite position absolute]
key-files:
  created:
    - assets/garden/buildings/poulailler/idle_south.png
  modified:
    - components/mascot/WorldGridView.tsx
decisions:
  - "idleChickenSprite width/height=16 pour matcher visuellement fontSize:12 de l'emoji précédent dans la cellule bâtiment (PNG 48x48 downscalé)"
  - "Animated.Image source via require() statique — compatible Metro bundler React Native"
metrics:
  duration: 3min
  completed: 2026-04-04
  tasks: 1
  files: 2
---

# Quick 260404-i3r: Remplacer emoji poulailler par sprite PNG Summary

Sprite pixel art poule (48x48 RGBA) installé dans assets/ et rendu WorldGridView migré de Animated.Text emoji vers Animated.Image avec animation bob translateY preservée.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Copier le sprite et remplacer l'emoji par Animated.Image | c9bfd75 | assets/garden/buildings/poulailler/idle_south.png, components/mascot/WorldGridView.tsx |

## Changes Made

### assets/garden/buildings/poulailler/idle_south.png
- Nouveau fichier : sprite poule pixel art 48x48 RGBA PNG
- Source : /tmp/poule_south.png (généré via PixelLab)
- Dossier assets/garden/buildings/poulailler/ créé

### components/mascot/WorldGridView.tsx
- Remplacement `<Animated.Text style={[styles.idleEmoji, styles.idlePoulaillerPos, chickenStyle]}>🐔</Animated.Text>` par `<Animated.Image source={require('../../assets/garden/buildings/poulailler/idle_south.png')} style={[styles.idleChickenSprite, styles.idlePoulaillerPos, chickenStyle]} />`
- Ajout style `idleChickenSprite: { position: 'absolute', width: 16, height: 16 }` dans StyleSheet
- `idlePoulaillerPos` (bottom: 2, left: 2) inchangé
- `chickenStyle` (bob translateY via useAnimatedStyle) inchangé
- Autres bâtiments (grange, moulin, ruche) non touchés

## Verification

- `ls assets/garden/buildings/poulailler/idle_south.png` : fichier présent (504 bytes)
- `npx tsc --noEmit` : aucune nouvelle erreur (seules erreurs pre-existantes docs/family-flow-promo.tsx)
- Grep "Animated.Image" dans WorldGridView.tsx : rendu poulailler confirmé
- Emoji 🐔 retiré du bloc poulailler

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

## Self-Check: PASSED

- assets/garden/buildings/poulailler/idle_south.png : FOUND
- Commit c9bfd75 : FOUND
- Animated.Image dans WorldGridView.tsx : FOUND
- Aucune régression tsc : CONFIRMED
