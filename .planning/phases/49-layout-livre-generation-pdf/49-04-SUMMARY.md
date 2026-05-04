---
phase: 49-layout-livre-generation-pdf
plan: 04
subsystem: pdf
tags: [pdf, fallback, ornemental, mode-b, drop-cap, saga, perf]
key-files:
  created:
    - lib/pdf/text-splitter.ts
    - lib/pdf/components/fallback-double-page.ts
    - lib/__tests__/pdf-fallback.test.ts
  modified:
    - lib/pdf/html-template.ts
    - lib/pdf/index.ts
    - lib/pdf/pdf-generator.ts
    - lib/__tests__/pdf-html-template.test.ts
---

# Phase 49 Plan 04 : Mode B fallback ornemental + saga tome wiring + perf finale — Summary

Livraison du **mode B "faire rêver"** (CONTEXT.md §85-138) : pour les histoires sans `scenes`, FamilyVault produit désormais un livre typographique illustré-typo de 16 pages avec drops manuscrits cartouchés, bordures botaniques alternées, pull quotes ornementaux, vignettes haut/bas, numéros cartouchés.

## Pattern complet livré

- **Drop cap** Caveat 6em terracotta `#B8593F` dans `cartoucheFrame` SVG (3×3cm, float left)
- **Bordures externes** alternées `borderFern` / `borderRamage` / `borderLichen` (sauge `#7A8F6B`, opacité 0.10) selon `pageIndex % 3`
- **Pull quote** DM Serif Display italic 1.4em encadré `separatorTriple` ✦·❋·✦, heuristique avant-dernière phrase tronquée 180 chars
- **Vignettes** alternées : pageIndex pair → lune+forêt ; impair → lanterne+oiseau
- **Numéros cartouchés** Caveat 14pt terracotta dans cartoucheFrame
- **Palette stricte** : ivoire `#F4EDE2` (override BOOK_PALETTE.ivory `#FAF6EE` en mode B), terracotta `#B8593F`, sauge `#7A8F6B`, encre `#2E2A26`

## text-splitter.ts

`splitTextIntoSections(text, n=6)` : pure func déterministe. Frontières phrase `[.!?]+\s` ou fin ; fallback frontières mot si moins de N phrases ; toujours exactement N entrées. Aucun mot coupé.

## Saga tome wiring

`renderModeBPages` passe désormais `spec.tomeBadge` à `renderTitlePage` — le mode A le faisait déjà depuis 49-02, le mode B l'égalise. Test intégration : `Tome 2 sur 4` + `La Saga des Loups` apparaissent en mode B avec tomeBadge fourni.

## Perf finale

`pdf-generator.ts` warn affine le format : `PERF BUDGET DÉPASSÉ : Xms > 5000ms — assets:Xms render:Xms hash:Xms print:Xms — story=ID — inspecter le bottleneck dominant.` Mesure validée __DEV__.

## Tests Jest (Plan 49-04 + cumul Phase 49)

- `pdf-fallback.test.ts` — **13 tests** : 6 splitter + 7 rendering (palette, drop cap, pull quote, page numbers, alternance bordures, escape HTML)
- `pdf-html-template.test.ts` — **+7 tests mode B** : 16 sections, 12 fallback-page, palette ornementale, **6 drop-cap-block exactement**, pas de stub résiduel, mode A non régressé (0 drop cap), tomeBadge en mode B
- **Suite pdf-* totale : 57/57 verts** (saga 8 + hash 5 + html-template 24 + scene-double-page 7 + fallback 13)

## Fix tests pré-existants

`pdf-html-template.test.ts:96` — assertion `<section class="page"` (avec quote fermant) devenue obsolète depuis 49-02 (sections classées `cover`, `title`, etc.). Ajusté à `<section class="page` sans quote → 16 matches OK. Pas un bug introduit, simple alignement avec architecture composant.

## Échecs hors scope (pré-existants)

`pdf-manifest-parser.test.ts`, `insights.test.ts`, `codex-content.test.ts`, `auberge-auto-tick.test.ts`, `useVaultCourses.test.ts` — `SyntaxError: Cannot use import statement outside a module` sur `expo-asset`. Confirmé par stash test : ces erreurs existent avant Plan 49-04. Hors scope (config Jest/Babel pour ESM dans `node_modules`).

## Validation device (post-merge Phase 49)

1. `npx expo run:ios --device`
2. Générer 1 histoire forêt (mode A) → ouvrir PDF Aperçu macOS : 16 pages, 21.64×21.64 cm, fond `#FAF6EE`, scenes archetypées
3. Générer 1 histoire univers ≠ forêt (mode B) → ouvrir PDF Aperçu : 16 pages, fond `#F4EDE2`, 6 drops Caveat terracotta cartouchés, bordures botaniques visibles, pull quotes italiques
4. Inspecteur Aperçu → polices listées : Andika Regular + Bold, Caveat, DM Serif Display

## Phase 49 prête

Pipeline complet : layout (49-01) + composants mode A (49-02) + pipeline expo-print (49-03) + mode B (49-04). Wiring UI bouton export = **Phase 51**.

## Self-Check : PASSED

- `lib/pdf/text-splitter.ts` ✓
- `lib/pdf/components/fallback-double-page.ts` ✓
- `lib/__tests__/pdf-fallback.test.ts` (13 tests) ✓
- `npx jest --no-coverage lib/__tests__/pdf-*.test.ts` → 57/57 verts ✓
- `npx tsc --noEmit` clean sur scope pdf ✓
- `grep "PERF BUDGET DÉPASSÉ" lib/pdf/pdf-generator.ts` → présent ✓
- `grep "splitTextIntoSections" lib/pdf/html-template.ts` → import + appel ✓
- 6 drop-cap-block exactement en mode B (test) ✓
- 0 drop-cap-block en mode A (test régression) ✓
