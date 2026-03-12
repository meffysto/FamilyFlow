# Family Vault — CLAUDE.md

## Stack
- React Native + Expo (~54) + expo-router v6
- react-native-reanimated ~4.1 (prefer over RN Animated for new animations)
- Données: Markdown files dans un vault Obsidian (gray-matter frontmatter)
- Persistance prefs: expo-secure-store

## Conventions
- Langue UI/commits/commentaires: français
- Couleurs: TOUJOURS utiliser `useThemeColors()` / `colors.*` — jamais de hardcoded (#FFFFFF, #111827, etc.)
- Swipe dans ScrollView = conflit de geste → utiliser bouton tap à la place
- `ReanimatedSwipeable` (PAS `Swipeable`) depuis `react-native-gesture-handler/ReanimatedSwipeable`
- Paths avec parenthèses (app/(tabs)/) doivent être quotés dans git/bash

## Architecture
- `hooks/useVault.ts` — hook central (state + file I/O), ~1200 lignes
- `lib/parser.ts` — parse/serialize markdown vault files
- `contexts/ThemeContext.tsx` — useThemeColors() → { primary, tint, colors }
- `constants/colors.ts` — LightColors & DarkColors (sémantique)
- `constants/themes.ts` — 9 thèmes profil (voitures, pokemon, etc.)
- `constants/rewards.ts` — pool rewards, drop rates, raretés
- Vault recettes: `03 - Cuisine/Recettes/{Category}/{Name}.cook`

## Animations
- Utiliser react-native-reanimated (useSharedValue, useAnimatedStyle, withSpring, etc.)
- Éviter `perspective` dans les transform arrays (cause clipping 3D) — préférer scaleX pour les flips
- expo-haptics pour le feedback tactile sur les interactions importantes

## Conventions supplémentaires
- Format date affiché : JJ/MM/AAAA (français)
- Modals : présentation `pageSheet` + drag-to-dismiss
- Cible : Dev build (expo-dev-client) — `npx expo run:ios` pour builder
- Fichiers publics (docs/, commits) : jamais de noms personnels réels → utiliser des génériques (Lucas, Emma, Dupont)
- Pour livrer : utiliser `/ship` (tsc + privacy check + commit FR + push)

## Testing
- `npx tsc --noEmit` pour vérifier la compilation (pas de test suite)
- Erreurs pré-existantes dans MemoryEditor.tsx, cooklang.ts, useVault.ts — les ignorer
