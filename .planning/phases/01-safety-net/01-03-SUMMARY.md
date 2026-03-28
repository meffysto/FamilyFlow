---
phase: 01-safety-net
plan: 03
subsystem: infra
tags: [sentry, crash-reporting, expo, react-native, error-monitoring]

# Dependency graph
requires: []
provides:
  - "@sentry/react-native installé et configuré dans app/_layout.tsx"
  - "Sentry.init() au niveau module avec DSN via env var EXPO_PUBLIC_SENTRY_DSN"
  - "Plugin @sentry/react-native/expo déclaré dans app.json"
  - "RootLayout wrappé avec Sentry.wrap() pour capturer les crashes React"
affects: [all-phases]

# Tech tracking
tech-stack:
  added: ["@sentry/react-native"]
  patterns:
    - "Sentry init au niveau module (avant render React) — pattern standard pour React Native"
    - "enabled: !__DEV__ — désactiver le crash reporting en dev pour éviter le bruit"
    - "DSN via EXPO_PUBLIC_SENTRY_DSN — jamais hardcodé"

key-files:
  created: []
  modified:
    - app/_layout.tsx
    - app.json
    - package.json

key-decisions:
  - "Sentry désactivé en __DEV__ pour éviter le bruit en développement local"
  - "tracesSampleRate: 0.2 — 20% de traces pour limiter le quota Sentry sans perdre la visibilité"
  - "Plugin @sentry/react-native/expo gère les source maps automatiquement sans metro.config.js"

patterns-established:
  - "Sentry.wrap() sur le composant root par défaut — toujours wrapper le layout racine"

requirements-completed: [TEST-06]

# Metrics
duration: 2min
completed: 2026-03-28
---

# Phase 01 Plan 03: Intégration Sentry Summary

**@sentry/react-native configuré avec Sentry.init() au niveau module, Sentry.wrap() sur RootLayout, et plugin Expo — crash reporting production activé pour TestFlight**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T18:46:11Z
- **Completed:** 2026-03-28T18:48:00Z
- **Tasks:** 1/2 (checkpoint atteint après Task 1)
- **Files modified:** 4

## Accomplishments
- @sentry/react-native installé via `npx expo install` (version compatible SDK 54)
- Sentry.init() ajouté au niveau module dans app/_layout.tsx (avant les imports React) avec DSN via env var
- RootLayout extrait et wrappé avec Sentry.wrap() pour capturer les crashes React
- Plugin @sentry/react-native/expo ajouté dans app.json (gère source maps automatiquement)
- Crash reporting désactivé en __DEV__ pour éviter le bruit en développement

## Task Commits

Chaque task commitée atomiquement :

1. **Task 1: Installer et configurer Sentry** - `871af8e` (feat)

**Plan metadata:** à venir après checkpoint

## Files Created/Modified
- `app/_layout.tsx` — Ajout Sentry.init() au niveau module + Sentry.wrap(RootLayout) comme export default
- `app.json` — Plugin @sentry/react-native/expo ajouté dans le tableau plugins
- `package.json` — @sentry/react-native ajouté comme dépendance
- `package-lock.json` — Lockfile mis à jour

## Decisions Made
- Sentry désactivé en `__DEV__` pour éviter le bruit en développement local
- `tracesSampleRate: 0.2` (20%) pour limiter le quota sans perdre la visibilité
- Pas de metro.config.js : le plugin @sentry/react-native/expo gère les source maps automatiquement

## Deviations from Plan

None - plan exécuté exactement comme spécifié.

## User Setup Required

Checkpoint de vérification humaine en attente. L'utilisateur doit :
1. Créer un projet React Native dans Sentry (sentry.io)
2. Copier le DSN depuis Settings → Projects → FamilyFlow → Client Keys
3. Créer `.env.local` à la racine avec `EXPO_PUBLIC_SENTRY_DSN=votre-dsn`
4. Pour les builds EAS : `eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value "votre-dsn"`
5. Vérifier que `.env.local` est dans `.gitignore`

## Next Phase Readiness
- Sentry est configuré dans le code, prêt pour la configuration du DSN
- Après le checkpoint, le crash reporting sera actif pour les prochains builds TestFlight
- Aucun blocker pour les autres plans de Phase 01

---
*Phase: 01-safety-net*
*Completed: 2026-03-28 (checkpoint en attente)*

## Self-Check: PASSED

- app/_layout.tsx: FOUND
- app.json: FOUND
- 01-03-SUMMARY.md: FOUND
- Commit 871af8e: FOUND
