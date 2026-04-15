---
phase: quick-260415-xak
plan: "01"
subsystem: gamification/toast
tags: [harvest, toast, animation, reanimated, haptics]
dependency_graph:
  requires: [contexts/ToastContext.tsx, components/gamification/RewardCardToast.tsx]
  provides: [components/gamification/HarvestCardToast.tsx, showHarvestCard API]
  affects: [contexts/ToastContext.tsx]
tech_stack:
  added: []
  patterns: [spring-in/out pattern RewardCardToast, accumulation merge, sparkleKey re-trigger]
key_files:
  created:
    - components/gamification/HarvestCardToast.tsx
  modified:
    - contexts/ToastContext.tsx
decisions:
  - harvestVisibleRef ref miroir pour éviter stale closure dans showHarvestCard
  - sparkleKey=0 ignoré dans Sparkle et TimerBar pour éviter animation parasite au mount
  - width%→0% pour la timer bar (pas scaleX) — évite transformOrigin non supporté React Native
  - ItemChip isNew flag calculé à l'entrée dans renderedItems pour n'animer scale 0→1 qu'au 1er render du chip
metrics:
  duration: "~10min"
  completed_date: "2026-04-15"
  tasks: 2
  files: 2
---

# Phase quick-260415-xak Plan 01: HarvestCardToast Summary

**One-liner:** Carte harvest animée avec accumulation live — chips spring-in, sparkles re-triggerable, timer bar 3s, branché dans ToastContext via showHarvestCard().

## What Was Built

### Tache 1 : HarvestCardToast.tsx

Composant standalone `components/gamification/HarvestCardToast.tsx` (298 lignes) :

- **HarvestItem** exporté `{ emoji: string, label: string, qty: number }`
- **Sparkle** — 4 instances, re-trigger via `triggerKey` (sparkleKey prop), pattern identique RewardCardToast
- **ItemChip** — scale 0→1 withSpring(SPRING_IN) au 1er rendu ; pulse scale 1→1.15→1 via withSpring quand `pulseKey` change
- **TimerBar** — width 100%→0% withTiming 3000ms Easing.linear, reset à chaque sparkleKey
- **Haptics** — `Haptics.impactAsync(Light)` au pop initial ; `Haptics.selectionAsync()` à chaque merge (sparkleKey > 1)
- **Couleurs** — `useThemeColors()` primary pour chips/timer/subtitle, `colors.card` background, `colors.text` titre
- **SPRING_IN** `{ damping: 26, stiffness: 200 }` / **SPRING_OUT** `{ damping: 28, stiffness: 180 }` identiques RewardCardToast

### Tache 2 : ToastContext étendu

`contexts/ToastContext.tsx` étendu avec :

- **showHarvestCard(item: HarvestItem, hasLoot?: boolean)** dans l'interface et le provider
- **Logique accumulation** : même emoji → additionner qty via `.map()`; nouveau emoji → push dans array
- **harvestVisibleRef** miroir ref pour éviter stale closure lors de l'évaluation `!harvestVisible` dans showHarvestCard
- **hideHarvestCard** : clear timer + setHarvestVisible(false) + setTimeout 400ms pour clear items (laisse animation sortie)
- **harvestSparkleKey** incrémenté à chaque appel showHarvestCard → signal re-trigger sparkles + pulse
- **Re-export** `export type { HarvestItem }` depuis ToastContext pour les consommateurs
- **Render** `<HarvestCardToast>` placé juste après `<RewardCardToast>` dans le provider

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] transformOrigin non supporté React Native**
- **Found during:** Tache 1 implémentation timer bar
- **Issue:** Le plan suggérait `scaleX` + `transformOrigin: 'left'` pour la timer bar. `transformOrigin` n'est pas un style React Native valide.
- **Fix:** Utilisation de `width: \`${progress.value * 100}%\`` via `useAnimatedStyle` — la barre rétrécit de droite vers gauche naturellement avec `overflow: hidden` sur le track.
- **Files modified:** `components/gamification/HarvestCardToast.tsx`
- **Commit:** cd73b1e

**2. [Rule 2 - Missing] harvestVisibleRef pour éviter stale closure**
- **Found during:** Tache 2 implémentation showHarvestCard
- **Issue:** Le plan utilisait `harvestVisible` (state) dans le callback `showHarvestCard` via `useCallback`. En React, le state dans useCallback stale si la dependency n'est pas listée, et lister `harvestVisible` forcerait une récréation fréquente.
- **Fix:** Ajout de `harvestVisibleRef = useRef(false)` synchronisé avec `setHarvestVisible` — la ref est toujours à jour sans re-créer le callback.
- **Files modified:** `contexts/ToastContext.tsx`
- **Commit:** 4696862

## Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Créer HarvestCardToast | cd73b1e | components/gamification/HarvestCardToast.tsx |
| 2 | Brancher dans ToastContext | 4696862 | contexts/ToastContext.tsx |

## Known Stubs

Aucun stub — le composant reçoit ses données depuis ToastContext qui gère l'accumulation. Les consommateurs devront appeler `showHarvestCard({ emoji, label, qty })` lors des récoltes ferme/expédition (branchement dans les écrans ferme à faire dans une tâche séparée).

## Self-Check: PASSED

- [x] `components/gamification/HarvestCardToast.tsx` existe (466 lignes)
- [x] `HarvestItem` exporté depuis HarvestCardToast et re-exporté depuis ToastContext
- [x] `showHarvestCard` dans ToastContextValue et ToastProvider
- [x] `npx tsc --noEmit` — 0 erreurs
- [x] SPRING_IN `{ damping: 26, stiffness: 200 }`, SPRING_OUT `{ damping: 28, stiffness: 180 }` identiques à RewardCardToast
- [x] Aucune couleur hardcodée — tout via `useThemeColors()`
- [x] Commits cd73b1e et 4696862 présents dans git log
