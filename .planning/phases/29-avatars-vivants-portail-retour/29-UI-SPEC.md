---
phase: 29
slug: avatars-vivants-portail-retour
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-11
---

# Phase 29 — UI Design Contract

> Contrat visuel et d'interaction pour : avatars compagnon pixel art sur la carte village (VILL-01/02/03), portail retour village → ferme (VILL-11/12). Généré par gsd-ui-researcher.

---

## Design System

| Propriété | Valeur |
|-----------|--------|
| Tool | none (React Native — shadcn non applicable) |
| Preset | not applicable |
| Bibliothèque composants | react-native core + composants internes `components/ui/`, `components/mascot/` |
| Bibliothèque icônes | none (sprites pixel art PNG via `require()`, emojis ponctuels) |
| Police | Système iOS/Android (défaut Expo — pas de police custom) |

Source: CLAUDE.md (stack React Native 0.81.5 + Expo SDK 54)

---

## Spacing Scale

Tokens définis dans `constants/spacing.ts` — base 4px. Utiliser les clés `Spacing.*` et `Radius.*` en exclusivité, jamais de valeurs numériques hardcodées.

| Token | Valeur | Usage Phase 29 |
|-------|--------|----------------|
| `Spacing.xs` | 4px | Gap icône-texte inline dans `AvatarTooltip` |
| `Spacing.md` | 8px | Padding interne du tooltip, gap badge halo |
| `Spacing['2xl']` | 16px | Padding label tooltip, espacement header titre, padding horizontal écran, margin sections |
| `Spacing['4xl']` | 24px | Safe area padding |
| `Spacing['5xl']` | 32px | Espacement bas scroll |
| `Spacing['6xl']` | 48px | Hauteur header |

Exceptions Phase 29 :
- **Sprite compagnon** : taille fixe 28–32px (ajustable post-test device, CD-05). Pas un Spacing token — c'est une dimension sprite pixel art.
- **Sprite portail** : taille fixe 48–56px (ajustable post-test device, CD-05).
- **Halo glow actif** : rayon = sprite + 6px (soit ~38px pour un sprite 32px). Calculé en fonction de la taille sprite.
- **Hit slop touch targets** : `{ top: 8, bottom: 8, left: 8, right: 8 }` (`Spacing.md`) sur `Pressable` avatar et portail — sprite ~32px + 8px slop chaque côté = ~48px total, conforme au minimum 44px d'accessibilité iOS.

Source: `constants/spacing.ts` (existant, pré-populé)

---

## Typography

Tokens définis dans `constants/typography.ts`. Utiliser les clés `FontSize.*`, `FontWeight.*`, `LineHeight.*` exclusivement.

| Rôle | Token | Taille | Poids | Line Height |
|------|-------|--------|-------|-------------|
| Tooltip corps | `FontSize.sm` | 14px | `FontWeight.normal` (400) | `LineHeight.body` (22) |
| Titre header écran | `FontSize.heading` | 18px | `FontWeight.semibold` (600) | `LineHeight.title` (28) |
| Label compteur contributions | `FontSize.caption` | 12px | `FontWeight.semibold` (600) | `LineHeight.tight` (18) |
| Texte "pas encore contribué" | `FontSize.sm` | 14px | `FontWeight.normal` (400) | `LineHeight.body` (22) |

Règles :
- Maximum 2 poids utilisés en Phase 29 : `FontWeight.normal` (400) + `FontWeight.semibold` (600)
- Pas de taille hors token — si un rendu nécessite un ajustement, utiliser le token le plus proche
- Texte tooltip sur fond sombre semi-transparent : couleur `colors.text` garantie lisible dans les deux thèmes

Source: `constants/typography.ts` (existant, pré-populé)

---

## Color

Tokens via `useThemeColors()` → `{ colors, isDark }`. **Jamais de hex hardcodé** (CLAUDE.md règle absolue). Exception documentée dans l'état projet : couleurs cosmétiques pixel art (`#FFD700` dorées) dans `StyleSheet` comme constantes — non applicable Phase 29.

