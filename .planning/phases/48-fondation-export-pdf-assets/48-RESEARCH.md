# Phase 48 : Fondation export PDF + assets — Research

**Researched:** 2026-05-04
**Domain:** Infrastructure technique (deps natives, polices bundled, parser markdown bidirectionnel)
**Confidence:** HIGH

## Summary

Phase d'infrastructure pour le milestone v1.8 (export PDF imprimable). Toutes les dépendances cibles ont été vérifiées contre le registre npm officiel et le manifeste `bundledNativeModules.json` d'Expo SDK 54 livré dans `node_modules/expo/`. Le projet a déjà des conventions claires pour les polices custom (Google Fonts via `@expo-google-fonts/*` + `useFonts()` dans `app/_layout.tsx`) et pour les parsers markdown bidirectionnels (`lib/parser.ts` + tests round-trip dans `lib/__tests__/`).

**Recommandation primaire :** installer `expo-print@~15.0.8` (version pinned SDK 54) et `react-native-qrcode-svg@^6.3.21`, bundler Andika 7.000 directement (TTF Regular + Bold extraits du zip officiel SIL), créer `lib/pdf/` en structure aplatie (4 fichiers : `index.ts` barrel + `constants.ts` + `types.ts` + `manifest-parser.ts`), et NE PAS bumper `CACHE_VERSION` (manifeste = nouveau domaine, pas dans `VaultCacheState`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Génération PDF native (Phase 49+) | Native iOS/Android (expo-print) | — | API plateforme uniquement |
| Rendu QR code (Phase 50+) | React Native UI (SVG via react-native-svg) | — | Composant déclaratif RN |
| Chargement police custom | Native (expo-font.useFonts) | App boot (`app/_layout.tsx`) | Bundled asset Metro |
| Parser/serializer manifeste | Pure JS (lib/) | — | Fonction pure testable Jest |
| Persistence manifeste | Vault iCloud (markdown) | VaultManager (`lib/vault.ts`) | Cohérent avec reste vault |
| Constantes Lulu / palette | Pure module (`lib/pdf/constants.ts`) | — | Statique, importable partout |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-print` | `~15.0.8` | Moteur HTML→PDF natif (iOS UIPrintInteractionController + Android PrintManager) | Pinned dans `bundledNativeModules.json` SDK 54 — la version "officielle" pour cet SDK [VERIFIED: node_modules/expo/bundledNativeModules.json] |
| `react-native-qrcode-svg` | `^6.3.21` | QR code SVG (utilisé Phase 50, installé en 48 pour single install pass) | Maintenu par Expensify, dernière publication 2025-12-04, peer `react-native-svg >=14.0.0` (projet a `^15.12.1` ✓) [VERIFIED: npm registry] |
| `expo-font` | `~14.0.11` (déjà installé) | `useFonts()` pour bundled custom fonts | Déjà utilisé pour DM Serif / Caveat / Patrick Hand [VERIFIED: app/_layout.tsx:32-34, package.json:33] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `gray-matter` | `^4.0.3` (déjà installé) | Parse YAML frontmatter | Pour le parser manifeste (cohérent avec parseRDV) |
| `react-native-svg` | `^15.12.1` (déjà installé) | Peer dep de qrcode-svg | Couvre `>=14.0.0` requis [VERIFIED: package.json:64] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-native-qrcode-svg` | `react-native-svg-qrcode` (JamieLivi) | Plus minimal mais moins maintenu — qrcode-svg a 1300+ commits, support Expensify [CITED: npm/snyk] |
| Andika bundled | Andika via Google Fonts WebFont CDN | Pas viable : `expo-print` rend HTML statique offline — il faut embarquer pour que les PDFs Lulu aient les polices intégrées |
| `@expo-google-fonts/andika` | Inexistant (Andika n'est pas sur Google Fonts) | N/A — bundling manuel obligatoire [VERIFIED: search] |

**Installation :**
```bash
npx expo install expo-print react-native-qrcode-svg
```

`npx expo install` (vs `npm install`) résout automatiquement la version SDK 54 compatible via `bundledNativeModules.json` pour `expo-print` ; pour `react-native-qrcode-svg` (non Expo) il prendra la latest. Devrait produire `expo-print@~15.0.8` et `react-native-qrcode-svg@^6.3.21`.

## Andika Font (asset bundling)

**Source officielle :** https://github.com/silnrsi/font-andika/releases/tag/v7.000 (release 2025-06-02) [VERIFIED: GitHub API]

**Asset disponible :**
- `Andika-7.000.zip` — 10.13 MB (zip complet, contient TTF + WOFF + docs + samples)
- `Andika-7.000.tar.xz` — 11.53 MB (alternative)

**Procédure d'extraction (manuel, hors npm) :**
1. Télécharger `Andika-7.000.zip`
2. Extraire — la structure SIL standard contient `fonts/ttf/Andika-Regular.ttf` et `Andika-Bold.ttf` (et Italic/BoldItalic, non requis)
3. Copier UNIQUEMENT `Andika-Regular.ttf` + `Andika-Bold.ttf` dans `assets/fonts/Andika/`
4. Inclure `OFL.txt` (license SIL Open Font 1.1) dans `assets/fonts/Andika/` pour conformité

**Tailles individuelles approximatives** (basé sur builds SIL antérieurs, à confirmer après extraction) : Regular ~600 KB, Bold ~600 KB, soit ~1.2 MB ajoutés au binaire. Acceptable.

**License SIL Open Font 1.1 — exigences :**
- Copyright + license fichier `OFL.txt` doivent être livrés avec les fichiers de police [CITED: https://openfontlicense.org/]
- Pas d'attribution UI obligatoire mais recommandée — ajouter mention dans écran "À propos" de l'app (Phase 51+, hors scope 48)
- Modifications autorisées mais doivent être renommées (non applicable ici)

**Alternatives si trop lourd :** non applicable, ~1.2 MB pour 2 weights est standard pour une police custom embarquée. Aucune alternative vraiment plus légère avec le même rendu lisibilité-enfants.

## Existing Font Loading Pattern

`app/_layout.tsx` lignes 32-34, 170-176 utilise déjà `useFonts()` de `@expo-google-fonts/dm-serif-display` :

```typescript
import { useFonts as useDMSerif, DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { Caveat_400Regular, Caveat_600SemiBold } from '@expo-google-fonts/caveat';
import { PatrickHand_400Regular } from '@expo-google-fonts/patrick-hand';

const [fontsLoaded, fontsError] = useDMSerif({
  DMSerifDisplay_400Regular,
  Caveat_400Regular,
  Caveat_600SemiBold,
  PatrickHand_400Regular,
});
const fontsReady = fontsLoaded || !!fontsError;
```

**Pattern clé** (commentaire dans le code) : *"Si la charge échoue, on continue avec les fallbacks système — ne jamais bloquer l'app."* Le hook combine plusieurs Google Fonts dans un seul appel.

**Pour Andika (locale, pas Google Fonts)**, deux approches valides :

**Option A (recommandée) — `useFonts` d'`expo-font` direct :**
```typescript
import { useFonts } from 'expo-font';

const [andikaLoaded] = useFonts({
  'Andika-Regular': require('../assets/fonts/Andika/Andika-Regular.ttf'),
  'Andika-Bold': require('../assets/fonts/Andika/Andika-Bold.ttf'),
});
```
Combine avec le `useDMSerif` existant via un `&&` pour `fontsReady`. Cohérent avec le pattern existant.

**Option B — `Font.loadAsync` dans un useEffect** : fonctionne aussi mais moins idiomatique RN que le hook.

**Recommandation : Option A**, intégrée à côté de `useDMSerif` dans `RootLayout()`. Mettre à jour `fontsReady = (fontsLoaded || fontsError) && (andikaLoaded || andikaError)`.

⚠️ **Pitfall** : les polices sont référencées par leur **PostScript name** (souvent identique au nom de fichier sans extension : `Andika-Regular`). Si Andika a un PostScript name différent (e.g. `Andika`), `expo-print` HTML utilisera le `font-family: 'Andika-Regular'` que TU déclares ici, donc c'est l'alias choisi qui compte. Garder `Andika-Regular` / `Andika-Bold` comme clés et les utiliser tels quels en CSS dans Phase 49.

## Manifest Parser Pattern (decision)

### Format proposé : gray-matter frontmatter + section markdown YAML list

Trois patterns existent dans `lib/parser.ts` :

| Pattern | Exemple existant | Pour manifeste ? |
|---------|------------------|------------------|
| **Table markdown** (`\| col \| col \|`) | `parseAnniversaries` (lib/parser.ts:2210) | Marche, mais lourd pour 5 champs avec hashes longs |
| **Section + format custom** (`YYYY-MM-DD:5:ids`) | `parseSnapshots` (lib/village/parser.ts) | Très lisible Obsidian, mais format custom par fichier — pas idéal ici |
| **Frontmatter YAML + body sections** | `parseRDV` (lib/parser.ts:336) | **Pattern le plus proche** — un fichier par RDV |
| **Frontmatter + YAML list dans body** | _Pas d'exemple direct, mais pattern naturel pour gray-matter_ | **Idéal pour manifeste** (un seul fichier, N entrées) |

### Recommandation : un seul `manifeste.md` avec frontmatter meta + table markdown des entrées

```markdown
---
tags:
  - impressions
  - manifeste
version: 1
---

# Manifeste impressions

Registre des PDFs exportés pour impression Lulu Direct.

| ID histoire | Hash | Date | Format | Chemin |
|-------------|------|------|--------|--------|
| story_foret_2026 | a3f7c... | 2026-05-04 | Lulu 21×21 | 12 - Impressions/PDFs/foret-2026.pdf |
| story_pirates_2026 | 8e2b1... | 2026-05-10 | Lulu 21×21 | 12 - Impressions/PDFs/pirates-2026.pdf |
```

**Justifications :**
1. **Cohérence stylistique** avec `Anniversaires.md` (table markdown lisible Obsidian)
2. **Frontmatter pour métadonnées globales** (`version: 1` pour migrations futures)
3. **Hash SHA-256 court rendu visible** dans le tableau (le hash complet est conservé dans le frontmatter ou tronqué affiché — au choix du planner, mais hash complet recommandé sans troncature pour garantir round-trip strict equality)
4. **Round-trip prouvable** : table = format strict, parsing déterministe
5. **Évolutif** : ajouter une colonne (e.g. status, copies imprimées) sans casser les anciennes lignes — utiliser `cells[i] || undefined` comme parseAnniversaries

**Alternative considérée et rejetée :** YAML pur dans frontmatter (`exports: [{...}]`) — moins lisible dans Obsidian, gray-matter ne préserve pas l'ordre des clés, plus fragile pour round-trip.

### Modèle template (parseRDV + parseAnniversaries hybride)

```typescript
// lib/pdf/manifest-parser.ts
import matter from 'gray-matter';
import type { BookManifestEntry } from './types';

export const MANIFESTE_FILE = '12 - Impressions/manifeste.md';

export function parseManifeste(content: string): BookManifestEntry[] {
  if (!content || !content.trim()) return [];
  const { content: body } = matter(content);
  const lines = body.split('\n');
  const items: BookManifestEntry[] = [];

  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 5) continue;
    if (cells[0] === 'ID histoire' || cells[0].startsWith('---')) continue;

    const [id, hash, date, format, chemin] = cells;
    if (!id || !hash) continue;
    items.push({ id, hash, date, format, chemin });
  }
  return items;
}

export function serializeManifeste(entries: BookManifestEntry[]): string {
  const parts: string[] = [
    '---',
    'tags:',
    '  - impressions',
    '  - manifeste',
    'version: 1',
    '---',
    '',
    '# Manifeste impressions',
    '',
    'Registre des PDFs exportés pour impression Lulu Direct.',
    '',
    '| ID histoire | Hash | Date | Format | Chemin |',
    '|-------------|------|------|--------|--------|',
  ];
  for (const e of entries) {
    parts.push(`| ${e.id} | ${e.hash} | ${e.date} | ${e.format} | ${e.chemin} |`);
  }
  parts.push('');
  return parts.join('\n');
}
```

## CACHE_VERSION Decision

**Décision : NE PAS bumper.** Version reste `13`.

**Justification documentée :**

`lib/vault-cache.ts:67` : `const CACHE_VERSION = 13;`. La constante doit être bumpée *uniquement* quand :
1. Le shape d'un type **déjà caché** change (Task, Profile base, RDV, Note, etc. — voir liste ligne 12-22)
2. On ajoute/retire un domaine de `VaultCacheState`

**Le manifeste impressions n'est pas dans `VaultCacheState`** :
- Vérifié contre la liste des types importés dans `vault-cache.ts:25-52` — aucune référence à `BookManifestEntry`, `BookExportSpec`, ou `manifeste`
- C'est un **nouveau domaine** chargé frais à chaque ouverture du vault (cohérent avec la philosophie "domaines à faible volume / lecture rare = pas en cache")
- Volume attendu très faible (1 entrée par export PDF, peut-être 5-50 sur la durée de vie de l'app) → pas de gain perf à cacher

**Conséquence concrète Phase 48 :** *aucune* modification à `lib/vault-cache.ts`. Inclure cette décision dans `48-04-PLAN.md` comme une ligne de doc + un test de non-régression vérifiant que le cache existant fonctionne toujours après ajout du module pdf.

[VERIFIED: lib/vault-cache.ts:25-67]

## lib/pdf/ Internal Structure

**Recommandation : structure aplatie 4 fichiers** (similaire au début de `lib/mascot/` mais plus petit).

```
lib/pdf/
├── index.ts            # Barrel exports
├── constants.ts        # TRIM_SIZE_CM, BLEED_CM, PAGE_COUNT, palette, font slots
├── types.ts            # BookExportSpec, BookManifestEntry
└── manifest-parser.ts  # parseManifeste / serializeManifeste / MANIFESTE_FILE
```

**Justifications :**
- **`lib/mascot/` a 40 fichiers** (engine, sagas, companions, sprites…) — beaucoup trop pour Phase 48
- **`lib/gamification/` est plus modeste** : `engine.ts`, `rewards.ts`, `seasonal.ts`, `seasonal-rewards.ts` + `index.ts` barrel → pattern à imiter
- **Séparation logique claire** : constantes (immutables), types (interfaces), parser (fonctions pures)
- **Évolutif Phase 49+** : ajouter `html-template.ts`, `pdf-generator.ts`, `hash.ts` au même niveau sans réorganiser

**Pattern barrel `index.ts`** (style `lib/gamification/index.ts`) :

```typescript
// lib/pdf/ — Barrel export pour le domaine export PDF (Lulu Direct)

export {
  TRIM_SIZE_CM,
  BLEED_CM,
  PAGE_COUNT,
  LULU_FORMAT_LABEL,
  BOOK_PALETTE,
  FONT_SLOTS,
} from './constants';

export type {
  BookExportSpec,
  BookManifestEntry,
  BookPalette,
  FontSlot,
} from './types';

export {
  MANIFESTE_FILE,
  parseManifeste,
  serializeManifeste,
} from './manifest-parser';
```

## Test Pattern

**Convention existante :** tous les tests parsers vivent dans `lib/__tests__/` avec suffixe `.test.ts`. Exemples directement applicables :
- `lib/__tests__/parser.test.ts` (parseTask, parseRDV…)
- `lib/__tests__/snapshots-parser.test.ts` (parseSnapshots / appendSnapshot — round-trip pattern parfait)
- `lib/__tests__/parser-extended.test.ts`, `lib/__tests__/parser-lovenotes.test.ts`

**Recommandation pour Phase 48 :** créer `lib/__tests__/pdf-manifest-parser.test.ts` (et **non** `lib/pdf/__tests__/`) — cohérent avec 100% des autres tests du projet.

**Template round-trip strict equality :**

```typescript
// lib/__tests__/pdf-manifest-parser.test.ts
import {
  parseManifeste,
  serializeManifeste,
  type BookManifestEntry,
} from '../pdf';

describe('parseManifeste', () => {
  it('contenu vide → []', () => {
    expect(parseManifeste('')).toEqual([]);
  });

  it('frontmatter sans entrées → []', () => {
    const content = `---\nversion: 1\n---\n\n# Manifeste\n`;
    expect(parseManifeste(content)).toEqual([]);
  });

  it('parse 3 entrées de la table', () => {
    const content = serializeManifeste(SAMPLE_THREE);
    const parsed = parseManifeste(content);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].id).toBe('story_foret_2026');
  });
});

