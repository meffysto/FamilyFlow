---
quick_id: 260331-jro
title: Créer composant PressableScale + appliquer sur DashboardCard
subsystem: components/ui
tags: [animation, reanimated, haptics, ui-primitive, dashboard]
dependency_graph:
  requires: [react-native-reanimated, expo-haptics]
  provides: [PressableScale]
  affects: [DashboardCard, components/ui/index.ts]
tech_stack:
  added: [PressableScale]
  patterns: [spring-animation, haptic-feedback, reduced-motion]
key_files:
  created:
    - components/ui/PressableScale.tsx
  modified:
    - components/ui/index.ts
    - components/DashboardCard.tsx
decisions:
  - Pressable (pas TouchableOpacity) pour respecter les conventions du plan
  - onPressIn déclenche scale + haptic, onPressOut remet scale à 1
  - PressableScale wraps le GlassView/View entier — le bouton "Voir tout →" reste inchangé à l'intérieur
  - Quand onPressMore absent, DashboardCard retourne directement GlassView/View (aucun overhead)
metrics:
  duration_minutes: 8
  completed_date: 2026-03-31
  tasks_completed: 2
  files_changed: 3
---

# Quick 260331-jro: PressableScale + DashboardCard

**One-liner:** Composant Pressable Reanimated spring-scale (0.97) avec haptics + réduction de mouvement, intégré comme wrapper optionnel de DashboardCard.

## Tasks Completed

| # | Task | Commit |
|---|------|--------|
| 1 | Créer PressableScale component | 21e0dda |
| 2 | Intégrer PressableScale dans DashboardCard | e07f2d2 |

## Implementation Notes

### PressableScale (`components/ui/PressableScale.tsx`)

- `useSharedValue(1)` + `useAnimatedStyle` → `transform: [{ scale }]`
- `withSpring(scaleValue, { damping: 15, stiffness: 150 })` au `onPressIn`
- `withSpring(1, SPRING_CONFIG)` au `onPressOut`
- `Haptics.selectionAsync()` déclenché au `onPressIn`
- `useReducedMotion()` — animations désactivées si accessibilité réduite
- Props: `onPress`, `style`, `scaleValue` (défaut 0.97), `disabled`
- Export `React.memo` + ajout au barrel `components/ui/index.ts`

### DashboardCard (`components/DashboardCard.tsx`)

- Import `PressableScale` depuis `./ui/PressableScale`
- Les deux chemins de rendu (`glass` + non-glass) wrappés conditionnellement
- Pattern : card JSX extrait en variable locale → retour conditionnel avec/sans `PressableScale`
- Comportement inchangé quand `onPressMore` est absent

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

## Self-Check

- [x] `components/ui/PressableScale.tsx` créé
- [x] `components/ui/index.ts` mis à jour avec export PressableScale
- [x] `components/DashboardCard.tsx` intègre PressableScale
- [x] `npx tsc --noEmit` — aucune nouvelle erreur (30 erreurs pré-existantes inchangées)
- [x] Commits 21e0dda + e07f2d2 présents

## Self-Check: PASSED
