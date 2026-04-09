---
phase: 21-feedback-visuel-compagnon
plan: "02"
subsystem: semantic-feedback
tags: [toast, haptic, harvest-burst, companion, i18n, securestore-bridge]
dependency_graph:
  requires: [lib/semantic/effect-toasts.ts, lib/mascot/haptics.ts, components/mascot/HarvestBurst.tsx]
  provides: [hooks/useGamification.ts (feedback dispatch), app/(tabs)/tasks.tsx (HarvestBurst overlay), app/(tabs)/tree.tsx (subType bridge), lib/mascot/companion-engine.ts (SUB_TYPE_TEMPLATES)]
  affects: []
tech_stack:
  added: []
  patterns: [SecureStore bridge async pattern pour cross-screen state, SUB_TYPE_TEMPLATES dictionnaire separe pour extension CompanionEvent sans modification de type]
key_files:
  created: []
  modified:
    - hooks/useGamification.ts
    - app/(tabs)/tasks.tsx
    - app/(tabs)/tree.tsx
    - lib/mascot/companion-types.ts
    - lib/mascot/companion-engine.ts
    - locales/fr/common.json
    - locales/en/common.json
decisions:
  - "reward={1} dans HarvestBurst overlay (reward={0} affiche '+0 🍃' — non masque automatiquement)"
  - "SecureStore bridge async via promesse resolue avant delayTimer 1.5s dans useFocusEffect — pas besoin de convertir useCallback en async"
  - "SUB_TYPE_TEMPLATES dictionnaire separe de MESSAGE_TEMPLATES — preserve le type Record<CompanionEvent, string[]> sans elargissement"
  - "subType? string dans CompanionMessageContext (pas CategoryId) — evite couplage lib/mascot -> lib/semantic"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-04-09"
  tasks_completed: 2
  files_modified: 7
---

# Phase 21 Plan 02: Câblage feedback complet completeTask Summary

Câblage end-to-end du feedback sémantique : toast + haptic dispatch dans useGamification, HarvestBurst variant au centre-écran dans tasks.tsx, bridge SecureStore pour subType compagnon, SUB_TYPE_TEMPLATES dans companion-engine, et 20 clés i18n FR+EN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Dispatch toast+haptic+HarvestBurst overlay dans useGamification+tasks.tsx | 3c24d05 | hooks/useGamification.ts, app/(tabs)/tasks.tsx |
| 2 | Messages compagnon sub-type + clés i18n FR+EN + bridge subType tree.tsx | 482aa55 | lib/mascot/companion-types.ts, lib/mascot/companion-engine.ts, app/(tabs)/tree.tsx, locales/fr/common.json, locales/en/common.json |

## What Was Built

### hooks/useGamification.ts (étendu)

- Imports ajoutés : `EFFECT_TOASTS`, `CATEGORY_HAPTIC_FN`, `useToast`, `i18n`, `SecureStore`
- `const { showToast } = useToast()` dans le corps du hook
- `let derivedCategory: CategoryMatch | null = null` déclarée avant le bloc farm
- `derivedCategory = category` capturée après `deriveTaskCategory()` dans le bloc semantic coupling
- Bloc feedback Phase 21 après le catch semantic : dispatch `showToast` (FR/EN via `i18n.language`), `CATEGORY_HAPTIC_FN[catId]()` fire-and-forget, `SecureStore.setItemAsync('last_semantic_category', catId)` pour le bridge
- Return étendu avec `effectCategoryId: derivedCategory?.id ?? null`
- Type de retour `UseGamificationResult` mis à jour avec `effectCategoryId?: CategoryId | null`
- `showToast` ajouté dans le tableau de dépendances du `useCallback`

### app/(tabs)/tasks.tsx (étendu)

- Imports ajoutés : `Dimensions`, `HarvestBurst`, `CATEGORY_VARIANT`, `HarvestBurstVariant`
- State `effectBurst` : `{ variant: HarvestBurstVariant; key: number } | null`
- `completeTask` appelé avec `{ tags: task.tags, section: task.section, sourceFile: task.sourceFile }`
- `effectCategoryId` extrait du return de `completeTask`, déclenche `setEffectBurst({ variant, key: Date.now() })` si catégorie reconnue
- Overlay JSX `<HarvestBurst key={key} x={width/2} y={height/3} reward={1} variant={variant} onComplete={() => setEffectBurst(null)} />` avant `</SafeAreaView>`

### lib/mascot/companion-types.ts (étendu)

- `subType?: string` ajouté dans `CompanionMessageContext` (après `timeOfDay`)

### lib/mascot/companion-engine.ts (étendu)

