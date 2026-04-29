---
phase: 47-auberge-sprites-pixel-art-animations-microcopy
plan: 03
subsystem: mascot/auberge
tags: [auberge, sprites, theme, lootChance, ui]
requires:
  - 47-02 (visitor-sprites.ts registry)
provides:
  - "ActiveVisitor.lootChance snapshot au spawn"
  - "Wiring portraits PNJ dans AubergeSheet et DashboardAuberge"
  - "Theme colors warning/error pour timer Auberge (zéro hex hardcodé)"
affects:
  - lib/mascot/types.ts
  - lib/mascot/auberge-engine.ts
  - components/mascot/AubergeSheet.tsx
  - components/dashboard/DashboardAuberge.tsx
tech-stack:
  added: []
  patterns: [theme-tokens, sprite-fallback, snapshot-on-spawn]
key-files:
  modified:
    - lib/mascot/types.ts
    - lib/mascot/auberge-engine.ts
    - components/mascot/AubergeSheet.tsx
    - components/dashboard/DashboardAuberge.tsx
decisions:
  - "lootChance optional pour rétrocompat — visiteurs persistés pré-Phase 47 utilisent fallback 0.18 dans l'UI"
  - "timerColor signature étendue (amber, red en params) plutôt que hook dans helper — préserve la pureté du helper"
metrics:
  duration: ~10min
  completed: 2026-04-29
  tasks: 3
---

# Phase 47 Plan 03: Wiring sprites + theme colors + lootChance snapshot

Câblage des portraits PNJ pixel art dans AubergeSheet et DashboardAuberge avec fallback emoji, migration des couleurs hex `TIMER_AMBER`/`TIMER_RED` vers les tokens thème `colors.warning`/`colors.error`, et snapshot de `lootChance` dans `ActiveVisitor` au spawn pour afficher la vraie probabilité de loot (8/18/35%) au lieu du `18%` hardcodé.

## What Changed

### Task 1 — Snapshot lootChance (commit a360c8f)
- `ActiveVisitor.lootChance?: number` ajouté (optionnel rétrocompat).
- `spawnVisitor` populate `lootChance: LOOT_CHANCE[def.rarity]`.
- `deliverVisitor` inchangé (lit `LOOT_CHANCE[def.rarity]` du catalogue — fallback compat).
- Pas de bump CACHE_VERSION (champ optionnel, sérialisé automatiquement par `JSON.stringify`).

### Task 2 — AubergeSheet (commit 7039e47)
- Import `Image` + `VISITOR_SPRITES`.
- Suppression `TIMER_AMBER`/`TIMER_RED`. `timerColor(minutes, fallback, amber, red)` étendue.
- Tcolor calculée avec `colors.warning`/`colors.error` dans `VisitorCard`.
- Portrait : `VISITOR_SPRITES[visitor.visitorId]` 64×64 ou fallback emoji 56px.
- `lootPct = Math.round((visitor.lootChance ?? 0.18) * 100)`.

### Task 3 — DashboardAuberge (commit 96efca5)
- Import `Image` + `VISITOR_SPRITES`.
- Suppression `TIMER_AMBER`/`TIMER_RED`. `timerColor` étendue (params amber/red).
- `VisitorRow` reçoit `amberColor`/`redColor` (passés depuis le parent via `colors.warning`/`colors.error`).
- Portrait 32×32 dans la row avec fallback emoji 28px.
- Pulse Reanimated intact.

## Verification

- `grep -E "#F59E0B|#EF4444" components/mascot/AubergeSheet.tsx components/dashboard/DashboardAuberge.tsx` → 0 résultat.
- `npx tsc --noEmit` clean.
- `npx jest --no-coverage --testPathPattern="auberge"` → 64 tests verts (3 suites : auberge-engine, parser-auberge, auberge-auto-tick).

Note: le plan mentionnait 76 tests Auberge ; le projet en compte effectivement 64 (pas de régression — aucune suite n'a été perdue).

## Deviations from Plan

Aucune — plan exécuté tel quel. Approche `timerColor(min, fallback, amber, red)` choisie pour rester un helper pur module-level (vs une closure inline dans le composant).

## Decisions Made

- **lootChance optional** : champ `?` plutôt que required pour rétrocompat avec visiteurs déjà persistés (ils tomberont sur le fallback `0.18` dans l'UI, ce qui matche le comportement actuel — pas de régression utilisateur).
- **timerColor signature étendue** : passe amber/red en params au lieu d'une closure ou d'un import depuis le contexte théma — garde le helper pur et testable.

## Self-Check: PASSED

- FOUND: lib/mascot/types.ts (lootChance ajouté)
- FOUND: lib/mascot/auberge-engine.ts (spawnVisitor lootChance)
- FOUND: components/mascot/AubergeSheet.tsx (sprites + theme colors + lootChance UI)
- FOUND: components/dashboard/DashboardAuberge.tsx (sprites + theme colors)
- FOUND: a360c8f, 7039e47, 96efca5 (3 commits)
- 0 hex `#F59E0B`/`#EF4444` restant dans les 2 fichiers UI.
- tsc clean ; 64 tests Auberge passent.
