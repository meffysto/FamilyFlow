---
phase: 51-ux-export-manuel-lulu
plan: 04
subsystem: ui-export-pdf
tags: [cleanup, docs, validation, quality-gate]
requires:
  - app/dev-deep-link.tsx (Phase 50 — carry-over tests deep links)
  - CLAUDE.md (racine — Stack/Architecture/Vault)
  - components/pdf, lib/pdf, app/impressions.tsx (Phases 51-01/02/03)
provides:
  - Quality gate Phase 51 (tsc + jest verts)
  - Documentation à jour pour futurs devs / agents
  - Écran dev-deep-link allégé (boutons PDF supprimés, deep links Phase 50 conservés)
affects:
  - app/dev-deep-link.tsx (suppression generatePdf + bouton PDF + imports/styles dead code)
  - CLAUDE.md (Stack + Architecture + Vault)
tech-stack:
  added: []
  patterns:
    - "Cleanup chirurgical : suppression de la fonction handler + bloc UI + imports orphelins + dead styles, sans toucher au gating __DEV__ ni aux tests Phase 50"
    - "Documentation alignée : mention explicite des libs natives ajoutées (expo-print, expo-sharing, qrcode, expo-clipboard) + dossiers nouveaux (lib/pdf/, components/pdf/, app/impressions.tsx) + structure vault 12 - Impressions/"
key-files:
  created:
    - .planning/phases/51-ux-export-manuel-lulu/51-04-SUMMARY.md
    - .planning/phases/51-ux-export-manuel-lulu/51-PHASE-SUMMARY.md
  modified:
    - app/dev-deep-link.tsx
    - CLAUDE.md
decisions:
  - "Cleanup `dev-deep-link.tsx` minimal : retrait uniquement des entry-points PDF redondants avec UI Phase 51 ; conservation totale des tests deep links Phase 50 (story/<id>, import-note, open/meals) et du fallback expo-clipboard → Share"
  - "CLAUDE.md : ajouts en place dans les sections existantes (Stack et Architecture) — pas de nouvelle section pour rester ciblé"
  - "Pas d'auto-commit final user-bound : working tree user en cours sur app/(tabs)/* + hooks/useVault.ts + components/FAB.tsx — n'inclure QUE les fichiers Phase 51 dans les commits"
metrics:
  duration_seconds: 240
  tasks_completed: 4
  files_created: 2
  files_modified: 2
  completed_date: 2026-05-05
---

# Phase 51 Plan 04 : Cleanup + docs + validation Summary

**One-liner :** Quality gate Phase 51 — `dev-deep-link.tsx` allégé, `CLAUDE.md` aligné sur l'architecture Phase 49+50+51, tsc et tests Phase 51 verts, checkpoint device formulé pour validation utilisateur.

## Objectif atteint

