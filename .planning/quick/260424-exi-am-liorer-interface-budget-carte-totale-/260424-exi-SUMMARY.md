---
phase: quick-260424-exi
plan: 01
subsystem: budget
tags: [budget, ui, useMemo, filtrage, tri]
dependency_graph:
  requires: []
  provides: [budget-ui-enrichie]
  affects: [app/(tabs)/budget.tsx]
tech_stack:
  added: []
  patterns: [useMemo pour valeurs dérivées, tokens design, useThemeColors]
key_files:
  created: []
  modified:
    - app/(tabs)/budget.tsx
decisions:
  - sortedCategories calculé en useMemo (pas inline dans le JSX) pour réutilisabilité et perf
  - Stats carte totale via IIFE dans JSX pour garder usagePct/entriesCount scoped
  - categorySpentMap via Map<string, number> pour lookup O(1) dans les chips
  - filteredTotalAmount useMemo dépend de filteredEntries (recalcul minimal)
  - Chips modal d'ajout volontairement inchangées (montants sur filtre liste uniquement)
metrics:
  duration: "~3min"
  completed: "2026-04-24"
  tasks: 2
  files: 1
---

# Phase quick-260424-exi Plan 01: Budget UI Enrichie — Summary

**One-liner:** Carte totale avec % utilisé + nb dépenses, catégories triées par urgence avec % coloré, chevrons ‹/› stylisés, chips filtre avec montants et total filtré.

## Tasks Completed

| # | Nom | Commit | Fichiers |
|---|-----|--------|---------|
| 1 | Carte totale enrichie + tri catégories + % | 24a165c | app/(tabs)/budget.tsx |
| 2 | Chevrons ‹/› + chips montants + total filtré | dd08887 | app/(tabs)/budget.tsx |

## Changes Made

### Task 1 — Onglet Résumé

**Carte totale enrichie (`totalCard`):**
- Calcul `usagePct` et `entriesCount` directement dans le JSX via IIFE
- Affichage `"{X}% utilisé · N dépenses"` sous la barre de progression
- Style `totalStats` : `FontSize.sm`, `FontWeight.semibold`, `marginTop: Spacing.md`

**Tri catégories par urgence (`sortedCategories`):**
- `useMemo` positionné après `priceEvolutions` (avant le JSX)
- Ordre : dépassées (overBudget) → proches (>80%) → reste par % décroissant
- Itération `sortedCategories.map(({ cat, catSpent, pct, overBudget }) => ...)` en remplacement de `budgetConfig.categories.map(...)`

**% affiché sur chaque card catégorie:**
- `Text` avec style `catPct` inséré entre `catName` et `catAmount` dans `catHeader`
- Couleur : `colors.error` (>100%), `colors.warning` (>80%), `colors.textMuted` (reste)
- Style `catPct` : `FontSize.sm`, `FontWeight.bold`, `marginHorizontal: Spacing.md`

### Task 2 — Navigation + Liste

**Chevrons stylisés:**
- `{'<'}` → `{'‹'}` et `{'>'}` → `{'›'}`
- Style `monthArrow` mis à jour : `fontSize: FontSize.hero`, `fontWeight: FontWeight.medium`, `lineHeight: FontSize.hero`, `paddingHorizontal: Spacing.md`

**Chips filtre avec montants:**
- `categorySpentMap` useMemo (Map<string, number>) pour éviter les recalculs inline
- Rendu chip : `{cat.emoji} {cat.name}{' · '}{formatAmount(catSpent)}`
- Modal d'ajout inchangée (chipRow non touché)

**Total montant filtré:**
- `filteredTotalAmount` useMemo dépendant de `filteredEntries`
- Ajout `{' · '}{formatAmount(filteredTotalAmount)}` après le compteur `resultCount`

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

## Self-Check: PASSED

- [x] app/(tabs)/budget.tsx modifié et commité (24a165c, dd08887)
- [x] `npx tsc --noEmit` : 0 erreur
- [x] Aucun hardcode couleur (`grep "#[0-9a-fA-F]{6}"` → 0 occurrences)
- [x] Modal d'ajout inchangée
- [x] Tokens design uniquement (Spacing, FontSize, FontWeight)
- [x] useThemeColors() pour toutes les couleurs
