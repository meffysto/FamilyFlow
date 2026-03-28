---
phase: 03-gamification
plan: "01"
subsystem: mascot-diorama
tags: [particules, saisonnier, reanimated, diorama, accessibilite]
dependency_graph:
  requires: []
  provides: [SeasonalParticles]
  affects: [tree.tsx, diorama-visuel]
tech_stack:
  added: []
  patterns: [useReducedMotion, withRepeat/withSequence, absoluteFill overlay]
key_files:
  created:
    - components/mascot/SeasonalParticles.tsx
  modified:
    - app/(tabs)/tree.tsx
decisions:
  - "containerWidth=390 pour cohérence avec AmbientParticles (même convention absoluteFill)"
  - "zIndex:4 pour les particules saisonnières < zIndex:5 pour les horaires — les horaires dominent visuellement"
  - "Réduction count/2 (Math.ceil) quand AMBIENT_CONFIGS[getTimeSlot()] !== null pour éviter surcharge"
metrics:
  duration: "10 minutes"
  completed_date: "2026-03-28"
  tasks_completed: 2
  files_changed: 2
---

# Phase 03 Plan 01: Particules Saisonnières Diorama Summary

Composant `SeasonalParticles` animé avec Reanimated affichant fleurs de cerisier/étoiles/feuilles/flocons selon la saison réelle, intégré dans le diorama ferme de `tree.tsx` à zIndex inférieur aux particules horaires existantes.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Créer composant SeasonalParticles | c2d189b | components/mascot/SeasonalParticles.tsx |
| 2 | Intégrer SeasonalParticles dans tree.tsx | bc65811 | app/(tabs)/tree.tsx |

## What Was Built

### components/mascot/SeasonalParticles.tsx (194 lignes)

Composant autonome de particules emoji saisonnières :

- **4 saisons** : 🌸 printemps (chute lente, 6 particules), ✨ été (flottement, 4 particules), 🍂 automne (chute normale, 8 particules), ❄️ hiver (chute lente, 10 particules)
- **Animations Reanimated** : `useSharedValue` + `useAnimatedStyle` + `withRepeat`/`withSequence`/`withTiming`/`withDelay` — pattern identique à `AmbientParticles`
- **Accessibilité** : `useReducedMotion` désactive toutes les animations (retour `null` au niveau particule et composant principal)
- **Anti-surcharge** : quand `AMBIENT_CONFIGS[getTimeSlot()] !== null` (particules horaires actives), le count est divisé par 2 (`Math.ceil`) pour éviter l'accumulation visuelle
- **Positioning** : `containerWidth=390` (même convention qu'`AmbientParticles`), `startX = (index * 47 + 23) % containerWidth` (même formule)
- **Direction** : `down` → chute depuis Y=-20 vers `containerHeight+20` avec wobble ±12px ; `float` → oscillation ±15px vertical + ±12px horizontal

### app/(tabs)/tree.tsx

Ajout de la couche saisonnière dans le diorama :

- Import de `SeasonalParticles` depuis `../../components/mascot/SeasonalParticles`
- Nouveau bloc `<View zIndex:4>` avant le bloc AmbientParticles existant `<View zIndex:5>`
- Utilise la variable `season` déjà calculée (ligne 248, `const season = getCurrentSeason()`)
- Bloc AmbientParticles intact sans aucune modification

## Decisions Made

| Décision | Raison |
|----------|--------|
| `containerWidth=390` | Cohérence avec `AmbientParticles` — même convention pour absoluteFill |
| `zIndex:4` pour saisonnier | Les particules horaires (`zIndex:5`) dominent visuellement sur les saisonnières |
| Réduction count/2 avec Math.ceil | Évite surcharge quand lucioles de nuit + flocons d'hiver coexistent |
| Hooks appelés avant guard `if (reducedMotion) return null` | Respect des règles React hooks — aucun hook conditionnel |

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit` : 0 nouvelles erreurs (erreurs pré-existantes MemoryEditor/cooklang/useVault ignorées)
- `SeasonalParticles` présent dans `app/(tabs)/tree.tsx` et `components/mascot/SeasonalParticles.tsx`
- `SEASONAL_PARTICLES` importé et utilisé dans `components/mascot/SeasonalParticles.tsx`
- `useReducedMotion` présent aux deux niveaux (particule individuelle + composant principal)

## Self-Check: PASSED

- [x] components/mascot/SeasonalParticles.tsx créé (194 lignes, > 80 lignes min requis)
- [x] app/(tabs)/tree.tsx modifié avec import et `<SeasonalParticles season={season}`
- [x] Commit c2d189b existe
- [x] Commit bc65811 existe
