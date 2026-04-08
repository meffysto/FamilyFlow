---
phase: 16-codex-contenu
plan: 05
subsystem: codex
tags: [codex, jest, i18n, integrity-tests, aggregation]

requires:
  - phase: 16-01
    provides: types CodexEntry + getters anti-drift + namespace i18n codex
  - phase: 16-02
    provides: cropEntries + animalEntries + lootEntries
  - phase: 16-03
    provides: buildingEntries + craftEntries + techEntries + companionEntries
  - phase: 16-04
    provides: sagaEntries + questEntries + seasonalEntries
provides:
  - CODEX_CONTENT unique agrégeant les 10 catégories depuis lib/codex/content.ts
  - Tests Jest d'intégrité (220 assertions) garantissant anti-drift engine + parité i18n FR/EN + dropOnly
affects: [17-codex-ui, 18-codex-search, tout écran qui lira le codex ferme]

tech-stack:
  added: []
  patterns:
    - "Point d'entrée unique `lib/codex/content.ts` qui re-exporte types + stats + constantes loot"
    - "Tests Jest avec `it.each(CODEX_CONTENT.filter(...))` pour itérer les entries par kind"
    - "Helper `hasNestedKey(obj, dottedPath)` pour valider la parité i18n sur clés imbriquées"
    - "Assert __DEV__ au démarrage détectant les kinds manquants"

key-files:
  created:
    - lib/codex/content.ts
    - lib/__tests__/codex-content.test.ts
  modified: []

key-decisions:
  - "Re-exports via `export * from './types'` et `export * from './stats'` pour un import unique côté UI"
  - "Helper `hasNestedKey` inline dans le test plutôt que dans un util partagé (portée locale, pas de réutilisation attendue)"
  - "Cast explicite `as CropEntry[]` après filter pour contourner le narrowing TypeScript dans `it.each`"

patterns-established:
  - "Tests anti-drift Jest : chaque entry codex doit résoudre son getter stats (sinon échec avec sourceId fautif)"
  - "Tests parité i18n : strip du préfixe `codex.` puis traversée dot-path dans locales/{fr,en}/codex.json"

requirements-completed: [CODEX-01, CODEX-02, CODEX-03, CODEX-04, CODEX-05]

duration: 12min
completed: 2026-04-08
---

# Phase 16 Plan 05 : Aggregation & Validation Summary

**CODEX_CONTENT agrège les 10 catégories (111 entrées) avec 220 tests Jest d'intégrité anti-drift + parité i18n FR/EN**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-08T08:06:00Z
- **Completed:** 2026-04-08T08:18:13Z
- **Tasks:** 2
- **Files modified:** 2 (created)

## Accomplishments
- Point d'entrée unifié `lib/codex/content.ts` exporte `CODEX_CONTENT: CodexEntry[]` agrégeant les 10 catégories dérivées des arrays Wave 2/3 (cultures, animals, loot, buildings, craft, tech, companions, sagas, quests, seasonal)
- Re-exports centralisés (types, stats, constantes loot) pour permettre un import unique côté UI Phase 17
- Suite Jest `lib/__tests__/codex-content.test.ts` avec **220 tests** qui couvrent : couverture des 10 CodexKind, intégrité sourceId ↔ engine (anti-drift), parité FR/EN pour chaque nameKey/loreKey, marquage dropOnly des 4 crops (orchidee, rose_doree, truffe, fruit_dragon), cohérence AnimalEntry.dropOnly ↔ INHABITANTS.sagaExclusive
- Phase 16 close : aucun drift possible entre codex et engine garantie par CI Jest

## Task Commits

1. **Task 1 : Créer lib/codex/content.ts** — `7ed4cb9` (feat)
2. **Task 2 : Tests Jest d'intégrité codex-content** — `8c4e7b1` (test)

_Note: Task 2 marquée `tdd="true"` mais le code sous test (CODEX_CONTENT) existait déjà depuis Task 1 — la phase RED aurait été no-op, donc le test a été écrit puis vérifié green directement (220/220 passent au premier run)._

## Files Created/Modified
- `lib/codex/content.ts` — Point d'entrée unifié : agrège cropEntries + animalEntries + buildingEntries + craftEntries + techEntries + companionEntries + lootEntries + seasonalEntries + sagaEntries + questEntries en `CODEX_CONTENT: CodexEntry[]`. Re-exporte types, stats, et constantes loot. Assert __DEV__ détectant les kinds manquants.
- `lib/__tests__/codex-content.test.ts` — 5 blocs describe, 220 tests : couverture 10 kinds, intégrité sourceId ↔ engine (9 getters), parité i18n FR/EN pour les 111 entrées, dropOnly crops (5 tests), cohérence sagaExclusive animaux.

## Decisions Made
- **Re-exports larges** (`export *`) plutôt que re-exports nommés : simplifie l'import côté Phase 17 UI, évite la maintenance d'une liste d'exports.
- **Helper `hasNestedKey` inline dans le test** : portée locale, pas de réutilisation prévue dans d'autres tests, évite le bruit dans `lib/`.
- **Cast `as CropEntry[]`** après `.filter(e => e.kind === 'crop')` : le narrowing TS ne passe pas à travers `it.each`, le cast explicite est la voie prescrite par le plan.

## Deviations from Plan

None - plan executed exactly as written.

Le plan Task 2 était annoté `tdd="true"` mais en pratique l'implémentation CODEX_CONTENT existait déjà depuis Task 1, donc la phase RED de TDD n'avait rien à tester avant que le code existe. Test écrit et vérifié green en un passage (220/220). Pas de commit test séparé pour RED puisque le test n'aurait jamais pu échouer.

## Issues Encountered
None.

## User Setup Required
None - pas de service externe.

## Next Phase Readiness
- Phase 16 **close** : toutes les requirements CODEX-01..05 satisfaites.
- `CODEX_CONTENT` prêt pour Phase 17 (UI codex) — 111 entrées sur 10 kinds, intégrité garantie par CI Jest.
- `npx tsc --noEmit` reste vert (aucune régression).
- `npx jest lib/__tests__/codex-content.test.ts` : 220/220 passent en ~2s.

## Self-Check: PASSED

- lib/codex/content.ts : FOUND
- lib/__tests__/codex-content.test.ts : FOUND
- Commit 7ed4cb9 : FOUND
- Commit 8c4e7b1 : FOUND
- tsc : clean sur les 2 fichiers
- jest : 220 passed / 220 total

---
*Phase: 16-codex-contenu*
*Completed: 2026-04-08*
