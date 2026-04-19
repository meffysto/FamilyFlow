---
phase: 260419-jit
plan: 01
subsystem: mascot/TreeView
tags: [perf, battery, reanimated, jit]
requirements:
  - JIT-01
provides:
  - "Propagation prop paused aux 3 sous-composants TreeView (AnimatedAnimal, SeasonParticle, Particle)"
affects:
  - components/mascot/TreeView.tsx
tech-stack:
  added: []
  patterns:
    - "Gate useEffect early-return if(paused) AVANT withRepeat/setInterval"
    - "Dep arrays incluent paused pour re-run au toggle"
    - "Wrapper components (SeasonalParticles, FloatingParticles) forward paused"
key-files:
  created: []
  modified:
    - components/mascot/TreeView.tsx
decisions:
  - "AnimatedAnimal gate simple if(paused) return (pas de reducedMotion dep comme les particules)"
  - "Cleanups cancelAnimation/clearInterval existants préservés (déclenchés au re-run useEffect quand paused toggle)"
  - "FloatingParticles rendu aussi en mode pixel pour effet légendaire (ligne 288) — paused propagé là aussi"
metrics:
  completed: 2026-04-19
  tasks: 2
  files: 1
---

# Quick 260419-jit: Pauser animations TreeView sous-composants Summary

Propagation du prop `paused` de `TreeViewInner` aux 3 sous-composants qui l'ignoraient (`AnimatedAnimal`, `SeasonParticle`, `Particle`), gate de leurs `useEffect` (80+ worklets `withRepeat(-1)` + 3 `setInterval`) pour éliminer drain batterie hors tab Tree focus.

## Tasks Executed

### Task 1 — Gater les useEffect des 3 sous-composants

Commit `07ec5f2`.

- `Particle` (ligne 1564) : signature + early return `if (reducedMotion || paused) return;`, dep `[reducedMotion, paused]`
- `SeasonParticle` (ligne 1450) : idem
- `AnimatedAnimal` (ligne 1938) :
  - useEffect `[animalId]` → early return `if (paused) return;` après `mounted.current = true` (préserve le flag mount), dep `[animalId, paused]`
  - useEffect `[isWalking, activeWalkFrames]` → early return `if (paused) return;`, dep `[isWalking, activeWalkFrames, paused]`

### Task 2 — Propager paused aux sites de rendu

Commit `3bc3498`.

- `<AnimatedAnimal>` ligne 349 : `paused={paused}`
- `<SeasonalParticles>` ligne 373 : `paused={paused}`
- `<FloatingParticles>` ligne 378 (mode normal) : `paused={paused}`
- `<FloatingParticles>` ligne 288 (mode pixel, effet légendaire) : `paused={paused}` — découvert via grep, non mentionné explicitement dans le plan
- Wrappers `SeasonalParticles` et `FloatingParticles` forward `paused` à leurs enfants

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Propagation paused au FloatingParticles du mode pixel**
- **Found during:** Task 2 (grep exhaustif)
- **Issue:** Le plan mentionne uniquement le rendu `<Particle>` — or `Particle` n'est rendu qu'via `FloatingParticles`, et il existe DEUX sites de rendu `FloatingParticles` : ligne 378 (mode normal, mentionné) et ligne 288 (mode pixel, effet légendaire, non mentionné)
- **Fix:** Ajout `paused={paused}` sur les deux sites
- **Files modified:** components/mascot/TreeView.tsx
- **Commit:** 3bc3498

## Verification

- `npx tsc --noEmit 2>&1 | grep -E "TreeView\.tsx" | grep -v "MemoryEditor\|cooklang\|useVault"` → **0 nouvelle erreur**
- `grep -c "paused" components/mascot/TreeView.tsx` → **22 occurrences** (seuil plan ≥ 15)
- `grep -n "<AnimatedAnimal\|<SeasonalParticles\|<FloatingParticles\|<SeasonParticle\|<Particle " ...` → tous les sites ont `paused={paused}` ou `paused={paused}` via prop

## Success Criteria

- [x] Les 3 sous-composants (`AnimatedAnimal`, `SeasonParticle`, `Particle`) gatent leurs animations sur `paused`
- [x] Aucune régression TypeScript introduite
- [x] Aucune régression visuelle quand `paused=false` (comportement identique à avant — aucune valeur d'animation modifiée)
- [x] Quand `paused=true` : les 3 `setInterval` (idle 600ms, walk 3-6s, bubble 15-30s, walkFrame 200ms) et 8+ `withRepeat(-1)` (translateY/X/opacity/scale particules + translateY/X/opacity/rotation particules saisonnières) s'arrêtent via leurs cleanups au re-run useEffect

## Self-Check: PASSED

- FOUND: components/mascot/TreeView.tsx
- FOUND: commit 07ec5f2
- FOUND: commit 3bc3498
