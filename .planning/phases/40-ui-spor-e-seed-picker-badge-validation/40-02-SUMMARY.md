---
phase: 40-ui-spor-e-seed-picker-badge-validation
plan: 02
subsystem: ui-sealer-sheet
tags: [sporee, wager, modal, pageSheet, seed-picker, tree]
requires:
  - lib/mascot/wager-ui-helpers (Plan 40-01)
  - lib/mascot/wager-engine.canSealWager (Phase 39)
  - lib/mascot/wager-engine.computeCumulTarget (Phase 39)
  - lib/mascot/wager-engine.filterTasksForWager (Phase 39)
  - lib/mascot/sporee-economy.getLocalDateKey (Phase 38)
  - hooks/useFarm.startWager (Plan 40-01)
provides:
  - components/mascot/WagerSealerSheet (pageSheet 3 durées + skip + preview prorata)
  - handleSeedSelect étendu (gate sporeeCount + canSealWager)
  - handleWagerSealConfirm / handleWagerSealSkip / handleWagerSealerClose handlers
affects:
  - app/(tabs)/tree.tsx (imports + 2 state hooks + gate handleSeedSelect + rendu sealer)
  - lib/types.ts (Profile.sporeeCount? — déclaration type pour merge runtime existant)
tech-stack:
  added: []
  patterns:
    - "Stacking pageSheets iOS via setTimeout(300ms) entre close et present"
    - "Modal onRequestClose → skip handler (zéro plant fantôme P1)"
    - "Haptics.impactAsync Medium au confirm, selectionAsync au skip"
    - "computeWagerDurations avec callback inline (pas d'import wager-engine dans helpers)"
key-files:
  created:
    - components/mascot/WagerSealerSheet.tsx
  modified:
    - app/(tabs)/tree.tsx
    - lib/types.ts
decisions:
  - "Skip = fallback universel : close header (ModalHeader) et onRequestClose Modal invoquent tous deux handleHeaderClose → onConfirmSkip. Garde-fou useEffect non-nécessaire car le composant garantit lui-même zéro dismiss orphelin."
  - "Profile.sporeeCount? déclaré dans lib/types.ts (Rule 3) : le champ est mergé runtime via spread farmData ligne 855 useVault.ts, mais manquait au type. Précédent farmRareSeeds / growthSprintUntil / wearEvents."
  - "Pas de mutation du seed picker Modal existant : toute la logique Phase 40 vit dans handleSeedSelect et le nouveau pageSheet, zéro refonte UI du picker."
  - "computeWagerDurations nourri via callback fermant sur ctx local (pas passage ctx direct) — évite redéfinir TCtx dans le composant."
metrics:
  duration_min: ~7
  completed_date: 2026-04-18
  task_count: 2
  file_count: 3
---

# Phase 40 Plan 02 : UI Sealer Sheet — pageSheet 3 durées + skip Summary

Livre le flow UX décisionnel au cœur de la mécanique Sporée : après choix de graine avec ≥1 Sporée au stock et profil autorisé (poids > 0), un pageSheet secondaire propose 3 durées (Chill ×1.3 / Engagé ×1.7 / Sprint ×2.5) avec preview prorata (multiplier × durée absolue × cadence requise × cumul cible), plus une option « Pas cette fois ». Trois paths de sortie garantissent zéro parcelle orpheline (P1).

## Pattern stacking pageSheets iOS — finalisé

Le seed picker (Modal pageSheet) doit se fermer **avant** que le WagerSealerSheet puisse s'ouvrir, sinon iOS refuse la présentation du second sheet (gotcha G1). Résolution :

```tsx
setShowSeedPicker(false);
setTimeout(() => setShowWagerSealer(true), 300);  // delay anti-collision
```

