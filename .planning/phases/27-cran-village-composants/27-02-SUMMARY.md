---
phase: 27-cran-village-composants
plan: 02
subsystem: ui
tags: [react-native, expo-router, tilemap, village, cooperative, useGarden, LiquidXPBar, CollapsibleSection, ReactiveAvatar]

requires:
  - phase: 27-01
    provides: TileMapRenderer mode='village', FAB portail ferme→village, composants ui LiquidXPBar/ReactiveAvatar
  - phase: 26-02
    provides: useGarden hook avec gardenData, progress, currentTarget, isGoalReached, weekHistory, claimReward

provides:
  - "Écran Place du Village (app/(tabs)/village.tsx) navigable via FAB depuis la ferme"
  - "Carte TileMapRenderer mode='village' (cobblestone) en haut de l'écran (42%)"
  - "Barre de progression collective LiquidXPBar câblée sur useGarden()"
  - "Feed de contributions cette semaine avec heure relative (il y a Nh, hier, lun.)"
  - "Indicateurs par membre actif avec ReactiveAvatar mood='idle'"
  - "Panneau historique CollapsibleSection avec ids préfixés village_week_"
  - "Bouton 'Réclamer la récompense' avec FadeInDown + guard claimedThisSession"

affects: [Phase 28, portail arbre, contributions, village, jardin-familial]

tech-stack:
  added: []
  patterns:
    - "Double hook pattern — useVault() pour profils + useGarden() pour données village (Pitfall 7)"
    - "Guard post-claim session via claimedThisSession state local (Pitfall 4)"
    - "CollapsibleSection ids préfixés village_week_ pour éviter collision avec tree.tsx (Pitfall 2)"
    - "React.memo sur FeedItem — list item statique mémoïsé"
    - "formatRelativeTime() hors composant — heure relative en français"
    - "Profile.avatar (pas emoji) — champ correct dans l'interface Profile"

key-files:
  created:
    - "app/(tabs)/village.tsx — Écran Place du Village complet (621 lignes)"
  modified: []

key-decisions:
  - "Profile.avatar utilisé (pas .emoji) — correction déviée par TypeScript lors du check initial"
  - "Historique n'affiche pas le détail par membre (VillageWeekRecord ne le contient pas — Pitfall 5)"
  - "Profils actifs filtrés avec statut !== 'grossesse' (per Phase 26 decision)"

patterns-established:
  - "village_week_ prefix: tous les IDs CollapsibleSection liés au village portent ce préfixe"
  - "Double-hook pattern: useVault() + useGarden() coexistent dans village.tsx sans provider supplémentaire"

requirements-completed: [MAP-01, COOP-03, COOP-04, OBJ-02, HIST-01, HIST-02]

duration: 8min
completed: 2026-04-10
---

# Phase 27 Plan 02: Écran Village Summary

**Écran Place du Village complet — carte cobblestone TileMapRenderer mode='village', barre LiquidXPBar collective, feed contributions avec heure relative, indicateurs ReactiveAvatar par membre, historique CollapsibleSection — câblé sur useGarden() et useVault()**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-10T21:18:44Z
- **Completed:** 2026-04-10T21:26:00Z
- **Tasks:** 1/2 (Task 2 = checkpoint:human-verify)
- **Files modified:** 1

## Accomplishments

- Écran village navigable complet (621 lignes) câblé sur useGarden() et useVault()
- Carte tilemap cobblestone mode='village' en haut de l'écran (42% de la hauteur)
- Barre LiquidXPBar verte (progression) → dorée (objectif atteint) avec bouton claim animé FadeInDown
- Feed contributions avec heure relative en français, mémoïsé (FeedItem React.memo)
- Indicateurs membres actifs via ReactiveAvatar mood='idle' (filtrés grossesse)
- Panneau historique CollapsibleSection ids préfixés `village_week_` pour éviter collisions

## Task Commits

1. **Task 1: Créer l'écran village.tsx complet** - `9027403` (feat)

## Files Created/Modified

- `app/(tabs)/village.tsx` — Écran Place du Village complet avec toutes les sections (621 lignes)

## Decisions Made

- **Profile.avatar** utilisé à la place de `.emoji` — corrigé après détection TypeScript (TS2339)
- **Historique limité à cible/total/statut** — VillageWeekRecord ne stocke pas le détail par membre (Pitfall 5 respecté)
- **Profils actifs filtrés statut !== 'grossesse'** — cohérent avec Phase 26 decision et useGarden.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrigé Profile.avatar au lieu de Profile.emoji**
- **Found during:** Task 1 (vérification tsc --noEmit)
- **Issue:** Le plan spécifiait `profile.emoji` mais l'interface Profile utilise `avatar: string` — TypeScript TS2339 sur 2 lignes
- **Fix:** Remplacé `profile?.emoji` par `profile?.avatar` dans FeedItem et la section membres
- **Files modified:** app/(tabs)/village.tsx (2 lignes)
- **Verification:** tsc --noEmit passe sans erreur
- **Committed in:** 9027403 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug - champ Profile incorrect dans le plan)
**Impact on plan:** Correction mineure, aucun impact sur le comportement. Le plan documentait `.emoji` mais le type réel est `.avatar`.

## Issues Encountered

Aucun problème bloquant. TypeScript a détecté le mauvais champ Profile au premier check, corrigé immédiatement.

## Known Stubs

Aucun stub — toutes les données sont câblées sur `useGarden()` et `useVault()`. Les états vides ("Pas encore de contributions", "L'historique...") sont des états légitimes de l'UI (pas des placeholders).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Écran village complet et navigable via le FAB créé en Phase 27-01
- Toutes les requirements MAP-01, COOP-03, COOP-04, OBJ-02, HIST-01, HIST-02 couvertes
- Prêt pour Phase 28 — portail transition ferme → village et câblage des contributions automatiques (récoltes → addContribution)
- Task 2 (checkpoint:human-verify) requiert vérification visuelle humaine sur device

## Self-Check: PASSED

- [x] `app/(tabs)/village.tsx` existe (621 lignes)
- [x] Commit `9027403` présent
- [x] tsc --noEmit passe sans nouvelles erreurs
- [x] useGarden() et useVault() câblés
- [x] TileMapRenderer mode="village" présent
- [x] LiquidXPBar avec color={barColor} présent
- [x] CollapsibleSection avec id préfixe `village_week_` présent
- [x] ReactiveAvatar avec mood="idle" présent
- [x] formatRelativeTime présent
- [x] React.memo sur FeedItem présent
- [x] claimedThisSession présent (Pitfall 4)
- [x] Haptics.notificationAsync dans handleClaim
- [x] router.back() dans le header
- [x] FadeInDown pour animation bouton claim
- [x] Textes FR : "Place du Village", "Objectif de la semaine", "Contributions cette semaine", "Membres actifs", "Semaines précédentes"

---
*Phase: 27-cran-village-composants*
*Completed: 2026-04-10*
