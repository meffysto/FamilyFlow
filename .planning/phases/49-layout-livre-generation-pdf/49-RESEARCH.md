# Phase 49 : Layout livre + génération PDF — Research

**Researched:** 2026-05-04
**Domain:** Pipeline HTML→PDF natif (expo-print iOS WKWebView), embedding offline (polices + images base64), bleed CSS, hash déterministe
**Confidence:** HIGH (sur le pipeline technique) / MEDIUM (sur le fallback texte-seul, design-driven)

## Summary

Phase 48 a posé toutes les fondations (`expo-print@~15.0.8` + `react-native-qrcode-svg` installés, Andika Regular+Bold bundlés, module `lib/pdf/` avec constantes Lulu et parser manifeste round-trip). Phase 49 doit assembler le pipeline de génération effectif.

**Trois contraintes structurantes** émergent de la recherche :

1. **iOS WKWebView refuse les URLs locales** — toutes les images ET polices doivent être inlinées en base64 dans le HTML (ce n'est pas négociable, c'est une limitation WebKit documentée par Expo).
2. **Le hash SHA-256 doit être calculé sur le HTML source, pas sur le PDF output** — `expo-print` injecte des métadonnées non-déterministes (`CreationDate`, `ModDate`) dans le PDF généré, ce qui casse strict equality entre deux runs. Hasher le HTML rend le hash significatif et déterministe.
3. **Les illustrations actuelles sont 800×800 WebP** — à pleine page Lulu 21cm + bleed (8.52 inch), cela ne donne que ~94 DPI, sous le minimum 300 DPI exigé pour l'impression. **C'est un blocker pour le critère #3 du milestone**. Solution proposée : régénérer les illustrations forêt en 2480×2480 PNG (~292 DPI à pleine page), ou borner explicitement leur usage à un format plus petit dans la mise en page (e.g. 16×16cm avec marge).

**Recommandation primaire :** structure le pipeline en 4 modules `lib/pdf/` (`asset-loader.ts` pour base64, `html-template.ts` builder par template literals, `pdf-generator.ts` orchestrateur expo-print + hash, `book-storage.ts` persistance vault). Hasher le HTML pré-rendu via `expo-crypto.digestStringAsync()` (à installer). Stocker le PDF à `12 - Impressions/PDFs/{storyId}-{YYYY-MM-DD}.pdf`. Cible perf < 5 sec atteinte par chargement parallèle des assets et caching mémoire des polices base64.

## User Constraints (from CONTEXT.md)

Aucun CONTEXT.md trouvé pour Phase 49 — la spec ROADMAP est la source unique. Toutes les décisions sont à la discrétion du planner sous contrainte des 6 critères de succès et requirements LAY-01→LAY-06 + PDF-06→PDF-09.

## Phase Requirements

| ID | Description (extrait ROADMAP) | Research Support |
|----|-------------------------------|------------------|
| LAY-01 | Structure 16 pages | `PAGE_COUNT = 16` figé Phase 48 + plan structure 16 pages ci-dessous (§ Structure 16 pages) |
| LAY-02 | Double-page | Pattern HTML `.spread { page-break-after: always }` (§ HTML/CSS template) |
| LAY-03 | Polices embarquées | Andika base64 `@font-face data:font/ttf` (§ Font embedding offline) |
| LAY-04 | Bleed | CSS `@page size: 21.64cm 21.64cm; margin: 0` + zone safe interne (§ Bleed implementation) |
| LAY-05 | Fallback texte-seul | 6 doubles pages avec ornements typographiques (§ Fallback texte-seul) |
| LAY-06 | Cohérence saga (badge tome) | Détection via `livreId + chapitre` du `BedtimeStory` (§ Saga / tome numbering) |
| PDF-06 | Pipeline génération | `expo-print.printToFileAsync()` (§ Pipeline expo-print) |
| PDF-07 | Hash SHA-256 | `expo-crypto` sur HTML source (§ Hash déterminisme) |
| PDF-08 | Assets HD ≥300 DPI | **Blocker** illustrations 800×800 actuelles (§ Illustrations source & shape) |
| PDF-09 | Perf < 5s | Stratégie chargement parallèle + cache mémoire (§ Performance budget) |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rendu HTML→PDF | Native iOS WKWebView (expo-print) | — | Seule API plateforme |
| Chargement asset → base64 | Pure JS (`lib/pdf/asset-loader.ts`) | expo-asset + expo-file-system/legacy | Asset.fromModule + readAsStringAsync |
| HTML template builder | Pure JS (`lib/pdf/html-template.ts`) | — | String literals, testable Jest |
| Hash SHA-256 | Native (`expo-crypto.digestStringAsync`) | Pure JS appelant | Hash = fonction sur HTML source |
| Persistance PDF | Vault iCloud (`lib/vault.ts.writeFile`) | Already coordinated NSFileCoordinator | Pattern projet existant |
| Mise à jour manifeste | Pure JS (`lib/pdf/manifest-parser` + vault) | — | Parser existant Phase 48 |
| Détection tome (saga) | Pure JS depuis `BedtimeStory.livreId/chapitre` | — | Déjà dans le frontmatter |

## Standard Stack

### Core (deltas Phase 49)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-print` | `~15.0.8` (Phase 48) | HTML→PDF natif | Installé Phase 48 [VERIFIED: package.json:42] |
| `expo-crypto` | `~15.0.8` (à installer) | SHA-256 du HTML source | API native déterministe SDK 54, recommandée Expo [CITED: docs.expo.dev/versions/latest/sdk/crypto] [ASSUMED] version `~15.0.8` à confirmer via `npx expo install expo-crypto` |
| `expo-asset` | `~12.0.x` (à installer) | `Asset.fromModule(require(...))` pour résoudre les require statiques en URI lisibles | API canonique Expo pour passer du `require()` Metro au `localUri` lisible par `FileSystem.readAsStringAsync` [CITED: docs.expo.dev] [ASSUMED] version pinning à confirmer |
| `expo-file-system/legacy` | `~19.0.21` (déjà installé) | `readAsStringAsync(uri, { encoding: 'base64' })` | Pattern projet existant `lib/vault.ts:23` [VERIFIED: lib/vault.ts:23, package.json:32] |

### Supporting (déjà dispo)

