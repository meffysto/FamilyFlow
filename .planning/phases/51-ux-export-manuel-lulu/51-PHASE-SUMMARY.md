---
phase: 51-ux-export-manuel-lulu
type: phase-summary
tags: [export, pdf, lulu, ux, post-export, i18n, manifeste]
requires:
  - Phase 49 (lib/pdf — generateBookPdf, persistBookPdf, manifest-parser)
  - Phase 50 (QR audio + deep links — carry-over scan PDF)
provides:
  - Pipeline UX export PDF complet (4 phases : sélection / génération / aperçu / post-export)
  - Écran "Mes impressions" + manifeste vault auto-mis à jour
  - Manuel Lulu FR pas-à-pas (sub-modal + CTA web)
  - Namespace i18n `impressions` (FR strict + EN mirror)
plans:
  - 51-01-PLAN.md → 51-01-SUMMARY.md
  - 51-02-PLAN.md → 51-02-SUMMARY.md
  - 51-03-PLAN.md → 51-03-SUMMARY.md
  - 51-04-PLAN.md → 51-04-SUMMARY.md
tech-stack:
  added:
    - "expo-sharing ~14.0.8"
  reused:
    - "expo-print ~15.0.8 (Phase 49)"
    - "qrcode 1.5.4 (Phase 50)"
    - "expo-clipboard ~8.0.8 (Phase 50)"
  patterns:
    - "State machine reducer pour modals multi-phases (useReducer + actions discriminées)"
    - "Cascade STEP_ADVANCE simulée (setTimeout en parallèle d'await réel) — UX 4 étapes"
    - "Lazy import natif + fallback Linking (résilience rebuild dev-client)"
    - "Sub-modal pageSheet séparé (pas nested Modal) — drag-to-dismiss préservé"
    - "Édit minimal sur fichiers user en cours (more.tsx : 2 lignes ajoutées, zéro refacto)"
    - "Wrapper public typé sur logique privée (buildVaultPdfUri ↔ buildVaultUriFromPath)"
    - "ExportCard memoïsé + handler useCallback (perf liste)"
    - "i18n FR strict + EN mirror identique (projet FR-only, EN anti-crash i18next)"
metrics:
  duration_seconds: 1526  # 266 + 480 + 540 + 240
  plans_completed: 4
  files_created: 14       # 4 + 3 + 5 + 2
  files_modified: 11      # 1 + 6 + 6 + 2 (recoupements modaux comptés une fois par plan)
  tests_added: 21         # 8 reducer + 3 buildVaultPdfUri + 4 i18n + 6 qr (préservés Phase 50)
  completed_date: 2026-05-05
---

# Phase 51 — UX export manuel Lulu — Phase Summary

**One-liner :** Branchement complet du pipeline PDF Phase 49 + QR Phase 50 dans une UX utilisable : écran "Mes impressions" → modal export 4 phases → 3 actions post-export → manuel Lulu FR — zéro nouvelle dépendance lourde, tout en respectant le working tree user en cours.

## Objectif phase

Phase 49 a livré le pipeline `generateBookPdf` + `persistBookPdf` + manifeste. Phase 50 a livré les QR audio + deep links `family-vault://story/<id>`. **Phase 51 a pour mission de transformer ces briques en UX consommable** : un endroit où l'utilisateur peut générer, sauvegarder, prévisualiser un livre, et savoir comment l'imprimer chez Lulu — sans toucher à la pipeline existante.

Contraintes respectées :
- **Stack non-cassante** : seul `expo-sharing ~14.0.8` ajouté (lib native légère, lazy-importée)
- **Working tree user en cours** : `app/(tabs)/*`, `hooks/useVault.ts`, `components/FAB.tsx` jamais touchés ; édit `more.tsx` strictement minimal (2 lignes)
- **Compatibilité vault** : aucune modification du format `manifeste.md` ou des PDFs (réutilise Phase 49)
- **i18n FR strict** : 50+ clés ajoutées dans namespace `impressions`, zéro chaîne UI hardcodée

## Plans livrés

### Plan 51-01 — BookExportModal state machine + aperçu PDF

**Livré :** `components/pdf/BookExportModal.tsx` (Modal pageSheet drag-to-dismiss) + `components/pdf/exportPhase.ts` (reducer pur 4 phases : `select` / `generating` / `ready` / `post-export`) + barrel `components/pdf/index.ts` + 8 tests Jest reducer + extension `jest.config.js` roots `components/`.

