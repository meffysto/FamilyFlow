---
phase: quick-260404-qvz
plan: 01
subsystem: mascot/farm
tags: [performance, oom, timer, animation, particles]
dependency_graph:
  requires: []
  provides: [global-crop-timer, reduced-particles]
  affects: [WorldGridView, AmbientParticles]
tech_stack:
  added: []
  patterns: [timer-consolidation, prop-drilling-for-shared-state, useMemo-stable-random]
key_files:
  created: []
  modified:
    - components/mascot/WorldGridView.tsx
    - lib/mascot/ambiance.ts
decisions:
  - "Timer global WorldGridView: sharedFrameIdx + whisperCellId au niveau parent pour eliminer 2×N setInterval locaux dans CropCell"
  - "useMemo(bubble, [whisperCellId, cell.id]) pour stabiliser le random whisper sans re-render flicker"
  - "farmCropsCSVRef pour eviter de fermer sur farmCropsCSV dans le closure du setInterval whisper"
  - "require() Metro sont des IDs statiques — TreeView/TileMapRenderer non modifies (pas d'allocation memoire)"
  - "Reduction particules: matin 7->4, soir 4->3, nuit 6->3 (total 17->10)"
metrics:
  duration: "~15min"
  completed: "2026-04-04"
  tasks: 2
  files: 2
---

# Quick 260404-qvz: Fix OOM Crash TreeScreen — Timer Global + Lazy Load

**One-liner:** Consolidation timers crop de ~40 setInterval a 2 globaux + reduction 41% particules ambiantes pour eliminer crash OOM apres 4+ minutes sur l'ecran arbre.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Timer global WorldGridView — eliminer 2×N setInterval par CropCell | 4872d2a | components/mascot/WorldGridView.tsx |
| 2 | Reduction particleCount AmbientParticles (17->10 total) | cb1b48e | lib/mascot/ambiance.ts |

## What Was Built

### Task 1: Timer global WorldGridView

**Avant:** Chaque `CropCell` avait 2 timers locaux:
- `setInterval(800ms)` pour le frame swap de l'animation culture
- `setTimeout` + `setInterval` pour les bulles whisper periodiques

Avec ~20 crops visibles, cela representait ~40 setInterval actifs simultanement.

**Apres:**
- `WorldGridView` (parent) gere 1 seul `setInterval(800ms)` → `sharedFrameIdx` passé en prop à chaque `CropCell`
- `WorldGridView` gere 1 seul `setInterval(18s)` → choisit une crop non-mature aleatoire → `whisperCellId` (string | null) passé en prop
- `CropCell` derive `bubble` via `useMemo([whisperCellId, cell.id])` — stable, pas de re-render flicker
- `farmCropsCSVRef` ref utilisé dans le closure setInterval pour eviter une dependency stale

**Reduction:** ~40 setInterval → 2 (reduction ~95%)

### Task 2: Reduction particules AmbientParticles

Chaque particule instancie 3 `withRepeat` (position x, position y, opacity). Reduction:

| Slot | Avant | Apres | withRepeat |
|------|-------|-------|-----------|
| matin (rosee) | 7 | 4 | 21 → 12 |
| soir (ambre) | 4 | 3 | 12 → 9 |
| nuit (lucioles) | 6 | 3 | 18 → 9 |
| **Total** | **17** | **10** | **51 → 30** |

Reduction: 41% des Animated.View et withRepeat pour AmbientParticles.

## Deviations from Plan

### Analyse Task 2 — require() non le vrai probleme

**Constat:** Le plan Task 2 identifiait les require() module-level dans TreeView (107) et TileMapRenderer (94) comme source d'allocation memoire. Apres analyse, ces require() sont resolus par Metro en IDs numeriques au bundle time — pas d'allocation bitmap native.

**Action auto (Rule 1 - Bug analysis):** Recentrage sur la vraie cause: trop de withRepeat simultanes. TreeView et TileMapRenderer non modifies — deja optimises (utilisent la saison courante pour les `<Image>`).

**Fix applique:** Reduction particleCount dans `ambiance.ts` comme identifie en Task 2 section "Action reelle Task 2".

## Success Criteria — Verification

- [x] WorldGridView : 2 timers globaux (sharedFrameIdx 800ms + whisperCellId 18s) au lieu de ~40 locaux
- [x] AmbientParticles : 10 particules max au lieu de 17 (reduction 41%)
- [x] Total withRepeat reduit de ~51 a ~30 pour AmbientParticles (-21)
- [x] Total setInterval crop reduit de ~40 a 2 (-95%)
- [x] `npx tsc --noEmit` passe (seules erreurs pre-existantes dans docs/)

## Known Stubs

Aucun stub — les timers sont pleinement fonctionnels.

## Self-Check: PASSED

- [x] `components/mascot/WorldGridView.tsx` modifie (4872d2a)
- [x] `lib/mascot/ambiance.ts` modifie (cb1b48e)
- [x] Commits existent: `git log --oneline | grep 260404-qvz` → cb1b48e, 4872d2a
