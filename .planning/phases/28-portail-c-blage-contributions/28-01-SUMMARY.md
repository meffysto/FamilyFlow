---
phase: 28-portail-c-blage-contributions
plan: 01
subsystem: ui
tags: [reanimated, portal, village, gamification, farm, contributions, toast]

# Dependency graph
requires:
  - phase: 27-cran-village-composants
    provides: ecran village.tsx accessible via router.push('/(tabs)/village')
  - phase: 26-hook-domaine-jardin
    provides: useGarden hook avec addContribution (ContributionType, profileId)
provides:
  - PortalSprite animé avec glow loop Reanimated dans tree.tsx remplacant le FAB temporaire
  - Fade cross-dissolve 400ms withTiming + navigation village depuis ferme perso
  - useFarm câblé avec onContribution callback (contributions 'harvest' automatiques)
  - useGamification câblé avec onContribution callback (contributions 'task' automatiques)
  - Toast '+1 Village 🏡' décalé 300ms dans tous les écrans de completion de tâches
affects:
  - 28-02 (village.tsx — RewardCard qui lit les contributions accumulées)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PortalSprite inline (< 80 lignes) avec glow withRepeat + scale spring tap — pattern composant animation-first"
    - "onContribution callback optionnel dans useFarm et useGamification — fire-and-forget non-critical"
    - "Toast village décalé 300ms pour éviter doublon avec toast sémantique (Pitfall 1)"
    - "runOnJS(router.push) dans withTiming callback pour navigation thread-safe depuis worklet Reanimated"
    - "useFocusEffect reset screenOpacity=1 au retour — pattern de reset état animations de navigation"

key-files:
  created: []
  modified:
    - app/(tabs)/tree.tsx
    - hooks/useFarm.ts
    - hooks/useGamification.ts
    - app/(tabs)/tasks.tsx
    - app/(tabs)/index.tsx
    - app/(tabs)/routines.tsx

key-decisions:
  - "SPRING_PORTAL = { damping: 12, stiffness: 200 } — constante module per CLAUDE.md"
  - "onContribution inséré après bloc Museum dans completeTask (pas dans applyTaskEffect qui est pure) — clarification D-05"
  - "fadeStyle appliqué sur le Animated.View diorama existant (FadeIn) — pas de wrapper supplémentaire"
  - "screenOpacity.value = 1 dans useFocusEffect (pas useEffect sur state) — reset fiable au retour"

patterns-established:
  - "Callback fire-and-forget non-critical : try { await cb(...) } catch { /* Village -- non-critical */ }"
  - "Toast discret village : setTimeout 300ms + try/catch silencieux pour éviter crash si ToastContext absent"

requirements-completed: [MAP-03, COOP-01, COOP-02]

# Metrics
duration: 12min
completed: 2026-04-11
---

# Phase 28 Plan 01: Portail + Câblage Contributions Summary

**PortalSprite Reanimated (glow loop 1200ms + spring tap) remplace le FAB dans tree.tsx, avec câblage auto-contribution village dans useFarm (récoltes) et useGamification (tâches) via callback onContribution + toast '+1 Village 🏡' décalé 300ms**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-11T06:05:00Z
- **Completed:** 2026-04-11T06:17:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- PortalSprite inline avec glow loop Reanimated (withRepeat/withTiming 1200ms), scale spring tap SPRING_PORTAL et accessibilityLabel — remplace le FAB temporaire
- Fade cross-dissolve 400ms (withTiming + runOnJS + useFocusEffect reset) pour la navigation ferme → village
- useFarm câblé avec onContribution optionnel — appelle addContribution('harvest', profileId) après chaque récolte (chemin golden + chemin standard)
- useGamification câblé avec onContribution optionnel — appelle addContribution('task', profile.id) dans completeTask après le bloc Musée, avec toast village décalé 300ms
- tasks.tsx, index.tsx, routines.tsx mis à jour pour passer addContribution — loot.tsx inchangé (openLootBox uniquement)

## Task Commits

1. **Task 1: Portail animé + câblage useFarm contribution récolte** - `8383c1f` (feat)
2. **Task 2: Câblage useGamification contribution tâches + toast dans tous les écrans** - `1c4c429` (feat)

## Files Created/Modified

- `app/(tabs)/tree.tsx` — PortalSprite inline + useGarden import + addContribution dans useFarm + fade navigation + styles portail (FAB supprimé)
- `hooks/useFarm.ts` — ContributionType import + onContribution paramètre + onContribution après onQuestProgress dans harvest (2 chemins)
- `hooks/useGamification.ts` — ContributionType import + onContribution dans UseGamificationArgs + appel après bloc Musée + toast 300ms
- `app/(tabs)/tasks.tsx` — useGarden import + addContribution + onContribution dans useGamification
- `app/(tabs)/index.tsx` — useGarden import + addContribution + onContribution dans useGamification
- `app/(tabs)/routines.tsx` — useGarden import + addContribution + onContribution dans useGamification

## Decisions Made

- **onContribution inséré après bloc Musée dans completeTask** (pas dans `applyTaskEffect` qui est une fonction pure) — D-05 clarification confirmée
- **fadeStyle appliqué sur l'Animated.View diorama existant** (`FadeIn.duration(600)`) — évite un wrapper supplémentaire inutile
- **runOnJS(router.push)** dans le callback withTiming — seule façon thread-safe d'appeler router depuis un worklet Reanimated
- **SPRING_PORTAL comme constante module** (pas inline) per CLAUDE.md convention spring configs

## Deviations from Plan

None — plan exécuté exactement comme spécifié.

## Issues Encountered

None.

## User Setup Required

None - aucune configuration externe requise.

## Next Phase Readiness

- Phase 28-02 (RewardCard + bonus XP collectif) peut utiliser les contributions accumulées via useGarden
- Le portail dans tree.tsx est opérationnel et navigue vers village.tsx

---
*Phase: 28-portail-c-blage-contributions*
*Completed: 2026-04-11*
