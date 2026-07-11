---
phase: quick-260711-fam-31
subsystem: journal
tags: [bug-fix, journal, layout, fam-31]
modified:
  - "app/(tabs)/journal.tsx"
created:
  - ".planning/quick/260711-fam-31-journal-de-julie-phrase-coupee/260711-fam-31-PLAN.md"
  - ".planning/quick/260711-fam-31-journal-de-julie-phrase-coupee/260711-fam-31-SUMMARY.md"
---

# FAM-31 — Journal de Julie phrase coupee

## Done

- Corrige le rendu coupe des phrases longues dans les listes numerotees du journal.
- Ajoute un wrapper `obsMarkdownContent` autour de `MarkdownText` dans les observations et les sections adultes numerotees.
- Contraint ce wrapper avec `flex: 1` et `minWidth: 0`, afin que le texte revienne a la ligne au lieu de deborder sous l'`overflow: hidden` de la carte.

## Verification

- `node -e "...FAM-31 layout guard..."` : OK
- `npx tsc --noEmit` : OK
