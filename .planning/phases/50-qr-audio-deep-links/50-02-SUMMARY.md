---
phase: 50-qr-audio-deep-links
plan: 02
subsystem: deep-links + audio
tags: [deep-link, qr, story, autoplay, expo-router]
requires: [50-01]
provides:
  - "Route deep link app/story/[id].tsx"
  - "parseStoryDeepLink util Jest-testable"
  - "Prop autoplay sur StoryPlayer + FullscreenStoryReader"
affects: [components/stories/StoryPlayer.tsx, components/stories/FullscreenStoryReader.tsx]
key-files:
  created:
    - app/story/[id].tsx
    - lib/deep-link.ts
    - lib/__tests__/deep-link.test.ts
  modified:
    - components/stories/StoryPlayer.tsx
    - components/stories/FullscreenStoryReader.tsx
decisions:
  - "Route hors (tabs)/ pour permettre fullscreen sans tab bar"
  - "Gate isLoading (alias isReady) avant lookup story (race condition cold start)"
  - "Réutilise startElevenLabs/startExpoSpeech pour autoplay (matche flow tap utilisateur)"
  - "autoGenerate aligné sur autoplay (deep link cold = pas de cache pré-chauffé)"
  - "Aucun listener Linking manuel — expo-router v6 gère cold + warm nativement"
metrics:
  tasks-completed: 4
  commits: 3
  tests-added: 7
  date: 2026-05-05
---

# Phase 50 Plan 02 : Route deep link `app/story/[id]` + autoplay audio

Déclenche `FullscreenStoryReader` avec autoplay TTS quand l'utilisateur scanne un QR `family-vault://story/<id>`, avec gate `isReady` pour éviter le toast prématuré au cold start et fallback FR pour les ids inconnus.

## Tâches accomplies

| #   | Task                                                | Commit     |
| --- | --------------------------------------------------- | ---------- |
| 1   | `parseStoryDeepLink` + 7 tests Jest                 | `0dabbfbf` |
| 2   | Prop `autoplay` sur StoryPlayer + FullscreenStoryReader | `1175c0af` |
| 3   | Route `app/story/[id].tsx` (lookup + gate + autoplay) | `df81ca47` |
| 4   | Vérification TS + Jest non-régression               | (no-commit) |

## Fichiers créés

- `lib/deep-link.ts` — utilitaire pur `parseStoryDeepLink(href: string): { storyId: string } | null`
- `lib/__tests__/deep-link.test.ts` — 7 cas (happy, percent-encoding, id vide, host invalide, scheme invalide, URL malformée, multi-segment)
- `app/story/[id].tsx` — route deep link avec gate `isLoading`, fallback toast FR, autoplay propagé

## Fichiers modifiés

- `components/stories/StoryPlayer.tsx` — prop `autoplay?: boolean` + useEffect garde-fou (`autoplayTriggeredRef`) qui appelle directement `startElevenLabs()` ou `startExpoSpeech()` une seule fois quand l'audio est prêt
- `components/stories/FullscreenStoryReader.tsx` — prop `autoplay?: boolean` propagée à `StoryPlayer`, `autoGenerate` aligné sur `autoplay` pour permettre la génération TTS au cold start QR

## Décisions d'implémentation

### Garde-fou autoplay
Plutôt que de toggler `setIsPlaying(true)` (qui dépend des effects existants), on appelle directement `startElevenLabs()` ou `startExpoSpeech()` — ça matche exactement le flow d'un tap utilisateur dans `togglePlay`. La ref `autoplayTriggeredRef` empêche toute relance après pause/play utilisateur.

### `autoGenerate` couplé à `autoplay`
Quand le `FullscreenStoryReader` est ouvert depuis la liste journal (mode normal), un `StoryPlayer` inline a déjà chauffé le cache disque ElevenLabs → `autoGenerate=false` suffit. Mais lors d'un scan QR cold start, AUCUN player inline n'a tourné → `autoGenerate` doit être `true` pour générer ou hit le cache. La règle simple : `autoGenerate={autoplay}`.

### Gate `isLoading` (alias `isReady`)
`useVault()` expose `isLoading: boolean`. Le plan parle de `isReady` — interprété comme `!isLoading`. Le `useState(hasResolved)` empêche un double-render de relancer le lookup et le toast quand `stories[]` se met à jour après hydratation.

### `useStoryVoice()` shape vérifiée
`{ voiceConfig: StoryVoiceConfig; elevenLabsKey: string; fishAudioKey: string; ... }` — match parfait avec les props attendues par `FullscreenStoryReader`.

### Couleurs
`colors.bg` (token correct, pas `colors.background`) + `primary` exposé directement par `useThemeColors()`. Zéro hex hardcoded dans la route.

### Pas de listener manuel
Conformément au commentaire `app/_layout.tsx:105-110` et à `+native-intent.ts` (qui ne match ni `import-note` ni `open/`), expo-router v6 route directement `family-vault://story/<id>` vers `app/story/[id].tsx`. Aucune modification de `_layout.tsx` ni `+native-intent.ts`.

## Vérification

- `npx jest --no-coverage lib/__tests__/deep-link.test.ts` → 7/7 passent
- `npx tsc --noEmit` → aucune nouvelle erreur (hors pré-existantes : `MemoryEditor.tsx`, `cooklang.ts`, `useVault.ts`)
- 3 commits FR atomiques `feat(50-02): ...`
- `app/_layout.tsx` et `app/+native-intent.ts` non touchés (vérifié `git diff`)

## Open questions pour Plan 50-04 (test device)

1. **Autoplay iOS audio policy** — la politique iOS exige généralement une interaction utilisateur avant de jouer de l'audio. Le scan QR est-il considéré comme tel par le système ? Si bloqué, ajouter un fallback bouton play visible immédiatement (le composant le supporte déjà : `autoplay=false` est le comportement par défaut).
2. **Cold start latence** — quand l'app est tuée et que le scan ouvre la route, `isLoading` reste `true` plusieurs secondes. Le spinner suffit-il ou faut-il un message "Préparation de l'histoire…" ?
3. **Histoire générée mais pas encore TTS** — si l'histoire existe mais n'a jamais été lue (pas de cache ElevenLabs), le player va générer à la volée → délai potentiel de 3-10s avant que `audioPath` soit défini. UX à valider.
4. **Test scan device** — `xcrun simctl openurl booted "family-vault://story/<id>"` doit ouvrir la route directement.

## Coordination

Plan 50-03 (génération QR SVG) tourne en parallèle — domaines disjoints respectés :
- 50-02 touche : `app/story/[id].tsx`, `lib/deep-link.ts`, `components/stories/*`
- 50-03 touche : `lib/pdf/qr-generator.ts` + intégration `back-cover.ts`

## Self-Check : PASSED

- [x] `lib/deep-link.ts` existe (vérifié)
- [x] `lib/__tests__/deep-link.test.ts` existe + 7 tests passent (vérifié `npx jest`)
- [x] `app/story/[id].tsx` existe (vérifié `ls`)
- [x] `components/stories/StoryPlayer.tsx` expose prop `autoplay` (vérifié grep)
- [x] `components/stories/FullscreenStoryReader.tsx` expose prop `autoplay` (vérifié grep)
- [x] Commits `0dabbfbf`, `1175c0af`, `df81ca47` présents dans `git log` (vérifié)
- [x] `app/_layout.tsx` et `app/+native-intent.ts` non modifiés (vérifié `git diff`)
- [x] `npx tsc --noEmit` clean hors pré-existantes
