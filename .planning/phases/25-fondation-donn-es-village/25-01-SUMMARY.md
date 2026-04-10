---
phase: 25-fondation-donn-es-village
plan: "01"
subsystem: village
tags: [village, data-layer, parser, types, grid, templates]
dependency_graph:
  requires: []
  provides: [lib/village/types.ts, lib/village/grid.ts, lib/village/templates.ts, lib/village/parser.ts, lib/village/index.ts]
  affects: []
tech_stack:
  added: []
  patterns: [gray-matter frontmatter parsing, append-only section insert, barrel export, VaultManager async wrapper]
key_files:
  created:
    - lib/village/types.ts
    - lib/village/grid.ts
    - lib/village/templates.ts
    - lib/village/parser.ts
    - lib/village/index.ts
  modified: []
decisions:
  - "serializeGardenFile construit la string manuellement (pas matter.stringify) — round-trip fidelity garantie"
  - "appendContribution insere avant la prochaine section ## pour eviter l'append en fin de fichier (Pitfall 4)"
  - "VILLAGE_GRID IDs prefixes village_ pour eviter les collisions avec la ferme perso lors de la transition portail"
metrics:
  duration: "~3 minutes"
  completed_date: "2026-04-10"
  tasks_completed: 2
  files_created: 5
  files_modified: 0
---

# Phase 25 Plan 01: Fondation Données Village Summary

Module `lib/village/` complet — types TypeScript, grille village 4 éléments, 7 templates d'objectif hebdomadaire, parseur bidirectionnel append-only pour `jardin-familial.md`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Types, grille village et templates d'objectif | 1f6e960 | lib/village/types.ts, lib/village/grid.ts, lib/village/templates.ts, lib/village/index.ts |
| 2 | Parseur bidirectionnel jardin-familial.md + appendContribution | 95af88f | lib/village/parser.ts |

## What Was Built

Module TypeScript pur `lib/village/` en 5 fichiers, zéro hook/context, prêt à être consommé par `useGarden.ts` (Phase 26) :

**types.ts** — Toutes les interfaces du module : `VillageRole`, `VillageCell`, `ContributionType`, `VillageContribution`, `VillageWeekRecord`, `VillageData`, `ObjectiveTemplate`.

**grid.ts** — `VILLAGE_GRID: VillageCell[]` avec 4 éléments interactifs positionnés en fractions du conteneur : fountain (centre), 2 stalls (gauche/droite bas), board (haut gauche). Tous les IDs préfixés `village_`.

**templates.ts** — `OBJECTIVE_TEMPLATES` (7 thèmes rotatifs), `BASE_TARGET = 15`, `computeWeekTarget(activeProfileCount)`.

**parser.ts** — `parseGardenFile` (gray-matter frontmatter + sections Contributions/Historique), `serializeGardenFile` (construction manuelle sans matter.stringify), `appendContribution` (section-safe insert), `appendContributionToVault` (wrapper VaultManager async).

**index.ts** — Barrel export des 4 modules.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| serializeGardenFile manuel (pas matter.stringify) | Évite la perte de formatage lors de la sérialisation (Pitfall 5) — round-trip fidèle garanti |
| appendContribution insère avant ## suivant | Évite l'append en fin de fichier qui pourrait corrompre d'autres sections (Pitfall 4) |
| IDs préfixés village_ | Évite les collisions avec WORLD_GRID de la ferme perso lors de la transition portail (Phase 28) |
| gray-matter pour le frontmatter | Cohérent avec le reste du codebase (lib/parser.ts, lib/museum/) |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — module pur, pas de données hardcodées ni de placeholders UI.

## Self-Check: PASSED

Files created:
- lib/village/types.ts — FOUND
- lib/village/grid.ts — FOUND
- lib/village/templates.ts — FOUND
- lib/village/parser.ts — FOUND
- lib/village/index.ts — FOUND

Commits:
- 1f6e960 — FOUND (feat(25-01): types, grille village et templates d'objectif)
- 95af88f — FOUND (feat(25-01): parseur bidirectionnel jardin-familial.md)

TypeScript: npx tsc --noEmit — PASSED (0 errors)
