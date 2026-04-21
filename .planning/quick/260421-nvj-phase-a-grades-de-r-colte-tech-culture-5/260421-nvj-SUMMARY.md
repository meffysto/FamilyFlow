---
phase: 260421-nvj-phase-a-grades-de-recolte
plan: 01
subsystem: ferme-mascotte
tags: [ferme, tech, grades, harvest, gamification, i18n, jest]
requires: [tech-engine, farm-engine, useFarm, HarvestCardToast, ToastContext]
provides:
  - grade-engine (module pur HarvestGrade + rollHarvestGrade + helpers)
  - tech culture-5 "Agriculture de précision" (10 000 🍃, requires culture-4)
  - harvest() retourne grade + gradeBonusCoins (undefined/0 sans tech)
  - badge grade dans HarvestCardToast
  - clés i18n tech.culture-5 + farm.grade.*
affects: [useFarm.harvest, HarvestCardToast, ToastContext.showHarvestCard, TechTreeSheet (render auto), tree.tsx handleCropCellPress]
tech-stack:
  added: []
  patterns: [module-pur-RNG-injectable, compat-ascendante-flag-tech, delta-bonus-additif, TDD-RED-GREEN]
key-files:
  created:
    - lib/mascot/grade-engine.ts
    - lib/__tests__/grade-engine.test.ts
    - .planning/quick/260421-nvj-phase-a-grades-de-r-colte-tech-culture-5/260421-nvj-SUMMARY.md
  modified:
    - lib/mascot/tech-engine.ts
    - hooks/useFarm.ts
    - components/gamification/HarvestCardToast.tsx
    - contexts/ToastContext.tsx
    - app/(tabs)/tree.tsx
    - locales/fr/common.json
    - locales/en/common.json
decisions:
  - "Grade culture-5 consommé directement dans useFarm via unlockedTechs.includes('culture-5'), pas agrégé dans TechBonuses — c'est un effet probabiliste per-roll, pas un multiplicateur global"
  - "gradeBonusCoins = Math.round(harvestReward × finalQty × (multiplier − 1)) — delta pur (additif au scénario de vente normale), pas un total"
  - "addCoins appelé APRÈS writeProfileFields (golden + standard), pattern identique à l'existant — pas de race (fichier gami-{id}.md séparé)"
  - "RNG injectable (Math.random par défaut) pour tests déterministes aux bornes de seuils"
  - "Haptics.notificationAsync(Success) déclenché uniquement sur grade='parfait' (2%) — récompense tactile rare"
  - "Seuils cumulatifs (borne haute exclusive) via GRADE_THRESHOLDS ordonné — fallback rng=1.0 → 'parfait'"
metrics:
  duration: "15min"
  completed: "2026-04-21"
  tasks: 2
  files_modified: 7
  files_created: 2
  tests_added: 20
  tests_passing: 20
---

# Phase A Grade Récolte 260421-nvj : Tech culture-5 + moteur grades Summary

Moteur pur de grades de récolte (Ordinaire 70% / Beau 20% / Superbe 8% / Parfait 2% — multiplicateurs ×1/×1.5/×2.5/×4) activé par la tech culture-5 « Agriculture de précision » (10 000 🍃), avec bonus coins immédiats additifs et compat ascendante stricte.

## Context

Phase A d'un système de grades de récolte. Objectif : introduire une première boucle de « pari bienveillant » — plus le joueur récolte, plus il a de chances occasionnelles d'encaisser des coins bonus, sans jamais de pénalité. Phase B (ultérieure) portera l'inventaire par grade + craft + marché.

Pattern retenu : zéro changement de comportement par défaut. Le roll de grade n'est déclenché que si `profile.farmTech` contient `'culture-5'`. Sans la tech, `harvest()` retourne `grade: undefined` et `gradeBonusCoins: 0`, aucun `addCoins` bonus n'est appelé.

## What Was Built

### Task 1 — Moteur pur grade-engine + tech culture-5 (TDD)

- **`lib/mascot/grade-engine.ts`** : type `HarvestGrade = 'ordinaire' | 'beau' | 'superbe' | 'parfait'`, constantes `GRADE_THRESHOLDS` (cumulatif, borne haute exclusive) + `GRADE_MULTIPLIERS` + `GRADE_EMOJIS`, fonction `rollHarvestGrade(rng = Math.random)` avec RNG injectable, helpers `getGradeMultiplier / getGradeLabelKey / getGradeEmoji`.
- **`lib/mascot/tech-engine.ts`** : noeud `culture-5` ajouté à `TECH_TREE` (branch='culture', order=5, cost=10000, requires='culture-4', emoji='🔬'). Aucune modif de `getTechBonuses` (effet probabiliste per-roll, pas bonus agrégé).
- **`lib/__tests__/grade-engine.test.ts`** : 20 tests — 9 bornes RNG déterministes (0.00/0.69/0.70/0.89/0.90/0.97/0.98/0.999/1.0), 1 distribution 10 000 rolls (tolérance ±2%), 5 multiplicateurs/table, 2 i18n keys + emojis, 2 invariants seuils, 1 vérification noeud `culture-5`.
- Flow **RED** (tests sans module → compilation fail) puis **GREEN** (module créé, 20/20 tests passent) respecté.

### Task 2 — Branchement harvest + toast enrichi + i18n

- **`hooks/useFarm.ts`** :
  - Import `rollHarvestGrade / getGradeMultiplier / HarvestGrade`.
  - Signature `harvest()` étendue avec `grade?: HarvestGrade` + `gradeBonusCoins?: number`.
  - Après calcul `finalQty` (post-golden / post-wager) : bloc de roll conditionnel à `profile.farmTech?.includes('culture-5')`. `gradeBonusCoins = Math.round(harvestReward × finalQty × (mult − 1))`.
  - `addCoins(profileId, gradeBonusCoins, '✨ Récolte grade {grade} ×{mult}')` appelé **après** `writeProfileFields` sur les deux chemins (golden + standard). Cohérent avec pattern existant (`addCoins` dans `sellHarvest`).
  - Les deux `return` propagent `grade, gradeBonusCoins`.
