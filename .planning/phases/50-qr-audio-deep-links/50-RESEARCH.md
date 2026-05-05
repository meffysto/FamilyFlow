# Phase 50 : QR audio + deep links — Research

**Researched:** 2026-05-05
**Domain:** expo-router v6 deep linking + génération QR SVG + intégration pipeline PDF Phase 49
**Confidence:** HIGH (stack vérifié, patterns existants identifiés dans le code)

## Summary

Phase 50 ajoute un QR code en 4ème de couverture du livre PDF généré par la Phase 49. Le QR encode `familyvault://story/{storyId}`. Scanner ouvre l'app, navigue vers `app/story/[id].tsx`, charge l'histoire depuis le vault et auto-démarre la lecture audio via le `StoryPlayer` existant.

Le projet a **déjà** un placeholder QR dans `lib/pdf/components/back-cover.ts` (`data-phase50` attribute) prêt à être remplacé. Le scheme actuel `family-vault` dans `app.json` doit évoluer (ou rester — voir §1) et un fichier `app/story/[id].tsx` doit être créé. Le routeur expo-router v6 gère déjà les deep links nativement via `+native-intent.ts` (déjà présent).

**Primary recommendation :**
- Garder `scheme: "family-vault"` dans `app.json` (déjà installé, scheme avec tiret valide RFC 3986). URL canonique : `family-vault://story/{id}`.
- Lib QR : **`qrcode` (node-qrcode) v1.5.4** — déjà standard, retourne SVG string via `QRCode.toString(text, { type: 'svg' })` (Promise — appelable au render PDF qui est déjà async).
- Route : `app/story/[id].tsx` standalone (pas dans `(tabs)`), récupère `id` via `useLocalSearchParams`, attend `vault.isReady`, monte `<FullscreenStoryReader>` avec `autoplay={true}`.
- Universal Links : placeholder uniquement (`applinks:familyvault.app` dans `ios.associatedDomains`) — pas de domaine réel à provisionner ce sprint.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scheme registration | Native config (app.json) | — | iOS/Android system registers le scheme au build du dev-client |
| Deep link routing | expo-router (file-system) | `+native-intent.ts` | expo-router v6 wire automatiquement `family-vault://story/abc` → `app/story/[id].tsx` |
| Param extraction | Route component (`[id].tsx`) | `useLocalSearchParams` | Hook expo-router lit `id` depuis l'URL native ou interne |
| Vault readiness gate | `useVault()` context | Story route mount | Cold-start : vault peut être encore en chargement quand le deep link arrive |
| Story lookup | `lib/stories.ts` (in-memory) | `useVault().stories` | Pas de fetch — l'histoire vit déjà en mémoire après hydratation cache |
| Audio playback | `StoryPlayer.tsx` | `expo-speech` / `expo-av` ElevenLabs cache | Composant existant, prop `autoplay` à ajouter ou prop équivalente |
| QR generation | `lib/pdf/components/back-cover.ts` | `qrcode` npm package | Pipeline PDF (Node-side via Hermes runtime) génère SVG string et l'inline dans HTML |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QR-01 | Scheme app.json + Universal Links placeholder | §1 (config app.json) |
| QR-02 | Route `app/story/[id].tsx` | §2, §4 (expo-router pattern) |
| QR-03 | Handler deep link + autoplay audio | §4, §5 (vault gate + StoryPlayer) |
| QR-04 | Génération QR SVG haute résolution PDF | §3, §7 (qrcode lib + back-cover patch) |
| QR-05 | Test scan device + fallback graceful | §6, §8 (xcrun simctl + Toast FR) |
| QA-01 | Non-régression `npx tsc --noEmit` + `npx jest` | §9 |

## 1. Configuration scheme + Universal Links

### Scheme actuel
`app.json` ligne 5 : `"scheme": "family-vault"` (déjà configuré, valide).