**Décisions clés :**
- Option A retenue : modal unique 4 phases (vs nesting Modal) — évite l'anti-pattern drag-to-dismiss perdu
- Aperçu PDF via `Print.printAsync({ uri })` natif iOS — zéro dep, zéro rebuild, gère AirPrint
- Cascade STEP_ADVANCE simulée (4 setTimeout en parallèle de l'await réel) pour UX perçue 4 étapes

**Commits :** `0cd43b61`, `0a2d901d`

### Plan 51-02 — Écran "Mes impressions" + ExportCard + buildVaultPdfUri

**Livré :** `app/impressions.tsx` (écran route hors-tabs avec liste cards + pull-to-refresh + CTA "Nouveau livre") + `components/pdf/ExportCard.tsx` (item memoïsé) + `lib/pdf.buildVaultPdfUri` (API publique typée) + 3 tests Jest URI + row dans `more.tsx` (catégorie Souvenirs) + Stack.Screen enregistré.

**Décisions clés :**
- Layout cards verticales scrollables (vs table/timeline) — cohérent avec le reste de l'app, gestion histoires supprimées plus lisible
- `buildVaultPdfUri` = wrapper public sur logique privée renommée `buildVaultUriFromPath` (pas de duplication, types `BookManifestEntry` côté API)
- Édit `more.tsx` STRICTEMENT minimal : `+1` import lucide (`Printer`), `+1` entrée `menuItems` — `git diff --stat` montre `2 ++`

**Commits :** `fd585149`, `a2cc0ae8`, `e9931692`

### Plan 51-03 — Post-export 3 actions + manuel Lulu FR + i18n

**Livré :** `components/pdf/PostExportView.tsx` (3 actions Sauvegarder/Voir/Lulu + Terminé + haptic Medium au mount) + `components/pdf/LuluInstructionsModal.tsx` (sub-modal pageSheet 5 étapes FR + CTA Lulu) + `locales/{fr,en}/impressions.json` (50+ clés) + namespace registration `lib/i18n.ts` + 4 tests Jest namespace.

**Décisions clés :**
- `expo-sharing` lazy import + try/catch + fallback `Linking.openURL` (résilience rebuild dev-client en cours)
- Sub-modal séparé pour Lulu (pas nested) — drag-to-dismiss du parent préservé
- `onSuccess` déplacé de `handleContinue` à `handleDone` — l'écran parent rafraîchit le manifeste UNE SEULE FOIS, après que l'utilisateur a profité des 3 actions
- Specs Lulu retenues : 8.5″×8.5″, Saddle Stitch ≤ 16 pages OU Perfect Bound > 16, 80# White Coated
- `LULU_URL` constante module (pas d'interpolation user-input, threat T-51-03-01)
- EN mirror = copie FR strict (projet FR-only, EN anti-crash i18next)

**Commits :** `fa1336bf`, `558be68d`

### Plan 51-04 — Cleanup dev-deep-link + docs CLAUDE.md + validation

**Livré :** `app/dev-deep-link.tsx` allégé (suppression `generatePdf` + bouton PDF + imports/styles dead code) + `CLAUDE.md` racine à jour (Stack + Architecture + Vault) + validation tsc/jest globale + checkpoint device formulé pour utilisateur.

**Décisions clés :**
- Cleanup chirurgical : retrait uniquement des entry-points PDF redondants ; conservation totale tests deep links Phase 50 (story/<id>, import-note, open/meals)
- CLAUDE.md : ajouts en place dans sections existantes (pas de nouvelle section)

**Commits :** `d31e4ca1`, `67d70c07`

## Patterns établis (réutilisables future phases)

1. **State machine reducer pour modals multi-phases** — pattern propre, testable, transitions discriminées par TS, pas de `if/else` enchevêtrés dans le JSX
2. **Cascade STEP_ADVANCE simulée pour UX perçue** — quand on ne peut pas instrumenter une lib externe, simuler les étapes en parallèle de l'await réel donne une UX 4 étapes lisible sans réécrire la lib
3. **Lazy import natif + fallback Linking** — résilience pendant rebuild dev-client (en cours côté utilisateur), permet de livrer sans bloquer
4. **Édit minimal sur fichiers user en cours** — `git diff --stat` doit être chirurgical, jamais de `git checkout -- file` blanket, jamais de reformat opportuniste
5. **Wrapper public typé sur logique privée** — éviter de dupliquer la logique en exposant juste un wrapper qui délègue, avec types métier propres côté API
6. **ExportCard memoïsé + handler useCallback** — perf liste, évite re-render des cards quand le parent re-render
7. **i18n FR strict + EN mirror identique** — projet FR-only, EN sert juste à éviter crash i18next, pas de traduction réelle à maintenir
8. **Sub-modal pageSheet séparé (pas nested Modal)** — drag-to-dismiss préservé sur le parent, pattern à réutiliser pour tout sous-flow modal

## Pitfalls évités (documentés pour future phases)

| Pitfall                                                  | Mitigation Phase 51                                                |
|----------------------------------------------------------|--------------------------------------------------------------------|
| Drag-to-dismiss perdu pendant génération                 | `onRequestClose={generating ? noop : onClose}` + onClose masqué    |
| Aperçu PDF cross-platform                                | Branche `Platform.OS === 'ios'` → `Print.printAsync` ; sinon `Linking.openURL` |
| Logs perf en prod                                        | Tous les `console.*` sous `if (__DEV__)`                            |
| Reset entre ouvertures du modal                          | `useEffect([visible])` qui dispatche `RESET` à chaque réouverture  |
| Manifeste absent au premier lancement                    | `try/catch` sur `vault.readFile` → empty state                      |
| Histoire supprimée mais entrée dans manifeste            | `stories.find` undefined → fallback `entry.id` italique             |
| Path traversal dans `entry.chemin`                       | `buildVaultPdfUri` throw via `buildVaultUriFromPath` (test Jest)    |
| Dev-client pas rebuild → crash `ExpoSharing`             | `await import('expo-sharing')` + try/catch + fallback Linking       |
| URL Lulu phishing                                        | `LULU_URL` constante module, jamais interpolée                     |
| Haptic qui se rejoue sur re-render                       | `useEffect(() => {}, [])` deps vides — un seul tir au mount         |

## Carry-over (deferred, hors Phase 51)

Documenté dans `51-CONTEXT.md` § "Carry-over" — restent à faire en futures phases :

- **Entry-points contextuels** : long-press sur saga (3+ tomes même série) dans bibliothèque → modal export pré-rempli ; bouton "Imprimer ce livre" en fin de génération histoire — UX optionnelle, écran "Mes impressions" couvre déjà le cas principal
- **Lulu Direct API** : intégration directe (auth OAuth, upload PDF, choix specs, paiement) — gros chantier, hors scope MVP, le manuel FR couvre l'usage manuel pour l'instant
- **PDF cleanup automatique** : politique de rétention dans `12 - Impressions/PDFs/` (taille max ? âge max ?) — décision produit à prendre

## Tests

**3 nouveaux fichiers de tests Jest, 21 cas verts (sur 21) :**

```
components/pdf/__tests__/BookExportModal.state.test.ts (8 cas — reducer)
  ✓ select + START_GENERATION → generating { step: assets }
  ✓ generating + STEP_ADVANCE { render } → generating { step: render }
  ✓ generating + GENERATION_DONE → ready avec uri/perfMs/entry
  ✓ ready + GO_POST_EXPORT → post-export
  ✓ post-export + RESET → select
  ✓ select + STEP_ADVANCE → état inchangé (transition invalide)
  ✓ generating + GENERATION_ERROR → retour à select
  ✓ reducer ne mute pas l'état entrant

lib/pdf/__tests__/book-storage.uri.test.ts (3 cas — URI)
  ✓ reconstruit un URI file:// valide depuis vaultPath et entry.chemin
  ✓ throw quand entry.chemin contient un path traversal (..)
  ✓ ne produit pas de double slash quand vaultPath se termine par '/'

lib/__tests__/i18n.impressions.test.ts (4 cas — namespace i18n)
  ✓ charge le namespace impressions FR (titre écran)
  ✓ expose la clé du manuel Lulu
  ✓ expose les étapes de génération
  ✓ expose les 3 actions post-export

lib/pdf/__tests__/qr-generator.test.ts (6 cas — préservés Phase 50)
```

**Type-check global :** `npx tsc --noEmit` clean (hors pré-existantes `MemoryEditor.tsx`, `cooklang.ts`, `hooks/useVault.ts` — documentées CLAUDE.md).

**Tests pré-existants échoués (non-régressions Phase 51, vérifiés via `git stash` état propre) :** `lib/__tests__/codex-content.test.ts`, `lib/__tests__/auberge-auto-tick.test.ts`, `hooks/__tests__/useVaultCourses.test.ts`, `lib/__tests__/insights.test.ts` — à traiter dans une phase de stabilisation tests dédiée.

## Stack ajouté

**1 lib native :** `expo-sharing ~14.0.8` (Share Sheet iOS pour bouton "Sauvegarder").

Toutes les autres briques (`expo-print`, `qrcode`, `expo-clipboard`) étaient déjà installées (Phases 49 et 50).

## Files touchés (récapitulatif global)

**Créés (14 fichiers) :**
- `components/pdf/exportPhase.ts`
- `components/pdf/BookExportModal.tsx`
- `components/pdf/PostExportView.tsx`
- `components/pdf/LuluInstructionsModal.tsx`
- `components/pdf/ExportCard.tsx`
- `components/pdf/index.ts`
- `components/pdf/__tests__/BookExportModal.state.test.ts`
- `app/impressions.tsx`
- `lib/pdf/__tests__/book-storage.uri.test.ts`
- `lib/__tests__/i18n.impressions.test.ts`
- `locales/fr/impressions.json`
- `locales/en/impressions.json`
- `.planning/phases/51-ux-export-manuel-lulu/51-04-SUMMARY.md`
- `.planning/phases/51-ux-export-manuel-lulu/51-PHASE-SUMMARY.md`

**Modifiés (11 fichiers) :**
- `app/_layout.tsx` (Stack.Screen "impressions" enregistré)
- `app/(tabs)/more.tsx` (2 lignes : import Printer + entrée menuItems)
- `app/dev-deep-link.tsx` (cleanup boutons PDF Phase 51-04)
- `lib/pdf/book-storage.ts` (rename interne + export `buildVaultPdfUri`)
- `lib/pdf/index.ts` (re-export)
- `lib/i18n.ts` (registration namespace `impressions`)
- `locales/fr/common.json` (clé `menu.items.impressions`)
- `locales/en/common.json` (clé `menu.items.impressions`)
- `jest.config.js` (extension roots à `components/`)
- `package.json` + `package-lock.json` (expo-sharing)
- `CLAUDE.md` (Stack + Architecture + Vault)

## Effort réel

**Total : ~1526s (~25 min de wall-clock effectif sur 4 plans)** — incluant écriture, tests, validation, déviations auto-fixées (8 Rules 1/2/3 documentées sur les 4 plans).

| Plan | Durée | Tasks | Files créés | Files modifiés |
|------|-------|-------|-------------|----------------|
| 51-01 | 266s | 2 | 4 | 1 |
| 51-02 | 480s | 2 | 3 | 6 |
| 51-03 | 540s | 2 | 5 | 6 |
| 51-04 | 240s | 4 | 2 | 2 |

## Status

- [x] **Plans 51-01 / 51-02 / 51-03 / 51-04 livrés**
- [x] **tsc + tests Phase 51 verts**
- [x] **CLAUDE.md à jour**
- [x] **Cleanup dev-deep-link.tsx fait**
- [x] **2 SUMMARY rédigés (51-04 + 51-PHASE)**
- [ ] **Checkpoint device validation utilisateur** — 12 points formulés dans `51-04-SUMMARY.md` § "Checkpoint device — formulation utilisateur"

## Next steps

1. **Utilisateur** : exécuter le checkpoint device 12 points (rebuild dev-client requis pour `expo-sharing` natif : `npx expo prebuild --clean` + `npx expo run:ios --device`)
2. **Si OK** : `/ship` (tsc + privacy check + commit FR + push) — Phase 51 prête pour TestFlight
3. **Si bug** : ouvrir un quick-fix `/gsd:quick` ou `/gsd:debug` ciblé, ne pas réécrire la phase

## Self-Check: PASSED

- FOUND: 51-01-SUMMARY.md, 51-02-SUMMARY.md, 51-03-SUMMARY.md, 51-04-SUMMARY.md
- FOUND: components/pdf/ (BookExportModal, PostExportView, LuluInstructionsModal, ExportCard, exportPhase, index, tests)
- FOUND: app/impressions.tsx
- FOUND: lib/pdf/__tests__/book-storage.uri.test.ts, lib/__tests__/i18n.impressions.test.ts
- FOUND: locales/fr/impressions.json, locales/en/impressions.json
- FOUND: 8 commits Phase 51 (0cd43b61, 0a2d901d, fd585149, a2cc0ae8, e9931692, fa1336bf, 558be68d, d31e4ca1, 67d70c07)
