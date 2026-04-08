---
phase: 16-codex-contenu
plan: 04
subsystem: codex
tags: [codex, sagas, quests, seasonal, i18n]
requires: [16-01]
provides:
  - lib/codex/sagas.ts
  - lib/codex/quests.ts
  - lib/codex/seasonal.ts
  - locales saga/quest/seasonal FR+EN
affects:
  - locales/fr/codex.json
  - locales/en/codex.json
tech-stack:
  added: []
  patterns:
    - "Object.keys(Record).map → array d'entries codex (seasonal)"
    - "iconRef = emoji depuis ADVENTURES (quests)"
key-files:
  created:
    - lib/codex/sagas.ts
    - lib/codex/quests.ts
    - lib/codex/seasonal.ts
  modified:
    - locales/fr/codex.json
    - locales/en/codex.json
decisions:
  - "SEASONAL_EVENT_DIALOGUES traité comme Record et non array (per RESEARCH ligne 381) — Object.keys.map"
  - "iconRef pour quests = emoji depuis ADVENTURES (déjà disponible, pas de stat dupliquée)"
  - "String(s.id) défensif sur SAGAS pour neutraliser un éventuel typage littéral"
metrics:
  duration: 8min
  tasks: 2
  files: 5
  completed: 2026-04-08
---

# Phase 16 Plan 04 : Sagas, Quêtes & Seasonal Summary

3 fichiers codex (sagas, quests, seasonal) dérivés des sources engine SAGAS / ADVENTURES / SEASONAL_EVENT_DIALOGUES, avec 27 entrées de lore bilingue FR+EN.

## What Shipped

### Task 1 : Sagas + Quêtes (commit 224c045)

- `lib/codex/sagas.ts` : `sagaEntries: SagaEntry[]` dérivé de `SAGAS.map(...)` — 4 entrées (`voyageur_argent`, `source_cachee`, `carnaval_ombres`, `graine_anciens`).
- `lib/codex/quests.ts` : `questEntries: QuestEntry[]` dérivé de `ADVENTURES.map(...)` — 15 entrées avec `iconRef = a.emoji`.
- `locales/fr/codex.json` & `locales/en/codex.json` : sections `saga` (4) et `quest` (15) remplies bilingue, lore évocateur 2-4 phrases zéro stat.

### Task 2 : Seasonal (commit 0d67fdd)

- `lib/codex/seasonal.ts` : `seasonalEntries: SeasonalEntry[]` via `Object.keys(SEASONAL_EVENT_DIALOGUES).map(...)` (Record, pas array — point d'attention de la RESEARCH).
- 8 entrées : `nouvel-an`, `st-valentin`, `poisson-avril`, `paques`, `ete`, `rentree`, `halloween`, `noel`.
- Lore FR+EN évoquant l'événement et son impact ferme, 2-4 phrases.

## Verification

- Script Task 1 : `OK 4 sagas, 15 quests`
- Script Task 2 : `OK 8 seasonal`
- `npx tsc --noEmit` : zéro erreur sur `lib/codex/sagas.ts`, `lib/codex/quests.ts`, `lib/codex/seasonal.ts`

## Deviations from Plan

None — plan exécuté exactement comme écrit.

Note exécution : la branche du worktree était en retard sur main qui contenait déjà le plan 16-01 mergé ; un `git merge main` a été nécessaire avant de commencer pour récupérer `lib/codex/types.ts`, `lib/codex/stats.ts`, les locales vides et le PLAN.md. Aucune modification de code, simple synchro worktree parallèle.

## Known Stubs

Aucun. Les 27 entrées sont complètes en FR+EN avec lore final.

## Self-Check: PASSED

- FOUND: lib/codex/sagas.ts
- FOUND: lib/codex/quests.ts
- FOUND: lib/codex/seasonal.ts
- FOUND: locales/fr/codex.json (saga, quest, seasonal remplis)
- FOUND: locales/en/codex.json (saga, quest, seasonal remplis)
- FOUND: commit 224c045 (Task 1)
- FOUND: commit 0d67fdd (Task 2)
