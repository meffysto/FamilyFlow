---
phase: 49-layout-livre-generation-pdf
plan: 02
subsystem: pdf
tags: [pdf, layout, picture-book, components, mode-a]
key-files:
  created:
    - lib/pdf/components/cover.ts
    - lib/pdf/components/title.ts
    - lib/pdf/components/scene-double-page.ts
    - lib/pdf/components/back-cover.ts
    - lib/__tests__/pdf-scene-double-page.test.ts
  modified:
    - lib/pdf/html-template.ts
    - lib/pdf/index.ts
    - lib/__tests__/pdf-html-template.test.ts
---

# Phase 49 Plan 02 : Composants layout livre (Mode A picture-book) — Summary

Implémentation des 4 composants de mise en page du livre illustré (univers forêt MVP) et branchement dans `renderBookHtml`. En présence de `spec.scenes` (length 6), le template produit un livre structuré 16 pages exactement.

## Structure 16 pages mode A confirmée

| Folio | Composant | Détail |
|------|-----------|--------|
| 1 | `renderCoverPage` | Illustration paysage full-bleed PNG base64 + overlay titre 48pt DM Serif ivoire ombré + univers Caveat 22pt |
| 2 | `renderTitlePage` | Séparateurs ornementaux (terracotta + sauge) + titre 42pt + "Pour {enfant}" Caveat + date FR JJ/MM/AAAA + tomeBadge conditionnel italique |
| 3-14 | `renderSceneDoublePage` ×6 | Page paire = illustration full-bleed (lookup `archetype` dans Map) + cartouche numéro gauche / Page impaire = texte slicé `textStart..textEnd` + highlights teal + numéro droit |
| 15 | `renderEndPage` (inline html-template) | "Fin." DM Serif 60pt terracotta + memorySummary optionnel |
| 16 | `renderBackCoverPage` | Résumé tronqué 280 chars + placeholder QR `data-phase50` 3×3cm + label FamilyVault |

## Stratégie highlights
- Couleur teal **`#0F8B8D`** (cohérent commentaire `lib/types.ts:903 keyword`) + `font-weight:700`
- Slicing pure function : tri stable par `startChar`, filtrage des spans dégénérés (`endChar <= startChar`), clamp dans `[0, text.length]`
- Pas de `Date.now()` / `Math.random()` → déterminisme garanti pour le hash SHA-256 du HTML source

## Décision strict 6 scènes (CONTEXT.md D-Q2)
Si `spec.scenes.length !== 6` : `throw new Error("L'histoire doit avoir exactement 6 scènes pour être imprimée. Édite le sidecar .scenes.json.")`. Message exact retenu, testé via `expect().toThrow(/exactement 6 scènes/)`.

## Mode B délégué Plan 49-04
`renderModeBPlaceholder` produit 16 sections vides identifiables `data-mode="fallback"`. Le pattern complet (drop cap, bordures forestières, pull quotes, vignettes) sera implémenté Plan 49-04.

## Fallback paperShadow (futur non-forêt)
`coverImageBase64=null` ou `illustrationBase64=null` → bloc plein `paperShadow` (`#E8E0D0`). La cover reste visuellement valide. `scene-double-page` ajoute le label archetype DM Serif 48pt sauge en center.

## Tests Jest
- `pdf-html-template.test.ts` : 9 fondation + **8 mode A** = 17 tests
- `pdf-scene-double-page.test.ts` (nouveau) : **7 tests dédiés** (2 sections, slicing, highlights teal, fallback paperShadow, data-archetype, page-num gauche/droit, highlights dégénérés)
- **Total : 24/24 passants** en 2.6s

## Self-Check : PASSED
- 4 fichiers `lib/pdf/components/*.ts` créés ✓
- `html-template.ts` branche mode A + mode B placeholder ✓
- `lib/pdf/index.ts` ré-exporte les 4 composants + types ✓
- `npx tsc --noEmit` clean sur fichiers Phase 49 ✓
- Commit `ce7e2c3a` ✓

## Commit
`ce7e2c3a` — `feat(49-02): composants layout cover/title/scene/back — mode A picture-book`