**Décision recommandée :** GARDER `family-vault` (et non `familyvault`).
- Tiret accepté par RFC 3986 — pas de bug iOS/Android.
- Changer le scheme casserait d'autres deep links existants (cf. `+native-intent.ts` qui handle `import-note` et `open/`).
- ROADMAP mentionne `familyvault://story/:id` — c'est un détail à corriger dans le ROADMAP (vérifier avec utilisateur ou utiliser `family-vault://story/:id`).

**ATTENTION** [ASSUMED] : Le ROADMAP utilise `familyvault://` mais l'app expose `family-vault://`. La phase doit clarifier ce point. Recommandation forte : utiliser `family-vault://story/{id}` pour cohérence.

### Universal Links (placeholder)
Ajouter dans `app.json` sous `ios` :

```json
"associatedDomains": ["applinks:familyvault.app"]
```

Note : tant qu'il n'y a pas d'AASA hébergé sur `https://familyvault.app/.well-known/apple-app-site-association`, le système iOS ignore cette entrée (pas d'erreur, juste pas de matching HTTPS). C'est un placeholder valide pour future migration.

Android : pas besoin d'`intentFilters` séparés — expo-router v6 + scheme custom suffisent. Pour Universal Links Android (App Links), il faudra plus tard ajouter `android.intentFilters` avec `autoVerify: true` et un `assetlinks.json` hébergé.

