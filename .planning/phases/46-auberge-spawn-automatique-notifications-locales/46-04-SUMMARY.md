---
phase: 46-auberge-spawn-automatique-notifications-locales
plan: 04
subsystem: mascot/auberge
tags: [release-hygiene, dev-only, auberge]
requires: []
provides:
  - "AubergeSheet : bouton 'Forcer un visiteur (dev)' masqué en release"
affects:
  - components/mascot/AubergeSheet.tsx
tech-stack:
  added: []
  patterns:
    - "{__DEV__ && (...)} pour gating dev-only de UI debug"
key-files:
  created: []
  modified:
    - components/mascot/AubergeSheet.tsx
decisions:
  - "Conserver forceSpawn / handleForceSpawn dans le composant : Metro/Hermes tree-shake en release via la constante __DEV__ = false"
metrics:
  duration: ~2min
  tasks_completed: 1
  files_modified: 1
  completed: 2026-04-29
requirements: [AUBERGE-46-05]
---

# Phase 46 Plan 04 : Re-gate bouton dev derrière __DEV__ — Summary

Restaure le gating `__DEV__` autour du bouton "🪄 Forcer un visiteur (dev)" dans `AubergeSheet.tsx` — exposition release retirée, hygiène TestFlight rétablie.

## What Changed

Le commit `28d7810` (Phase 45) avait temporairement exposé le bouton dev en release pour valider le pipeline auberge. Le spawn automatique (Plans 46-01 + 46-02) prenant désormais le relais en production, le bouton redevient strictement dev-only.

### Modification

`components/mascot/AubergeSheet.tsx` (lignes ~544-559) :
- Avant : `<TouchableOpacity>` exposé sans condition + commentaire "temporairement exposé en release pour test Phase 45"
- Après : `{__DEV__ && (<TouchableOpacity>...)}` + commentaire mis à jour pour Phase 46

## Verification

- `npx tsc --noEmit` → 0 erreur sur `AubergeSheet.tsx`
- `grep "{__DEV__ && (" components/mascot/AubergeSheet.tsx` → présent ligne ~545
- En build dev : bouton visible et fonctionnel
- En build release (Hermes) : `__DEV__` remplacé par `false` → bloc tree-shaken, bouton invisible

## Deviations from Plan

None - plan executed exactly as written.

## Commits

- `31842a3` — feat(46-04): re-gate bouton dev 'Forcer un visiteur' derrière __DEV__

## Self-Check: PASSED

- File `components/mascot/AubergeSheet.tsx` modified — confirmed
- Commit `31842a3` exists — confirmed
- `{__DEV__ && (` present in file — confirmed
- `npx tsc --noEmit` clean on AubergeSheet — confirmed
