---
phase: 10-compagnon-mascotte
plan: "02"
subsystem: gamification
tags: [companion, parser, famille-md, lootbox, xp-bonus, useVault, useGamification]

# Dependency graph
requires:
  - phase: 10-compagnon-mascotte-01
    provides: companion-types.ts, companion-engine.ts, CompanionData type, getCompanionXpBonus()
provides:
  - parseCompanion/serializeCompanion dans lib/parser.ts
  - parseFamille() lit le champ companion et retourne CompanionData
  - setCompanion(profileId, companion) dans useVault — persiste dans famille.md
  - unlockCompanion(profileId, speciesId) dans useVault — ajoute espece debloquee
  - Bonus XP +5% compagnon dans useGamification.completeTask
  - Rewardtype companion dans openLootBox avec persistence famille.md
  - 5 entrees compagnon dans pool lootbox (3 rare, 2 epique)
affects:
  - 10-compagnon-mascotte-03
  - 10-compagnon-mascotte-04

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "parseCompanion: format CSV activeSpecies:name:unlocked1|unlocked2:mood pour famille.md"
    - "setCompanion suit le pattern writeFarmCrops (lecture famille.md, mise a jour section profil, ecriture)"
    - "unlockCompanion verifie companion != null avant d'ajouter l'espece"
    - "Bonus XP compagnon applique comme delta post-awardTaskCompletion (pas modification engine.ts)"
    - "rewardType companion dans openLootBox: pattern identique mascot_deco, ecriture directe famille.md"

key-files:
  created: []
  modified:
    - lib/parser.ts
    - hooks/useVault.ts
    - hooks/useGamification.ts
    - lib/gamification/rewards.ts

key-decisions:
  - "parseCompanion retourne null (pas undefined) — les composants testent profile.companion != null"
  - "Backward-compat parseFamille: spread conditionnel ...(companion !== null ? { companion } : {}) pour ne pas ecraser undefined"
  - "Bonus XP compagnon calcule comme delta apres awardTaskCompletion plutot que modifier engine.ts (moins invasif)"
  - "unlockCompanion lit famille.md directement (parseFamille) plutot que d'utiliser le state React pour eviter stale closure"
  - "openLootBox companion: pattern identique mascot_deco (vault.readFile/writeFile direct) sans passer par setCompanion de useVault"

patterns-established:
  - "Pattern companion CSV: activeSpecies:name:species1|species2:mood — meme separateur | que les tags ailleurs"
  - "Toutes les fonctions companion dans useVault utilisent vaultRef.current (pas vault du closure) pour fraicheur"

requirements-completed: [COMP-05, COMP-06]

# Metrics
duration: 15min
completed: 2026-03-30
---

# Phase 10 Plan 02: Couche donnees compagnon Summary

**Parsing bidirectionnel companion dans famille.md, hooks setCompanion/unlockCompanion, bonus XP +5%, et 5 entrees compagnon dans les pools lootbox rare/epique**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-30T20:33:00Z
- **Completed:** 2026-03-30T20:48:43Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- parseCompanion/serializeCompanion exportes depuis lib/parser.ts avec format CSV activeSpecies:name:unlocked:mood
- parseFamille() integre la lecture du champ `companion:` de chaque section profil (backward-compatible)
- setCompanion() et unlockCompanion() ajoutés à useVault (VaultState + implementation + useMemo)
- Bonus XP +5% compagnon integre dans useGamification.completeTask via getCompanionXpBonus()
- Traitement rewardType 'companion' dans openLootBox pour debloquer l'espece droppee dans famille.md
- 3 compagnons dans pool rare (chat, chien, lapin), 2 dans pool epique (renard, herisson)

## Task Commits

Chaque tache a ete committee atomiquement :

1. **Task 1: Parser companion + integration parseFamille** - `770957c` (feat)
2. **Task 2: Hooks useVault/useGamification + rewards lootbox** - `3f77539` (feat)

## Files Created/Modified

- `lib/parser.ts` — Ajout import companion-types, parseCompanion(), serializeCompanion(), integration dans parseFamille flush()
- `hooks/useVault.ts` — Ajout import CompanionData/CompanionSpecies/serializeCompanion, setCompanion(), unlockCompanion(), VaultState type mis a jour, expose dans useMemo
- `hooks/useGamification.ts` — Ajout import getCompanionXpBonus/parseFamille/serializeCompanion/CompanionSpecies, bonus XP dans completeTask, handling rewardType companion dans openLootBox
- `lib/gamification/rewards.ts` — 5 nouvelles entrees compagnon (3 rare + 2 epique)

## Decisions Made

- parseCompanion retourne null (pas undefined) — les composants testent `profile.companion != null` pour coherence avec les autres champs optionnels nullables
- Backward-compat parseFamille : spread conditionnel `...(companion !== null ? { companion } : {})` pour ne pas ecraser `undefined` sur les profils existants sans champ companion
- Bonus XP compagnon calcule comme delta post-awardTaskCompletion plutot que modifier engine.ts pour limiter l'impact
- unlockCompanion relit famille.md directement via parseFamille pour eviter les stale closures sur le state React
- openLootBox companion suit le pattern identique a mascot_deco (ecriture directe vault.readFile/writeFile) sans passer par setCompanion pour eviter les appels imbriques

## Deviations from Plan

None - plan execute exactement tel qu'ecrit.

## Issues Encountered

Aucun. Les erreurs TypeScript visibles au run de tsc proviennent uniquement de docs/family-flow-promo.tsx (erreurs pre-existantes hors perimetre).

## Next Phase Readiness

La couche donnees compagnon est complete. Les plans 03 et 04 peuvent s'appuyer sur :
- `profile.companion` disponible dans tous les composants via useVault()
- `setCompanion()` et `unlockCompanion()` accessibles pour le picker initial et les upgrades
- Bonus XP actif des qu'un profil a un compagnon configure
- Lootbox pret a dropper des compagnons

---
*Phase: 10-compagnon-mascotte*
*Completed: 2026-03-30*
