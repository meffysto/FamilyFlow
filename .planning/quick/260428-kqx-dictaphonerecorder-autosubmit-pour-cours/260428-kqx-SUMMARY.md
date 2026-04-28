---
quick_id: 260428-kqx
date: 2026-04-28
status: completed
---

# Summary 260428-kqx — DictaphoneRecorder autoSubmit

## What changed

**`components/DictaphoneRecorder.tsx`**
- Nouvelle prop optionnelle `autoSubmit?: boolean` avec JSDoc.
- Déstructuration mise à jour.
- Dans `finishRecording` : early-return `onResult(finalText) + onClose()` quand `autoSubmit && finalText.trim()`. Dépendances du `useCallback` étendues.

**`app/(tabs)/meals.tsx`**
- Dictaphone du flow courses (ligne ~2695) reçoit `autoSubmit`. Le dictaphone d'import recette (ligne ~2678) n'est PAS modifié — il garde l'édition + résumé IA.

## Behavior change

Avant : enregistrement → écran d'édition transcript + bouton « Résumer » + bouton « Utiliser le texte brut » → user clique → VoiceCoursesReview.

Après (courses uniquement) : enregistrement → fin → VoiceCoursesReview directement. Si transcription vide, le modal reste ouvert sur l'écran d'enregistrement (rien ne se ferme).

## Out of scope

- RDV, gratitude, recettes, dietary : flow inchangé.
- Pas de migration des emojis ✕/✓/▼ de ReceiptReview/DictaphoneRecorder.

## Validation

`npx tsc --noEmit` ✅ (erreurs pré-existantes documentées exclues).