describe('round-trip parse → serialize → parse', () => {
  it('Test 1 : 3 entrées identiques après round-trip (strict equality)', () => {
    const original: BookManifestEntry[] = SAMPLE_THREE;
    const serialized = serializeManifeste(original);
    const reparsed = parseManifeste(serialized);
    expect(reparsed).toEqual(original);
  });

  it('Test 2 : 1 entrée vide id → ignorée silencieusement', () => {
    const malformed = `## …\n| | h | d | f | c |\n| ok | h2 | d2 | f2 | c2 |`;
    expect(parseManifeste(malformed)).toHaveLength(1);
  });
});

const SAMPLE_THREE: BookManifestEntry[] = [
  { id: 'story_foret_2026',  hash: 'a3f7...', date: '2026-05-04', format: 'Lulu 21×21', chemin: '12 - Impressions/PDFs/foret.pdf' },
  { id: 'story_pirates',     hash: '8e2b...', date: '2026-05-10', format: 'Lulu 21×21', chemin: '12 - Impressions/PDFs/pirates.pdf' },
  { id: 'story_dragons',     hash: 'cd91...', date: '2026-05-12', format: 'Lulu 21×21', chemin: '12 - Impressions/PDFs/dragons.pdf' },
];
```

Le test 1 (round-trip strict equality 3 entrées) couvre directement le critère de succès #4 du milestone.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML→PDF rendering | Custom canvas/PDF.js bridge | `expo-print.printToFileAsync()` | Gère iOS UIKit + Android PrintManager, polices embarquées natif |
| QR code SVG | Manual matrix → SVG path | `react-native-qrcode-svg` | Niveau correction Reed-Solomon, encoding UTF-8, batterie de tests |
| YAML frontmatter parser | Manual regex split | `gray-matter` (déjà installé) | Edge cases (multi-line, escaping, dates auto-cast) |
| SHA-256 hash (Phase 49) | Manual implementation | `expo-crypto.digestStringAsync()` | Phase 49 — noté pour mémoire |
| Markdown table parsing | Custom CSV-like split | Pattern `parseAnniversaries` (existant) | Déjà testé en prod, gère cells vides |

## Common Pitfalls

### Pitfall 1 : `expo-print` ne marche PAS dans Expo Go
**What goes wrong :** `expo-print` est un module natif (TurboModule). Il ne fonctionne que dans dev-client / build natif.
**Why :** API native iOS/Android non disponibles dans le bundle JS standalone d'Expo Go.
**How to avoid :** Le projet utilise déjà `expo-dev-client` (`package.json:30`) et build via `npx expo run:ios --device` — c'est conforme. Pas d'action spéciale, mais **documenter dans 48-01-PLAN.md** que les tests doivent passer sur dev-client (pas en Expo Go).
**Warning signs :** Erreur `TurboModuleRegistry.getEnforcing(...): 'ExpoPrint' could not be found` au runtime.

### Pitfall 2 : Polices custom non embarquées dans le PDF généré
**What goes wrong :** `expo-print` rend du HTML inline ; si Andika n'est pas accessible via `font-family` au moment du rendu, le PDF utilisera fallback système → PDF Lulu non conforme.
**Why :** `expo-print` sur iOS délègue à WebKit ; les polices doivent être *load*ed via `expo-font` avant le rendu, ET référencées par leur nom déclaré dans `useFonts({ key: ... })`.
**How to avoid :** Phase 48 charge les polices au boot, Phase 49 utilisera `font-family: 'Andika-Regular'` en CSS et embarquera les `.ttf` en base64 (`@font-face { src: url(data:font/ttf;base64,...) }`) si nécessaire pour garantir l'embed Lulu. À documenter pour Phase 49 — pas un blocker 48.
**Warning signs :** Inspection `pdfinfo` ou Aperçu macOS du PDF → "Embedded fonts: none" ou "Helvetica" au lieu d'Andika.

### Pitfall 3 : Bumper `CACHE_VERSION` "par sécurité"
**What goes wrong :** Bumper inutilement invalide le cache de TOUS les utilisateurs → re-launch lent (300-800ms layout shift) sans bénéfice.
**Why :** Réflexe de prudence mal calibré.
**How to avoid :** Suivre strictement la règle ligne 12-22 de `vault-cache.ts` (changements de shape de types CACHÉS uniquement). Manifeste = nouveau domaine non caché → no bump. Voir section CACHE_VERSION Decision ci-dessus.
**Warning signs :** Diff inclut `CACHE_VERSION = 14` et `CACHE_FILENAME = 'vault-cache-v14.json'` sans changement à `VaultCacheState` ou aux types listés.

### Pitfall 4 : `react-native-qrcode-svg` peer dep `text-encoding`
**What goes wrong :** `text-encoding` (transitive de qrcode-svg) peut échouer le bundling Metro avec Hermes/RN 0.81.
**Why :** Module legacy, parfois polyfill manquant.
**How to avoid :** Si erreur Metro au build, ajouter `react-native-get-random-values` ou tester avec `qrcode/lib/core/utf8` directement. **Probable non-issue** (qrcode-svg 6.3.21 est sorti déc 2025, postérieur à RN 0.81), mais à surveiller au premier `npx expo run:ios` après install.
**Warning signs :** Erreur Metro `Unable to resolve 'text-encoding'` ou crash runtime sur `new TextEncoder()`.

### Pitfall 5 : Caractères accentués et émojis dans le hash de tableau markdown
**What goes wrong :** Si l'`id` ou le `chemin` contient un `|`, le split du parser découpe mal.
**Why :** Format markdown table ne gère pas l'escaping de pipe nativement.
**How to avoid :** **Contrainte sur les valeurs** : interdire `|` dans `id`, `hash`, `format`, `chemin`. Le hash SHA-256 est hex (pas de pipe). Les chemins du vault n'ont pas de pipe. Documenter dans le commentaire du parser.
**Warning signs :** Test round-trip échoue uniquement sur certaines entrées avec caractères spéciaux.

## Code Examples

### Exemple 1 : `lib/pdf/constants.ts`
```typescript
// lib/pdf/constants.ts — Constantes Lulu Direct (specs immuables)

