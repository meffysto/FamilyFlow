---
phase: 16-codex-contenu
plan: 01
subsystem: codex
tags: [codex, i18n, types, fondations]
requires: []
provides:
  - "lib/codex/types.ts (CodexEntry union + 10 variants + CodexKind)"
  - "lib/codex/stats.ts (9 getters anti-drift)"
  - "namespace i18n 'codex' câblé FR+EN"
affects:
  - "lib/i18n.ts"
tech_stack:
  added: []
  patterns:
    - "Discriminated union TypeScript pour le codex (Pattern 1 RESEARCH)"
    - "Helpers anti-drift D-02 : zéro duplication de stats engine"
key_files:
  created:
    - "lib/codex/types.ts"
    - "lib/codex/stats.ts"
    - "locales/fr/codex.json"
    - "locales/en/codex.json"
  modified:
    - "lib/i18n.ts"
decisions:
  - "CompanionSpeciesCatalog : matching via String(c.id) === entry.sourceId pour neutraliser le typage littéral du catalogue compagnon"
  - "CraftRecipe importé depuis lib/mascot/types (source) plutôt que craft-engine (re-export)"
metrics:
  duration: "8min"
  completed_date: "2026-04-08"
  tasks: 3
  files_changed: 5
---

# Phase 16 Plan 01 : Fondations Types & i18n — Summary

Pose des fondations Phase 16 : union discriminée `CodexEntry` couvrant les 10 kinds (crop/animal/building/craft/tech/companion/loot/seasonal/saga/quest), 9 helpers `getXxxStats` qui lisent les stats depuis les engines à la demande (anti-drift D-02), et namespace i18n `codex` câblé FR+EN avec squelette JSON nested vide prêt à recevoir les clés des plans 02-04.

## Tâches exécutées

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Types discriminés CodexEntry (10 variants) | 0cf2dde |
| 2 | Helpers stats anti-drift (9 getters) | 2503435 |
| 3 | Namespace i18n codex FR+EN câblé | 9595672 |

## Artefacts livrés

- `lib/codex/types.ts` — `CodexKind`, `CodexEntryBase`, 10 interfaces `*Entry`, union `CodexEntry`. Zéro import engine.
- `lib/codex/stats.ts` — `getCropStats`, `getAnimalStats`, `getBuildingStats`, `getCraftStats`, `getTechStats`, `getCompanionStats`, `getSagaStats`, `getQuestStats`, `getSeasonalStats`. Lecture à la demande depuis les constantes engine via `sourceId`.
- `locales/fr/codex.json` + `locales/en/codex.json` — Squelette JSON nested vide avec les 10 clés racine.
- `lib/i18n.ts` — Imports `frCodex` / `enCodex`, ajout `'codex'` au tableau `ns[]`, entrée `codex:` dans `resources.fr` et `resources.en`.

## Vérification

- `npx tsc --noEmit` : zéro nouvelle erreur (les 3 erreurs pré-existantes MemoryEditor/cooklang/useVault restent tolérées per CLAUDE.md)
- 10 interfaces `*Entry` exportées dans `types.ts`
- 9 fonctions `getXxx` exportées dans `stats.ts`
- Les 10 clés racine présentes dans les deux JSON
- `frCodex` / `enCodex` importés et `'codex'` présent dans le tableau `ns`

## Décisions techniques

1. **CompanionSpeciesCatalog matching** — Le catalogue compagnon utilise un typage `id` littéral. La comparaison `c.id === entry.sourceId` aurait produit `'never'` ; on cast via `String(c.id) === entry.sourceId` pour préserver la sécurité au runtime sans toucher l'engine.
2. **CraftRecipe depuis types** — Le type `CraftRecipe` est défini dans `lib/mascot/types` et seulement re-importé par `craft-engine`. On importe directement depuis la source pour éviter une chaîne d'imports inutile.
3. **loot non géré ici** — Le getter `getLootStats` agrège plusieurs constantes engine et sera créé en plan 16-02 quand les arrays loot seront définis.

## Déviations du plan

Aucune — plan exécuté exactement comme écrit. Aucun bug, aucune fonctionnalité critique manquante, aucun blocage rencontré.

## Self-Check : PASSED

- `lib/codex/types.ts` : FOUND
- `lib/codex/stats.ts` : FOUND
- `locales/fr/codex.json` : FOUND
- `locales/en/codex.json` : FOUND
- Commit `0cf2dde` : FOUND
- Commit `2503435` : FOUND
- Commit `9595672` : FOUND