- **`components/gamification/HarvestCardToast.tsx`** :
  - `HarvestItem.grade?: { key: string; bonusCoins: number; emoji: string }`.
  - Import `useTranslation` (react-i18next).
  - Badge `gradeBadge` rendu dans `ItemChip` si `item.grade && item.grade.key !== 'ordinaire'` : `{emoji} {t(farm.grade.*)} +{bonusCoins} 🍃`. Tokens Spacing/Radius/FontSize, couleur `#FFE27A` (cohérent avec badge wager existant).
- **`contexts/ToastContext.tsx`** : merge étendu `grade: item.grade ?? i.grade` (même pattern que `wager`).
- **`app/(tabs)/tree.tsx`** :
  - Import `getGradeEmoji`.
  - `showHarvestCard` reçoit `grade` conditionnel (uniquement si > ordinaire).
  - `Haptics.notificationAsync(Success)` déclenché sur `grade === 'parfait'` (2%, récompense tactile rare).
- **`locales/fr/common.json`** + **`locales/en/common.json`** :
  - `tech.culture-5` + `tech.culture-5_desc` (FR : « Agriculture de précision » / EN : « Precision Farming ») avec stats complètes (20% ×1.5 / 8% ×2.5 / 2% ×4).
  - Objet `farm.grade` : ordinaire=Ordinaire/Common, beau=Beau/Fine, superbe=Superbe/Superb, parfait=Parfait/Perfect.

## Architecture Decisions

- **Delta vs total** : `gradeBonusCoins` est le *delta* (additif) par rapport au flux normal. Le joueur reçoit toujours sa récolte dans `harvestInventory` (potentiellement vendable via `sellHarvest`) ; les coins bonus grade viennent EN PLUS au moment de la récolte. Pas d'inventaire par grade (réservé Phase B).
- **Injection RNG** : `rollHarvestGrade(rng = Math.random)` permet tests déterministes sans mocker globalement `Math.random` (plus propre, évite pollution inter-tests).
- **Tech consommée in-place** : décidé de ne PAS ajouter `culture-5` à `getTechBonuses()` car c'est un effet per-roll, pas un multiplicateur global (comme `bonusHarvestChance` qui reste uniforme). Le gate est explicite dans `useFarm.harvest`.
- **TechTreeSheet non modifié** : render auto depuis `TECH_TREE` — vérifié via Grep qu'aucun filtre `order <= 4` ni cast hardcodé n'existe.
- **Compat ascendante stricte** : validée par une double lecture — sans `culture-5`, `hasGradeTech === false`, bloc roll skippé, retour `grade: undefined, gradeBonusCoins: 0`, aucun `addCoins` appelé, aucun badge toast rendu (`item.grade && key !== 'ordinaire'` = false).

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit. Une micro-amélioration : gain de propreté en ajoutant une garde `gradeMultiplier > 1` pour éviter de calculer `harvestReward * 0` pour grade ordinaire (pure optimisation, comportement identique).

## Testing

- `npx jest lib/__tests__/grade-engine.test.ts --no-coverage` → **20/20 passent** (~1.5s).
- `npx tsc --noEmit` → **zéro erreur nouvelle**.
- Distribution 10 000 rolls : vérifiée dans les tolérances ±2% (test passe de manière reproductible).

## Commits

- `9ce44c5` — test(260421-nvj): ajouter tests failing grade-engine (RED)
- `9fd0e63` — feat(260421-nvj): moteur grade-engine + noeud tech culture-5 (GREEN)
- `2e872b6` — feat(260421-nvj): branchement harvest grade + toast enrichi + i18n FR/EN

## Phase B — Points d'attention

- **Inventaire par grade** : ajouter `harvestInventoryByGrade: Record<cropId, Record<HarvestGrade, number>>` dans `FarmProfileData`, bump `CACHE_VERSION`. Aujourd'hui `harvestInventory` est à plat (sans grade) — compat assurée par le fait que Phase A ne stocke PAS de grade (coins immédiats).
- **Craft/marché par grade** : nouvelles recettes gatées par grade minimum (ex: « Ratatouille premium » requiert tomates grade≥beau). Prévoir UI sélecteur.
- **Toast merge** : actuellement `grade` merge comme `wager` (le dernier gagne). Pour Phase B (inventaire par grade), envisager un merge par grade-key distinct (ex: accumuler 3 badges grade différents dans le même chip).
- **Haptics parfait** : à généraliser (vibration renforcée sur grade rare) avec mise en cohérence via une constante partagée si Phase B introduit d'autres events rares.

## Self-Check: PASSED

- lib/mascot/grade-engine.ts — **FOUND**
- lib/__tests__/grade-engine.test.ts — **FOUND**
- lib/mascot/tech-engine.ts (culture-5 présent) — **FOUND**
- hooks/useFarm.ts (harvest étendu) — **FOUND**
- components/gamification/HarvestCardToast.tsx (HarvestItem.grade) — **FOUND**
- contexts/ToastContext.tsx (merge grade) — **FOUND**
- app/(tabs)/tree.tsx (showHarvestCard.grade) — **FOUND**
- locales/fr/common.json (tech.culture-5 + farm.grade) — **FOUND**
- locales/en/common.json (tech.culture-5 + farm.grade) — **FOUND**
- Commit 9ce44c5 — **FOUND**
- Commit 9fd0e63 — **FOUND**
- Commit 2e872b6 — **FOUND**