Sceller la Phase 51 avant TestFlight : suppression des entry-points PDF obsolètes du dev-screen (redondants avec l'écran "Mes impressions"), mise à jour de la documentation racine pour qu'elle reflète les libs natives et dossiers ajoutés, validation tsc + jest globale, rédaction des SUMMARY (51-04 + 51-PHASE).

## Tâches exécutées

| Task | Description                                                            | Commit     |
|------|------------------------------------------------------------------------|------------|
| 1    | Cleanup `app/dev-deep-link.tsx` (suppression boutons PDF)              | `d31e4ca1` |
| 2    | Mise à jour `CLAUDE.md` (Stack + Architecture + Vault)                 | `67d70c07` |
| 3    | Validation tsc + jest globale                                          | (no-op)    |
| 4    | Rédaction `51-04-SUMMARY.md` + `51-PHASE-SUMMARY.md`                   | (final)    |

## Cleanup `app/dev-deep-link.tsx`

**Lignes supprimées (89 lignes -, 22 lignes ajoutées via simplification du JSX) :**

- Fonction `generatePdf(story: BedtimeStory)` (handler async qui appelait `generateBookPdf` + `persistBookPdf` + Alert récapitulative)
- État local `const [pdfBusyId, setPdfBusyId] = useState<string | null>(null)`
- Bloc `<View style={styles.row}>` qui wrappait chaque histoire avec son bouton "PDF" → revert au `<Pressable>` simple sans wrapper
- `<PressableScale>` "PDF" + `ActivityIndicator` de chargement

**Imports retirés :**

- `useState` (plus nécessaire — état local PDF supprimé)
- `View`, `ActivityIndicator` depuis `react-native` (UI dead code)
- `generateBookPdf, persistBookPdf` depuis `../lib/pdf`
- `BedtimeStory` depuis `../lib/types`

**Styles retirés (dead code) :**

- `styles.row` (flexDirection row + gap — utilisé uniquement par le bloc PDF)
- `styles.flex` (`{ flex: 1, marginBottom: 0 }` — appliqué au Pressable dans le bloc row)
- `styles.pdfButton` (paddings + border — uniquement utilisé par le bouton PDF)

**Conservé intégralement :**

- Gating `if (!__DEV__) return <Indisponible/>` (ligne 60-67 originale)
- Tests deep links Phase 50 : section 1 (`story/<id>` + appui long pour copier ID), section 2 (id inexistant → toast 404), section 3 (`import-note` + `open/meals`)
- Fallback `copyToClipboard` (expo-clipboard si dispo, sinon `Share.share`) — pattern dev-only à conserver
- ScrollView, SafeAreaView, ModalHeader, bouton retour, note finale

## Mise à jour `CLAUDE.md`

**Section `## Stack` — 2 lignes ajoutées en fin de liste :**

```
- Génération PDF : `expo-print` ~15.0.8 + `expo-sharing` ~14.0.8 (Share Sheet iOS)
- QR codes : `qrcode` 1.5.4 + `expo-clipboard` ~8.0.8
```

**Section `## Architecture` — 4 lignes ajoutées (juste après `lib/vault-cache.ts`, avant `Vault recettes`) :**

- `lib/pdf/` (avec énumération des sous-modules : `pdf-generator.ts`, `book-storage.ts` + `buildVaultPdfUri`, `manifest-parser.ts`, `qr-generator.ts`, `html-template.ts`, `saga-detection.ts`, `text-splitter.ts`, `ornaments.ts`, `print-illustrations.ts`, `asset-loader.ts`, `constants.ts`, `types.ts`)
- `app/impressions.tsx` — écran "Mes impressions"
- `components/pdf/` — UI export (BookExportModal, PostExportView, LuluInstructionsModal, ExportCard)
- `Vault impressions : 12 - Impressions/PDFs/{id}-{date}.pdf + 12 - Impressions/manifeste.md`

**Sections NON touchées :** Conventions, Animations, Cache, Hiérarchie providers, Barrel files, Patterns de code, Testing, Project, Constraints, GSD Workflow, Developer Profile.

**Validation grep :** 5 lignes matchent `expo-print|expo-sharing|qrcode|expo-clipboard|lib/pdf|app/impressions|12 - Impressions` (couvre les 7 patterns demandés).

## Validation tsc + jest

### `npx tsc --noEmit`

Clean — aucune nouvelle erreur. Erreurs pré-existantes documentées dans CLAUDE.md (`MemoryEditor.tsx`, `cooklang.ts`, `hooks/useVault.ts`) inchangées.

### `npx jest --no-coverage`

- **2020 tests verts / 2037 totaux** sur 87 suites (83 passées, 4 pré-existantes échouées)
- **Tests Phase 51 verts (21 tests)** :
  - `components/pdf/__tests__/BookExportModal.state.test.ts` (8 tests reducer)
  - `lib/pdf/__tests__/book-storage.uri.test.ts` (3 tests `buildVaultPdfUri`)
  - `lib/pdf/__tests__/qr-generator.test.ts` (6 tests Phase 50)
  - `lib/__tests__/i18n.impressions.test.ts` (4 tests namespace)
- **Suites pré-existantes échouées (vérifiées sur `git stash` propre — non-régressions Phase 51)** :
  - `lib/__tests__/codex-content.test.ts`
  - `lib/__tests__/auberge-auto-tick.test.ts`
  - `hooks/__tests__/useVaultCourses.test.ts` (assertion sur courgettes — fragile pré-existant)
  - `lib/__tests__/insights.test.ts` (lucide-react-native + react-native-svg — config Jest, pré-existant)

### `console.*` hors `__DEV__`

`grep` sur `components/pdf/` + `app/impressions.tsx` → **7 occurrences `console.{log,warn}`, toutes encadrées par `if (__DEV__) { ... }`** :
- `app/impressions.tsx:81-84` (open error)
- `components/pdf/BookExportModal.tsx:151-154` (perf), `:163-166` (generation error), `:190-193` (preview error)
- `components/pdf/PostExportView.tsx:63-66` (save error), `:85-88` (preview error)
- `components/pdf/exportPhase.ts:87-93` (transition invalide)

Convention CLAUDE.md respectée à 100%.

## Checkpoint device — formulation utilisateur

12 points de vérification à exécuter sur device après `npx expo prebuild --clean` + `npx expo run:ios --device` (rebuild requis pour `expo-sharing` natif) :

1. Plus → Souvenirs → "Mes impressions" → écran liste (vide ou exports passés)
2. Tap "Nouveau livre" → choisir histoire → tap "Générer"
3. Phase generating → progression 4 étapes (assets/render/hash/print)
4. Phase ready → aperçu PDF natif iOS (QLPreviewController via `Print.printAsync`)
5. Tap "Continuer" → phase post-export avec haptic Medium + 3 boutons + titre "Et maintenant ?"
6. Tap "Sauvegarder le PDF" → iOS Share Sheet (ou fallback Linking si dev-client pas rebuild)
7. Tap "Voir le PDF" → QLPreviewController natif iOS
8. Tap "Commander chez Lulu" → sub-modal manuel FR 5 étapes → tap "Ouvrir Lulu Studio" → Safari sur `lulu.com/create/print-books/`
9. Tap "Terminé" → modal se ferme → retour écran "Mes impressions" → nouvelle entrée présente
10. Vérifier `12 - Impressions/manifeste.md` dans Obsidian iCloud → entrée frontmatter + table 5 colonnes mise à jour
11. **Carry-over Phase 50** : scan QR du PDF (page 4ème de couverture) → app s'ouvre + autoplay TTS de l'histoire
12. **Non-régression** : `app/dev-deep-link.tsx` (en mode `__DEV__`) ne propose PLUS de bouton "PDF" mais conserve `import-note` / `open/meals` / `story/<id>`

## Déviations du plan

Aucune déviation des règles 1-4. Plan exécuté tel que rédigé.

Note : les 4 suites Jest pré-existantes en échec ont été vérifiées via `git stash` (état propre pré-Phase-51) — confirmé non-liées à la Phase 51, documentées dans ce SUMMARY pour traçabilité.

## Critères de succès — checklist

- [x] `app/dev-deep-link.tsx` : grep `generateBookPdf|persistBookPdf` → 0 hits
- [x] `app/dev-deep-link.tsx` conserve gating `__DEV__` + tests deep links Phase 50
- [x] `CLAUDE.md` : Stack mentionne `expo-print`, `expo-sharing`, `qrcode`, `expo-clipboard`
- [x] `CLAUDE.md` : Architecture mentionne `lib/pdf/`, `app/impressions.tsx`, `components/pdf/`, structure vault `12 - Impressions/`
- [x] `npx tsc --noEmit` clean (hors pré-existantes)
- [x] Tests Phase 51 (21 cas) tous verts
- [x] Suites pré-existantes en échec confirmées non-régressions (`git stash` test propre)
- [x] Aucun `console.*` hors `__DEV__` dans code Phase 51
- [x] `51-04-SUMMARY.md` + `51-PHASE-SUMMARY.md` créés
- [ ] Checkpoint device — **à valider par l'utilisateur** (12 points formulés ci-dessus)

## Self-Check: PASSED

- FOUND: app/dev-deep-link.tsx (modifié, sans generateBookPdf/persistBookPdf)
- FOUND: CLAUDE.md (Stack + Architecture + Vault à jour)
- FOUND: d31e4ca1 (cleanup dev-deep-link)
- FOUND: 67d70c07 (docs CLAUDE.md)
