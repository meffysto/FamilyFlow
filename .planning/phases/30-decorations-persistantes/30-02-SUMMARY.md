---
phase: 30-decorations-persistantes
plan: 02
subsystem: village/hook
tags: [village, building, unlock-engine, useGarden, idempotence, reactive-effect, jest]

requires:
  - phase: 30-01
    provides: "BUILDINGS_CATALOG, computeBuildingsToUnlock, appendBuilding, UnlockedBuilding type, VillageData.unlockedBuildings"
  - phase: 26-hook-domaine-jardin
    provides: "useGarden hook existant (parseGardenFile, addContribution, claimReward)"
provides:
  - "useGarden().familyLifetimeLeaves (memo sum profile.points avec ?? 0)"
  - "useGarden().unlockedBuildings (exposition gardenData.unlockedBuildings)"
  - "Effet unlock-on-threshold réactif + idempotent (early return sur toUnlock vide)"
  - "Multi-paliers simultanés : cascade appendBuilding local + 1 writeFile final"
  - "5 tests résilience (frontière, palier-1, idempotence consécutive, ordre narratif, points undefined)"
affects: [30-03 UI consommateur (familyLifetimeLeaves, unlockedBuildings)]

tech-stack:
  added: []
  patterns:
    - "Effet React idempotent — computeX pure + early return sur [] (Pitfall 1 anti-loop)"
    - "Cascade de fonctions pures sur content local, 1 seul writeFile final (évite N write simultanés)"
    - "cancelled flag dans cleanup d'effet async (évite setState après unmount/nouveau tick)"
    - "Catch silencieux non-critique : /* Constructions — non-critical */"
    - "Défense runtime ?? 0 sur p.points (TS le type number, mais grossesse/nouveaux profils peuvent être undefined à l'exécution)"

key-files:
  created: []
  modified:
    - hooks/useGarden.ts
    - lib/__tests__/village-parser.test.ts

key-decisions:
  - "Import statique de appendBuilding (pas dynamic import) — lisibilité + éviter le bundle split pattern"
  - "appendBuilding pur utilisé en cascade, PAS appendBuildingToVault — 1 readFile + 1 writeFile au lieu de N I/O cycles"
  - "Early return si toUnlock.length === 0 AVANT toute lecture vault — garantit idempotence sans I/O spurieux"
  - "cancelled flag en cleanup : protège contre double-write si familyLifetimeLeaves re-calcule en mid-async"
  - "Le test Pitfall 7 (profile.points undefined) est typé `Array<{points: number | undefined}>` en TS strict — le `?? 0` runtime est défensif, pas lié au typage strict"
  - "Nouveau describe 'résilience' séparé du describe Plan 01 — co-localisé mais visuellement distinct pour lecture rapide"

patterns-established:
  - "Hook domaine + effet réactif idempotent : memo computed state → effet qui détecte diff → pure append cascade → 1 write final"
  - "Profils grossesse compatibles : tous les reduces sur profile.points doivent utiliser `?? 0` défensif"

requirements-completed: [VILL-04, VILL-05]

duration: 3min
completed: 2026-04-11
---

# Phase 30 Plan 02: Unlock engine bâtiments village Summary

**Moteur de déblocage réactif et idempotent câblé dans useGarden : détecte automatiquement le franchissement de paliers feuilles famille et persiste les bâtiments dans jardin-familial.md, sans aucune boucle de re-render malgré l'effet écrivant dans son propre déclencheur.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-11T12:56:37Z
- **Completed:** 2026-04-11T12:59:52Z
- **Tasks:** 2 (tous atomiques)
- **Files modified:** 2

## Accomplishments

