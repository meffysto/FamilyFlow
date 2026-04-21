---
phase: 260421-qy5-picker-grade-interactif
plan: 01
subsystem: craft-ui
tags: [craft, grades, ui, reanimated, i18n]
dependency-graph:
  requires:
    - 260421-obd (Phase B — craftItemWithSelection, getDefaultGradeSelection, canCraftAtGrade, getCraftOutputGrade déjà livrés + testés)
  provides:
    - Picker de grade interactif dans CraftSheet (UI Phase B)
    - onCraft signature étendue `(recipeId, qty?, selection?)` → useFarm.craft 4e param optionnel
  affects:
    - components/mascot/CraftSheet.tsx
    - hooks/useFarm.ts
    - app/(tabs)/tree.tsx
tech-stack:
  added: []
  patterns:
    - Composant contrôlé parent-owned state (selection vit dans CraftSheet, picker expose selection + onSelectionChange)
    - Détection inventaire multi-grade équivalente à "tech culture-5 débloquée" (zero nouveau prop)
    - Fallback strict côté useFarm : selection undefined → craftItemFn legacy (cascade auto maillon-faible)
key-files:
  created:
    - components/mascot/CraftGradePicker.tsx (~230 lignes)
  modified:
    - components/mascot/CraftSheet.tsx (+~55 lignes)
    - hooks/useFarm.ts (signature craft + branche)
    - app/(tabs)/tree.tsx (propagation 3e arg)
    - locales/fr/common.json (+4 clés)
    - locales/en/common.json (+4 clés)
