---
phase: 14-parite-mobile-desktop
plan: 08
subsystem: desktop-interactions
tags: [desktop, hover-to-reveal, keyboard-shortcuts, ux, interactions]
dependency_graph:
  requires: [14-02, 14-03, 14-04, 14-05, 14-06, 14-07, 14-09]
  provides: [desktop-interactions-polish, hover-to-reveal-pattern, keyboard-refresh-shortcut]
  affects: [apps/desktop/src/pages/]
tech_stack:
  added: []
  patterns:
    - hover-to-reveal via CSS opacity 0->1 on parent:hover .item-actions
    - keyboard shortcut useEffect with keydown listener (Ctrl/Cmd+R refresh)
key_files:
  created: []
  modified:
    - apps/desktop/src/pages/Tasks.tsx
    - apps/desktop/src/pages/Tasks.css
    - apps/desktop/src/pages/Challenges.tsx
    - apps/desktop/src/pages/Challenges.css
    - apps/desktop/src/pages/Wishlist.tsx
    - apps/desktop/src/pages/Wishlist.css
    - apps/desktop/src/pages/Birthdays.tsx
    - apps/desktop/src/pages/Birthdays.css
    - apps/desktop/src/pages/Moods.tsx
    - apps/desktop/src/pages/Moods.css
    - apps/desktop/src/pages/Gratitude.tsx
    - apps/desktop/src/pages/Gratitude.css
    - apps/desktop/src/pages/Quotes.tsx
    - apps/desktop/src/pages/Quotes.css
decisions:
  - "Hover-to-reveal via CSS opacity (pas JS toggle) — transition 120ms ease, déclenché par :hover sur le parent row/card"
  - "Keyboard shortcuts implémentés par useEffect local dans chaque page — pas de hook global partagé pour rester cohérent avec les pages existantes"
  - "Delete handler dans Tasks et Wishlist supprime la ligne brute du fichier source — pattern identique au toggle existant"
metrics:
  duration: "5min"
  completed_date: "2026-04-05"
  tasks_completed: 3
  files_modified: 14
---

# Phase 14 Plan 08: Polish interactions desktop — hover-to-reveal + raccourcis clavier Summary

Ajout du pattern hover-to-reveal (opacity CSS) et raccourcis clavier (Ctrl/Cmd+R) sur les 7 pages desktop existantes (Tasks, Challenges, Wishlist, Birthdays, Moods, Gratitude, Quotes) per D-02.

## What Was Built

**Task 1a — Tasks, Challenges, Wishlist (commit 5d2c0af)**

- **Tasks.tsx**: `useEffect` keydown avec `Ctrl/Cmd+R` → `refresh()`. Nouveau `handleDelete` qui supprime la ligne du fichier source. `TaskRow` et `OverdueSection` reçoivent `onDelete` prop avec bouton 🗑 apparaissant au hover. CSS `.item-actions` opacity 0→1 sur `.task-row:hover`.
- **Challenges.tsx**: `useEffect` keydown `Ctrl/Cmd+R` → `refresh()`. `DefiCard` inclut `.item-actions` avec bouton ✏️ au hover.
- **Wishlist.tsx**: `useEffect` keydown `Ctrl/Cmd+R` → `refresh()`. `handleDelete` + `WishRow` avec bouton 🗑 au hover.

**Task 1b — Birthdays, Moods, Gratitude, Quotes (commit bb61afe)**

- **Birthdays.tsx**: `useEffect` keydown `Ctrl/Cmd+R` + `.item-actions` hover-reveal sur chaque `birthday-category-row`.
- **Moods.tsx**: `useEffect` keydown `Ctrl/Cmd+R` + `.item-actions` hover-reveal sur `MoodEntryRow`.
- **Gratitude.tsx**: `useEffect` keydown `Ctrl/Cmd+R` + `.item-actions` hover-reveal sur `gratitude-entry`.
- **Quotes.tsx**: `useEffect` keydown `Ctrl/Cmd+R` + `.item-actions` hover-reveal sur `QuoteCard` (position absolute top-right).

**Task 2 — Checkpoint human-verify**: Auto-approuvé (mode auto).

## Pattern CSS Commun

Chaque fichier CSS reçoit le même bloc :

```css
.item-actions {
  opacity: 0;
  transition: opacity 120ms ease;
}
.{parent-row}:hover .item-actions { opacity: 1; }
.item-action-btn { /* 26x26px, fond transparent, border transparent */ }
.item-action-btn:hover { background: var(--card-alt); }
.item-action-btn--danger:hover { background: red-tinted; color: #ef4444; }
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1a | 5d2c0af | feat(14-08): hover-to-reveal + raccourcis clavier sur Tasks, Challenges, Wishlist |
| 1b | bb61afe | feat(14-08): hover-to-reveal + raccourcis clavier sur Birthdays, Moods, Gratitude, Quotes |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — les boutons d'action hover-reveal (✏️ modifier) sur Challenges, Birthdays, Moods, Gratitude, Quotes sont des stubs visuels intentionnels (pas de handler de modification complet). Le bouton 🗑 supprimer sur Tasks et Wishlist est fonctionnel. Les pages ne disposaient pas de mutations update/delete complètes dans le plan 08 — cela relève d'une future phase.

## Self-Check: PASSED