300ms est le minimum testé qui évite le refus silencieux iOS (vs 400ms déjà utilisé ailleurs dans tree.tsx pour d'autres stacks). `setSelectedPlotIndex(null)` reste appelé avant le return pour cohérence état, tandis que `pendingPlant` conserve la cible de plantation pour les handlers.

## Handlers tree.tsx exposés pour docs futures

### `handleSeedSelect` (étendu)

Flux post-Phase 40 :
1. Guard `profile`/`selectedPlotIndex` (inchangé)
2. Lecture `sporeeCount = profile.sporeeCount ?? 0`
3. Si `sporeeCount >= 1` : appel `canSealWager({ sealerProfileId, allProfiles, today: getLocalDateKey(now) })`
4. Si `check.ok === true` : `setPendingPlant({ plotIndex, cropId, tasksPerStage })`, fermer seed picker, `setTimeout(300)` pour présenter sealer, **return** (suspend plantation directe)
5. Sinon (0 Sporée OU canSealWager refuse) : plantation directe via `plant(profileId, plotIndex, cropId)` — comportement historique **strictement préservé**

### `handleWagerSealConfirm(duration)`

Appelé par `WagerSealerSheet.onConfirmSeal`. Consomme 1 Sporée + plante avec wager via `startWager`. Affiche toast succès `"🌱 🍄 Pari scellé !"`. En cas d'erreur : `Alert.alert('Erreur', msg)` — pas de silent fail car l'utilisateur a choisi activement de sceller.

### `handleWagerSealSkip()`

Appelé par `WagerSealerSheet.onConfirmSkip` **ET** par la fermeture header/dismiss (via `handleHeaderClose` interne au composant). Plantation normale via `plant(profileId, plotIndex, cropId)` — zéro Sporée consommée. Toast `"🌱 Planté"` standard.

### `handleWagerSealerClose()`

Simple `setShowWagerSealer(false)`. Le composant garantit déjà l'appel de `onConfirmSkip` via son close header, donc aucun garde-fou `useEffect` anti-plant-fantôme n'est nécessaire. Cette simplicité respecte le plan (« retenir la plus simple qui fonctionne »).

## Structure du composant WagerSealerSheet

- **Props strictes** : `visible`, `onClose`, `onConfirmSeal(duration)`, `onConfirmSkip`, `cropId`, `tasksPerStage`, `sealerProfileId`, `allProfiles`, `allTasks`, `sporeeCount`
- **useMemo** sur `durations` : stable tant que (`tasksPerStage`, `sealerProfileId`, `allProfiles`, `allTasks`) inchangés
- **3 Pressables** : un par option durée, layout empilé avec multiplier à droite et meta (durée · cadence · cumul) en ligne 2
- **1 Pressable skip** en bas, variant `cardAlt` (visuel secondaire)
- **ModalHeader** avec `closeLeft` → onClose → skip (P1)
- **Haptics** : Medium au confirm durée, Selection au skip
- **Tokens design stricts** : `Spacing` / `Radius` / `FontSize` / `FontWeight` / `useThemeColors()` — zéro hardcoded
- **Accessibilité** : `accessibilityRole="button"` + `accessibilityLabel` explicite FR par Pressable

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1 : Composant WagerSealerSheet pageSheet 3 options + skip | `138ddd6` | components/mascot/WagerSealerSheet.tsx |
| Task 2 : Câblage tree.tsx gate + handlers + rendu | `29e5855` | app/(tabs)/tree.tsx, lib/types.ts |

## Deviations from Plan

**1. [Rule 3 — Blocking] Ajout `sporeeCount?: number` dans `Profile` (lib/types.ts)**

- **Found during:** Task 2, TS check
- **Issue:** Le runtime merge `...farmDataByProfile[p.id]` (useVault.ts:855) injecte `sporeeCount` dans chaque Profile, mais le type `Profile` (lib/types.ts:70-122) ne le déclarait pas — les accès `profile.sporeeCount` échouaient au compile-time (TS2339).
- **Fix:** Ajouté `sporeeCount?: number` dans l'interface Profile, commentaire explicite « mergé depuis FarmProfileData via useVault runtime merge ». Précédent identique : `farmRareSeeds?`, `growthSprintUntil?`, `wearEvents?`.
- **Files modified:** lib/types.ts (ligne 102)
- **Commit:** 29e5855

**2. [Simplification — adaptation plan/réalité] Pas de useEffect garde-fou anti-plant-fantôme**

- **Found during:** Task 2, revue du plan §6
- **Issue:** Le plan proposait un `useEffect([showWagerSealer, pendingPlant])` comme alternative pour garantir zéro plant fantôme, ou faire le skip depuis ModalHeader close.
- **Fix:** Retenu la seconde option (plus simple) : `WagerSealerSheet` fait lui-même le dispatch `handleHeaderClose → onConfirmSkip` sur close header ET sur `Modal.onRequestClose`. Aucun useEffect ajouté dans tree.tsx — réduit surface bugs. Conforme à la directive « retenir la plus simple qui fonctionne ».
- **Files modified:** aucune divergence (implémentation attendue)

## Auth gates

Aucun — plan UI pur, zéro API externe.

## Known Stubs

Aucun stub. Le WagerSealerSheet est fonctionnel end-to-end : 3 paths de sortie (seal / skip / dismiss) tous connectés à des handlers persistants.

## Self-Check

Verification (files & commits exist) :
- FOUND: components/mascot/WagerSealerSheet.tsx
- FOUND: Commit 138ddd6
- FOUND: Commit 29e5855
- FOUND: WagerSealerSheet importé dans app/(tabs)/tree.tsx
- FOUND: sporeeCount? déclaré dans Profile lib/types.ts
- FOUND: npx tsc --noEmit clean (0 erreur)

## Self-Check: PASSED
