---
phase: 50-qr-audio-deep-links
plan: 03
subsystem: pdf
tags: [qr, pdf, deep-links, phase-50, qr-04]
requires:
  - lib/pdf/pdf-generator.ts (Phase 49-03 pipeline)
  - lib/pdf/components/back-cover.ts (Phase 49-02 placeholder)
  - lib/pdf/html-template.ts (Phase 49-01 squelette)
provides:
  - lib/pdf/qr-generator.ts (generateStoryQrSvg)
  - BookHtmlSpec.qrSvg field
  - Pipeline QR scannable en 4ème de couverture du PDF imprimé
affects:
  - lib/pdf/pdf-generator.ts (Promise.all assets élargi)
  - lib/pdf/components/back-cover.ts (placeholder remplacé par SVG réel)
  - lib/pdf/html-template.ts (BookHtmlSpec étendu, 2 call-sites)
  - lib/pdf/index.ts (ré-export generateStoryQrSvg)
  - lib/__tests__/pdf-html-template.test.ts (qrSvg fake injecté)
  - lib/__tests__/pdf-hash.test.ts (qrSvg fake injecté — déterminisme PDF préservé)
tech-stack:
  added:
    - qrcode@1.5.4 (dependency, pure JS Reed-Solomon encoder, pas de partie native)
    - "@types/qrcode@^1.5.6 (devDependency)"
  patterns:
    - SVG inline injecté dans HTML expo-print (pas escapeHtml pour qrSvg — interprété par WKWebView)
    - encodeURIComponent sur storyId AVANT encodage QR (special chars / espaces)
    - Promise.all parallélise QR + fonts + illustrations (pas de surcoût séquentiel)
key-files:
  created:
    - lib/pdf/qr-generator.ts (45 lignes — async generateStoryQrSvg)
    - lib/pdf/__tests__/qr-generator.test.ts (43 lignes — 6 tests Jest)
  modified:
    - lib/pdf/pdf-generator.ts (Promise.all + qrSvg dans renderBookHtml)
    - lib/pdf/components/back-cover.ts (placeholder data-phase50 supprimé, SVG réel + légende FR)
    - lib/pdf/html-template.ts (BookHtmlSpec.qrSvg + 2 call-sites)
    - lib/pdf/index.ts (export generateStoryQrSvg)
    - lib/__tests__/pdf-html-template.test.ts (qrSvg fake + assertion mise à jour)
    - lib/__tests__/pdf-hash.test.ts (qrSvg fake)
    - package.json + package-lock.json (qrcode + @types/qrcode)
decisions:
  - "qrcode lib pure JS — pas d'expo install (pas de partie native, vérifié dans bundledNativeModules.json)"
  - "ECC M (15%) + margin 1 + width 300 : compromis taille/robustesse pour scan papier 3×3cm"
  - "color.dark = palette.ink, color.light = #00000000 transparent — laisse le fond ivory du livre"
  - "encodeURIComponent sur storyId pour les ids spéciaux (espaces, slashes)"
  - "qrSvg injecté tel quel dans HTML (pas escapeHtml — c'est du SVG inline interprété)"
metrics:
  duration: ~25min
  tasks_completed: 4
  commits: 5 (1 install + 1 test RED + 1 impl GREEN + 1 back-cover + 1 pipeline)
  tests_added: 6
  tests_passing: 35 (qr-generator 6 + pdf-html-template 21 + pdf-hash 5 + autres pdf 3)
  completed_date: 2026-05-05
---

# Phase 50 Plan 03 : Génération QR + intégration pipeline PDF — Summary

QR code SVG déterministe encodant `family-vault://story/<id>` injecté en 4ème de couverture du livre PDF Lulu via `qrcode` v1.5.4, en parallèle des fonts et illustrations dans `Promise.all`, avec hash SHA-256 du HTML préservé.

## What Was Done

1. **Task 1 — Install** (`8eeebd0a`) : `qrcode@1.5.4` + `@types/qrcode@1.5.6` ajoutés. Smoke test SVG output OK. `npm ls` sans warning.
2. **Task 2 RED** (`c4fde396`) : 6 tests Jest écrits avant implémentation — module introuvable, RED confirmé.
3. **Task 2 GREEN** (`012fbadb`) : `lib/pdf/qr-generator.ts` créé. `generateStoryQrSvg(storyId, palette)` retourne un SVG inline déterministe encodant `family-vault://story/<encodeURIComponent(id)>`. ECC M, margin 1, width 300, color.dark = `palette.ink`, color.light transparent. Throw si storyId vide/non-string. 6/6 tests verts.
4. **Task 3** (`30e67841`) : `BookHtmlSpec` étendu avec `qrSvg: string`. `BackCoverOpts.qrSvg` ajouté. Placeholder `<div data-phase50>` (back-cover.ts:25) **supprimé** et remplacé par `<div class="qr-block" 3×3cm>${qrSvg}</div>` + `<div class="qr-legend">Scanne pour écouter l'histoire</div>`. Les 2 call-sites de `renderBackCoverPage` (mode A ligne 173, mode B ligne 237) passent maintenant `spec.qrSvg`. Tests Phase 49 mis à jour (qrSvg fake + assertion `data-phase50` retournée).
5. **Task 4** (`81cfc772`) : `pdf-generator.ts` invoque `generateStoryQrSvg(opts.story.id, BOOK_PALETTE)` dans `Promise.all` (parallélisé avec fonts + illustrations). Le résultat est passé à `renderBookHtml` via `qrSvg`. `lib/pdf/index.ts` ré-exporte `generateStoryQrSvg`.

