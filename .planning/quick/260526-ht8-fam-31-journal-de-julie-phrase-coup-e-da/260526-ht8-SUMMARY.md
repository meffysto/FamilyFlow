---
phase: quick-260526-ht8
plan: "01"
subsystem: journal
tags: [bug-fix, journal, markdown, fam-31]
dependency_graph:
  requires: []
  provides: [FAM-31-fix]
  affects: ["app/(tabs)/journal.tsx"]
tech_stack:
  added: []
  patterns: [replace-newlines-before-markdown-write]
key_files:
  created: []
  modified:
    - "app/(tabs)/journal.tsx"
decisions:
  - "Normaliser \n → espace simple avant stockage markdown (pas de modification du rendu multiline)"
metrics:
  duration: "~3min"
  completed_date: "2026-05-26"
---

# Quick 260526-ht8 Plan 01: FAM-31 Journal de Julie — phrase coupée au read-back

**One-liner:** Normalisation `.replace(/\s*\n\s*/g, ' ').trim()` sur les deux branches NUMBERED_LIST_TYPES (edit + add) pour éviter que les `\n` intégrés brisent l'item de liste markdown unique.

## What Was Done

Dans `confirmModal` de `app/(tabs)/journal.tsx`, les deux branches `NUMBERED_LIST_TYPES` produisant `rowContent` pour les types non-`DouleurAdulte` (SymptomeAdulte, ObservationAdulte) avaient un bug : si l'utilisateur saisissait du texte multi-lignes dans le champ `multiline`, les `\n` intégrés brisaient l'item de liste markdown `N. phrase` en plusieurs lignes brutes. Au read-back, seule la première ligne matchait `/^(\d+)\.\s*(.*)/` — le reste était silencieusement perdu.

**Fix appliqué :**

- Branche edit (~L647) : remplacement de `modal.fields.text?.trim() || ''` par `(modal.fields.text?.replace(/\s*\n\s*/g, ' ').trim() || '')`
- Branche add (~L668) : même remplacement
- Commentaire FR `// FAM-31 — normalise les retours à la ligne pour ne pas casser l'item de liste markdown` ajouté sur chaque branche modifiée

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 30ec680a | fix(journal): FAM-31 — normalise les retours à la ligne dans les items de liste markdown |

## Verification

- `npx tsc --noEmit` : aucune nouvelle erreur dans `app/(tabs)/journal.tsx`
- DouleurAdulte (buildRowFromFields) non touchée
- Rendu multiline (~L1168) non touché — l'utilisateur peut toujours saisir multi-lignes

## Deviations from Plan

None — plan exécuté exactement comme décrit.

## Known Stubs

None.

## Threat Flags

None — modification purement interne à la logique de sérialisation markdown, pas de nouvelle surface réseau ni de traitement de données sensibles.

## Self-Check: PASSED

- [x] `app/(tabs)/journal.tsx` modifié (2 branches corrigées)
- [x] Commit 30ec680a existe
- [x] `npx tsc --noEmit` propre sur journal.tsx
