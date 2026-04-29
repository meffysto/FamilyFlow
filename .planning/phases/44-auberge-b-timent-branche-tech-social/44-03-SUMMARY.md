---
phase: 44-auberge-b-timent-branche-tech-social
plan: 03
subsystem: mascot/tech-engine
tags: [tech-tree, auberge, social-branch, phase-44]
requires:
  - lib/mascot/tech-engine.ts (TechBranchId, TECH_TREE, TechBonuses, getTechBonuses, canUnlockTech)
provides:
  - "TechBranchId 'social' (4e branche)"
  - "TECH_TREE: social-1/2/3 (cost 300/1500/4000, prereqs chaînés)"
  - "TechBonuses.aubergeMaxActiveBonus (default 0)"
  - "TechBonuses.aubergeRewardMultiplier (default 1.0)"
  - "i18n FR : tech.branch_social + tech.social-{1,2,3}[_desc] (7 clés)"
affects:
  - "Plan 44-02 : peut consommer 'social-1' via BUILDING_CATALOG.auberge.techRequired"
  - "Phase 45+ : auberge-engine peut lire aubergeMaxActiveBonus / aubergeRewardMultiplier pour appliquer les bonus"
tech-stack:
  added: []
  patterns:
    - "Extension TechBonuses avec defaults sensibles (0 et 1.0) — non-cassant pour calculs existants"
    - "Branch tech 3-tier avec prereq chain — pattern identique à elevage/expansion"
key-files:
  created:
    - lib/__tests__/tech-engine-social.test.ts
  modified:
    - lib/mascot/tech-engine.ts
    - locales/fr/common.json
decisions:
  - "social-1 = gating pur (no-op dans getTechBonuses) — la consommation est côté BUILDING_CATALOG.techRequired"
  - "Defaults TechBonuses (0/1.0) ne touchent à aucun calcul existant — vérifié par tests non-régression"
  - "15 tests Jest dédiés (3 describe : structure / gating / agrégation) — verrouille la branche social contre tout refacto futur"
metrics:
  duration: ~12min
  completed: 2026-04-29
  tasks_completed: 3
  files_modified: 3
  commits: 3
---

# Phase 44 Plan 03: Branche tech social Summary

Branche tech `social` câblée (3 nœuds) dans `tech-engine.ts` avec 2 nouveaux champs `TechBonuses` (`aubergeMaxActiveBonus` default 0, `aubergeRewardMultiplier` default 1.0), agrégation via `getTechBonuses`, 15 tests Jest verts, et 7 clés i18n FR.

## Tasks Completed

| Task | Name                                                         | Commit  | Files                                  |
| ---- | ------------------------------------------------------------ | ------- | -------------------------------------- |
| 1    | Étendre TechBranchId, TechBonuses + 3 nœuds social-* TECH_TREE | f71e4d0 | lib/mascot/tech-engine.ts              |
| 2    | Tests Jest — branche tech social (15 tests)                  | 4f3acd5 | lib/__tests__/tech-engine-social.test.ts |
| 3    | i18n FR — branche social + 3 techs                           | b198b8f | locales/fr/common.json                 |

## What Was Built

### TECH_TREE — 3 nouveaux nœuds

| ID         | Cost   | Requires    | Effet                                          |
| ---------- | ------ | ----------- | ---------------------------------------------- |
| `social-1` | 300 🍃 | null        | Gating construction Auberge (consommé en 44-02) |
| `social-2` | 1500 🍃 | `social-1`  | `aubergeMaxActiveBonus = 1` (+1 visiteur cap)  |
| `social-3` | 4000 🍃 | `social-2`  | `aubergeRewardMultiplier = 1.2` (+20% reward)  |

### TechBonuses — 2 nouveaux champs

```ts
aubergeMaxActiveBonus: number;      // default 0, social-2 → 1
aubergeRewardMultiplier: number;    // default 1.0, social-3 → 1.2
```

Agrégation dans `getTechBonuses` : initialisation aux defaults, switch cases pour `social-2` et `social-3`. `social-1` est un no-op explicite (gating pur, commenté).

### i18n FR (7 clés ajoutées)

```json
"branch_social": "Social",
"social-1": "Auberge ouverte",
"social-1_desc": "Débloque la construction de l'Auberge (1800 🍃)",
"social-2": "Réputation grandissante",
"social-2_desc": "+1 visiteur actif simultané à l'Auberge",
"social-3": "Hôte de prestige",
"social-3_desc": "+20% sur les récompenses des livraisons Auberge"
```

### Tests (15 verts, 3 describe)

- **TECH_TREE structure** (4 tests) : présence des 3 nœuds, chaîne de prereqs, coûts, branch+order.
- **canUnlockTech gating** (5 tests) : social-1 ouvert, social-2/3 verrouillés sans prereqs, déblocable après chaîne complète, refus si feuilles insuffisantes.
- **getTechBonuses agrégation** (6 tests) : defaults, social-1 no-op, social-2 cap, social-3 reward, agrégation complète, non-régression sur techs non-social.

## Verification

- `npx tsc --noEmit` : 0 erreur (clean).
- `npx jest --no-coverage lib/__tests__/tech-engine-social.test.ts` : 15/15 tests passed.
- `node -e "JSON.parse(...)"` : JSON valide.
- Defaults TechBonuses préservent tous les bonus historiques (`tasksPerStageReduction`, `buildingCapacityMultiplier`, `extraBuildingCells`, etc.) — confirmé par test de non-régression.

## Deviations from Plan

None — plan exécuté exactement comme écrit. Tests étendus à 15 (vs ~11 minimum) pour ajouter :
- Test "tous les nœuds social-* ont branch+order corrects" (verrouillage structure).
- Test "social-1 bloqué si feuilles < 300" (couverture canUnlockTech).
- Test "social-1 seul → defaults inchangés" (verrouillage explicite du gating pur).

## Notes pour Phase 44-02 et Phase 45+

- **Plan 44-02** : peut référencer la string littérale `'social-1'` dans `BUILDING_CATALOG.auberge.techRequired`. Aucune dépendance import-level avec ce plan (TECH_TREE n'est pas re-exporté pour BUILDING_CATALOG, juste consommé par le filtre runtime).
- **Phase 45+** : `auberge-engine.ts` pourra lire `bonuses.aubergeMaxActiveBonus` et `bonuses.aubergeRewardMultiplier` via `getTechBonuses(unlockedTechs)` pour calculer respectivement le cap dynamique de visiteurs actifs et le multiplicateur de reward des livraisons.

## Self-Check: PASSED

- FOUND: lib/mascot/tech-engine.ts (modified)
- FOUND: lib/__tests__/tech-engine-social.test.ts (created)
- FOUND: locales/fr/common.json (modified)
- FOUND commit: f71e4d0 (Task 1)
- FOUND commit: 4f3acd5 (Task 2)
- FOUND commit: b198b8f (Task 3)
