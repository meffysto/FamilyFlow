---
phase: quick-260415-wnf
plan: "01"
subsystem: gamification
tags: [reward-card, toast, animation, reanimated, tasks]
dependency_graph:
  requires: []
  provides: [REWARD-CARD]
  affects: [contexts/ToastContext.tsx, app/(tabs)/tasks.tsx]
tech_stack:
  added: []
  patterns: [spring-animation, useSharedValue, withTiming, useReducedMotion, polling-counter]
key_files:
  created:
    - components/gamification/RewardCardToast.tsx
  modified:
    - contexts/ToastContext.tsx
    - app/(tabs)/tasks.tsx
decisions:
  - "Compteur XP animé via polling JS easeOutCubic (~60fps/850ms) — évite useAnimatedProps sur Text natif (non supporté pour children sur RN)"
  - "showRewardCard dans ToastContext — co-localisé avec showToast pour partager le Provider root (pas de contexte séparé)"
  - "Dismiss auto 3000ms dans ToastContext, animation sortie gérée dans RewardCardToast via visible=false"
metrics:
  duration: "~8min"
  completed: "2026-04-15"
  tasks: 2
  files: 3
requirements: [REWARD-CARD]
---

# Phase quick-260415-wnf Plan 01: RewardCard Toast Summary

**One-liner:** Carte reward slide-up spring depuis le bas avec avatar, compteur XP animé 0→N, barre niveau et sparkles à la validation d'une tâche.

## What Was Built

Remplacement du toast texte standard (showToast) par une carte reward animée (RewardCardToast) lors de la complétion d'une tâche.

### composant RewardCardToast (`components/gamification/RewardCardToast.tsx`)

- Slide-up spring depuis le bas (`withSpring`, `SPRING_IN: { damping: 14, stiffness: 160 }`)
- Dismiss automatique après 3s via timeout dans ToastContext + animation sortie spring vers le bas
- Layout carte : avatar emoji (32px) + nom profil | tâche barrée + compteur XP + barre progression | badge 🎁 si loot
- Compteur XP animé de 0 → N pts via polling JS easeOutCubic (~60fps, 850ms) — React `useState` + `setTimeout` loop
- Barre progression niveau animée : `withDelay(300, withTiming(progress, 600ms, easeOutCubic))`
- 4 sparkles en position absolue autour de la carte, chacune avec offsetX/Y et delay aléatoires
- Respect `useReducedMotion` : si true, valeurs directes (pas d'animations spring/timing)
- Couleurs via `useThemeColors()` exclusivement (jamais de hardcoded)

### ToastContext étendu (`contexts/ToastContext.tsx`)

- Nouveau state `rewardCard: RewardCardData | null`
- `showRewardCard(data)` : setRewardCard + setTimeout 3000ms pour hideRewardCard
- `hideRewardCard()` : setTimeout 400ms pour setRewardCard(null) après animation sortie
- `showToast()` existant 100% inchangé — les toasts erreur/info restent sur l'ancien système
- `ToastContextValue` expose `showRewardCard`

### Branchement tasks.tsx (`app/(tabs)/tasks.tsx`)

- Destructure `showRewardCard` depuis `useToast()`
- Import `calculateLevel, levelProgress, xpForLevel` depuis `lib/gamification`
- Dans `handleTaskToggle` : calcul `newPoints, newLevel, progress, nextLevelXP` → `showRewardCard(...)`
- `showToast(String(e), 'error')` dans le catch reste inchangé
- Import `getTheme` retiré (devenu inutilisé)

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `82837b5` | feat(quick-260415-wnf-01): créer RewardCardToast + étendre ToastContext |
| 2 | `5db78d5` | feat(quick-260415-wnf-01): brancher showRewardCard dans handleTaskToggle |

## Deviations from Plan

None — plan exécuté exactement comme écrit.

Note technique : Le plan suggérait `useAnimatedProps` sur un `Text` natif pour le compteur XP animé. Sur React Native, `children` n'est pas animatable via `useAnimatedProps`. L'implémentation utilise à la place un polling JS local (easeOutCubic, ~60fps, 850ms) — même résultat visuel, approche compatible RN.

## Known Stubs

Aucun stub. La carte reward est entièrement branchée sur les données réelles du profil actif et du système de gamification.

## Self-Check: PASSED

- [x] `components/gamification/RewardCardToast.tsx` — créé (commit 82837b5)
- [x] `contexts/ToastContext.tsx` — modifié (commit 82837b5)
- [x] `app/(tabs)/tasks.tsx` — modifié (commit 5db78d5)
- [x] `npx tsc --noEmit` — passe sans erreur
- [x] `showToast` erreur/info inchangé
- [x] `showRewardCard` exposé dans `ToastContextValue`
