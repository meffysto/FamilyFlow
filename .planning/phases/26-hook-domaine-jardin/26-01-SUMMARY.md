---
phase: 26-hook-domaine-jardin
plan: 01
subsystem: gamification
tags: [vault, useVault, jardin, village, farm-profile, garden]

requires:
  - phase: 25-fondation-donnees-village
    provides: VILLAGE_FILE constant + lib/village parser module

provides:
  - VaultState.gardenRaw: string — contenu brut de jardin-familial.md
  - VaultState.setGardenRaw — setter pour le contenu village
  - FarmProfileData.village_claimed_week — flag anti-double-claim per profil
  - parseFarmProfile lit village_claimed_week depuis gami-{id}.md
  - serializeFarmProfile écrit village_claimed_week si présent

affects: [26-hook-domaine-jardin plan 02, useGarden.ts, VillageScreen]

tech-stack:
  added: []
  patterns:
    - "Promise.allSettled [21] pattern — index constant pour village garden dans le batch de chargement"
    - "Champ optionnel backward-compatible — village_claimed_week ignoré si absent dans fichiers existants"

key-files:
  created: []
  modified:
    - hooks/useVault.ts
    - lib/types.ts
    - lib/parser.ts

key-decisions:
  - "gardenRaw exposé comme string brute dans VaultState — useGarden.ts (Plan 02) fait le parse lui-même"
  - "village_claimed_week persisté dans gami-{id}.md (per-profil) — distinct du flag partagé dans jardin-familial.md"

patterns-established:
  - "Index [21] réservé pour le village garden dans Promise.allSettled de loadVaultData"
  - "God hook boundary respectée : 13 lignes ajoutées sur 15 max autorisées"

requirements-completed: [DATA-03, OBJ-05]

duration: 5min
completed: 2026-04-10
---

# Phase 26 Plan 01: Hook Domaine Jardin — Câblage Infrastructure Summary

**gardenRaw/setGardenRaw exposés dans VaultState + village_claimed_week dans FarmProfileData avec parseur/sérialiseur backward-compatible**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-10T18:48:00Z
- **Completed:** 2026-04-10T18:50:54Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- FarmProfileData étendu avec `village_claimed_week?: string` — flag anti-double-claim per profil
- parseFarmProfile lit `village_claimed_week` depuis les fichiers gami-{id}.md existants (backward-compatible)
- serializeFarmProfile écrit `village_claimed_week` si présent (champ optionnel, silencieux si absent)
- useVault.ts câblé avec VILLAGE_FILE import, useState gardenRaw, lecture dans Promise.allSettled [21], exposition dans VaultState — 13 lignes ajoutées (boundary 15 max respectée)

## Task Commits

1. **Task 1: FarmProfileData + parseFarmProfile + serializeFarmProfile village_claimed_week** - `154eed6` (feat)
2. **Task 2: Câbler gardenRaw dans useVault.ts** - `be501ab` (feat)

## Files Created/Modified

- `lib/types.ts` — ajout `village_claimed_week?: string` dans FarmProfileData
- `lib/parser.ts` — parseFarmProfile lit village_claimed_week, serializeFarmProfile l'écrit
- `hooks/useVault.ts` — import VILLAGE_FILE, useState gardenRaw, readFile [21], setGardenRaw, return useMemo + deps

## Decisions Made

- gardenRaw exposé comme string brute — useGarden.ts (Plan 02) sera responsable du parse via parseGardenFile
- village_claimed_week dans gami-{id}.md (per profil) — distinct du flag `reward_claimed` partagé dans jardin-familial.md
- Index [21] fixe dans Promise.allSettled — cohérent avec le pattern établi par les indices [0]-[20]

## Deviations from Plan

None — plan exécuté exactement comme spécifié.

## Issues Encountered

None — tsc --noEmit passe, 13 lignes ajoutées (boundary 15 respectée), grep retourne 9 occurrences (>= 7 requis), village_claimed_week présent sur 3 lignes exactement.

## User Setup Required

None — pas de configuration externe requise.

## Next Phase Readiness

- Infrastructure prête pour useGarden.ts (Plan 02)
- gardenRaw disponible dans VaultState pour consommation par useGarden.ts
- village_claimed_week géré en round-trip complet (parse + serialize)
- Pas de blockers — Plan 02 peut démarrer immédiatement

---
*Phase: 26-hook-domaine-jardin*
*Completed: 2026-04-10*