| Library | Version | Purpose |
|---------|---------|---------|
| `react-native-qrcode-svg` | `^6.3.21` | Préparé Phase 50 — peut être ignoré Phase 49 ou utilisé en `<svg>` inline pour la 4e couverture (à arbitrer plan 50 vs plan 49-04) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expo-crypto` | `js-sha256` npm pure JS | `expo-crypto` est natif (rapide, déterministe, déjà aligné SDK 54) ; `js-sha256` ajoute une dep tierce sans gain |
| Hasher le PDF output | Hasher le HTML source | PDF contient `CreationDate`/`ModDate` non-déterministes → strict equality cassée [CITED: htpbe.tech/blog/pdf-metadata-fields, abstractioneer.org] |
| `react-dom/server` pour template | String literals + builder fonctions | `react-dom/server` n'est pas dispo en RN runtime — pattern nécessairement string template |
| `expo-asset` | Lire directement `require(...).uri` | Sur iOS dev-client, `require()` retourne un `{ uri, width, height }` *ou* un nombre selon contexte — `Asset.fromModule(...).downloadAsync()` est l'API officielle stable |
| Stocker PDF en flat `12 - Impressions/{storyId}-{hash}.pdf` | Sous-dossier `12 - Impressions/PDFs/{storyId}-{date}.pdf` | Sous-dossier garde le manifeste lisible Obsidian, permet exports multiples du même storyId, et `.gitignore`/sync iCloud peut cibler `PDFs/` |

**Installation Phase 49 :**
```bash
npx expo install expo-crypto expo-asset
```

(`expo-print` et `react-native-qrcode-svg` sont déjà installés Phase 48.)

**Version verification :**
```bash
npm view expo-crypto version
npm view expo-asset version
```
À documenter dans le plan 49-01 — versions pinnées par le `bundledNativeModules.json` SDK 54.

## Story data shape

### Type canonique : `BedtimeStory` (lib/types.ts:761)

```typescript
interface BedtimeStory {
  id: string;
  titre: string;
  enfant: string;
  enfantId: string;
  univers: StoryUniverseId;        // 'foret' | 'ocean' | 'espace' | ...
  detail?: string;                  // sous-titre / description (optionnel)
  texte: string;                    // le récit complet en plain text
  date: string;                     // YYYY-MM-DD
  duree_lecture: number;            // secondes
  voice: StoryVoiceConfig;
  length?: 'courte' | 'moyenne' | 'longue' | 'tres-longue';
  audioMode?: 'off' | 'doux' | 'spectacle';
  ambienceVolume?: number;
  script?: StoryScript;             // V2 — sidecar .script.json (SFX)
  alignment?: StoryAudioAlignment;  // V2.3 — sidecar .alignment.json
  scenes?: StoryScenes;             // V3 — sidecar .scenes.json (PICTURE-BOOK)
  version: number;
  sourceFile: string;
  // Livre/chapitres (rétrocompat 100% — tous optionnels)
  livreId?: string;
  livreTitre?: string;
  chapitre?: number;                // base 1
  chapitreTitre?: string;
  personnages?: string[];
  memorySummary?: string;
  trancheAge?: '3-5' | '6-8' | '9+';
}
```

**Persistance** : un fichier `.md` par histoire dans `09 - Histoires/{enfant}/{date}-{universId}.md` (`STORIES_DIR = '09 - Histoires'`, `lib/stories.ts:4`). Le frontmatter est parsé par `parseBedtimeStory` (lib/parser.ts:3621) via un parser maison `parseStoryFrontmatter` (Hermes-safe, sans gray-matter — Buffer absent).

### Sidecar `<storyId>.scenes.json` — clé Phase 49

Quand présent, contient un array de `SceneSpec[]` (panelIndex, archetype, textStart, textEnd, highlights). Les scenes sont **les unités de page** du livre. Sans sidecar `scenes.json`, on tombe en fallback texte-seul.

```typescript
interface SceneSpec {
  panelIndex: number;          // base 1
  archetype: 'paysage' | 'rencontre' | 'decouverte' | 'vulnerable' | 'echange' | 'etreinte';
  textStart: number;            // index char inclusif dans BedtimeStory.texte
  textEnd: number;              // exclusif
  highlights: HighlightSpan[];  // mots-clés à colorer
}
interface StoryScenes { version: 1; scenes: SceneSpec[]; }
```

**Conséquence pour Phase 49 :** la structure des 16 pages varie selon présence du sidecar :

| Cas | Sidecar `.scenes.json` | Présence illustrations | Layout |
|-----|------------------------|------------------------|--------|
| **A — picture-book complet** | Oui | Oui (univers `foret` MVP) | Cover + page titre + N×scenes + 4ème → cible 16 pages |
| **B — texte-seul** | Non, ou univers non illustré | Non | Cover + page titre + 6 doubles-pages typographiques + 4ème (LAY-05) |

**Décision recommandée :** `pdf-generator.ts` reçoit un `BedtimeStory`, examine `story.scenes` ET `getIllustration(univers, archetype)` pour le premier scene, et bascule entre les 2 templates HTML.

[VERIFIED: lib/types.ts:761-797, lib/parser.ts:3621-3709, lib/stories.ts:4]

## Illustrations source & shape

### État actuel — résolution insuffisante pour print

**Source** : `assets/stories/illustrations/foret/{archetype}.webp` — 6 fichiers WebP **800×800** (vérifié via `file(1)` :  `RIFF Web/P image, VP8 encoding, 800x800`).

**Catalogue** : `lib/story-illustrations.ts` mappe `${universId}-${archetype}` → `require(...)` statique. Seul `foret` a un set complet (MVP). API : `getIllustration(universId, archetype): ImageSourcePropType | null`.

**Problème de résolution pour print** :

| Format de page Lulu 21×21cm + bleed 0.32cm | = 21.64 cm = 8.52 inch |
|---|---|
| Pour 300 DPI à pleine page | il faut ≥ 2556 × 2556 px |
| Pour 300 DPI à 16×16cm (zone illustration safe) | il faut ≥ 1890 × 1890 px |
| Source actuelle | 800 × 800 px = ~94 DPI à pleine page |

**Critère de succès #3 du milestone** exige "300 DPI minimum" → **non satisfait** avec les assets actuels. **C'est un blocker.**

### Options de remédiation

| Option | Effort | Risque |
|--------|--------|--------|
| **A. Régénérer les 6 forêt en 2480×2480 PNG** | Moyen — passer par DALL·E/Midjourney + downscale ; ajouter 6 fichiers print (~2-3 MB chacun) bundlés en plus des actuels 800×800 (UI) | Bas — pas de breaking change, juste un asset supplémentaire |
| **B. Borner les illustrations à 16×16cm + cadre décoratif** | Faible — pure CSS, pas de re-génération | 800×800 → 16cm = 127 DPI, **toujours sous 300 DPI** → ne résout pas |
| **C. Upscale algorithmique (Real-ESRGAN, Topaz, sharp lanczos)** | Faible-moyen — script Node `sharp` 800→2560 lanczos, qualité lecteur correcte mais pas "vrai 300 DPI" | Moyen — Lulu peut accepter visuellement, mais sous le seuil officiel |
| **D. Imposer un set "print" séparé** (`assets/stories/illustrations-print/foret/*.png` 2480px) chargé uniquement par le générateur PDF | Moyen | Bas — clair, pas d'impact UI runtime |

**Recommandation : Option D** — set print séparé bundlé, utilisé uniquement par `lib/pdf/asset-loader.ts`. Le catalogue `story-illustrations.ts` reste tel quel pour l'UI. Phase 49 ajoute `lib/pdf/print-illustrations.ts` avec un require map miroir pointant vers `assets/stories/illustrations-print/foret/*.png`. **Ces 6 fichiers print sont à produire par le développeur en pre-Wave 0** (régénération AI ou upscale qualité — décision design hors scope tech).

**Open question utilisateur #1** : la régénération des 6 illustrations forêt en 2480×2480 doit-elle se faire via prompt AI re-run (Midjourney v7 / DALL-E 3 HD) ou par upscale `sharp` lanczos des 800×800 existants ? La première donne un vrai 300 DPI mais coûte temps + variations stylistiques ; la seconde est rapide mais reste artificielle. **Dépend de la décision design**.

[VERIFIED: assets/stories/illustrations/foret/*.webp via file(1), lib/story-illustrations.ts:23-31]

## HTML template approach for expo-print

### Contraintes structurantes (de la recherche)

1. **Pas de `react-dom/server`** : RN n'a pas de DOM serveur — l'option string template literals + builder pattern est la seule.
2. **`@page` CSS partiellement supporté** : Safari/WKWebView ignore certaines propriétés `@page` (issue expo/expo#10943). En revanche les **options `width`/`height` et `margins` de `printToFileAsync`** sont bien supportées sur iOS depuis le PR #20046 (mergé). C'est l'API canonique pour fixer la taille de page.
3. **`useMarkupFormatter`** : si activé, peut ajouter une page blanche en fin si HTML non bien formé. **Toujours commencer le HTML par `<!DOCTYPE html>`**.
4. **Pas d'URLs locales pour images/polices** : tout en base64 inline (issue documentée Expo).

### Architecture recommandée — builder pattern pure

```
lib/pdf/html-template.ts
├── renderBookHtml(spec: BookHtmlSpec): string         // entry point
├── renderCoverPage(opts): string
├── renderTitlePage(opts): string
├── renderScenePage(opts): string                        // pour mode picture-book
├── renderTextOnlyPage(opts): string                     // pour mode fallback
├── renderBackCoverPage(opts): string
└── renderCss(palette, fontsBase64): string             // CSS partagé
```

```typescript
interface BookHtmlSpec {
  story: BedtimeStory;
  scenes: SceneSpec[] | null;            // null = mode fallback
  illustrations: Map<SceneArchetype, string>; // base64 data URIs (mode picture-book)
  fonts: { andikaRegular: string; andikaBold: string }; // base64
  palette: BookPalette;
  tomeBadge: { current: number; total: number } | null;  // null si pas une saga
}
```

Chaque `render*Page` retourne un `<section class="page">...</section>` complet. `renderBookHtml` les concatène, encadre dans `<!DOCTYPE html><html><head><style>${renderCss(...)}</style></head><body>...`.

### CSS clé

```css
@page {
  size: 21.64cm 21.64cm;       /* trim 21cm + bleed 2×0.32cm */
  margin: 0;
}

