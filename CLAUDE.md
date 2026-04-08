# Family Vault — CLAUDE.md

## Stack
- React Native 0.81.5 + Expo SDK 54 + expo-router v6
- react-native-reanimated ~4.1 (obligatoire pour toutes les animations — pas RN Animated)
- Données: Markdown files dans un vault Obsidian (gray-matter frontmatter)
- Persistance prefs: expo-secure-store
- Build: `npx expo run:ios --device` — dev-client requis (pas Expo Go)
- Type check: `npx tsc --noEmit` (pas de test suite)

## Conventions
- Langue UI/commits/commentaires: **français**
- Couleurs: TOUJOURS `useThemeColors()` / `colors.*` — jamais de hardcoded (#FFFFFF, etc.)
- Swipe dans ScrollView = conflit de geste → utiliser bouton tap à la place
- `ReanimatedSwipeable` (PAS `Swipeable`) depuis `react-native-gesture-handler/ReanimatedSwipeable`
- Paths avec parenthèses `app/(tabs)/` doivent être quotés dans git/bash
- Format date affiché: JJ/MM/AAAA
- Modals: présentation `pageSheet` + drag-to-dismiss
- Fichiers publics (docs/, commits): jamais de noms personnels réels → génériques (Lucas, Emma, Dupont)
- Pour livrer: `/ship` (tsc + privacy check + commit FR + push)

## Animations
- `useSharedValue` + `useAnimatedStyle` + `withSpring`/`withTiming`
- Spring configs comme constante module: `const SPRING_CONFIG = { damping: 10, stiffness: 180 }`
- Éviter `perspective` dans les transform arrays (clipping 3D) — préférer `scaleX` pour les flips
- `expo-haptics` pour le feedback tactile: `Haptics.selectionAsync()`, `Haptics.impactAsync()`

## Architecture
- `contexts/VaultContext.tsx` — VaultProvider + useVault() (source unique d'état)
- `hooks/useVault.ts` — useVaultInternal() orchestrateur + 21 hooks domaine (Tasks, Recipes, Defis, Profiles, Stock, Courses, Health, SecretMissions, Meals, RDV, Photos, Memories, Vacation, Budget, Notes, Anniversaires, Wishlist, Gratitude, Quotes, Moods, Routines)
- `lib/parser.ts` — parse/serialize markdown vault files (parse* / serialize* pairs)
- `lib/vault.ts` — VaultManager: file I/O, path traversal prevention, iCloud coordination
- `contexts/ThemeContext.tsx` — `useThemeColors()` → `{ primary, tint, colors, isDark }`
- `constants/` — colors, spacing, typography, shadows, themes (9 profils), rewards
- `components/ui/` — Chip, Badge, Button, DateInput, ModalHeader, MarkdownText, CollapsibleSection
- `components/dashboard/` — sections dashboard + types (DashboardSectionProps)
- `lib/gamification/` — engine XP/levels/rewards (barrel index.ts)
- `lib/mascot/` — moteur arbre mascotte + ferme (barrel index.ts)
- Vault recettes: `03 - Cuisine/Recettes/{Category}/{Name}.cook`

### Hiérarchie providers (app/_layout.tsx)
SafeAreaProvider > GestureHandler > VaultProvider > ThemeProvider > AIProvider > HelpProvider > ParentalControls > ToastProvider

### Barrel files
- `components/ui/index.ts`, `components/dashboard/index.ts`, `lib/gamification/index.ts`, `lib/mascot/index.ts`

## Patterns de code
- Styles dynamiques (thème): inline avec `useThemeColors()`
- Styles statiques: `StyleSheet.create({})` en bas de fichier
- Tokens design pour toutes les valeurs numériques (`Spacing['2xl']` pas `16`)
- `React.memo()` sur les list items, `useCallback()` sur handlers passés en props
- `useMemo()` dans les context providers
- Erreurs user-facing: `Alert.alert()` en français
- `console.warn`/`console.error` uniquement sous `if (__DEV__)`
- Errors non-critiques silencieuses: `catch { /* Gamification — non-critical */ }`
- `SectionErrorBoundary` entoure chaque section dashboard indépendamment

## Testing
- `npx tsc --noEmit` — seule validation
- Erreurs pré-existantes dans MemoryEditor.tsx, cooklang.ts, useVault.ts — **ignorer**

<!-- GSD:project-start source:PROJECT.md -->
## Project

**FamilyFlow**

Application mobile familiale (React Native / Expo) qui centralise la vie quotidienne d'une famille : tâches, calendrier, repas, budget, recettes, journal bébé, photos/souvenirs, et un système de gamification avec mascotte/ferme pixel. Les données vivent dans un vault Obsidian (Markdown + frontmatter) synchronisé via iCloud — aucun backend.

**Core Value:** L'app doit rester fiable et stable pour un usage quotidien familial — les données ne doivent jamais être perdues ou corrompues, et les features existantes ne doivent pas régresser.

### Constraints

- **Stack**: React Native + Expo SDK 54 — pas de migration majeure
- **Données**: Vault Obsidian Markdown — compatibilité bidirectionnelle obligatoire
- **Stabilité**: App sur TestFlight — chaque phase doit être non-cassante
- **Solo dev**: Un seul développeur — phases incrémentales, pas de big bang
- **Animations**: react-native-reanimated obligatoire (pas RN Animated)
<!-- GSD:project-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
