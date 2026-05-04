# Phase 49: Layout livre + génération PDF - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Source:** ROADMAP + Research + 3 décisions design utilisateur

<domain>
## Phase Boundary

Implémenter le pipeline complet de génération PDF pour l'export imprimable des histoires (milestone v1.8) :
- HTML template aux specs Lulu (16 pages structurées, bleed 0.32cm, polices embarquées base64, palette livre)
- Composants layout : couverture, page de titre, scène double-page, 4ème couverture
- Pipeline `expo-print` avec extraction assets HD + hash SHA-256 du HTML source + sauvegarde vault
- Fallback texte-seul ornemental pour histoires sans `scenes` (≠ univers forêt)
- Détection saga + badge tome
- Déterminisme et performance (<5s sur device)

**IN scope :**
- Re-génération 6 illustrations forêt en 2480×2480 PNG → `assets/stories/illustrations-print/foret/`
- Module `lib/pdf/` étendu : `asset-loader.ts`, `html-template.ts`, `pdf-generator.ts`, `book-storage.ts`
- Composants layout HTML/CSS : `cover.ts`, `title.ts`, `scene-double-page.ts`, `back-cover.ts`, `fallback-double-page.ts`
- Détection tome saga (pure func sur `livreId + chapitre`)
- Hash SHA-256 du HTML source (déterminisme — pas du PDF binaire)
- Stockage vault : `12 - Impressions/PDFs/{storyId}-{YYYY-MM-DD}.pdf`
- Mise à jour automatique manifeste (parser Phase 48 réutilisé)
- Tests Jest : html-template, saga-detection, hash, fallback rendering
- Mode A (picture-book) ET Mode B (fallback texte-seul ornemental)

**OUT of scope (phases ultérieures) :**
- UI bouton export, modal aperçu (Phase 51)
- QR code 4ème couverture + deep link (Phase 50)
- Wiring depuis l'écran génération histoire (Phase 51)

</domain>

<decisions>
## Implementation Decisions

### Locked (depuis ROADMAP + Research HIGH confidence)

**Specs PDF Lulu :**
- Page : 21.64cm × 21.64cm (= 21cm trim + 2 × 0.32cm bleed)
- 16 pages exactement (saddle-stitch)
- Polices embarquées via `@font-face` + `data:font/ttf;base64,...`
- Marges : 0/0/0/0 dans `printToFileAsync`, padding interne CSS

**Deps additionnelles (à installer en 49-01) :**
- `expo-crypto` (SHA-256 via `digestStringAsync`)
- `expo-asset` (chargement base64 polices/illustrations à runtime)

**Pipeline :**
- `Print.printToFileAsync({ html, width: 613.4, height: 613.4, margins: { left:0, top:0, right:0, bottom:0 } })`
- Hash : SHA-256 du HTML source (pas du PDF — déterminisme garanti)
- Cache mémoire : `Map<string, string>` pour fonts + illustrations (évite double base64)

**Stockage vault :**
- Path : `12 - Impressions/PDFs/{storyId}-{YYYY-MM-DD}.pdf`
- Manifeste mis à jour : upsert sur `(id, date)` via parser Phase 48

**Détection tome :**
- Pure function `detectTomeBadge(story, allStories): { tome: number, total: number } | null`
- Critères : groupe par `livreId`, ordre par `chapitre` (ou `date` si chapitre absent)

**Architecture interne `lib/pdf/` (Phase 49 ajoute) :**
- `asset-loader.ts` — chargement base64 polices + illustrations + cache
- `html-template.ts` — assembleur HTML principal (orchestre les composants)
- `components/cover.ts`, `components/title.ts`, `components/scene-double-page.ts`, `components/back-cover.ts`, `components/fallback-double-page.ts`
- `pdf-generator.ts` — wrapper `printToFileAsync` + hash + perf measurement
- `book-storage.ts` — sauvegarde PDF dans vault + update manifeste
- `saga-detection.ts` — pure func détection tome
- Tests : `lib/__tests__/pdf-html-template.test.ts`, `pdf-saga-detection.test.ts`, `pdf-hash.test.ts`, `pdf-fallback.test.ts`

### User Decisions (Q1, Q2, Q3 — résolues 2026-05-04)

