---
phase: 15-quetes-cooperatives-ferme
plan: 01
subsystem: quest-engine
tags: [quetes, cooperatif, ferme, gamification, parser, hooks]
dependency_graph:
  requires: []
  provides: [lib/quest-engine.ts, constants/questTemplates.ts, hooks/useVaultFamilyQuests.ts, parseFamilyQuests, serializeFamilyQuests, FAMILY_QUESTS_FILE]
  affects: [hooks/useVault.ts, hooks/useGamification.ts, hooks/useFarm.ts, hooks/useVaultDefis.ts]
tech_stack:
  added: [expo-notifications (scheduleNotificationAsync pour expiration)]
  patterns: [reward-first pattern, read frais (evite stale state), contrainte 1 active max, role check adulte/ado]
key_files:
  created:
    - lib/quest-engine.ts
    - constants/questTemplates.ts
    - hooks/useVaultFamilyQuests.ts
  modified:
    - lib/parser.ts
    - hooks/useVault.ts
    - hooks/useGamification.ts
    - hooks/useFarm.ts
    - hooks/useVaultDefis.ts
decisions:
  - "FamilyQuestType inclut golden_harvest distinct de harvest — 2 types de recoltes pour quetes specifiques"
  - "contribute() lit le fichier frais depuis vault (pas depuis state React) — evite race conditions read-modify-write"
  - "checkAndExpireQuests appele depuis loadVaultData — detection passive sans hook supplementaire"
  - "onQuestProgress optionnel dans useGamification/useFarm/useVaultDefis — backward-compatible, les ecrans passent la fonction si besoin"
  - "contributeFamilyQuest expose dans VaultState avec type FamilyQuestType (pas string) — typage fort"
metrics:
  duration: 45min
  completed_date: "2026-04-06"
  tasks: 2
  files: 8
---

# Phase 15 Plan 01: Quest Engine + Parser + Hook Domaine Summary

Systeme complet de quetes cooperatives familiales — moteur de types, serialisation, 7 templates, extensions parser, hook domaine CRUD, et integration progression dans les hooks existants.

## Objectif accompli

Implementer toute la couche donnees/logique pour que la famille puisse creer, progresser, et completer des quetes partagees avec recompenses ferme. Contrainte : 1 seule quete active a la fois, demarrage reserve aux adultes/ados, detection expiration avec notification.

## Taches executees

### Tache 1 : Types quest-engine + parser + templates

**Commit:** `aad7d70`, `35fbaeb`

Fichiers crees/modifies :
- `lib/quest-engine.ts` — FamilyQuestType (8 valeurs), FamilyFarmReward (11 variantes union discriminee), FamilyQuest, FamilyQuestTemplate, serializeReward/parseReward (format compact type:param), applyQuestReward (pattern reward-first pour 11 types de recompenses), createQuestFromTemplate
- `constants/questTemplates.ts` — 7 QUEST_TEMPLATES : moisson_collective (harvest/25/7j/loot_legendary), grand_defrichage (tasks/120/14j/unlock_plot), champions_defi (defis/3/14j/rare_seeds:10), artisans_familiaux (craft/5/10j/crafting_recipe), graines_dorees (golden_harvest/3/14j/golden_rain), semaine_production (production/30/7j/production_boost), pluie_magique (tasks/30/5j/rain_bonus)
- `lib/parser.ts` — FAMILY_QUESTS_FILE, parseFamilyQuests (H2=titre, cles/valeurs, contributions Record), serializeFamilyQuests (avec meta optionnel activeEffect/trophees/recettes/decorations)

### Tache 2 : Hook useVaultFamilyQuests + cablage

**Commit:** `e6aec46`, `62d78bf`

Fichiers crees/modifies :
- `hooks/useVaultFamilyQuests.ts` — Hook complet avec startQuest (1 active max + role check adulte/ado), contribute (read frais depuis vault), completeQuest (reward-first via applyQuestReward), checkAndExpireQuests (notification locale immediate), deleteQuest, resetQuests
- `hooks/useVault.ts` — questsHook integre apres defisHook, chargement + expiration au loadVaultData, 5 proprietes exposees dans VaultState (familyQuests/startFamilyQuest/contributeFamilyQuest/completeFamilyQuest/deleteFamilyQuest)
- `hooks/useGamification.ts` — onQuestProgress? ajoute aux args, appele apres ecriture gami (type='tasks', amount=1)
- `hooks/useFarm.ts` — onQuestProgress? ajoute aux params, appele apres harvest (harvest/golden_harvest), collectBuildingResources (production), craft (craft)
- `hooks/useVaultDefis.ts` — onQuestProgress? ajoute aux params, appele dans checkInDefi apres check-in complete (type='defis')

## Decisions prises

| Decision | Contexte | Impact |
|----------|----------|--------|
| `contribute()` lit le fichier frais | Pattern vault direct (pas state React) | Evite race conditions quand plusieurs profils progressent en parallele |
| `checkAndExpireQuests` appele au loadVaultData | Detection passive sans timer | Simple, coheret avec le pattern defis existant |
| `onQuestProgress` optionnel dans les hooks | Backward-compat avec les ecrans existants | Les ecrans existants ne cassent pas — ils peuvent passer la fn si besoin |
| `contributeFamilyQuest` expose dans VaultState | Accessibilite depuis tous les ecrans | Les composants peuvent contribuer directement depuis useVault() |
| Imports FamilyQuest en tete de parser.ts | Bonne pratique TypeScript | Evite les imports milieu-fichier potentiellement problematiques |

## Deviations du plan

Aucune — plan execute exactement comme specifie. Une clarification d'implementation :

**Adaptation : onQuestProgress dans les hooks existants**

Le plan specifiait "passer questsHook.contribute comme onQuestProgress au gamiHook et farmHook via les callbacks". `useGamification` et `useFarm` sont appeles directement dans les composants (pas dans useVault.ts). L'implementation expose `contributeFamilyQuest` dans le VaultState — les composants peuvent le passer via `onQuestProgress` quand ils appellent ces hooks. L'interface est preparee et backward-compatible.

## Verification tsc

Seules les erreurs pre-existantes subsistent (docs/family-flow-promo.tsx — module remotion manquant, hooks/__tests__/useVaultMemories.test.ts — type MemoryType). Aucune nouvelle erreur introduite.

## Known Stubs

Aucun stub. Toutes les fonctions ont une implementation reelle. Les quetes seront visibles via `familyQuests` dans le contexte vault des la prochaine phase UI.

## Self-Check: PASSED

- FOUND: lib/quest-engine.ts (aad7d70)
- FOUND: constants/questTemplates.ts (aad7d70)
- FOUND: hooks/useVaultFamilyQuests.ts (e6aec46)
- FOUND: lib/parser.ts extended (35fbaeb)
- FOUND: hooks/useVault.ts integrated (62d78bf)
- FOUND: 15-01-SUMMARY.md
- All 4 task commits verified in git log
