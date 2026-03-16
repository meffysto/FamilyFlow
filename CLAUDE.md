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
- `contexts/VaultContext.tsx` — VaultProvider + useVault() via context (source unique d'état)
- `hooks/useVault.ts` — useVaultInternal() (implémentation, appelé uniquement par VaultProvider)
- `lib/parser.ts` — parse/serialize markdown vault files
- `contexts/ThemeContext.tsx` — useThemeColors() → { primary, tint, colors }
- `contexts/AIContext.tsx` — AIProvider (clé API SecureStore, Claude haiku/sonnet)
- `contexts/HelpContext.tsx` — HelpProvider (coach marks, screen guides)
- `contexts/ToastContext.tsx` — ToastProvider (notifications spring animées)
- `constants/colors.ts` — LightColors & DarkColors (sémantique)
- `constants/themes.ts` — 9 thèmes profil (voitures, pokemon, etc.)
- `constants/rewards.ts` — pool rewards, drop rates, raretés
- `constants/spacing.ts` — Spacing (xxs→6xl), Radius (xs→full)
- `constants/typography.ts` — FontSize (micro→hero), FontWeight, LineHeight
- `constants/shadows.ts` — Shadow tokens (xs/sm/md/lg/xl/none)
- `components/ui/` — Chip, Badge, Button, DateInput, ModalHeader, MarkdownText, CollapsibleSection
- `lib/insights.ts` — suggestions déterministes (10 règles)
- `lib/search.ts` — recherche multi-type normalisée
- `lib/ai-service.ts` — fetch direct api.anthropic.com
- Vault recettes: `03 - Cuisine/Recettes/{Category}/{Name}.cook`

### Hiérarchie providers (app/_layout.tsx)
SafeAreaProvider > GestureHandler > VaultProvider > ThemeProvider > AIProvider > HelpProvider > ParentalControls > ToastProvider

## Animations
- Utiliser react-native-reanimated (useSharedValue, useAnimatedStyle, withSpring, etc.)
- Éviter `perspective` dans les transform arrays (cause clipping 3D) — préférer scaleX pour les flips
- expo-haptics pour le feedback tactile sur les interactions importantes

## Conventions supplémentaires
- Format date affiché : JJ/MM/AAAA (français)
- Modals : présentation `pageSheet` + drag-to-dismiss
- Cible : Dev build (expo-dev-client) — `npx expo run:ios --device` pour builder sur device physique
- Fichiers publics (docs/, commits) : jamais de noms personnels réels → utiliser des génériques (Lucas, Emma, Dupont)
- Pour livrer : utiliser `/ship` (tsc + privacy check + commit FR + push)

## Testing
- `npx tsc --noEmit` pour vérifier la compilation (pas de test suite)
- Erreurs pré-existantes dans MemoryEditor.tsx, cooklang.ts, useVault.ts — les ignorer