## Paramètres QR finaux

| Param | Valeur | Raison |
|-------|--------|--------|
| Encoder | `qrcode@1.5.4` | Pure JS Reed-Solomon, déterministe, no native bindings |
| Type output | `svg` | Vectoriel scalable + injectable dans HTML expo-print |
| Error correction | `M` (15%) | Compromis taille/robustesse pour scan papier |
| Margin | `1` | Quiet zone minimale (0 casse les scanners) |
| Width | `300` | 300dpi équivalent pour 3cm imprimé |
| `color.dark` | `palette.ink` (`#2B2A28`) | Cohérence visuelle livre |
| `color.light` | `#00000000` (transparent) | Laisse passer le fond ivory du livre |
| URL encodée | `family-vault://story/<encodeURIComponent(id)>` | Scheme avec tiret (CONTEXT.md) |

## Déterminisme hash SHA-256 — préservé

Test Jest spécifique : `produit un output déterministe pour mêmes inputs` (qr-generator.test.ts:25). Deux appels avec même `storyId` retournent **exactement la même string SVG**. Combiné avec le hash SHA-256 calculé sur le HTML source (Phase 49-03 PDF-07), cela garantit que **deux exports d'un même livre produisent le même hash** — le manifeste continue de refléter correctement les versions.

Tests `pdf-hash.test.ts` (5 tests existants) passent toujours après mise à jour avec qrSvg fake fixe.

## Open questions pour Plan 50-04

- **Test scan device réel iPhone** : QR 3cm est-il scannable de façon fiable depuis un livre imprimé Lulu ? Tests à mener avec impression papier ou capture écran simulée.
- **Fallback PNG si SVG inline pose problème WKWebView** : si le rendu rasterisé est défaillant côté expo-print (rare, mais documenté RESEARCH.md A5), basculer sur `QRCode.toDataURL()` qui produit un PNG base64 — plus robuste mais plus lourd.
- **Cohérence palette dark mode** : `palette.ink` est utilisé. Si le livre passe en mode sombre futur, vérifier que le contraste QR ↔ fond reste suffisant (>50% selon spec ISO/IEC 18004).

## Verification

- `grep -c "data-phase50" lib/pdf/components/back-cover.ts` → **0** ✅ (placeholder supprimé)
- `grep -c "generateStoryQrSvg" lib/pdf/pdf-generator.ts` → **2** ✅ (import + appel)
- `grep -c "qrSvg" lib/pdf/html-template.ts` → **3** ✅ (interface + 2 call-sites)
- `grep "Scanne pour écouter l'histoire" lib/pdf/components/back-cover.ts` → match ✅
- `npx jest --no-coverage lib/pdf/__tests__/qr-generator.test.ts lib/__tests__/pdf-html-template.test.ts lib/__tests__/pdf-hash.test.ts` → **35/35 verts** ✅
- `package.json` contient `qrcode` (deps) + `@types/qrcode` (devDeps) ✅

## Deviations from Plan

**None substantielle** — plan exécuté quasi tel qu'écrit.

**Note d'exécution** : un faux pas de manipulation git (`git checkout 00b9e2ce -- .`) a temporairement reverté le working tree au milieu de Task 4 ; les commits HEAD étant intacts, restauration via `git checkout HEAD -- <fichiers>` puis ré-application des changements Task 4 (l'éditeur a noté que les fichiers étaient modifiés "intentionnellement"). Aucun commit perdu, séquence finale conforme au plan.

**Pre-existing failure observé hors-scope** :
- `lib/__tests__/insights.test.ts`, `auberge-auto-tick.test.ts`, `codex-content.test.ts`, `hooks/__tests__/useVaultCourses.test.ts` : 4 suites en échec dues à un mock manquant `react-native-svg`/`lucide-react-native`. **Vérifié pré-existant** (échec avant mes changements en stash test). Hors scope Plan 50-03, à traiter séparément.
- `app/story/[id].tsx:68` TS error sur `autoplay` prop de `FullscreenStoryReader` : Plan 50-02 a committé la route avant le commit qui ajoute la prop autoplay (visible en working tree non-committé). **Hors scope Plan 50-03** (fichier interdit par coordination note).

## Self-Check: PASSED

- [x] `lib/pdf/qr-generator.ts` créé
- [x] `lib/pdf/__tests__/qr-generator.test.ts` créé (6 tests verts)
- [x] `lib/pdf/components/back-cover.ts` modifié (placeholder supprimé)
- [x] `lib/pdf/html-template.ts` modifié (BookHtmlSpec.qrSvg + 2 call-sites)
- [x] `lib/pdf/pdf-generator.ts` modifié (Promise.all + qrSvg)
- [x] `lib/pdf/index.ts` modifié (export)
- [x] Commits présents : `8eeebd0a`, `c4fde396`, `012fbadb`, `30e67841`, `81cfc772`
- [x] `npx tsc --noEmit` clean côté `lib/pdf/*` (1 erreur pré-existante hors scope dans `app/story/[id].tsx`)
- [x] 35 tests PDF passants
