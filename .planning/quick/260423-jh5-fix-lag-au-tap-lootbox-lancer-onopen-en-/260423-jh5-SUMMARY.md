---
phase: quick-260423-jh5
plan: "01"
subsystem: LootBoxOpener
tags: [performance, haptics, animation, lootbox, parallélisation]
dependency_graph:
  requires: []
  provides: [handleOpen-refactorisé]
  affects: [components/LootBoxOpener.tsx]
tech_stack:
  added: []
  patterns: [Promise.all, fire-and-forget-haptics, minShakeDelay]
key_files:
  created: []
  modified:
    - components/LootBoxOpener.tsx
decisions:
  - "minShakeDelay=900ms (vs 600ms précédent) pour garantir un shake visuellement satisfaisant avant reveal"
  - "Haptics mythique: timings 0/300/550ms (vs 0/300/550ms séquentiels bloquants) — ressenti identique, non-bloquant"
  - "await new Promise(250ms) pack→reveal préservé intentionnellement pour la chorégraphie"
metrics:
  duration: ~5min
  completed_date: "2026-04-23"
  tasks_completed: 1
  tasks_total: 2
  files_modified: 1
---

# Quick Task 260423-jh5: Fix lag au tap lootbox — onOpen() en parallèle + haptics fire-and-forget

**One-liner:** Parallélisation Promise.all(fetch + minShakeDelay=900ms) + conversion haptics séquentiels en fire-and-forget pour réduire le lag perçu de ~1.85s à ~900ms worst-case.

## Objectif

Réduire le lag perçu entre le tap sur la lootbox et l'apparition du reveal, en éliminant les bloquants purs du flux handleOpen.

## Ce qui a été changé

### components/LootBoxOpener.tsx — handleOpen

**Avant (flux sérialisé, worst-case mythique = 1850ms + API):**
```
tap → 600ms bloquants → API fetch → 500ms bloquants → 750ms haptics séquentiels → reveal
```

**Après (flux parallèle, worst-case = max(API, 900ms)):**
```
tap → Promise.all(API fetch + 900ms) → haptics fire-and-forget → reveal immédiat
```

**Modifications précises :**

1. Supprimé `await new Promise(r => setTimeout(r, 600))` — le fetch ne se fait plus attendre 600ms
2. Supprimé `await new Promise(r => setTimeout(r, 500))` — buffer post-fetch arbitraire éliminé
3. Remplacé par `const [box] = await Promise.all([onOpen(), minShakeDelay])` avec `minShakeDelay = 900ms`
4. Haptics mythique (3×Heavy) convertis en fire-and-forget: `Haptics.impactAsync()` + `setTimeout(..., 300)` + `setTimeout(..., 550)`
5. Haptics légendaire (2×Heavy) convertis en fire-and-forget: `Haptics.impactAsync()` + `setTimeout(..., 200)`
6. Haptics épique (1×Heavy) : `await` retiré
7. Haptics reveal final (Heavy + Medium 200ms) : `await` retiré

**Inchangé :**
- Branche `reduceMotion` (lignes 761-785) — intacte
- `await new Promise(r => setTimeout(r, 250))` entre pack-collapse et `setPhase('reveal')` — préservé intentionnellement
- Haptics shake initiaux (setTimeout fire-and-forget aux 300/500/700ms) — inchangés

## Commits

| Hash | Description |
|------|-------------|
| e19edc7 | fix(quick-260423-jh5): paralléliser fetch onOpen + haptics fire-and-forget lootbox |

## Vérification TypeScript

```
npx tsc --noEmit 2>&1 | grep -v "MemoryEditor.tsx|cooklang.ts|useVault.ts" | grep "error TS"
→ Aucune sortie (0 nouvelle erreur)
```

## Checkpoint en attente

**Task 2 (checkpoint:human-verify):** Vérification device du feel "instantané"

Voir le PLAN.md pour les étapes de vérification complètes.

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

## Known Stubs

None.

## Self-Check: PASSED

- [x] `components/LootBoxOpener.tsx` modifié — vérifié
- [x] Commit e19edc7 existe — vérifié
- [x] `Promise.all([onOpen(), minShakeDelay])` présent
- [x] Aucun `await new Promise(r => setTimeout(r, 500))` dans handleOpen
- [x] Aucun `await Haptics.impactAsync(...)` dans blocs mythique/légendaire/épique
- [x] `await new Promise(r => setTimeout(r, 250))` pack→reveal préservé
- [x] Branche reduceMotion intacte
