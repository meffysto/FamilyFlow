---
phase: quick-260424-jbt
plan: 01
subsystem: gamification
tags: [loot-box, companion, bug-fix, engine]
dependency_graph:
  requires: []
  provides: [filtre-companion-lootbox]
  affects: [lib/gamification/engine.ts]
tech_stack:
  added: []
  patterns: [helper-pur-filter, fallback-robuste]
key_files:
  modified:
    - lib/gamification/engine.ts
decisions:
  - "Helpers extraits comme fonctions pures locales (non exportées) au-dessus de openLootBox pour cohérence avec le style du fichier"
  - "drawRewardExcludingOwned() retourne pool[0] en ultime fallback plutôt que de lever une exception — préserve la Core Value stabilité"
  - "Cast 'as any' sur mascotItemId dans isRewardAlreadyOwned() pour CompanionSpecies — typé string dans RewardDefinition, cast minimal accepté"
metrics:
  duration: "~5min"
  completed: "2026-04-24"
  tasks: 1
  files: 1
---

# Quick 260424-jbt: Fix companion reward algorithm (exclude owned species) — Summary

**One-liner:** Filtre `unlockedSpecies` dans openLootBox et openAgentSecretLootBox via deux helpers purs pour éviter les doublons compagnon.

## What Was Done

Correction du bug où un compagnon déjà débloqué (chat, chien, lapin, renard, hérisson) pouvait être re-proposé comme récompense de loot box. La logique originale ne couvrait que `mascot_deco` et `mascot_hab` — les items de type `companion` tombaient dans le `else` qui vérifiait `profile.mascotInhabitants` (mauvaise liste). De plus, `openAgentSecretLootBox` n'avait aucun filtre owned.

### Helpers ajoutés dans `lib/gamification/engine.ts`

**`isRewardAlreadyOwned(reward, profile)`** — vérifie si une récompense est déjà possédée :
- `companion` → `profile.companion?.unlockedSpecies ?? []`
- `mascot_deco` → `profile.mascotDecorations`
- `mascot_hab` → `profile.mascotInhabitants`

**`drawRewardExcludingOwned(pool, profile)`** — tire depuis le pool en excluant les items possédés :
- Filtre tous les owned avant le tirage aléatoire
- Fallback 1 : si tout possédé → récompenses génériques (pas de mascotItemId)
- Fallback 2 : `pool[0]` (ultime, ne devrait jamais arriver)

### Modifications dans `openLootBox()`

Remplace le bloc buggy (5 lignes) par appel à `drawRewardExcludingOwned()` pour le tirage normal. Ajoute aussi une protection sur le drop saisonnier : si l'événement propose un item déjà possédé, re-draw depuis le pool normal.

### Modifications dans `openAgentSecretLootBox()`

Remplace le tirage direct `REWARDS[rarity][random]` par `drawRewardExcludingOwned(REWARDS[rarity], profile)`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | d11f743 | fix(quick-260424-jbt): filtrer compagnons déjà possédés dans openLootBox + openAgentSecretLootBox |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- lib/gamification/engine.ts modifié : FOUND
- Commit d11f743 : FOUND
- `npx tsc --noEmit` : aucune nouvelle erreur TS dans engine.ts
- `isRewardAlreadyOwned` présent : OUI (ligne 176)
- `drawRewardExcludingOwned` présent : OUI (ligne 199)
- `openLootBox` utilise drawRewardExcludingOwned : OUI (lignes 238-242)
- `openAgentSecretLootBox` utilise drawRewardExcludingOwned : OUI (ligne 469)
- `unlockedSpecies` référencé dans isRewardAlreadyOwned : OUI (ligne 186)
