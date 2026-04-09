---
phase: 20-moteur-d-effets-anti-abus
plan: 02
subsystem: gamification
tags: [securestore, anti-abus, caps, semantic-coupling, pure-functions]

# Dependency graph
requires:
  - phase: 19-détection-catégorie-sémantique
    provides: "CategoryId type, lib/semantic/categories.ts"
provides:
  - "lib/semantic/caps.ts — système anti-abus complet daily/weekly avec SecureStore"
  - "DAILY_CAPS + WEEKLY_CAPS pour les 10 CategoryId"
  - "loadCaps/saveCaps I/O SecureStore (clé coupling-caps-{profileId})"
  - "isCapExceeded() + incrementCap() pure functions testables"
  - "getWeekStart() helper exporté (calcul lundi semaine courante)"
  - "Barrel lib/semantic/index.ts mis à jour avec re-exports caps"
affects: [20-03-wiring, 20-04, 21-feedback-visuel, 22-ui-config, 23-musee-effets]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anti-abus caps: pure functions isCapExceeded/incrementCap + I/O séparé loadCaps/saveCaps (ARCH-03)"
    - "SecureStore par-profil: clé coupling-caps-{profileId} JSON stringifié (cohérent giftsSentToday)"
    - "Reset automatique jour/semaine via comparaison dayStart/weekStart (YYYY-MM-DD)"
    - "Cap daily 0 = pas de cap daily (ex: cuisine_repas — cap hebdo uniquement)"

key-files:
  created:
    - lib/semantic/caps.ts
  modified:
    - lib/semantic/index.ts

key-decisions:
  - "CAPS_KEY_PREFIX = 'coupling-caps-' — cohérent avec pattern giftsSentToday production"
  - "DAILY_CAPS.cuisine_repas = 0 (pas de cap daily) + WEEKLY_CAPS.cuisine_repas = 1 (EFFECTS-10)"
  - "isCapExceeded/incrementCap = pure functions avec param now?: Date pour testabilité sans mocks"
  - "Barrel index.ts mis à jour avant que plan 01 crée effects.ts — les deux blocs coexistent"

patterns-established:
  - "Pure function anti-abus: vérification et incrément séparés de l'I/O SecureStore"
  - "Reset implicite des compteurs périmés dans incrementCap (pas de cron job)"

requirements-completed: [SEMANTIC-07]

# Metrics
duration: 3min
completed: 2026-04-09
---

# Phase 20 Plan 02: Caps Anti-Abus Summary

**Système anti-abus caps daily/weekly persistés dans SecureStore via pure functions isCapExceeded/incrementCap + I/O loadCaps/saveCaps par profil**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T09:08:01Z
- **Completed:** 2026-04-09T09:11:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 créé + 1 modifié)

## Accomplishments

- Créé `lib/semantic/caps.ts` avec le système anti-abus complet : DAILY_CAPS + WEEKLY_CAPS pour les 10 CategoryId, I/O SecureStore (loadCaps/saveCaps), et pure functions (isCapExceeded/incrementCap) testables sans SecureStore
- Exporté getWeekStart() — calcul du lundi de la semaine courante en YYYY-MM-DD, utilisable dans les tests unitaires (SEMANTIC-07)
- Mis à jour le barrel `lib/semantic/index.ts` avec tous les re-exports caps (8 fonctions/constantes + 2 types)

## Task Commits

1. **Task 1: Créer lib/semantic/caps.ts** - `ba26594` (feat)
2. **Task 2: Mettre à jour le barrel index** - `cf66310` (feat)

## Files Created/Modified

- `lib/semantic/caps.ts` — Système anti-abus complet : EffectCap, CouplingCaps, DAILY_CAPS, WEEKLY_CAPS, getWeekStart, loadCaps, saveCaps, isCapExceeded, incrementCap
- `lib/semantic/index.ts` — Re-exports caps ajoutés (bloc Phase 20 — caps anti-abus)

## Decisions Made

- `DAILY_CAPS.cuisine_repas = 0` : pas de cap daily pour cuisine_repas (cap hebdo uniquement via `WEEKLY_CAPS.cuisine_repas = 1` — EFFECTS-10 : 1 recipe unlock / semaine)
- Pure functions `isCapExceeded` et `incrementCap` prennent `now?: Date` optionnel pour la testabilité sans mocks de Date
- `incrementCap` reset implicite : si le compteur est périmé (jour/semaine différente), il repart de 0+1 sans cron job ni migration
- Fichiers phase 19 (`categories.ts`, `derive.ts`, `flag.ts`, `index.ts`) récupérés depuis main via `git checkout main -- lib/semantic/` car le worktree parallèle partait d'un commit antérieur à phase 19

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Récupération des fichiers lib/semantic/ depuis main**
- **Found during:** Task 1 (initialisation)
- **Issue:** Le worktree parallèle `worktree-agent-aa87f3d0` était basé sur le commit `b4ff427` (avant phase 19) — `lib/semantic/` n'existait pas encore dans ce worktree
- **Fix:** `git checkout main -- lib/semantic/` pour récupérer les 4 fichiers phase 19 (categories.ts, derive.ts, flag.ts, index.ts) avant de créer caps.ts
- **Files modified:** lib/semantic/categories.ts, lib/semantic/derive.ts, lib/semantic/flag.ts, lib/semantic/index.ts (staged depuis main)
- **Verification:** `ls lib/semantic/` confirme les 4 fichiers présents, `npx tsc --noEmit` sans nouvelle erreur
- **Committed in:** ba26594 (Task 1 commit — inclus dans le même commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Déviation nécessaire pour que l'exécution parallèle dispose du contexte phase 19. Aucune régression.

## Issues Encountered

None — une fois les fichiers phase 19 récupérés, les deux tâches se sont exécutées sans problème.

## Next Phase Readiness

- `lib/semantic/caps.ts` prêt à être consommé par Plan 03 (dispatcher + wiring des 10 effets)
- Plan 01 (effects.ts) peut ajouter ses exports dans index.ts sans conflit — les blocs sont séparés
- Pure functions testables : Plan 02 des tests (si applicable) peut tester isCapExceeded/incrementCap sans SecureStore

---
*Phase: 20-moteur-d-effets-anti-abus*
*Completed: 2026-04-09*