/** Trim size carré 21×21 cm (Lulu Direct standard saddle-stitch) */
export const TRIM_SIZE_CM = 21;

/** Bleed Lulu Direct : 3.2 mm tous bords */
export const BLEED_CM = 0.32;

/** Saddle-stitch impose multiple de 4 pages ; livre cible 16 pages */
export const PAGE_COUNT = 16;

/** Label affichable du format (audit trail manifeste) */
export const LULU_FORMAT_LABEL = 'Lulu 21×21';

/** Palette couleurs livre (placeholder Phase 48 — finalisée Phase 49) */
export const BOOK_PALETTE = {
  ivory: '#FAF6EE',
  terracotta: '#C97D5F',
  sage: '#8FA68E',
  ink: '#2B2A28',
  paperShadow: '#E8E0D0',
} as const;

/** Slots de polices disponibles pour le rendu PDF */
export const FONT_SLOTS = {
  body: 'Andika-Regular',
  bodyBold: 'Andika-Bold',
  display: 'DMSerifDisplay_400Regular',
  whisper: 'Caveat_600SemiBold',
} as const;
```

### Exemple 2 : `lib/pdf/types.ts`
```typescript
// lib/pdf/types.ts

import type { BOOK_PALETTE, FONT_SLOTS } from './constants';

