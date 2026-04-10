---
phase: 24-compagnon-tendu-seed-003-lite
plan: "02"
subsystem: companion
tags: [companion, dashboard, proactive, weekly_recap, morning_greeting, gentle_nudge]
dependency_graph:
  requires: [companion-storage-io, companion-messages-persistence]
  provides: [dashboard-companion-bubble, proactive-events-4-types, nudge-daily-limit]
  affects: [components/dashboard/DashboardCompanion.tsx, app/(tabs)/index.tsx, app/(tabs)/tree.tsx, lib/mascot/companion-engine.ts, lib/mascot/companion-storage.ts]
tech_stack:
  added: []
  patterns: [FadeIn reanimated, SectionErrorBoundary wrapping, fire-and-forget SecureStore, aiCall builder from AIContext.config]
key_files:
  created:
    - components/dashboard/DashboardCompanion.tsx
  modified:
    - lib/mascot/companion-engine.ts
    - lib/mascot/companion-storage.ts
    - components/dashboard/index.ts
    - app/(tabs)/index.tsx
    - app/(tabs)/tree.tsx
decisions:
  - "D-05 respected: seuls morning_greeting et weekly_recap déclenchés sur dashboard — gentle_nudge/comeback restent sur tree.tsx"
  - "D-06: bulle inline discrète (avatar + texte) positionnée en haut du dashboard avant les sections"
  - "D-09: weekly_recap détecté via isWeeklyRecapWindow (dimanche 18h-21h) passé dans ProactiveContext"
  - "D-10: gentle_nudge limité à 1/jour via hasNudgeShownToday + markNudgeShownToday dans tree.tsx"
  - "aiCall construit localement dans DashboardCompanion depuis useAI().config + callCompanionMessage (même pattern que tree.tsx)"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-10"
  tasks_completed: 2
  files_modified: 5
requirements_satisfied: [COMPANION-01, COMPANION-02, COMPANION-04, COMPANION-05]
---

# Phase 24 Plan 02: Bulle compagnon dashboard + 4 event types proactifs Summary

**One-liner:** Bulle compagnon inline sur dashboard (FadeIn reanimated) affichant morning_greeting/weekly_recap avec loadWeekStats, plus garde gentle_nudge 1/jour via SecureStore dans tree.tsx.

## What Was Built

### lib/mascot/companion-engine.ts (modifié)

- `ProactiveContext` : ajout du champ optionnel `isWeeklyRecapWindow?: boolean` (D-09)
- `detectProactiveEvent` : retourne `'weekly_recap'` si `ctx.isWeeklyRecapWindow`, inséré après `family_milestone` et avant `gentle_nudge`

### lib/mascot/companion-storage.ts (modifié)

- Ajout `hasNudgeShownToday(profileId)` : vérifie si un nudge a été affiché aujourd'hui (D-10)
- Ajout `markNudgeShownToday(profileId)` : persiste le flag YYYY-MM-DD en SecureStore
- Clé : `companion_nudge_shown_{profileId}` (fire-and-forget, silencieux en cas d'erreur)

### components/dashboard/DashboardCompanion.tsx (nouveau — 243 lignes)

Bulle compagnon inline dashboard (D-06) :
- Props : `DashboardSectionProps` standard
- `useEffect` sur `[activeProfile?.id]` : déclenche une seule fois par profil au mount
- Détecte `morning_greeting` et `weekly_recap` uniquement (D-05)
- Pour `weekly_recap` : charge `loadWeekStats()` et injecte les stats dans `msgContext.recentTasks`
- Template immédiat via `pickCompanionMessage`, puis remplacement IA via `generateCompanionAIMessage`
- Persistance fire-and-forget via `saveCompanionMessages`
- Rendu : `View` horizontal, `CompanionAvatarMini` (size 40) + `Animated.View` avec `FadeIn.duration(400)`
- Couleurs via `useThemeColors()` (zéro hardcoded hex)
- Wrappé dans `SectionErrorBoundary`

### components/dashboard/index.ts (modifié)

- Ajout `export { DashboardCompanion } from './DashboardCompanion'`

### app/(tabs)/index.tsx (modifié)

- Import `DashboardCompanion` depuis le barrel
- `<DashboardCompanion {...sectionProps} />` rendu en haut du ScrollView content (après header, avant pregnancy cards et sections)
- Conditionnel : visible seulement si `!isLoading && vaultPath`

### app/(tabs)/tree.tsx (modifié)

- Import `hasNudgeShownToday`, `markNudgeShownToday` ajoutés à l'import companion-storage
- `isWeeklyRecapWindow` calculé et passé dans `ProactiveContext` (D-09)
- Guard `gentle_nudge` (D-10) : `nudgeCheckPromise` vérifie `hasNudgeShownToday` avant le `delayTimer`, et appelle `markNudgeShownToday` si non bloqué

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | weekly_recap + nudge flag dans engine + storage | 63504b8 | lib/mascot/companion-engine.ts, lib/mascot/companion-storage.ts |
| 2 | DashboardCompanion.tsx + câblage index.tsx + nudge guard tree.tsx | e8c5368 | components/dashboard/DashboardCompanion.tsx, components/dashboard/index.ts, app/(tabs)/index.tsx, app/(tabs)/tree.tsx |

## Deviations from Plan

**1. [Rule 1 - Bug] aiCall construit localement plutôt que via useAI()**
- **Found during:** Task 2
- **Issue:** `useAI()` n'expose pas `aiCall` directement — le hook expose `config`, `ask`, etc. `aiCall` est une closure locale dans tree.tsx construite avec `callCompanionMessage` et `aiConfig`.
- **Fix:** Dans `DashboardCompanion`, utiliser `useAI().config` + `callCompanionMessage` pour construire `aiCall` via `useMemo`, identique au pattern de tree.tsx (sans anonymisation — pas de données perso sensibles dans le contexte dashboard).
- **Files modified:** `components/dashboard/DashboardCompanion.tsx`
- **Commit:** e8c5368

## Known Stubs

None. Toutes les fonctions sont câblées avec de vraies données (SecureStore, loadWeekStats, pickCompanionMessage, generateCompanionAIMessage).

## Self-Check: PASSED

- `components/dashboard/DashboardCompanion.tsx` : FOUND (243 lignes)
- `export { DashboardCompanion }` dans barrel : FOUND
- `<DashboardCompanion` dans app/(tabs)/index.tsx : FOUND
- `hasNudgeShownToday` dans tree.tsx : FOUND
- `markNudgeShownToday` dans tree.tsx : FOUND
- `isWeeklyRecapWindow` dans tree.tsx : FOUND
- commit 63504b8 : FOUND
- commit e8c5368 : FOUND
- `npx tsc --noEmit` : zéro erreur nouvelle
