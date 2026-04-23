---
phase: quick-260423-jw6
plan: 01
subsystem: stories/audio
tags: [elevenlabs, fish-audio, vault, icloud, persistence, mp3, story-player]
dependency_graph:
  requires: []
  provides: [vault audio persistence, fallback vault→documentDir, autoGenerate prop]
  affects: [lib/elevenlabs.ts, lib/fish-audio.ts, components/stories/StoryPlayer.tsx, app/(tabs)/stories.tsx]
tech_stack:
  added: []
  patterns: [vault fallback copy, fire-and-forget vault save, best-effort iCloud]
key_files:
  created: []
  modified:
    - lib/elevenlabs.ts
    - lib/fish-audio.ts
    - components/stories/StoryPlayer.tsx
    - app/(tabs)/stories.tsx
decisions:
  - "vaultUri construit inline depuis vault.vaultPath (méthode uri() est privée) — reproduit la logique d'encodage pour iCloud"
  - "getCachedStoryAudio* avec vaultUri optionnel — signature rétrocompatible, aucune régression sur autres call-sites"
  - "copyFileToVault post-génération avec .catch(() => {}) — best-effort silencieux si iCloud indisponible"
  - "needsGeneration state dans StoryPlayer pour bloquer l'UI sans appel API quand autoGenerate=false"
metrics:
  duration: "~15min"
  completed: "2026-04-23T12:25:45Z"
  tasks_completed: 2
  files_modified: 4
---

# Quick Task 260423-jw6 — Persister les MP3 ElevenLabs/Fish Audio dans le vault iCloud

**One-liner:** Persistance vault iCloud des MP3 histoires avec fallback vault→documentDir et blocage de la regénération auto au ReplayStep.

## Objectif

Persister les MP3 générés par ElevenLabs et Fish Audio dans le vault iCloud (`09 - Histoires/{enfant}/{storyId}.mp3`) afin qu'ils survivent aux réinstallations d'app. Bloquer la regénération automatique lors du ReplayStep pour éviter des appels API involontaires et payants.

## Tâches Complétées

| # | Nom | Commit | Fichiers |
|---|-----|--------|---------|
| 1 | Helpers vault + fallback getCachedStoryAudio* | b0adb2a | lib/elevenlabs.ts, lib/fish-audio.ts |
| 2 | StoryPlayer autoGenerate + vault + UI bouton | 86c8cb8 | components/stories/StoryPlayer.tsx, app/(tabs)/stories.tsx |

## Changements Clés

### lib/elevenlabs.ts

- Ajout de `storyVaultAudioRelPath(enfant, storyId)` exporté : retourne `09 - Histoires/{enfant}/{storyId}.mp3`
- `getCachedStoryAudio(storyId, voiceId, vaultUri?)` — 3e paramètre optionnel ; si le cache documentDir est absent mais `vaultUri` existe → copie vault→documentDir via `FileSystem.copyAsync`, retourne l'URI locale

### lib/fish-audio.ts

- `getCachedStoryAudioFish(storyId, referenceId, vaultUri?)` — même pattern que ElevenLabs (fallback vault→documentDir)
- `storyVaultAudioRelPath` reste exclusivement dans elevenlabs.ts (pas de duplication)

### components/stories/StoryPlayer.tsx

- Prop `autoGenerate?: boolean` (défaut `true`) déclarée et destructurée
- Import `useVault` depuis VaultContext + `getCachedStoryAudio`, `storyVaultAudioRelPath`, `getCachedStoryAudioFish`
- `vaultUri` calculé via `useMemo` depuis `vault.vaultPath` (reproduit la logique `VaultManager.uri()` privée)
- `runGeneration()` extrait en `useCallback` — appelable à la demande ou automatiquement
- Au montage : vérifie le cache (local + vault) avant toute génération ; si `autoGenerate=false` et aucun cache → `setNeedsGeneration(true)` sans appel API
- Post-génération : `vault.copyFileToVault(audioUri, storyVaultAudioRelPath(...)).catch(() => {})` best-effort
- UI conditionnelle : si `needsGeneration && !isLoading` → bouton "🔊 Générer l'audio" ; tap → `runGeneration()` manuel

### app/(tabs)/stories.tsx

- `ReplayStep` passe `autoGenerate={false}` au `<StoryPlayer />` pour bloquer la regénération auto

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FontWeight.semiBold → FontWeight.semibold**
- **Found during:** Task 2
- **Issue:** `FontWeight.semiBold` n'existe pas dans la définition du projet (`semibold` en minuscules)
- **Fix:** Corrigé en `FontWeight.semibold`
- **Files modified:** components/stories/StoryPlayer.tsx
- **Commit:** 86c8cb8

**2. [Rule 2 - Adaptation] vault.uri() est une méthode privée**
- **Found during:** Task 2
- **Issue:** Le plan décrit `vault.uri(relPath)` comme public mais la méthode est `private` dans VaultManager
- **Fix:** Reproduction inline de la logique d'encodage URI depuis `vault.vaultPath` dans un `useMemo`
- **Files modified:** components/stories/StoryPlayer.tsx
- **Impact:** Comportement identique, iCloud paths encodés correctement

## Known Stubs

Aucun stub — toutes les fonctionnalités sont câblées et opérationnelles.

## Self-Check: PASSED

- `lib/elevenlabs.ts` modifié : storyVaultAudioRelPath exporté, getCachedStoryAudio avec vaultUri
- `lib/fish-audio.ts` modifié : getCachedStoryAudioFish avec vaultUri
- `components/stories/StoryPlayer.tsx` modifié : autoGenerate prop, vault copy, UI bouton
- `app/(tabs)/stories.tsx` modifié : autoGenerate={false} dans ReplayStep
- Commits b0adb2a et 86c8cb8 présents
- `npx tsc --noEmit` : aucune nouvelle erreur TS
