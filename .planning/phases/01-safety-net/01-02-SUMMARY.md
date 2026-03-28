---
phase: 01-safety-net
plan: "02"
subsystem: code-quality
tags: [dead-code, typescript, eslint, as-any, migration]
dependency_graph:
  requires: []
  provides: [eslint-config, typed-mutations]
  affects: [lib/telegram.ts, lib/ai-service.ts, hooks/useVault.ts]
tech_stack:
  added: [eslint, typescript-eslint, @typescript-eslint/eslint-plugin, @typescript-eslint/parser]
  patterns: [flat-config-eslint-v9, destructuring-omit, catch-type-annotation]
key_files:
  created: [eslint.config.js]
  modified: [lib/telegram.ts, lib/ai-service.ts, hooks/useVault.ts, package.json]
decisions:
  - "GratitudeDay (pas GratitudeEntry) est le type de retour de parseGratitude — corrigé dans le SUMMARY"
  - "Defi[] est le type du catch de l'IIFE défis, pas GamificationData | null — les numéros de ligne du plan étaient décalés"
  - "ESLint v9 flat config en CommonJS car le projet n'a pas type:module"
metrics:
  duration: "~6 minutes"
  completed: "2026-03-28"
  tasks_completed: 2
  files_changed: 4
  files_created: 1
---

# Phase 01 Plan 02: Nettoyage code mort + as any + ESLint Summary

Suppression de 164 lignes de code mort (5 fonctions deprecated telegram, migration ménage, menageTasks), remplacement des 6 assertions `as any` par des types corrects dans useVault.ts, et installation d'ESLint v9 avec règle `no-explicit-any` en warn.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Supprimer code mort — telegram + menageTasks | 487a32f | lib/telegram.ts, lib/ai-service.ts, hooks/useVault.ts |
| 2 | Corriger as any + configurer ESLint | 387d13b | hooks/useVault.ts, eslint.config.js, package.json |

## What Was Built

### Task 1 — Code mort supprimé

**lib/telegram.ts:** Suppression des 5 fonctions deprecated (formatTaskCompletedMessage, formatLootBoxMessage, formatAllTasksDoneMessage, formatLeaderboardMessage, formatDailySummaryMessage) et de l'import `LootBox` devenu inutile. Résultat: -61 lignes.

**lib/ai-service.ts:** Suppression de la propriété `menageTasks?: Task[]` de l'interface `VaultContext` et remplacement du fallback `ctx.menageTasks ?? ctx.tasks.filter(...)` par le filtre inline directement.

**hooks/useVault.ts:** Suppression complète de la fonction `migrateMenageToTasks()`, ses constantes associées (MENAGE_FILE, TACHES_RECURRENTES_FILE, DAY_MAP, nextWeekday) et son appel dans `loadVaultData`. Résultat: -103 lignes.

### Task 2 — Corrections as any

Les 6 assertions `as any` dans `hooks/useVault.ts` remplacées :

| Avant | Après |
|-------|-------|
| `return [] as any[]` (routines catch) | `(): Routine[] => []` |
| `() => [] as any[]` (défis IIFE catch) | `(): Defi[] => []` |
| `() => [] as any[]` (gratitude catch) | `(): GratitudeDay[] => []` |
| `() => [] as any[]` (wishlist catch) | `(): WishlistItem[] => []` |
| `species as any` | `species as TreeSpecies` (import ajouté) |
| `delete (updated as any).lineIndex` | `const { lineIndex: _, ...updatedClean } = ...` |

### ESLint configuré

`eslint.config.js` créé (flat config ESLint v9, format CommonJS) avec `@typescript-eslint/no-explicit-any: warn` sur `hooks/**` et `lib/**`. Script `lint` ajouté dans package.json.

## Deviations from Plan

### Correction du compte — as any

Le plan mentionnait "8 assertions as any" (depuis REQUIREMENTS.md QUAL-04). Le fichier n'en contenait que 6 — confirmé par grep avant et après Task 1. Le plan lui-même corrigeait déjà ce compte à 6 dans sa note.

### Correction des types catch — numéros de ligne décalés

Le plan associait le catch à la ligne ~876 avec `GamificationData | null`. Après suppression de Task 1 (88 lignes), les numéros ont bougé. L'IIFE à cette position retourne `Defi[]` (résultat de `parseDefis`), pas `GamificationData`. Corrigé vers `(): Defi[] => []`.

### Type GratitudeDay vs GratitudeEntry

Le plan mentionnait `GratitudeEntry[]` pour le catch gratitude. Le type réel de retour de `parseGratitude` est `GratitudeDay[]`. Corrigé avec le bon type.

## Verification Results

```
grep -c "formatTaskCompletedMessage" lib/telegram.ts  → 0
grep -c "menageTasks" lib/ai-service.ts               → 0
grep -c "migrateMenageToTasks" hooks/useVault.ts      → 0
grep -c "as any" hooks/useVault.ts                    → 0
eslint.config.js                                      → présent
grep -c "typescript-eslint" package.json              → 3
npx tsc --noEmit (sur fichiers modifiés)              → 0 nouvelles erreurs
npm run lint                                          → fonctionne (warnings pre-existants acceptés)
```

## Self-Check: PASSED

- lib/telegram.ts: FOUND
- hooks/useVault.ts: FOUND
- eslint.config.js: FOUND
- commit 487a32f: FOUND
- commit 387d13b: FOUND