/** Spécifications de génération d'un livre PDF Lulu */
export interface BookExportSpec {
  storyId: string;
  format: 'Lulu 21×21';
  trimCm: number;       // = TRIM_SIZE_CM (figé pour audit)
  bleedCm: number;      // = BLEED_CM
  pageCount: number;    // = PAGE_COUNT
  palette: BookPalette;
}

/** Une entrée du registre 12 - Impressions/manifeste.md */
export interface BookManifestEntry {
  id: string;       // storyId (unique key)
  hash: string;     // SHA-256 hex du PDF (intégrité)
  date: string;     // YYYY-MM-DD de l'export
  format: string;   // 'Lulu 21×21' (futur-proof si autres formats)
  chemin: string;   // chemin relatif vault vers le PDF
}

export type BookPalette = typeof BOOK_PALETTE;
export type FontSlot = keyof typeof FONT_SLOTS;
```

### Exemple 3 : intégration `useFonts` dans `app/_layout.tsx`
```typescript
// Ajouter à côté de useDMSerif existant
import { useFonts as useExpoFonts } from 'expo-font';

const [andikaLoaded, andikaError] = useExpoFonts({
  'Andika-Regular': require('../assets/fonts/Andika/Andika-Regular.ttf'),
  'Andika-Bold': require('../assets/fonts/Andika/Andika-Bold.ttf'),
});