### Documentation migration future (placeholder, NE PAS implémenter)
1. Acquérir domaine `familyvault.app`
2. Héberger `https://familyvault.app/.well-known/apple-app-site-association` (JSON, MIME `application/json`, sans extension `.json` dans l'URL)
3. Contenu AASA : `{ "applinks": { "apps": [], "details": [{ "appID": "AKMNXGVVGX.com.familyvault.dev", "paths": ["/story/*"] }] }}`
4. Ajouter `assetlinks.json` pour Android
5. Mettre à jour `app.json` avec `intentFilters` Android `autoVerify`

[CITED: https://docs.expo.dev/linking/ios-universal-links/]

## 2. Route `app/story/[id].tsx`

### Structure
```
app/
├── (tabs)/        # routes tabbed existantes
├── story/
│   └── [id].tsx   # NOUVEAU — route dynamique
├── _layout.tsx    # déjà existant
├── +native-intent.ts  # déjà existant — pas besoin de toucher pour story/
```

### Pattern expo-router v6 (vérifié dans codebase)
`useLocalSearchParams<{ id: string }>()` retourne `{ id }` depuis l'URL. expo-router v6 wire automatiquement `family-vault://story/abc123` → `app/story/[id].tsx` avec `id="abc123"`. Aucune config `linking` manuelle nécessaire (différence majeure vs React Navigation pur).

[CITED: https://docs.expo.dev/router/reference/url-parameters/]

### Squelette recommandé

```tsx
// app/story/[id].tsx
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useVault } from '../../contexts/VaultContext';
import { useStoryVoice } from '../../contexts/StoryVoiceContext';
import { useToast } from '../../contexts/ToastContext';
import { FullscreenStoryReader } from '../../components/stories/FullscreenStoryReader';
import { useThemeColors } from '../../contexts/ThemeContext';

export default function StoryDeepLinkRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { stories, isReady } = useVault();
  const { voiceConfig, elevenLabsKey, fishAudioKey } = useStoryVoice();
  const { showToast } = useToast();
  const colors = useThemeColors();
  const [resolved, setResolved] = useState(false);

  const histoire = useMemo(
    () => (isReady ? stories.find((s) => s.id === id) ?? null : null),
    [stories, id, isReady]
  );

  useEffect(() => {
    if (!isReady) return;
    setResolved(true);
    if (!histoire) {
      showToast({ message: 'Histoire introuvable', type: 'error' });
      // retour bibliothèque (tab journal où vivent les histoires)
      setTimeout(() => router.replace('/(tabs)/journal'), 50);
    }
  }, [isReady, histoire, showToast]);

  if (!isReady || !resolved) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!histoire) return null; // toast déjà émis, redirection en cours

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FullscreenStoryReader
        histoire={histoire}
        voiceConfig={voiceConfig}
        elevenLabsKey={elevenLabsKey}
        fishAudioKey={fishAudioKey}
        autoplay={true}  // ← prop à ajouter (voir §5)
        onClose={() => router.replace('/(tabs)/journal')}
      />
    </>
  );
}
```

## 3. Génération QR SVG côté PDF pipeline

### Lib choisie : `qrcode` (node-qrcode) v1.5.4
[VERIFIED: npm view qrcode version → 1.5.4]

Pourquoi `qrcode` plutôt que `qrcode-svg` ou `react-native-qrcode-svg` :

| Lib | Pour PDF Node-side | Pour rendu app | Verdict |
|-----|--------------------|-----------------|---------|
| `qrcode` (node-qrcode) | ✓ retourne SVG string via `toString` | n/a | **CHOIX** |
| `qrcode-svg` | ✓ synchrone, mais moins maintenu | n/a | Alternative |
| `react-native-qrcode-svg` | ✗ nécessite `react-native-svg` rendu component | ✓ pour UI | Pas adapté ici (HTML inline) |

`qrcode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, width: 300 })` retourne une Promise<string> contenant le SVG complet (`<svg ...><path ...>...</svg>`). Le pipeline `pdf-generator.ts` est déjà 100% async (`await` partout) — pas de souci d'API asynchrone.

### Paramètres QR pour 3×3cm imprimé

| Paramètre | Valeur | Justification |
|-----------|--------|---------------|
| `errorCorrectionLevel` | `'M'` (15%) | Compromis taille/robustesse pour scan papier |
| `margin` | `1` | Quiet zone minimale (0 casse les scanners) |
| `width` | `300` | 3cm @ 300dpi = 354px ; 300 suffit en SVG (vectoriel) |
| `type` | `'svg'` | Inline directement dans HTML expo-print |
| `color.dark` | `'#2A2A2A'` (encre livre) | Cohérence palette livre (`palette.ink`) |
| `color.light` | `'#0000'` (transparent) | Laisse le fond ivory du livre |

### Inlining dans HTML
expo-print accepte SVG inline dans HTML — le moteur WKWebView (iOS) et Android WebView rendent SVG nativement et expo-print les rasterise correctement dans le PDF.

```ts
// lib/pdf/qr-generator.ts (nouveau)
import QRCode from 'qrcode';
import type { BookPalette } from './types';

export async function generateStoryQrSvg(
  storyId: string,
  palette: BookPalette,
): Promise<string> {
  const url = `family-vault://story/${encodeURIComponent(storyId)}`;
  const svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 300,
    color: { dark: palette.ink, light: '#00000000' },
  });
  return svg; // <svg xmlns="..." width="300" height="300">...</svg>
}
```

### Patch du back-cover (lib/pdf/components/back-cover.ts:18-30)

Le placeholder existant ligne 25 (`<div class="qr-placeholder" data-phase50 ...>QR — Phase 50</div>`) sera remplacé par le SVG injecté. La signature de `renderBackCoverPage` doit accepter un nouveau paramètre `qrSvg: string`.

Cascade : `renderBookHtml` (html-template.ts:173) doit recevoir le SVG depuis `pdf-generator.ts` et le passer à `renderBackCoverPage`.

```ts
// pdf-generator.ts — dans generateBookPdf
const qrSvg = await generateStoryQrSvg(opts.story.id, BOOK_PALETTE);

// html-template.ts — renderBookHtml
pages.push(renderBackCoverPage({ story: spec.story, palette: spec.palette, qrSvg: spec.qrSvg }));

