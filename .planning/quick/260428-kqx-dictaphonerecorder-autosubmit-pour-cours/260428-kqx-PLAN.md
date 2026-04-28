---
quick_id: 260428-kqx
title: DictaphoneRecorder autoSubmit pour courses
date: 2026-04-28
mode: quick
status: completed
---

# Plan 260428-kqx — DictaphoneRecorder autoSubmit

## Goal

Désactiver l'écran d'édition de transcription + le bouton « Résumer IA » pour le seul flow de saisie vocale courses. Le `VoiceCoursesReview` (créé en 260428-kda) prend le relais en aval, donc l'étape intermédiaire d'édition manuelle du transcript est redondante.

## Scope

- Composant : `components/DictaphoneRecorder.tsx`
- Point d'appel modifié : `app/(tabs)/meals.tsx:2695` (dictaphone courses uniquement)
- Hors scope : RDV, gratitude, recettes, dietary — gardent le comportement actuel.

## Tasks

### Task 1 — Ajouter prop `autoSubmit` à DictaphoneRecorder

**Files:** `components/DictaphoneRecorder.tsx`

- Étendre `DictaphoneRecorderProps` avec `autoSubmit?: boolean` + JSDoc FR.
- Déstructurer la prop dans la signature.
- Dans `finishRecording` : après calcul de `finalText`, si `autoSubmit && finalText.trim()` → appeler `onResult(finalText)` puis `onClose()` immédiatement. Le state passe par `done` mais l'utilisateur ne voit jamais l'écran (modal fermé sur frame suivante).
- Ajouter `autoSubmit, onResult, onClose` aux dépendances du `useCallback`.

**Verify:** `npx tsc --noEmit` clean (hors erreurs pré-existantes).

### Task 2 — Activer autoSubmit dans le flow courses

**Files:** `app/(tabs)/meals.tsx`

- Ligne ~2695 : ajouter la prop `autoSubmit` au `<DictaphoneRecorder>` du dictaphone courses (pas celui de l'import recette ligne ~2678).

**Verify:** lancement vocal → fin d'enregistrement → ouverture directe `VoiceCoursesReview` sans passage par l'écran d'édition.

## Why this is small

3 lignes ajoutées dans le composant + 1 prop dans le call site. Pas de logique conditionnelle nouvelle (le path summary reste inchangé, juste court-circuité via l'early return).