const fontsReady =
  (fontsLoaded || !!fontsError) &&
  (andikaLoaded || !!andikaError);
```

## Runtime State Inventory

Phase greenfield (création nouveau domaine), pas de rename/refactor — section non applicable.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | install deps | ✓ | (project running) | — |
| Expo SDK 54 | expo-print pinning | ✓ | `~54.0.0` | — [VERIFIED: package.json:23] |
| `react-native-svg` | qrcode-svg peer dep | ✓ | `^15.12.1` | — [VERIFIED: package.json:64] |
| `gray-matter` | manifest parser | ✓ | `^4.0.3` | — [VERIFIED: package.json:49] |
| `jest` + `jest-expo` | tests | ✓ | `^29.7.0` / `~54.0.17` | — |
| Internet (download Andika) | bundling police | Required at dev time only | — | Manual download — already done by dev OK |
| `expo-dev-client` | tester expo-print sur device | ✓ | `~6.0.20` | — [VERIFIED: package.json:30] |

**Aucun blocker d'environnement.** Toutes les peer deps de qrcode-svg sont déjà satisfaites.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `jest@^29.7.0` + `jest-expo@~54.0.17` + `ts-jest@^29.4.6` |
| Config file | `jest.config.js` (à vérifier — sinon dans `package.json` jest field) |
| Quick run command | `npx jest --no-coverage lib/__tests__/pdf-manifest-parser.test.ts` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PDF-01 | Andika chargée au boot sans erreur | manual-only (device) | `npx expo run:ios --device` puis vérifier console pas d'erreur fontsError | ❌ Wave 0 (manuel) |
| PDF-02 | `lib/pdf/index.ts` exporte constantes + types | unit (TS check) | `npx tsc --noEmit` | ✅ via tsc |
| PDF-03 | deps installées sans warnings | manual | `npm list expo-print react-native-qrcode-svg` | manual |
| PDF-04 | Manifeste round-trip 3 entrées strict equality | unit | `npx jest --no-coverage lib/__tests__/pdf-manifest-parser.test.ts` | ❌ Wave 0 |
| PDF-05 | CACHE_VERSION inchangé, cache existant fonctionne | unit (non-régression) | `npx jest --no-coverage` (suite complète passe) | ✅ via tests existants |
| QA-01 | TS clean | unit | `npx tsc --noEmit` | ✅ |
| QA-02 | Jest clean | unit | `npx jest --no-coverage` | ✅ |

### Sampling Rate
- **Per task commit** : `npx tsc --noEmit && npx jest --no-coverage --findRelatedTests <files>`
- **Per wave merge** : `npx tsc --noEmit && npx jest --no-coverage`
- **Phase gate** : full suite verte + boot device sans erreur Andika

### Wave 0 Gaps
- [ ] `lib/__tests__/pdf-manifest-parser.test.ts` — round-trip 3 entrées strict equality (couvre PDF-04)
- [ ] `assets/fonts/Andika/Andika-Regular.ttf` + `Andika-Bold.ttf` + `OFL.txt` — Wave 0 download manuel
- [ ] `12 - Impressions/manifeste.md` initial vide (avec frontmatter `version: 1`) — créé par 48-03

*(Pas de gap framework : jest + ts-jest + jest-expo déjà configurés et utilisés par 50+ tests existants)*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-native-html-to-pdf` (deprecated, jsdomParser custom) | `expo-print` (TurboModule moderne, WebKit) | Expo SDK 49+ | API plus simple, mieux maintenu, supporte iOS 17+/18 |
| Polices via `Font.loadAsync` impératif | `useFonts()` hook déclaratif | expo-font 11+ | Cohérent avec React, suspend bien le boot |
| Cache vault async (Phase < 39) | Cache synchrone `expo-file-system` `.textSync()` | Phase 39+ SDK 54 | Layout shift éliminé — ne pas casser ça en Phase 48 |

