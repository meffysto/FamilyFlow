# Phase 48: Fondation export PDF + assets - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Mode:** Auto-généré depuis ROADMAP (discuss skippé — phase technique d'infrastructure)

<domain>
## Phase Boundary

Poser l'infrastructure technique pour l'export PDF imprimable des histoires (milestone v1.8) :
- Ajouter les dépendances `expo-print` et `react-native-qrcode-svg`
- Bundler la police Andika (Regular + Bold) via `expo-font`
- Créer le module `lib/pdf/` avec types TypeScript et constantes Lulu Direct
- Créer le manifeste `12 - Impressions/manifeste.md` avec parser bidirectionnel + tests Jest
- Décision cache : bumper `CACHE_VERSION` si nécessaire

**IN scope :**
- Installation deps + vérification compatibilité Expo SDK 54
- Téléchargement police Andika (license SIL Open Font) → `assets/fonts/Andika/`
- Chargement police au boot via `expo-font.useFonts()` ou `loadAsync` dans `app/_layout.tsx`
- Création `lib/pdf/index.ts` (barrel) avec :
  - Constantes Lulu : `TRIM_SIZE_CM = 21`, `BLEED_CM = 0.32`, `PAGE_COUNT = 16`, palette couleurs, slots polices
  - Types : `BookExportSpec`, `BookManifestEntry` (au minimum)
- Création du dossier vault `12 - Impressions/` avec fichier `manifeste.md` initial vide
- Parser `parseManifeste`/`serializeManifeste` dans `lib/parser.ts` (ou nouveau `lib/pdf/manifest-parser.ts`)
- Tests Jest round-trip parser : écrire 3 entrées → relire → strict equality
- Bumper `CACHE_VERSION` si un type caché est touché (probablement non — manifeste est un nouveau domaine, pas dans le cache)

**OUT of scope (phases ultérieures) :**
- Génération HTML/PDF effective (Phase 49)
- Composants UI export (Phase 51)
- QR code + deep links (Phase 50)
- Modal aperçu, écran post-export (Phase 51)

</domain>

<decisions>
## Implementation Decisions

### Locked (depuis ROADMAP)

**Dépendances :**
- `expo-print` — moteur de rendu HTML → PDF natif (Expo SDK 54 compatible)
- `react-native-qrcode-svg` — génération QR SVG (utilisé en Phase 50, mais installé en 48 pour une seule passe d'install/build)

**Police :**
- **Andika** (SIL Open Font License) — Regular + Bold uniquement
- Bundled dans l'app (pas téléchargée à chaud) → `assets/fonts/Andika/Andika-Regular.ttf` + `Andika-Bold.ttf`
- Chargement via `expo-font.useFonts()` dans `app/_layout.tsx`

**Constantes Lulu :**
- `TRIM_SIZE_CM = 21` (carré 21×21cm)
- `BLEED_CM = 0.32` (3.2mm bleed Lulu Direct)
- `PAGE_COUNT = 16` (saddle-stitch)

**Manifeste :**
- Localisation vault : `12 - Impressions/manifeste.md`
- Format : Markdown avec frontmatter gray-matter (cohérent avec le reste du vault)
- Entrée par export PDF : `id` (storyId), `hash` (SHA-256), `date`, `format` (Lulu 21×21), `chemin` (chemin vers PDF sauvegardé)

### Claude's Discretion

- **Forme exacte du parser manifeste** (gray-matter + structure list/array vs YAML purs) — Claude choisit le plus cohérent avec `lib/parser.ts` existant
- **Organisation interne `lib/pdf/`** : `index.ts` (barrel), `constants.ts`, `types.ts`, `manifest-parser.ts` ou structure plate selon analyse de `lib/mascot/` / `lib/gamification/`
- **Palette couleurs livre** dans constants — choisir une palette douce (ivoire, terre cuite, vert sauge ?) cohérente avec le ton "histoire du soir". À finaliser en Phase 49 si besoin, valeurs placeholder OK ici
- **`CACHE_VERSION` bump** : analyser `lib/vault-cache.ts` — si manifeste n'est PAS caché (probable, car nouveau domaine), pas de bump nécessaire. Documenter la décision dans le PLAN
- **Tests Jest** : écrire `lib/__tests__/pdf-manifest-parser.test.ts` ou `lib/pdf/__tests__/manifest-parser.test.ts` selon convention existante

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` (lignes 415–438) — milestone v1.8 + phase 48 détails
- `lib/parser.ts` — pattern de référence pour parsers markdown bidirectionnels
- `lib/vault-cache.ts:53` — `CACHE_VERSION` constante + commentaires sur quand bumper
- `lib/mascot/index.ts` / `lib/gamification/index.ts` — pattern barrel pour `lib/pdf/index.ts`
- `app/_layout.tsx` — point d'intégration `expo-font.useFonts()`
- `assets/fonts/` — convention de bundling polices (vérifier si déjà des polices custom)
- `CLAUDE.md` (section Stack, Architecture, Cache) — conventions projet

</canonical_refs>

<specifics>
## Specific Ideas

- Vérifier compatibilité `expo-print@latest` avec Expo SDK 54 (commande `npx expo install expo-print`)
- Vérifier que `react-native-qrcode-svg` n'a pas de breaking changes RN 0.81
- Andika : récupérer depuis https://software.sil.org/andika/ (Regular + Bold, formats TTF)
- Pour les tests parser : utiliser le pattern de `lib/__tests__/cooklang.test.ts` ou équivalent existant comme template

</specifics>

<deferred>
## Deferred Ideas

- Palette couleurs définitive (sera affinée en Phase 49 lors du design HTML)
- Cache du manifeste (à reconsidérer si performance dégradée — probablement jamais nécessaire vu volume faible)
- Polices alternatives (italiques, scripts décoratifs) — pas requis par les specs Lulu

</deferred>

---

*Phase: 48-fondation-export-pdf-assets*
*Context auto-généré: 2026-05-04 (discuss skippé pour phase d'infrastructure)*
