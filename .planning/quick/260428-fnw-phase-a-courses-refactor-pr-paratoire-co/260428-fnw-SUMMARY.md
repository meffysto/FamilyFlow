---
phase: quick-260428-fnw
plan: 01
subsystem: courses
tags: [refactor, courses, vault, race-condition, bug-fix]
requires: []
provides:
  - lib/courses-constants.ts (3 exports)
  - useVaultCourses queue d'écritures
  - fix bug #37 décochage sans refresh global
affects:
  - hooks/useVaultCourses.ts
  - app/(tabs)/meals.tsx
tech_added: []
patterns:
  - "Queue de promesses partagée (writeQueueRef + enqueueWrite) pour sérialiser les writes vault"
  - "Constantes vault domaine centralisées dans lib/<domain>-constants.ts"
key_files_created:
  - lib/courses-constants.ts
key_files_modified:
  - hooks/useVaultCourses.ts
  - app/(tabs)/meals.tsx
decisions:
  - "D-01 : COURSES_DEFAULT_SECTION = '📦 Divers' (avec emoji) — aligne sur les autres sections vault courses"
  - "D-02 : Suffixe LEGACY (COURSES_FILE_LEGACY) — Phase D le remplacera par dossier Listes/"
  - "D-04 : Pattern queue chain.then(fn, fn) — la chaîne ne casse jamais sur erreur, l'erreur reste rejetée à l'appelant"
metrics:
  duration: ~12min
  tasks: 3
  files: 3
  commits: 3
completed: 2026-04-28
---

# Quick Task 260428-fnw : Phase A Courses — Refactor préparatoire Summary

Refactor préparatoire courses (Phase A) : centralisation des constantes vault domaine, fix du bug #37 (refresh global au décochage), et sérialisation des écritures vault dans useVaultCourses pour éliminer les races avant Phase B (optimistic UI) et Phase D (listes multiples). Zéro changement UI visible (sauf cosmétique label section "Divers" → "📦 Divers"), zéro nouvelle dépendance.

## Tasks Completed

| # | Name | Commit |
|---|------|--------|
| 1 | Créer lib/courses-constants.ts + brancher useVaultCourses + meals.tsx | 9cbe630 |
| 2 | Fix #37 — toggleCourseItem au lieu de refresh() global au décochage | dc9bb5b |
| 3 | Queue d'écritures séquentielle (enqueueWrite) dans useVaultCourses | 6dd223d |

## Files

### Created

- `lib/courses-constants.ts` — 3 exports : `COURSES_FILE_LEGACY`, `COURSES_DEFAULT_SECTION` (`📦 Divers`), `COURSES_LISTS_DIR` (réservé Phase D).

### Modified

- `hooks/useVaultCourses.ts`
  - Suppression hardcode `COURSES_FILE` local → import `COURSES_FILE_LEGACY` depuis `lib/courses-constants`.
  - Ajout `useRef` à l'import React.
  - Helper `enqueueWrite<T>(fn)` + `writeQueueRef` au début du hook.
  - Les 6 fonctions d'écriture (`addCourseItem`, `toggleCourseItem`, `removeCourseItem`, `moveCourseItem`, `mergeCourseIngredients`, `clearCompletedCourses`) wrappées dans `enqueueWrite(async () => {...})`. `resetCourses` non concerné (state-only).
  - API publique `UseVaultCoursesResult` strictement inchangée.
- `app/(tabs)/meals.tsx`
  - Suppression hardcode `COURSES_FILE` local + import `COURSES_FILE_LEGACY, COURSES_DEFAULT_SECTION` depuis `../../lib/courses-constants`.
  - Fallbacks `c.section ?? 'Divers'` (lignes 555 et 568) → `c.section ?? COURSES_DEFAULT_SECTION`.
  - `toggleCourseItem` ajouté au destructuring `useVault()`.
  - `handleCourseToggle` branche décochage : `vault.toggleTask(...) + refresh()` → `toggleCourseItem(item, false)` (update local optimisé, plus de refresh global).
  - Deps useCallback : `refresh` retiré, `toggleCourseItem` ajouté.

## Decisions Made

- **D-01 emoji 📦 Divers** : aligne sur le pattern des autres sections vault courses (🥩, 🥬, etc.). Cosmétique acceptable, intentionnel.
- **D-02 suffixe LEGACY** : `COURSES_FILE_LEGACY` documente l'intention de migration Phase D vers dossier `Listes/` multi-listes.
- **D-04 queue tolérante aux erreurs** : `chain.then(fn, fn)` puis `next.catch(() => undefined)` pour la chaîne — l'erreur d'une opération est rejetée à l'appelant via la promesse retournée mais la queue continue (les opérations suivantes ne sont pas bloquées).

## Verification

- `npx tsc --noEmit` : 0 nouvelle erreur dans le scope (`courses-constants.ts`, `useVaultCourses.ts`, `meals.tsx`). Erreurs pré-existantes documentées dans `CLAUDE.md` (`MemoryEditor.tsx`, `cooklang.ts`, `useVault.ts`) non modifiées.
- `grep -rn "'02 - Maison/Liste de courses.md'" hooks/ app/` → vide (aucun hardcode résiduel dans le mobile, hors `apps/desktop/**` D-03).
- `grep -n "?? 'Divers'" app/(tabs)/meals.tsx` → vide.
- `grep -c "enqueueWrite" hooks/useVaultCourses.ts` → 13 occurrences (1 helper + 1 useCallback dep × 6 + 6 wrappers).
- API publique `UseVaultCoursesResult` : diff = 0 lignes.

## Deviations from Plan

None — plan exécuté exactement comme écrit.

## Self-Check: PASSED

- FOUND: lib/courses-constants.ts
- FOUND: 9cbe630 (Task 1 commit)
- FOUND: dc9bb5b (Task 2 commit)
- FOUND: 6dd223d (Task 3 commit)
- tsc clean dans le scope, 0 nouvelle erreur

## Next Steps

- Phase B (optimistic UI courses) peut s'appuyer sur la queue `enqueueWrite` pour wrapper les rollbacks proprement.
- Phase D (listes multiples) substituera `COURSES_FILE_LEGACY` par `COURSES_LISTS_DIR + slug` ; la centralisation actuelle réduit la surface du diff à 1 fichier (`courses-constants.ts`) pour le path principal.
