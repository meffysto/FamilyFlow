---
slug: fix-shopping-mode-counter-prix
status: complete
completed: "2026-05-11"
---

# Résumé

Corrigé l'affichage du compteur et du prix en mode shopping plein écran.

## Ce qui a changé
- `checkedCount = undoStack.length` (items supprimés = cochés)
- `totalCount = remainingCount + checkedCount` (constant pendant la session)
- Stats par rayon via `checkedBySectionFromUndo` (filtre undoStack par section)
- Prix total capturé au montage → affiche "≈ X€ restants · ≈ Y€ total"

## Commit
53e24f87
