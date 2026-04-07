---
phase: 15-pr-f-rences-alimentaires
plan: "02"
subsystem: parser
tags: [parser, dietary, profile, types, tdd]
dependency_graph:
  requires: [15-01]
  provides: [parseFamille-food-star, serializeFamille, parseInvites, serializeInvites, INVITES_FILE]
  affects: [useVault, hooks/useVault.ts, VaultContext]
tech_stack:
  added: []
  patterns: [parseFoodCsv-helper, round-trip-test, TDD-RED-GREEN]
key_files:
  created: []
  modified:
    - lib/types.ts
    - lib/parser.ts
    - lib/__tests__/parser-extended.test.ts
decisions:
  - "parseFoodCsv gère CSV et YAML liste natif (Array.isArray branch) — compatibilité PREF-05"
  - "serializeFamille omet les clés food_* vides — lisibilité Obsidian"
  - "parseInvites génère IDs via slugifyInviteName avec suffixe _2/_3 pour collisions"
  - "GuestProfile importé via type import depuis lib/dietary/types — 0 runtime overhead"
metrics:
  duration: "~4min"
  completed: "2026-04-07"
  tasks_completed: 2
  files_modified: 3
---

# Phase 15 Plan 02: Parser Famille Invités Summary

**One-liner:** Parser food_* CSV/YAML-list pour famille.md + parseInvites/serializeInvites pour Invités.md avec tests round-trip (PREF-02/05/06).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Tests failing food_* + parseInvites | b33c73c | lib/__tests__/parser-extended.test.ts |
| 1 (GREEN) | Profile food_* + parseFamille + serializeFamille | a145bf9 | lib/types.ts, lib/parser.ts |
| 2 (GREEN) | parseInvites + serializeInvites + INVITES_FILE | e335c31 | lib/parser.ts, lib/__tests__/parser-extended.test.ts |

## What Was Built

### Tâche 1: Profile food_* + parseFamille/serializeFamille

- Ajout de 4 champs optionnels à `interface Profile` : `foodAllergies`, `foodIntolerances`, `foodRegimes`, `foodAversions` (tous `string[] | undefined`)
- Helper local `parseFoodCsv(raw: unknown): string[]` — gère CSV (`gluten,lait`) ET YAML liste natif (Array) — satisfait PREF-05
- `parseFamille` étendu : lit les 4 clés `food_*` via `parseFoodCsv`, retourne `[]` si absentes (no-crash garanti)
- `serializeFamille` créé : sérialise les profils en format `### {id}` avec clés food_* omises si vides (compatibilité Obsidian)
- 5 tests TDD : CSV parse, no-crash sans clés, round-trip, omission vides, YAML liste

### Tâche 2: parseInvites / serializeInvites / INVITES_FILE

- `INVITES_FILE = '02 - Famille/Invités.md'` exportée
- `parseInvites(content): GuestProfile[]` — parse sections H2, slugifie les noms en IDs (NFD + lowercase + underscore), gère collisions avec suffixe _2/_3
- `serializeInvites(guests): string` — header `# Invités récurrents`, sections `## {name}`, clés food_* non-vides seulement
- `slugifyInviteName` — normalisation NFD (accents), lowercase, underscore
- Import `GuestProfile` depuis `lib/dietary/types` via `import type`
- 4 tests TDD : fichier vide, 2 invités avec food_*, round-trip, omission clés vides

## Verification

- `npx jest lib/__tests__/parser-extended.test.ts -t "food_"` : 5 tests parseFamille + 2 parseInvites food_* = 7 passent
- `npx jest lib/__tests__/parser-extended.test.ts -t "parseInvites"` : 4 tests passent
- `npx jest lib/__tests__/parser-extended.test.ts` : 97/97 tests passent (aucune régression)
- `npx tsc --noEmit` : passe (0 erreurs nouvelles)
- PREF-05 validé : parseFamille sans clés food_* retourne `[]` sans crash

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing function] serializeFamille inexistante**
- **Found during:** Task 1 — le plan référençait `serializeFamille` dans les tests, mais la fonction n'existait pas dans parser.ts
- **Fix:** Créé `serializeFamille` complet avec toutes les clés du profil (non seulement food_*)
- **Files modified:** lib/parser.ts
- **Commit:** a145bf9

## Known Stubs

None — le parser produit des données réelles. L'intégration dans useVault (lecture/écriture vault) est prévue dans les plans suivants de la phase 15.

## Self-Check: PASSED

- `lib/types.ts` — modifié, foodAllergies présent
- `lib/parser.ts` — modifié, parseFoodCsv + parseFamille étendu + serializeFamille + parseInvites + serializeInvites + INVITES_FILE
- `lib/__tests__/parser-extended.test.ts` — modifié, 9 nouveaux tests (5 food_* + 4 parseInvites)
- Commits b33c73c, a145bf9, e335c31 — tous présents
