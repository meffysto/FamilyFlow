---
phase: 43-auberge-mod-le-moteur-visiteurs
plan: 01
subsystem: mascot/auberge
tags: [types, catalog, visitors, foundations]
dependency_graph:
  requires: []
  provides:
    - "lib/mascot/types.ts → ActiveVisitor, VisitorReputation, VisitorRequestItem, AubergeState, VisitorRarity, VisitorRequestSource, VisitorStatus"
    - "lib/mascot/visitor-catalog.ts → VISITOR_CATALOG, VisitorDefinition, VisitorRequestTemplate"
  affects:
    - "Plan 43-02 (parser persistance) consomme AubergeState shape"
    - "Plan 43-03 (engine pur) consomme tous les types + VISITOR_CATALOG"
    - "Plan 43-04 (hook useAuberge) consomme AubergeState + VisitorDefinition"
tech_stack:
  added: []
  patterns: ["Catalogue statique mirror BUILDING_CATALOG", "Type alias union pour énumérations finies"]
key_files:
  created:
    - "lib/mascot/visitor-catalog.ts"
  modified:
    - "lib/mascot/types.ts"
decisions:
  - "VisitorRequestSource déclaré comme type alias dédié (pas littéral inline) — réutilisé dans VisitorRequestTemplate.items[].source pour DRY (note plan-checker #2)"
  - "Comtesse : parfum_orchidee retenu comme item-phare (sellValue 1200, dominant du catalogue) ; second template fromage+corn pour variété"
  - "minTreeStage tous valides vs union TreeStage = 'graine'|'pousse'|'arbuste'|'arbre'|'majestueux'|'legendaire' (note plan-checker #1 vérifiée à types.ts:9)"
  - "Aucun fallback d'itemId nécessaire : tous les ids ciblés (lait, potato, cabbage, beetroot, tomato, strawberry, corn, miel, farine, oeuf, wheat, soupe, bouquet, fromage, pain, hydromel, gateau, parfum_orchidee) existent dans CROP_CATALOG / BUILDING_RESOURCE_VALUE / CRAFT_RECIPES"
metrics:
  duration: ~6min
  completed_date: 2026-04-29
  tasks: 2
  files: 2
---

# Phase 43 Plan 01 : Fondations types Auberge + catalogue 6 visiteurs — Summary

**One-liner :** Types TypeScript Auberge (ActiveVisitor, VisitorReputation, AubergeState) ajoutés à `lib/mascot/types.ts` + nouveau `lib/mascot/visitor-catalog.ts` exportant `VISITOR_CATALOG` avec les 6 PNJ — fondations interface-first prêtes pour les Plans 02/03/04.

## Tasks Completed

| # | Task | Commit |
|---|------|--------|
| 1 | Ajouter les types Auberge dans `lib/mascot/types.ts` | `3b69e3d` |
| 2 | Créer `lib/mascot/visitor-catalog.ts` avec 6 visiteurs | `aa22fc9` |

## Catalogue final — 6 visiteurs

| ID | Emoji | Rareté | Deadline | Mult | Stage | Rep min | requestPool (weight × items) |
|----|-------|--------|----------|------|-------|---------|------------------------------|
| `hugo_boulanger` | 🧑‍🍳 | common | 48h | ×1.4 | pousse | — | 3 × `farine[2,4]+oeuf[3,5]` ; 2 × `wheat[4,8]` |
| `meme_lucette` | 👵 | common | 48h | ×1.4 | pousse | — | 3 × `lait[2,4]+potato[3,6]` ; 2 × `cabbage[2,4]+beetroot[2,4]` |
| `yann_apiculteur` | 🐝 | uncommon | 60h | ×1.6 | arbuste | — | 3 × `miel[2,4]+farine[2,3]` ; 2 × `miel[3,5]` |
| `voyageuse` | 🧙 | uncommon | 60h | ×1.6 | arbuste | — | 3 × `bouquet[1,2]+tomato[3,5]` ; 2 × `soupe[1,2]+strawberry[2,4]` |
| `marchand_ambulant` | 🪙 | uncommon | 60h | ×1.6 | arbuste | — | 3 × `fromage[1,2]+pain[1,2]` ; 2 × `hydromel[1,2]+gateau[1,1]` |
| `comtesse` | 👑 | rare | 72h | ×1.8 | arbre | **15** | 2 × `parfum_orchidee[1,1]` ; 3 × `fromage[2,3]+corn[3,5]` |

Toutes les sources (`building` / `crop` / `crafted`) renvoient vers des entités existantes :
- **building** : `farine`, `oeuf`, `lait`, `miel` (BUILDING_RESOURCE_VALUE, craft-engine.ts:27).
- **crop** : `wheat`, `potato`, `cabbage`, `beetroot`, `tomato`, `strawberry`, `corn` (CROP_CATALOG, types.ts:362).
- **crafted** : `bouquet`, `soupe`, `fromage`, `pain`, `hydromel`, `gateau`, `parfum_orchidee` (CRAFT_RECIPES, craft-engine.ts:72).

Aucun fallback d'itemId nécessaire — tous les ids ciblés au CONTEXT.md (chou/patate/betterave/lait/miel/farine/wheat/œuf + fruits + craftés) sont disponibles. Le détail des templates correspond aux pools listés dans le CONTEXT.md sans déviation.

## Plan-Checker Notes Addressed

1. **TreeStage ordering** : vérifié à `lib/mascot/types.ts:9` — l'union est `'graine' | 'pousse' | 'arbuste' | 'arbre' | 'majestueux' | 'legendaire'`. Les valeurs employées dans le catalogue (`pousse`, `arbuste`, `arbre`) sont toutes membres valides. `TREE_STAGE_ORDER` constant déjà défini à `types.ts:470` pour les futurs comparateurs (Plan 03 `getEligibleVisitors`).
2. **VisitorRequestSource alias** : défini une seule fois dans `lib/mascot/types.ts` (Phase 43 block) et importé dans `visitor-catalog.ts` pour typer le champ `items[].source`. Aucune duplication de littéral `'building' | 'crop' | 'crafted'` inline.

## Deviations from Plan

None — plan exécuté exactement comme écrit. Tous les itemId ciblés au CONTEXT.md existent au catalogue (aucun fallback requis).

## Verification

- `npx tsc --noEmit` : **0 erreur** (baseline 0, post-plan 0).
- Grep des 6 IDs visiteurs : tous présents.
- Grep `unlockMinReputation: 15` : présent (Comtesse).
- Grep `Phase 43 — Auberge` dans types.ts : présent.

## Self-Check: PASSED

- [x] `lib/mascot/types.ts` modifié — 7 exports Phase 43 (3 type alias + 4 interfaces) trouvés via grep.
- [x] `lib/mascot/visitor-catalog.ts` créé — `VISITOR_CATALOG` + `VisitorDefinition` + `VisitorRequestTemplate` exportés.
- [x] Commit `3b69e3d` (Task 1) présent dans `git log`.
- [x] Commit `aa22fc9` (Task 2) présent dans `git log`.
- [x] tsc clean (0 erreurs nouvelles vs baseline 0).
