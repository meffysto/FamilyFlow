---
phase: 49-layout-livre-generation-pdf
plan: 03
subsystem: pdf
tags: [pdf, pipeline, expo-print, hash, manifeste, saga]
key-files:
  created:
    - lib/pdf/saga-detection.ts
    - lib/pdf/pdf-generator.ts
    - lib/pdf/book-storage.ts
    - lib/__tests__/pdf-saga-detection.test.ts
    - lib/__tests__/pdf-hash.test.ts
  modified:
    - lib/pdf/index.ts
---

# Phase 49 Plan 03 : Pipeline expo-print + hash SHA-256 + saga detection + book storage — Summary

Branchement end-to-end de la génération PDF Lulu : préchargement assets parallèle, rendu HTML, hash SHA-256 sur source, `printToFileAsync`, copie vault iCloud et upsert manifeste.

## Pipeline livré

`generateBookPdf({ story, allStories })` orchestre :

1. **Preload parallèle** — `Promise.all([loadFontsBase64(), ...6 × loadIllustrationBase64('foret', archetype)])` (cache mémoire 49-01).
2. **Saga detection** — `detectTomeBadge(story, allStories)` retourne `{ current, total, livreTitre }` ou null.
3. **Render HTML** — `renderBookHtml(spec)` (Mode A 16 pages, throw si scenes ≠ 6).
4. **Hash SHA-256** — `Crypto.digestStringAsync(SHA256, html)` sur le HTML source (déterministe — RESEARCH.md §481-515).
5. **expo-print** — `printToFileAsync({ html, width: 613.4, height: 613.4, margins: 0 })` → cache app URI.

`persistBookPdf(vault, cacheUri, entry)` copie le PDF via `FileSystem.copyAsync` vers `12 - Impressions/PDFs/{storyId}-{YYYY-MM-DD}.pdf`, parse le manifeste existant, upsert sur `(id, date)` puis sérialise via le parser Phase 48.

## Constante exposée

`PAGE_SIZE_PT = (21 + 2 × 0.32) × 28.346 ≈ 613.4` pt — Pitfall 2 RESEARCH.md (width/height en POINTS, pas en cm).

## Mesure perf décomposée

Sous `__DEV__` :
```
[generateBookPdf] {storyId} — {totalMs}ms — assets:Xms render:Xms hash:Xms print:Xms
```
+ `console.warn` si `totalMs > 5000`. Validation device + ouverture PDF Aperçu macOS (vérif 21.64×21.64 cm + Andika listée) à prévoir Phase 51 wiring.

## Tests Jest (13 nouveaux)

- `pdf-saga-detection.test.ts` — **8 tests** pure func : null si pas livreId / pas chapitre / chapitre<1 / allStories vide ; total = max(chapitre) sur même livreId ; filtre livreId ; fallback livreTitre → titre ; immutabilité.
- `pdf-hash.test.ts` — **5 tests** déterminisme HTML source : même input ↔ même HTML ↔ même SHA-256 hex 64 chars ; titre/highlights/tomeBadge changent le hash ; pas de `Date.now`/`Math.random` résiduel.
- **Total pdf-* : 30/30** (saga 8 + hash 5 + html-template 17) en 2.5s.

## Note BookExportSpec (Fix 4 plan-checker)

`BookExportSpec` (Phase 48 `lib/pdf/types.ts`) **reste typé mais non utilisé runtime Phase 49**. Le pipeline `generateBookPdf` consomme directement `BedtimeStory` + `BedtimeStory[]` et construit son propre `BookHtmlSpec` interne (via `detectTomeBadge` + `loadFontsBase64` + `loadIllustrationBase64`). `BookExportSpec` sera consommé Phase 51 lors du wiring UI bouton export (assemblage côté écran génération histoire avant appel `generateBookPdf`).

## Mode B fallback

Toujours en placeholder Plan 49-02 (`renderModeBPlaceholder` — 16 sections vides `data-mode="fallback"`). Le pattern complet (drop cap manuscrit, bordures forestières, pull quotes, vignettes, numéros cartouche) sera implémenté Plan **49-04**.

## Choix architectural — pas de modif VaultManager

`VaultManager.writeFile` est UTF-8 → KO pour binaires PDF. Plutôt que d'ajouter une méthode `writeBinaryFile`, `book-storage.ts` réplique la logique privée `vault.uri()` (path traversal check + `file://` prefix iOS) dans un helper local `buildVaultUri` puis utilise `FileSystem.copyAsync`. Aucune surface VaultManager modifiée — moins de risque de régression. NSFileCoordinator intervient à la lecture côté Obsidian (RESEARCH.md §662).

## Self-Check : PASSED

- 3 fichiers source créés (saga-detection, pdf-generator, book-storage) ✓
- 2 tests Jest créés, 13/13 passants ✓
- `lib/pdf/index.ts` ré-exporte `detectTomeBadge`, `TomeBadge`, `generateBookPdf`, `PAGE_SIZE_PT`, `GenerateBookPdfOptions`, `GenerateBookPdfResult`, `persistBookPdf` ✓
- `npx tsc --noEmit` clean (sortie vide sur fichiers Phase 49 Plan 03) ✓
- `PAGE_SIZE_PT` apparaît 3× dans pdf-generator.ts (export + width + height) ✓
- `12 - Impressions/PDFs` apparaît dans book-storage.ts ✓
- `console.log` perf sous `if (__DEV__)` ✓
- Aucune modification de VaultManager class ✓

## Commit

`eb29dd69` — `feat(49-03): pipeline expo-print + hash SHA-256 + saga detection + book storage`
