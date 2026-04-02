---
phase: quick
plan: 260402-wbr
subsystem: mascot/tree
tags: [ui, refactor, i18n, bottom-panel]
dependency_graph:
  requires: []
  provides: [nouveau-bottom-panel-2-cartes]
  affects: [app/(tabs)/tree.tsx]
tech_stack:
  added: []
  patterns: [2-card layout, flex action row]
key_files:
  created: []
  modified:
    - app/(tabs)/tree.tsx
    - locales/fr/common.json
    - locales/en/common.json
decisions:
  - Carte Actions conditionnelle (isOwnTree) sans fond/border individuel par bouton — flex:1 sur chaque actionItem
  - Carte Progression toujours visible avec marginTop conditionnel selon isOwnTree
  - Ligne evolution compacte en ligne horizontale (texte + barre + hint) au lieu d'un bloc vertical avec TreeView miniatures
metrics:
  duration: ~8min
  completed_date: "2026-04-02"
  tasks: 2
  files: 3
---

# Quick Task 260402-wbr: Refonte Bottom Panel Ecran Arbre (Option C) — Summary

**One-liner:** Remplacement du bottom panel monolithique de l'ecran arbre par 2 cartes separees (Actions en ligne horizontale + Progression avec barre XP et ligne evolution compacte).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Ajouter cles i18n manquantes | 456ceb7 | locales/fr/common.json, locales/en/common.json |
| 2 | Refonte bottom panel + nettoyage styles | 8b503a3 | app/(tabs)/tree.tsx |

## What Was Built

### Task 1 — Cles i18n
- Ajout de `mascot.screen.level`: `"niveau"` (FR) et `"level"` (EN)
- Correction de `levelsToEvo`: `"encore {{count}} niveau"` (FR) et `"{{count}} level left"` (EN)

### Task 2 — Refonte bottom panel tree.tsx
- Import de `type TreeStage` depuis `lib/mascot/types`
- Constante `STAGE_EMOJI: Record<TreeStage, string>` ajoutee avant le composant
- **Carte Actions** (`actionCard`): rendue uniquement si `isOwnTree`, boutons en ligne `flex:1` sans fond individuel (Boutique, Atelier, Techs, Decorer conditionnel, Badges, Compagnon conditionnel)
- **Carte Progression** (`progressCard`): toujours visible, header emoji+stade+niveau sur une ligne, barre XP 8px, ligne evolution compacte en row (texte → prochain stade + mini barre + hint niveaux restants), ou texte maxStage dore si legendaire
- **21 styles supprimes**: `infoCard`, `infoContainer`, `toolbar`, `toolBtn`, `toolBtnIcon`, `toolBtnLabel`, `xpSection`, `xpHeader`, `xpLabel`, `xpValue`, `xpBar`, `xpFill`, `evoSection`, `evoTitle`, `evoRow`, `evoStage`, `evoEmoji`, `evoStageName`, `evoArrow`, `evoHint`, `maxStage`
- **12 nouveaux styles**: `actionCard`, `actionRow`, `actionItem`, `actionItemIcon`, `actionItemLabel`, `progressCard`, `progressHeader`, `progressTitle`, `progressXp`, `progressBar`, `progressFill`, `evoLine`, `evoLineText`, `evoLineBar`, `evoLineFill`, `evoLineHint`

## Deviations from Plan

None — plan execute exactement comme decrit.

## Known Stubs

None.

## Self-Check: PASSED

- [x] `app/(tabs)/tree.tsx` modifie et commite (8b503a3)
- [x] `locales/fr/common.json` — cle `mascot.screen.level` presente
- [x] `locales/en/common.json` — cle `mascot.screen.level` presente
- [x] `npx tsc --noEmit` — aucune erreur dans tree.tsx
- [x] Styles supprimes non references dans tree.tsx
