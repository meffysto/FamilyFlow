---
phase: 51-ux-export-manuel-lulu
plan: 01
subsystem: ui-export-pdf
tags: [export, pdf, modal, state-machine, lulu]
requires:
  - lib/pdf (Phase 49 — generateBookPdf, persistBookPdf, LULU_FORMAT_LABEL, PAGE_COUNT)
  - contexts/VaultContext (vault, stories)
  - contexts/ThemeContext (useThemeColors)
  - components/ui/ModalHeader
provides:
  - BookExportModal (Modal pageSheet 4 phases)
  - exportPhaseReducer (state machine pure testable)
  - components/pdf barrel
affects:
  - jest.config.js (ajout components/ aux roots — sinon tests components/pdf non découverts)
tech-stack:
  added: []  # aucune dépendance npm ajoutée — Print.printAsync déjà installé
  patterns:
    - "useReducer + state machine discriminée pour modal multi-phase"
    - "Cascade setTimeout pour simulation perçue d'étapes pendant async réel"
    - "t(key, { defaultValue: 'FR' }) pour namespace pas encore créé"
key-files:
  created:
    - components/pdf/exportPhase.ts
    - components/pdf/BookExportModal.tsx
    - components/pdf/index.ts
    - components/pdf/__tests__/BookExportModal.state.test.ts
  modified:
    - jest.config.js
decisions:
  - "Option A retenue (modal unique 4 phases) — pas de nesting Modal/Modal cf RESEARCH §4"
  - "Print.printAsync({ uri }) pour aperçu natif iOS — zéro rebuild, zéro dep"
  - "Phase post-export rendu null avec TODO 51-03 — branchement onSuccess existe déjà"
  - "Jest roots étendu à components/ — Rule 3 (blocking issue) — sans ça les tests ne tournent pas"
metrics:
  duration_seconds: 266
  tasks_completed: 2
  files_created: 4
  files_modified: 1
  completed_date: 2026-05-05
---

# Phase 51 Plan 01 : BookExportModal Summary

**One-liner :** State machine 4 phases + aperçu PDF natif via `Print.printAsync` — brique UX centrale sans dépendance native ajoutée.

## Objectif atteint

Création du composant `BookExportModal` (Modal pageSheet drag-to-dismiss) qui orchestre l'export d'un livre PDF en 4 phases pilotées par un reducer pur. Le composant est prêt à être consommé par l'écran "Mes impressions" (Plan 51-02) et étendu pour la phase post-export (Plan 51-03).

## Tâches exécutées

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Reducer pur + 8 tests Jest + barrel | `0cd43b61` |
| 2 | BookExportModal (3 phases UI : select / generating / ready) | `0a2d901d` |

## Décisions de design

