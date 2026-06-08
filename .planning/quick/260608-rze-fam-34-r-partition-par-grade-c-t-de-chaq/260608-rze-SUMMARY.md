---
phase: quick-260608-rze
plan: "01"
subsystem: mascot/farm
tags: [farm, grades, inventory, ui]
dependency_graph:
  requires: [260421-obd, 260421-qy5]
  provides: [FAM-34]
  affects: [components/mascot/CraftSheet.tsx]
tech_stack:
  added: []
  patterns: [useMemo étendu avec shape enrichi, render conditionnel grade breakdown]
key_files:
  modified:
    - components/mascot/CraftSheet.tsx
decisions:
  - gradeBreakdown calculé dans harvestEntries useMemo (pas dans le render) — calcul centralisé, cohérent avec les autres computed values du composant
  - GRADE_ORDER.map + filter(count > 0) — idiome fonctionnel, zéro branchement conditionnel explicite
  - Style inventoryGrades dans makeStyles(farm) — alignement palette farm.* + tokens, pas de valeur hardcodée
metrics:
  duration: "3min"
  completed_date: "2026-06-08"
  tasks: 2
  files_modified: 1
---

# Quick 260608-rze: FAM-34 — Répartition par grade sous chaque récolte (Inventaire)

**One-liner:** Ligne de ventilation par grade (⚪🟢🟡🟣) affichée sous le total de chaque récolte dans Atelier > Inventaire > Récoltes.

## What Was Built

Atelier > Inventaire > Récoltes affiche désormais, sous chaque ligne "x{qty} — {prix} 🍃/vendre", une ligne de ventilation par grade, ex: `8 ⚪️  2 🟢  1 🟡`. Seuls les grades avec quantité > 0 sont affichés.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Calculer gradeBreakdown dans harvestEntries useMemo | af228130 | components/mascot/CraftSheet.tsx |
| 2 | Rendre la ligne de répartition + style inventoryGrades | af228130 | components/mascot/CraftSheet.tsx |

Les deux tâches ont été commitées ensemble car elles forment une unité atomique (shape étendue + rendu).

## Changes Made

**components/mascot/CraftSheet.tsx:**
- `harvestEntries` useMemo : type inline étendu avec `gradeBreakdown: Array<{ grade, count, emoji }>`; calcul via `GRADE_ORDER.map(grade => ({ grade, count: countItemByGrade(...), emoji: getGradeEmoji(grade) })).filter(e => e.count > 0)`
- Destructuring `gradeBreakdown` dans `harvestEntries.map`
- `<Text style={styles.inventoryGrades}>` conditionnel (`gradeBreakdown.length > 0`) affichant `gradeBreakdown.map(g => \`${g.count} ${g.emoji}\`).join('  ')`
- Style `inventoryGrades` dans `makeStyles(farm)` : `{ fontSize: FontSize.caption, color: farm.brownTextSub, marginTop: 2 }`

## Deviations from Plan

None — plan exécuté exactement comme spécifié.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- components/mascot/CraftSheet.tsx : modifié et commité (af228130)
- `npx tsc --noEmit` : 0 erreur dans CraftSheet.tsx
- Style `inventoryGrades` présent dans makeStyles(farm)
- `gradeBreakdown` présent dans harvestEntries useMemo
