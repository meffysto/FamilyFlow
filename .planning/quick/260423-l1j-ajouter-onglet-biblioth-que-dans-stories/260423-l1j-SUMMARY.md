---
phase: quick-260423-l1j
plan: "01"
subsystem: stories
tags: [stories, bibliotheque, reanimated, tab-switcher, audio-badge]
dependency_graph:
  requires: [app/(tabs)/stories.tsx, lib/stories.ts, lib/elevenlabs.ts, lib/fish-audio.ts]
  provides: [BibliothequeView, TabSwitcher, StoryCard, activeTab state]
  affects: [app/(tabs)/stories.tsx]
tech_stack:
  added: []
  patterns: [useSharedValue + withSpring (tab indicator + chevron), React.memo (StoryCard), Promise.all async badge, closure activeTab in ReplayStep]
key_files:
  modified: [app/(tabs)/stories.tsx]
decisions:
  - "TabSwitcher inline sans composant externe — closure activeTab directement accessible depuis StoriesScreen"
  - "AudioAvailableMap keyed par story.id (pas sourceFile) — cohérent avec getCachedStoryAudio(storyId, voiceId)"
  - "UniversGroupe extrait en sous-composant pour isoler l'animation chevron withSpring"
  - "BibliothequeView reçoit stories/profiles/childProfiles en props — évite accès direct au contexte depuis composant non-hook"
metrics:
  duration: "~15min"
  completed: "2026-04-23"
  tasks: 2
  files: 1
---

# Phase quick-260423-l1j Plan 01: Bibliothèque histoires du soir — Summary

## One-liner

Onglet Bibliothèque dans l'écran Histoires avec groupes par univers collapsibles, filtre enfant, badge audio 🔊 async et retour tab-aware depuis ReplayStep.

## What Was Built

### Task 1 — Tab switcher + activeTab state + BibliothequeView

- `activeTab` state (`'nouvelle' | 'bibliotheque'`) ajouté dans `StoriesScreen`
- `TabSwitcher` : deux Pressable avec indicateur animé `withSpring` (constante `TAB_SPRING = { damping: 18, stiffness: 180 }`)
  - Affiché uniquement à l'étape `choisir_enfant`
  - Haptics `selectionAsync()` sur chaque tap
  - Couleurs : bg indicateur = `primary`, texte actif = `colors.bg`, inactif = `colors.textMuted`
- `BibliothequeView` : groupes par univers dans l'ordre canonique `STORY_UNIVERSES`, triés date desc
  - Filtre enfant horizontal (chips scrollables) si `childProfiles.length > 1`
  - Chip "Tous" + chips par enfant (avatar + prénom)
  - `UniversGroupe` avec collapse (chevron animé `withSpring`)
  - État vide avec CTA "Créer une histoire" → `setActiveTab('nouvelle')`
- `StoryCard` (React.memo) : titre, meta date JJ/MM/AAAA + durée, chip enfant conditionnel, badge audio `🔊` conditionnel
- `renderContent()` modifié : si `step.etape === 'choisir_enfant' && activeTab === 'bibliotheque'` → rendu `BibliothequeView`

### Task 2 — Badge audio async + retour tab-aware

- `audioAvailableMap` (state) dans `BibliothequeView`, chargé en `useEffect([filteredStories])` avec `Promise.all`
  - Guard `cancelled = false` + cleanup pour éviter setState après unmount
  - Selon `story.voice.engine` : `getCachedStoryAudioFish` ou `getCachedStoryAudio`
  - Badge apparaît progressivement, non-bloquant
- `ReplayStep.onFinish` : `goTo({ etape: 'choisir_enfant' })` — `activeTab` reste `'bibliotheque'` si venu de la bibliothèque (closure, pas de prop supplémentaire)

## Commits

| Hash | Message |
|------|---------|
| 6d44fe4 | feat(quick-260423-l1j): onglet Bibliothèque histoires + badge audio async |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FontSize.base et colors.textSecondary inexistants**
- **Found during:** Task 1
- **Issue:** Le plan référençait `FontSize.base` et `colors.textSecondary` qui n'existent pas dans les constants du projet
- **Fix:** Remplacé par `FontSize.body` et `colors.textMuted` (tokens existants)
- **Files modified:** app/(tabs)/stories.tsx

## Known Stubs

Aucun stub — toutes les données sont câblées depuis le contexte `stories` (VaultContext) via props.

## Self-Check: PASSED

- [x] `app/(tabs)/stories.tsx` modifié et commité (6d44fe4)
- [x] `npx tsc --noEmit` — aucune nouvelle erreur dans stories.tsx
- [x] TabSwitcher visible uniquement à `step.etape === 'choisir_enfant'`
- [x] BibliothequeView rendu quand `activeTab === 'bibliotheque' && step.etape === 'choisir_enfant'`
- [x] Groupes univers en ordre canonique, triés date desc
- [x] Audio badge async non-bloquant avec cleanup
- [x] Retour ReplayStep tab-aware (activeTab inchangé)
- [x] Flux création inchangé (renderContent switch inchangé)
