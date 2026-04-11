---
phase: 28-portail-c-blage-contributions
plan: "02"
subsystem: village
tags: [village, gamification, reward, irl-activities, loot-box, seasonal]
dependency_graph:
  requires: [lib/village/types.ts, lib/mascot/seasons.ts, lib/gamification/engine.ts, hooks/useGarden.ts, lib/parser.ts]
  provides: [lib/village/activities.ts, RewardCard dans village.tsx]
  affects: [app/(tabs)/village.tsx, lib/village/index.ts]
tech_stack:
  added: []
  patterns:
    - "addVillageBonus via parseGamification/serializeGamification (pattern identique useFarm.addCoins)"
    - "RewardCard avec useSharedValue + withTiming + runOnJS pour dismiss"
    - "FadeInDown.delay(150).duration(350) pour entrée carte"
    - "Hash déterministe weekStart pour activité IRL — même résultat tous profils"
key_files:
  created:
    - lib/village/activities.ts
  modified:
    - lib/village/index.ts
    - app/(tabs)/village.tsx
decisions:
  - "addVillageBonus utilise parseGamification/serializeGamification (pas parseFarmProfile) — gami-{id}.md est un fichier gamification, pas farm"
  - "colors.bg utilisé à la place de colors.background (token inexistant) pour le texte du bouton CTA"
  - "alreadyClaimed passé avec ?? false dans RewardCard pour éviter undefined (boolean|undefined)"
metrics:
  duration: "2m"
  completed_date: "2026-04-11"
  tasks_completed: 2
  files_changed: 3
---

# Phase 28 Plan 02: Récompense collective village + activités IRL — Summary

RewardCard inline dans village.tsx avec pickSeasonalActivity() déterministe, bonus +25 XP équitable pour tous les profils actifs via parseGamification/serializeGamification, et 1 loot box cosmetique (lootBoxesAvailable) per OBJ-03.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Liste activités IRL saisonnières + barrel export | d370da6 | lib/village/activities.ts, lib/village/index.ts |
| 2 | RewardCard + bonus XP collectif + loot box cosmetique | 5423fa6 | app/(tabs)/village.tsx |

## What Was Built

### lib/village/activities.ts (nouveau)

- `IRL_ACTIVITIES`: Record de 20 activités familiales curatées (5 par saison: printemps, été, automne, hiver)
- `pickSeasonalActivity(season, weekStart)`: sélection déterministe par hash sur weekStart — même activité pour tous les membres de la famille

### app/(tabs)/village.tsx (étendu)

- `addVillageBonus()`: helper hors-composant qui lit gami-{id}.md via parseGamification, ajoute +xpAmount points et +1 lootBoxesAvailable, réécrit via serializeGamification
- `RewardCard`: composant inline (< 100 lignes) avec FadeInDown entrée + withTiming dismiss 200ms, affiche l'activité IRL saisonnière, bouton CTA "Récupérer la récompense (+25 XP + 1 loot box)", état "Récompense réclamée" sans CTA
- `handleClaim` étendu: boucle sur tous les `activeProfiles` pour distribuer le bonus équitablement, appelle `refreshGamification()`, affiche toast de confirmation
- Memo `activity` calculé depuis `gardenData.currentWeekStart` + `season`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mauvaise fonction de parse pour gami-{id}.md**

- **Found during:** Task 2
- **Issue:** Le plan référençait `parseFarmProfile`/`serializeFarmProfile` pour les fichiers `gami-{id}.md`, mais ces fichiers utilisent le format gamification (sections `## Profil`), pas le format farm. La fonction `parseFarmProfile` est prévue pour `farm-{id}.md`.
- **Fix:** Utilisation de `parseGamification`/`serializeGamification` — pattern identique à `addCoins` dans `hooks/useFarm.ts` et à la gestion des loot boxes dans `lib/quest-engine.ts`
- **Files modified:** app/(tabs)/village.tsx
- **Commit:** 5423fa6

**2. [Rule 1 - Bug] Token de couleur inexistant colors.background**

- **Found during:** Task 2
- **Issue:** Le plan utilisait `colors.background` pour le texte du bouton CTA, mais ce token n'existe pas dans AppColors. Le token correct est `colors.bg`.
- **Fix:** Remplacement par `colors.bg` — fonctionne sur thème clair (blanc) et sombre (fond sombre) avec `colors.success` comme fond bouton
- **Files modified:** app/(tabs)/village.tsx
- **Commit:** 5423fa6

## Success Criteria Verification

- La carte de récompense apparaît quand `isGoalReached` est true: OUI (RewardCard rendue dans `{isGoalReached && <RewardCard .../>}`)
- L'activité IRL change chaque semaine et correspond à la saison: OUI (hash déterministe sur weekStart)
- Le bonus XP (+25) est appliqué à TOUS les profils actifs: OUI (`for (const p of activeProfiles)`)
- 1 loot box bonus attribuée à TOUS les profils actifs (OBJ-03): OUI (`lootBoxesAvailable: (gamiProfile.lootBoxesAvailable ?? 0) + 1`)
- Aucune couleur hardcodée — tout via useThemeColors(): OUI (colors.bg, colors.success, colors.card, etc.)
- La carte se dismiss avec animation fade 200ms: OUI (`withTiming(0, { duration: 200 })`)
- Aucune régression TypeScript: OUI (`npx tsc --noEmit` — zéro erreur)

## Known Stubs

Aucun stub bloquant. La carte de récompense est fonctionnelle et connectée aux données réelles.

## Self-Check: PASSED
