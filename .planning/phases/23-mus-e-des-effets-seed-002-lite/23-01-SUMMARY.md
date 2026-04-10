---
phase: 23-mus-e-des-effets-seed-002-lite
plan: 01
subsystem: museum
tags: [museum, gamification, persistence, i18n, semantic-effects]
dependency_graph:
  requires: [lib/semantic/caps.ts, lib/semantic/effect-toasts.ts, lib/parser.ts, hooks/useGamification.ts]
  provides: [lib/museum/engine.ts — parseMuseumEntries, appendMuseumEntry, extractMuseumSection, groupEntriesByWeek, formatRelativeTime, appendMuseumEntryToVault]
  affects: [hooks/useGamification.ts — completeTask/openLootBox, lib/parser.ts — serializeGamification]
tech_stack:
  added: []
  patterns: [fire-and-forget async, module pur sans hook, section preservation via extractMuseumSection]
key_files:
  created:
    - lib/museum/engine.ts
  modified:
    - lib/parser.ts
    - hooks/useGamification.ts
    - locales/fr/common.json
    - locales/en/common.json
decisions:
  - "extractMuseumSection utilisée par openLootBox via lecture fichier brut (gamiRawContent) car gamiData est déjà parsé et ne contient pas le contenu brut"
  - "serializeGamification onDataChange calls (mémoire uniquement, pas de writeFile) ne passent pas museumSection — cohérent avec le plan"
  - "Locale type-only import depuis date-fns pour compatibilité TypeScript strict"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-10T06:58:57Z"
  tasks: 2
  files: 5
---

# Phase 23 Plan 01: Moteur persistance Musée des effets Summary

Module pur `lib/museum/engine.ts` câblé avec injection fire-and-forget dans `completeTask()` et protection de la section `## Musée` contre l'écrasement par `serializeGamification()`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Créer lib/museum/engine.ts + protéger serializeGamification | e7f6c8b | lib/museum/engine.ts, lib/parser.ts |
| 2 | Injection fire-and-forget dans completeTask + clés i18n | bc719e3 | hooks/useGamification.ts, locales/fr/common.json, locales/en/common.json |

## What Was Built

### lib/museum/engine.ts (nouveau module pur)

- `MuseumEntry` — type `{ date: Date; categoryId: CategoryId; icon: string; label: string }`
- `parseMuseumEntries(content)` — parse la section `## Musée` d'un gami-{id}.md
- `appendMuseumEntry(content, entry)` — ajoute une ligne à la section (crée si absente), respecte Pitfall 5 (insertion avant section suivante si non-terminale)
- `extractMuseumSection(content)` — extrait le bloc `## Musée` complet pour préservation
- `groupEntriesByWeek(entries)` — groupe par semaine (lundi), tri descendant, labels FR/EN
- `formatRelativeTime(date)` — "il y a Xh" / "Hier HH:mm" / "EEE HH:mm"
- `appendMuseumEntryToVault(vault, profileId, entry)` — seule fonction async, isole l'accès vault

### lib/parser.ts (modifié)

- `'Musée'` ajouté dans `RESERVED_SECTIONS` de `parseGamification()` — empêche la création d'un profil fictif nommé "Musée"
- `serializeGamification(data, museumSection?)` — nouveau paramètre optionnel, préserve la section `## Musée` si fournie (MUSEUM-03)

### hooks/useGamification.ts (modifié)

- Import de `appendMuseumEntryToVault`, `extractMuseumSection`, `MuseumEntry` depuis `lib/museum/engine`
- `completeTask()` : extrait `museumSection` du `gamiContent` avant l'écriture, le passe à `serializeGamification`
- `completeTask()` : bloc d'injection musée fire-and-forget après chaque `effectApplied` (MUSEUM-01)
- `openLootBox()` : lit le fichier brut (`gamiRawContent`) pour extraire `lootMuseumSection`, le passe à `serializeGamification`

### Clés i18n (FR + EN)

Clés `museum.*` ajoutées avec parité stricte : `title`, `thisWeek`, `weekHeader`, `empty`, `variant.ambient`, `variant.rare`, `variant.golden`.

## Decisions Made

- `extractMuseumSection` utilisée par `openLootBox` via une lecture fichier brut supplémentaire (`gamiRawContent`) — la fonction reçoit `gamiData` déjà parsé sans le contenu Markdown brut, donc un read supplémentaire est nécessaire pour extraire la section musée.
- Les appels `serializeGamification` dans les blocs `onDataChange` (merge mémoire uniquement, aucun `writeFile`) ne reçoivent pas `museumSection` — cohérent avec le plan (ces serializations ne sont jamais écrites dans le vault).
- Import `type Locale` depuis `date-fns` (import type-only) pour éviter l'erreur TS2304 en mode strict.

## Deviations from Plan

None — plan exécuté exactement comme écrit.

## Known Stubs

None — toutes les fonctions retournent des valeurs réelles. Le Plan 02 consommera les exports de `lib/museum/engine.ts` pour construire l'écran UI.

## Self-Check: PASSED

- [x] `lib/museum/engine.ts` existe et exporte toutes les fonctions requises
- [x] `lib/parser.ts` contient 'Musée' dans RESERVED_SECTIONS et `museumSection?` dans serializeGamification
- [x] `hooks/useGamification.ts` contient `appendMuseumEntryToVault`, `extractMuseumSection`, `museumSection`, `Musée — non-critical`
- [x] `locales/fr/common.json` et `locales/en/common.json` contiennent la clé `museum`
- [x] Commits e7f6c8b et bc719e3 existent
- [x] `npx tsc --noEmit` — zéro erreur nouvelle
