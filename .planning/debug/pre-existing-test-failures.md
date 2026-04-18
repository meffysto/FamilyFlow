---
status: investigating
trigger: "Investigate and fix pre-existing test failures in 4 test suites. 145 tests échouent dans world-grid, lovenotes-selectors, companion-engine, codex-content"
created: 2026-04-18T00:00:00Z
updated: 2026-04-18T00:00:00Z
---

## Current Focus

hypothesis: Investigating each test suite independently to find exact root causes
test: Reading test files and source files to understand expected vs actual behavior
expecting: Clear minimal fixes for each suite
next_action: Read test files for all 4 suites

## Symptoms

expected: Tous les tests passent (npx jest --no-coverage)
actual: 145 tests échouent dans 4 suites (codex-content ~140, world-grid 1, companion-engine 1, lovenotes-selectors 3)
errors: |
  1. codex-content: clés i18n manquantes FR+EN + dropOnly liste incorrecte
  2. world-grid: getUnlockedCropCells retourne 0 pour stade 'graine'
  3. companion-engine: detectProactiveEvent ne retourne pas 'celebration' pour streak multiple de 7 hors matin
  4. lovenotes-selectors: archivedForProfile n'inclut pas notes reçues+lues / envoyées+lues, tri readAt desc incorrect
reproduction: npx jest --no-coverage --testPathPattern="world-grid|lovenotes-selectors|companion-engine|codex-content"
started: Pre-existing — jamais passé

## Eliminated

(none yet)

## Evidence

(none yet)

## Resolution

root_cause:
fix:
verification:
files_changed: []