| Rôle | Token | Valeur light / dark | Usage Phase 29 |
|------|-------|---------------------|----------------|
| Dominant (60%) | `colors.bg` | `#EDEAE4` / `#12151A` | Fond écran village, fond header flottant |
| Secondaire (30%) | `colors.card` | `#FFFFFF` / `#1C1F28` | Fond tooltip `AvatarTooltip`, fond badge contributions |
| Accent principal (10%) | `colors.success` | `#10B981` / `#34D399` | Halo glow avatar ACTIF uniquement |
| Accent portail | `colors.catJeux` | `#16A34A` / `#4ADE80` | Glow overlay du sprite portail (pattern PortalSprite existant) |
| Texte | `colors.text` | `#1A1A2E` / `#F0EDE8` | Texte tooltip, titre header |
| Texte secondaire | `colors.textMuted` | `#6B7280` / `#8A8680` | Texte "pas encore contribué" dans tooltip |
| Overlay semi-transparent | `isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)'` | dynamique | Fond header flottant (pattern existant village.tsx:403) |
| Destructif | `colors.error` | `#EF4444` / `#F87171` | Non utilisé en Phase 29 |

**Accent `colors.success` réservé exclusivement pour :**
- Le halo glow circulaire derrière un avatar dont le profil a contribué cette semaine (VILL-02)

**Opacité avatar INACTIF :** `0.55` (valeur fixe, pas un token — constante StyleSheet). Sprite rendu sans halo, à opacité réduite pour distinguer visuellement "n'a pas encore joué cette semaine".

Source: `constants/colors.ts` + `29-CONTEXT.md` D-10

---

## Composants Phase 29

### Nouveaux composants à créer

| Composant | Chemin | Description |
|-----------|--------|-------------|
| `VillageAvatar` | `components/village/VillageAvatar.tsx` | Sprite compagnon pixel art + halo actif/inactif + Pressable |
| `AvatarTooltip` | `components/village/AvatarTooltip.tsx` | Tooltip flottant absolute-positionné, dismiss auto 2.5s |
| `PortalSprite` (partagé) | `components/village/PortalSprite.tsx` | Extraction du PortalSprite de tree.tsx — glow loop + scale spring + sprite portail.png |

### Composants existants réutilisés

| Composant | Source | Modification Phase 29 |
|-----------|--------|-----------------------|
| `TileMapRenderer` | `components/mascot/TileMapRenderer.tsx` | Aucune — overlay avatars au-dessus |
| `PortalSprite` (ferme) | `app/(tabs)/tree.tsx:303-361` | Remplacer `<Text>🏛️</Text>` par `<Image source={portail.png} />` à la ligne 357 |

---

## Contrat d'interaction

### VillageAvatar — Comportement

| État | Rendu visuel | Animation |
|------|-------------|-----------|
| Actif cette semaine | Sprite opacité 1.0 + halo `colors.success` circulaire | Halo : `withRepeat(withTiming(0.8, {duration:2000}), -1, true)` opacity 0.5→0.8 |
| Inactif | Sprite opacité 0.55, pas de halo | Alternance idle_1/idle_2 maintenue (respiration) |
| Appuyé (Pressable) | `Haptics.selectionAsync()` + tooltip visible | Pas d'animation scale sur l'avatar lui-même |

**Alternance idle :** `frameIdx` state toggle via `setTimeout` 500ms (pattern `CompanionSlot.tsx:730`). Pas de `useSharedValue` pour le frame swap — `useState` suffit.

**Positionnement :** absolu dans `styles.mapContainer`, calculé via `slot.x * mapSize.width` et `slot.y * mapSize.height`. Les 6 slots sont définis dans `lib/village/grid.ts` avec coordonnées fractionnelles (D-06).

### AvatarTooltip — Comportement

| Propriété | Valeur |
|-----------|--------|
| Contenu actif | `"[Prénom] — X contributions cette semaine"` |
| Contenu inactif (X=0) | `"[Prénom] — pas encore contribué"` |
| Dismiss automatique | 2.5 secondes (setTimeout, ref clearé au unmount) |
| Tap autre avatar | Dismiss immédiat + nouveau tooltip |
| Position | Absolute above avatar, dérivée de la position du slot |
| Entrée | opacity 0→1 + translateY -4→0 en 180ms (`withTiming`) |
| Sortie | opacity 1→0 + translateY 0→-4 en 150ms (`withTiming`) |
| Fond | `colors.card` + `Radius.lg` (12px) + shadow `Shadows.md` |
| Max width | 200px (évite le débordement hors carte) |

Source: `29-CONTEXT.md` D-11 à D-15

