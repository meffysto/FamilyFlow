---
phase: quick-260411-wyx
plan: "01"
subsystem: stories
tags: [voice, elevenlabs, ivc, storyplayer, reanimated]
dependency_graph:
  requires: [lib/voice-clone.ts, lib/elevenlabs.ts, contexts/StoryVoiceContext.tsx]
  provides: [components/stories/VoiceRecorder.tsx, VoiceRecorder hook into StoryPlayer]
  affects: [components/stories/StoryPlayer.tsx, hooks/useVaultProfiles.ts, hooks/useVault.ts]
tech_stack:
  added: []
  patterns: [expo-av Audio.Recording, Reanimated withRepeat/withSequence, Modal pageSheet, useMemo effectiveVoiceConfig]
key_files:
  created:
    - components/stories/VoiceRecorder.tsx
  modified:
    - components/stories/StoryPlayer.tsx
    - hooks/useVaultProfiles.ts
    - hooks/useVault.ts
decisions:
  - useVault importé depuis contexts/VaultContext (pas hooks/useVault) — le plan indiquait hooks/useVault mais l'export réel est dans VaultContext
  - Profile type importé explicitement pour typer les paramètres .filter()/.find() des useMemo (strict mode TS)
metrics:
  duration: "~10 min"
  completed: "2026-04-11"
  tasks_completed: 3
  files_modified: 4
---

# Phase quick-260411-wyx Plan 01 : VoiceRecorder — Composant enregistrement vocal + sélecteur voix parent — Summary

**One-liner:** Composant VoiceRecorder (expo-av + ElevenLabs IVC + 5 barres Reanimated) intégré dans StoryPlayer avec chips adultes, override session-only effectiveVoiceConfig, et persistance voiceElevenLabsId via updateProfile étendu.

## What Was Built

### Task 1 — Étendre signature updateProfile pour les champs voix
Commit: `107916d`

Ajout de `voiceElevenLabsId?`, `voicePersonalId?`, `voiceSource?` dans les deux endroits :
- Interface `UseVaultProfilesResult.updateProfile` (hooks/useVaultProfiles.ts ligne 58)
- Implémentation `updateProfile` useCallback (hooks/useVaultProfiles.ts ligne 301)
- Interface `VaultState.updateProfile` (hooks/useVault.ts ligne 158)

Aucune modification de l'implémentation — la boucle `Object.entries(updates)` traite automatiquement les nouveaux champs, et `parseFamille`/`serializeFamille` les supporte déjà (Phase 260411-wq8).

### Task 2 — Créer components/stories/VoiceRecorder.tsx
Commit: `afd5898`

Nouveau composant `VoiceRecorder` avec :
- États `idle | recording | uploading | done`
- Timer 0→120s formaté `m:ss` avec auto-stop `setTimeout(120_000)`
- 5 barres animées `RecordBar` (Reanimated `withRepeat`+`withSequence`, constante `SPRING_WAVE` module-level)
- Demande permission micro, mode audio IOS, cleanup au démontage
- `uploadVoiceClone(uri, profileName, apiKey)` → callback `onVoiceReady(voiceId, 'elevenlabs-cloned')`
- Zéro couleur hardcodée, tokens `Spacing.*` / `FontSize.*` / `FontWeight.*` partout

### Task 3 — Intégrer sélecteur voix parent + modal VoiceRecorder dans StoryPlayer
Commit: `53855c4`

Modifications dans `StoryPlayer.tsx` :
- Import `Modal` (react-native), `useVault` (contexts/VaultContext), `VoiceRecorder`, `Profile` (lib/types)
- `adultProfiles` via `profiles.filter((p: Profile) => p.role === 'adulte')` + useMemo
- `effectiveVoiceConfig` useMemo : override session-only quand parent sélectionné avec `voiceElevenLabsId`
- `startPlayback` / `stopPlayback` : toutes références `voiceConfig.*` remplacées par `effectiveVoiceConfig.*`
- Section "Voix du narrateur" avec chips adultes (toggle + highlight primary) + bouton `+` vers modal
- Modal pageSheet `VoiceRecorder` → `onVoiceReady` → `updateProfile(id, { voiceElevenLabsId, voiceSource })` → auto-sélection chip parent
- 9 nouveaux styles dans `StyleSheet.create`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Import incorrect] useVault importé depuis VaultContext et non hooks/useVault**
- **Found during:** Task 3
- **Issue:** Le plan indiquait `import { useVault } from '../../hooks/useVault'` mais `useVault` n'est pas exporté par `hooks/useVault.ts` (ce fichier exporte `VaultState`, `VAULT_PATH_KEY`, etc.). L'export `useVault()` est dans `contexts/VaultContext.tsx`.
- **Fix:** Import corrigé vers `../../contexts/VaultContext`
- **Files modified:** components/stories/StoryPlayer.tsx
- **Commit:** 53855c4

**2. [Rule 1 - Bug TypeScript] Annotations de type explicites sur les callbacks filter/find**
- **Found during:** Task 3
- **Issue:** TypeScript en mode strict signalait `Parameter 'p' implicitly has an 'any' type` dans les useMemo callbacks. `profiles` de `useVault()` est bien `Profile[]` mais TS ne propagait pas le type dans les lambdas imbriqués dans useMemo.
- **Fix:** Ajout de `(p: Profile)` explicite + import `Profile` depuis `lib/types`
- **Files modified:** components/stories/StoryPlayer.tsx
- **Commit:** 53855c4

## Known Stubs

Aucun stub — toutes les fonctionnalités sont câblées et opérationnelles.

## Self-Check: PASSED

- [x] `components/stories/VoiceRecorder.tsx` existe
- [x] `components/stories/StoryPlayer.tsx` modifié
- [x] `hooks/useVaultProfiles.ts` modifié
- [x] `hooks/useVault.ts` modifié
- [x] Commits `107916d`, `afd5898`, `53855c4` présents
- [x] `npx tsc --noEmit` : 0 nouvelles erreurs dans les fichiers modifiés
- [x] Zéro référence résiduelle `voiceConfig.engine/language/elevenLabsVoiceId` dans le corps logique de StoryPlayer
- [x] Zéro dépendance npm ajoutée