- `useGarden` expose `familyLifetimeLeaves` (somme `profile.points` avec `?? 0` défensif) et `unlockedBuildings` (parsé depuis gardenData)
- Effet unlock-on-threshold réactif : déclenché à chaque changement de `familyLifetimeLeaves` ou `unlockedBuildings`, cascade `appendBuilding` locale puis UN SEUL `writeFile + setGardenRaw` final
- Idempotence stricte garantie par early return si `computeBuildingsToUnlock` retourne `[]` → pas d'écriture → pas de nouveau tick d'effet (Pitfall 1 RESEARCH.md)
- Support multi-paliers simultanés (ex: passage 0 → 500 feuilles = 3 bâtiments débloqués en un seul writeFile)
- 5 nouveaux tests résilience : frontière exacte paliers, palier-1, idempotence sur appels consécutifs avec state progressif, ordre narratif BUILDINGS_CATALOG, profile.points undefined (Pitfall 7)
- 48/48 tests Jest passants (43 existants Plan 01 + 5 nouveaux Plan 02)
- `npx tsc --noEmit` exit 0 (zéro nouvelle erreur TypeScript)

## Task Commits

1. **Task 1: familyLifetimeLeaves + unlock effect dans useGarden** — `174c326` (feat)
2. **Task 2: Tests résilience unlock engine** — `00ff3ff` (test)

## Files Modified

- **Modifié** `hooks/useGarden.ts` — +65 lignes :
  - Imports étendus : `appendBuilding`, `computeBuildingsToUnlock`, `UnlockedBuilding`
  - Interface `UseGardenReturn` étendue : `familyLifetimeLeaves`, `unlockedBuildings`
  - useMemo `familyLifetimeLeaves` (reduce profile.points avec `?? 0`)
  - useMemo `unlockedBuildings` (extraction depuis gardenData)
  - useEffect unlock-on-threshold (early return → read content → cascade append → 1 write final)
  - Return étendu avec les 2 nouveaux champs Phase 30
- **Modifié** `lib/__tests__/village-parser.test.ts` — +55 lignes :
  - Import étendu : `UnlockedBuilding` type
  - Nouveau describe `computeBuildingsToUnlock — résilience (Phase 30)` avec 5 tests

## Decisions Made

