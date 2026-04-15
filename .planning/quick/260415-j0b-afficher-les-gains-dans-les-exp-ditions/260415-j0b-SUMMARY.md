---
phase: quick-260415-j0b
plan: "01"
subsystem: mascot/expeditions
tags: [expeditions, loot, ux, lisibilite]
dependency_graph:
  requires: []
  provides: [getLootDisplay]
  affects: [ExpeditionsSheet, ExpeditionChest]
tech_stack:
  added: []
  patterns: [lookup helper, lisibilité loot]
key_files:
  created: []
  modified:
    - lib/mascot/expedition-engine.ts
    - components/mascot/ExpeditionsSheet.tsx
    - components/mascot/ExpeditionChest.tsx
decisions:
  - getLootDisplay cherche dans toutes les difficultés de EXPEDITION_LOOT_TABLE — un seul lookup couvre les items partagés entre niveaux (ex: boost_recolte_2x présent en easy et medium)
  - lootChip réutilise colors.catJeux (vert) pour cohérence avec les costChips du catalogue
  - lossBanner reprend exactement le style outcomeBadge de ExpeditionChest — cohérence visuelle zero effort
metrics:
  duration: "5min"
  completed_date: "2026-04-15"
  tasks: 1
  files: 3
---

# Quick 260415-j0b: Afficher les gains dans les expéditions — Summary

**One-liner:** Helper getLootDisplay + ResultRow lisible (emoji+label) + bandeaux perte failure/partial dans ExpeditionChest

## What Was Built

### Task 1: Helper getLootDisplay + ameliorer ResultRow et ExpeditionChest

**Commit:** ae37ebf

**Fichiers modifiés:**
- `lib/mascot/expedition-engine.ts` — export `getLootDisplay(itemId)` lookup dans EXPEDITION_LOOT_TABLE
- `components/mascot/ExpeditionsSheet.tsx` — ResultRow affiche lootChip (emoji+label) + messages failure/partial
- `components/mascot/ExpeditionChest.tsx` — bandeaux perte (lossBanner) pour failure et partial

**Changements clés:**

1. `getLootDisplay(itemId: string): { label: string; emoji: string } | null` — itère sur toutes les difficultés, retourne le premier match. Gère les items présents dans plusieurs niveaux (boost_recolte_2x dans easy et medium).

2. `ResultRow` dans ExpeditionsSheet : remplace l'affichage brut `lootItemId` par un chip coloré `{emoji} {label}`. Ajoute un texte explicite "Mise perdue" (colors.error) pour failure et "Retour partiel — pas de butin" (colors.warning) pour partial.

3. `ExpeditionChest` : après le lootCard existant, affiche `lossBanner` avec `MaterialCommunityIcons close-circle` pour failure et `alert-circle-outline` pour partial. Styles cohérents avec outcomeBadge.

## Verification

- `npx tsc --noEmit` — aucune erreur (zéro sortie)
- Onglet Résultats : loot affiché avec emoji + label lisible au lieu du raw itemId
- Coffre failure : bandeau "Toute la mise a été perdue" visible après ouverture
- Coffre partial : bandeau "Retour partiel — butin perdu" visible
- Coffre success/rare : lootCard inchangé, zero régression

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

## Known Stubs

None.

## Self-Check: PASSED

- ae37ebf commit vérifié dans git log
- lib/mascot/expedition-engine.ts modifié (getLootDisplay exporté)
- components/mascot/ExpeditionsSheet.tsx modifié (ResultRow mis à jour)
- components/mascot/ExpeditionChest.tsx modifié (lossBanner ajouté)
