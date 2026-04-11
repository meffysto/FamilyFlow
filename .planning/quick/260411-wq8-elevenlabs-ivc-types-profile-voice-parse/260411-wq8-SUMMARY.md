---
phase: quick-260411-wq8
plan: 01
subsystem: voix-tts
tags: [elevenlabs, ivc, ios-personal-voice, types, parser, voice-clone]
dependency_graph:
  requires: []
  provides: [Profile.voiceElevenLabsId, Profile.voicePersonalId, Profile.voiceSource, uploadVoiceClone, getPersonalVoices]
  affects: [lib/types.ts, lib/parser.ts]
tech_stack:
  added: [expo-file-system/legacy (voice-clone), expo-speech (personal-voice)]
  patterns: [multipart/form-data FormData React Native, expo-speech VoiceQuality enum, parser key:value famille.md]
key_files:
  modified:
    - lib/types.ts
    - lib/parser.ts
  created:
    - lib/voice-clone.ts
    - lib/personal-voice.ts
decisions:
  - "Comparaison qualité voix via Set<string> au lieu de l'enum expo-speech — 'Premium' absent de l'enum actuel mais retourné par iOS au runtime"
  - "FormData React Native avec descriptor {uri, name, type} — pas de lecture base64 nécessaire pour multipart upload"
metrics:
  duration: "8min"
  completed: "2026-04-11"
  tasks: 3
  files: 4
---

# Quick Task 260411-wq8: Fondation IVC — types Profile + parser famille.md + services voix ElevenLabs/iOS

Ajout de 3 champs voix TTS optionnels dans l'interface Profile, lecture/écriture round-trip dans famille.md, service upload IVC vers ElevenLabs, et service détection iOS Personal Voice via expo-speech.

## Fichiers modifiés/créés

| Fichier | Action | Description |
|---------|--------|-------------|
| `lib/types.ts` | Modifié | +3 champs voix TTS dans Profile |
| `lib/parser.ts` | Modifié | parseFamille + serializeFamille lisent/écrivent les 3 champs voix |
| `lib/voice-clone.ts` | Créé | Service upload IVC vers ElevenLabs |
| `lib/personal-voice.ts` | Créé | Détection voix iOS Enhanced/Premium |

## Exports clés

```typescript
// lib/types.ts — Interface Profile
voiceElevenLabsId?: string;   // voice_id ElevenLabs (cloné ou prédéfini)
voicePersonalId?: string;     // identifier iOS Personal Voice
voiceSource?: 'ios-personal' | 'elevenlabs-cloned' | 'elevenlabs-preset' | 'expo-speech';

// lib/voice-clone.ts
export async function uploadVoiceClone(
  audioUri: string,
  profileName: string,
  apiKey: string,
): Promise<string>

// lib/personal-voice.ts
export async function getPersonalVoices(): Promise<Speech.Voice[]>
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | ed8d7bc | feat(quick-260411-wq8-01): ajouter champs voix TTS dans Profile + parser famille.md |
| 2 | c1b3396 | feat(quick-260411-wq8-02): créer lib/voice-clone.ts — upload IVC vers ElevenLabs |
| 3 | cf5f11c | feat(quick-260411-wq8-03): créer lib/personal-voice.ts — détection iOS Personal Voice |

## Confirmation tsc --noEmit

`npx tsc --noEmit` passe sans nouvelle erreur (erreurs pré-existantes MemoryEditor.tsx, cooklang.ts, useVault.ts ignorées conformément à CLAUDE.md).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comparaison enum expo-speech pour 'Premium' inexistant**
- **Trouvé pendant:** Task 3
- **Problème:** L'enum `Speech.VoiceQuality` de la version expo-speech installée ne contient que `Default` et `Enhanced` — pas `Premium`. Comparaison string directe `=== 'Premium'` déclenchait une erreur TypeScript TS2367 ("no overlap").
- **Correction:** Utilisation d'un `Set<string>` incluant `Speech.VoiceQuality.Enhanced` et la string `'Premium'` avec cast `as string` — robuste cross-version et compatible avec les voix iOS retournées au runtime.
- **Fichiers modifiés:** lib/personal-voice.ts
- **Commit:** cf5f11c

## Prochaine étape suggérée

Brancher ces services dans un écran de configuration voix du profil :
- Écran "Configurer ma voix" accessible depuis le profil famille
- Bouton d'enregistrement vocal (expo-av) → appel `uploadVoiceClone` → sauvegarde `voiceElevenLabsId` + `voiceSource: 'elevenlabs-cloned'`
- Liste des voix iOS via `getPersonalVoices` → sélection → sauvegarde `voicePersonalId` + `voiceSource: 'ios-personal'`
- Intégration StoryPlayer : utiliser `profile.voiceSource` pour choisir le moteur TTS

## Self-Check: PASSED

- lib/types.ts: FOUND
- lib/parser.ts: FOUND
- lib/voice-clone.ts: FOUND
- lib/personal-voice.ts: FOUND
- Commit ed8d7bc: FOUND
- Commit c1b3396: FOUND
- Commit cf5f11c: FOUND