decisions:
  - Extraction dans sous-composant dédié (CraftSheet déjà 1638 lignes — boundary propre)
  - Composant contrôlé (state vit dans parent) pour survivre expand/collapse sans perte user choice
  - Masquage via détection inventaire multi-grade (≥2 grades possédés sur ≥1 ingrédient crop) — équivalent fonctionnel à tech culture-5 débloquée, zero nouveau prop
  - Fallback strict useFarm : selection undefined → craftItemFn legacy → comportement strictement identique à avant
  - Merge partiel au changement de grade `{...selection, [itemId]: grade}` (pas de rescramble des autres ingrédients)
  - `useThemeColors().primary` (top-level, pas colors.primary qui n'existe pas)
metrics:
  duration: ~15min
  completed: 2026-04-21
---

# Quick 260421-qy5 : Picker de grade interactif dans CraftSheet Summary

Picker de grade UI branché sur les helpers Phase B : l'utilisateur choisit explicitement le grade consommé par ingrédient crop, preview live du grade output (maillon faible) + valeur de vente ×multiplier.

## Ce qui a été livré

### Task 1 — CraftGradePicker.tsx + i18n
Nouveau sous-composant `components/mascot/CraftGradePicker.tsx` (~230 lignes), contrôlé, avec :
- Bouton compact affichant le grade output résumé (`🎯 {emoji} {label} ▾`)
- Expand inline (SlideInDown / SlideOutUp) listant les grades possédés par ingrédient crop avec qty + grisage si qty insuffisante pour `quantity × craftQty`
- Animations reanimated uniquement : `FadeIn.duration(200)`, `SlideInDown/SlideOutUp`, `withSpring` sur rotation chevron
- `shouldShow` : masqué tant qu'aucun ingrédient n'a ≥2 grades possédés (équivalent fonctionnel à "tech culture-5 non débloquée")
- Feedback haptique `Haptics.selectionAsync()` au toggle et au select
- Styles via `useThemeColors().primary` + tokens `Farm.*` / `Spacing` / `Radius` / `FontSize` / `FontWeight`

i18n ajoutés dans `craft.*` (FR+EN mirror) :
- `pickGrade` ("Choisir le grade" / "Choose grade")
- `ingredientGrades` ("Grades par ingrédient" / "Grades per ingredient")
- `gradesGrisesHint` ("Grades grisés = quantité insuffisante" / "Greyed grades = insufficient quantity")
- `grade` ("Grade" / "Grade")

### Task 2 — Intégration CraftSheet + useFarm + tree.tsx
- `CraftSheet.tsx` : import `CraftGradePicker`, state `gradeSelection: Record<string, HarvestGrade>` initialisé via `getDefaultGradeSelection(harvestInventory, recipe, 1)` au tap recette, picker + preview 2 lignes ("Qualité obtenue" + "Valeur de vente") injectés juste après `catModalIngList` et avant `craftActionRow`
- `handleCraft` et `CraftSheetProps.onCraft` signatures étendues avec `selection?: Record<string, HarvestGrade>`
- Bouton Crafter : passe `gradeSelection` (ou `undefined` si vide) à `handleCraft`, reset au submit/close/overlay/bouton fermer
- `hooks/useFarm.ts:craft()` : 4e paramètre optionnel `selection?`, branche `craftItemWithSelectionFn` si fourni sinon fallback `craftItemFn` legacy (cascade auto maillon-faible)
- `app/(tabs)/tree.tsx` : onCraft propage le 3e argument `selection` vers `craft(profile!.id, recipeId, qty, selection)`

## Décisions techniques
- **Composant contrôlé** : state `gradeSelection` vit dans CraftSheet parent, picker expose `selection` + `onSelectionChange` — évite perte de choix user au toggle expand/collapse, et permet de recalculer le preview dans le parent via `getCraftOutputGrade(gradeSelection)` à chaque render.
- **Masquage sans nouveau prop** : au lieu d'injecter `unlockedTechs` jusqu'au picker, on détecte `≥2 grades possédés sur ≥1 ingrédient crop`. Équivalent fonctionnel (les grades non-ordinaire n'apparaissent que via tech culture-5), zero coupling.
- **Fallback strict useFarm** : si CraftSheet n'envoie pas de selection (ex. recette full building sans ingrédient crop → gradeSelection reste `{}` → undefined), `craft()` utilise `craftItemFn` legacy — zéro régression, comportement identique à avant la Phase B UI.
- **Merge partiel au changement** : changement d'un grade = `{...selection, [itemId]: grade}`, les autres ingrédients ne bougent pas → pas de rescramble après interaction user. Le preview (grade output + valeur vente) recalcule automatiquement via l'IIFE qui lit `gradeSelection` à chaque render.
- **`useThemeColors().primary`** (top-level du hook), pas `colors.primary` (n'existe pas sur AppColors). Découvert au 1er tsc après création du picker, fix 2 lignes.

## Fichiers créés / modifiés
- **Créés :** `components/mascot/CraftGradePicker.tsx`
- **Modifiés :** `components/mascot/CraftSheet.tsx`, `hooks/useFarm.ts`, `app/(tabs)/tree.tsx`, `locales/fr/common.json`, `locales/en/common.json`
- **Non modifiés (lecture seule) :** `lib/mascot/grade-engine.ts`, `lib/mascot/craft-engine.ts`, `hooks/useGarden.ts`, `lib/mascot/market-engine.ts`, `lib/mascot/farm-engine.ts` — zéro risque de régression moteur

## Commits
- `b5b34b7` : feat(260421-qy5): créer CraftGradePicker sous-composant + clés i18n FR/EN
- `aa347ae` : feat(260421-qy5): intégrer CraftGradePicker dans CraftSheet + étendre signature craft

## Validation
- `npx tsc --noEmit` : **clean** (0 erreur nouvelle)
- `npx jest --no-coverage` : 1779/1780 tests passent ; 1 fail pré-existant (`codex-content.test.ts` — `tech_culture-5 nameKey/loreKey`) confirmé indépendant (reproduit en stash), **hors scope CLAUDE.md**

## Déviations du plan
Aucune. Plan exécuté conformément à la spec, avec un seul ajustement trivial :
- `useThemeColors().colors.primary` → `useThemeColors().primary` (la prop `primary` est au top-level de `ThemeColors`, pas dans `colors`). Fix rule 1 (bug à l'écriture).

## Points d'attention futurs
- Bouton "Reset to default" (re-appliquer `getDefaultGradeSelection` après un override user) — UX polish optionnel
- Garde `canCraftAtGrade(harvestInv, recipe, gradeSelection, farmInv, clampedQty).canCraft` sur le bouton Crafter — protection anti-erreur si user sélectionne une combo impossible (actuellement throw "Ingredients insuffisants" s'affiche via catch, UX acceptable pour 1er jet)
- CraftSheet.tsx reste gros (~1700 lignes) — candidat d'extraction de la mini-modal détail recette dans son propre fichier lors d'un prochain passage

## Self-Check: PASSED
- `components/mascot/CraftGradePicker.tsx` : FOUND
- `components/mascot/CraftSheet.tsx` : FOUND (modifié)
- `hooks/useFarm.ts` : FOUND (modifié)
- `app/(tabs)/tree.tsx` : FOUND (modifié)
- `locales/fr/common.json` : FOUND (4 clés ajoutées)
- `locales/en/common.json` : FOUND (4 clés ajoutées)
- Commit `b5b34b7` : FOUND
- Commit `aa347ae` : FOUND
