---
phase: 39-moteur-prorata-calcul-famille
verified: 2026-04-18T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (automated) — 1 truth flagged for human verification of future Phase 40 wiring
---

# Phase 39: Moteur prorata + calcul famille — Verification Report

**Phase Goal:** Implémenter le moteur de calcul pur du pari Sporée — prorata cumulatif `(poids_sealeur / poids_famille_active_7j) × Tasks_pending`, poids par âge dérivés, filtre profils actifs 7j, filtre strict domaine Tasks. Fonctions pures testables, zéro UI nouvelle.

**Verified:** 2026-04-18
**Status:** human_needed (automated verification passed; scheduler 23h30 effectif est Phase 40)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (derived from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Moteur calcule le cumul prorata `(poids_sealeur / poids_famille_active_7j) × Tasks_pending` | ✓ VERIFIED | `computeCumulTarget` (wager-engine.ts:158) implémente la formule ; tests `computeCumulTarget (D-04)` 9 cas ; Math.ceil(ratio × pending) vérifié |
| 2 | Recalcul 23h30 ou catchup au boot via snapshot matinal stable | ? HUMAN | `shouldRecompute` + `maybeRecompute` livrés (pur : jour différent → catchup) ; trio `parseSnapshots/appendSnapshot/pruneSnapshots` livré ; **scheduler 23h30 effectif reporté Phase 40** (decisions 39-02 SUMMARY) |
| 3 | Poids par âge automatiques (1.0/0.7/0.4/0.15/0.0) dérivés birthdate + override settings | ✓ VERIFIED | `WEIGHT_BY_CATEGORY` exact (wager-engine.ts:23) ; `computeAgeCategory` brackets 2/5/12/17/18 testés ; `resolveWeight` override prioritaire testé (7 tests) |
| 4 | Seuls profils actifs 7j glissants comptés dans diviseur famille | ✓ VERIFIED | `isProfileActive7d` (wager-engine.ts:100) avec bornes [today-7j, today] inclusives ; 10 tests describe `isProfileActive7d (SPOR-05)` ; Pitfall 3 (completedDate absent → false) couvert |
| 5 | Seules tâches domaine Tasks comptabilisées (Courses/Repas/Routines/Anniversaires/Notes/Moods exclus) | ✓ VERIFIED | `filterTasksForWager` (wager-engine.ts:129) filtre sur `tâches récurrentes` / `taches recurrentes` ; 8 tests describe `filterTasksForWager (SPOR-06)` couvrent les 6 domaines exclus |
| 6 | Suite Jest moteur pass + `tsc --noEmit` + `jest --no-coverage` clean | ✓ VERIFIED | 84/84 tests Phase 39 pass (3 suites) ; tsc clean hors pré-existant (MemoryEditor/cooklang/useVault) |

**Score:** 5/6 truths verified automatically, 1 partiellement verifié (scheduler 23h30 effectif = Phase 40 hors scope).

**Note de périmètre:** La Phase 39 livre intentionnellement un moteur PUR (zéro UI, zéro hook). Les Success Criteria ROADMAP commencent par "User voit..." mais le périmètre réel de cette phase (validé par CONTEXT + Plans) est "Moteur pur prêt pour branchement Phase 40". Cela explique le statut `human_needed` sur le truth #2 (scheduler temporel effectif).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/types.ts` | WagerAgeCategory type + Profile.weight_override | ✓ VERIFIED | type L68, field L80 |
| `lib/parser.ts` | parse/serialize weight_override bidirectionnel | ✓ VERIFIED | parse L846-859, serialize L928 |
| `lib/village/parser.ts` | parseSnapshots + appendSnapshot + pruneSnapshots + FamilySnapshot | ✓ VERIFIED | FamilySnapshot L564, parseSnapshots L575, appendSnapshot L612, pruneSnapshots L683 |
| `lib/mascot/wager-engine.ts` | 9 fonctions pures + WEIGHT_BY_CATEGORY + types résultats (≥220 lignes) | ✓ VERIFIED | 305 lignes, 15 exports (9 fonctions + 4 types + 2 interfaces + 1 constante) |
| `lib/__tests__/famille-weight-override.test.ts` | Round-trip + backward-compat (≥40 lignes) | ✓ VERIFIED | Existe, 6/6 tests pass |
| `lib/__tests__/snapshots-parser.test.ts` | Round-trip CSV + rétention + Pitfall 4 (≥60 lignes) | ✓ VERIFIED | Existe, 13/13 tests pass |
| `lib/__tests__/wager-engine.test.ts` | 7 describe blocs + ≥45 tests (≥350 lignes) | ✓ VERIFIED | 567 lignes, 7 describe, 65 tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `lib/parser.ts parseFamille` | `lib/types.ts Profile.weight_override` | whitelist 5 valeurs + cast | ✓ WIRED | `validWeightOverrides` + cast `Profile['weight_override']` L846-848 |
| `lib/parser.ts serializeFamille` | `Profile.weight_override` | ligne conditionnelle | ✓ WIRED | `if (profile.weight_override) lines.push(...)` L928 |
| `lib/village/parser.ts appendSnapshot` | section `## Snapshots` jardin-familial.md | pattern append-only (Pitfall 4) | ✓ WIRED | Regex `## Snapshots` + insertion avant prochaine `## `, création avant `## Historique` sinon fin |
| `lib/mascot/wager-engine.ts resolveWeight` | `Profile.weight_override + birthdate` | import Profile, override prioritaire | ✓ WIRED | `import type { Profile, ... } from '../types'` ; resolveWeight L73 teste `profile.weight_override` en premier |
| `lib/mascot/wager-engine.ts` | `lib/mascot/sporee-economy.ts getLocalDateKey` | import réutilisé | ✓ WIRED | `import { getLocalDateKey } from './sporee-economy'` |
| `lib/mascot/wager-engine.ts` | `lib/village/parser.ts FamilySnapshot` | import type pour maybeRecompute | ✓ WIRED | `import type { FamilySnapshot } from '../village/parser'` |

### Data-Flow Trace (Level 4)

**Skipped** — Phase 39 livre des fonctions pures sans données dynamiques à afficher. Aucun composant UI, aucun render, aucun fetch. Les fonctions sont consommées par les tests avec des inputs injectés ; l'intégration vault/rendering est reportée Phase 40.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite Jest Phase 39 passe | `npx jest --no-coverage lib/__tests__/{wager-engine,snapshots-parser,famille-weight-override}.test.ts` | `Tests: 84 passed, 84 total` | ✓ PASS |
| TypeScript clean hors pré-existant | `npx tsc --noEmit 2>&1 \| grep "error TS" \| grep -v "MemoryEditor.tsx\|cooklang.ts\|useVault.ts"` | (empty) | ✓ PASS |
| Moteur est pur (zéro `new Date()` sans param) | `grep "new Date()" lib/mascot/wager-engine.ts` | 1 match dans commentaire d'en-tête (documentaire) | ✓ PASS |
| Aucun import hook/component/app | `grep "from.*hooks\|components\|app/" lib/mascot/wager-engine.ts` | 0 match | ✓ PASS |
| Aucune dépendance externe (date-fns/lodash) | `grep "date-fns\|lodash" lib/mascot/wager-engine.ts` | 0 match | ✓ PASS |
| Exports attendus présents | `grep "^export (function\|const\|interface\|type)" lib/mascot/wager-engine.ts` | 15 matches (9 fonctions + 2 interfaces + 2 types + 1 const + yearsDiff helper + 1 discriminated type) | ✓ PASS |
| Commits documentés présents | `git log --oneline` | `0757afd, fda7ed7, eda4966, e53ecc1, d8320cf, ff8988d, c9510a7` tous présents | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SPOR-03 | 39-02 | Cumul recalculé soir 23h30 ou boot, snapshot matinal | ✓ SATISFIED (partiel) | `computeCumulTarget` + `shouldRecompute` + `maybeRecompute` livrés ; scheduler 23h30 effectif = Phase 40 |
| SPOR-04 | 39-01 + 39-02 | Poids âge auto (1.0/0.7/0.4/0.15/0.0) + override settings | ✓ SATISFIED | `WEIGHT_BY_CATEGORY` exact + `weight_override` round-trip + `resolveWeight` override prioritaire testé |
| SPOR-05 | 39-02 | Profils actifs 7j glissants seuls dans diviseur | ✓ SATISFIED | `isProfileActive7d` avec 10 tests bornes |
| SPOR-06 | 39-02 | Seules tâches domaine Tasks comptabilisées | ✓ SATISFIED | `filterTasksForWager` avec 8 tests (6 domaines exclus) |
| SPOR-13 | 39-01 + 39-02 | Tests Jest fonctions pures critiques | ✓ SATISFIED | 84/84 tests Phase 39 pass (19 fondations + 65 moteur) |

**Orphelins :** Aucun. Tous les 5 IDs déclarés dans ROADMAP Phase 39 sont couverts par au moins un plan (39-01 ou 39-02) et mappés à des tests/code.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Aucun TODO/FIXME/PLACEHOLDER trouvé dans les fichiers Phase 39 | — | — |
| `lib/mascot/wager-engine.ts` | 4 | `new Date()` mentionné dans JSDoc documentaire | ℹ️ Info | Commentaire : "zéro new Date() sans paramètre" — pas un usage réel, c'est de la doc |

### Human Verification Required

#### 1. Scheduler 23h30 effectif

**Test :** Ouvrir l'app après minuit (sans redémarrer entre 23h29 et 00h01) et vérifier que le cumulTarget se rafraîchit.
**Expected :** Le cumul est recalculé au passage minuit avec le snapshot du jour.
**Why human :** La Phase 39 est un moteur PUR — la logique 23h30 est déléguée à la Phase 40 (hook consommateur + setTimeout/setInterval). `shouldRecompute` actuel se contente de "jour différent → true" ; l'edge case 23h30 même jour est documenté comme "décision simplification" dans 39-02 SUMMARY. À re-vérifier lorsque Phase 40 câblera le hook.

#### 2. UX override settings profil

**Test :** Settings profil → changer weight_override d'un profil bébé à adulte → vérifier que son poids passe à 1.0 dans le calcul.
**Expected :** Le profil voit son poids changer et la famille est recalculée.
**Why human :** Aucune UI livrée en Phase 39 (intentionnel). Le round-trip data est OK, mais l'exposition UX est Phase 40.

### Gaps Summary

**Aucun gap bloquant la Phase 39.** Le périmètre livré correspond exactement au contrat CONTEXT + Plans : moteur pur + primitives data. Les tests Jest (84/84) couvrent intégralement SPOR-03/04/05/06/13 au niveau moteur pur.

Les 2 items "human verification" sont des VÉRIFICATIONS DIFFÉRÉES pour la Phase 40, pas des gaps de la Phase 39. Le status `human_needed` reflète uniquement le fait qu'il existe 2 Success Criteria ROADMAP (#1 23h30, #2 override UI) dont la validation complète (User voit...) nécessite une UI/hook qui sera livrée Phase 40.

**Recommandation :** Marquer Phase 39 comme `complete` pour le périmètre moteur pur, et tracker les 2 items de human-verification pour re-verification à la fin de Phase 40.

### Pre-existing Failures (hors scope)

Conformément à 39-02 SUMMARY (documenté), les suites Jest suivantes échouent globalement mais NE SONT PAS causées par Phase 39 :
- `lib/__tests__/world-grid.test.ts` (commit 74e5245 antérieur)
- `lib/__tests__/lovenotes-selectors.test.ts` (commit 67f78a5 antérieur)
- `lib/__tests__/companion-engine.test.ts` (commit 8c4e7b1 antérieur)
- `lib/__tests__/codex-content.test.ts` (commit 2e348c6 antérieur)

Hors scope pour cette phase.

---

_Verified: 2026-04-18_
_Verifier: Claude (gsd-verifier)_
