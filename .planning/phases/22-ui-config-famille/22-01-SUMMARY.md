---
phase: 22-ui-config-famille
plan: "01"
subsystem: lib/semantic
tags: [semantic-coupling, overrides, stats, i18n, gamification]
dependency_graph:
  requires: [phase-20-caps, phase-21-effect-toasts]
  provides: [coupling-overrides-module, week-stats, category-filter-hook]
  affects: [hooks/useGamification.ts, lib/semantic/index.ts]
tech_stack:
  added: []
  patterns: [module-level-cache, secure-store-persistence, if-else-override-gate]
key_files:
  created:
    - lib/semantic/coupling-overrides.ts
  modified:
    - lib/semantic/index.ts
    - hooks/useGamification.ts
    - locales/fr/common.json
    - locales/en/common.json
decisions:
  - "Cache module-level _overridesCache pour eviter acces SecureStore sur hot path (Pitfall 6)"
  - "isCategoryEnabled: cle absente = active par defaut (D-02a) — opt-out pattern"
  - "incrementWeekStat silencieux avec try/catch inline (stats non-critical)"
  - "Override check avant caps check — categorie desactivee coupe-circuit complet"
metrics:
  duration: "3min"
  completed: "2026-04-09"
  tasks_completed: 3
  files_modified: 5
requirements_satisfied: [COUPLING-03, COUPLING-05, COUPLING-06]
---

# Phase 22 Plan 01: Coupling Overrides + Stats — Data Layer Summary

**One-liner:** Module coupling-overrides.ts avec cache SecureStore, filtrage per-categorie dans completeTask, et 14 cles i18n FR+EN pour l'ecran Settings Phase 22-02.

## What Was Built

### lib/semantic/coupling-overrides.ts (nouveau)

Module pur exposant 7 exports requis par les must_haves du plan :

- `OVERRIDES_KEY = 'semantic-overrides'` — cle SecureStore
- `WEEK_STATS_KEY = 'semantic-stats-week'` — cle SecureStore stats
- `loadOverrides()` — avec cache module-level `_overridesCache` (evite 5-15ms SecureStore sur hot path)
- `saveOverrides()` — met a jour le cache + persiste
- `isCategoryEnabled()` — opt-out pattern (cle absente = active)
- `loadWeekStats()` — avec reset auto si weekKey change
- `incrementWeekStat()` — silencieux (non-critical)

Pattern SecureStore identique a flag.ts (`import * as SecureStore from 'expo-secure-store'`). `getWeekStart` reuse depuis `./caps` (pas de duplication — decision STATE.md Phase 20-04).

### hooks/useGamification.ts (modifie)

Injection dans le bloc Phase 20 de `completeTask()` :

1. **COUPLING-03** (D-02c) : override check avant caps check
   ```
   if (!isCategoryEnabled(category.id, overrides)) {
     // skip
   } else if (!isCapExceeded(...)) {
     // bloc existant intact
   ```
2. **COUPLING-05** (D-04b) : `incrementWeekStat` apres `saveCaps` dans `effectResult.effectApplied`

### locales/fr + en/common.json (modifies)

18 cles ajoutees en parite stricte FR+EN :
- `settingsScreen.rows.coupling` + `.couplingSubtitle` (x2 langues = 4 cles)
- `settingsScreen.modalTitles.coupling` (x2 = 2 cles)
- `settings.coupling.*` : 10 cles (masterTitle, masterSubtitle, weekStatsTotal_zero/one/other, weekStatsCat_zero/one/other, variantAmbient/Rare/Golden, disabledHint)

## Commits

| Task | Nom | Commit | Fichiers |
|------|-----|--------|----------|
| 1 | Creer coupling-overrides.ts + barrel | f629461 | lib/semantic/coupling-overrides.ts, lib/semantic/index.ts |
| 2 | Injecter overrides check + stats | cb47422 | hooks/useGamification.ts |
| 3 | Ajouter cles i18n FR+EN | b11bf1a | locales/fr/common.json, locales/en/common.json |

## Decisions Made

1. **Cache module-level** `_overridesCache` — evite 5-15ms SecureStore a chaque tache completee (hot path). Cache invalide uniquement via `saveOverrides()` (ecran Settings Plan 02).
2. **Opt-out pattern** pour isCategoryEnabled — cle absente = categorie active. Nouvel utilisateur voit tous les effets sans configuration requise.
3. **Override check gate** structure `if (!enabled) {} else if (!capped)` — categorie desactivee court-circuite avant le check cap, coherent avec la semantique "la preference utilisateur prime sur les limites systeme".
4. **incrementWeekStat inline silencieux** — `try { await ... } catch {}` en une ligne pour signaler visuellement le caractere non-critique de ces stats (versus les caps qui sont critiques pour l'anti-abus).

## Deviations from Plan

None — plan execute exactement comme ecrit.

## Known Stubs

None — module pur sans donnees hardcodees. L'ecran Settings (Plan 02) consommera `loadOverrides`/`saveOverrides`/`loadWeekStats` pour afficher et modifier les overrides.

## Self-Check: PASSED

- `lib/semantic/coupling-overrides.ts` — FOUND
- `lib/semantic/index.ts` exports Phase 22 — FOUND
- `hooks/useGamification.ts` COUPLING-03 + COUPLING-05 — FOUND
- `locales/fr/common.json` coupling keys — FOUND
- `locales/en/common.json` coupling keys — FOUND
- Commits f629461, cb47422, b11bf1a — FOUND
- `npx tsc --noEmit` — PASSED (0 nouvelles erreurs)
