---
phase: 42-nourrir-le-compagnon
plan: 01
subsystem: mascot-companion
tags: [types, buff, affinity, pure-helpers, foundation]
requires: []
provides:
  - CompanionData.lastFedAt (optional)
  - CompanionData.feedBuff (optional)
  - FeedBuff interface
  - HarvestGrade type
  - CropAffinity type
  - FEED_COOLDOWN_MS constant
  - GRADE_BUFF_TABLE constant
  - AFFINITY_MULTIPLIER constant
  - COMPANION_PREFERENCES mapping (Option A)
  - getAffinity() helper
  - getBuffForCrop() helper
  - isBuffActive() helper
  - getCooldownRemainingMs() helper
affects:
  - lib/mascot/companion-types.ts
tech-stack:
  added: []
  patterns: [pure-functions, backward-compat-optional-fields]
key-files:
  created: []
  modified:
    - lib/mascot/companion-types.ts
decisions:
  - Mapping Option A (D-13 révisé) appliqué verbatim, tous IDs vérifiés présents dans CROP_CATALOG
  - Helpers purs acceptent `nowMs` injectable (testabilité)
  - `+(x).toFixed(4)` pour éviter flottants 1.3 × 1.15 = 1.49499... → 1.495
metrics:
  duration: "3min"
  completed: "2026-04-22"
requirements: [FEED-01, FEED-02, FEED-03]
---

# Phase 42 Plan 01: Fondation types feed compagnon Summary

Types + constantes buff + 4 helpers purs pour le nourrissage compagnon, zéro dépendance, consommable par tous les plans aval (parser, engine, UI, gamification, Live Activity).

## Changes

### Modified: `lib/mascot/companion-types.ts` (+107 lignes)

**Types ajoutés :**
- `HarvestGrade` = `'ordinary' | 'good' | 'excellent' | 'perfect'`
- `CropAffinity` = `'preferred' | 'neutral' | 'hated'`
- `FeedBuff` = `{ multiplier: number; expiresAt: string }`

**CompanionData étendu (backward compat D-16) :**
- `lastFedAt?: string` — ISO du dernier nourrissage (cooldown 3h)
- `feedBuff?: FeedBuff | null` — buff XP actif

**Constantes exportées :**
- `FEED_COOLDOWN_MS = 10_800_000` (3h)
- `GRADE_BUFF_TABLE` — ordinary 1.05/30min, good 1.10/45min, excellent 1.12/60min, perfect 1.15/90min
- `AFFINITY_MULTIPLIER` — preferred 1.3, neutral 1.0, hated 0
- `COMPANION_PREFERENCES` (Option A validée user 2026-04-22)

**Mapping COMPANION_PREFERENCES final (Option A) :**

| Espèce   | Préféré        | Détesté      |
| -------- | -------------- | ------------ |
| chat     | strawberry 🍓  | cucumber 🥒  |
| chien    | pumpkin 🎃     | tomato 🍅    |
| lapin    | carrot 🥕      | corn 🌽      |
| renard   | beetroot 🫜    | wheat 🌾     |
| herisson | potato 🥔      | cabbage 🥬   |

**Validation CROP_CATALOG** : tous les 10 IDs (strawberry, cucumber, pumpkin, tomato, carrot, corn, beetroot, wheat, potato, cabbage) confirmés présents dans `lib/mascot/types.ts` CROP_CATALOG. Zéro drift assets.

**Helpers purs exportés (signatures finales) :**
```typescript
getAffinity(species: CompanionSpecies, cropId: string): CropAffinity
getBuffForCrop(grade: HarvestGrade, species: CompanionSpecies, cropId: string, nowMs?: number): FeedBuff | null
isBuffActive(feedBuff: FeedBuff | null | undefined, nowMs?: number): boolean
getCooldownRemainingMs(lastFedAt: string | undefined, nowMs?: number): number
```

## Deviations from Plan

None - plan exécuté exactement comme écrit.

## Commits

- `cd0389d` — feat(42-01): types feed compagnon (buff table + affinités Option A + helpers)

## Verification

- `npx tsc --noEmit` : clean (aucune nouvelle erreur)
- Tous IDs COMPANION_PREFERENCES présents dans CROP_CATALOG (vérifié au boot)
- Backward compat : CompanionData sans lastFedAt/feedBuff reste valide

## Self-Check: PASSED

- File exists : `lib/mascot/companion-types.ts` FOUND
- Commit exists : `cd0389d` FOUND
- grep FEED_COOLDOWN_MS / GRADE_BUFF_TABLE / COMPANION_PREFERENCES / helpers : tous présents