**Deprecated/outdated :**
- `react-native-html-to-pdf` : ne PAS l'utiliser, abandonné [CITED: communauté]
- `expo-font/legacy` : utiliser le `useFonts` standard, pas le legacy

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tailles individuelles Andika Regular/Bold ~600 KB chacune | Andika Font | Sous-estimation possible — vérifier après extraction zip ; si > 1 MB par fichier, considérer subset (mais pas trivial) |
| A2 | PostScript name d'Andika = `Andika-Regular` (idem nom de fichier) | Pitfall 2 | Si le PostScript name réel diffère, le `font-family` CSS Phase 49 doit être ajusté — non-blocker Phase 48 (l'alias dans `useFonts({...})` est la clé canonique) |
| A3 | `npx expo install expo-print` produit `~15.0.8` | Standard Stack | Faible — le manifeste `bundledNativeModules.json` est déterministe et vérifié |
| A4 | `react-native-qrcode-svg@6.3.21` n'a pas de breaking change RN 0.81 | Standard Stack | Faible — sortie déc 2025, postérieure à RN 0.81 (sept 2025). Pitfall 4 documente le seul risque connu |

## Open Questions

1. **Hash SHA-256 dans la table : tronqué ou complet ?**
   - What we know : Le hash complet fait 64 caractères hex, lisibilité Obsidian dégradée
   - What's unclear : Le manifeste est-il consulté par humain ou uniquement par l'app ?
   - Recommendation : **Garder le hash complet** dans la table. Strict equality du round-trip l'exige. Lisibilité Obsidian acceptable (table scrollable).