- `SUB_TYPE_TEMPLATES: Record<string, string[]>` exporté avec 10 entrées `task_completed_*`
- `pickCompanionMessage` renommé `_context` → `context`, logique sub-type lookup avant fallback générique

### app/(tabs)/tree.tsx (étendu)

- Dans `useFocusEffect` : lecture async `SecureStore.getItemAsync('last_semantic_category')` via promesse capturée dans closure
- `context.subType = stored` injecté dans le contexte CompanionMessageContext
- `SecureStore.deleteItemAsync('last_semantic_category')` pour nettoyage immédiat
- `setTimeout` callback converti en `async` pour `await subTypePromise` avant affichage message

### locales/fr/common.json + locales/en/common.json (étendus)

- 20 clés `taskDone_*` ajoutées dans `companion.msg` (10 catégories × 2 templates)
- FR : accents corrects, messages contextuels liés aux effets ferme (mauvaises herbes, usure, turbo bâtiments, sprint croissance, graine rare, etc.)
- EN : parité stricte FEEDBACK-05, même structure et sémantique

## Verification

- `npx tsc --noEmit` : passe sans erreur
- `npx jest --no-coverage` : 4 suites échouent sur 50 (118 tests sur 1252) — **pré-existant depuis Plan 01** (expo-haptics non mocké dans lib/semantic/index.ts qui importe effect-toasts.ts). Nos changements n'ajoutent pas de nouveaux échecs.
- FEEDBACK-01 : toast spécifique via EFFECT_TOASTS[catId] + showToast — câblé
- FEEDBACK-02 : haptic distinct via CATEGORY_HAPTIC_FN[catId] — câblé
- FEEDBACK-03 : HarvestBurst variant rendu au centre-écran tasks.tsx — câblé
- FEEDBACK-04 : bridge SecureStore last_semantic_category → subType → SUB_TYPE_TEMPLATES — câblé
- FEEDBACK-05 : parité FR+EN — 10 taskDone_* dans chaque locale — câblé
- D-02 : toast + burst sans séquencement (fire-and-forget) — respecté
- D-03 : silencieux si cappe (effectResult?.effectApplied falsy → pas de feedback) — respecté
- D-04 : SUB_TYPE_TEMPLATES avec fallback générique — respecté
- D-05 : 2 templates par catégorie, 10 catégories = 20 total — respecté
- D-06 : subType injecté dans useFocusEffect (bulle arbre uniquement) — respecté

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] HarvestBurst reward=0 affiche '+0 🍃'**
- **Found during:** Task 1 — vérification du code HarvestBurst
- **Issue:** Le plan indique que `reward={0}` devrait masquer le label — mais le composant affiche toujours `+{reward} 🍃`, donc `+0 🍃` visible
- **Fix:** Utilisé `reward={1}` comme mentionné en fallback dans le plan ("sinon utiliser reward={1}")
- **Files modified:** app/(tabs)/tasks.tsx
- **Commit:** 3c24d05

**2. [Rule 2 - Pattern] useFocusEffect async via promesse (pas IIFE bloquant)**
- **Found during:** Task 2 — analyse de la structure useFocusEffect dans tree.tsx
- **Issue:** Le useFocusEffect retourne une fonction cleanup — ne peut pas être converti directement en async (la valeur de retour serait une Promise, pas une fonction cleanup)
- **Fix:** SecureStore lue via promesse capturée dans closure, setTimeout callback converti en `async` pour `await subTypePromise` (1.5s > temps SecureStore typique)
- **Files modified:** app/(tabs)/tree.tsx
- **Commit:** 482aa55

## Known Stubs

None — toutes les données sont câblées et complètes. Le feedback end-to-end est opérationnel.

## Self-Check: PASSED

- hooks/useGamification.ts (EFFECT_TOASTS[catId]) : FOUND
- hooks/useGamification.ts (SecureStore.setItemAsync) : FOUND
- hooks/useGamification.ts (effectCategoryId) : FOUND
- app/(tabs)/tasks.tsx (HarvestBurst) : FOUND
- app/(tabs)/tasks.tsx (CATEGORY_VARIANT) : FOUND
- lib/mascot/companion-types.ts (subType?: string) : FOUND
- lib/mascot/companion-engine.ts (SUB_TYPE_TEMPLATES) : FOUND
- app/(tabs)/tree.tsx (last_semantic_category) : FOUND
- locales/fr/common.json (taskDone_menage_quotidien) : FOUND
- locales/en/common.json (taskDone_cuisine_repas) : FOUND
- Commit 3c24d05 : FOUND
- Commit 482aa55 : FOUND
