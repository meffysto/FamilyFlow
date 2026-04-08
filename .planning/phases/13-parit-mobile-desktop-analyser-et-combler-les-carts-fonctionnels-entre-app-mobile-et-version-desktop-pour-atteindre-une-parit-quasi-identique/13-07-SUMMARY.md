---
phase: 14-parite-mobile-desktop
plan: 07
subsystem: ui
tags: [desktop, budget, ocr, claude-vision, drag-drop, react, typescript, tauri]

# Dependency graph
requires:
  - phase: 14-parite-mobile-desktop-01
    provides: VaultContext desktop avec readFile/writeFile, Budget.tsx CRUD existant
provides:
  - Budget desktop avec OCR de reçus : drag & drop image, upload fichier, scan Claude Vision, review items détectés
affects:
  - Settings page (future: ajout UI pour configurer la clé API Claude)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - OCR pipeline web: FileReader.readAsDataURL() → base64 → scanReceiptImage(@family-vault/core)
    - Clé API Claude stockée dans localStorage('familyflow_claude_api_key')
    - ReceiptDropZone composant inline dans page Budget — drag/drop + input[type=file]
    - ReceiptReview modal avec items éditables (label/montant/catégorie) + checkboxes

key-files:
  created: []
  modified:
    - apps/desktop/src/pages/Budget.tsx
    - apps/desktop/src/pages/Budget.css

key-decisions:
  - "FileReader (web API) utilisé à la place d'expo-file-system — desktop est Tauri/web, pas React Native"
  - "Clé API Claude dans localStorage('familyflow_claude_api_key') — pas de SecureStore sur desktop"
  - "i18next non installé sur desktop — textes OCR en français inline (D-07 reporté, aucune page desktop n'utilise useTranslation)"
  - "scanReceiptImage importé depuis @family-vault/core — déjà exporté, pas besoin de chemin relatif"
  - "Modal ReceiptReview séparé du modal AddExpense — deux flows distincts"

patterns-established:
  - "Pattern OCR desktop: fileToBase64 (FileReader) → scanReceiptImage(@family-vault/core) → setScanResult → Modal ReceiptReview"
  - "Pattern clé API desktop: localStorage.getItem(CLAUDE_API_KEY) avec message utilisateur si absente"

requirements-completed: [PAR-01, PAR-02]

# Metrics
duration: 10min
completed: 2026-04-05
---

# Phase 14 Plan 07: OCR Reçus Budget Desktop Summary

**OCR reçus dans le budget desktop : zone drag & drop image + upload, pipeline Claude Vision via scanReceiptImage(@family-vault/core), modal de review des articles détectés avec édition inline avant sauvegarde**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-05T09:04:49Z
- **Completed:** 2026-04-05T09:15:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- ReceiptDropZone : zone drag & drop d'images + bouton "Choisir un fichier" avec input[type=file]
- Pipeline OCR complet : FileReader base64 → scanReceiptImage(@family-vault/core) → résultat structuré
- Modal ReceiptReview : liste items éditables (label, montant, catégorie) avec checkboxes pour ignorer des articles
- handleReceiptConfirm : ajout de tous les items confirmés via handleAddExpense existant (date du reçu conservée)
- Styles CSS complets : .receipt-drop-zone, .drag-over, .upload-btn, .receipt-item-row, .receipt-review-actions

## Task Commits

1. **Task 1: Zone drag & drop + upload + ReceiptReview dans Budget.tsx** - `df1558d` (feat)

## Files Created/Modified
- `apps/desktop/src/pages/Budget.tsx` — ajout ReceiptDropZone, ReceiptReview, fileToBase64, handleReceiptFile, handleReceiptConfirm, état OCR
- `apps/desktop/src/pages/Budget.css` — styles OCR : receipt-drop-zone, drag-over, upload-btn, receipt-items-list, receipt-item-row, receipt-review

## Decisions Made
- FileReader web API (pas expo-file-system) car le desktop est Tauri/web, pas React Native
- Clé API Claude dans `localStorage('familyflow_claude_api_key')` — pas de SecureStore sur desktop ; message d'erreur clair si absente
- `scanReceiptImage` importé depuis `@family-vault/core` directement — déjà exporté dans le barrel, pas besoin de chemin relatif vers `lib/ai-service.ts`
- i18next non ajouté (D-07 reporté) — aucune page desktop existante n'utilise useTranslation, ajout de la dépendance serait une tâche dédiée

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FileReader remplace expo-file-system/FileSystem pour la conversion base64**
- **Found during:** Task 1 (analyse des dépendances disponibles sur desktop)
- **Issue:** Le plan suggérait `readAsDataURL` (FileReader) mais aussi mentionnait `expo-file-system` comme alternative — sur desktop Tauri/web seul FileReader est disponible
- **Fix:** Utilisation exclusive de FileReader (web standard), conforme au code suggéré dans le plan
- **Files modified:** apps/desktop/src/pages/Budget.tsx
- **Verification:** tsc --noEmit passe, FileReader est disponible nativement en environnement web
- **Committed in:** df1558d (Task 1 commit)

**2. [Rule 1 - Bug] useTranslation non ajouté (D-07) — i18next absent du desktop**
- **Found during:** Task 1 (vérification dépendances desktop)
- **Issue:** L'acceptance criteria demande `useTranslation` depuis `react-i18next`, mais `react-i18next` n'est pas installé dans `apps/desktop/package.json` et aucune page desktop n'utilise i18next
- **Fix:** Textes OCR en français inline (cohérent avec toutes les pages existantes du desktop). L'ajout de i18next nécessite une tâche dédiée d'initialisation
- **Files modified:** N/A
- **Verification:** tsc --noEmit passe sans erreur
- **Committed in:** df1558d

---

**Total deviations:** 2 auto-analysées (1 adaptation plateforme, 1 dépendance manquante i18next reportée)
**Impact sur le plan:** Fonctionnalité OCR complète livraison. Seul D-07 (i18next) est absent — non bloquant pour l'OCR.

## Issues Encountered
- Aucun

## Known Stubs
Aucun stub — la fonctionnalité OCR est complètement câblée. Note : la clé API doit être configurée dans localStorage sous `familyflow_claude_api_key`. Une UI de configuration dans Settings est recommandée pour un plan futur.

## Next Phase Readiness
- Budget desktop a maintenant le même pipeline OCR que le mobile (per D-04)
- Plans parallèles wave 2 non affectés (14-02 à 14-09)
- Settings page pourrait être enrichie d'un champ "Clé API Claude" pour configurer familyflow_claude_api_key

---
*Phase: 14-parite-mobile-desktop*
*Completed: 2026-04-05*