2. **Palette couleurs définitive du livre**
   - What we know : Marquée "Claude's Discretion" dans CONTEXT.md, finalisée Phase 49
   - What's unclear : Phase 48 a-t-elle besoin de valeurs précises ou des placeholders suffisent ?
   - Recommendation : **Placeholders proposés** (ivoire / terracotta / sage / ink / paperShadow) — Phase 49 peut overwrite sans casser l'API.

3. **Devrait-on créer `12 - Impressions/PDFs/` (sous-dossier) maintenant ?**
   - What we know : Phase 49 sauvegarde les PDFs quelque part
   - What's unclear : Convention vault — sous-dossier ou flat ?
   - Recommendation : **Phase 48 crée seulement `12 - Impressions/manifeste.md`**. Le sous-dossier `PDFs/` est une décision Phase 49 (potentiellement créé à la volée par `vault.ts` au premier export).

## Recommendations Summary

(Lecture directe pour le planner)

| Décision | Valeur retenue | Source |
|----------|----------------|--------|
| `expo-print` version | `~15.0.8` | bundledNativeModules.json SDK 54 |
| `react-native-qrcode-svg` version | `^6.3.21` (latest stable) | npm registry, peer deps OK |
| Commande install | `npx expo install expo-print react-native-qrcode-svg` | Convention Expo |
| Andika source | https://github.com/silnrsi/font-andika/releases/tag/v7.000 (zip 10.13 MB) | GitHub Release officielle |
| Fichiers Andika à bundler | `Andika-Regular.ttf` + `Andika-Bold.ttf` + `OFL.txt` (license) | SIL OFL 1.1 compliance |
| Emplacement assets | `assets/fonts/Andika/` | Convention projet (nouveau dossier — pas de fonts custom locales auj.) |
| Loader polices | `useFonts()` d'`expo-font` dans `app/_layout.tsx`, en parallèle du `useDMSerif` existant | Pattern projet |
| Format manifeste | gray-matter frontmatter (`version: 1`) + table markdown 5 colonnes | Hybride parseRDV + parseAnniversaires |
| Localisation parser | `lib/pdf/manifest-parser.ts` | Cohésion module pdf |
| Structure `lib/pdf/` | Aplatie : `index.ts` + `constants.ts` + `types.ts` + `manifest-parser.ts` | Pattern `lib/gamification/` |
| Localisation tests | `lib/__tests__/pdf-manifest-parser.test.ts` | 100% des tests projet sont là |
| Test critique | Round-trip 3 entrées → `expect(reparsed).toEqual(original)` | Critère succès #4 |
| `CACHE_VERSION` | **Inchangé (= 13)** | Manifeste hors `VaultCacheState` |
| Manifeste init | `12 - Impressions/manifeste.md` avec frontmatter + header + table vide | Phase 48 crée le squelette |
| Plans recommandés | 48-01 (deps + Andika), 48-02 (lib/pdf module), 48-03 (manifeste + parser + tests), 48-04 (décision cache + non-régression) | ROADMAP cohérent |

