---
phase: 49-layout-livre-generation-pdf
plan: 01
subsystem: pdf
tags: [pdf, layout, fonts, base64, ornaments, foundation]
tech-stack:
  added: [expo-crypto@~15.0.9, expo-asset@~12.0.13]
key-files:
  created:
    - lib/pdf/asset-loader.ts
    - lib/pdf/print-illustrations.ts
    - lib/pdf/ornaments.ts
    - lib/pdf/html-template.ts
    - lib/__tests__/pdf-html-template.test.ts
  modified:
    - lib/pdf/index.ts
    - package.json
    - package-lock.json
    - app.json
---

# Phase 49 Plan 01 : Fondation pipeline PDF — Summary

Pose du socle Phase 49 : deps natives base64 (expo-crypto/expo-asset), asset-loader avec cache mémoire, registry des 6 PNG forêt 2480×2480, bibliothèque de 10 ornements SVG inline, et squelette `html-template.ts` (DOCTYPE HTML5 + CSS @page 21.64cm + @font-face Andika base64 truetype + palette livre). Composants page restent stubs — détaillés Plans 49-02/49-04.

## Versions installées
- `expo-crypto ~15.0.9`
- `expo-asset ~12.0.13` (config plugin auto-ajouté à `app.json`)

## Ornements SVG (lib/pdf/ornaments.ts)
10 fonctions paramétrées `{ color?, size? }` :
- **Terracotta `#B8593F`** (défaut) : `dropCapFrame`, `vignetteCrescent`, `vignetteLantern`, `vignetteBird`, `cartoucheFrame`, `separatorTriple`
- **Sauge `#7A8F6B`** (défaut) : `borderFern`, `borderRamage`, `borderLichen`, `vignetteForest`

## Tests Jest
9 tests passants (5 `renderCss` + 4 `renderBookHtml`) — DOCTYPE, @page 21.64cm, deux @font-face base64 truetype, alias unifié Andika (pas -Regular/-Bold), palette injectée, page-break-after auto last child, structure 16 pages stub, échappement HTML titre.

## Cache & dette technique
- Cache mémoire opérationnel : `cachedFonts` + `Map<string,string>` illustrations + `clearAssetCache()` exporté
- TODO Wave 0 documenté en tête `asset-loader.ts` : PNG sont upscale sharp lanczos (CONTEXT.md §206-212), à ré-générer AI native post-milestone

## Décisions léguées au Plan 49-02
- Signature exacte de `renderCoverPage(spec)` / `renderTitlePage(spec)` / `renderSceneDoublePage(scene, illustrationDataUri)` / `renderBackCover(spec)` — actuellement `renderPagesStub` produit 16 sections vides à remplacer
- Heuristique pull quote (2ème phrase ou avant-dernière) — Plan 49-04
- Détection tome saga (`detectTomeBadge`) — Plan 49-03

## Self-Check : PASSED
- `lib/pdf/{asset-loader,print-illustrations,ornaments,html-template}.ts` ✓
- `lib/__tests__/pdf-html-template.test.ts` ✓ 9/9 tests
- `npx tsc --noEmit` clean sur fichiers Phase 49 ✓
- `expo-crypto` + `expo-asset` dans package.json ✓