**Q1 — Illustrations 300 DPI : OPTION A (re-génération AI)**
- Re-générer 6 illustrations forêt en 2480×2480 PNG via prompt AI cohérent avec WebP existants
- Cible : `assets/stories/illustrations-print/foret/{paysage,rencontre,decouverte,vulnerable,echange,etreinte}.png`
- ⚠️ Wave 0 manuelle — l'utilisateur fournit les 6 PNG avant Wave 49-01
- Fallback temporaire si pas dispo : upscale `sharp` lanczos 800→2480 (pseudo-300 DPI), DOCUMENTÉ comme dette

**Q2 — Tolérance scenes ≠ 6 : OPTION A (strict)**
- Si `story.scenes.length !== 6` → refus génération avec message clair : `"L'histoire doit avoir exactement 6 scènes pour être imprimée. Édite le sidecar .scenes.json."`
- Mode B (fallback) déclenche UNIQUEMENT si `story.scenes` est absent / null / vide (V2 ou univers non-forêt)

**Q3 — Fallback texte-seul : VISION AMBITIEUSE — "Faire rêver"**

Le mode fallback n'est PAS un compromis minimal — c'est un livre illustré typographique, pensé comme une édition collector. Pattern complet :

#### Drop cap manuscrit illuminé
- Première lettre de chaque double-page en **Caveat 6em terracotta** (`#B8593F`)
- Encadrée d'un **cartouche feuillagé SVG inline** (silhouette de fougère + ramure, opacité 100%, palette sauge)
- Float left, padding right pour habiller le texte (3-4 lignes wrap autour)

#### Bordures forestières en marge
- **Silhouettes botaniques décoratives** SVG inline en bordure EXTÉRIEURE de chaque double-page
- Variations : fougère, lichen, ramures, herbes hautes — alterner d'une page à l'autre
- Opacité 8-12%, couleur sauge (`#7A8F6B`)
- Largeur : 1.5cm en marge, n'empiète pas sur le bleed

#### Pull quote mid-page
- Phrase clé du paragraphe (extraite manuellement OU heuristique : 2ème ou avant-dernière phrase)
- **DM Serif Display italic, 1.4em**, centrée
- Encadrée de séparateurs ornementaux : `✦ · ❋ · ✦` (terracotta)
- Padding vertical généreux (2em min)

#### Vignettes ouverture/fermeture
- Petit motif décoratif SVG en **haut de chaque double-page** (alterner : lune croissante + étoiles, silhouette forêt, lanterne, oiseau perché)
- Pendant en **bas de page** (motif miroir ou complémentaire)
- Taille ~2cm, palette terracotta + sauge

#### Numéros de page en cartouche
- Numéro centré dans un **petit cartouche feuillagé SVG** (cohérent avec drop cap)
- Position : bas de page extérieur
- Typo : Caveat 1em terracotta
- Pages 1-2 (cover + title) sans numéro, numérotation à partir de p.3

#### Palette ornementale
- **Terracotta** : `#B8593F` (drops, pull quote séparateurs, numéros)
- **Sauge** : `#7A8F6B` (bordures botaniques, séparateurs secondaires)
- **Ivoire** : `#F4EDE2` (fond)
- **Encre** : `#2E2A26` (corps de texte)

#### Triple typographie
- **DM Serif Display** — titres + pull quotes (déjà bundled)
- **Caveat** — drops + numéros + signatures (déjà bundled)
- **Andika** — corps de texte (bundled Phase 48)

#### Structure 16 pages mode B
- p.1 Cover (titre + auteur + univers, vignette centrale)
- p.2 Page de titre (titre + sous-titre + édition)
- p.3-14 → 6 doubles-pages texte ornementales (~2 paragraphes/double-page, drop cap + pull quote + vignettes)
- p.15 "Fin." + dédicace optionnelle
- p.16 Back cover (placeholder QR code Phase 50 + résumé court)

