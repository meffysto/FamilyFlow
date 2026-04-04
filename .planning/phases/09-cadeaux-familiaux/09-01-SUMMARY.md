---
phase: 09-cadeaux-familiaux
plan: "01"
subsystem: mascot/gift-engine
tags: [gift-engine, parser, i18n, notifications, tdd]
dependency_graph:
  requires: []
  provides: [gift-engine-core, farm-profile-gift-fields, gift-notifications, gift-i18n]
  affects: [lib/mascot, lib/parser, lib/types, lib/notifications, locales]
tech_stack:
  added: []
  patterns: [gray-matter YAML frontmatter, CSV pipe-separated history, anti-abuse daily counter]
key_files:
  created:
    - lib/mascot/gift-engine.ts
    - lib/__tests__/gift-engine.test.ts
  modified:
    - lib/mascot/index.ts
    - lib/types.ts
    - lib/parser.ts
    - lib/notifications.ts
    - locales/fr/gamification.json
    - locales/en/gamification.json
decisions:
  - "parsePendingGifts utilise gray-matter defensive (?? []) — coherent avec parseCompanion"
  - "addGiftToInventory type=crafted ajoute toujours un nouvel item (pas d'increment sur recipeId) — simplifie le transfert sans ambiguité"
  - "NotifEvent etendu avec 'gift_received' pour eviter le cast 'as NotifEvent' dans BUILTIN_NOTIFICATIONS"
metrics:
  duration: 4min
  completed: "2026-04-04T16:51:34Z"
  tasks: 2
  files: 7
---

# Phase 09 Plan 01: Gift Engine — Moteur de cadeaux (logique pure) Summary

Moteur de cadeaux complet avec parsing YAML pending gifts, anti-abus 5/jour, transfert inventaire 4 types, historique CSV 10 derniers, parser farm etendu, template notification, et traductions FR/EN.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Creer gift-engine.ts (TDD) | 55f2db2 | lib/mascot/gift-engine.ts, lib/mascot/index.ts, lib/__tests__/gift-engine.test.ts |
| 2 | Etendre parser, types, notifications, i18n | 3a59004 | lib/types.ts, lib/parser.ts, lib/notifications.ts, locales/fr+en/gamification.json |

## What Was Built

### lib/mascot/gift-engine.ts

Moteur pur (sans React) exposant :

- `parsePendingGifts(content)` — lit un fichier YAML frontmatter via gray-matter, retourne `{ gifts: GiftEntry[] }` avec fallback defensif `?? []`
- `serializePendingGifts(gifts)` — produit un string Markdown valide via `matter.stringify`
- `canSendGiftToday(field, now?)` — parse le format `count|YYYY-MM-DD`, retourne false apres 5 envois le meme jour
- `incrementGiftsSent(field, now?)` — incremente ou remet a 1 selon la date
- `addGiftToInventory(farmData, entry)` — switch sur `item_type` pour les 4 buckets (harvest, rare_seed, crafted, building_resource), copie defensive
- `removeFromInventory(farmData, itemType, itemId, qty)` — verifie quantite, retourne `{ success, updated }`
- `buildGiftHistoryEntry(...)` — format `ISO|direction|fromId->toId|type:itemId:qty`
- `parseGiftHistory(csv)` — parse CSV virgule, max 10 entrees

### lib/types.ts / lib/parser.ts

- `FarmProfileData` etendu avec `giftHistory?: string` et `giftsSentToday?: string`
- `NotifEvent` etendu avec `'gift_received'`
- `parseFarmProfile` lit `gift_history` et `gifts_sent_today`
- `serializeFarmProfile` ecrit ces champs si presents

### lib/notifications.ts

Template `gift_received` ajoute dans `BUILTIN_NOTIFICATIONS` avec `defaultEnabled: true`.

### locales/ (FR + EN)

13 cles `gift_*` ajoutees dans les deux fichiers de traduction.

## Test Results

38 tests passent au vert :

- 5 tests `MAX_GIFTS_PER_DAY`/constants
- 4 tests `parsePendingGifts`
- 2 tests `serializePendingGifts`
- 6 tests `canSendGiftToday`
- 5 tests `incrementGiftsSent`
- 6 tests `addGiftToInventory`
- 6 tests `removeFromInventory`
- 3 tests `buildGiftHistoryEntry`
- 6 tests `parseGiftHistory`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Ajout de 'gift_received' au type NotifEvent**
- **Found during:** Task 2 — ajout du template dans BUILTIN_NOTIFICATIONS
- **Issue:** Le type `NotifEvent` ne contenait pas `'gift_received'`, ce qui aurait causé une erreur TypeScript
- **Fix:** Ajout de `'gift_received'` dans l'union `NotifEvent` dans lib/types.ts, suppression du cast `as NotifEvent`
- **Files modified:** lib/types.ts
- **Commit:** 3a59004

## Known Stubs

Aucun stub — ce plan est 100% logique pure sans composants UI. Le Plan 02 integrera cette logique dans les hooks et composants.

## Self-Check: PASSED
