---
phase: quick
plan: 260412-gf5
subsystem: stories-tts
tags: [fish-audio, tts, voice-clone, stories]
dependency_graph:
  requires: [elevenlabs-integration, voice-clone, story-voice-context]
  provides: [fish-audio-tts, fish-audio-voice-clone]
  affects: [stories-screen, settings-screen, story-player, voice-recorder]
tech_stack:
  added: [fish-audio-api]
  patterns: [mirror-elevenlabs-pattern, multi-engine-tts]
key_files:
  created:
    - lib/fish-audio.ts
    - lib/voice-clone-fish.ts
    - components/settings/SettingsFishAudio.tsx
  modified:
    - lib/types.ts
    - lib/parser.ts
    - contexts/StoryVoiceContext.tsx
    - components/stories/StoryPlayer.tsx
    - components/stories/VoiceRecorder.tsx
    - hooks/useVault.ts
    - hooks/useVaultProfiles.ts
    - app/(tabs)/settings.tsx
    - app/(tabs)/stories.tsx
decisions:
  - "Fish Audio TTS mirrore exactement le pattern ElevenLabs (cache MP3, dedup inflight, storyAudioPath)"
  - "Prefixe 'fa_' sur les fichiers cache Fish Audio pour eviter collision avec ElevenLabs dans stories-audio/"
  - "VoiceRecorder accepte un prop cloneEngine au lieu de dupliquer le composant"
  - "StoryPlayer utilise isApiVoice (ElevenLabs ou Fish Audio) pour factoriser la logique waveform"
metrics:
  duration: 13min
  completed: 2026-04-12
  tasks: 1
  files: 12
---

# Quick Task 260412-gf5: Ajouter Fish Audio comme 3e moteur TTS Summary

Fish Audio integre comme 3e moteur TTS pour les histoires du soir, avec clonage vocal et cache MP3 persistant — pattern identique a ElevenLabs.

## What Was Done

### Types et service TTS (lib/fish-audio.ts)
- `StoryVoiceEngine` etendu avec `'fish-audio'`
- `StoryVoiceConfig` enrichi de `fishAudioReferenceId`
- `Profile` enrichi de `voiceFishAudioId` et `voiceSource: 'fish-audio-cloned'`
- Service TTS Fish Audio : POST /v1/tts avec header model s2-pro, response binaire MP3
- Cache MP3 persistant dans documentDirectory/stories-audio/ avec prefixe `fa_`
- Dedup inflight requests (StrictMode safe)

### Clonage vocal (lib/voice-clone-fish.ts)
- Upload FormData vers POST /model (title + voices file)
- Retourne `_id` comme reference_id pour TTS ulterieur

### Context et parametres
- `StoryVoiceContext` : gestion `fishAudioKey` dans SecureStore + `isFishAudioConfigured`
- `SettingsFishAudio.tsx` : ecran de configuration cle API (pattern SettingsElevenLabs)
- Settings screen : nouvelle ligne Fish Audio avec statut configure/non configure

### Integration StoryPlayer + stories.tsx
- StoryPlayer : prop `fishAudioKey`, logique `isApiVoice` (ElevenLabs ou Fish Audio)
- stories.tsx : 3e onglet moteur "Fish Audio", profils adultes avec clonage, `buildFinalVoiceConfig` pour fish-audio
- Cache audio verifie pour Fish Audio dans la liste des histoires

### VoiceRecorder multi-engine
- Prop `cloneEngine` : 'elevenlabs' | 'fish-audio'
- Upload vers le bon service selon le moteur selectionne
- `onVoiceReady` retourne la source correcte ('fish-audio-cloned')

### Parser Markdown
- Parse/serialize `voiceFishAudioId` dans famille.md
- Parse/serialize `fish_audio_ref` + engine `fish-audio` dans les stories

## Deviations from Plan

None — plan execute exactement comme prevu.

## Known Stubs

None — toutes les fonctionnalites sont cablees end-to-end.

## Commits

| Hash | Description |
|------|-------------|
| 4aaa6cb | feat(260412-gf5): ajouter Fish Audio comme 3e moteur TTS histoires |

## Self-Check: PASSED

Verification tsc : 25 erreurs (toutes pre-existantes video/remotion + TabletSidebar). Zero erreur dans les fichiers modifies.