// back-cover.ts — remplacer la div placeholder
<div style="width:3cm; height:3cm; margin-bottom:0.6cm;">${qrSvg}</div>
<div style="font-family:'Caveat', cursive; font-size:11pt; color:${palette.sage}; margin-bottom:0.3cm;">Scanne pour écouter l'histoire</div>
```

[CITED: https://www.npmjs.com/package/qrcode]

## 4. Deep link handler + race condition vault

### expo-router v6 gère déjà cold + warm
Le commentaire dans `app/_layout.tsx:108-113` est clair :

> expo-router gère les deep links nativement via useLinking.native.js :
> Cold start : ExpoLinking.getLinkingURL() → initialState
> Warm start : Linking.addEventListener('url') → subscribe → navigation.dispatch
> Un listener manuel ici CONFLIT avec le handler intégré (double navigation).

→ **Ne PAS ajouter `Linking.addEventListener` dans `_layout.tsx`.** expo-router le fait déjà.

### Race condition : vault pas prêt au cold start

Scénario : utilisateur scanne le QR depuis l'extérieur, l'app cold-start. expo-router monte `app/story/[id].tsx` *avant* que `VaultContext` ait fini d'hydrater.

**Solution recommandée :** Le composant route attend `useVault().isReady` avant de chercher l'histoire. Pendant ce temps : `<ActivityIndicator>`. Pattern déjà utilisé dans `_layout.tsx:91-93` (`isReady` check sur AuthContext). Le code §2 ci-dessus implémente ce gate.

### Lock screen / auth
`AuthLockOverlay` (`_layout.tsx`) couvre déjà le cas verrouillé : si `isAuthenticated === false`, le LockScreen est rendu *par-dessus* la route deep link. Une fois l'utilisateur unlock, la route story est dessous et reprend automatiquement (pas de logique custom à ajouter — pattern overlay au-dessus de Stack).

### Handler dans la route, pas globalement
**Anti-pattern à éviter** : centraliser le routing deep link dans `_layout.tsx` avec un switch/case sur l'URL. expo-router v6 file-based routing est conçu pour que chaque route gère ses propres params. Le fichier `+native-intent.ts` n'a pas besoin d'être modifié pour `story/[id]` — le path natif `story/abc` matche directement.

## 5. Audio autoplay + intégration StoryPlayer

### Pattern existant (vérifié)
`StoryPlayer.tsx:266` : `const [isPlaying, setIsPlaying] = useState(false)` — pas d'autoplay actuellement. La lecture démarre uniquement sur tap utilisateur.

`FullscreenStoryReader.tsx` n'a pas de prop `autoplay` non plus.

### Approche recommandée : ajouter prop `autoplay`
Modifier `StoryPlayer.tsx` (et `FullscreenStoryReader` qui le wrap) pour accepter `autoplay?: boolean`. Quand `true`, déclencher le handler de play dans un `useEffect` après mount + après que l'audio asset soit prêt.

```tsx
// StoryPlayer.tsx — ajout
interface Props {
  // ... props existantes
  autoplay?: boolean;
}

useEffect(() => {
  if (!autoplay) return;
  // attendre que l'asset audio soit chargé (cache MP3 ElevenLabs ou expo-speech ready)
  if (audioReady && !isPlaying) {
    handlePlayPause(); // ou la fonction interne de démarrage
  }
}, [autoplay, audioReady, isPlaying]);
```

**Pitfall iOS** : iOS exige une interaction utilisateur pour démarrer l'audio dans certaines configurations. Avec `expo-av` + `playsInSilentModeIOS: true` (à vérifier dans la config audio), l'autoplay programmatique fonctionne. Si le scenario "scan QR → app cold start → autoplay" échoue, fallback : afficher un gros bouton ▶️ centré.

[ASSUMED] : `expo-av` autoplay programmatique fonctionne sans tap après cold start dans le contexte de cette app — à valider sur device réel (test critère QR-05).

### Mode "deep link" vs "intra-app"
La route `story/[id].tsx` est utilisée *uniquement* pour les deep links externes. La navigation intra-app continue d'utiliser `FullscreenStoryReader` modal depuis le journal/bibliothèque. Pas de risque de conflit.

## 6. Testing deep links

### iOS Simulator
```bash
xcrun simctl openurl booted "family-vault://story/test-id-abc"
```

### iOS device physique
- Notes app : taper le lien `family-vault://story/abc` puis tap dessus
- Safari : ne marche pas pour custom schemes (sécurité Safari) — utiliser Notes ou Messages