## Sources

### Primary (HIGH confidence)
- `node_modules/expo/bundledNativeModules.json` — pinning SDK 54 (`expo-print: ~15.0.8`, `expo-font: ~14.0.11`)
- `package.json` — versions installées (`expo ~54.0.0`, `react-native-svg ^15.12.1`, `gray-matter ^4.0.3`, etc.)
- `app/_layout.tsx:32-34, 170-176` — pattern `useFonts` existant
- `lib/parser.ts:336-408` — `parseRDV` / `serializeRDV` (frontmatter + body sections)
- `lib/parser.ts:2210-2279` — `parseAnniversaires` / `serializeAnniversaries` (table markdown)
- `lib/vault-cache.ts:12-67` — règles `CACHE_VERSION`
- `lib/__tests__/snapshots-parser.test.ts` — pattern tests round-trip
- `lib/gamification/index.ts` — pattern barrel
- npm registry API : `expo-print` (latest stable 15.0.8 publié 2025-12-05), `react-native-qrcode-svg` (latest 6.3.21 publié 2025-12-04, peer `react-native-svg >=14.0.0`)
- GitHub API `silnrsi/font-andika` releases : v7.000 (publié 2025-06-02), zip 10.13 MB

### Secondary (MEDIUM confidence)
- https://software.sil.org/andika/ — license SIL OFL, distribution officielle
- https://expo.dev/changelog/sdk-54 — SDK 54 = RN 0.81 + React 19.1
- https://github.com/Expensify/react-native-qrcode-svg — maintenu par Expensify

### Tertiary (LOW confidence)
- Estimations tailles fichiers Andika (à confirmer après extraction zip)
- Pitfall 4 (text-encoding) basé sur historique RN, à valider au build

## Metadata

**Confidence breakdown :**
- Standard stack : **HIGH** — versions vérifiées via npm registry + bundledNativeModules
- Architecture (parser pattern) : **HIGH** — calque sur 2 patterns existants éprouvés
- Pitfalls : **MEDIUM-HIGH** — 4 sur 5 sont génériques bien documentés, le 5e (text-encoding) est défensif
- Andika file specifics : **MEDIUM** — release confirmée mais structure interne du zip non inspectée

**Research date :** 2026-05-04
**Valid until :** 2026-06-04 (30 jours — versions deps stables, peu de turbulence)