@font-face {
  font-family: 'Andika';
  src: url(data:font/ttf;base64,${ANDIKA_REGULAR_BASE64}) format('truetype');
  font-weight: normal;
}
@font-face {
  font-family: 'Andika';
  src: url(data:font/ttf;base64,${ANDIKA_BOLD_BASE64}) format('truetype');
  font-weight: bold;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  width: 21.64cm;
  font-family: 'Andika', serif;
  color: ${palette.ink};
  -webkit-print-color-adjust: exact;     /* iOS WKWebView : force impression couleurs */
  print-color-adjust: exact;
}

.page {
  width: 21.64cm;
  height: 21.64cm;
  page-break-after: always;
  page-break-inside: avoid;
  position: relative;
  overflow: hidden;
  background: ${palette.ivory};
}

.page:last-child { page-break-after: auto; }   /* évite blank trailing page (issue #7435) */

/* Bleed safe area : tout contenu critique reste à 0.32cm + 0.5cm marge intérieure = 0.82cm des bords */
.safe-area {
  position: absolute;
  inset: 0.82cm;                /* 0.32 bleed + 0.5 safety margin */
}

/* Fond plein bord (cover, illustrations) doit s'étendre dans le bleed */
.full-bleed {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Image déclarative pleine page */
.scene-illustration {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

### Appel `printToFileAsync` recommandé

```typescript
import * as Print from 'expo-print';

const PT_PER_CM = 28.346456693;  // 1cm = 28.3464567 PostScript points (72 DPI / 2.54)
const SIZE_PT = 21.64 * PT_PER_CM; // ≈ 613.4 pt — taille de page en points

await Print.printToFileAsync({
  html: htmlString,
  width: SIZE_PT,        // 21.64cm en points
  height: SIZE_PT,
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  // useMarkupFormatter laissé à false par défaut — notre HTML est bien formé
});
```

⚠️ **Pitfall** : sur iOS, les `width/height` sont en **points PostScript** (72 DPI), PAS en pixels. 1cm = 28.346 pt. Le PR keith-kurak/expo#20046 a explicitement restauré ce comportement [CITED: github.com/expo/expo/pull/20046].

[CITED: docs.expo.dev/versions/latest/sdk/print/, github.com/expo/expo/issues/16052, github.com/expo/expo/pull/20046, github.com/expo/expo/issues/7435, github.com/expo/expo/issues/10943]

## Font embedding offline (CRITICAL — LAY-03)

### Problème

`expo-print` rend du HTML statique offline. Les polices déclarées via `useFonts()` dans `app/_layout.tsx` sont accessibles à l'app RN mais **WKWebView en mode print ne voit pas ces polices automatiquement**. La seule façon garantie d'embarquer Andika dans le PDF généré est `@font-face { src: url(data:font/ttf;base64,...) }` inline dans le `<style>` du HTML.

### Procédure de chargement à runtime

```typescript
// lib/pdf/asset-loader.ts
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

const fontModuleMap = {
  andikaRegular: require('../../assets/fonts/Andika/Andika-Regular.ttf'),
  andikaBold: require('../../assets/fonts/Andika/Andika-Bold.ttf'),
};

let cachedFonts: { andikaRegular: string; andikaBold: string } | null = null;

export async function loadFontsBase64(): Promise<{ andikaRegular: string; andikaBold: string }> {
  if (cachedFonts) return cachedFonts;  // cache mémoire pour les exports répétés
  const [reg, bold] = await Promise.all([
    loadAssetAsBase64(fontModuleMap.andikaRegular),
    loadAssetAsBase64(fontModuleMap.andikaBold),
  ]);
  cachedFonts = { andikaRegular: reg, andikaBold: bold };
  return cachedFonts;
}

async function loadAssetAsBase64(moduleId: number): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  if (!asset.localUri) await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Asset failed to download');
  return FileSystem.readAsStringAsync(asset.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}
```

**Tailles attendues** : Andika Regular ~784 KB, Bold ~799 KB (Phase 48 SUMMARY) → base64 ≈ +33% = ~2.1 MB de chaîne par police, **~4.2 MB total inline dans le HTML**. Acceptable mais explique en partie le budget perf 5s. Le caching mémoire (`cachedFonts`) est CRITIQUE pour les exports répétés (>1ère exécution = quasi-instantané).

### Format CSS final

```css
@font-face {
  font-family: 'Andika';
  src: url('data:font/ttf;base64,${reg}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Andika';
  src: url('data:font/ttf;base64,${bold}') format('truetype');
  font-weight: 700;
  font-style: normal;
}
```

⚠️ Utiliser `font-family: 'Andika'` (alias unifié) avec poids différents — pas `'Andika-Regular'` / `'Andika-Bold'` distincts. Plus idiomatique CSS, et indépendant des PostScript names réels du fichier (Pitfall A2 Phase 48).

[CITED: stackoverflow.com WKWebView base64 fonts pattern, docs.expo.dev/versions/latest/sdk/asset/]

## Saga / tome numbering

### Source du modèle livre/chapitre

Le `BedtimeStory` (lib/types.ts:782-796) contient déjà tous les champs livre, ajoutés en Phase précédente :
- `livreId?: string` — slug stable du livre auquel appartient ce chapitre
- `livreTitre?: string`
- `chapitre?: number` — numéro du chapitre dans le livre, base 1
- `chapitreTitre?: string`
- `personnages?: string[]`
- `memorySummary?: string`
- `trancheAge?: StoryAgeRange`

**Note importante** : dans ce projet, "saga" et "tome" ne sont PAS des termes du modèle de données stories. Le code projet utilise `livreId` + `chapitre`. Le terme "saga" appartient au domaine **mascotte / compagnon** (`Profile.sagaTitle`, `SagaItem`, `completedSagas`) et est sans rapport.

→ Pour Phase 49, on parle de **livre** (= ROADMAP "saga") et **chapitre** (= ROADMAP "tome").

### Détection du badge "tome 2/3" pour le PDF

```typescript
// lib/pdf/saga-detection.ts (ou inline dans pdf-generator.ts)
import type { BedtimeStory } from '../types';

interface TomeBadge {
  current: number;       // chapitre courant (story.chapitre)
  total: number;         // total chapitres connus du livre
  livreTitre: string;
}

export function detectTomeBadge(
  story: BedtimeStory,
  allStories: BedtimeStory[],   // toutes les histoires de l'enfant (ou globales)
): TomeBadge | null {
  if (!story.livreId || typeof story.chapitre !== 'number') return null;
  const sameLivre = allStories.filter(s => s.livreId === story.livreId);
  const total = Math.max(...sameLivre.map(s => s.chapitre ?? 0));
  if (total < 1 || story.chapitre < 1) return null;
  return {
    current: story.chapitre,
    total,
    livreTitre: story.livreTitre ?? story.titre,
  };
}
```

**Source du `allStories`** : le hook `storiesHook.stories` exposé par `useVault()`. Le générateur PDF doit accepter ce tableau en paramètre (ne pas le re-charger dans `lib/pdf/`).

**Affichage** : badge en **page de titre** (page 2 du livre) — "Tome 2 sur 3 du livre _Le Royaume Endormi_" — typographie Caveat 600 pour le ton manuscrit. Pas en couverture (réservée au titre/illustration principale).

[VERIFIED: lib/types.ts:782-796, lib/parser.ts:3697-3704, hooks/useVault.ts:2110]

## Structure 16 pages

### Mode A — picture-book (avec scenes)

| Folio | Type | Contenu |
|-------|------|---------|
| 1 | Cover (recto) | Titre + sous-titre + illustration `paysage` (full bleed) |
| 2 | Page de titre | Titre + auteur (`Pour ${enfant}`) + badge tome si saga + date |
| 3-14 | 12 pages scènes | 6 scènes × 2 pages chacune (illustration full-page + texte page suivante OU double-page illustrée) |
| 15 | Dédicace / fin | "Fin." + ornement + memorySummary court (si présent) |
| 16 | 4ème de couverture | QR code (Phase 50) + résumé court + "FamilyVault — Histoires du soir" |

**Décision layout double-page** : pour LAY-02, les pages 3-14 sont organisées en **6 doubles-pages**, chacune = (page paire = illustration / page impaire = texte). Spread = 21×42cm visuellement, mais expo-print génère 2 pages individuelles 21×21 (Lulu fait le reliage saddle-stitch).

**Si le sidecar `.scenes.json` a moins ou plus de 6 scènes** : tronquer ou padder. Si 4 scènes, ajouter 2 pages "ornement typographique" pour atteindre 16. Si 8 scènes, n'utiliser que les 6 premières (ou doubler certaines en split). **Décision recommandée Phase 49** : enforcer 6 scènes côté generator, refuser génération si `scenes.scenes.length !== 6` avec un message clair (les sidecars `.scenes.json` peuvent être ré-écrits par l'auteur pour respecter cette contrainte).

**Open question utilisateur #2** : que faire pour les histoires `foret` existantes dont `.scenes.json` n'a pas exactement 6 scènes ? Tolérance ± ou enforcement strict ?

### Mode B — texte-seul (fallback LAY-05)

| Folio | Type |
|-------|------|
| 1 | Cover — titre sur fond `ivory` + ornement floral central + `univers` en sous-titre |
| 2 | Page de titre — comme mode A |
| 3-14 | **6 doubles-pages** (12 folios) — texte découpé en 6 sections égales par longueur, chaque double-page = drop cap + texte + ornement séparateur |
| 15 | Fin — "Fin." + memorySummary |
| 16 | 4ème — comme mode A |

**Découpage du texte** : `splitTextIntoSections(story.texte, 6)` — coupe sur la frontière de phrase la plus proche du Nème de la longueur cible. Pas de mots cassés, ponctuation préservée.

## Bleed implementation

### CSS retenu (recap)

```css
@page {
  size: 21.64cm 21.64cm;   /* trim 21cm + 2 × bleed 0.32cm */
  margin: 0;
}
.page {
  width: 21.64cm;
  height: 21.64cm;
  background: ${palette.ivory};
}
/* Tout fond / illustration pleine page = full-bleed */
.full-bleed { position: absolute; inset: 0; }
/* Tout contenu critique (texte, titre) reste dans la safe area */
.safe-area { position: absolute; inset: 0.82cm; } /* 0.32 bleed + 0.5 safety */
```

### Pourquoi 21.64 cm × 21.64 cm

Lulu Direct exige que le **fichier source ait des dimensions = trim + bleed sur chaque bord**. Trim 21cm + bleed 0.32cm × 2 = **21.64 cm**. Le contenu visuellement tronqué après reliure tombe dans cette zone bleed.

### Vérification post-export

`pdfinfo file.pdf` doit montrer `Page size: 613.4 x 613.4 pts` (= 21.64cm × 28.346 pt/cm). Aperçu macOS → menu "Inspecteur" → onglet PDF → "Format de page". Si différent, débugger l'option `width/height` de `printToFileAsync`.

[VERIFIED: Phase 48 RESEARCH.md TRIM_SIZE_CM=21, BLEED_CM=0.32, lulu.com bleed specs]

## Hash déterminisme (CRITICAL — PDF-07)

### Problème : PDF non déterministe

`expo-print` (via WKWebView/UIKit sur iOS) génère un PDF qui contient **`/CreationDate (D:20260504123045+02'00')`** et **`/ModDate`** dans le PDF Info dictionary. Ces timestamps changent à chaque exécution → SHA-256 du fichier PDF change même si le HTML d'entrée est strictement identique. Le critère #5 du milestone ("Hash identique pour deux générations identiques") **ne peut PAS être satisfait en hashant le PDF output**.

[CITED: htpbe.tech/blog/pdf-metadata-fields-complete-reference, abstractioneer.org/2017/07/the-problem-with-creation-date-metadata]

### Solution : hasher le HTML source

```typescript
// lib/pdf/pdf-generator.ts
import * as Crypto from 'expo-crypto';

const html = renderBookHtml(spec);   // string déterministe
const hash = await Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256,
  html,
);
// hash est un hex string 64 chars
```

**Conditions de déterminisme du HTML** :
1. Pas de timestamp dynamique dans le template (n'utilise jamais `Date.now()` au moment du rendu — utilise `story.date` figé)
2. Pas d'iteration order JavaScript non-stable (utiliser `for (...) { }` sur tableaux ou `Map` qui garantit insertion order)
3. Le base64 des polices et images est identique entre 2 runs → ✓ par construction (assets bundlés statiques)
4. Pas de random / UUID dans le HTML

**Tradeoff documenté** : le hash certifie l'intégrité du **contenu source** (= ce qu'on a voulu imprimer), pas du **fichier PDF physique**. C'est en réalité plus utile pour l'utilisateur — on peut détecter "ai-je déjà exporté cette histoire avec ce contenu exact ?" sans être pollué par les CreationDate.

### Stockage du hash

Le hash va dans la colonne `Hash` du manifeste `12 - Impressions/manifeste.md` (parser Phase 48). Round-trip strict equality déjà couvert par les tests Jest.

[VERIFIED: lib/pdf/manifest-parser.ts (Phase 48)]

## Pipeline expo-print

### Orchestration `lib/pdf/pdf-generator.ts`

```typescript
import * as Print from 'expo-print';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { renderBookHtml } from './html-template';
import { loadFontsBase64, loadIllustrationBase64 } from './asset-loader';
import { TRIM_SIZE_CM, BLEED_CM, BOOK_PALETTE } from './constants';
import type { BedtimeStory } from '../types';
import type { BookManifestEntry } from './types';

const PT_PER_CM = 28.346456693;
const SIZE_PT = (TRIM_SIZE_CM + 2 * BLEED_CM) * PT_PER_CM; // = 613.4

interface GenerateBookPdfOptions {
  story: BedtimeStory;
  allStories: BedtimeStory[];   // pour détection tome
}

export async function generateBookPdf(
  opts: GenerateBookPdfOptions,
): Promise<{ uri: string; hash: string; entry: BookManifestEntry }> {
  const t0 = Date.now();

  // 1. Charger toutes les ressources en parallèle
  const [fonts, illustrations] = await Promise.all([
    loadFontsBase64(),
    loadAllIllustrationsForStory(opts.story),
  ]);

  // 2. Détecter tome
  const tomeBadge = detectTomeBadge(opts.story, opts.allStories);

  // 3. Construire HTML
  const html = renderBookHtml({
    story: opts.story,
    scenes: opts.story.scenes?.scenes ?? null,
    illustrations,
    fonts,
    palette: BOOK_PALETTE,
    tomeBadge,
  });

  // 4. Hash sur HTML (pas sur PDF)
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    html,
  );

  // 5. expo-print
  const result = await Print.printToFileAsync({
    html,
    width: SIZE_PT,
    height: SIZE_PT,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  if (__DEV__) {
    console.log(`[generateBookPdf] ${opts.story.id} — ${Date.now() - t0}ms — ${result.uri}`);
  }

  // 6. Construire l'entrée manifeste (storage Phase 49 séparé)
  const entry: BookManifestEntry = {
    id: opts.story.id,
    hash,
    date: new Date().toISOString().slice(0, 10),
    format: 'Lulu 21×21',
    chemin: '', // rempli par book-storage.ts après copie
  };

  return { uri: result.uri, hash, entry };
}
```

### Pitfalls expo-print

| # | Risque | Mitigation |
|---|--------|------------|
| 1 | Pas dans Expo Go | `expo-dev-client` déjà installé → OK |
| 2 | `printToFileAsync` retourne URI dans cache app | Copier vers vault iCloud (`book-storage.ts`) |
| 3 | Page blanche trailing | `<!DOCTYPE html>` + `.page:last-child { page-break-after: auto }` |
| 4 | iOS ignore `width/height` (versions < 47) | SDK 54 + expo-print 15.0.8 → fixé via PR #20046 [CITED] |
| 5 | Local URLs ignorés iOS | Tout en base64 (déjà adressé) |

## PDF storage in vault

### Convention recommandée

```
12 - Impressions/
├── manifeste.md                     # parser Phase 48
└── PDFs/
    ├── story_foret_2026-05-04.pdf
    ├── story_foret_2026-05-10.pdf   # ré-export, date différente
    └── story_pirates_2026-05-04.pdf
```

**Schéma de nommage** : `{storyId}-{YYYY-MM-DD}.pdf`. Permet plusieurs exports du même storyId à dates différentes (ré-impression). La date dans le nom = date d'export, pas date d'écriture de l'histoire.

### Implémentation

```typescript
// lib/pdf/book-storage.ts
import * as FileSystem from 'expo-file-system/legacy';
import { VaultManager } from '../vault';
import { MANIFESTE_FILE, parseManifeste, serializeManifeste } from './manifest-parser';
import type { BookManifestEntry } from './types';

const PDFS_DIR = '12 - Impressions/PDFs';

export async function persistBookPdf(
  vault: VaultManager,
  cacheUri: string,           // result.uri de expo-print (cache app)
  entry: Omit<BookManifestEntry, 'chemin'>,
): Promise<BookManifestEntry> {
  const filename = `${entry.id}-${entry.date}.pdf`;
  const relativePath = `${PDFS_DIR}/${filename}`;

  // 1. Ensure dir + copier le PDF de cache → vault iCloud
  await vault.ensureDir(PDFS_DIR);
  const targetUri = vault.uri(relativePath);
  await FileSystem.copyAsync({ from: cacheUri, to: targetUri });

  // 2. Mettre à jour le manifeste (parse → ajouter → serialize → write)
  const fullEntry: BookManifestEntry = { ...entry, chemin: relativePath };
  let entries: BookManifestEntry[] = [];
  try {
    const existing = await vault.readFile(MANIFESTE_FILE);
    entries = parseManifeste(existing);
  } catch {
    /* manifeste pas encore créé — Phase 48 a précisé : création paresseuse au premier export */
  }
  // Remplacement par (id, date) — pas seulement par id (autorise multi-exports)
  const idx = entries.findIndex(e => e.id === fullEntry.id && e.date === fullEntry.date);
  if (idx >= 0) entries[idx] = fullEntry;
  else entries.push(fullEntry);
  await vault.writeFile(MANIFESTE_FILE, serializeManifeste(entries));

  return fullEntry;
}
```

⚠️ **Pitfall iCloud** : `FileSystem.copyAsync` peut échouer silencieusement sur dossier iCloud non synchronisé. Le projet a déjà des helpers `coordinatedWriteFile` dans `lib/vault.ts:144` qui passent par NSFileCoordinator. **Pour les binaires PDF** : `FileSystem.copyAsync` est probablement OK sur iOS (le file coordination intervient à la lecture côté Obsidian), mais à valider en test device. Fallback éventuel : lire le PDF en base64 + écrire via `vault.writeFile` (mais expansion +33% en mémoire — pas idéal pour binaires multi-MB).

[VERIFIED: lib/vault.ts:135-157, Phase 48 RESEARCH parseManifeste/serializeManifeste]

## Performance budget (PDF-09)

### Budget cible

5 secondes pour une "histoire moyenne" (`length: 'moyenne'`, ~5-7 minutes lecture, ~2000-3000 mots).

### Décomposition probable du temps (estimation)

| Étape | Temps estimé | Stratégie |
|-------|-------------|-----------|
| Charger 2 polices Andika base64 (~1.6 MB → ~2.1 MB b64) | 200-400ms first run, **<5ms cached** | Cache mémoire `cachedFonts` |
| Charger 6 illustrations 2480×2480 PNG ~2 MB chacune → b64 ~2.7 MB | 600ms-1.5s first run, **<5ms cached** | Cache mémoire `cachedIllustrations` |
| Construire HTML (~5 MB string concat) | 50-150ms | String literals, pas de DOM |
| `Crypto.digestStringAsync` SHA-256 sur 5 MB | 100-200ms | Natif |
| `Print.printToFileAsync` (WKWebView render + PDF) | **2-3 sec** (le gros morceau) | Aucun levier — natif |
| Copier cache → vault iCloud | 50-200ms | NSFileCoordinator géré |
| Update manifeste (parse + serialize + write) | 20-50ms | Texte court |
| **Total first run** | **~4-5 sec** | À surveiller |
| **Total cached run (2nd export)** | **~2.5-3.5 sec** | Confortable |

### Mesure dans __DEV__ (critère #4)

```typescript
const t0 = Date.now();
// ... pipeline
console.log(`[generateBookPdf] ${storyId} — ${Date.now() - t0}ms`);
```

**Étapes intermédiaires** à logger : assets, html, hash, print, persist. Permet d'identifier le bottleneck lors d'une dérive.

### Levers d'optimisation si > 5s

1. **Caching agressif** des base64 polices et illustrations (déjà recommandé)
2. **Parallélisme** `Promise.all` pour assets (déjà recommandé)
3. **Réduire les illustrations** : 2480×2480 PNG ~2 MB peut être compressé en 1500×1500 JPEG quality 85 ~400 KB → DPI ~176 (sous 300 mais Lulu accepte avec warning) — tradeoff fidélité/taille
4. **Pré-warm** : appeler `loadFontsBase64()` au boot de l'app (dans `app/_layout.tsx` après les useFonts) — exports paraissent instantanés

## Fallback texte-seul (LAY-05)

> Section design-driven — input utilisateur recommandé. Voir Open Question #3.

### Pattern proposé (sans précédent codebase)

Pour les histoires **sans `.scenes.json`** ou univers non-illustré :

| Élément | Choix proposé |
|---------|---------------|
| Découpage texte | 6 sections égales (par longueur de chars, frontières phrase) |
| Layout double-page | (gauche = drop cap initiale + premier paragraphe / droite = suite + ornement) |
| **Drop cap** | Première lettre 5em, font Caveat 600, couleur `terracotta` |
| **Ornement séparateur** | Symboles Unicode + Andika : ✦ · ✦ · ✦ ; ou ❦ centré ; ou ligne pointillée |
| **Pull quote** | Une citation tirée du texte (premier dialogue ou phrase la plus courte) en page 4 et page 12, italique Caveat, terracotta |
| **Marges intérieures** | 1.5cm partout dans la safe area |
| **Texte body** | Andika Regular 14pt, line-height 1.6 |

### Précédent dans le codebase

Aucun. Le mockup `.planning/quick/story-typo-mockup/` (mentionné dans `lib/story-illustrations.ts:9-10`) **pourrait** contenir des références — à inspecter en début de Phase 49. Si vide, c'est de la conception fraîche.

**Open question utilisateur #3** : la palette d'ornements typographiques (drop caps, séparateurs, pull quotes) est-elle déjà décidée ou à créer ? Si à créer, recommander un mood-board minimal (3 références visuelles) avant le plan 49-04.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML→PDF | Custom rendering | `expo-print.printToFileAsync` | API native iOS/Android, déjà installé |
| SHA-256 | Custom JS impl | `expo-crypto.digestStringAsync` | Natif, déterministe |
| Asset → base64 | Custom file read | `expo-asset.Asset.fromModule` + `FileSystem.readAsStringAsync({ encoding: 'base64' })` | API canonique Expo |
| Markdown table parser | Custom regex | `parseManifeste` (Phase 48) | Existant, testé round-trip |
| QR code SVG | Manual matrix | `react-native-qrcode-svg` (Phase 50) | Phase 50, mais déjà installé |
| Markdown frontmatter | gray-matter | `parseStoryFrontmatter` existant | Hermes-safe (gray-matter crash sur Buffer) [VERIFIED: lib/parser.ts:3587] |
| Bleed CSS calculation | Custom layout | CSS `@page size` + `width/height` options expo-print | Standard print CSS |

## Common Pitfalls

### Pitfall 1 : iOS expo-print ignore les URLs locales pour images/polices
**What goes wrong :** Si tu fais `<img src="file:///.../image.png">` ou `@font-face { src: url('...') }` avec un URI local, le PDF généré ne contient ni l'image ni la police.
**Why :** Limitation WKWebView documentée par Expo et Apple — sécurité, pas de chargement cross-origin.
**How to avoid :** Tout en base64 inline. Pour les images : `<img src="data:image/png;base64,...">`. Pour les polices : `@font-face { src: url(data:font/ttf;base64,...) }`.
**Warning signs :** PDF avec rectangles blancs à la place des images, ou texte rendu en Helvetica au lieu d'Andika.

### Pitfall 2 : `width`/`height` interprétés comme pixels au lieu de points
**What goes wrong :** `width: 2480, height: 2480` → expo-print attend des points PostScript (1pt = 1/72 inch). 2480 pt = 87 cm de page, énorme.
**Why :** Convention API expo-print/iOS UIKit.
**How to avoid :** **Toujours** convertir cm → points : `cm × 28.346`. 21.64 cm × 28.346 = **613.4 pt**.
**Warning signs :** PDF généré avec dimensions inattendues vu via `pdfinfo`.

### Pitfall 3 : Page blanche trailing après le contenu
**What goes wrong :** Le PDF a une 17ème page vide.
**Why :** `useMarkupFormatter` + HTML mal formé, OU `page-break-after: always` sur la dernière `.page`.
**How to avoid :** `<!DOCTYPE html>` au début + `.page:last-child { page-break-after: auto }` (et non `always`).
**Warning signs :** Lulu refuse l'upload "page count not multiple of 4" ou "extra blank page".

### Pitfall 4 : Hash non déterministe à cause des métadonnées PDF
**What goes wrong :** SHA-256 du PDF change entre 2 runs identiques.
**Why :** `CreationDate` / `ModDate` injectés par WKWebView.
**How to avoid :** Hasher le HTML source, pas le PDF. (Section Hash déterminisme).
**Warning signs :** Test "deux exports identiques → même hash" échoue alors que le contenu visible est strictement identique.

### Pitfall 5 : Polices invisibles dans le PDF malgré base64 dans CSS
**What goes wrong :** PDF affiche du texte en Helvetica au lieu d'Andika.
**Why :** Plusieurs causes possibles :
1. Le `format('truetype')` est manquant ou incorrect (TTF = `truetype`, pas `opentype`).
2. Le `font-family` du `@font-face` ne matche pas celui utilisé en `body { font-family: ... }`.
3. La déclaration `@font-face` est après les éléments qui l'utilisent.
4. Encodage base64 cassé (caractères `\n` dans la string).
**How to avoid :**
1. Toujours `format('truetype')` pour `.ttf`.
2. Utiliser le même `font-family: 'Andika'` partout.
3. `<style>` dans `<head>` avant `<body>`.
4. Ne pas wrap-line le base64 (string brute, sans `\n`).
**Warning signs :** Inspector Aperçu macOS → onglet Polices → liste vide ou Helvetica seulement.

### Pitfall 6 : `expo-asset` `localUri` null sur première utilisation
**What goes wrong :** `Asset.fromModule(...).localUri` est `null` au premier accès → `readAsStringAsync` crash.
**Why :** Asset pas encore téléchargé/extrait du bundle.
**How to avoid :** **Toujours** appeler `await asset.downloadAsync()` avant de lire `asset.localUri`. C'est une no-op si déjà téléchargé.
**Warning signs :** Erreur runtime `Cannot read property 'localUri' of null` au 1er export.

### Pitfall 7 : Illustrations 800×800 sous le seuil 300 DPI
**What goes wrong :** Critère #3 milestone non satisfait, Lulu peut refuser l'impression ou tirer un livre flou.
**Why :** Les assets actuels sont dimensionnés pour l'écran (UI mode picture-book), pas pour l'impression.
**How to avoid :** Set print dédié `assets/stories/illustrations-print/foret/*.png` 2480×2480. Voir Open Question #1.
**Warning signs :** Aperçu macOS → image agrandie pixelisée à pleine page.

## Code Examples

### Exemple 1 — Builder de page cover (mode A)

```typescript
// lib/pdf/html-template.ts (extrait)

function renderCoverPage(opts: {
  titre: string;
  univers: StoryUniverseId;
  coverImageBase64: string;
  palette: BookPalette;
}): string {
  return `
    <section class="page cover">
      <img class="full-bleed scene-illustration" src="data:image/png;base64,${opts.coverImageBase64}" alt="" />
      <div class="cover-overlay">
        <h1 class="cover-title">${escapeHtml(opts.titre)}</h1>
      </div>
    </section>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}
