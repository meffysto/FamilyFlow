---
phase: quick-260428-g5n
plan: 01
subsystem: courses
tags: [courses, optimistic-ui, hooks, ux-perf]
requires:
  - quick-260428-fnw (Phase A — queue d'écritures séquentielle)
provides:
  - "useVaultCourses 6/6 writes optimistes (add/toggle/remove/move/merge/clear)"
  - "CourseItem.pending?: boolean (transient, non sérialisé)"
  - "Indicateur visuel opacity 0.6 sur courseRow pending"
affects:
  - hooks/useVaultCourses.ts
  - lib/types.ts
  - app/(tabs)/meals.tsx
tech-stack:
  added: []
  patterns:
    - "Optimistic UI : mutation synchrone setState AVANT enqueueWrite, rollback en catch"
    - "Snapshot via coursesRef.current (useRef + useEffect sync) — capture hors closure"
    - "tempId pattern pour add (filter-rollback) vs snapshot pattern pour les autres"
    - "parseCourses post-write = source de vérité finale (nettoie pending naturellement)"
key-files:
  created: []
  modified:
    - lib/types.ts
    - hooks/useVaultCourses.ts
    - app/(tabs)/meals.tsx
decisions:
  - "Pending purement transient — jamais persisté (parseCourses ne le réémet pas, c'est l'effet voulu)"
  - "Mutation optimiste AVANT enqueueWrite (pas dans la callback) pour visibilité immédiate sans attendre la queue"
  - "Snapshot via coursesRef.current capturé AVANT setCourses optimiste pour rollback fidèle"
  - "merge accepte un flash de doublons pendant l'I/O (parseCourses post-write dédup et reconcilie)"
  - "Pas d'animation Reanimated sur pending — opacity statique suffit pour le scope (pas de spinner)"
  - "useCallback dependencies inchangées [enqueueWrite] (refs stables, pas besoin de coursesRef)"
metrics:
  duration: ~3min
  completed: 2026-04-28
---

# Quick Task 260428-g5n: Phase B Courses Optimistic UI Summary

Refactor du hook `useVaultCourses` pour appliquer Optimistic UI sur tous les writes (add/toggle/remove/move/merge/clear), avec rollback automatique en cas d'erreur d'écriture vault et indicateur visuel `opacity: 0.6` sur les rows en cours d'écriture.

## Objective Met

Suppression de la latence perçue (lecture vault iCloud + parse) sur les 6 writes du domaine courses. La queue séquentielle Phase A (260428-fnw) garantit l'ordre des I/O, l'Optimistic UI Phase B garantit la fluidité visuelle. L'API publique `UseVaultCoursesResult` reste strictement inchangée, donc `meals.tsx` compile sans modification de signature.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Champ transient `pending?: boolean` sur CourseItem | 46b1264 | lib/types.ts |
| 2 | Refactor useVaultCourses — 6 writes optimistes + rollback | 48e5407 | hooks/useVaultCourses.ts |
| 3 | Indicateur visuel opacity 0.6 sur courseRow pending | 0f864c0 | app/(tabs)/meals.tsx |

## Implementation Details

### CourseItem.pending (lib/types.ts)
Champ optionnel `pending?: boolean` ajouté avec commentaire de garde **JAMAIS sérialisé**. `parseCourses` n'a pas été touché — il retourne naturellement des items sans `pending`, ce qui efface le flag à la réconciliation post-write (effet voulu).

### useVaultCourses (hooks/useVaultCourses.ts)
- **coursesRef + useEffect sync** : `useRef<CourseItem[]>([])` synchronisé sur `[courses]` pour capturer un snapshot synchrone hors du closure setState.
- **makeTempId()** : helper non exporté `tmp-${Date.now()}-${random36}` pour les ID des items optimistes.
- **addCourseItem** : génère `tempId`, push optimiste avec `pending:true` AVANT `enqueueWrite`. En catch, filter par tempId. Sinon `parseCourses` final remplace l'item temp par le vrai (avec lineIndex correct, sans pending).
- **toggleCourseItem** : `snapshot = coursesRef.current` puis flip `completed` avec `pending:true`. Au succès : repasse `pending:false`. En catch : `setCourses(snapshot)`.
- **removeCourseItem** : snapshot puis filter immédiat par lineIndex. Au succès : `parseCourses` réconcilie le shift des lineIndex restants. En catch : restore snapshot.
- **moveCourseItem** : snapshot puis update section optimiste sur l'item ciblé avec `pending:true`. Au succès : reparse. En catch : restore snapshot.
- **mergeCourseIngredients** : snapshot puis push de tous les optimistics avec `pending:true`. Le flash de doublons pendant l'I/O est accepté (parseCourses post-write est source de vérité). Retour `{ added, merged }` inchangé.
- **clearCompletedCourses** : snapshot puis filter `!completed` immédiat. En catch : restore snapshot.

### Indicateur visuel (app/(tabs)/meals.tsx)
Style conditionnel `item.pending && { opacity: 0.6 }` ajouté au tableau de styles de `<View>` `courseRow`. Pas d'animation Reanimated, pas de spinner — opacité statique seule, conforme au scope.

## Verification

`npx tsc --noEmit` : **0 erreur** (pass complet, pas seulement pas de nouvelle erreur).

## Deviations from Plan

None — plan exécuté exactement comme écrit.

## Self-Check: PASSED

- FOUND: lib/types.ts (CourseItem.pending champ ajouté)
- FOUND: hooks/useVaultCourses.ts (6 writes optimistes + coursesRef)
- FOUND: app/(tabs)/meals.tsx (style opacity conditionnel)
- FOUND commit 46b1264 (Task 1)
- FOUND commit 48e5407 (Task 2)
- FOUND commit 0f864c0 (Task 3)
- TS check : 0 erreur