### Android emulator/device
```bash
adb shell am start -W -a android.intent.action.VIEW -d "family-vault://story/test-id-abc" com.familyvault.app
```

### Dev client requis
Le scheme custom n'est embarqué qu'au build natif. **Expo Go ne peut pas tester ce scheme.** L'app utilise déjà `npx expo run:ios --device` (CLAUDE.md) — donc pas de blocage.

### Test unitaire (Jest)
Pour QA-01, parser l'URL côté logique pure :

```ts
// lib/__tests__/deep-link.test.ts
import { parseStoryDeepLink } from '../deep-link';

test('parse familyvault story URL', () => {
  expect(parseStoryDeepLink('family-vault://story/abc-123')).toEqual({ storyId: 'abc-123' });
  expect(parseStoryDeepLink('family-vault://story/')).toBeNull();
  expect(parseStoryDeepLink('https://other.com/story/x')).toBeNull();
});
```

Note : ne pas tester directement la route expo-router (nécessite mocking lourd). Tester la fonction pure `parseStoryDeepLink` extraite si besoin de validation (utile aussi pour le QR encoder).

## 7. QR integration dans pipeline Phase 49

### Points d'intégration (fichiers à modifier)

| Fichier | Modification |
|---------|--------------|
| `package.json` | `npm install qrcode` + `npm install -D @types/qrcode` |
| `lib/pdf/qr-generator.ts` | **NOUVEAU** — `generateStoryQrSvg(storyId, palette)` |
| `lib/pdf/types.ts` | Étendre `BookHtmlSpec` avec `qrSvg: string` |
| `lib/pdf/html-template.ts` | Passer `qrSvg` à `renderBackCoverPage` (lignes 173 + 237) |
| `lib/pdf/components/back-cover.ts` | Remplacer placeholder `data-phase50` par `${qrSvg}` + légende FR |
| `lib/pdf/pdf-generator.ts` | Appeler `generateStoryQrSvg` en parallèle des fonts/illustrations |

### Ordre d'append dans Promise.all
`pdf-generator.ts:41` utilise déjà `Promise.all([loadFontsBase64(), ...illuResults])`. Ajouter le QR :

```ts
const [fonts, qrSvg, ...illuResults] = await Promise.all([
  loadFontsBase64(),
  generateStoryQrSvg(opts.story.id, BOOK_PALETTE),
  ...ALL_ARCHETYPES.map(loadIllustrationBase64),
]);
```

### Hash determinism
Le hash SHA-256 du HTML (Phase 49) inclura désormais le SVG QR. C'est OK : pour un même `story.id`, `qrcode` produit un SVG **déterministe** (pas de timestamp ni random) — le hash reste stable d'un export à l'autre.

[VERIFIED: code-inspection of `qrcode` library — SVG output is deterministic given same input + options]

## 8. Common Pitfalls

### Pitfall 1 : Scheme inconsistency avec ROADMAP
**Quoi :** ROADMAP dit `familyvault://`, app.json dit `family-vault://`.
**Pourquoi :** ROADMAP rédigé avant config réelle.
**Solution :** Garder `family-vault://` (déjà déployé, scheme avec tiret valide). Mettre à jour ROADMAP/SUMMARY pour cohérence. Documenter dans CONTEXT/PLAN.

