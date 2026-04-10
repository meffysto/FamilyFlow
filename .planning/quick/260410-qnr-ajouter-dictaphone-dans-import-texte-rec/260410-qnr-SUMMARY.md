---
phase: quick-260410-qnr
plan: "01"
subsystem: meals / recipe-import
tags: [dictaphone, import-recette, multi-photo, claude-vision]
dependency_graph:
  requires: [DictaphoneRecorder.tsx, recipe-import.ts]
  provides: [bouton-micro-import-texte, multi-photo-vision]
  affects: [app/(tabs)/meals.tsx, lib/recipe-import.ts]
tech_stack:
  added: []
  patterns: [Modal pageSheet, content blocks Claude Vision, multi-asset loop]
key_files:
  modified:
    - app/(tabs)/meals.tsx
    - lib/recipe-import.ts
decisions:
  - Append au texte existant (prev + '\n' + text) pour permettre plusieurs sessions dictaphone
  - Envoi groupé des photos dans un seul appel Claude Vision — pas d'appels séquentiels
  - selectionLimit fixé à 5 pour éviter dépasser les limites de tokens Claude
metrics:
  duration: "~2 minutes"
  completed: "2026-04-10"
  tasks_completed: 2
  files_modified: 2
---

# Phase quick-260410-qnr Plan 01: Dictaphone import texte + multi-photos recette

**One-liner:** Bouton micro dans le modal import texte recettes (DictaphoneRecorder pageSheet) + picker multi-photos (max 5) envoyées en un seul appel Claude Vision.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Ajouter le dictaphone dans le modal import texte | a100bf2 | app/(tabs)/meals.tsx |
| 2 | Multi-photos dans importRecipeFromPhoto | b89da14 | lib/recipe-import.ts |

## What Was Built

### Task 1 — Dictaphone dans modal import texte

- Import de `DictaphoneRecorder` dans `meals.tsx`
- State `showDictaphone` ajouté aux states `textImport` existants
- TextInput enveloppé dans une `View` row avec bouton micro 🎙️ (44x44, borderRadius 22) à droite
- Modal `DictaphoneRecorder` en `pageSheet` avec `context={{ title: 'Import recette', subtitle: '...' }}`
- `onResult` appends au texte existant (`prev ? prev + '\n' + text : text`) pour dicter en plusieurs sessions

### Task 2 — Multi-photos Claude Vision

- Picker modifié: `allowsMultipleSelection: true`, `selectionLimit: 5`
- Boucle sur tous les `assets`: resize si > 1568px → JPEG → base64
- Construction d'un array de `content blocks` image pour Claude Vision
- Prompt adapté: singulier pour 1 image, pluriel + instruction "combine" pour plusieurs
- `finally` nettoie tous les URIs temporaires dans `optimizedUris[]`

## Deviations from Plan

None — plan exécuté exactement comme écrit.

## Self-Check: PASSED

- `app/(tabs)/meals.tsx` modifié: FOUND
- `lib/recipe-import.ts` modifié: FOUND
- Commit a100bf2: FOUND
- Commit b89da14: FOUND
- `npx tsc --noEmit` passe sans erreur: VERIFIED
