---
phase: 38-fondation-modifiers-conomie-spor-e
plan: 03
subsystem: farm/sporee-economy
tags: [sporee, economy, farm, wiring, phase-38]
requires:
  - 38-01 (types + parser pour Plan 38-03 parser farm)
  - 38-02 (moteur pur sporee-economy pour drops + cadeau)
provides:
  - Économie Sporée câblée end-to-end dans le vault (4 champs persistés, 3 drops opérationnels)
  - Prêt pour consommation UI Phase 40 (shop + slot Sceller + badge validation)
affects:
  - lib/types.ts (+4 champs FarmProfileData)
  - lib/parser.ts (parse/serialize 4 clés sporee_*)
  - hooks/useFarm.ts (drop récolte 3%/8%/15%)
  - hooks/useExpeditions.ts (drop expedition 5%)
  - hooks/useGamification.ts (cadeau onboarding arbuste→arbre)
tech-stack:
  added: []
  patterns:
    - Mutation in-place de farmData + unique writeFile (évite double I/O)
    - Toast français français 'Inventaire Sporée plein' sur overflow
    - Flag sporeeOnboardingGiftClaimed gaté par succès increment (pas de marquage silencieux)
key-files:
  created:
    - lib/__tests__/farm-parser.test.ts
  modified:
    - lib/types.ts
    - lib/parser.ts
    - hooks/useFarm.ts
    - hooks/useExpeditions.ts
    - hooks/useGamification.ts
decisions:
  - Flag sporeeOnboardingGiftClaimed reste false si inventaire plein au moment du cadeau — re-tentable au prochain level-up (Open Q1)
  - Roll Sporée expedition indépendant de l'outcome (mission ratée peut drop) — loot séparé (Open Q2)
  - applyFarmField étendu case 'sporee_count' pour support writeProfileFields standard
  - Mutation farmData in-place dans useGamification (pas de re-read) — évite race condition et double I/O
metrics:
  duration: 15min
  completed: 2026-04-18
requirements: [SPOR-08, SPOR-09]
---

# Phase 38 Plan 03: Câblage drops + cadeau Sporée dans hooks Summary

Câblage complet de l'économie Sporée (Plan 38-02 moteur pur) dans les hooks vault : parseFarmProfile/serializeFarmProfile étendus avec 4 champs `sporee_*`, drops opérationnels dans useFarm.harvest (3%/8%/15%), useExpeditions.collectExpedition (5% Pousse+), et cadeau onboarding arbuste→arbre dans useGamification.completeTask. Toast français sur overflow dans les 3 sites.

## Tâches exécutées

### Tâche 1 : Extension FarmProfileData + parseFarmProfile/serializeFarmProfile + tests

**Fichiers modifiés :**
- `lib/types.ts` lignes 645-650 : 4 champs ajoutés (`sporeeCount`, `sporeeShopBoughtToday`, `sporeeShopLastResetDate`, `sporeeOnboardingGiftClaimed`)
- `lib/parser.ts` :
  - parseFarmProfile étendu lignes 691-695 (4 clés `sporee_*`)
  - serializeFarmProfile étendu lignes 753-766 (écriture conditionnelle : `> 0` pour count/boughtToday, truthy pour date, `=== true` pour gift claimed)

**Fichier créé :**
- `lib/__tests__/farm-parser.test.ts` — 10 tests (legacy parse, 4 parse cas, 4 serialize cas, round-trip deep-equal)

**Résultat :** 10/10 tests passent, zéro régression TS.

**Commit :** `e0e9016`

### Tâche 2 : Drop Sporée post-récolte dans useFarm.harvest

**Fichier modifié :** `hooks/useFarm.ts`

- Imports ajoutés ligne 12-13 : `classifyHarvestTier`, `rollSporeeDropOnHarvest`, `tryIncrementSporeeCount`, `useToast`
- Hook `useToast` appelé ligne 157
- `applyFarmField` étendu case `'sporee_count'` ligne 149-153 (pour support writeProfileFields)
- Bloc Sporée inséré lignes 330-343 (après rollSeedDrop, avant branche wasGoldenEffect) : classifyHarvestTier → rollSporeeDropOnHarvest → tryIncrementSporeeCount
- Branche wasGoldenEffect (lignes 350-367) : spread `sporeeCount` + toast overflow post-refreshFarm
- Branche standard (lignes 380-390) : `fieldsToWrite.sporee_count` conditionnel + toast overflow post-refreshFarm
- Deps useCallback mise à jour : `showToast` ajouté

**Commit :** `143c033`

### Tâche 3 : Drop expedition + cadeau onboarding

**Fichier modifié :** `hooks/useExpeditions.ts`

- Imports ajoutés ligne 31-32 : `rollSporeeDropOnExpedition`, `tryIncrementSporeeCount`, `useToast`
- Hook `useToast` appelé ligne 47
- Bloc Sporée inséré lignes 246-258 (après `rollExpeditionLoot`) — roule indépendamment de l'outcome
- Toast overflow lignes 298-300 après refreshFarm
- `farm.sporeeCount` persisté via `serializeFarmProfile` existant (pas de nouveau writeFile)

**Fichier modifié :** `hooks/useGamification.ts`