### State machine vs nesting Modal — Option A retenue
Une seule `<Modal>` avec rendu conditionnel par `phase.kind`. Pas de Modal imbriqué (RESEARCH §4 anti-pattern : drag-to-dismiss perdu sur le parent quand l'enfant est ouvert). Conséquence : la phase `post-export` (rendu UI ajouté en 51-03) vit DANS le même `<Modal>`, ce qui garantit la cohérence d'animation et drag.

### Aperçu PDF — `Print.printAsync({ uri })` vs alternatives
- ✗ `react-native-pdf` : Pods natifs, rebuild dev-client requis, +1MB bundle
- ✗ WebView base64 data URI : limite iOS WKWebView ~5MB, +33% mémoire
- ✓ `Print.printAsync({ uri })` : déjà installé (Phase 49), QLPreviewController natif iOS, zéro rebuild, gère nativement les PDFs lourds, AirPrint en bonus

Sur Android, fallback `Linking.openURL(uri)` (Print.printAsync existe mais ouvre le dialog d'impression Google Cloud Print, moins approprié pour un aperçu).

### i18n — `defaultValue` FR pendant que le namespace n'existe pas encore
Le namespace `impressions` est créé en Plan 51-03. En attendant, chaque `t('impressions.export.modal.foo')` reçoit un `defaultValue` FR explicite. Avantage : l'UI est utilisable en 51-02 sans attendre 51-03, et la migration vers le JSON ne change rien aux clés référencées.

### Cascade STEP_ADVANCE simulée
La génération réelle (`generateBookPdf`) est un seul `await` ; on ne peut pas instrumenter en interne sans réécrire la lib. RESEARCH §7 Approche A : on simule visuellement les 4 étapes (assets 1500ms / render 800ms / hash 200ms / print 2000ms) via setTimeout en parallèle de l'await réel. Cleanup avec `cancelled` flag + `clearTimeout` au démontage.

## Branchements posés

### Pour Plan 51-02 (écran "Mes impressions")
- Importer : `import { BookExportModal } from '../components/pdf'`
- Props : `<BookExportModal visible={open} onClose={() => setOpen(false)} onSuccess={(uri, title) => { /* fermer + refresh manifeste */ }} />`
- Optionnel : passer `story={preselectedStory}` pour entry-point contextuel futur

### Pour Plan 51-03 (post-export + i18n)
- Rendu UI de la phase `post-export` : remplacer le bloc `{phase.kind === 'post-export' && null}` par les 3 actions (Sauvegarder via expo-sharing, Voir le PDF, Commander chez Lulu + LuluInstructionsModal)
- Créer `locales/fr/impressions.json` avec les clés référencées :
  - `impressions.export.modal.selectTitle`
  - `impressions.export.modal.generating.title` + `.hint` + `.step.{assets|render|hash|print}`
  - `impressions.export.modal.ready.title` + `.format` + `.pages` + `.duration` + `.preview` + `.continue`
  - `impressions.export.modal.postExport.title`
  - `impressions.export.modal.empty` + `.generateCta`
  - `impressions.errors.generationTitle` + `.generationBody`
- Enregistrer le namespace dans `lib/i18n.ts`
- Hapt Medium au mount de la phase `post-export` (RESEARCH §6)

## Pitfalls anticipés (et mitigés)

| Pitfall | Source | Mitigation |
|---------|--------|------------|
| Drag-to-dismiss pendant génération | RESEARCH Pitfall 7 | `onRequestClose={phase.kind === 'generating' ? () => {} : onClose}` + `onClose` masqué dans `<ModalHeader>` |
| Aperçu PDF cross-platform | RESEARCH Pitfall 3 | Branche `Platform.OS === 'ios'` → `Print.printAsync` ; sinon `Linking.openURL` |
| Logs perf en prod | T-51-01-03 (threat model) | `if (__DEV__) console.log(...)` partout, métriques masquées en release |
| Reset entre ouvertures | (pas dans plan) | `useEffect([visible])` qui dispatche `RESET` à chaque réouverture pour éviter de revenir sur un état `ready` périmé |

## Déviations du plan

### Auto-fixées (Rules 1-3)

**1. [Rule 3 - Blocking] Étendre les roots Jest à `components/`**
- **Trouvé pendant :** Task 1 (avant écriture des tests)
- **Issue :** `jest.config.js` n'incluait que `lib/` et `hooks/` dans `roots` → tests dans `components/pdf/__tests__/` jamais découverts
- **Fix :** ajout de `'<rootDir>/components'` à la liste `roots`
- **Fichiers modifiés :** `jest.config.js`
- **Commit :** `0cd43b61`

**2. [Rule 1 - Bug] Symbole `Typography` inexistant dans le projet**
- **Trouvé pendant :** Task 2 (tsc errors)
- **Issue :** Le plan référence `Typography.h2` mais le projet expose `FontSize` + `FontWeight` (cf. `constants/typography.ts`)
- **Fix :** import `{ FontSize, FontWeight } from '../../constants/typography'` (pattern conforme à `app/dev-deep-link.tsx`)
- **Commit :** `0a2d901d`

**3. [Rule 1 - Bug] Clés `colors.surface` et `FontSize.base/xl` inexistantes**
- **Trouvé pendant :** Task 2 (tsc errors)
- **Issue :** Le plan référence `colors.surface`, `FontSize.base`, `FontSize.xl` qui n'existent pas (réelles clés : `colors.card`, `FontSize.body`, `FontSize.title`)
- **Fix :** mapping vers les clés réelles du design system
- **Commit :** `0a2d901d`

**4. [Rule 1 - Bug] Type `result.entry` est `Omit<BookManifestEntry, 'chemin'>`, pas `BookManifestEntry`**
- **Trouvé pendant :** Task 2 (revue lib/pdf/pdf-generator.ts)
- **Issue :** Le plan suggère de dispatcher `result.entry` comme `BookManifestEntry`, mais le type retourné par `generateBookPdf` n'a pas encore le `chemin` (rempli par `persistBookPdf`)
- **Fix :** dispatcher `persisted` (retour de `persistBookPdf`, type complet) au lieu de `result.entry`
- **Commit :** `0a2d901d`

## Tests

### Jest (8 tests, tous verts)
```
exportPhaseReducer
  ✓ select + START_GENERATION → generating { step: assets }
  ✓ generating + STEP_ADVANCE { render } → generating { step: render }
  ✓ generating + GENERATION_DONE → ready avec uri/perfMs/entry
  ✓ ready + GO_POST_EXPORT → post-export
  ✓ post-export + RESET → select
  ✓ select + STEP_ADVANCE → état inchangé (transition invalide)
  ✓ generating + GENERATION_ERROR → retour à select
  ✓ reducer ne mute pas l'état entrant
```

### Type-check
`npx tsc --noEmit` clean (hors pré-existantes : `MemoryEditor.tsx`, `cooklang.ts`, `hooks/useVault.ts`).

## Critères de succès — checklist

- [x] `components/pdf/BookExportModal.tsx`, `components/pdf/exportPhase.ts`, `components/pdf/index.ts` créés
- [x] Tests Jest state machine verts (8 cas, > 6 minimum)
- [x] `npx tsc --noEmit` clean (hors pré-existantes)
- [x] Aucune dépendance native ajoutée (`react-native-pdf` absent)
- [x] Composant prêt à être consommé par `app/impressions.tsx` (Plan 51-02)
- [x] Phase post-export branchable en 51-03 sans toucher au reducer

## Self-Check: PASSED

- FOUND: components/pdf/exportPhase.ts
- FOUND: components/pdf/BookExportModal.tsx
- FOUND: components/pdf/index.ts
- FOUND: components/pdf/__tests__/BookExportModal.state.test.ts
- FOUND: 0cd43b61 (test reducer + tests)
- FOUND: 0a2d901d (BookExportModal feat)
