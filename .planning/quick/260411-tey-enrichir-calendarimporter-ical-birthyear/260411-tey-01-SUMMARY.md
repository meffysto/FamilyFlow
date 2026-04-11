---
phase: quick-260411-tey
plan: 01
subsystem: components
tags: [anniversaires, calendrier, import, ios, ical]
dependency_graph:
  requires: []
  provides: [birthYear depuis startDate iCal, notes depuis DESCRIPTION iCal, affichage notes dans liste]
  affects: [components/CalendarImporter.tsx]
tech_stack:
  added: []
  patterns: [cast (event as {notes?: string}), birthYear > 1900 filter]
key_files:
  created: []
  modified:
    - components/CalendarImporter.tsx
decisions:
  - "birthYear: startYear > 1900 exclut placeholder iOS 1604 sans casser les vraies années"
  - "Cast (event as {notes?: string}) pour accéder à notes sans modifier les types expo-calendar"
  - "Réutilisation style contactDate pour la ligne notes — pas de nouveau style déclaré"
  - "Troncature manuelle 60 chars + numberOfLines={1} pour double-filet de protection layout"
metrics:
  duration: "5min"
  completed: "2026-04-11"
  tasks: 1
  files: 1
---

# Phase quick-260411-tey Plan 01: Enrichir CalendarImporter — birthYear et notes iCal Summary

**One-liner:** Extraction et propagation de birthYear (startDate > 1900) et notes (DESCRIPTION iCal) lors de l'import d'anniversaires depuis iOS Calendar, avec affichage conditionnel dans la liste.

## Objective

Enrichir `CalendarImporter.tsx` pour ne plus ignorer deux champs déjà présents dans les événements iCal : l'année de naissance et les notes. Un anniversaire importé depuis iOS Birthdays avec startDate 1990-05-14 produit maintenant `birthYear: 1990`; avec 1604-01-01 (placeholder iOS), `birthYear: undefined`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extraire birthYear et notes dans le mapping + propager à l'import + afficher dans la liste | bcf979b | components/CalendarImporter.tsx |

## Changes Made

**4 points d'édition dans `components/CalendarImporter.tsx` :**

1. `interface CalendarBirthday` — ajout `notes?: string`
2. Boucle mapping événements — extraction `birthYear` (startYear > 1900) et `notes` (trim, ou undefined)
3. `handleImport` — `notes: b.notes` au lieu de `notes: undefined`
4. `renderBirthday` — texte conditionnel notes après la date, `numberOfLines={1}`, tronqué à 60 chars avec ellipse

## Deviations from Plan

None — plan exécuté exactement comme décrit.

## Known Stubs

None.

## Self-Check: PASSED

- components/CalendarImporter.tsx modifié: FOUND
- Commit bcf979b: FOUND
- `npx tsc --noEmit | grep CalendarImporter.tsx` → no new errors: PASSED