- Imports ajoutés ligne 24-26 : `detectEvolution`, `shouldGiftOnboardingSporee`, `tryIncrementSporeeCount`, `useToast`
- Hook `useToast` appelé ligne 95
- Bloc cadeau onboarding inséré lignes 313-336 (avant `await vault.writeFile(fp, ...)` ligne 337) :
  - `detectEvolution(profile.level, updatedProfile.level)` détecte la transition
  - `shouldGiftOnboardingSporee` gate (arbuste→arbre + pas déjà claimed)
  - `tryIncrementSporeeCount` sur farmData déjà en mémoire
  - Si succès : `farmData.sporeeCount` + `farmData.sporeeOnboardingGiftClaimed = true`
  - Si overflow : toast + flag reste `undefined` (re-tentable)
- Deps useCallback mise à jour : `showToast` ajouté
- **Décision clé :** mutation in-place de `farmData` (déjà source of truth lue en ligne 191) évite re-read + double writeFile — économie I/O + pas de race condition

**Commit :** `14d9fdf`

## Résolution des Open Questions (38-RESEARCH)

### Open Q1 : Comportement si inventaire Sporée plein au moment du cadeau ?

**Résolution :** Le flag `sporeeOnboardingGiftClaimed` reste `undefined` (= false), un toast 'Inventaire Sporée plein' s'affiche, et le cadeau sera re-tenté au prochain level-up causant une transition de stade (rare dans la pratique, mais conforme à "zéro perte silencieuse"). Implémenté dans `useGamification.ts` lignes 324-330.

### Open Q2 : Drop Sporée expedition lié ou non à l'outcome ?

**Résolution :** Indépendant de l'outcome — le roll `rollSporeeDropOnExpedition(exp.difficulty)` s'exécute même sur `failure` ou `partial`. La Sporée est un loot séparé (pas une récompense de mission). Implémenté dans `useExpeditions.ts` lignes 246-258.

### Open Q4 : getLocalDateKey LOCAL vs toISOString UTC ?

**Résolution :** Géré côté moteur pur (`getLocalDateKey` dans `sporee-economy.ts`) — Plan 38-03 ne touche pas au reset daily shop (consommé en Phase 40). Le helper est prêt et testé en Plan 38-02.

## Vérifications

- **TS :** `npx tsc --noEmit` — clean (hors pré-existantes MemoryEditor/cooklang/useVault.ts)
- **Jest farm-parser :** 10/10 passent
- **Jest suite complète :** 1390 pass / 145 fail — les 145 échecs sont **pré-existants baseline** (vérifié via `git stash` + re-run : mêmes 4 fichiers `companion-engine/lovenotes-selectors/world-grid/codex-content` échouent sans aucun des changements Phase 38-03). Aucune régression introduite.

## Critères de succès

- [x] 4 champs `sporee_*` persistés et round-trip dans `farm-{profileId}.md`
- [x] Récolte : 3% base / 8% rare / 15% expedition déclenchent increment inventaire Sporée
- [x] Expedition Pousse+ : 5% drop indépendamment de l'outcome
- [x] Transition arbuste→arbre : +1 Sporée si pas déjà claimed, flag passe true après succès uniquement
- [x] Toast français "Inventaire Sporée plein" sur overflow dans les 3 sites
- [x] Aucune régression TS/Jest

## État global Phase 38

**Économie Sporée opérationnelle côté data/hooks :**
- Plan 01 : pipe-escape JSON FarmCrop.modifiers + bump CACHE_VERSION + tests
- Plan 02 : moteur pur sporee-economy (44 tests, 100% pure)
- Plan 03 : câblage hooks useFarm/useExpeditions/useGamification

**Prêt pour Phase 40 (consommation UI) :**
- `canBuySporee` engine prêt — Phase 40 câblera shop UI
- 4 champs vault stables → UI peut lire `sporeeCount` pour badge, `sporeeShopBoughtToday` pour cap jour
- Slot "Sceller" sur plantation pourra consommer Sporée via `tryIncrementSporeeCount(count, -1)` (à adapter)

## Deviations from Plan

**Auto-fix Rule 3 :** Le plan indiquait d'ajouter `sporee_count` dans `fieldsToWrite` via `writeProfileFields` — mais `applyFarmField` est un switch fermé sur les fieldKeys connus. J'ai ajouté un `case 'sporee_count'` explicite (lignes 149-153 `useFarm.ts`) pour éviter un silent drop. Alternative à la double-branche `serializeFarmProfile` du plan, plus propre et cohérent avec le pattern existant.

**Optimisation I/O :** Plan proposait de re-read farm file dans useGamification pour éviter race condition. Observé : `farmData` est déjà lu ligne 191 et est la source of truth pour le `writeFile` final ligne 338. Mutation in-place évite un read supplémentaire ET garantit l'atomicité (unique write = unique source). Zéro race car le handler est séquentiel await.

## Self-Check: PASSED

**Files verified:**
- FOUND: lib/types.ts (4 champs sporee_*)
- FOUND: lib/parser.ts (parse + serialize sporee_*)
- FOUND: hooks/useFarm.ts (imports + bloc drop + toast)
- FOUND: hooks/useExpeditions.ts (imports + bloc drop + toast)
- FOUND: hooks/useGamification.ts (imports + bloc cadeau + toast)
- FOUND: lib/__tests__/farm-parser.test.ts

**Commits verified:**
- FOUND: e0e9016 (Task 1 types + parser + tests)
- FOUND: 143c033 (Task 2 useFarm)
- FOUND: 14d9fdf (Task 3 useExpeditions + useGamification)
