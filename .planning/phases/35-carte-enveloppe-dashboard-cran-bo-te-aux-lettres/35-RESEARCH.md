# Phase 35 : Carte enveloppe dashboard + écran boîte aux lettres — Research

**Researched:** 2026-04-17
**Domain:** UI React Native — pin section conditionnelle dashboard + route full-screen segmentée, consommation du hook `useVaultLoveNotes` (Phase 34 shipped).
**Confidence:** HIGH (tout le stack, les conventions et l'API du hook consommé sont sous nos yeux dans le repo — pas de dépendance externe à vérifier).

## Summary

Phase 35 est une phase **UI pure** qui consomme le hook `useVault().loveNotes` livré par Phase 34 (shipped 2026-04-17). Elle doit livrer deux surfaces :

1. **Une "section dashboard" conditionnelle** (la carte enveloppe) injectée **avant** le bloc `sortedSections.map()` dans `app/(tabs)/index.tsx` — rendu piloté par un sélecteur dérivé `unreadForActiveProfile` (filter sur `loveNotes` côté consommateur, pas dans le hook).
2. **Une nouvelle route `/lovenotes`** (écran full-screen dans `app/(tabs)/lovenotes.tsx` avec `href: null` dans le layout, pattern identique à `loot`/`notes`), contenant `SegmentedControl` 3 segments + 3 `FlatList` virtualisées de `LoveNoteCard` mémoïsés.

Aucune nouvelle dépendance npm. Le Reanimated pulse et le Haptic sont déjà dispos. Le composant `SegmentedControl` existe déjà avec badges (`components/ui/SegmentedControl.tsx`). FlatList est le pattern virtualisation canonique du repo (pas de FlashList installé). Aucun token "papier ivoire" ni "rouge cire" n'existe — à introduire comme **constantes module cosmétiques** (pattern FloatingPoints / `#FFD700`) ou, plus propre, en ajoutant dedans `constants/colors.ts` — décision laissée au planner.

**Primary recommendation :** Créer `components/lovenotes/` (nouveau dossier) avec `EnvelopeCard.tsx` (carte dashboard pinned), `LoveNoteCard.tsx` (item liste), `WaxSeal.tsx` (sprite animé pulse réutilisable), `lib/lovenotes/selectors.ts` (sélecteurs dérivés purs testables). Router `app/(tabs)/lovenotes.tsx` + `href: null`. Pin = injection directe dans `index.tsx` juste au-dessus du bloc `sortedSections.filter(...)`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOVE-05 | Carte enveloppe distinctive (format paysage ≈ 2:1.15, papier ivoire, rabat triangulaire, cachet cire rouge animé pulse, tilt -1.5°) pinned en tête dashboard si ≥1 note non lue/prête à révéler pour le profil actif | Stack: Reanimated 4.1 (`useSharedValue` + `withRepeat` + `withTiming`), `SectionErrorBoundary`, mockup `.planning/mockups/lovenote-envelope.html`. Pin point = ligne 1038 de `app/(tabs)/index.tsx` (juste avant `sortedSections.filter`). Couleurs : constantes cosmétiques module (`#f5ecd5` ivoire, `#c0392b` wax, `#442434` encre). Rabat triangulaire : RN ne supporte pas `clip-path` → soit `react-native-svg` Polygon (déjà utilisé dans `ReactiveAvatar` et `CompanionSlot`), soit bordure triangulaire pure CSS (border hack). Préférer SVG pour fidélité. |
| LOVE-06 | Badge compteur sur le cachet + effet stack (enveloppes empilées derrière) quand ≥2 notes en attente | Badge = `View` absolute top-right du `WaxSeal` avec background `colors.text` + border `paper`, pattern identique à `DashboardCard.badge`. Stack = 2 `View absolute` derrière la carte principale avec rotation légère (-3°/+2°) et opacity (0.55/0.7), rendu uniquement si `count >= 2`. |
| LOVE-07 | Accès `/lovenotes` via carte enveloppe OU tuile permanente dans `more.tsx` | Tap carte → `router.push('/lovenotes' as any)` (cast `any` car expo-router ne connaîtra pas la route typée avant la première modif — pattern identique au Plan 27-01 `tree.tsx`). Tuile `more.tsx` : ajouter dans l'array `items` catégorie `famille` (pattern ligne 143-149 de `more.tsx`) : `{ emoji: '💌', label: 'Love Notes', route: '/(tabs)/lovenotes', badge: unreadCount || undefined, color: colors.catFamille, category: 'famille' }`. |
| LOVE-08 | Écran Boîte aux lettres — 3 segments (Reçues / Envoyées / Archivées) avec listes virtualisées de `LoveNoteCard` mémoïsés | `SegmentedControl` existe déjà (`components/ui/SegmentedControl.tsx`) avec `Segment<T>[]` + badge natif. 3 `FlatList` conditionnelles (une seule montée à la fois via `value` state) avec `keyExtractor={(n) => n.sourceFile}`, `renderItem={({ item }) => <LoveNoteCard note={item} />}`. `LoveNoteCard` en `React.memo`. Segments : selectors purs sur `loveNotes` filtrant par `to === activeProfile.id` (reçues), `from === activeProfile.id` (envoyées), `status === 'read'` OR `revealed+read` (archivées). |
</phase_requirements>

## User Constraints (from CONTEXT.md)

**Aucun `CONTEXT.md` présent** pour Phase 35 (pas passé par `/gsd:discuss-phase`). Les contraintes proviennent directement de :

### Locked Decisions (dérivées CLAUDE.md + ROADMAP Phase 35)

- Stack : React Native 0.81 / Expo SDK 54 / expo-router v6 / reanimated ~4.1 — **immuable**
- `useThemeColors()` obligatoire pour TOUTES les couleurs non-cosmétiques — jamais de hardcoded sur texte/bg structurants
- `expo-haptics` pour feedback tactile (Haptics.selectionAsync au tap enveloppe, Haptics.impactAsync au tap LoveNoteCard)
- **Pas** de `Swipeable` classique dans ScrollView (conflit geste). Bouton tap pour archiver (pas de swipe)
- Modals : `pageSheet` + drag-to-dismiss (mais ici c'est un écran route, pas un modal — tenir le pattern au cas où on pop-up des détails)
- Commits/UI en **français** strict
- Pas de nouvelle dépendance npm (confirmé ROADMAP v1.6 ligne 88)
- Backward compat Obsidian vault obligatoire — aucune écriture imposée Phase 35 (lecture seule sauf `updateLoveNoteStatus` déjà livré Phase 34)
- Privacy : noms génériques (Lucas/Emma/Dupont) dans docs/commits — jamais de noms réels

### Claude's Discretion (à trancher au planning)

- Placement des tokens "papier ivoire" / "rouge cire" : constantes module cosmétiques dans `components/lovenotes/EnvelopeCard.tsx` **OU** nouvelle entrée `loveNotePaper` / `loveNoteWax` dans `constants/colors.ts` (recommandé pour cohérence thème dark/light)
- Rabat triangulaire : SVG Polygon (recommandé, propre, déjà utilisé ailleurs) vs bordure triangulaire CSS (hacky, fragile)
- Stratégie de disparition de la carte : re-render conditionnel sur `unreadCount > 0` (simple, OK) vs animation de sortie (`withTiming` opacity+scale) pour éviter flash. Mockup `tap-hint` suggère "tap pour ouvrir" — pas d'animation sortie spécifiée dans les requirements → garder simple : render conditionnel pur.
- Nommage route : `app/(tabs)/lovenotes.tsx` (hidden tab, pattern loot/notes) vs `app/lovenotes.tsx` (route root). Recommandé : **dans `(tabs)`** avec `href: null` pour rester dans le stack Tabs (garder la tabbar visible, pattern coherent avec `loot` et `notes`).
- Selectors : inline dans `index.tsx`/`lovenotes.tsx` (simple) **OU** extraits dans `lib/lovenotes/selectors.ts` testables. Recommandé : extraction pour permettre Jest (pas obligatoire vu `nyquist_validation: false`, mais bonne pratique étant donnée la logique de filtrage).

### Deferred Ideas (OUT OF SCOPE de Phase 35)

- Composition/éditeur modal de note (`LoveNoteEditor`) → Phase 36
- Notifications locales `expo-notifications` → Phase 36
- Animation unfold rotateX au tap sur note `revealed` → Phase 36
- Bascule auto `pending → revealed` sur `AppState` change → Phase 36
- Toggle parental + modérateur → Phase 37
- Empty states illustrés + polish final → Phase 37 (Phase 35 peut livrer empty state basique texte + icône)

## Project Constraints (from CLAUDE.md)

Directives **non-négociables** extraites de `./CLAUDE.md` que le planner doit vérifier :

| Directive | Phase 35 Impact |
|-----------|-----------------|
| react-native-reanimated ~4.1 obligatoire (PAS RN Animated) | Pulse cachet cire + animation d'apparition carte → `useSharedValue` + `useAnimatedStyle` + `withSpring`/`withTiming` |
| `useThemeColors()` / `colors.*` partout | Couleurs structurelles (bg carte, text, border) → thème. Ivoire/wax sont cosmétiques acceptables inline (cf FloatingPoints `#FFD700`) |
| `ReanimatedSwipeable` (pas `Swipeable`) si swipe | N/A Phase 35 — pas de swipe prévu ; bouton tap pour archiver |
| Paths `(tabs)` quoter dans bash | Commits toucheront `app/(tabs)/index.tsx` + `app/(tabs)/more.tsx` + nouveau `app/(tabs)/lovenotes.tsx` + `app/(tabs)/_layout.tsx` |
| Format date JJ/MM/AAAA côté UI | Affichage createdAt/revealAt sur `LoveNoteCard` : formatter local |
| Privacy docs/commits : Lucas/Emma/Dupont | Exemples tests, seeds |
| `React.memo()` sur list items, `useCallback` sur handlers, `useMemo` dans providers | `LoveNoteCard` doit être `React.memo`, handlers route via `useCallback` |
| `console.warn/error` uniquement sous `if (__DEV__)` | Logs debug render carte |
| `SectionErrorBoundary` autour de chaque section dashboard | Envelopper la carte enveloppe pinned dans `<SectionErrorBoundary name="Love Notes">` |
| Spring configs comme constante module | `const ENVELOPE_SPRING = { damping: 12, stiffness: 180 }` au top du fichier |
| Éviter `perspective` dans transform arrays (clipping 3D) | Pas besoin Phase 35 (l'unfold est Phase 36) |
| `expo-haptics` pour feedback tactile | `Haptics.selectionAsync()` au tap carte, `Haptics.impactAsync(Light)` au tap LoveNoteCard |
| Tokens design pour valeurs numériques (Spacing['2xl']) | Tous les paddings/margins/radius → `Spacing` / `Radius` / `FontSize` / `Shadows` |
| Erreurs user-facing : `Alert.alert()` en français | N/A — pas d'erreur user-facing Phase 35 |
| `npx tsc --noEmit` obligatoire avant commit | Gate CI du planner |
| `npx jest --no-coverage` clean | Seulement si on ajoute des tests ; pas obligatoire (nyquist_validation: false) |
| **Cache bump si shape change** | **PAS requis Phase 35** : on ne touche pas au type `LoveNote` ni à la structure `VaultCacheState.loveNotes`. Cache version reste 2 (bumpé Phase 34-01). |

## Standard Stack

### Core (déjà installés — zéro nouvelle dépendance)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native | 0.81.5 | UI framework | Stack imposé |
| expo | ~54 | Platform | Stack imposé |
| expo-router | v6 | Navigation file-based | Routes nouvelles via `app/(tabs)/lovenotes.tsx` |
| react-native-reanimated | ~4.1 | Animations UI thread | `withRepeat(withTiming(...))` pour pulse du cachet (LOVE-05), worklets pour animations carte |
| react-native-gesture-handler | installé | Gestures | Root `GestureHandlerRootView` déjà dans `app/_layout.tsx` |
| expo-haptics | installé | Feedback tactile | `Haptics.selectionAsync()` tap carte, `Haptics.impactAsync()` tap card |
| react-native-svg | installé (via `ReactiveAvatar`, `CompanionSlot`) | SVG natif | Rabat triangulaire via `<Polygon points="0,0 100,0 50,100" />` |
| expo-secure-store | installé | Prefs locales | N/A Phase 35 (Phase 36 pour revealAt persistant éventuel) |
| react-i18next | installé | i18n | Labels segments ("Reçues"/"Envoyées"/"Archivées") — pattern `t('lovenotes.segments.received')` si on i18n, sinon strings français directs |

### Composants UI réutilisables (existants, barrel `components/ui/`)

| Composant | Path | Usage Phase 35 |
|-----------|------|----------------|
| `SegmentedControl` | `components/ui/SegmentedControl.tsx` | Contrôle 3 segments (Reçues/Envoyées/Archivées) — API `{segments, value, onChange}` + badges natifs |
| `PressableScale` | `components/ui/PressableScale.tsx` | Wrap carte enveloppe + tuile more — animation scale au press |
| `Badge` | `components/ui/Badge.tsx` | Compteur sur cachet (alternative : custom View stylé plus contrôlé) |
| `MarkdownText` | `components/ui/MarkdownText.tsx` | Afficher body note (future Phase 36 pour détail ouvert) |
| `SectionErrorBoundary` | `components/SectionErrorBoundary.tsx` | Envelopper la carte enveloppe pinned |
| `ModalHeader` | `components/ui/ModalHeader.tsx` | Header screen `/lovenotes` |
| `EmptyState` | `components/EmptyState.tsx` | Segment vide (basique — polish Phase 37) |

### Hook API consommé (Phase 34 shipped)

Exposé via `useVault()` (confirmé `hooks/useVaultLoveNotes.ts` + `34-03-SUMMARY.md`) :

```typescript
// Depuis useVault() :
loveNotes: LoveNote[];                                                      // LOVE-03
addLoveNote: (note: Omit<LoveNote, 'sourceFile'>) => Promise<void>;         // Phase 36
updateLoveNoteStatus: (sourceFile, status: LoveNoteStatus, readAt?) => Promise<void>;  // Tap carte archivée
deleteLoveNote: (sourceFile) => Promise<void>;                              // Future
activeProfile: Profile | null;                                              // Pour filtrer to === activeProfile.id
profiles: Profile[];                                                        // Pour afficher "De Maman" (lookup from → name)
```

**Shape `LoveNote`** (confirmé `lib/types.ts:589-606`) :
```typescript
interface LoveNote {
  from: string;          // profile ID émetteur
  to: string;            // profile ID destinataire
  createdAt: string;     // ISO 'YYYY-MM-DDTHH:mm:ss' (sans Z)
  revealAt: string;      // ISO 'YYYY-MM-DDTHH:mm:ss' (sans Z)
  status: 'pending' | 'revealed' | 'read';
  readAt?: string;       // ISO lecture
  body: string;          // markdown
  sourceFile: string;    // '03 - Famille/LoveNotes/{to}/YYYY-MM-DD-slug.md'
}
```

**⚠️ Le hook n'expose AUCUN selector dérivé.** Phase 35 doit calculer :
- `unreadForActiveProfile` = `loveNotes.filter(n => n.to === activeProfile?.id && (n.status === 'revealed' || (n.status === 'pending' && isRevealed(n.revealAt))))`
- `received` = `loveNotes.filter(n => n.to === activeProfile?.id)` trié par `readAt`/`createdAt` desc
- `sent` = `loveNotes.filter(n => n.from === activeProfile?.id)`
- `archived` = `received` avec `status === 'read'` + `sent` avec `status === 'read'` (selon spec)

**NOTE importante sur `pending → revealed`** : Phase 35 doit traiter une note `pending` comme "prête à révéler" si `revealAt <= now`, car la bascule auto `pending → revealed` est **Phase 36** (LOVE-12). Donc le sélecteur "notes à afficher sur la carte" doit inclure `status === 'pending' && revealAt <= now` OR `status === 'revealed'`.

## Architecture Patterns

### Structure recommandée

```
components/lovenotes/              # NOUVEAU dossier
├── EnvelopeCard.tsx               # Carte pinned dashboard (hero)
├── LoveNoteCard.tsx               # Item liste (React.memo)
├── WaxSeal.tsx                    # Cachet cire réutilisable (pulse Reanimated)
├── EnvelopeFlap.tsx               # Rabat triangulaire SVG
└── index.ts                       # Barrel export

lib/lovenotes/                     # NOUVEAU dossier
├── selectors.ts                   # Pure functions: unreadForProfile, received, sent, archived, isRevealed
└── index.ts                       # Barrel

app/(tabs)/lovenotes.tsx           # NOUVEL écran segmented 3-tab

# MODIFIÉS :
app/(tabs)/_layout.tsx             # +1 ligne : <Tabs.Screen name="lovenotes" options={{ href: null }} />
app/(tabs)/index.tsx               # Injection <EnvelopeCard/> conditionnel avant sortedSections (vers ligne 1038)
app/(tabs)/more.tsx                # +1 entrée items[] dans catégorie 'famille'
constants/colors.ts                # (optionnel, recommandé) +loveNotePaper/Dark + loveNoteWax
```

### Pattern 1 : Section pinned conditionnelle (hors `sortedSections`)

**Context :** `app/(tabs)/index.tsx:1038-1089` a un bloc `visibleSections = sortedSections.filter(...)` qui mappe en `renderSection(id)`. La carte enveloppe ne doit **pas** rejoindre `sortedSections` (pas de prefs, pas de tri, toujours tout en haut quand visible).

**What :** Injection directe avant le bloc `sortedSections.map()`.

**Example :**
```tsx
// app/(tabs)/index.tsx — juste avant ligne 1038 `(() => { const visibleSections = sortedSections.filter(...`

{activeProfile && (() => {
  const pending = loveNotes.filter(
    (n) => n.to === activeProfile.id &&
      (n.status === 'revealed' || (n.status === 'pending' && n.revealAt <= new Date().toISOString()))
  );
  if (pending.length === 0) return null;
  return (
    <SectionErrorBoundary name="Love Notes">
      <EnvelopeCard
        count={pending.length}
        recipientName={activeProfile.name}
        onPress={() => {
          Haptics.selectionAsync();
          router.push('/(tabs)/lovenotes' as any);
        }}
      />
    </SectionErrorBoundary>
  );
})()}
```

**Why cette position :** Avant `sortedSections` = visible toujours en premier, en dehors du système de prefs (pas configurable par le user — feature forcée), ne passe pas par `smartSortSections`, disparaît automatiquement si `pending.length === 0` (render conditionnel pur).

### Pattern 2 : Pulse cachet cire en Reanimated (performance-aware)

**What :** `withRepeat(withTiming(1.06, {duration: 1200}), -1, true)` sur `scale` d'un `Animated.View` représentant le cachet.

**When to use :** Composant cachet monté uniquement si `count > 0`. Pas de composant persistant en arrière-plan → pas de fuite thread UI.

**Example :**
```tsx
// components/lovenotes/WaxSeal.tsx
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation } from 'react-native-reanimated';
import { useEffect } from 'react';

const PULSE_DURATION = 1200;
const PULSE_MAX = 1.06;

export const WaxSeal = React.memo(function WaxSeal({ count, initial = 'M' }: Props) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(withTiming(PULSE_MAX, { duration: PULSE_DURATION }), -1, true);
    return () => { cancelAnimation(scale); scale.value = 1; };
  }, [scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.seal, animStyle]}>
      <Text style={styles.sealLetter}>{initial}</Text>
      {count > 1 && <View style={styles.badge}><Text style={styles.badgeText}>{count}</Text></View>}
    </Animated.View>
  );
});
```

**Cleanup :** `cancelAnimation(scale)` au unmount — évite animation orpheline si route change.

### Pattern 3 : Route dans `(tabs)` avec `href: null`

**What :** Écran full-screen dans le Tabs Stack mais absent de la tab bar visible.

**Why :** Identique à `loot` (ligne 264 `_layout.tsx`) et `notes` (ligne 277). Préserve la tab bar + coherence UX.

**Example :**
```tsx
// app/(tabs)/_layout.tsx — ligne ~264 à côté de loot
<Tabs.Screen name="lovenotes" options={{ href: null }} />
```

Accès via `router.push('/(tabs)/lovenotes' as any)` (cast `any` car TS ne connaît pas la route avant compile — pattern établi Phase 27-01).

### Pattern 4 : Rabat triangulaire SVG

**What :** Polygon SVG au lieu de `clip-path` (non supporté RN).

**Example :**
```tsx
// components/lovenotes/EnvelopeFlap.tsx
import Svg, { Polygon, Defs, LinearGradient, Stop } from 'react-native-svg';

export function EnvelopeFlap({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="flap" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#efdcb0" />
          <Stop offset="1" stopColor="#d4bc85" />
        </LinearGradient>
      </Defs>
      <Polygon points={`0,0 ${width},0 ${width/2},${height}`} fill="url(#flap)" />
    </Svg>
  );
}
```

### Pattern 5 : Liste virtualisée FlatList mémoïsée

**What :** FlatList (pas FlashList — non installé) avec `React.memo` sur l'item et `keyExtractor` stable.

**Example :**
```tsx
const renderItem = useCallback(
  ({ item }: { item: LoveNote }) => <LoveNoteCard note={item} onPress={handleCardPress} />,
  [handleCardPress]
);

<FlatList
  data={receivedNotes}
  keyExtractor={(n) => n.sourceFile}
  renderItem={renderItem}
  removeClippedSubviews
  initialNumToRender={10}
  windowSize={7}
  ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
/>
```

### Anti-Patterns to Avoid

- **Ajouter la carte enveloppe dans `sortedSections`** → La carte deviendrait configurable/désactivable/ré-ordonnable, ce qui contredit "pinned tout en haut" (LOVE-05). → Injection directe hors `sortedSections`.
- **Monter WaxSeal en permanence (avec opacity: 0 si count === 0)** → Animation worklet tourne en arrière-plan sans raison. → Monter le composant uniquement si `count > 0`.
- **Utiliser `clip-path` CSS** → Non supporté en RN Web/iOS/Android natif. → SVG Polygon.
- **`router.push('/lovenotes')` sans cast** → Erreur TS avant la route existe. → Cast `'/(tabs)/lovenotes' as any` pendant le plan incrémental.
- **Filtrer `loveNotes` dans `useVault()`** → Alourdirait le hook global. → Sélecteurs dérivés dans `lib/lovenotes/selectors.ts` ou `useMemo` local dans le consommateur.
- **Swipe gauche/droit sur LoveNoteCard dans FlatList** → OK contrairement à ScrollView (FlatList gère mieux les gestes), mais CLAUDE.md recommande bouton tap plutôt que swipe. → Bouton tap pour archiver (Phase 36+).
- **Utiliser `expo-router` Tabs.Screen sans `href: null`** → La route apparaîtrait dans la tab bar. → `{ href: null }`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contrôle 3 segments avec badges | `<View><TouchableOpacity x3>` custom | `SegmentedControl` de `components/ui/` | Déjà a11y-ready (`accessibilityRole="button"`, `accessibilityState`), gère theme, badges, layout. |
| Press feedback sur carte enveloppe | `onPressIn/Out` + animation manuelle | `PressableScale` de `components/ui/` | Scale animation consistente, haptic intégrable. |
| Error boundary par section | Try/catch manuel dans composant | `SectionErrorBoundary name="..."` | Pattern établi — toutes les sections dashboard existantes sont wrappées. |
| Pulse infini | `setInterval` + setState | `withRepeat(withTiming(...), -1, true)` | UI thread, pas JS thread — performance et smooth 60fps. |
| Gradient background paper | Image asset | `react-native-svg` `LinearGradient` (dans `EnvelopeFlap.tsx`) ou `expo-linear-gradient` (check si installé — sinon SVG) | Pas d'asset PNG à créer, vecteur scalable. |
| FlatList pour centaines de notes | Custom `ScrollView.map` | `FlatList` RN core | Virtualisation native (`removeClippedSubviews`, windowing). |
| Lookup profil par id (from/to → name) | Nouveau map custom | `profiles.find(p => p.id === note.from)` — déjà exposé dans useVault | Source unique de vérité. |

**Key insight :** Tout ce qu'il faut est déjà dans le repo. Phase 35 = ~95% assemblage de primitives existantes, ~5% composants nouveaux (cosmétiques enveloppe).

## Runtime State Inventory

Phase 35 est une phase **UI-only purement additive** — pas de rename/refactor/migration. Section omise (aucun item stocké/enregistré à migrer).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Aucun — Phase 35 lit `useVault().loveNotes` déjà hydraté Phase 34 | None |
| Live service config | Aucun | None |
| OS-registered state | Aucun (notifications planifiées sont Phase 36) | None |
| Secrets/env vars | Aucun | None |
| Build artifacts | Aucun (pas de nouveau package à installer, zéro dépendance ajoutée) | None |

**Cache version :** reste à **2** (bumpé Phase 34-01). Phase 35 ne modifie pas le shape `LoveNote` ni `VaultCacheState.loveNotes`.

## Common Pitfalls

### Pitfall 1 : Animation pulse qui reste active après démontage
**What goes wrong :** Carte enveloppe démontée (profile switch, `unreadCount → 0`) mais `WaxSeal` a oublié `cancelAnimation` — warning Reanimated "updated state on unmounted component".
**Why :** `withRepeat(..., -1)` = infinite, ne s'arrête pas seul.
**How to avoid :** Toujours `useEffect` cleanup avec `cancelAnimation(scale)`.
**Warning signs :** Console warn dev, léger leak mémoire.

### Pitfall 2 : `router.push` crash sur route non déclarée
**What goes wrong :** Navigation vers `/lovenotes` avant que `app/(tabs)/lovenotes.tsx` ne soit compilé → `The action 'NAVIGATE' with payload {...} was not handled by any navigator`.
**Why :** expo-router découvre les routes au build time.
**How to avoid :** Créer `app/(tabs)/lovenotes.tsx` ET la déclaration `_layout.tsx` **avant** d'ajouter l'appel `router.push` dans `index.tsx`/`more.tsx`. Ordonner les tasks du plan : (1) route + layout, (2) carte + tuile.
**Warning signs :** Crash runtime au tap carte, pas d'erreur TS (cast `as any`).

### Pitfall 3 : Re-render cascade quand `loveNotes` change
**What goes wrong :** Chaque addition/update de note re-rend tout le dashboard + tous les LoveNoteCards.
**Why :** `loveNotes` est recréé à chaque `setLoveNotes` → référence change → tous les consommateurs re-rendent.
**How to avoid :**
- `useMemo` pour les sélecteurs dérivés (`unreadForActiveProfile`, `received`, etc.) avec deps `[loveNotes, activeProfile?.id]`
- `React.memo(LoveNoteCard)` avec compare shallow par `note.sourceFile + note.status + note.readAt`
**Warning signs :** Scroll lag dans `lovenotes.tsx` avec ≥20 notes.

### Pitfall 4 : Carte enveloppe visible après changement de profil avec 0 note pour le nouveau profil
**What goes wrong :** `activeProfile` change → le memo de `pending` doit recalculer, mais si les deps n'incluent pas `activeProfile.id`, la carte reste visible avec l'ancien count.
**Why :** deps oubliées dans useMemo.
**How to avoid :** Deps explicites `[loveNotes, activeProfile?.id]`, jamais `[loveNotes]` seul.
**Warning signs :** Carte clignote au profile switch.

### Pitfall 5 : Pending note pas considérée "à révéler" si `revealAt <= now` (sans bascule Phase 36)
**What goes wrong :** Phase 36 livre la bascule auto `pending → revealed`. Si Phase 35 ne considère que `status === 'revealed'`, une note dont `revealAt` est passé mais qui n'a pas été "vue" par `AppState` → invisible sur la carte.
**Why :** Ordre des phases — Phase 35 ship avant Phase 36.
**How to avoid :** Le sélecteur `unreadForActiveProfile` doit considérer `status === 'revealed' OR (status === 'pending' && new Date(revealAt) <= now)`. Robuste aux deux phases.
**Warning signs :** User écrit une note "Dans 1 min", navigue → carte n'apparaît pas après 1 min sans relancer l'app.

### Pitfall 6 : Chemin `(tabs)` non quoté dans commits/bash
**What goes wrong :** `git add app/(tabs)/lovenotes.tsx` → shell expansion sur les parenthèses = glob fail.
**Why :** Convention CLAUDE.md rappelée.
**How to avoid :** Quoter : `git add "app/(tabs)/lovenotes.tsx"`.
**Warning signs :** "no such file or directory" en bash, fichier non staged.

### Pitfall 7 : SVG Polygon + texture paper (repeating-linear-gradient) impossible en RN
**What goes wrong :** Le mockup HTML utilise `repeating-linear-gradient` pour texture fibres papier — non supporté RN.
**Why :** RN Web → OK, RN native → pas de CSS background-image.
**How to avoid :** Soit accepter un fond uniforme ivoire sans texture (MVP), soit utiliser une texture PNG en `<Image>` avec `resizeMode="repeat"` (mais ajoute un asset). Recommandation : MVP sans texture — polish Phase 37 si nécessaire.
**Warning signs :** Visuel "trop plat" par rapport au mockup.

### Pitfall 8 : Tilt -1.5° sur parent = enfants cliquables décalés
**What goes wrong :** `transform: [{ rotate: '-1.5deg' }]` appliqué au conteneur → tap precis sur cachet moins précis, hit-box déplacée.
**Why :** RN ne ré-aligne pas les hit-boxes selon le transform pour certaines versions (bug historique).
**How to avoid :** Appliquer `rotate` uniquement sur un wrapper **visuel** (`<View style={{ transform: [rotate] }}>`) autour du rendering, avec un `Pressable` **externe** à la View tournée qui couvre la zone totale. Alternativement `hitSlop` généreux.
**Warning signs :** Tap sur coin droit ne déclenche pas l'action.

## Code Examples

### Exemple 1 : Sélecteurs dérivés purs (lib/lovenotes/selectors.ts)

```typescript
// lib/lovenotes/selectors.ts
import type { LoveNote } from '../types';

export function isRevealed(note: LoveNote, now = new Date()): boolean {
  if (note.status === 'revealed' || note.status === 'read') return true;
  // status === 'pending' — considéré révélé si revealAt <= now (fallback Phase 35,
  // la vraie bascule status est faite Phase 36 LOVE-12 via AppState)
  return note.revealAt <= now.toISOString().slice(0, 19);
}

export function unreadForProfile(notes: LoveNote[], profileId: string): LoveNote[] {
  return notes.filter(
    (n) => n.to === profileId && n.status !== 'read' && isRevealed(n)
  );
}

export function receivedForProfile(notes: LoveNote[], profileId: string): LoveNote[] {
  return notes
    .filter((n) => n.to === profileId)
    .sort((a, b) => {
      // Non lues d'abord, puis par createdAt desc
      if (a.status !== 'read' && b.status === 'read') return -1;
      if (a.status === 'read' && b.status !== 'read') return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
}

export function sentByProfile(notes: LoveNote[], profileId: string): LoveNote[] {
  return notes
    .filter((n) => n.from === profileId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function archivedForProfile(notes: LoveNote[], profileId: string): LoveNote[] {
  return notes
    .filter(
      (n) =>
        (n.to === profileId && n.status === 'read') ||
        (n.from === profileId && n.status === 'read')
    )
    .sort((a, b) => (b.readAt ?? b.createdAt).localeCompare(a.readAt ?? a.createdAt));
}
```

### Exemple 2 : Écran boîte aux lettres (app/(tabs)/lovenotes.tsx)

```tsx
// app/(tabs)/lovenotes.tsx
import { useMemo, useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { ModalHeader, SegmentedControl } from '../../components/ui';
import { LoveNoteCard } from '../../components/lovenotes';
import { receivedForProfile, sentByProfile, archivedForProfile } from '../../lib/lovenotes/selectors';
import type { LoveNote } from '../../lib/types';
import { Spacing } from '../../constants/spacing';

type Segment = 'received' | 'sent' | 'archived';

export default function LoveNotesScreen() {
  const { loveNotes, activeProfile } = useVault();
  const { colors } = useThemeColors();
  const [segment, setSegment] = useState<Segment>('received');

  const received = useMemo(
    () => (activeProfile ? receivedForProfile(loveNotes, activeProfile.id) : []),
    [loveNotes, activeProfile?.id]
  );
  const sent = useMemo(
    () => (activeProfile ? sentByProfile(loveNotes, activeProfile.id) : []),
    [loveNotes, activeProfile?.id]
  );
  const archived = useMemo(
    () => (activeProfile ? archivedForProfile(loveNotes, activeProfile.id) : []),
    [loveNotes, activeProfile?.id]
  );

  const unreadCount = received.filter((n) => n.status !== 'read').length;

  const data = segment === 'received' ? received : segment === 'sent' ? sent : archived;

  const renderItem = useCallback(
    ({ item }: { item: LoveNote }) => <LoveNoteCard note={item} />,
    []
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <ModalHeader title="Boîte aux lettres" />
      <View style={styles.controls}>
        <SegmentedControl<Segment>
          segments={[
            { id: 'received', label: 'Reçues', badge: unreadCount || undefined },
            { id: 'sent', label: 'Envoyées' },
            { id: 'archived', label: 'Archivées' },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </View>
      {data.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[{ color: colors.textMuted }]}>Aucune note pour l'instant.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(n) => n.sourceFile}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          initialNumToRender={10}
          removeClippedSubviews
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  controls: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.md },
  list: { padding: Spacing['2xl'] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
```

### Exemple 3 : Injection carte dashboard (modification minimale `index.tsx`)

```tsx
// app/(tabs)/index.tsx — vers ligne 1038, JUSTE AVANT le bloc `(() => { const visibleSections = ...`

{activeProfile && (() => {
  const pendingForUser = loveNotes.filter(
    (n) => n.to === activeProfile.id &&
      n.status !== 'read' &&
      (n.status === 'revealed' || n.revealAt <= new Date().toISOString().slice(0, 19))
  );
  if (pendingForUser.length === 0) return null;
  return (
    <SectionErrorBoundary key="lovenotes-envelope" name="Love Notes">
      <EnvelopeCard
        count={pendingForUser.length}
        recipientName={activeProfile.name}
        onPress={() => {
          Haptics.selectionAsync();
          router.push('/(tabs)/lovenotes' as any);
        }}
      />
    </SectionErrorBoundary>
  );
})()}
```

### Exemple 4 : Tuile `more.tsx` (ajout minimal)

```tsx
// app/(tabs)/more.tsx — ajouter dans l'array items, catégorie 'famille' (vers ligne 144)
{
  emoji: '💌',
  label: 'Love Notes',
  route: '/(tabs)/lovenotes',
  badge: loveNotes.filter((n) => n.to === activeProfile?.id && n.status !== 'read').length || undefined,
  color: colors.catFamille,
  category: 'famille' as const,
},
```

Il faudra destructurer `loveNotes` depuis `useVault()` (ligne 77) en plus des existants.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dashboard items tous dans `sortedSections` | Carte enveloppe **hors** `sortedSections`, pinned en dur | Phase 35 (décision architecturale nouvelle) | Permet sections non-configurables, non-déplaçables — réutilisable pour futures "hero cards" urgentes |
| Routes modales dans `app/` racine | Routes écran dans `app/(tabs)/` avec `href: null` | Établi Phase loot (v1.1) et notes | Garde la tab bar, navigation cohérente |
| Animations : RN Animated + setInterval | Reanimated 4.1 worklets | Phase 03-04 (stack décision initiale) | 60fps UI thread, pas JS blocking |

**Pas de deprecated applicable — tout le stack est courant (expo SDK 54 avril 2026).**

## Open Questions

1. **Token colors "loveNotePaper" / "loveNoteWax" dans `constants/colors.ts` ou constantes module ?**
   - What we know : Les couleurs ivoire/wax sont cosmétiques unique à ce composant. Précédent FloatingPoints (`#FFD700` en StyleSheet) accepte l'inline. Mais carte enveloppe réutilisée dans Phase 36 (reveal state) + Phase 37 (polish) — une source unique simplifie.
   - What's unclear : Le user a-t-il une préférence dark mode pour la carte (papier ivoire inchangé ou plus sombre la nuit) ?
   - Recommendation : Ajouter dans `constants/colors.ts` les tokens `loveNotePaper`, `loveNotePaperDark` (= `#e6d8b5`), `loveNoteWax`, `loveNoteInk` avec même valeur Light/Dark (cosmétique volontairement constante — feel analogique papier). Alternatively: leave as module constants in `EnvelopeCard.tsx` — planner à trancher, impact commit footprint bas.

2. **Bascule `pending → revealed` partielle en Phase 35 ?**
   - What we know : LOVE-12 (bascule auto sur `AppState.active`) est **Phase 36**. Mais l'utilisateur pourrait écrire une note dont `revealAt` est proche, et si Phase 35 ship avant Phase 36, l'app existe 1-2 semaines sans la bascule.
   - What's unclear : Est-ce acceptable de laisser la carte "intelligente" (considère `pending + revealAt <= now` comme révélé) **sans** patcher le statut en disk ?
   - Recommendation : **OUI** — la Phase 35 traite uniquement la vue ; c'est robuste et préserve la compat Phase 36 (qui écrira vraiment le statut). Documenter ce comportement dans le summary.

3. **Empty state basique ou illustré ?**
   - What we know : LOVE-16/polish est Phase 37 — empty states illustrés explicitement listés là.
   - Recommendation : Phase 35 livre des empty states **textuels simples** (pattern `EmptyState.tsx`). Phase 37 remplacera par des illustrations.

4. **`MarkdownText` pour `body` sur `LoveNoteCard` ?**
   - What we know : `MarkdownText.tsx` existe (20KB — complet). Le body est markdown (confirmé type). Mais la carte list est préview (ellipsis 2-3 lignes), pas le plein texte.
   - Recommendation : `<Text numberOfLines={2}>{note.body.replace(/[*_`#>]/g, '')}</Text>` pour preview (strip markdown inline) — MarkdownText réservé à Phase 36 pour la vue ouverte complète.

5. **Tri "non lues en priorité" dans segment Reçues — comment gérer les `pending` non-encore-revealed ?**
   - What we know : LOVE-08 dit "Reçues (non lues en priorité)". Les `pending` avec `revealAt` futur : doivent-elles apparaître dans Reçues avec un état "programmée" ?
   - Recommendation : Oui, mais affichées en **bas** du segment avec un badge visuel "programmée pour JJ/MM/AAAA" + cachet **non animé** (pulse réservé aux `revealed`). Permet à l'user de voir qu'il a reçu quelque chose en attente, sans spoiler le contenu.

## Environment Availability

Phase 35 est purement code/UI — aucune dépendance externe nouvelle. Tous les outils requis sont déjà dans le stack :

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| react-native-reanimated | Pulse cachet cire | ✓ | ~4.1 (package.json vérifié CLAUDE.md) | — |
| expo-haptics | Feedback tap | ✓ | installé | Skip haptic silencieusement si indispo |
| react-native-svg | Rabat triangulaire | ✓ (utilisé par `ReactiveAvatar`, `CompanionSlot`) | installé | Bordure triangulaire CSS hack |
| expo-router | Nouvelle route | ✓ | v6 | — |
| FlatList (RN core) | Listes virtualisées | ✓ | 0.81 | — |

**Missing dependencies with no fallback :** Aucun.
**Missing dependencies with fallback :** Aucun.

## Sources

### Primary (HIGH confidence — code repo directement vérifié)

- `hooks/useVaultLoveNotes.ts` (126 lignes, lu intégralement) — API exacte du hook
- `lib/types.ts:575-606` — Shape `LoveNote` et `LoveNoteStatus`
- `lib/parser.ts:2758-2813` (grep) — `LOVENOTES_DIR`, `loveNotePath`, `parseLoveNote`, `serializeLoveNote`
- `app/(tabs)/index.tsx:500-1090` — structure dashboard, `sortedSections`, `renderSection`, point d'injection
- `app/(tabs)/more.tsx` (intégralement lu) — pattern tuile catégorie 'famille'
- `app/(tabs)/_layout.tsx:264,277` — pattern `href: null` (loot, notes)
- `components/ui/SegmentedControl.tsx` (intégralement lu) — API existante
- `components/ui/index.ts` — barrel UI disponible
- `components/dashboard/index.ts` — barrel dashboard sections
- `components/dashboard/types.ts` — `DashboardSectionProps` (non-requis ici car la carte n'est pas dans `sortedSections`)
- `constants/colors.ts` (intégralement lu) — absence de tokens ivoire/wax confirmée
- `.planning/phases/34-fondation-donn-es-hook-domaine/34-03-SUMMARY.md` — confirmation livraison hook + cablage `useVault`
- `.planning/mockups/lovenote-envelope.html` — mockup visuel détaillé (dimensions, couleurs, animations pulse 2.4s)
- `./CLAUDE.md` — conventions projet
- `.planning/REQUIREMENTS.md` — LOVE-05/06/07/08 verbatim
- `.planning/ROADMAP.md` — Phase 35 success criteria

### Secondary (MEDIUM — inferred from repo patterns)

- Pattern `(tabs)/loot.tsx` + `href: null` : inféré du `_layout.tsx` (non lu intégralement mais grep confirmant la ligne exact)
- Pattern `SectionErrorBoundary` : listé dans barrel mais contenu non lu (présomption comportement standard — à vérifier au plan si le planner veut voir le prop `name` et le fallback UI)

### Tertiary (LOW — pas d'items LOW, tout est vérifiable dans le repo)

Aucun — Phase 35 est 100% internal. Pas de WebSearch nécessaire.

## Metadata

**Confidence breakdown :**
- Standard stack : HIGH — tout vérifié dans `package.json`-adjacent files et imports actifs du repo
- Architecture : HIGH — point d'injection dashboard localisé précisément (ligne 1038), pattern route `(tabs)/name` éprouvé Phase 11+
- Pitfalls : HIGH — issus de la connaissance codebase (cache, routes, reanimated cleanup) et de CLAUDE.md
- Hook API consommé : HIGH — lecture directe `hooks/useVaultLoveNotes.ts`

**Research date :** 2026-04-17
**Valid until :** 2026-05-17 (stable — le hook consommé ne va pas bouger, la Phase 36 ne modifie pas le shape `LoveNote` ni l'API hook, seulement ajoute les helpers `revealPendingNotes`)
