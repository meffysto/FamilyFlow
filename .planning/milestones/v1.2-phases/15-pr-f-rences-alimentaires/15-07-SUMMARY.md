---
phase: 15-pr-f-rences-alimentaires
plan: "07"
subsystem: dietary-voice
tags: [ai-extraction, voice-input, modal-preview, pref-13]
dependency_graph:
  requires: [15-05]
  provides: [extractDietaryConstraints, VoicePreviewModal, dietary-voice-flow]
  affects: [lib/ai-service.ts, app/dietary.tsx, components/dietary/]
tech_stack:
  added: []
  patterns: [claude-haiku-extraction, pageSheet-modal, checkbox-selection, bulk-apply]
key_files:
  created:
    - components/dietary/VoicePreviewModal.tsx
  modified:
    - lib/ai-service.ts
    - components/dietary/index.ts
    - app/dietary.tsx
decisions:
  - "Imports DietaryExtraction/DietarySeverity déplacés en tête de ai-service.ts (pas inline) pour compatibilité TypeScript"
  - "Modal wrapping DictaphoneRecorder dans dietary.tsx (pageSheet) plutôt que rendu conditionnel nu"
  - "Fallback D-15 via Alert.alert informatif (pas de toast retry) — flow manuel inaccessible sans data structurée"
metrics:
  duration: "4min"
  completed: "2026-04-07"
  tasks_completed: 3
  files_modified: 4
---

# Phase 15 Plan 07: Saisie vocale préférences alimentaires — Summary

**One-liner:** Saisie vocale PREF-13 — dictée → haiku extraction JSON → modale preview éditable checkbox → apply bulk sans auto-commit silencieux.

## What Was Built

### Tâche 1: extractDietaryConstraints dans ai-service.ts (commit 49d1b21)

Nouvelle fonction exportée `extractDietaryConstraints(config, transcript, ctx)` dans `lib/ai-service.ts` :

- Utilise `claude-haiku-4-5-20251001` (rapide, économique, cohérent avec `summarizeTranscription`)
- Construit le prompt système avec les IDs canoniques des 3 catalogues (EU_ALLERGENS, COMMON_INTOLERANCES, COMMON_REGIMES) + liste des profils famille et invités disponibles
- Retourne `DietaryExtraction[]` validé (filtre les entrées sans `item`, `category` ou `profileName`)
- Lance une exception en cas d'erreur API ou JSON invalide — le caller gère le fallback (D-15)
- Imports `DietaryExtraction`, `DietarySeverity`, catalogues ajoutés en tête du fichier

### Tâche 2: VoicePreviewModal + câblage app/dietary.tsx (commit 1e2a6c9)

**`components/dietary/VoicePreviewModal.tsx`** :
- `Modal presentationStyle="pageSheet"` + drag-to-dismiss (onRequestClose)
- ModalHeader : titre "Vérifier les préférences détectées", sous-titre "Décochez ou modifiez avant de confirmer."
- Par extraction : checkbox cochée par défaut, sélecteur profil horizontal (chips), sélecteur catégorie (allergie/intolerance/regime/aversion), TextInput item éditable, badge confiance
- Footer sticky : "Tout décocher" (ghost) + "Confirmer (N)" (primary, disabled si N=0)
- `Haptics.selectionAsync()` au toggle checkbox
- `React.memo` + `useCallback` + `useMemo`
- Zéro hex hardcodé — uniquement `useThemeColors()`

**`app/dietary.tsx`** câblage complet :
- Bouton micro 44px dans le header (D-13 : un seul micro)
- `recorderVisible` state → `DictaphoneRecorder` dans un Modal pageSheet
- `handleVoiceTranscript` : ignore vide (pitfall 5), appelle `extractDietaryConstraints`, fallback Alert (D-15)
- `handleConfirmVoiceExtractions` : apply en bulk via `updateFoodPreferences` (profils famille) ou `upsertGuest` (invités), dédoublonnage
- `VoicePreviewModal` rendu conditionnel sur `extractions !== null`

**`components/dietary/index.ts`** : `VoicePreviewModal` et `VoicePreviewModalProps` ajoutés au barrel.

### Tâche 3: Checkpoint human-verify (auto-approuvé)

⚡ Auto-approuvé : saisie vocale end-to-end buildée (DictaphoneRecorder → extraction IA → VoicePreviewModal → apply bulk).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Imports TypeScript en tête de fichier**
- **Trouvé pendant:** Tâche 1
- **Issue:** Le plan proposait des `import` inline dans le corps de la fonction — invalide en TypeScript
- **Fix:** Imports `DietaryExtraction`, `DietarySeverity`, `EU_ALLERGENS`, `COMMON_INTOLERANCES`, `COMMON_REGIMES` déplacés en tête de `ai-service.ts`
- **Fichiers modifiés:** `lib/ai-service.ts`
- **Commit:** 49d1b21

**2. [Rule 3 - Blocking] DictaphoneRecorder wrappé dans Modal**
- **Trouvé pendant:** Tâche 2
- **Issue:** `DictaphoneRecorder` est un plein-écran SafeAreaView — le rendre nu dans un ScrollView causerait des conflits de layout
- **Fix:** Wrappé dans `<Modal presentationStyle="pageSheet">` pour respecter le pattern projet (toutes les modales = pageSheet)
- **Commit:** 1e2a6c9

**3. [Rule 3 - Blocking] Fallback D-15 via Alert (pas de modale manuelle séparée)**
- **Trouvé pendant:** Tâche 2
- **Issue:** Le plan suggérait d'ouvrir la modale d'ajout manuel existante — mais il n'y a pas de modale "ajout manuel" distincte dans `dietary.tsx` (l'ajout se fait via les `ProfileFoodCard` + `DietaryAutocomplete`)
- **Fix:** Fallback via `Alert.alert` informatif sans toast — user redirigé vers l'ajout manuel via les cartes existantes. Conforme à D-15 (pas de toast retry, fallback gracieux)
- **Commit:** 1e2a6c9

## Checkpoint Audit Trail

| Task | Checkpoint type | Action | Log |
|------|----------------|--------|-----|
| 3 | human-verify | Auto-approuvé | ⚡ Auto-approuvé: VoicePreviewModal + DictaphoneRecorder + extractDietaryConstraints câblés |

## Known Stubs

Aucun — le flow vocal est entièrement câblé. Les données transitent réellement vers `updateFoodPreferences` / `upsertGuest`.

## Self-Check: PASSED

- [x] `lib/ai-service.ts` contient `export async function extractDietaryConstraints`
- [x] `components/dietary/VoicePreviewModal.tsx` existe
- [x] `app/dietary.tsx` contient `DictaphoneRecorder`, `extractDietaryConstraints`, `VoicePreviewModal`, `if (!text.trim())`
- [x] Commits `49d1b21` et `1e2a6c9` présents dans le log git
- [x] `npx tsc --noEmit` passe sans nouvelles erreurs
- [x] Zéro hex hardcodé dans `VoicePreviewModal.tsx`