- **Cascade locale + 1 writeFile final** : pour éviter N readFile + N writeFile si plusieurs paliers franchis simultanément, l'effet lit `currentContent` une fois, appelle `appendBuilding` (pur) en boucle sur la string locale, puis écrit le résultat final une seule fois. Réduit les I/O disk + respecte iCloud coordination.
- **Import statique `appendBuilding`** : le plan proposait un `await import()` dynamique en fallback ; l'import statique a été préféré pour la lisibilité et l'absence de bundle split (pattern D-03 CONTEXT.md : pas de lazy loading dans les hooks critiques).
- **Early return avant toute I/O** : `if (toUnlock.length === 0) return;` AVANT `vault.readFile`. Critique pour l'idempotence : au mount et à chaque re-render, si rien à débloquer, zéro I/O, zéro setState, zéro nouveau tick → pas de boucle infinie.
- **cancelled flag en cleanup** : même si l'idempotence principale repose sur `toUnlock.length === 0`, le flag `cancelled` protège contre le cas où `familyLifetimeLeaves` change durant l'async (profil gagne des points pendant qu'on écrit). Si ça arrive, le premier tick s'annule, le second tick prend le relais avec l'état à jour.
- **`p.points ?? 0` défensif** : TypeScript type `points: number` (non optionnel) dans `lib/types.ts`, mais runtime réel peut avoir des profils grossesse ou nouvellement créés sans ce champ écrit dans le vault. Le `?? 0` garantit qu'aucun `NaN` ne se propage dans la somme — explicitement demandé par Pitfall 7 RESEARCH.md.
- **Test Pitfall 7 typé `number | undefined`** : en TS strict, impossible d'assigner `undefined` à un `number`. Le test utilise un type local `Array<{points: number | undefined}>` pour simuler la situation runtime tout en restant type-safe.
- **Nouveau describe séparé** : plutôt que d'étendre le describe Plan 01, un nouveau describe `computeBuildingsToUnlock — résilience (Phase 30)` est créé pour conserver la distinction visuelle Plan 01 (contrats de base) vs Plan 02 (cas de résilience). Aucune duplication : les 5 cas ajoutés sont strictement distincts de ceux Plan 01 (qui testait 0/99/100/1500/25000 en `toEqual` ; Plan 02 teste la notion de frontière exacte en `toContain` + palier-1 + idempotence state-transition).

## Deviations from Plan

**None.** Le plan a été exécuté exactement comme écrit. Les seuls ajustements mineurs sont dans la mise en forme (regroupement du ?? 0 profile.points en une seule ligne de doc, format du test undefined en TS strict) — tous conformes à l'intention du plan.

## Issues Encountered

**Aucun.** Tous les tests passent du premier coup, TypeScript compile sans erreur, aucune régression sur les 43 tests Plan 01 existants.

## Next Phase Readiness

**Plan 30-03 (UI) peut immédiatement consommer :**
- `useGarden().familyLifetimeLeaves: number` — pour afficher la progression globale (barre XP famille) et la distance au prochain palier
- `useGarden().unlockedBuildings: UnlockedBuilding[]` — pour rendre les sprites bâtiments sur la grille village (mapping via `BUILDINGS_CATALOG` Plan 01)
- `BUILDINGS_CATALOG` — déjà importable depuis `lib/village` pour le lookup sprite + labelFR + palier
- `VILLAGE_GRID` filtré `role === 'building'` — 8 slots prêts (Plan 01)

**Smoke test manuel** (prévu Plan 03 lors du premier lancement de l'app) :
- Au mount de `/(tabs)/village.tsx`, `useGarden` s'exécute → effet unlock-on-threshold s'active
- Si `familyLifetimeLeaves >= 100`, `puits` est persisté automatiquement dans `jardin-familial.md`
- Au reload suivant, `unlockedBuildings` contient `puits` → early return, pas de double write (vérification idempotence en conditions réelles)

**Aucun blocker.** Le moteur de déclenchement est câblé end-to-end : `profile.points change` → `familyLifetimeLeaves memo recompute` → `effect trigger` → `computeBuildingsToUnlock(new_total, current_unlocked)` → `append cascade + writeFile + setGardenRaw` → `gardenData re-parsed` → `unlockedBuildings updated` → `effet re-trigger` → `toUnlock = [] early return` → boucle terminée proprement.

## Self-Check: PASSED

**Files verified:**
- FOUND: hooks/useGarden.ts (modifié)
- FOUND: lib/__tests__/village-parser.test.ts (modifié)

**Commits verified:**
- FOUND: 174c326 (Task 1 — familyLifetimeLeaves + unlock effect)
- FOUND: 00ff3ff (Task 2 — 5 tests résilience)

**Acceptance criteria verified:**
- `grep -n "familyLifetimeLeaves" hooks/useGarden.ts` matches 4+ fois (interface, doc, useMemo, effet, return) ✓
- `grep -n "computeBuildingsToUnlock" hooks/useGarden.ts` matches (import + call dans effet) ✓
- `grep -n "appendBuilding" hooks/useGarden.ts` matches (import + call dans effet) ✓
- `grep -n "p.points ?? 0" hooks/useGarden.ts` matches ✓
- `grep -n "Constructions — non-critical" hooks/useGarden.ts` matches ✓
- `grep -n "unlockedBuildings: UnlockedBuilding\[\]" hooks/useGarden.ts` matches (interface return) ✓
- `grep -n "if (toUnlock.length === 0) return" hooks/useGarden.ts` matches (early return idempotence) ✓
- `grep -n "import type.*UnlockedBuilding" hooks/useGarden.ts` matches (dans bloc import type) ✓
- `npx tsc --noEmit` exit 0 ✓
- `npx jest --no-coverage lib/__tests__/village-parser.test.ts` exit 0, 48/48 tests passants (5 nouveaux résilience + 43 existants Plan 01) ✓

---
*Phase: 30-decorations-persistantes*
*Completed: 2026-04-11*
