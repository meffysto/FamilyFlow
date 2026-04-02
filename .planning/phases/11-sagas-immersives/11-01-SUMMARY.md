---
phase: 11-sagas-immersives
plan: "01"
subsystem: mascot/visitor
tags: [sprites, animation, reanimated, saga, visitor, i18n]
dependency_graph:
  requires: []
  provides:
    - VisitorSlot component with 5-state animation machine
    - 8 voyageur sprites (placeholder, TODO real PixelLab art)
    - i18n keys for saga indicator dashboard
  affects:
    - components/mascot/VisitorSlot.tsx (new)
    - assets/garden/animals/voyageur/ (new directory)
    - locales/fr/gamification.json (extended)
    - locales/en/gamification.json (extended)
tech_stack:
  added: []
  patterns:
    - Reanimated useSharedValue + withSpring + withSequence pour animations multi-étapes
    - State machine 5 états (entering/idle/reacting/departing/departed) comme CompanionSlot
    - scaleX: -1 sur Image uniquement pour flip directionnel (pas sur Animated.View)
    - require() statique pour sprites PNG — compatible bundler Metro
    - Overlay View semi-transparent pour tint saga (fallback tintColor Image)
key_files:
  created:
    - components/mascot/VisitorSlot.tsx
    - assets/garden/animals/voyageur/idle_1.png
    - assets/garden/animals/voyageur/idle_2.png
    - assets/garden/animals/voyageur/walk_left_1.png
    - assets/garden/animals/voyageur/walk_left_2.png
    - assets/garden/animals/voyageur/walk_left_3.png
    - assets/garden/animals/voyageur/walk_left_4.png
    - assets/garden/animals/voyageur/walk_left_5.png
    - assets/garden/animals/voyageur/walk_left_6.png
  modified:
    - locales/fr/gamification.json
    - locales/en/gamification.json
decisions:
  - "[11-01]: PixelLab MCP non disponible comme outil direct — sprites placeholder 48x48 RGB créés programmatiquement (Node.js zlib deflate) pour débloquer le composant. TODO: remplacement par vrais sprites pixel art."
  - "[11-01]: Tint couleur saga implémenté comme overlay View (opacity 0.15) plutôt que tintColor sur Image — plus fiable cross-platform React Native"
  - "[11-01]: shouldDepart déclenche départ uniquement si state === 'idle' — évite interruption d'une animation de réaction en cours (SAG-04 correctness)"
  - "[11-01]: SAGA_TINT map définie pour 4 sagaIds connus (silver-voyager, hidden-spring, amber-road, forest-whisper) — extensible par Plan 02+"
metrics:
  duration: "4 minutes"
  completed_date: "2026-04-02"
  tasks_completed: 2
  files_changed: 11
requirements:
  - SAG-01
  - SAG-04
---

# Phase 11 Plan 01: Sprites Voyageur + Composant VisitorSlot Summary

**One-liner:** Composant VisitorSlot en Reanimated 5 états (entering/idle/reacting/departing/departed) avec animations de réaction aux choix saga (joy/surprise/mystery), sprites placeholder 48x48 voyageur mystérieux, et clés i18n indicateur dashboard.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Sprites voyageur + clés i18n | `06fc167` | 8 PNGs voyageur, fr/en gamification.json |
| 2 | Composant VisitorSlot | `d1e4802` | components/mascot/VisitorSlot.tsx (467 lignes) |

## What Was Built

### Task 1: Sprites voyageur + i18n

8 sprites PNG 48x48 créés dans `assets/garden/animals/voyageur/` (idle_1/2 + walk_left_1-6). Format identique aux compagnons existants (chat/chien/lapin/etc.). PixelLab MCP non disponible comme outil direct — sprites placeholder RGB valides générés via Node.js.

Clés i18n ajoutées dans les deux locales sous `mascot.saga.indicator` : `waiting`, `done`, `progress` (avec interpolation `{{current}}`, `{{total}}`, `{{title}}`).

### Task 2: VisitorSlot — machine d'états 5 états

Composant React Native (pas SVG) en position absolute dans le diorama, calqué sur le pattern AnimatedAnimal/CompanionSlot de TreeView.tsx.

**Interface exportée :**
- `VisitorSlot` — composant principal
- `VisitorSlotProps` — interface props complète
- `ReactionType` — union `'joy' | 'surprise' | 'mystery'`

**5 états internes :**
- `entering` — marche depuis hors-écran droite (fx:1.15) vers cible (fx:0.72, fy:0.62) via withSpring
- `idle` — bounce vertical continu + bulle "!" pulsante Pressable + haptic light
- `reacting` — animations selon ReactionType (déclenché par changement de prop `reactionType`)
- `departing` — départ normal (marche droite, scaleX:-1 sur Image) ou dramatique (flash + scale + fade)
- `departed` — return null (composant invisible)

**3 animations de réaction (SAG-04) :**
- `joy` : scale bounce 3 rebonds décroissants + sauts bounceY — haptic Success — 700ms
- `surprise` : shake horizontal 6 phases + sursaut scale — haptic Medium — 400ms
- `mystery` : opacity flicker 6 phases + léger agrandissement — haptic Light — 700ms

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Deviation] PixelLab MCP non disponible comme outil direct**
- **Found during:** Task 1
- **Issue:** PixelLab est accessible uniquement via MCP server (pas CLI), et n'est pas enregistré comme outil dans ce contexte d'exécution.
- **Fix:** Application du fallback prévu dans le plan — sprites placeholder PNG valides 48x48 RGB générés programmatiquement (Node.js + zlib). Commentaire `TODO: Remplacer par vrais sprites PixelLab` ajouté dans VisitorSlot.tsx.
- **Files modified:** `assets/garden/animals/voyageur/*.png`
- **Commits:** `06fc167`
- **Impact:** Aucun impact sur le composant VisitorSlot — require() statiques fonctionnels, bundler Metro satisfait.

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| `components/mascot/VisitorSlot.tsx` | 84-92 | Sprites PNG placeholder (couleur unie) | PixelLab non accessible — sprites visuellement neutres mais PNG valides. Plan 11+ ou quick task devra les remplacer par vrais sprites pixel art voyageur |

Les stubs n'empêchent pas l'objectif du plan : le composant est fonctionnel et prêt pour l'intégration dans tree.tsx (Plan 02). Les sprites placeholder s'afficheront comme carrés colorés jusqu'au remplacement.

## Self-Check: PASSED

- `assets/garden/animals/voyageur/idle_1.png` — FOUND (PNG 48x48 valide)
- `assets/garden/animals/voyageur/walk_left_1.png` — FOUND (PNG 48x48 valide)
- `components/mascot/VisitorSlot.tsx` — FOUND (467 lignes)
- Commit `06fc167` — FOUND
- Commit `d1e4802` — FOUND
- `npx tsc --noEmit` — 0 nouvelles erreurs liées à VisitorSlot
