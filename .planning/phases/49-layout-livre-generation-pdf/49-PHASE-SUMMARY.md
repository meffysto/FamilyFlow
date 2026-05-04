---
phase: 49-layout-livre-generation-pdf
status: complete
milestone: v1.8 — Export PDF imprimable des histoires
plans: [49-01, 49-02, 49-03, 49-04]
date-completed: 2026-05-04
---

# Phase 49 — Layout livre + génération PDF — Phase Summary

Pipeline complet de génération PDF Lulu (21×21 cm + 0.32 cm bleed, 16 pages saddle-stitch) pour l'export imprimable d'histoires depuis FamilyVault. Deux modes opérationnels : **A picture-book illustré** (univers forêt) et **B fallback texte-seul ornemental** (univers V2 / sans scenes).

## Plans livrés

| Plan | Objet | Livrables clés |
|------|-------|----------------|
| 49-01 | Squelette HTML + CSS + asset-loader + ornaments lib | `html-template.ts`, `asset-loader.ts`, `ornaments.ts` (10 SVG inline), `print-illustrations.ts`, fonts Andika base64 |
| 49-02 | Composants page mode A | `cover.ts`, `title.ts`, `scene-double-page.ts`, `back-cover.ts`, mode A complet |
| 49-03 | Pipeline expo-print + hash + saga + storage | `pdf-generator.ts` (orchestrateur), `saga-detection.ts`, `book-storage.ts`, hash SHA-256 sur HTML source, `PAGE_SIZE_PT = 613.4` |
| 49-04 | Mode B fallback ornemental + perf finale | `text-splitter.ts`, `fallback-double-page.ts`, drops cartouchés / bordures botaniques / pull quotes / vignettes / numéros cartouchés |

## Stack technique

- **expo-print** `printToFileAsync({ html, width: 613.4pt, height: 613.4pt, margins: 0 })` — Pitfall 2 RESEARCH.md mitigé
- **expo-crypto** SHA-256 `digestStringAsync` sur HTML source (déterminisme garanti)
- **expo-asset** + base64 inline pour fonts + illustrations (WKWebView refuse `file://`)
- **Polices embarquées** : Andika Regular/Bold (corps), Caveat (drops + numéros), DM Serif Display (titres + pull)
- **Palettes** : BOOK_PALETTE générique mode A vs ornementale stricte mode B (`#F4EDE2` / `#B8593F` / `#7A8F6B` / `#2E2A26`)

## Tests Jest cumulés Phase 49

| Test file | Tests | Domaine |
|-----------|-------|---------|
| `pdf-html-template.test.ts` | 24 | renderCss + renderBookHtml (modes A et B) |
| `pdf-scene-double-page.test.ts` | 7 | composant scène mode A |
| `pdf-saga-detection.test.ts` | 8 | pure func tomeBadge |
| `pdf-hash.test.ts` | 5 | déterminisme SHA-256 |
| `pdf-fallback.test.ts` | 13 | text-splitter + fallback double-page |
| **Total pdf-* Phase 49** | **57** | **57/57 verts** |

## Performance

`pdf-generator.ts` instrumente `assets / render / hash / print / total` ms et warn `PERF BUDGET DÉPASSÉ` si > 5s. Validation device à effectuer Phase 51 wiring.

## Architecture finale `lib/pdf/`

```
lib/pdf/
├── constants.ts            # TRIM_SIZE_CM, BLEED_CM, BOOK_PALETTE, FONT_SLOTS
├── types.ts                # BookExportSpec, BookManifestEntry, BookPalette
├── manifest-parser.ts      # parse/serialize manifeste (Phase 48)
├── asset-loader.ts         # loadFontsBase64, loadIllustrationBase64 + cache
├── print-illustrations.ts  # catalogue PNG 2480×2480 forêt
├── ornaments.ts            # 10 SVG inline (drop cap frame, borders, vignettes…)
├── html-template.ts        # renderBookHtml + renderCss + escapeHtml (orchestrateur modes A/B)
├── text-splitter.ts        # splitTextIntoSections (pure func, mode B)
├── components/
│   ├── cover.ts
│   ├── title.ts
│   ├── scene-double-page.ts
│   ├── back-cover.ts
│   └── fallback-double-page.ts
├── saga-detection.ts       # detectTomeBadge pure func
├── pdf-generator.ts        # generateBookPdf (orchestrateur principal)
├── book-storage.ts         # persistBookPdf + manifeste upsert
└── index.ts                # barrel
```

## Décisions de design respectées

- **Strict 6 scènes** mode A — throw si scenes.length !== 6 (CONTEXT D-Q2)
- **Fallback ornemental ambitieux** — pas un compromis minimal, vision "édition collector" (CONTEXT D-Q3)
- **Triple typographie** mode B : DM Serif Display (titres + pull) / Caveat (drops + numéros) / Andika (corps)
- **Hash sur HTML source** — pas sur PDF binaire (métadonnées non-déterministes WKWebView)
- **Manuel illustrations 300 DPI** — upscale lanczos sharp 800→2480 livré Wave 0 (dette documentée)

## Échecs hors scope (pré-existants)

`pdf-manifest-parser.test.ts`, `insights.test.ts`, `codex-content.test.ts`, `auberge-auto-tick.test.ts`, `useVaultCourses.test.ts` échouent sur `expo-asset` ESM `SyntaxError`. Présent avant Phase 49. À traiter via config Jest globale.

## Phases suivantes

- **Phase 50** : QR code 4ème couverture + deep link de lecture
- **Phase 51** : Wiring UI bouton export depuis l'écran génération histoire + modal aperçu + validation Lulu réelle (upload PDF de test)

## Status

✅ **Phase 49 prête pour merge / TestFlight v1.8**. Aucune régression sur pipeline existant. Pipeline `generateBookPdf` exposé via `lib/pdf/index.ts` prêt pour consommation Phase 51.
