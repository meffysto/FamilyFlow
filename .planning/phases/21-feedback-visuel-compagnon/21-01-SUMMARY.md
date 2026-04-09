---
phase: 21-feedback-visuel-compagnon
plan: "01"
subsystem: semantic-feedback
tags: [haptics, toast, harvest-burst, semantic, i18n]
dependency_graph:
  requires: [lib/semantic/categories.ts, lib/mascot/haptics.ts]
  provides: [lib/semantic/effect-toasts.ts, lib/mascot/haptics.ts (extended), components/mascot/HarvestBurst.tsx (extended)]
  affects: [Plan 02 — câblage completeTask]
tech_stack:
  added: []
  patterns: [Record<CategoryId, T> pour mappings typesafe, variant config pattern pour composants paramétriques]
key_files:
  created:
    - lib/semantic/effect-toasts.ts
  modified:
    - lib/mascot/haptics.ts
    - components/mascot/HarvestBurst.tsx
    - lib/semantic/index.ts
decisions:
  - "Module effect-toasts.ts pur (zéro import vault/hook) — consommable par Plan 02 sans effets de bord"
  - "HarvestBurst comportement par défaut préservé à 100% quand variant omis — backward-compatible"
  - "Réutilisation du pattern delay() existant dans haptics.ts — cohérence avec les fonctions existantes"
metrics:
  duration: "~3 minutes"
  completed_date: "2026-04-09"
  tasks_completed: 2
  files_modified: 4
---

# Phase 21 Plan 01: Constantes feedback visuel/haptique Summary

Création des briques fondamentales du feedback sémantique différencié : dictionnaire EFFECT_TOASTS FR+EN, 4 patterns haptics par intensité, et HarvestBurst paramétrique avec 3 variants visuels (golden/rare/ambient).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Créer effect-toasts.ts + étendre haptics.ts | a20a24e | lib/semantic/effect-toasts.ts (nouveau), lib/mascot/haptics.ts, lib/semantic/index.ts |
| 2 | Étendre HarvestBurst avec prop variant | c652750 | components/mascot/HarvestBurst.tsx |

## What Was Built

### lib/semantic/effect-toasts.ts (nouveau)

Module pur avec :
- `EffectToastDef` interface (icon, fr, en, subtitle_fr, subtitle_en, type)
- `EFFECT_TOASTS: Record<CategoryId, EffectToastDef>` — 10 entrées exactes
- `HarvestBurstVariant` type : `'ambient' | 'rare' | 'golden'`
- `CATEGORY_VARIANT: Record<CategoryId, HarvestBurstVariant>` — mapping catégorie → intensité visuelle
- `CATEGORY_HAPTIC_FN: Record<CategoryId, () => void | Promise<void>>` — mapping catégorie → fonction haptic

### lib/mascot/haptics.ts (étendu)

4 nouvelles fonctions exportées, placées avant la fonction utilitaire `delay()` :
- `hapticsEffectLight()` — impact léger simple (ménage quotidien/hebdo)
- `hapticsEffectMedium()` — double tap light+medium (courses, routines, devoirs, budget)
- `hapticsEffectStrong()` — séquence medium+medium+success (cuisine, gratitude)
- `hapticsEffectGolden()` — crescendo light+medium+heavy+success (soins bébé, rendez-vous)

### components/mascot/HarvestBurst.tsx (étendu)

- Nouveau prop `variant?: HarvestBurstVariant`
- `VARIANT_CONFIG` : 3 configs complètes (particleCount, particleSize, travelMin/Max, labelTravelY, labelDuration, labelColor, particleColor)
- Composant `Particle` paramétrique (accepte particleSize, particleCount, travelMin, travelMax)
- Comportement par défaut **inchangé** quand `variant` est omis

## Verification

- `npx tsc --noEmit` : passe sans erreur (aucun nouveau warning)
- EFFECT_TOASTS : 10 entrées pour les 10 CategoryId
- 4 fonctions haptic couvrant les 10 catégories par intensité
- VARIANT_CONFIG : golden (12 particules #FFD700), rare (10 #A78BFA), ambient (8 #34D399)

## Deviations from Plan

None — plan exécuté exactement comme écrit.

## Known Stubs

None — toutes les données sont câblées et complètes. Plan 02 consommera directement ces exports.

## Self-Check: PASSED

- lib/semantic/effect-toasts.ts : FOUND
- lib/mascot/haptics.ts (hapticsEffectLight) : FOUND
- lib/mascot/haptics.ts (hapticsEffectGolden) : FOUND
- components/mascot/HarvestBurst.tsx (VARIANT_CONFIG) : FOUND
- Commit a20a24e : FOUND
- Commit c652750 : FOUND