```

### Exemple 2 — Pipeline orchestrateur (entry point public)

```typescript
// lib/pdf/index.ts (Phase 49 ajoute)
export { generateBookPdf } from './pdf-generator';
export { persistBookPdf } from './book-storage';

// hooks/useVaultStories.ts (callsite probable Phase 49)
import { generateBookPdf, persistBookPdf } from '../lib/pdf';

async function exporterHistoirePdf(story: BedtimeStory) {
  const { uri, hash, entry } = await generateBookPdf({
    story,
    allStories: storiesHook.stories,
  });
  const fullEntry = await persistBookPdf(vaultRef.current!, uri, entry);
  return { hash: fullEntry.hash, chemin: fullEntry.chemin };
}
```

### Exemple 3 — Loader illustrations base64

```typescript
// lib/pdf/asset-loader.ts (extrait illustrations)
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import type { SceneArchetype, StoryUniverseId } from '../types';

const PRINT_ILLUSTRATIONS: Partial<Record<string, number>> = {
  'foret-paysage':    require('../../assets/stories/illustrations-print/foret/paysage.png'),
  'foret-rencontre':  require('../../assets/stories/illustrations-print/foret/rencontre.png'),
  'foret-decouverte': require('../../assets/stories/illustrations-print/foret/decouverte.png'),
  'foret-vulnerable': require('../../assets/stories/illustrations-print/foret/vulnerable.png'),
  'foret-echange':    require('../../assets/stories/illustrations-print/foret/echange.png'),
  'foret-etreinte':   require('../../assets/stories/illustrations-print/foret/etreinte.png'),
};