### PortalSprite village — Comportement

| Propriété | Valeur |
|-----------|--------|
| Sprite | `assets/items/portail.png` (178 KB, require() existant) |
| Position sur carte | `{ x: 0.85, y: 0.85 }` (ajustable CD-03) |
| Taille sprite | 48–56px (ajustable CD-05) |
| Glow loop | opacity 0.4→0.8, 1200ms, `withRepeat(-1, true)` |
| Glow couleur | `colors.catJeux` (pattern identique PortalSprite ferme) |
| Scale spring tap | `withSpring(0.92)` → `withSpring(1)`, config `{ damping: 12, stiffness: 200 }` |
| Haptic | `Haptics.selectionAsync()` |
| hitSlop | `{ top: 8, bottom: 8, left: 8, right: 8 }` |

Source: `29-CONTEXT.md` D-16 à D-20

### Transition fade retour (VILL-12)

| Propriété | Valeur |
|-----------|--------|
| sharedValue | `screenOpacity` (`useSharedValue(1)`) dans `VillageScreen` |
| Animation | `withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) })` |
| Callback | `runOnJS(router.replace)('/(tabs)/tree')` |
| Reset focus | `useFocusEffect` → `screenOpacity.value = 1` |
| Navigation | `router.replace` (pas `push` — évite stack infini ping-pong) |
| Durée | 400ms exacte (symétrique à l'aller Phase 28) |

Source: `29-CONTEXT.md` D-21 à D-23

---

## Copywriting Contract

Langue : **français** (CLAUDE.md convention absolue). Prénoms génériques dans commits publics.

| Élément | Copie |
|---------|-------|
| CTA principal | Aucun CTA destructif ou de soumission en Phase 29 — le seul "CTA" est le tap portail |
| Label portail (accessibilité) | `"Retour à la ferme"` (accessibilityLabel sur le Pressable portail) |
| Tooltip avatar actif | `"[Prénom] — X contributions cette semaine"` |
| Tooltip avatar inactif | `"[Prénom] — pas encore contribué"` |
| État vide avatars | Aucun état vide explicite — si `activeProfiles.length === 0`, la carte s'affiche sans overlay avatar (comportement silencieux, pas de message) |
| État vide (compagnon null) | Profil ignoré silencieusement (D-03 — skip, pas de placeholder ni message) |
| Erreur chargement carte | Géré par le `isLoading` existant dans `village.tsx` — `ActivityIndicator` centré (pattern existant ligne 443) |
| Titre header | `"Place du Village"` (inchangé, village.tsx:416) |
| Actions destructives | Aucune en Phase 29 |

---

## États et accessibilité

| Composant | accessibilityLabel | accessibilityRole |
|-----------|-------------------|-------------------|
| `VillageAvatar` Pressable | `"[Prénom], [actif/inactif] cette semaine"` | `"button"` |
| `AvatarTooltip` | `"Tooltip [Prénom]"` | `"text"` |
| `PortalSprite` Pressable | `"Retour à la ferme"` | `"button"` |

---

## Registry Safety

| Registry | Blocs utilisés | Safety Gate |
|----------|---------------|-------------|
| shadcn official | aucun (React Native — shadcn non applicable) | non applicable |
| npm tiers | aucune nouvelle dépendance (ARCH-05 reconduit) | non applicable |

---

## Contraintes non-négociables

Issues de `29-CONTEXT.md` section "Contraintes infra" :

1. **Zéro nouvelle dépendance npm** — tout construit avec react-native-reanimated, expo-haptics, expo-router et composants internes existants.
2. **Animations Reanimated exclusivement** — `useSharedValue` + `useAnimatedStyle` + `withTiming`/`withSpring`/`withRepeat`. Jamais `Animated` de React Native.
3. **useThemeColors() obligatoire** pour toutes les couleurs — jamais de hex inline.
4. **Tokens design obligatoires** — `Spacing.*`, `Radius.*`, `FontSize.*`, `FontWeight.*`, `LineHeight.*` pour toutes les valeurs numériques.
5. **React.memo + useCallback** sur `VillageAvatar` (rendu en liste × 6 dans la carte).
6. **Erreurs non-critiques silencieuses** : `catch { /* Village avatars — non-critical */ }`.
7. **Backward compat vault** : aucun nouveau champ dans `jardin-familial.md` — tous les calculs en mémoire.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
