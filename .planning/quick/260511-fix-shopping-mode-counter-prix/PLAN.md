---
slug: fix-shopping-mode-counter-prix
created: "2026-05-11"
status: in-progress
---

# Fix ShoppingModeView — compteur XX/YY et prix total

## Objectif
Corriger le compteur et l'affichage du prix en mode plein écran courses.

## Problème
Les items cochés sont **supprimés** de la liste (`removeCourseItem`), pas marqués `completed`.
- `doneCount` est toujours 0 (aucun item avec `completed: true`)
- `totalCount` diminue à chaque coche → affiche "0/2" puis "0/1"
- `undoStack` (prop existante) trace exactement les items cochés/supprimés : `{ text, section }[]`

## Solution
### Compteur
- `checkedCount = undoStack?.length ?? 0`
- `displayTotal = totalCount + checkedCount` (items restants + items cochés = total constant)
- `pct = displayTotal > 0 ? checkedCount / displayTotal : 0`
- `allDone = displayTotal > 0 && checkedCount === displayTotal`

### Stats par rayon (section header)
- `checkedBySectionFromUndo`: map section → nb items cochés (depuis undoStack)
- `sectionDone = checkedBySectionFromUndo[section] ?? 0`
- `sectionTotal = items.length + sectionDone`
- `sectionAllDone = sectionTotal > 0 && sectionDone === sectionTotal`

### Prix
- Capturer `remainingEstimate` au montage avec `useRef` → `initialTotalEstimateRef`
- Afficher : "≈ X€ restants · ≈ Y€ total" (masquer si tout coché)

## Fichiers
- `components/ShoppingModeView.tsx` (seul fichier modifié)

## Validation
- `npx tsc --noEmit` sans erreurs
