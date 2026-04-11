---
phase: 260412-0bj
plan: 01
subsystem: stories/voice
tags: [ios-personal-voice, elevenlabs, expo-speech, fallback-genre, session-only]
dependency_graph:
  requires: [260411-wyx]
  provides: [IVC-VOICE-iOS-PERSONAL, IVC-VOICE-FALLBACK-GENDER]
  affects: [components/stories/StoryPlayer.tsx, lib/types.ts]
tech_stack:
  added: []
  patterns: [ios-personal-voice-identifier, elevenlabs-gender-fallback, session-only-override]
key_files:
  modified:
    - lib/types.ts
    - components/stories/StoryPlayer.tsx
decisions:
  - voiceIdentifier session-only dans StoryVoiceConfig — jamais persisté dans le markdown vault
  - Fallback ElevenLabs par genre déclenché uniquement si voiceConfig.engine === 'elevenlabs' — pas de dégradation pour les familles expo-speech
  - Gender mapping explicite fille→Bella / tout autre→Adam via ELEVENLABS_FRENCH_VOICES.find() (pas de hardcode inline)
metrics:
  duration: 5min
  completed: 2026-04-12
  tasks: 2
  files: 2
---

# Phase 260412-0bj Plan 01: iOS Personal Voice branch + fallback ElevenLabs par genre — Summary

**One-liner:** Branche iOS Personal Voice via voiceIdentifier dans expo-speech + fallback ElevenLabs Bella/Adam par genre dans effectiveVoiceConfig, session-only sans mutation profil.

## Modifications apportées

### lib/types.ts

Ajout du champ optionnel `voiceIdentifier?: string` dans `StoryVoiceConfig` (ligne 615) :

```typescript
export interface StoryVoiceConfig {
  engine: StoryVoiceEngine;
  language: 'fr' | 'en';
  elevenLabsVoiceId?: string;
  voiceIdentifier?: string; // identifier iOS Personal Voice (expo-speech) — session-only
}
```

Le champ est session-only et n'est jamais persisté dans les fichiers markdown vault.

### components/stories/StoryPlayer.tsx

**Import ajouté :**
```typescript
import { ELEVENLABS_FRENCH_VOICES } from '../../lib/stories';
```

**effectiveVoiceConfig (useMemo) — 3 branches dans l'ordre de priorité :**

1. iOS Personal Voice : `voiceSource === 'ios-personal' && voicePersonalId` → retourne `{ engine: 'expo-speech', voiceIdentifier: parent.voicePersonalId }`
2. Clone ElevenLabs : `voiceElevenLabsId` présent → retourne `{ engine: 'elevenlabs', elevenLabsVoiceId }`
3. Fallback ElevenLabs preset par genre (uniquement si `voiceConfig.engine === 'elevenlabs'`) :
   - `gender === 'fille'` → Bella (`EXAVITQu4vr4xnSDxMaL`)
   - `gender === 'garçon'` ou absent → Adam (`pNInz6obpgDQGcFmaJgB`)
   - Résolution via `ELEVENLABS_FRENCH_VOICES.find(v => v.id === targetId)` — pas de hardcode

**startPlayback — branche expo-speech :**

`voiceId` initialisé à `effectiveVoiceConfig.voiceIdentifier` (iOS Personal Voice si défini). La résolution par `getAvailableVoicesAsync()` n'est exécutée que si `voiceIdentifier` est absent (undefined). Log DEV distinct pour les deux chemins.

## Résultat tsc --noEmit

Aucune nouvelle erreur (sortie vide après filtrage des erreurs pré-existantes MemoryEditor/cooklang/useVault).

## Résultats greps de vérification

```
lib/types.ts:615:  voiceIdentifier?: string; // identifier iOS Personal Voice (expo-speech) — session-only
components/stories/StoryPlayer.tsx:144:        voiceIdentifier: parent.voicePersonalId,
components/stories/StoryPlayer.tsx:207:      let voiceId: string | undefined = effectiveVoiceConfig.voiceIdentifier;
StoryPlayer.tsx:17:import { ELEVENLABS_FRENCH_VOICES } from '../../lib/stories';
StoryPlayer.tsx:163:      const preset = ELEVENLABS_FRENCH_VOICES.find(v => v.id === targetId);
StoryPlayer.tsx:162:      const targetId = parent.gender === 'fille' ? BELLA_ID : ADAM_ID;
StoryPlayer.tsx:140:    if (parent.voiceSource === 'ios-personal' && parent.voicePersonalId) {
updateProfile: uniquement dans onVoiceReady (clonage) — aucun appel dans la logique fallback
```

## Commits

- `754f6ba` feat(260412-0bj): ajouter voiceIdentifier dans StoryVoiceConfig
- `42d702a` feat(260412-0bj): brancher iOS Personal Voice + fallback ElevenLabs par genre dans StoryPlayer

## Tests manuels device restants (non bloquants)

- Profil adulte avec `voiceSource: 'ios-personal'` + `voicePersonalId: '<id Apple>'` → Speech.speak utilise cet identifier (log DEV "Voix iOS Personal Voice explicite: ...")
- Profil adulte sans voix, engine ElevenLabs → Adam utilisé par défaut
- Profil adulte `gender: 'fille'` sans voix, engine ElevenLabs → Bella utilisé
- Bouton + toujours visible pour les profils sans clone (hasClone conditionnel inchangé)

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

## Known Stubs

None — voiceIdentifier est résolu dynamiquement depuis parent.voicePersonalId (données vault réelles).

## Self-Check: PASSED

- lib/types.ts contient `voiceIdentifier?: string` ✓
- components/stories/StoryPlayer.tsx contient import ELEVENLABS_FRENCH_VOICES ✓
- Commits 754f6ba et 42d702a existent ✓