const cache = new Map<string, string>();

export async function loadIllustrationBase64(
  univers: StoryUniverseId,
  archetype: SceneArchetype,
): Promise<string | null> {
  const key = `${univers}-${archetype}`;
  if (cache.has(key)) return cache.get(key)!;
  const moduleId = PRINT_ILLUSTRATIONS[key];
  if (!moduleId) return null;
  const asset = Asset.fromModule(moduleId);
  if (!asset.localUri) await asset.downloadAsync();
  if (!asset.localUri) return null;
  const b64 = await FileSystem.readAsStringAsync(asset.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  cache.set(key, b64);
  return b64;
}
```

## Runtime State Inventory

Phase greenfield (création nouveau pipeline), pas de rename/refactor — section non applicable.

**Note** : aucune entrée du manifeste n'existe en runtime à ce stade (Phase 48 a documenté la création paresseuse du fichier `12 - Impressions/manifeste.md` au premier export — c'est Phase 49 qui fait ce premier export).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `expo-print` | génération PDF | ✓ | `~15.0.8` | — [VERIFIED: package.json:42] |
| `react-native-qrcode-svg` | (Phase 50) | ✓ | `^6.3.21` | — [VERIFIED: package.json:61] |
| `expo-file-system/legacy` | I/O assets + vault | ✓ | `~19.0.21` | — [VERIFIED: package.json:32, lib/vault.ts:23] |
| `expo-font` | police déjà loadée Phase 48 | ✓ | `~14.0.11` | — [VERIFIED: package.json:33] |
| **`expo-crypto`** | SHA-256 du HTML | ✗ | — | **Install requis Phase 49** |
| **`expo-asset`** | Asset.fromModule pour b64 | ✗ | — | **Install requis Phase 49** |
| Andika TTF Regular+Bold | embedding @font-face | ✓ | bundled `assets/fonts/Andika/` | — [VERIFIED: Phase 48 SUMMARY] |
| `assets/stories/illustrations-print/foret/*.png` 2480×2480 | LAY-04 + PDF-08 | ✗ | — | **À produire — voir Open Q #1** |
| `expo-dev-client` | tester sur device | ✓ | `~6.0.20` | — [VERIFIED: package.json:30] |

**Missing dependencies with fallback :**
- (aucun)

**Missing dependencies — blocking :**
- `expo-crypto` (PDF-07 hash déterministe)
- `expo-asset` (LAY-03 fonts inline + PDF-08 illustrations inline)
- 6 fichiers `assets/stories/illustrations-print/foret/*.png` 2480×2480 (PDF-08 ≥300 DPI)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `jest@^29.7.0` + `jest-expo@~54.0.17` + `ts-jest@^29.4.6` |
| Config file | `jest.config.js` (existant Phase 48) |
| Quick run command | `npx jest --no-coverage lib/__tests__/pdf-html-template.test.ts` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAY-01 | 16 pages générées (mode A et B) | unit | `npx jest --no-coverage lib/__tests__/pdf-html-template.test.ts -t "16 pages"` | ❌ Wave 0 |
| LAY-02 | Double-page: 6 pairs `page-break-after: always` détectés | unit (regex sur HTML rendu) | idem | ❌ Wave 0 |
| LAY-03 | `@font-face` Andika base64 présent | unit (HTML contient pattern) | idem | ❌ Wave 0 |
| LAY-04 | `@page size: 21.64cm` présent + `.full-bleed inset: 0` | unit | idem | ❌ Wave 0 |
| LAY-05 | Mode B sans scenes → 6 doubles-pages générées | unit | idem | ❌ Wave 0 |
| LAY-06 | Tome badge si livreId+chapitre dans story | unit (`detectTomeBadge` pure func) | `npx jest --no-coverage lib/__tests__/pdf-saga-detection.test.ts` | ❌ Wave 0 |
| PDF-06 | Pipeline E2E ne crash pas | manual-only (device, expo-print natif) | `npx expo run:ios --device` + tap export | manual |
| PDF-07 | Hash identique pour 2 runs HTML identiques | unit | `npx jest --no-coverage lib/__tests__/pdf-hash.test.ts` | ❌ Wave 0 |
| PDF-08 | Illustration print 2480×2480 chargeable | manual (asset disponibilité) | inspection visuelle PDF + `pdfinfo` | manual |
| PDF-09 | Génération < 5s histoire moyenne | manual (mesure `Date.now()` __DEV__) | console log lors d'un export device | manual |
| QA-01 | TS clean | unit | `npx tsc --noEmit` | ✅ |
| QA-02 | Jest clean | unit | `npx jest --no-coverage` | ✅ |

### Sampling Rate

- **Per task commit :** `npx tsc --noEmit && npx jest --no-coverage --findRelatedTests <files>`
- **Per wave merge :** `npx tsc --noEmit && npx jest --no-coverage`
- **Phase gate :** full suite verte + 1 export device manuel par mode (A picture-book + B fallback) + visualisation PDF dans Aperçu macOS confirmant 16 pages, dimensions 21.64×21.64 cm, polices Andika listées dans Inspecteur

### Wave 0 Gaps

- [ ] `lib/__tests__/pdf-html-template.test.ts` — couvre LAY-01 à LAY-05 (regex HTML structuré)
- [ ] `lib/__tests__/pdf-saga-detection.test.ts` — couvre LAY-06 (`detectTomeBadge` pure)
- [ ] `lib/__tests__/pdf-hash.test.ts` — couvre PDF-07 (deux appels même input → même hash)
- [ ] `assets/stories/illustrations-print/foret/{paysage,rencontre,decouverte,vulnerable,echange,etreinte}.png` — 6 fichiers 2480×2480 (Wave 0 manuel, voir Open Q #1)
- [ ] `npx expo install expo-crypto expo-asset` — wave 0 install

## Security Domain

> Phase à enjeu sécurité **bas** (génération locale, pas de réseau, pas d'auth, pas d'input externe non maîtrisé).

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | non | — |
| V3 Session Management | non | — |
| V4 Access Control | non | — |
| V5 Input Validation | **oui** | `escapeHtml()` sur tous les champs `BedtimeStory` injectés dans le template (titre, texte, livreTitre, etc.) |
| V6 Cryptography | **oui** | `expo-crypto.digestStringAsync(SHA256)` — ne jamais hand-roll |

### Threat patterns

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| HTML injection via `story.titre` ou `story.texte` (si un caractère `<script>` arrive dans le markdown) | Tampering | `escapeHtml()` sur **tous** les champs avant interpolation. Test unitaire avec `<script>` dans titre. |
| Path traversal via `storyId` dans le nom de fichier `{id}-{date}.pdf` | Tampering | `lib/vault.ts` a déjà `assertSafeRelativePath` ; `storyId` est dérivé du nom de fichier source, déjà borné [VERIFIED: lib/parser.ts:3658-3659] |
| Hash collision pour exfiltration | Information Disclosure | SHA-256 = collision-resistant, pas de risque pratique |
| Lecture asset hors bundle | Tampering | `Asset.fromModule(require(...))` n'accepte que des modules statiques résolus par Metro — pas d'input dynamique |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-native-html-to-pdf` (deprecated) | `expo-print` 15.0.8 (TurboModule, WKWebView) | Expo SDK 49+ | API plus simple, mieux maintenu |
| Hash du fichier PDF | Hash du HTML source | Best practice 2024+ pour PDFs déterministes | Évite les CreationDate/ModDate parasites |
| Local file URLs dans HTML | Base64 inline | iOS WKWebView constraint depuis iOS 9 | Augmente taille HTML mais seul moyen offline |
| `Font.loadAsync` impératif | `useFonts()` hook + `@font-face` data URI | expo-font 11+, expo-print 13+ | Cohérent React, fonts dispos UI ET PDF |

**Deprecated :**
- `react-native-html-to-pdf` — abandonné, ne pas utiliser
- `expo-print < 13.x` — width/height ignorés sur iOS [CITED: github.com/expo/expo/pull/20046]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `expo-crypto` version pinning SDK 54 ≈ `~15.0.8` | Standard Stack | Faible — `npx expo install` corrigera, juste mettre à jour le pin dans le plan 49-01 |
| A2 | `expo-asset` est l'API canonique 2026 (pas Asset.loadAsync legacy) | Standard Stack | Faible — pattern documenté Expo SDK 54, à valider en lecture rapide docs.expo.dev/sdk/asset au moment du plan |
| A3 | iOS WKWebView refuse les URLs locales pour images ET polices (pas seulement images) | iOS WKWebView | Moyen — explicitement documenté pour images, **présumé** identique pour fonts. À tester très tôt en Phase 49 (smoke test 1 page avec font url('file://...') VS data URI) |
| A4 | Ré-générer 6 illustrations 2480×2480 PNG est faisable hors codebase (AI ou upscale) | Illustrations source | Moyen — dépend décision design utilisateur (Open Q #1) |
| A5 | `splitTextIntoSections(texte, 6)` produit un découpage acceptable visuellement (frontières phrase) | Fallback texte-seul | Moyen — règle déterministe, mais peut produire sections déséquilibrées sur des textes courts. À polir au plan 49-04 |
| A6 | Le `cachedSnapshot.stories` du VaultCache contient bien les `BedtimeStory` à jour pour la détection tome | Saga / tome | Faible — `useVault.ts:2110` montre que `stories` est dans le cache, à jour à chaque load |
| A7 | Lulu Direct accepte les PDFs sans `/CreationDate` cohérent (il n'y a pas de check) | Hash déterminisme | Très faible — Lulu valide le contenu visuel, pas les métadonnées Info dictionary |
| A8 | Le sidecar `.scenes.json` existe déjà pour les histoires `foret` créées en V3 | Story data shape | Moyen — à vérifier en Wave 0 : lister `09 - Histoires/{enfant}/` et compter `.md` vs `.scenes.json`. Si aucune n'a de sidecar, le mode picture-book est inactif → tester avec une histoire fixture |
| A9 | `expo-print` ne tronque pas le HTML > 5 MB | Performance | Faible — pas de limite documentée, mais à monitorer (les images base64 4×2.7 MB = 10 MB de string total) |

## Open Questions

> Volontairement court (≤3) — input utilisateur explicite requis avant Phase 49.

1. **Régénération des 6 illustrations forêt en print (≥300 DPI)**
   - What we know : assets actuels = 800×800 WebP (≈94 DPI à pleine page). Le critère #3 du milestone exige ≥ 300 DPI.
   - What's unclear : nouvelle génération AI (qualité native, coût temps + variations stylistiques) VS upscale `sharp` lanczos (rapide, pseudo-300 DPI) ?
   - Recommendation : régénérer via prompt AI re-run avec consigne "même style cohérent que les WebP existants" — bénéfice qualité long terme. Si pas dispo, upscale `sharp` 800→2480 lanczos comme fallback Phase 49 immédiat (et ré-générer plus tard).

2. **Tolérance `.scenes.json` ≠ 6 scènes**
   - What we know : la structure 16 pages prévoit 6 scènes pour le mode A.
   - What's unclear : que faire si une histoire foret existante a 4 ou 8 scènes dans son sidecar ?
   - Recommendation : Phase 49 enforce strict (refuser génération avec message "L'histoire doit avoir exactement 6 scènes"). Tolérance ± peut venir en Phase ultérieure si besoin émerge.

3. **Visuel du fallback texte-seul (LAY-05)**
   - What we know : 6 doubles-pages avec ornements typographiques requises.
   - What's unclear : vocabulaire visuel précis (drop caps style, séparateurs, palette des ornements). Référence visuelle ?
   - Recommendation : minimal acceptable Phase 49 = drop cap Caveat 5em terracotta + séparateur ✦·✦·✦ + pull quote optionnelle. Si l'utilisateur a un mood-board ou des refs Pinterest, les intégrer. Sinon livrer le pattern minimal et itérer en Phase 51 si besoin.

## Recommendations Summary

(Lecture directe pour le planner — décisions concrètes à appliquer)

| Décision | Valeur retenue | Source |
|----------|----------------|--------|
| Deps à installer | `expo-crypto` + `expo-asset` (`npx expo install`) | Section Environment |
| Fichiers à produire (Wave 0) | 6 PNG 2480×2480 dans `assets/stories/illustrations-print/foret/` | Section Illustrations |
| Architecture interne `lib/pdf/` (Phase 49 ajoute) | `asset-loader.ts` + `html-template.ts` + `pdf-generator.ts` + `book-storage.ts` + tests `lib/__tests__/pdf-*.test.ts` | Section Architectural Map |
| Page size | 21.64 cm × 21.64 cm (= 613.4 pt × 613.4 pt) | Bleed Lulu 0.32 cm × 2 |
| Font embedding | `@font-face` + `data:font/ttf;base64` + `format('truetype')` + alias `font-family: 'Andika'` | Section Font embedding |
| Image embedding | `<img src="data:image/png;base64,...">` inline | iOS WKWebView constraint |
| Hash | SHA-256 du **HTML source** via `expo-crypto.digestStringAsync` | Section Hash déterminisme |
| Pipeline call | `Print.printToFileAsync({ html, width: 613.4, height: 613.4, margins: {0,0,0,0} })` | Section Pipeline expo-print |
| Stockage PDF | `12 - Impressions/PDFs/{storyId}-{YYYY-MM-DD}.pdf` | Section PDF storage |
| Mise à jour manifeste | `parseManifeste` → upsert sur (id, date) → `serializeManifeste` → `vault.writeFile` | Phase 48 parser réutilisé |
| Détection tome | Pure func `detectTomeBadge(story, allStories)` sur `livreId + chapitre` | Section Saga / tome |
| Mode A (picture-book) | 16 pages : Cover + Title + 6 doubles-pages scènes + Fin + Back | Structure 16 pages |
| Mode B (fallback) | 16 pages : Cover + Title + 6 doubles-pages texte+ornements + Fin + Back | LAY-05 |
| Cache mémoire | `cachedFonts` + `cachedIllustrations` Map<string, string> | Performance |
| Tests Wave 0 | 3 fichiers : `pdf-html-template.test.ts`, `pdf-saga-detection.test.ts`, `pdf-hash.test.ts` | Validation Architecture |
| Plans recommandés | 49-01 (assets HD + html-template + asset-loader), 49-02 (composants layout cover/title/scene/back), 49-03 (pdf-generator + hash + book-storage), 49-04 (fallback texte-seul + tome badge + perf measurement) | Cohérent ROADMAP |

## Sources

### Primary (HIGH confidence)
- `lib/types.ts:705-938` — types `BedtimeStory`, `StoryScenes`, `SceneSpec`, `SceneArchetype`, `HighlightSpan`
- `lib/parser.ts:3540-3709` — `serializeBedtimeStory`, `parseBedtimeStory`, `parseStoryFrontmatter` (Hermes-safe)
- `lib/stories.ts:1-270` — `STORIES_DIR`, conventions de chemins
- `lib/story-illustrations.ts:1-86` — catalogue illustrations actuel + API `getIllustration`
- `lib/vault.ts:23, 135-196` — patterns `writeFile`, `ensureDir`, `coordinatedWriteFile`
- `lib/pdf/{constants,types,manifest-parser,index}.ts` — fondation Phase 48 confirmée
- `package.json:20-68` — versions deps installées
- `assets/stories/illustrations/foret/*.webp` — vérifié `file(1)` : 800×800 VP8
- Phase 48 RESEARCH.md + PHASE-SUMMARY.md — décisions amont
- ROADMAP.md:440-461 — spec Phase 49

### Secondary (MEDIUM confidence)
- [Print - Expo Documentation](https://docs.expo.dev/versions/latest/sdk/print/) — API `printToFileAsync`, options `width/height/margins`
- [github.com/expo/expo/pull/20046](https://github.com/expo/expo/pull/20046) — fix iOS width/height (mergé)
- [github.com/expo/expo/issues/16052](https://github.com/expo/expo/issues/16052) — historique du bug width/height
- [github.com/expo/expo/issues/10943](https://github.com/expo/expo/issues/10943) — `@page` CSS partiellement supporté Safari
- [github.com/expo/expo/issues/7435](https://github.com/expo/expo/issues/7435) — page blanche trailing, mitigation DOCTYPE
- [docs.expo.dev/versions/latest/sdk/asset/](https://docs.expo.dev/versions/latest/sdk/asset/) — `Asset.fromModule` pattern
- [docs.expo.dev/versions/latest/sdk/crypto/](https://docs.expo.dev/versions/latest/sdk/crypto/) — `digestStringAsync`
- [docs.expo.dev/versions/latest/sdk/filesystem/](https://docs.expo.dev/versions/latest/sdk/filesystem/) — `readAsStringAsync` base64
- [htpbe.tech/blog/pdf-metadata-fields-complete-reference](https://htpbe.tech/blog/pdf-metadata-fields-complete-reference) — PDF Info dictionary CreationDate/ModDate non-déterminisme
- [abstractioneer.org/2017/07/the-problem-with-creation-date-metadata](https://www.abstractioneer.org/2017/07/the-problem-with-creation-date-metadata) — confirme caractère non-déterministe

### Tertiary (LOW confidence — ASSUMED)
- Versions exactes de `expo-crypto` et `expo-asset` au pin SDK 54 (à confirmer via `npx expo install`)
- A3 : refus iOS WKWebView des URLs locales pour fonts identique au refus pour images (présumé par symétrie, à smoke-tester)
- Lulu Direct accepte fichiers sans `/CreationDate` cohérent (présumé — Lulu valide visuellement, pas le PDF metadata)

## Metadata

**Confidence breakdown :**
- Pipeline expo-print + WKWebView constraints : **HIGH** — 4 issues GitHub Expo + docs officielles convergentes
- Story data shape (`BedtimeStory`, `SceneSpec`, sidecar) : **HIGH** — code lu directement
- Hash déterminisme (HTML vs PDF) : **HIGH** — supporté par 2 sources indépendantes + raisonnement structurel
- Fallback texte-seul design : **MEDIUM** — pattern proposé sans précédent codebase, dépend décision design utilisateur
- Illustrations 300 DPI : **HIGH** sur le diagnostic (800×800 = 94 DPI), **MEDIUM** sur la solution (set print séparé)

**Research date :** 2026-05-04
**Valid until :** 2026-06-04 (30 jours — expo-print API stable, deps SDK 54 figées)
