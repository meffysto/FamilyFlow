# Phase 50 : QR audio + deep links — Contexte

**Status:** Ready for planning
**Source:** ROADMAP entry + research + 3 décisions express

<domain>
## Phase Boundary

Ajouter le système de QR code audio en 4ème de couverture du livre PDF (Phase 49) avec deep link `family-vault://story/:id` qui rouvre l'histoire dans l'app et lance l'audio TTS automatiquement.

Scope :
- Configuration scheme + Universal Links placeholder dans `app.json`
- Route `app/story/[id].tsx` avec handler deep link et autoplay audio
- Génération QR code SVG haute résolution embarqué dans le pipeline PDF Phase 49
- Tests scan device + fallback graceful (id inexistant) + non-régression
</domain>

<decisions>
## Implementation Decisions

### Scheme deep link
- **Conserver `family-vault://`** (déjà configuré dans `app.json`) — diverge du ROADMAP (`familyvault://`) mais évite de casser les builds existants
- Format final : `family-vault://story/:id`

### Universal Links
- Placeholder `associatedDomains` dans `app.json` `ios.associatedDomains` — pas de domaine réel pour l'instant
- Documenter le futur path AASA dans le SUMMARY (hors scope Phase 50)

### Routing & deep link handling
- Route nouvelle : `app/story/[id].tsx` (en dehors de `(tabs)/`)
- **Pas de listener manuel `Linking.addEventListener`** — expo-router v6 gère déjà cold + warm via `useLinking.native.js` (voir `app/_layout.tsx` lignes 108-113)
- Gate sur `useVault().isReady` avant lookup pour éviter faux toast au cold start
- AuthLockOverlay couvre déjà le cas verrouillé

### Audio autoplay
- **Autoplay au mount** : la TTS démarre automatiquement à l'arrivée sur la route (UX scan QR enfant optimale)
- Risque iOS audio policy à valider sur device — si bloqué, fallback bouton play à ajouter en Phase 50-04
- Nouvelle prop `autoplay?: boolean` sur `StoryPlayer` / `FullscreenStoryReader`

### Fallback graceful
- ID inexistant → toast FR "Histoire introuvable" (via `ToastProvider`) + retour `/(tabs)` sans crash
- Vault pas prêt → spinner de chargement, pas de toast prématuré

### QR code generation
- **Lib : `qrcode` v1.5.4** (`QRCode.toString(text, { type: 'svg' })`)
- Async OK : pipeline `lib/pdf/pdf-generator.ts` est déjà 100% async
- Output déterministe → hash SHA-256 stable
- Format : 3×3cm (300dpi équivalent), error correction `M`, encode `family-vault://story/{storyId}`
- Légende : "Scanne pour écouter l'histoire"
- Insertion : remplacer le placeholder `<div data-phase50>` dans `lib/pdf/components/back-cover.ts:25`

### Testing
- Unit : test Jest parsing deep link (`family-vault://story/abc` → `{ id: 'abc' }`)
- Device : `xcrun simctl openurl booted "family-vault://story/{id}"` documenté dans le SUMMARY
- Non-régression : `npx tsc --noEmit` clean + `npx jest --no-coverage` clean

### Claude's Discretion
- Implémentation interne du handler de route (Linking.parseInitialURLAsync vs hooks expo-router)
- Style visuel du QR (couleur dark/foreground/background) — à harmoniser avec design Phase 49
- Position exacte du QR sur la 4ème de couverture
</decisions>

<canonical_refs>
## Canonical References

### Phase 49 (dépendance directe — pipeline PDF en place)
- `.planning/phases/49-layout-livre-generation-pdf/49-PHASE-SUMMARY.md` — récap pipeline complet
- `.planning/phases/49-layout-livre-generation-pdf/49-03-PLAN.md` — pipeline expo-print + hash
- `.planning/phases/49-layout-livre-generation-pdf/49-04-PLAN.md` — fallback texte-seul + saga tome

### Code existant à modifier
- `app.json` — scheme + associatedDomains
- `app/_layout.tsx` — providers, attention aux commentaires lignes 108-113 (pas de listener manuel)
- `lib/pdf/pdf-generator.ts` — orchestration export, ajouter await génération QR
- `lib/pdf/components/back-cover.ts:25` — placeholder `<div data-phase50>` à remplacer
- `lib/pdf/html-template.ts` lignes 173, 237 — points d'insertion pipeline
- `contexts/StoryVoiceContext.tsx` — TTS, ajouter mode autoplay
- `components/story/StoryPlayer.tsx` / `FullscreenStoryReader.tsx` — prop `autoplay`

### Recherche détaillée
- `.planning/phases/50-qr-audio-deep-links/50-RESEARCH.md`
</canonical_refs>

<specifics>
## Specific Ideas

### Plans pré-définis (ROADMAP)
- 50-01 : Configuration scheme + Universal Links app.json (~10 lignes)
- 50-02 : Route `app/story/[id].tsx` + handler deep link + autoplay audio
- 50-03 : Génération QR SVG haute résolution embarqué PDF (~6 fichiers)
- 50-04 : Test scan device + fallback graceful + non-régression

### Pitfalls à anticiper (cf RESEARCH.md)
- Race condition vault au cold start → gate sur `isReady`
- Autoplay iOS audio policy → fallback bouton play prêt si nécessaire
- SVG inline vs base64 pour expo-print rasterization
</specifics>

<deferred>
## Deferred Ideas

- Universal Links réels (apple-app-site-association hosting) — nécessite domaine et serveur
- Android intent filters (focus iOS pour la phase, Android suit le scheme automatiquement)
- Liens deep link inversés (partage app → web fallback)
- Analytics scan QR (nombre de scans par histoire)
</deferred>

---

*Phase : 50-qr-audio-deep-links*
*Context gathered: 2026-05-05 via ROADMAP + research + 3 décisions express*