#### Bibliothèque ornements SVG
- Centralisée dans `lib/pdf/ornaments.ts` — fonctions retournant SVG strings paramétrés (couleur, taille)
- Liste : `dropCapFrame()`, `borderFern()`, `borderRamage()`, `borderLichen()`, `vignetteCrescent()`, `vignetteForest()`, `vignetteLantern()`, `vignetteBird()`, `cartoucheFrame()`, `separatorTriple()`
- Tous SVG inline (pas d'images externes — embarqués dans HTML)

</decisions>

<canonical_refs>
## Canonical References

### Codebase
- `lib/types.ts:705-938` — `BedtimeStory`, `StoryScenes`, `SceneSpec`, `SceneArchetype`, `HighlightSpan`
- `lib/parser.ts:3540-3709` — `serializeBedtimeStory`, `parseBedtimeStory`, `parseStoryFrontmatter`
- `lib/stories.ts:1-270` — `STORIES_DIR`, conventions chemins
- `lib/story-illustrations.ts:1-86` — catalogue illustrations actuel + `getIllustration` (à étendre)
- `lib/vault.ts:23, 135-196` — `writeFile`, `ensureDir`, `coordinatedWriteFile`
- `lib/pdf/{constants,types,manifest-parser,index}.ts` — fondation Phase 48 (à étendre)
- `assets/fonts/Andika/{Andika-Regular,Andika-Bold}.ttf` — bundled Phase 48
- `assets/stories/illustrations/foret/*.webp` — illustrations 800×800 actuelles (à conserver pour preview UI, NON utilisées en print)

### Phase 48
- `.planning/phases/48-fondation-export-pdf-assets/48-RESEARCH.md` — contraintes Lulu, font embedding
- `.planning/phases/48-fondation-export-pdf-assets/48-PHASE-SUMMARY.md` — récap fondation

### Phase 49
- `.planning/phases/49-layout-livre-generation-pdf/49-RESEARCH.md` — recherche complète (HIGH confidence sur pipeline + types, MEDIUM sur fallback design)

### External
- [Expo Print SDK](https://docs.expo.dev/versions/latest/sdk/print/) — `printToFileAsync` API
- [Expo PR #20046](https://github.com/expo/expo/pull/20046) — fix iOS width/height

### Specs Lulu
- 21×21cm carré + 0.32cm bleed → 21.64cm page final
- 16 pages saddle-stitch
- 300 DPI minimum pour images
- Polices embarquées obligatoires

</canonical_refs>

<specifics>
## Specific Ideas

- Utiliser `expo-crypto.digestStringAsync(CryptoDigestAlgorithm.SHA256, htmlString)` pour le hash
- `expo-asset.Asset.fromModule(require('...'))` + `FileSystem.readAsStringAsync(uri, { encoding: 'base64' })` pour charger polices + illustrations
- WKWebView refuse les `file://` URLs — TOUT doit être inline base64 (pas de `<link>`, pas de `<img src="file:...">`)
- DOCTYPE HTML5 obligatoire en tête (mitigation issue #7435 page blanche)
- Strip `U+2028 (LINE SEP)`/`U+2029 (PARA SEP)` du texte avant injection HTML (Hermes-safe, déjà géré par parseBedtimeStory)
- Performance : pré-charger fonts + illustrations en parallèle via `Promise.all`, viser <2s pour le pré-chargement et <3s pour le render
- Le critère #4 (5s) inclut TOUT (chargement + render + write), mesurer dans `__DEV__` avec `performance.now()`
- Tests Jest : mock `expo-print` + `expo-crypto` ; tester pure logic (saga detection, hash determinism, HTML structure validation)

</specifics>

<deferred>
## Deferred Ideas

- Validation Lulu réelle (upload PDF de test sur lulu.com pour confirmer acceptance) — checkpoint Phase 51 ou post-milestone
- Sprites alternatifs jour/nuit pour illustrations — phase ultérieure si l'utilisateur le demande
- Tolérance `scenes.length !== 6` — peut être réintroduit si beaucoup d'histoires existantes ne respectent pas
- Pull quote auto-extraction par AI — Phase 51+ si valeur perçue (Phase 49 = heuristique simple : 2ème phrase ou avant-dernière)
- Couleurs personnalisables par histoire — V2

</deferred>

---

*Phase: 49-layout-livre-generation-pdf*
*Context : Researcher HIGH confidence + 3 décisions utilisateur résolues*

---

## Note Wave 0 (2026-05-04 — utilisateur option 2)

Les 6 illustrations forêt ont été générées via **upscale `sharp` lanczos3 800×800 WebP → 2480×2480 PNG** :
- `assets/stories/illustrations-print/foret/{paysage,rencontre,decouverte,vulnerable,echange,etreinte}.png`
- Tailles : 7-13 MB chacun (total ~65 MB — à surveiller pour le bundle size de l'app)

⚠️ **Dette technique** : ces PNG sont un upscale algorithmique, pas un vrai 300 DPI natif. La qualité visuelle est correcte mais perfectible. À ré-générer en AI native (Midjourney HD / DALL-E 3) en post-milestone si retours utilisateur sur la qualité d'impression Lulu réelle.
