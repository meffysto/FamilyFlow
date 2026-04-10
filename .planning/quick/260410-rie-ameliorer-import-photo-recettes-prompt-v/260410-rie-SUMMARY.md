---
phase: quick-260410-rie
plan: "01"
subsystem: recipe-import
tags: [recipe-import, vision-ai, photo-import, cooklang, ux]
dependency_graph:
  requires: []
  provides: [QUICK-RIE]
  affects: [meals.tsx, recipe-import.ts]
tech_stack:
  added: []
  patterns: [claude-vision-api, editable-preview, monospace-textinput]
key_files:
  created: []
  modified:
    - lib/recipe-import.ts
    - app/(tabs)/meals.tsx
decisions:
  - COOK_VISION_SYSTEM_PROMPT distinct du COOK_SYSTEM_PROMPT — évite de modifier le comportement des imports URL/texte existants
  - FontSize.caption utilisé (12px) à la place d'un hypothétique FontSize.xs qui n'existe pas dans les tokens du projet
metrics:
  duration: "~8 min"
  completed: "2026-04-10T17:53:58Z"
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 260410-rie: Améliorer import photo recettes — prompt vision OCR + preview éditable

**One-liner:** Import photo recettes via Claude Sonnet avec prompt OCR strict + TextInput monospace éditable avant sauvegarde.

## Objectif

L'import photo utilisait Haiku avec un prompt générique — les quantités étaient souvent approximées ou inventées. Cette tâche corrige cela en trois axes : modèle Sonnet, prompt OCR-spécifique, et prévisualisation éditable du contenu `.cook` avant validation.

## Tâches exécutées

### Tâche 1 — Prompt vision OCR + modèle Sonnet + max_tokens 4096

**Fichier:** `lib/recipe-import.ts`

- Ajout de `COOK_VISION_SYSTEM_PROMPT` (lignes 156-184) avec instructions OCR strictes : ne rien inventer, quantités exactes, `[illisible]` si illisible, lecture méthodique livre de cuisine
- Le nouveau prompt reprend les règles de format Cooklang du `COOK_SYSTEM_PROMPT` existant PLUS les instructions OCR
- `importRecipeFromPhoto()` : `claude-haiku-4-5-20251001` → `claude-sonnet-4-6-20250514`
- `max_tokens` : `2048` → `4096`
- `system` : `COOK_SYSTEM_PROMPT` → `COOK_VISION_SYSTEM_PROMPT`
- `COOK_SYSTEM_PROMPT` reste inchangé (utilisé par imports URL/texte)

**Commit:** f4cb386

### Tâche 2 — Preview éditable du contenu .cook avant validation

**Fichier:** `app/(tabs)/meals.tsx`

- Nouveau state `editableCookContent` (string, initialisé à `''`)
- `useEffect` sync `editableCookContent` depuis `importResult.data.cookContent` quand `importResult` change
- Dans la section preview du modal (`importResult.type === 'cook'`) : `TextInput multiline` éditable avec police monospace (`Platform.select({ ios: 'Menlo', default: 'monospace' })`), `minHeight: 200`, `maxHeight: 400`, `textAlignVertical: 'top'`, couleurs via `useThemeColors()`
- `handleImportSave` : utilise `editableCookContent || importResult.data.cookContent` — l'édition utilisateur est prioritaire
- `editableCookContent` ajouté dans le tableau de dépendances du `useCallback`
- Réinitialisation à `''` à la fermeture du modal et après sauvegarde réussie

**Commit:** 5b3a39b

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FontSize.xs inexistant remplacé par FontSize.caption**
- **Found during:** Tâche 2, vérification tsc
- **Issue:** Le plan spécifiait `FontSize.xs` qui n'existe pas dans les tokens du projet (`constants/typography.ts`). Le type `FontSize` ne contient pas de clé `xs`.
- **Fix:** Remplacement par `FontSize.caption` (12px) qui est le plus proche sémantiquement
- **Files modified:** `app/(tabs)/meals.tsx`
- **Commit:** 5b3a39b (correction incluse dans le même commit)

## Known Stubs

Aucun stub — toutes les fonctionnalités sont complètes et reliées.

## Self-Check: PASSED

- `lib/recipe-import.ts` modifié : FOUND
- `app/(tabs)/meals.tsx` modifié : FOUND
- Commit f4cb386 : FOUND (`feat(quick-rie-01): prompt vision OCR spécifique + modèle Sonnet + max_tokens 4096`)
- Commit 5b3a39b : FOUND (`feat(quick-rie-01): preview editable du contenu .cook avant validation`)
- `npx tsc --noEmit` : passe sans erreur
- `COOK_VISION_SYSTEM_PROMPT` dans recipe-import.ts : FOUND (ligne 156)
- `claude-sonnet-4-6-20250514` dans importRecipeFromPhoto : FOUND (ligne 681)
- `max_tokens: 4096` : FOUND (ligne 682)
- `editableCookContent` state et TextInput multiline dans meals.tsx : FOUND
- `handleImportSave` utilise `editableCookContent` : FOUND (ligne 755)
