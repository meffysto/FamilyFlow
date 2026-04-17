---
phase: quick-260417-dp6
plan: "01"
subsystem: parser
tags: [migration, farm, inhabitants, parser, bug-fix]
dependency_graph:
  requires: []
  provides: [parseFarmProfile-migrated-ids]
  affects: [lib/parser.ts, hooks/useFarm.ts]
tech_stack:
  added: []
  patterns: [id-migration-at-parse-time, duplication-volontaire-pour-eviter-deps-circulaires]
key_files:
  modified:
    - lib/parser.ts
decisions:
  - "INHABITANT_ID_MIGRATIONS dupliqué dans lib/parser.ts (pas importé depuis hooks/useFarm.ts) pour éviter la dépendance circulaire lib/ → hooks/"
  - "Migration appliquée au parse (parseFarmProfile) en miroir exact de applyFarmField — single source of truth comportementale"
metrics:
  duration: "~5min"
  completed: "2026-04-17T07:53:52Z"
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 260417-dp6: Migration ID habitants dans parseFarmProfile — Summary

**One-liner:** Migration `aigle_expedition → aigle_dore` et `renard_expedition → renard_arctique` appliquée au parse de `parseFarmProfile` pour corriger l'invisibilité des habitants dans la modal Embellir.

## Objective

Bug : les profils écrits avant la migration dans `hooks/useFarm.ts` contiennent encore les anciens IDs (`aigle_expedition`, `renard_expedition`) dans `farm-{id}.md`. Au parse, `parseFarmProfile` retournait ces anciens IDs qui n'ont aucune correspondance dans le catalogue INHABITANTS — les habitants n'apparaissaient donc pas dans la modal "Embellir".

## What Was Done

### Task 1 — Appliquer migrateInhabitantId dans parseFarmProfile

Ajout dans `lib/parser.ts`, juste avant la fonction `parseFarmProfile` :

```typescript
const INHABITANT_ID_MIGRATIONS: Record<string, string> = {
  aigle_expedition: 'aigle_dore',
  renard_expedition: 'renard_arctique',
};

function migrateInhabitantId(id: string): string {
  return INHABITANT_ID_MIGRATIONS[id] ?? id;
}
```

Deux points de parse patché :
1. `mascot_inhabitants` — chaque ID migré via `migrateInhabitantId(s.trim())`
2. `mascot_placements` — `itemId` migré via `migrateInhabitantId(itemId)` lors du parse des paires `slotId:itemId`

Commit: `a64becf`

## Deviations from Plan

None — plan exécuté exactement comme spécifié.

## Verification

- `npx tsc --noEmit` : 25 erreurs, toutes pré-existantes (video/remotion, TabletSidebar.tsx) — aucune nouvelle erreur introduite
- Aucun import depuis `hooks/` dans `lib/parser.ts`
- Logique miroir exacte de `applyFarmField` dans `hooks/useFarm.ts`

## Known Stubs

None — la migration est complète et fonctionnelle.

## Self-Check: PASSED

- [x] `lib/parser.ts` modifié avec `INHABITANT_ID_MIGRATIONS` + `migrateInhabitantId`
- [x] `parseFarmProfile` applique la migration sur `mascot_inhabitants` et `mascot_placements`
- [x] Commit `a64becf` vérifié dans git log
- [x] `npx tsc --noEmit` : aucune nouvelle erreur
