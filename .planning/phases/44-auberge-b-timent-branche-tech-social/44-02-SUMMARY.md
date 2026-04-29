---
phase: 44-auberge-b-timent-branche-tech-social
plan: 02
subsystem: mascot/farm
tags: [building-catalog, auberge, i18n, phase-44]
requires:
  - "BuildingDefinition.producesResource (Plan 44-01)"
  - "TECH_TREE social-1 (Plan 44-03)"
provides:
  - "BUILDING_CATALOG.auberge (5e entrée, producesResource: false, techRequired: 'social-1')"
  - "i18n FR farm.building.auberge / auberge_desc"
affects:
  - lib/mascot/types.ts
  - locales/fr/common.json
tech-stack:
  added: []
  patterns:
    - "Entrée déclarative pure — aucune logique, repose sur le court-circuit du Plan 44-01"
    - "generateTiers(0, 1500) — baseHours=0 légal car producesResource: false bypass toute lecture de productionRateHours"
key-files:
  created: []
  modified:
    - lib/mascot/types.ts
    - locales/fr/common.json
decisions:
  - "resourceType: 'oeuf' utilisé comme placeholder (champ requis par le type) — non-lu via court-circuit Plan 44-01"
  - "Coût 1800 🍃 et minTreeStage 'arbuste' conformes au design Phase 44"
  - "Description i18n volontairement minimale (placeholder) — Phase 45 viendra raffiner avec l'UI"
metrics:
  duration: "~3min"
  completed: 2026-04-29
  tasks_completed: 2
  files_modified: 2
  commits: 2
---

# Phase 44 Plan 02: Entrée auberge BUILDING_CATALOG + i18n FR Summary

5e entrée déclarative `auberge` ajoutée à `BUILDING_CATALOG` avec `producesResource: false` (consommé par Plan 44-01) et `techRequired: 'social-1'` (consommé par Plan 44-03), plus 2 clés i18n FR. Aucune logique — bâtiment social non-productif gating-ready.

## Tasks Completed

| Task | Name                                                | Commit  | Files                  |
| ---- | --------------------------------------------------- | ------- | ---------------------- |
| 1    | Ajouter l'entrée auberge à BUILDING_CATALOG         | e964923 | lib/mascot/types.ts    |
| 2    | Ajouter les clés i18n auberge dans common.json      | df76418 | locales/fr/common.json |

## What Was Built

### BUILDING_CATALOG — entrée auberge (5e)

```ts
{
  id: 'auberge',
  labelKey: 'farm.building.auberge',
  emoji: '🛖',
  cost: 1800,
  dailyIncome: 0,
  minTreeStage: 'arbuste',
  resourceType: 'oeuf',     // placeholder requis par le type — non-lu
  producesResource: false,
  techRequired: 'social-1',
  tiers: generateTiers(0, 1500),
}
```

Insérée après l'entrée `ruche`, avant la fermeture `];`. Les 4 entrées existantes (poulailler, grange, moulin, ruche) sont strictement inchangées.

### i18n FR — 2 clés ajoutées dans `farm.building`

```json
"auberge": "Auberge",
"auberge_desc": "Un refuge chaleureux pour les voyageurs. Bientôt habitée…",
```

Insérées juste après `ruche_desc`, avant `buy`. Pattern miroir des 4 bâtiments existants.

## Verification

| Check | Result |
|-------|--------|
| `grep "id: 'auberge'" lib/mascot/types.ts` | 1 occurrence |
| `grep "techRequired: 'social-1'" lib/mascot/types.ts` | 1 occurrence (auberge) |
| `grep "producesResource: false" lib/mascot/types.ts` | 1 occurrence (auberge) |
| `grep '"auberge": "Auberge"' locales/fr/common.json` | 1 occurrence |
| `node -e "JSON.parse(...)"` sur common.json | clean (JSON valide) |
| `npx tsc --noEmit` (changements isolés) | inchangé vs baseline |

## Deviations from Plan

None — plan exécuté exactement comme écrit.

## Notes

- **Wave parallèle** : Plan 44-04 (parallel wave) modifie `components/mascot/BuildingDetailSheet.tsx` simultanément. Mes commits ne touchent que `types.ts` et `common.json`.
- **Erreur TS pré-existante** : `TechTreeSheet.tsx(330)` rapporte `Property 'social' is missing` — provient de l'ajout de `TechBranchId 'social'` par le Plan 44-03 sans mise à jour de l'UI. Vérifié via `git stash` que cette erreur précède mes changements et n'est PAS causée par mon Plan 02. Sera résolue par le Plan 44-04 (UI/sheet adaptations).
- **CACHE_VERSION untouched** comme requis (le cache exclut déjà la ferme).
- **Pas de test** : entrée déclarative pure, validée par tsc et grep — pas de logique à couvrir.
- **Plan 44-04** vérifiera visuellement l'apparition de l'auberge dans BuildingShopSheet une fois `social-1` débloqué.

## Self-Check: PASSED

- FOUND: lib/mascot/types.ts (modified — entrée auberge ajoutée)
- FOUND: locales/fr/common.json (modified — 2 clés auberge)
- FOUND commit: e964923 (Task 1)
- FOUND commit: df76418 (Task 2)