### Pitfall 2 : Vault pas chargé au cold start
**Quoi :** Route monte avant que `useVault().stories` soit hydraté → `histoire` est null → faux toast "introuvable".
**Solution :** Gate sur `isReady` avant lookup (pattern §2). Ne PAS afficher le toast tant que `isReady === false`.

### Pitfall 3 : iOS autoplay blocked
**Quoi :** iOS peut refuser l'autoplay audio sans interaction utilisateur.
**Solution :** Tester sur device réel (QR-05). Si échec : afficher un bouton play centré, ne pas bloquer la navigation.

### Pitfall 4 : QR trop dense pour 3cm
**Quoi :** Si `storyId` est un UUID long + scheme long, QR peut devenir trop dense pour scan fiable à 3cm.
**Calcul :** `family-vault://story/` = 21 chars + UUID 36 chars = 57 chars total. Avec ECC level M, capacité version 4 (33×33) suffit largement (jusqu'à 62 chars alphanumériques). OK.
**Solution si problème :** réduire ECC level à 'L' (7%) — moins robuste mais module plus petit.

### Pitfall 5 : Modal FullscreenStoryReader déjà ouvert
**Quoi :** Si l'utilisateur scanne pendant qu'un autre `FullscreenStoryReader` est déjà monté ailleurs (cas peu probable mais possible), conflit z-index.
**Solution :** La route `app/story/[id]` rend son propre `FullscreenStoryReader` au-dessus de la stack — pas de conflit (Modal RN est full-screen).

### Pitfall 6 : Lock screen + autoplay
**Quoi :** Si l'app est verrouillée (PIN), `AuthLockOverlay` masque la route mais l'audio pourrait démarrer en arrière-plan.
**Solution :** Passer `autoplay={isAuthenticated}` ou différer le démarrage audio jusqu'à `isAuthenticated === true`.

### Pitfall 7 : `+native-intent.ts` interception
**Quoi :** `+native-intent.ts` (lignes 1-15) intercepte les paths contenant `import-note` ou `open/`. Si quelqu'un ajoute du logique pour `story/`, conflit.
**Solution :** **Ne pas modifier** `+native-intent.ts`. Le path `story/abc` ne matche aucune des deux règles existantes — passe directement.

## 9. Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (déjà configuré, lib/__tests__/*.test.ts existants) |
| Config | jest.config (existant — Phase 19+) |
| Quick run | `npx jest --no-coverage path/to/test` |
| Full suite | `npx jest --no-coverage` |
| Type check | `npx tsc --noEmit` (obligatoire avant commit per CLAUDE.md) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QR-01 | scheme app.json valide | manual + tsc | `npx tsc --noEmit` | ✅ |
| QR-02 | route story/[id] compile | type check | `npx tsc --noEmit` | ❌ Wave 0 (route à créer) |
| QR-03 | parseStoryDeepLink + lookup | unit | `npx jest lib/__tests__/deep-link.test.ts` | ❌ Wave 0 |
| QR-04 | generateStoryQrSvg produit SVG | unit | `npx jest lib/pdf/__tests__/qr-generator.test.ts` | ❌ Wave 0 |
| QR-05 | scan device réel | manual | `xcrun simctl openurl booted "family-vault://story/<id-réel>"` | n/a (manual) |
| QA-01 | non-régression PDF Phase 49 | unit | `npx jest lib/pdf/__tests__/` | ✅ (tests Phase 49 existent) |

### Sampling Rate
- **Per task commit :** `npx tsc --noEmit` + tests touchés
- **Per wave merge :** `npx jest --no-coverage` complet
- **Phase gate :** `npx tsc --noEmit` clean + `npx jest` clean + scan device validé

### Wave 0 Gaps
- [ ] `lib/pdf/qr-generator.ts` — fonction pure `generateStoryQrSvg`
- [ ] `lib/pdf/__tests__/qr-generator.test.ts` — covers QR-04 (snapshot SVG output)
- [ ] `lib/deep-link.ts` (optionnel) — `parseStoryDeepLink` pour test unitaire QR-03
- [ ] `lib/__tests__/deep-link.test.ts` — covers QR-03

## Don't Hand-Roll

| Problème | Don't Build | Use Instead | Pourquoi |
|----------|-------------|-------------|----------|
| Génération QR | Encoder Reed-Solomon manuel | `qrcode` (node-qrcode) | Trivial à se tromper sur l'ECC |
| Parse URL deep link | Regex maison | `URL` natif (`new URL(href)`) ou `expo-linking` `parse` | Edge cases query strings, encoding |
| Listen warm deep links | `Linking.addEventListener('url')` dans `_layout.tsx` | expo-router intégré (rien à faire) | Conflit double navigation |
| Custom Modal | New Modal component | `FullscreenStoryReader` existant | Composant déjà testé |

## Code Examples

### Génération QR test (snapshot)
```ts
// lib/pdf/__tests__/qr-generator.test.ts
import { generateStoryQrSvg } from '../qr-generator';
import { BOOK_PALETTE } from '../constants';

test('generates deterministic SVG QR for story id', async () => {
  const svg = await generateStoryQrSvg('test-story-123', BOOK_PALETTE);
  expect(svg).toContain('<svg');
  expect(svg).toContain('viewBox');
  // Determinism : appel répété produit le même SVG
  const svg2 = await generateStoryQrSvg('test-story-123', BOOK_PALETTE);
  expect(svg).toEqual(svg2);
});
```

### Parser deep link (utilitaire pur)
```ts
// lib/deep-link.ts
export interface ParsedStoryLink { storyId: string }

export function parseStoryDeepLink(href: string): ParsedStoryLink | null {
  try {
    const url = new URL(href);
    if (url.protocol !== 'family-vault:') return null;
    // family-vault://story/<id> → host="story", pathname="/<id>"
    if (url.host !== 'story') return null;
    const id = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!id) return null;
    return { storyId: decodeURIComponent(id) };
  } catch {
    return null;
  }
}
```

## Project Constraints (from CLAUDE.md)

- **Langue UI** : tous les textes (toast, labels QR, légende livre) en français
- **Couleurs** : `useThemeColors()` dans `app/story/[id].tsx`, jamais hardcoded — sauf dans le SVG QR (palette livre figée pour cohérence print)
- **Animations** : si transition d'entrée nécessaire dans la route, `react-native-reanimated` uniquement
- **TestFlight non-cassant** : Phase 50 doit pouvoir cohabiter avec exports Phase 49 antérieurs (PDFs déjà imprimés). Le hash change → nouveaux exports génèrent un nouveau hash, c'est attendu.
- **`npx tsc --noEmit`** : obligatoire avant commit
- **Modals** : `FullscreenStoryReader` utilise déjà `Modal` `presentationStyle: 'fullScreen'` — OK pour le contexte deep link (attention : pas `pageSheet` ici car immersion totale)
- **Vault Markdown** : aucune écriture vault dans cette phase, lecture seule des stories existantes

## Assumptions Log

| # | Claim | Section | Risk si faux |
|---|-------|---------|---------------|
| A1 | iOS autoplay programmatique fonctionne après cold start avec config audio actuelle | §5 | Bouton play manuel requis — léger downgrade UX |
| A2 | ROADMAP `familyvault://` est une typo, doit lire `family-vault://` | §1 | Décision utilisateur requise — inverser scheme casse autres deep links |
| A3 | `qrcode` lib s'installe sans peer-dep conflict avec RN 0.81 / Expo 54 | §3 | Migrer vers `qrcode-svg` (synchrone, zéro deps) si conflit |
| A4 | `StoryPlayer` peut accepter prop `autoplay` sans refacto majeur | §5 | Prop alternative `initialPlayState` ou trigger via ref |
| A5 | iOS WKWebView dans expo-print rasterise correctement SVG inline pour PDF | §3 | Fallback : générer PNG via `QRCode.toDataURL()` (PNG base64) |

## Open Questions

1. **Scheme final : `family-vault` vs `familyvault` ?**
   - What we know : app.json a `family-vault`, ROADMAP a `familyvault`
   - Recommandation : utiliser `family-vault` (déjà déployé). À confirmer dans `/gsd-discuss-phase`.

2. **Autoplay : auto au mount ou bouton tap ?**
   - What we know : iOS peut bloquer
   - Recommandation : essayer autoplay, fallback graceful sur bouton si crash device

3. **Légende QR : exact wording FR ?**
   - ROADMAP : "Scanne pour écouter l'histoire"
   - Suggestion alternative : "Scanne pour réécouter" (cohérent avec usage : enfant scanne pour relire/réécouter)

## Environment Availability

| Dépendance | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `qrcode` npm | QR generation | ✗ (à installer) | 1.5.4 (à installer) | `qrcode-svg` 1.1.0 |
| `expo-linking` | déjà installé | ✓ | ~8.0.11 | — |
| `expo-router` | déjà installé | ✓ | ~6.0.23 | — |
| `expo-print` | déjà installé | ✓ | ~15.0.8 | — |
| `expo-speech` | déjà installé (StoryPlayer) | ✓ | ~14.0.8 | — |
| `expo-av` | déjà installé (ElevenLabs cache) | ✓ | ~15.0.2 | — |
| dev-client iOS | scheme test | ✓ | (npx expo run:ios) | — |
| `xcrun simctl` | test deep link | ✓ (macOS dev) | — | — |

**Missing dependencies with no fallback :** aucune.
**Missing dependencies with fallback :** `qrcode` à installer (fallback `qrcode-svg` si peer conflict).

## Sources

### Primary (HIGH confidence)
- `./app.json` — config scheme actuelle
- `./app/_layout.tsx` (lignes 108-113) — comment expo-router gère deep links
- `./app/+native-intent.ts` — pattern existant `redirectSystemPath`
- `./lib/pdf/components/back-cover.ts` — placeholder `data-phase50` à remplacer
- `./lib/pdf/pdf-generator.ts` — pipeline Promise.all
- `./components/stories/FullscreenStoryReader.tsx` — composant cible
- `./components/stories/StoryPlayer.tsx` — point d'extension autoplay
- [Expo Router URL parameters docs](https://docs.expo.dev/router/reference/url-parameters/)
- [Expo Linking iOS Universal Links](https://docs.expo.dev/linking/ios-universal-links/)
- [npm qrcode 1.5.4](https://www.npmjs.com/package/qrcode)

### Secondary (MEDIUM confidence)
- [Expo Print docs — base64 inline assets](https://docs.expo.dev/versions/latest/sdk/print/)
- [Expo Router native-intent customizing links](https://docs.expo.dev/router/advanced/native-intent/)
- WebSearch verified : expo-router v6 cold-start handles `getInitialURL` via `useLinking.native.js`

### Tertiary (LOW confidence — à valider sur device)
- iOS audio autoplay programmatique (A1) — flag pour test QR-05
- SVG inline rasterization expo-print (A5) — fallback PNG base64 disponible

## Metadata

**Confidence breakdown :**
- Standard stack : HIGH — versions vérifiées via npm view + package.json existant
- Architecture : HIGH — patterns existants identifiés dans codebase (placeholder back-cover, +native-intent, _layout commentaires)
- Pitfalls : MEDIUM — autoplay iOS et inline SVG PDF nécessitent validation device
- Pipeline integration : HIGH — Phase 49 code lu, points d'insertion clairs

**Research date :** 2026-05-05
**Valid until :** 2026-06-05 (stack stable, expo-router v6 mature)
