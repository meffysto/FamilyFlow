---
phase: 10-compagnon-mascotte
plan: "01"
subsystem: companion
tags: [types, engine, i18n, sprites, tdd]
dependency_graph:
  requires: []
  provides: [companion-types, companion-engine, companion-i18n, companion-sprites]
  affects: [lib/types.ts, locales/fr/common.json, locales/en/common.json]
tech_stack:
  added: []
  patterns: [pure-functions, tdd-red-green, companion-system]
key_files:
  created:
    - lib/mascot/companion-types.ts
    - lib/mascot/companion-engine.ts
    - lib/__tests__/companion-engine.test.ts
    - assets/garden/animals/chat/bebe/idle_1.png (+ 29 autres sprites)
  modified:
    - lib/types.ts
    - locales/fr/common.json
    - locales/en/common.json
decisions:
  - "getCompanionMood accepte currentHour en parametre optionnel pour la testabilite (evite test fragile selon l'heure)"
  - "COMPANION_STAGES: bebe 1-5, jeune 6-10, adulte 11+ (pattern identique TREE_STAGES)"
  - "5 especes: chat/chien/lapin initial, renard rare, herisson epique (per D-01 et D-03)"
  - "pickCompanionMessage retourne la cle i18n (pas le texte final) — le composant appelant fait t()"
metrics:
  duration: "~10min"
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_changed: 35
---

# Phase 10 Plan 01: Fondations systeme compagnon Summary

**One-liner:** Types CompanionSpecies/Stage/Mood/Data + moteur pure functions (getCompanionStage, getCompanionMood, getCompanionXpBonus, pickCompanionMessage) + 30 sprites placeholder + cles i18n companion.* fr/en

## What Was Built

### Task 1: Types compagnon + moteur pure functions (TDD)

**lib/mascot/companion-types.ts** — Catalogue de types et constantes :
- `CompanionSpecies`, `CompanionStage`, `CompanionMood`, `CompanionEvent`, `CompanionData`
- `COMPANION_STAGES` : 3 stades (bebe 1-5, jeune 6-10, adulte 11+)
- `COMPANION_SPECIES_CATALOG` : 5 especes (chat/chien/lapin=initial, renard=rare, herisson=epique)
- `COMPANION_UNLOCK_LEVEL = 5`, `COMPANION_XP_BONUS = 1.05`

**lib/mascot/companion-engine.ts** — Pure functions :
- `getCompanionStage(level)` — miroir exact de getTreeStage()
- `getCompanionMood(tasks, hours, currentHour?)` — triste/endormi/excite/content
- `getCompanionXpBonus(companion)` — 1.05 si actif, 1.0 sinon
- `MESSAGE_TEMPLATES` — 3-5 cles i18n par evenement (7 evenements)
- `pickCompanionMessage(event, context)` — retourne cle i18n aleatoire

**lib/types.ts** modifie :
- `companion?: CompanionData | null` ajouté sur `Profile` (apres `farmTech`)
- `| 'companion'` ajouté dans `RewardType`

### Task 2: Sprites placeholder + cles i18n

**30 sprites PNG** copiés depuis poussin/ :
- 5 especes x 3 stades x 2 frames (idle_1.png, idle_2.png)
- Debloquent require() dans Metro bundler sans crash

**locales/fr/common.json** et **locales/en/common.json** — namespace `companion` :
- stage, mood, species, speciesDesc, picker, bonus, msg (7 sous-cles)
- 15 occurrences de {{companionName}} en fr

## Verification Results

- 29/29 tests passent (TDD green)
- `npx tsc --noEmit` — aucune nouvelle erreur (seules errors pre-existantes docs/family-flow-promo.tsx)
- `ls assets/garden/animals/*/bebe/idle_1.png | wc -l` → 5
- `grep "companion" lib/types.ts | wc -l` → 2 lignes
- i18n tests passent (34/34)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing feature] getCompanionMood currentHour parametre optionnel**
- **Found during:** Task 1 (TDD)
- **Issue:** Le plan notait que getCompanionMood avec new Date().getHours() serait fragile en test selon l'heure d'execution
- **Fix:** Parametre optionnel `currentHour?: number` pour testabilite — les tests passent à toute heure
- **Files modified:** lib/mascot/companion-engine.ts, lib/__tests__/companion-engine.test.ts
- **Commit:** 9a544e3

## Known Stubs

Aucun stub — les sprites sont des placeholders intentionnels qui seront remplacés par les assets finaux dans un plan futur (les dossiers et chemins sont corrects pour Metro bundler).

## Self-Check: PASSED
