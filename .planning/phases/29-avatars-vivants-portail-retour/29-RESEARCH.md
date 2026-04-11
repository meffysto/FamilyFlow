# Phase 29: Avatars vivants + portail retour — Research

**Researched:** 2026-04-11
**Domain:** React Native integration phase (overlay sprites pixel art, navigation transitions, Reanimated animations, village map)
**Confidence:** HIGH (100% du code référencé vérifié en lecture directe — intégration pure sans dépendances externes)

## Summary

Phase 29 est une phase d'**intégration** (pas d'exploration). Toute la plomberie est déjà en place depuis les phases 25-28 : `VILLAGE_GRID`, `TileMapRenderer` mode village, `useGarden().gardenData.contributions`, `activeProfiles` memo, `PortalSprite` glow+scale, pattern `screenOpacity` fade 400ms avec `runOnJS(router.push)`. Les seuls éléments vraiment nouveaux sont **3 composants overlay** (`VillageAvatar`, `AvatarTooltip`, `PortalSprite` partagé) et **l'extension de deux modules data** (`VillageRole` type, `VILLAGE_GRID` table).

Découverte critique de la recherche : **`buildVillageMap()` dans `lib/mascot/farm-map.ts` ne lit PAS `VILLAGE_GRID`** — les terrains cobblestone/fontaine sont hardcodés en cellules littérales (cols 1-11 × rows 4-16 pour cobble, cols 5-7 × rows 8-10 pour water). `VILLAGE_GRID` est donc un **registre d'anchors fractionnels consommés uniquement par les overlays** au-dessus du `TileMapRenderer`. Ajouter 7 entrées (6 avatars + 1 portail) n'affecte pas du tout le rendu tilemap — il faut explicitement les itérer dans `village.tsx` pour afficher des sprites absolute-positionnés. Cela valide D-05/D-06 mais impose que tout le rendering nouveau passe par `village.tsx` via siblings du `<TileMapRenderer />` dans `styles.mapContainer`.

Deuxième insight : `ReactiveAvatar` a une signature strictement `emoji: string` (lu à ligne 29 du fichier) — **impossible** de le réutiliser pour rendre un sprite pixel art, confirme définitivement D-02 (nouveau composant `VillageAvatar`). Troisième insight : le `PortalSprite` de `tree.tsx` (lignes 303-361) est déclaré en fonction locale non exportée, avec ses styles dans `styles.portalContainer/portalGlow/portalEmoji` locaux au fichier (lignes 3018-3034) — une extraction partagée (CD-04) demande de copier 3 styles + la logique complète, mais la dup-and-delete est triviale (~60 lignes).

**Primary recommendation:** Extraire `PortalSprite` dans `components/village/PortalSprite.tsx` avec une prop `onPress`, le consommer depuis `tree.tsx` ET `village.tsx`, et remplacer le `<Text>🏛️</Text>` par `<Image source={require('@/assets/items/portail.png')} style={styles.portalImage} />`. Pour les avatars, créer `VillageAvatar` + `AvatarTooltip` dans `components/village/`, itérer `VILLAGE_GRID.filter(c => c.role === 'avatar')` dans `village.tsx`, et rendre les sprites compagnon en `<Animated.Image>` siblings du `TileMapRenderer` dans `styles.mapContainer`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Avatars sur la carte village — Style visuel**
- **D-01** — Sprites compagnon pixel art (pas d'emojis). Lire `profile.companion.activeSpecies` (5 espèces : chat/chien/lapin/renard/herisson) et dériver le stade via `getCompanionStage(profileLevel)` depuis `lib/mascot/companion-engine.ts` (bebe/jeune/adulte). Sprites : `assets/garden/animals/{species}/{stage}/idle_1.png` et `idle_2.png` en alternance.
- **D-02** — Nouveau composant dédié `components/village/VillageAvatar.tsx`. NE PAS réutiliser `ReactiveAvatar` (emoji-only). Props : `{ profile, contributionsThisWeek, isActive, onPress }`. Sprite compagnon en `<Animated.Image>` avec alternance idle_1/idle_2.
- **D-03** — Fallback si `profile.companion` est null : **skip ce profil** (pas d'avatar affiché). Pas de placeholder générique.

**Avatars sur la carte village — Positionnement**
- **D-04** — Positions = slots fixes dans `VILLAGE_GRID` (`lib/village/grid.ts`). Ajout de **6 entrées** avec nouveau role `'avatar'` : `village_avatar_slot_0` à `village_avatar_slot_5`.
- **D-05** — Le type `VillageRole` gagne `'avatar'` (le role `'portal'` existe déjà dans le type mais n'était pas utilisé, on l'utilise enfin).
- **D-06** — **Layout des 6 slots** répartis autour de la fontaine : `slot_0` 0.35/0.40, `slot_1` 0.65/0.40, `slot_2` 0.30/0.55, `slot_3` 0.70/0.55, `slot_4` 0.40/0.72, `slot_5` 0.60/0.72. Ajustables par le planner après test visuel.
- **D-07** — **Assignation profil → slot** : tri alphabétique sur `profile.id`. Index dans `activeProfiles.sort((a,b) => a.id.localeCompare(b.id))` détermine le slot (index 0 → `village_avatar_slot_0`). Déterministe, stable entre restarts, pas de persistance.
- **D-08** — Edge cases : >6 profils → profils après index 5 non affichés. <6 profils → slots non utilisés restent vides. Nouveau profil → prochain slot libre après re-tri alphabétique.

**Indicateur actif/inactif (VILL-02) — Claude's Discretion**
- **D-09** — "Actif cette semaine" = `gardenData.contributions` contient ≥1 entrée avec `profileId === profile.id` ET `timestamp` dans `gardenData.currentWeekStart`. Calculé en mémoire (pas de nouveau champ vault).
- **D-10** — **Actif** : halo glow `colors.success` en fond circulaire, pulse subtil (`withRepeat(withTiming(0.8, {duration:2000}), -1, true)` opacity 0.5↔0.8). Sprite à opacité pleine. **Inactif** : pas de halo, sprite opacité ~0.55, pas d'animation pulse.

**Bulle tap avatar (VILL-03)**
- **D-11** — Tooltip absolute-positionné flottant au-dessus de l'avatar tapé, rendu dans `village.tsx` comme overlay au-dessus de la carte. State local : `const [tooltip, setTooltip] = useState<{ profileId, x, y } | null>(null)`. Nouveau composant `components/village/AvatarTooltip.tsx`.
- **D-12** — Contenu mono-ligne `"[Prénom] — X contributions cette semaine"`. Si X === 0 : `"[Prénom] — pas encore contribué"`.
- **D-13** — Dismiss auto après **2.5 secondes** (setTimeout dans ref, cleared au unmount / tap suivant). Tap autre avatar → dismiss immédiat + ouvre nouveau tooltip. Tap en dehors → dismiss immédiat.
- **D-14** — Animation entrée : opacity 0→1 + translateY -4→0 en 180ms (`withTiming`). Sortie : opacity 1→0 + translateY 0→-4 en 150ms.
- **D-15** — `VillageAvatar` wrappé dans `Pressable`/`TouchableOpacity`, hitSlop 8px, `onPress` → `Haptics.selectionAsync()` + set state tooltip avec position.

**Portail retour village → ferme (VILL-11)**
- **D-16** — Sprite `assets/items/portail.png` (existant, 178 KB). Même sprite des deux côtés (symétrie).
- **D-17** — **Remplacement obligatoire côté ferme** : `app/(tabs)/tree.tsx:357` emoji `🏛️` remplacé par `<Image source={require('@/assets/items/portail.png')} />`. Animation glow loop + scale spring existante conservée.
- **D-18** — Nouvelle entrée `VILLAGE_GRID` id `village_portal_home` role `'portal'`. Coords proposées : `{ x: 0.85, y: 0.85 }` (CD-03, ajustable).
- **D-19** — **Suppression du bouton header `‹`** dans `app/(tabs)/village.tsx:407-418` (`styles.backBtn` + arrow `‹`). Portail = seul point de sortie (cohérent avec Phase 28 D-08).
- **D-20** — Composant `PortalSprite` partagé recommandé : extraction dans `components/village/PortalSprite.tsx` avec prop `onPress`, consommé par `tree.tsx` et `village.tsx`. Décision finale au planner (CD-04).

**Transition fade cross-dissolve retour (VILL-12)**
- **D-21** — `screenOpacity` sharedValue dans `VillageScreen` (symétrique à `tree.tsx:408-409`), `withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) })`, callback `runOnJS(router.replace)('/(tabs)/tree')`. Durée 400ms exacte comme l'aller.
- **D-22** — `useFocusEffect` reset `screenOpacity.value = 1` au retour focus (symétrique à `tree.tsx:422-425`).
- **D-23** — Navigation `router.replace` (pas `push`) pour éviter empilement stack ping-pong.

### Claude's Discretion

- **CD-01 (D-10)** — Couleur/intensité/durée exactes du pulse halo actif. Guidance : `colors.success`, pulse ~2s `withRepeat(withTiming, -1, true)`.
- **CD-02 (D-06)** — Coordonnées fines des 6 slots avatars, ajustables après test device.
- **CD-03 (D-18)** — Coordonnées fines du slot `village_portal_home` (0.85/0.85 proposé).
- **CD-04 (D-20)** — Mutualisation ou duplication du composant `PortalSprite`. **Recommandation forte pour mutualiser.**
- **CD-05** — Tailles exactes des sprites (compagnons ~24-32px, portails ~40-56px). Ajustables après test device.

### Deferred Ideas (OUT OF SCOPE)

- Indicateur actif/inactif visuel final — si rendu ne plaît pas, re-discuter avant Phase 30.
- Tailles exactes sprites — ajustables après test visuel.
- Interactions inter-avatars (VILL-14 future).
- Personnalisation manuelle placement (VILL-15 future).
- Animations marche des avatars — explicitement Out of Scope v1.5 ("positions fixes, pas de pathfinding").
- Fallback profil sans compagnon — actuellement : skip le profil.
- Nouveau sprite portail dédié ferme vs village — écarté par D-17 (portail.png symétrique).
- Bulle riche (rôle, emoji, icônes) — écarté en zone 2.
- Refacto emoji `ReactiveAvatar` — ne touche pas la section "Membres actifs" de `village.tsx:524-553` (hors scope Phase 29, reste emoji).

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VILL-01 | Avatar par profil actif positionné à emplacement fixe | `VILLAGE_GRID` extensible + 6 slots `village_avatar_slot_*` + tri alphabétique déterministe sur `profile.id`. Renderer dans `village.tsx` en overlay absolute siblings du `TileMapRenderer`. Source sprites : `assets/garden/animals/{species}/{stage}/idle_{1,2}.png` via `profile.companion.activeSpecies` + `getCompanionStage(profile.level)`. |
| VILL-02 | Indicateur halo/opacité actif vs inactif (contribué cette semaine) | Nouveau memo `weeklyContribs` dans `village.tsx` calculé à partir de `gardenData.contributions` filtré par `timestamp >= currentWeekStart`. Rendu : halo `colors.success` pulse `withRepeat` pour actifs, opacité 0.55 sans halo pour inactifs. |
| VILL-03 | Tap avatar → bulle auto-dismiss "[Prénom] — X contributions cette semaine" | Nouveau composant `AvatarTooltip` state local dans `VillageScreen`, setTimeout 2.5s ref, animation Reanimated opacity+translateY. Tap extérieur/autre avatar → dismiss immédiat. |
| VILL-11 | Portail retour visuel symétrique à Phase 28 | Nouveau composant partagé `PortalSprite` (extraction de `tree.tsx:303-361`) + sprite `assets/items/portail.png` des deux côtés (remplace emoji 🏛️ à `tree.tsx:357`). Entrée `village_portal_home` dans `VILLAGE_GRID` role `'portal'`. Suppression du `backBtn` header (`village.tsx:407-418`). |
| VILL-12 | Transition fade cross-dissolve Reanimated ~400ms cohérente avec aller | Duplication symétrique du pattern `screenOpacity` + `withTiming(0, {duration:400, easing:Easing.out(Easing.ease)})` + `runOnJS(router.replace)('/(tabs)/tree')` + `useFocusEffect` reset — déjà implémenté côté ferme dans `tree.tsx:407-425`. |

</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

Extraction des directives applicables à la Phase 29 — le planner DOIT les vérifier dans chaque plan/tâche.

### Obligatoires (non-négociables)
- **Langue UI/commits/commentaires : français.** Prénoms génériques dans commits publics.
- **Couleurs** : TOUJOURS `useThemeColors()` / `colors.*` — jamais de hex hardcodé (`#FFFFFF`, etc.). Halo actif DOIT utiliser `colors.success`, jamais `#10B981`.
- **Animations** : `react-native-reanimated` ~4.1 obligatoire (`useSharedValue`, `useAnimatedStyle`, `withSpring`/`withTiming`/`withRepeat`) — jamais `Animated` de React Native.
- **Spring configs** comme constante module en tête de fichier : `const SPRING_CONFIG = { damping: 10, stiffness: 180 }`.
- **Éviter `perspective`** dans transform arrays (clipping 3D) — non applicable Phase 29 (pas de flips) mais à garder en tête.
- **Tokens design** : `Spacing.*`, `Radius.*`, `FontSize.*`, `FontWeight.*`, `LineHeight.*` pour toutes valeurs numériques. Exception documentée : dimensions de sprite pixel art (24-32px avatars, 48-56px portails) — non des tokens.
- **Format date affiché** : JJ/MM/AAAA (non applicable directement Phase 29 — pas d'affichage de date).
- **Path avec parenthèses** `app/(tabs)/` doivent être quotés dans git/bash (déjà pris en compte dans les commandes `run:ios`).
- **`React.memo()`** sur `VillageAvatar` (rendu en liste × 6 dans la carte), **`useCallback()`** sur handlers passés en props.
- **`useMemo()`** pour `weeklyContribs`, `sortedActiveProfiles`, toutes dérivations coûteuses.
- **Erreurs user-facing** : `Alert.alert()` en français (non applicable — pas d'erreur exposée Phase 29).
- **Erreurs non-critiques silencieuses** : `catch { /* Village avatars — non-critical */ }`.
- **`console.warn/error`** uniquement sous `if (__DEV__)`.
- **Type check avant commit** : `npx tsc --noEmit` (obligatoire).
- **Ne jamais régresser TestFlight** — Phase 29 doit être non-cassante, ne pas altérer ferme ni village existants hors scope explicite.
- **Livraison** : `/ship` (tsc + privacy check + commit FR + push).

### Patterns interdits dans ce phase
- **Swipe dans ScrollView** : conflit de geste → remplacer par tap. Le tooltip doit utiliser un `Pressable` + setTimeout, PAS un swipe pour dismiss.
- **`ReanimatedSwipeable`** : pas applicable Phase 29 (pas de swipe).
- **Styles dynamiques** (dépendant du thème) : inline avec `useThemeColors()`. Styles statiques en `StyleSheet.create({})` en bas de fichier.

---

## Standard Stack

### Core (déjà installé, zéro nouvelle dépendance — ARCH-05 reconduit)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-native-reanimated` | ~4.1 | Toutes animations (pulse halo, fade screen, glow portal, scale spring, tooltip entrée/sortie) | Obligatoire CLAUDE.md, seule lib acceptée pour animations dans le projet |
| `expo-router` | v6 | `useRouter`, `router.replace`, `useFocusEffect` | Navigation projet standard |
| `expo-haptics` | déjà installé | `Haptics.selectionAsync()` sur tap avatar et tap portail | Convention projet (`tree.tsx:328`, usage généralisé) |
| `react-native` core | 0.81.5 | `Pressable`, `TouchableOpacity`, `Image`, `View`, `Text`, `Dimensions` | Stack de base |

### Supporting (déjà installé)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-native-safe-area-context` | déjà installé | `useSafeAreaInsets` | Déjà utilisé dans `village.tsx:293` |
| `@/contexts/ThemeContext` | interne | `useThemeColors()` → `{ colors, isDark }` | Toutes couleurs Phase 29 |
| `@/contexts/VaultContext` | interne | `useVault()` → `profiles`, `activeProfile` | Source données profils |
| `@/hooks/useGarden` | interne | `gardenData.contributions`, `currentWeekStart` | Source contributions hebdo |
| `@/lib/mascot/companion-engine` | interne | `getCompanionStage(level)` | Dériver stade sprite |
| `@/lib/mascot/companion-types` | interne | `CompanionSpecies`, `CompanionStage`, `CompanionData` | Types sprites |
| `@/constants/spacing` | interne | `Spacing.*`, `Radius.*` | Tokens dimensions |
| `@/constants/typography` | interne | `FontSize.*`, `FontWeight.*`, `LineHeight.*` | Tokens texte |

### Alternatives Considérées et Rejetées

| Instead of | Could Use | Rejeté car |
|------------|-----------|------------|
| Nouveau `VillageAvatar` pixel art | Réutiliser `ReactiveAvatar` | `ReactiveAvatar` accepte uniquement `emoji: string` — incompatible avec sprite `<Image>` pixel art. User veut explicitement pixel art (D-01). |
| `useState + setTimeout` local tooltip | `ToastProvider` global | Toast est global (pas contextuel à l'avatar), perd le lien visuel (Discussion Zone 2 Q1). |
| `router.push` retour | `router.replace` | Push empile la stack à l'infini sur ping-pong ferme↔village (D-23). |
| Hash déterministe `profile.id % N` | Tri alphabétique | Moins lisible, collisions possibles (Discussion Zone 1 Q1). |
| Persistance mapping `profileId → slotId` | Tri alphabétique runtime | Nouveau champ vault, refuse le principe v1.4 zéro nouveau champ pour cette phase (D-04, D-07). |
| `ImageBackground` pour halo | `<Animated.View>` circle + `Animated.Image` au-dessus | Halo = effet pulse séparé, plus simple en sibling. Pattern PortalSprite existe déjà (`tree.tsx:342-350`). |

**Installation :** Aucune (ARCH-05 reconduit sur v1.5).

**Version verification :** Toutes dépendances pré-installées, versions verrouillées dans `package.json` — pas d'upgrade nécessaire pour Phase 29.

---

## Architecture Patterns

### Recommended Project Structure

```
app/(tabs)/
├── village.tsx          # MODIFIÉ — ajout overlay avatars + portail + tooltip state + fade screen + suppression backBtn
└── tree.tsx             # MODIFIÉ — ligne 357 : <Text>🏛️</Text> → <Image source={portail.png} />, utilise <PortalSprite /> partagé

components/village/       # NOUVEAU DOSSIER (n'existe pas encore)
├── VillageAvatar.tsx    # NOUVEAU — sprite compagnon + halo + Pressable
├── AvatarTooltip.tsx    # NOUVEAU — tooltip absolute positionné animé
└── PortalSprite.tsx     # NOUVEAU (extraction CD-04) — glow loop + scale spring + <Image portail.png>

lib/village/
├── types.ts             # MODIFIÉ — ajout 'avatar' dans VillageRole
└── grid.ts              # MODIFIÉ — ajout 6 avatar slots + 1 portal slot
```

**Note critique :** `components/village/` n'existe pas encore (vérifié). La première tâche qui crée un fichier dans ce dossier doit le créer implicitement.

### Pattern 1 : Overlay absolute au-dessus du TileMapRenderer

**What:** Le `TileMapRenderer` est déclaré `pointerEvents="none"` (implicite dans son `StyleSheet.absoluteFill`). Les éléments interactifs (avatars, portail) sont rendus comme **siblings absolute-positioned** DANS le même parent (`styles.mapContainer` de `village.tsx:430`), PAS comme children du renderer.

**When to use:** Tous les sprites interactifs Phase 29 (6 avatars + 1 portail retour).

**Example:**
```tsx
// village.tsx — dans le render du mapContainer
<View
  style={[styles.mapContainer, { height: MAP_HEIGHT }]}
  onLayout={handleMapLayout}
>
  {/* Fond — pas interactif */}
  <TileMapRenderer
    treeStage="arbre"
    containerWidth={SCREEN_W}
    containerHeight={MAP_HEIGHT}
    season={season}
    mode="village"
  />

  {/* Overlay avatars — siblings absolute dans le même container */}
  {sortedActiveProfiles.slice(0, 6).map((profile, idx) => {
    const slot = VILLAGE_GRID.find(c => c.id === `village_avatar_slot_${idx}`);
    if (!slot || !profile.companion) return null;
    const isActive = weeklyContribs[profile.id] > 0;
    return (
      <VillageAvatar
        key={profile.id}
        profile={profile}
        slotX={slot.x * mapSize.width}
        slotY={slot.y * mapSize.height}
        isActive={isActive}
        contributionsThisWeek={weeklyContribs[profile.id] ?? 0}
        onPress={() => handleAvatarPress(profile, slot)}
      />
    );
  })}

  {/* Portail retour — dernier sibling */}
  <PortalSprite
    onPress={handleReturnPortalPress}
    x={0.85 * mapSize.width}
    y={0.85 * mapSize.height}
  />

  {/* Tooltip conditionnel au-dessus de tout */}
  {tooltip && (
    <AvatarTooltip
      profileName={tooltip.profileName}
      count={tooltip.count}
      x={tooltip.x}
      y={tooltip.y}
      onDismiss={() => setTooltip(null)}
    />
  )}
</View>
```

**Source:** Pattern vérifié dans `CompanionSlot.tsx:738-748` (overlay absolute dans container) et `village.tsx:429-440` (conteneur existant).

### Pattern 2 : Alternance idle_1/idle_2 respiration (CompanionSlot.tsx:95-121 + 730)

**What:** Toggle entre deux frames PNG via `useState<0|1>` + `setTimeout` 500ms — pas de `useSharedValue` (plus simple pour frame swap qu'animation continue).

**Example:**
```tsx
// VillageAvatar.tsx
const [frameIdx, setFrameIdx] = useState<0 | 1>(0);

useEffect(() => {
  const tick = setTimeout(() => {
    setFrameIdx(f => (f === 0 ? 1 : 0));
  }, 500);
  return () => clearTimeout(tick);
}, [frameIdx]);

const species = profile.companion.activeSpecies;
const stage = getCompanionStage(profile.level);
const sprites = COMPANION_SPRITES[species][stage]; // require() map identique à CompanionSlot.tsx
const currentSprite = frameIdx === 0 ? sprites.idle_1 : sprites.idle_2;
```

**Source:** `components/mascot/CompanionSlot.tsx:95-121` (COMPANION_SPRITES structure) et `:730` (toggle logic).

**Important:** Le mapping `COMPANION_SPRITES` est déclaré local à `CompanionSlot.tsx` — il faut soit (a) le dupliquer dans `VillageAvatar.tsx`, soit (b) l'extraire dans un module partagé `lib/mascot/companion-sprites.ts`. **Recommandation : extraction** pour éviter la dup dans un mapping de 15 `require()`. Le planner décide.

### Pattern 3 : Halo pulse actif avec `withRepeat`

**What:** `useSharedValue(0.5)` + `useEffect` qui lance `withRepeat(withTiming(0.8, {duration:2000}), -1, true)`. Appliqué sur un `<Animated.View>` circle en fond du sprite.

**Example:**
```tsx
// VillageAvatar.tsx — halo pulse si isActive
const haloOpacity = useSharedValue(0.5);

useEffect(() => {
  if (isActive) {
    haloOpacity.value = withRepeat(withTiming(0.8, { duration: 2000 }), -1, true);
  } else {
    cancelAnimation(haloOpacity);
    haloOpacity.value = 0;
  }
}, [isActive, haloOpacity]);

const haloStyle = useAnimatedStyle(() => ({ opacity: haloOpacity.value }));

return (
  <View style={[styles.slot, { left: slotX - AVATAR_SIZE/2, top: slotY - AVATAR_SIZE/2 }]}>
    {isActive && (
      <Animated.View
        style={[
          styles.halo,
          { backgroundColor: colors.success, width: AVATAR_SIZE + 12, height: AVATAR_SIZE + 12 },
          haloStyle,
        ]}
        pointerEvents="none"
      />
    )}
    <Pressable onPress={onPress} hitSlop={HIT_SLOP}>
      <Animated.Image
        source={currentSprite}
        style={[styles.sprite, !isActive && styles.spriteInactive]}
      />
    </Pressable>
  </View>
);
```

**Source:** Pattern `PortalSprite` (`tree.tsx:311, 315-317, 319-321`) adapté — identique structure, seul le `backgroundColor` et les valeurs diffèrent (`0.4→0.8` pour portail vs `0.5→0.8` pour halo).

### Pattern 4 : Transition fade cross-dissolve avec `runOnJS`

**What:** `screenOpacity` sharedValue à 1, au tap → `withTiming(0, {duration:400, easing:Easing.out(Easing.ease)})` avec callback `runOnJS(router.replace)`. `useFocusEffect` reset à 1 quand l'écran regagne le focus.

**Example (déjà dans `tree.tsx:407-425`, à dupliquer symétriquement dans `village.tsx`) :**
```tsx
// village.tsx — ajouter en tête du composant
const screenOpacity = useSharedValue(1);
const fadeStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));

const handleReturnPortalPress = useCallback(() => {
  screenOpacity.value = withTiming(
    0,
    { duration: 400, easing: Easing.out(Easing.ease) },
    (finished) => {
      if (finished) runOnJS(router.replace)('/(tabs)/tree' as any);
    },
  );
}, [screenOpacity, router]);

useFocusEffect(useCallback(() => {
  screenOpacity.value = 1;
}, [screenOpacity]));

// Puis wrapper le root avec <Animated.View style={[styles.root, fadeStyle]}>
```

**Source:** `app/(tabs)/tree.tsx:407-425` — pattern Phase 28 vérifié fonctionnel.

**Pitfall:** `router.push('/(tabs)/village' as any)` dans `tree.tsx` reste inchangé (push aller). Le retour utilise `router.replace` pour éviter stack infini ping-pong. La combinaison push-aller / replace-retour donne un stack propre.

### Pattern 5 : Tooltip entrée/sortie Reanimated

**What:** Nouveau composant monté conditionnellement. Anime opacity 0→1 + translateY -4→0 en 180ms au mount, et au dismiss anime 1→0 + 0→-4 en 150ms.

**Example:**
```tsx
// AvatarTooltip.tsx
const opacity = useSharedValue(0);
const translateY = useSharedValue(-4);

useEffect(() => {
  opacity.value = withTiming(1, { duration: 180 });
  translateY.value = withTiming(0, { duration: 180 });

  const dismissTimer = setTimeout(() => {
    opacity.value = withTiming(0, { duration: 150 });
    translateY.value = withTiming(-4, { duration: 150 }, (finished) => {
      if (finished) runOnJS(onDismiss)();
    });
  }, 2500);

  return () => clearTimeout(dismissTimer);
}, []); // eslint-disable-line react-hooks/exhaustive-deps

const animStyle = useAnimatedStyle(() => ({
  opacity: opacity.value,
  transform: [{ translateY: translateY.value }],
}));
```

**Source:** Pattern composé — `withTiming` chain callback + `setTimeout` pour dismiss auto (D-13, D-14).

### Anti-Patterns à Éviter

- **Rendre les avatars dans `TileMapRenderer`** : le renderer est `pointerEvents="none"`, les taps seraient avalés. **Solution** : siblings absolute-positioned dans `mapContainer`.
- **Utiliser `perspective` dans les transform arrays** : clipping 3D non désiré. **Solution** : pas de perspective Phase 29.
- **Hardcoder `#FFD700` ou autres hex inline** : viole CLAUDE.md. **Solution** : `colors.*` via `useThemeColors()`. Note : `tree.tsx` a une exception constante `GOLD = '#FFD700'` déclarée en module pour styles pixel art — **ne pas étendre** cette pratique, rester sur `colors.success` pour le halo.
- **Oublier `cancelAnimation` quand `isActive` passe de true→false** : le halo continuerait à pulser indéfiniment. **Solution** : appeler `cancelAnimation(haloOpacity)` dans le `useEffect` cleanup ou la branche else.
- **`setTimeout` sans `useRef` pour tooltip dismiss** : le timer persiste après unmount / re-tap et crash. **Solution** : stocker le timer dans un `useRef`, clear à chaque nouveau tap et au cleanup.
- **`useFocusEffect` sans `useCallback`** : la fonction est re-créée à chaque render et re-invoque l'effect inutilement. **Solution** : wrapper dans `useCallback` (pattern `tree.tsx:423-425`).
- **`emoji={profile.avatar ?? '👤'}` pour la section "Membres actifs" `village.tsx:534-553`** : ce n'est PAS hors scope seulement parce que c'est fastidieux — c'est **explicitement hors scope Phase 29** (Deferred Ideas). Le planner doit vérifier qu'aucune tâche ne touche à cette section.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pulse halo loop | Custom `setInterval` + RN `Animated.View` | Reanimated `withRepeat(withTiming, -1, true)` | CLAUDE.md interdit RN Animated, `withRepeat` gère cleanup automatique |
| Sprite companion mapping | Nouveau mapping custom | `COMPANION_SPRITES` déjà dans `CompanionSlot.tsx:95-121` | Dup mapping = risque de désynchro si sprites changent. Extraire dans `lib/mascot/companion-sprites.ts` et consommer des 2 côtés |
| Companion stage derivation | Condition inline `profile.level > 10 ? 'adulte' : ...` | `getCompanionStage(profile.level)` | Déjà dans `companion-engine.ts` avec unit tests — pas de fork |
| Fractional→pixel positioning | Nouveau helper | Inline `slot.x * mapSize.width` (pattern `CompanionSlot.tsx:702-703`) | Trivial, n'a pas besoin d'abstraction |
| Week-start computation | Nouveau filter function | `gardenData.currentWeekStart` déjà exposé par `useGarden()` | Source unique, déjà calculé via `date-fns startOfWeek` |
| Fade screen transition | Custom CSS opacity | `useSharedValue` + `withTiming` + `runOnJS(router.replace)` | Pattern Phase 28 vérifié dans `tree.tsx:407-425` |
| Portal glow loop | Nouveau hook / nouvelle animation | Extraction de `PortalSprite` existant dans `tree.tsx:303-361` | CD-04, évite duplication inévitable |
| Tooltip auto-dismiss | `requestAnimationFrame` loop | `setTimeout` dans `useRef` + cleanup | Simple, zéro dépendance, pattern projet standard |
| Haptic feedback | RN `Vibration` | `Haptics.selectionAsync()` | Convention projet (expo-haptics déjà importé partout) |

**Key insight :** Phase 29 est une phase d'intégration — **tous les patterns existent déjà** dans Phases 10 (CompanionSlot), 25-27 (village), 28 (portail aller). Recréer ce qui existe = risque de désynchro + dette technique. Le planner doit maximiser la réutilisation, au minimum extraire en modules partagés quand deux sites consomment la même logique.

---

## Runtime State Inventory

Phase 29 est une phase d'**ajout de composants UI** (pas rename / refactor / migration). Aucune donnée existante n'est renommée, déplacée, ou modifiée. Cette section est majoritairement non applicable mais documentée explicitement par conservativité :

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — aucun champ vault nouveau, aucune entrée existante modifiée. Les contributions hebdo sont calculées en mémoire à partir de `gardenData.contributions` existant. | Aucune |
| Live service config | None — pas de backend, 100% local. | Aucune |
| OS-registered state | None — pas de tâches planifiées ni services OS. | Aucune |
| Secrets/env vars | None — pas de secret manipulé. | Aucune |
| Build artifacts | **Sprites `assets/garden/animals/{species}/{stage}/idle_{1,2}.png`** déjà packagés (Phase 10). **Sprite `assets/items/portail.png`** déjà packagé (vérifié, 178 KB). Aucun nouveau require() vers un asset manquant. | Aucune — le bundler Metro prend déjà en compte ces assets |

**Rien à migrer.** Phase 29 est additive uniquement.

---

## Common Pitfalls

### Pitfall 1 : Avatars rendus sous le `TileMapRenderer` (invisible) ou à l'intérieur (non-tappable)

**What goes wrong:** Si `<VillageAvatar />` est rendu AVANT `<TileMapRenderer />` dans le JSX, il est masqué par le renderer (z-index normal). Si rendu en child du renderer, il hérite de `pointerEvents="none"` et les taps sont avalés.

**Why it happens:** `TileMapRenderer` utilise `StyleSheet.absoluteFill` et ne gère pas de slot children interactifs.

**How to avoid:** Rendre les avatars APRÈS `<TileMapRenderer />` comme siblings DANS `<View style={styles.mapContainer}>`. Pattern vérifié dans `village.tsx:429-440`.

**Warning signs:** Avatars visibles mais tap non détecté → ils sont children du renderer. Avatars invisibles → ils sont masqués par le renderer, vérifier l'ordre JSX.

### Pitfall 2 : Mapping `COMPANION_SPRITES` dupliqué vs extrait

**What goes wrong:** Si le planner duplique le mapping `COMPANION_SPRITES` dans `VillageAvatar.tsx` au lieu de l'extraire, toute future modification (nouveaux stages, nouvelles espèces) devra être faite à deux endroits — inévitable désynchro.

**Why it happens:** Le mapping est local à `CompanionSlot.tsx:95-121` et fait 27 require() — copier semble plus rapide que refactor.

**How to avoid:** Extraire dans `lib/mascot/companion-sprites.ts` :
```tsx
// lib/mascot/companion-sprites.ts (NOUVEAU)
import type { CompanionSpecies, CompanionStage } from './companion-types';

export const COMPANION_SPRITES: Record<CompanionSpecies, Record<CompanionStage, { idle_1: any; idle_2: any }>> = {
  chat: { /* ... */ },
  // etc.
};
```
Puis `CompanionSlot.tsx` et `VillageAvatar.tsx` importent les deux. Une seule source de vérité.

**Warning signs:** Grep dans le repo → deux définitions de `COMPANION_SPRITES`.

### Pitfall 3 : `useFocusEffect` qui ne reset pas `screenOpacity` côté village

**What goes wrong:** Après `router.replace('/(tabs)/tree')`, l'utilisateur retourne au village via le portail ferme. Si `screenOpacity` n'est pas reset à 1 au focus, l'écran village reste invisible (opacity 0 du fade précédent).

**Why it happens:** `useSharedValue` persiste entre navigations si le composant est préservé par expo-router (écran tab persistant).

**How to avoid:** Ajouter dans `village.tsx` (symétrique à `tree.tsx:422-425`) :
```tsx
useFocusEffect(useCallback(() => {
  screenOpacity.value = 1;
}, [screenOpacity]));
```

**Warning signs:** Retour au village après aller-retour = écran blanc/invisible.

### Pitfall 4 : Tooltip timer ref non cleared au unmount ou re-tap

**What goes wrong:** Le `setTimeout` reste actif après unmount → `setState` sur composant démonté → warning React, voire crash.

**How to avoid:** Stocker le timer dans `useRef<NodeJS.Timeout | null>(null)`, clear avant chaque nouveau tap et dans le cleanup `useEffect`.

```tsx
const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const showTooltip = useCallback((profile, slot) => {
  if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  setTooltip({ profileId: profile.id, x: slot.x * mapSize.width, y: slot.y * mapSize.height });
  dismissTimerRef.current = setTimeout(() => setTooltip(null), 2500);
}, [mapSize]);

useEffect(() => () => {
  if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
}, []);
```

**Warning signs:** Dev warning "Can't perform a React state update on an unmounted component".

### Pitfall 5 : Calcul de `weeklyContribs` basé sur `Date.now()` au lieu de `currentWeekStart`

**What goes wrong:** Si le planner calcule "actif cette semaine" comme `timestamp > Date.now() - 7*86400000` au lieu de `timestamp >= gardenData.currentWeekStart`, la semaine "glisse" (dernière 7 jours rolling) au lieu de commencer au lundi — désynchro avec la barre de progression village et les rewards hebdo.

**Why it happens:** `Date.now() - 7d` est plus "naturel" mais faux pour la sémantique village (semaine ISO lundi→dimanche).

**How to avoid:** Utiliser exactement `gardenData.currentWeekStart` comme borne min (format `YYYY-MM-DD`) :
```tsx
const weeklyContribs = useMemo(() => {
  const weekStart = gardenData?.currentWeekStart;
  if (!weekStart) return {};
  const map: Record<string, number> = {};
  for (const c of gardenData.contributions ?? []) {
    // timestamp format: ISO 8601 sans Z ex '2026-04-10T14:32:00'
    if (c.timestamp >= weekStart) {
      map[c.profileId] = (map[c.profileId] ?? 0) + c.amount;
    }
  }
  return map;
}, [gardenData?.contributions, gardenData?.currentWeekStart]);
```
Comparaison string ISO est correcte car format YYYY-MM-DD trié lexico = trié temporellement.

**Warning signs:** User rapporte "Lucas apparaît actif alors qu'il n'a rien fait cette semaine" (il a fait la semaine dernière).

### Pitfall 6 : Slot 4/5 ou portail qui déborde hors `mapContainer`

**What goes wrong:** Sprites rendus à `slot.x * width - size/2` au bord droit (0.85) peuvent clipper si `size/2 > width - slot.x*width`. Tooltip de largeur 200px à l'avatar le plus à droite (0.65 = slot_1) déborde hors écran.

**How to avoid:** Contraindre les positions avec margin interne :
- Sprites : `left = Math.max(SPRITE_HALF, Math.min(mapSize.width - SPRITE_HALF, slot.x * mapSize.width - SPRITE_HALF))`
- Tooltip : pattern `CompanionSlot.tsx:751-759` — si `bubbleRight > containerWidth - margin`, décaler vers la gauche.

**Warning signs:** Sprite coupé au bord, tooltip partiellement off-screen.

### Pitfall 7 : Remplacement `<Text>🏛️</Text>` par `<Image>` sans ajuster styles

**What goes wrong:** `styles.portalEmoji` = `{ fontSize: 28 }` (tree.tsx:3032) — ne fonctionne pas pour une `<Image>`. Sans `width`/`height` explicite, l'image se rend à sa taille native (peut-être 64px ou 128px, trop grande).

**How to avoid:** Créer `styles.portalImage` avec dimensions explicites :
```tsx
portalImage: {
  width: 40,        // ou 48/56 selon test device (CD-05)
  height: 40,
  resizeMode: 'contain',
},
```
Et remplacer `<Text style={styles.portalEmoji}>{'🏛️'}</Text>` par `<Image source={require('@/assets/items/portail.png')} style={styles.portalImage} />`. Mettre à jour aussi `styles.portalContainer` si besoin (actuellement 56×56, peut rester).

**Warning signs:** Portail immense qui envahit la ferme, ou tiny invisible selon dimensions natives du PNG.

### Pitfall 8 : `cancelAnimation` absent sur passage actif→inactif

**What goes wrong:** Un profil devient inactif (contribution supprimée via rollback hypothétique, ou simple edge case test) — le halo continue à pulser car `withRepeat(-1)` ignore le démontage si l'élément `<Animated.View>` reste dans le tree.

**How to avoid:** Dans `VillageAvatar.tsx`, gérer explicitement :
```tsx
useEffect(() => {
  if (isActive) {
    haloOpacity.value = withRepeat(withTiming(0.8, { duration: 2000 }), -1, true);
  } else {
    cancelAnimation(haloOpacity);
    haloOpacity.value = 0;
  }
  return () => cancelAnimation(haloOpacity);
}, [isActive, haloOpacity]);
```

**Warning signs:** Halo qui continue à pulser après que le profil devient inactif.

### Pitfall 9 : Collision slot avatar avec stall/fountain/board existants

**What goes wrong:** Les slots proposés (0.35/0.40, etc.) sont visuels mais pas testés contre les anchors existants. Exemple : slot `0.40/0.72` pourrait chevaucher avec `village_stall_0` à `0.22/0.65`.

**How to avoid:** Le planner doit soit :
1. Tester sur device physique et ajuster les coordonnées (CD-02).
2. OU calculer la distance minimale entre slots : `sqrt((x1-x2)² + (y1-y2)²) * mapSize.width > SPRITE_HALF + OTHER_HALF + 8px` pour chaque paire.

Calcul rapide : slot_4 (0.40, 0.72) vs stall_0 (0.22, 0.65) → distance = sqrt(0.18² + 0.07²) × ~390px ≈ 75px. OK pour sprites 32px + 32px = 64px requis. Marge de 11px. **Acceptable mais serré.**

**Warning signs:** Sprites qui se chevauchent à l'œil nu sur device.

---

## Code Examples

### Exemple 1 : VillageAvatar complet (pattern à dupliquer)

```tsx
// components/village/VillageAvatar.tsx — NOUVEAU
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { getCompanionStage } from '../../lib/mascot/companion-engine';
import { COMPANION_SPRITES } from '../../lib/mascot/companion-sprites'; // extraction recommandée
import type { Profile } from '../../lib/types';

const AVATAR_SIZE = 32;
const HALO_PAD = 6;
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
const FRAME_MS = 500;

interface VillageAvatarProps {
  profile: Profile;
  slotX: number;              // déjà calculé en px
  slotY: number;              // déjà calculé en px
  isActive: boolean;
  onPress: () => void;
}

export const VillageAvatar = React.memo(function VillageAvatar({
  profile,
  slotX,
  slotY,
  isActive,
  onPress,
}: VillageAvatarProps) {
  const { colors } = useThemeColors();
  const haloOpacity = useSharedValue(0);
  const [frameIdx, setFrameIdx] = useState<0 | 1>(0);

  // Pulse halo si actif
  useEffect(() => {
    if (isActive) {
      haloOpacity.value = withRepeat(
        withTiming(0.8, { duration: 2000 }),
        -1,
        true,
      );
    } else {
      cancelAnimation(haloOpacity);
      haloOpacity.value = 0;
    }
    return () => cancelAnimation(haloOpacity);
  }, [isActive, haloOpacity]);

  // Alternance respiration idle_1/idle_2
  useEffect(() => {
    const timer = setTimeout(() => setFrameIdx(f => (f === 0 ? 1 : 0)), FRAME_MS);
    return () => clearTimeout(timer);
  }, [frameIdx]);

  const haloStyle = useAnimatedStyle(() => ({ opacity: haloOpacity.value }));

  // Skip si pas de compagnon (D-03)
  if (!profile.companion) return null;

  const species = profile.companion.activeSpecies;
  const stage = getCompanionStage(profile.level);
  const sprites = COMPANION_SPRITES[species][stage];
  const currentSprite = frameIdx === 0 ? sprites.idle_1 : sprites.idle_2;

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <View
      style={[
        styles.slot,
        { left: slotX - (AVATAR_SIZE + HALO_PAD) / 2, top: slotY - (AVATAR_SIZE + HALO_PAD) / 2 },
      ]}
      pointerEvents="box-none"
    >
      {isActive && (
        <Animated.View
          style={[
            styles.halo,
            {
              backgroundColor: colors.success,
              width: AVATAR_SIZE + HALO_PAD,
              height: AVATAR_SIZE + HALO_PAD,
              borderRadius: (AVATAR_SIZE + HALO_PAD) / 2,
            },
            haloStyle,
          ]}
          pointerEvents="none"
        />
      )}
      <Pressable
        onPress={handlePress}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={`${profile.name}, ${isActive ? 'actif' : 'inactif'} cette semaine`}
        style={styles.press}
      >
        <Animated.Image
          source={currentSprite}
          style={[
            styles.sprite,
            { width: AVATAR_SIZE, height: AVATAR_SIZE },
            !isActive && styles.inactive,
          ]}
          resizeMode="contain"
        />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
  press: {
    padding: 2,
  },
  sprite: {
    // pixel art — pas de smoothing (si disponible sur la plateforme)
  },
  inactive: {
    opacity: 0.55,
  },
});
```

**Source:** Composition de `CompanionSlot.tsx:695-820` (alternance idle + structure) + `tree.tsx:303-361` (pattern glow loop Reanimated) + conventions CLAUDE.md (React.memo, Haptics).

### Exemple 2 : AvatarTooltip

```tsx
// components/village/AvatarTooltip.tsx — NOUVEAU
import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

const DISMISS_MS = 2500;
const ENTER_MS = 180;
const EXIT_MS = 150;
const MAX_WIDTH = 200;

interface AvatarTooltipProps {
  profileName: string;
  count: number;
  x: number;          // position px de l'avatar
  y: number;          // position px de l'avatar
  containerWidth: number;
  onDismiss: () => void;
}

export function AvatarTooltip({
  profileName,
  count,
  x,
  y,
  containerWidth,
  onDismiss,
}: AvatarTooltipProps) {
  const { colors } = useThemeColors();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-4);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: ENTER_MS });
    translateY.value = withTiming(0, { duration: ENTER_MS });

    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: EXIT_MS });
      translateY.value = withTiming(-4, { duration: EXIT_MS }, (finished) => {
        if (finished) runOnJS(onDismiss)();
      });
    }, DISMISS_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Recaler si déborde à droite
  const rawLeft = x - MAX_WIDTH / 2;
  const clampedLeft = Math.max(
    Spacing.md,
    Math.min(containerWidth - MAX_WIDTH - Spacing.md, rawLeft),
  );

  const label =
    count > 0
      ? `${profileName} — ${count} contribution${count > 1 ? 's' : ''} cette semaine`
      : `${profileName} — pas encore contribué`;

  return (
    <Animated.View
      style={[
        styles.tooltip,
        {
          left: clampedLeft,
          top: y - 48,
          backgroundColor: colors.card,
        },
        style,
      ]}
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLabel={`Tooltip ${profileName}`}
    >
      <Text
        style={[styles.text, { color: count > 0 ? colors.text : colors.textMuted }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    maxWidth: MAX_WIDTH,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  text: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.normal,
  },
});
```

### Exemple 3 : PortalSprite partagé (extraction de tree.tsx:303-361)

```tsx
// components/village/PortalSprite.tsx — NOUVEAU (extraction)
import React, { useCallback, useEffect } from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Radius } from '../../constants/spacing';

const SPRING_PORTAL = { damping: 12, stiffness: 200 } as const;
const PORTAL_SIZE = 48;

interface PortalSpriteProps {
  onPress: () => void;
  /** Optionnel — si fourni, rend en absolute à cette position. Sinon styles externes. */
  x?: number;
  y?: number;
  accessibilityLabel?: string;
}

export function PortalSprite({
  onPress,
  x,
  y,
  accessibilityLabel = 'Portail',
}: PortalSpriteProps) {
  const { colors } = useThemeColors();
  const glowOpacity = useSharedValue(0.4);
  const scaleAnim = useSharedValue(1);

  useEffect(() => {
    glowOpacity.value = withRepeat(withTiming(0.8, { duration: 1200 }), -1, true);
  }, [glowOpacity]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    scaleAnim.value = withSpring(0.92, SPRING_PORTAL, () => {
      scaleAnim.value = withSpring(1, SPRING_PORTAL);
    });
    onPress();
  }, [scaleAnim, onPress]);

  const positionStyle =
    x !== undefined && y !== undefined
      ? { position: 'absolute' as const, left: x - PORTAL_SIZE / 2, top: y - PORTAL_SIZE / 2 }
      : {};

  return (
    <Animated.View
      style={[styles.container, positionStyle, containerStyle]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          styles.glow,
          { backgroundColor: colors.catJeux },
          glowStyle,
        ]}
        pointerEvents="none"
      />
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={1}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={accessibilityLabel}
      >
        <Image
          source={require('../../assets/items/portail.png')}
          style={styles.sprite}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: PORTAL_SIZE + 8,
    height: PORTAL_SIZE + 8,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  glow: {
    borderRadius: Radius.xl,
  },
  sprite: {
    width: PORTAL_SIZE,
    height: PORTAL_SIZE,
  },
});
```

**Source:** Réécriture de `tree.tsx:303-361` + styles `:3018-3034` avec ajout prop `x, y` pour positionnement absolu optionnel (ferme = position fixe styles existants, village = position calculée via slot).

### Exemple 4 : Extension `VILLAGE_GRID`

```tsx
// lib/village/grid.ts — MODIFIÉ
import type { VillageCell } from './types';

export const VILLAGE_GRID: VillageCell[] = [
  // Phase 25 — existing
  { id: 'village_fountain', x: 0.50, y: 0.45, role: 'fountain' },
  { id: 'village_stall_0',  x: 0.22, y: 0.65, role: 'stall' },
  { id: 'village_stall_1',  x: 0.78, y: 0.65, role: 'stall' },
  { id: 'village_board',    x: 0.15, y: 0.25, role: 'board' },

  // Phase 29 — avatars (D-04, D-06)
  { id: 'village_avatar_slot_0', x: 0.35, y: 0.40, role: 'avatar' },
  { id: 'village_avatar_slot_1', x: 0.65, y: 0.40, role: 'avatar' },
  { id: 'village_avatar_slot_2', x: 0.30, y: 0.55, role: 'avatar' },
  { id: 'village_avatar_slot_3', x: 0.70, y: 0.55, role: 'avatar' },
  { id: 'village_avatar_slot_4', x: 0.40, y: 0.72, role: 'avatar' },
  { id: 'village_avatar_slot_5', x: 0.60, y: 0.72, role: 'avatar' },

  // Phase 29 — portail retour (D-18)
  { id: 'village_portal_home', x: 0.85, y: 0.85, role: 'portal' },
];
```

### Exemple 5 : Extension `VillageRole`

```tsx
// lib/village/types.ts — MODIFIÉ (une seule ligne)
export type VillageRole = 'fountain' | 'stall' | 'board' | 'portal' | 'avatar';
```

**Note:** `'portal'` existe déjà dans le type (lu ligne 6). Seul `'avatar'` est ajouté.

### Exemple 6 : Intégration dans `village.tsx` (snippet des changements)

```tsx
// village.tsx — ajouts/modifications
import { VillageAvatar } from '../../components/village/VillageAvatar';
import { AvatarTooltip } from '../../components/village/AvatarTooltip';
import { PortalSprite } from '../../components/village/PortalSprite';
import { VILLAGE_GRID } from '../../lib/village/grid';
import { Easing } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';

// Dans VillageScreen()
const screenOpacity = useSharedValue(1);
const fadeStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));

const [tooltip, setTooltip] = useState<{
  profileName: string;
  count: number;
  x: number;
  y: number;
} | null>(null);
const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// Memo contributions de la semaine courante (distinct de memberContribs global)
const weeklyContribs = useMemo(() => {
  const weekStart = gardenData?.currentWeekStart;
  if (!weekStart) return {};
  const map: Record<string, number> = {};
  for (const c of gardenData.contributions ?? []) {
    if (c.timestamp >= weekStart) {
      map[c.profileId] = (map[c.profileId] ?? 0) + c.amount;
    }
  }
  return map;
}, [gardenData?.contributions, gardenData?.currentWeekStart]);

// Tri alphabétique déterministe (D-07)
const sortedActiveProfiles = useMemo(
  () => [...activeProfiles].sort((a, b) => a.id.localeCompare(b.id)),
  [activeProfiles],
);

// Slots avatars + portail home
const avatarSlots = useMemo(
  () => VILLAGE_GRID.filter(c => c.role === 'avatar'),
  [],
);
const portalSlot = useMemo(
  () => VILLAGE_GRID.find(c => c.id === 'village_portal_home'),
  [],
);

const handleAvatarPress = useCallback((profile: Profile, slotX: number, slotY: number) => {
  if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  const count = weeklyContribs[profile.id] ?? 0;
  setTooltip({ profileName: profile.name, count, x: slotX, y: slotY });
  dismissTimerRef.current = setTimeout(() => setTooltip(null), 2500);
}, [weeklyContribs]);

useEffect(() => () => {
  if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
}, []);

const handleReturnPortalPress = useCallback(() => {
  screenOpacity.value = withTiming(
    0,
    { duration: 400, easing: Easing.out(Easing.ease) },
    (finished) => {
      if (finished) runOnJS(router.replace)('/(tabs)/tree' as any);
    },
  );
}, [screenOpacity, router]);

useFocusEffect(useCallback(() => {
  screenOpacity.value = 1;
}, [screenOpacity]));

// Dans le JSX — wrapper le root avec fadeStyle
return (
  <Animated.View style={[styles.root, { backgroundColor: colors.bg }, fadeStyle]}>
    {/* Header SANS backBtn (D-19) — juste le titre centré */}
    <View style={[styles.header, { paddingTop: insets.top, /* ... */ }]}>
      <Text style={[styles.headerTitle, { color: colors.text }]}>Place du Village</Text>
    </View>

    <ScrollView /* ... */>
      <View style={[styles.mapContainer, { height: MAP_HEIGHT }]} onLayout={handleMapLayout}>
        <TileMapRenderer /* ... */ />

        {/* Overlay avatars */}
        {sortedActiveProfiles.slice(0, 6).map((profile, idx) => {
          const slot = avatarSlots[idx];
          if (!slot || !profile.companion) return null;
          const slotX = slot.x * mapSize.width;
          const slotY = slot.y * mapSize.height;
          return (
            <VillageAvatar
              key={profile.id}
              profile={profile}
              slotX={slotX}
              slotY={slotY}
              isActive={(weeklyContribs[profile.id] ?? 0) > 0}
              onPress={() => handleAvatarPress(profile, slotX, slotY)}
            />
          );
        })}

        {/* Portail retour */}
        {portalSlot && (
          <PortalSprite
            onPress={handleReturnPortalPress}
            x={portalSlot.x * mapSize.width}
            y={portalSlot.y * mapSize.height}
            accessibilityLabel="Retour à la ferme"
          />
        )}

        {/* Tooltip conditionnel */}
        {tooltip && (
          <AvatarTooltip
            profileName={tooltip.profileName}
            count={tooltip.count}
            x={tooltip.x}
            y={tooltip.y}
            containerWidth={mapSize.width}
            onDismiss={() => setTooltip(null)}
          />
        )}
      </View>
      {/* Reste du scroll inchangé */}
    </ScrollView>
  </Animated.View>
);
```

**Note:** Suppression de `styles.backBtn`, `styles.backArrow`, `styles.headerSpacer` et leur usage. Header devient minimal avec titre centré.

### Exemple 7 : Remplacement dans `tree.tsx:357`

```tsx
// tree.tsx — ligne 357 : dans PortalSprite ou après refacto vers import partagé

// AVANT
<Text style={styles.portalEmoji}>{'🏛️'}</Text>

// APRÈS (option A — inline, garder PortalSprite local)
<Image
  source={require('../../assets/items/portail.png')}
  style={styles.portalImage}
  resizeMode="contain"
/>

// AVANT en styles
portalEmoji: {
  fontSize: 28,
},

// APRÈS en styles
portalImage: {
  width: 40,
  height: 40,
},
```

**Option B (recommandée CD-04) :** Supprimer le `PortalSprite` local de `tree.tsx` et importer `import { PortalSprite } from '@/components/village/PortalSprite'`. Usage inchangé à la ligne 2129-2130. Supprimer aussi les 3 styles `portalContainer/portalGlow/portalEmoji` inutilisés.

---

## State of the Art

| Old Approach (pré-Phase 29) | Current Approach | When Changed | Impact |
|------------------------------|------------------|--------------|--------|
| `<Text>🏛️</Text>` emoji portail | `<Image source={portail.png} />` pixel art | Phase 29 D-17 | Cohérence pixel art milestone v1.5 |
| Bouton header `‹` retour village | Portail unique bidirectionnel | Phase 29 D-19 | Symétrie narrative avec Phase 28 |
| `ReactiveAvatar` emoji pour carte village | `VillageAvatar` sprite compagnon pixel | Phase 29 D-01/D-02 | Signal fort identité visuelle v1.5 |
| `memberContribs` (total global par profil) | `weeklyContribs` (filtré par `currentWeekStart`) | Phase 29 VILL-02 | Nouvelle sémantique "actif cette semaine" |

**Deprecated/outdated (dans ce phase) :**
- **Styles `portalEmoji`** : remplacés par `portalImage` avec dimensions explicites.
- **`styles.backBtn`, `styles.backArrow`, `styles.headerSpacer`** dans `village.tsx:634-652` : supprimés avec la suppression du bouton retour header (D-19).
- **`PortalSprite` local dans `tree.tsx:303-361`** : remplacé par import depuis `components/village/PortalSprite.tsx` (si le planner accepte CD-04).

---

## Open Questions

### Q1: Faut-il extraire `COMPANION_SPRITES` dans un module partagé ou dupliquer ?

- **What we know:** Le mapping fait 15 sprites (5 espèces × 3 stades, 2 frames chacun = 30 require()). Il est actuellement local à `CompanionSlot.tsx:95-121`.
- **What's unclear:** Le temps/coût de l'extraction vs bénéfice mainteneur. Extraction = une nouvelle file `lib/mascot/companion-sprites.ts`, 1 touch `CompanionSlot.tsx` pour importer, 1 usage `VillageAvatar.tsx`.
- **Recommandation:** **Extraire.** Coût trivial (~15 min), bénéfice clair (source unique de vérité, pas de désynchro future quand de nouveaux stages/sprites seront ajoutés). Le planner devrait en faire une tâche dédiée de la Wave 1.

### Q2: PortalSprite extraction (CD-04) — duplication ou mutualisation ?

- **What we know:** Le composant fait ~60 lignes (fonction + styles). Il est local à `tree.tsx:303-361` et `:3018-3034`.
- **What's unclear:** Coût réel du refacto cross-file.
- **Recommandation:** **Mutualiser dans `components/village/PortalSprite.tsx`.** Coût ~20 min, bénéfice = seul endroit à modifier si le sprite ou l'animation change + la prop `x, y` optionnelle facilite les deux usages (fixe côté ferme, positionné côté village). C'est CD-04 et déjà la recommandation forte de CONTEXT.md.

### Q3: Coordonnées fines du slot `village_portal_home` (CD-03)

- **What we know:** Proposition `(0.85, 0.85)` — col 10.2, row 17 (zone farmland/grass au bord bas-droit cobblestone, ne chevauche aucune cellule de water/dirt sensible).
- **What's unclear:** Si le rendu visuel à cette position "se voit" assez bien ou est perdu dans le coin.
- **Recommandation:** Accepter `(0.85, 0.85)` pour le MVP, permettre ajustement dans une tâche de polish Wave 2 si le test device montre que c'est caché. Alternative : `(0.80, 0.82)` plus centré dans la zone cobblestone.

### Q4: Dimensions exactes des sprites (CD-05)

- **What we know:** Recommandations 24-32px compagnons, 40-56px portails.
- **What's unclear:** Quelle taille exacte est optimale sur device physique — dépend du DPR et de la taille d'écran testée.
- **Recommandation:** Commencer à `32px` avatars et `48px` portail (milieu de fourchette), ajuster après run device si un membre de la famille rapporte "trop petit" ou "envahissant".

### Q5: Y a-t-il un risque que `sortedActiveProfiles.sort()` mute `activeProfiles` ?

- **What we know:** `[...activeProfiles].sort(...)` crée une copie avant le tri — safe.
- **What's unclear:** Rien. C'est un pattern correct.
- **Recommandation:** Accepter, le planner doit vérifier qu'aucun spread est oublié.

---

## Environment Availability

Phase 29 est une phase UI pure avec zéro nouvelle dépendance. Toutes les dépendances requises sont déjà installées et validées lors de milestones précédents.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `react-native-reanimated` | Toutes animations Phase 29 | ✓ | ~4.1 | — |
| `expo-router` | `useRouter`, `useFocusEffect`, `router.replace` | ✓ | v6 | — |
| `expo-haptics` | `Haptics.selectionAsync()` | ✓ | installé | — |
| `react-native-safe-area-context` | `useSafeAreaInsets` (déjà utilisé) | ✓ | installé | — |
| `assets/items/portail.png` | D-16, D-17 — portail symétrique | ✓ | 178 KB | — |
| `assets/garden/animals/*/{bebe,jeune,adulte}/idle_{1,2}.png` | D-01 — sprites compagnons | ✓ | 30 fichiers | — |
| Node / npm / iOS simulator | Build dev | ✓ | — | — |
| TypeScript (`npx tsc --noEmit`) | Type check pré-commit | ✓ | — | — |

**Missing dependencies with no fallback:** Aucune.

**Missing dependencies with fallback:** Aucune.

**Vérification assets:**
```
assets/items/ :
  balancoire.png, cabane.png, couronne.png, cristal.png, fontaine.png,
  guirlandes.png, hamac.png, lanterne.png, nid.png, portail.png ✓
assets/garden/animals/ :
  chat, chien, lapin, renard, herisson (+ autres non-compagnons) ✓
```

---

## Plan Breakdown Suggestion

**Recommandation planner : 2 plans, 2 waves chacun, structure incrémentale et testable.**

### Plan 01 — Data layer + composant avatar
**Wave 0 (optionnel) :** Création du dossier `components/village/` et extraction de `COMPANION_SPRITES` dans `lib/mascot/companion-sprites.ts`.

**Wave 1 :**
- T1.1 — Étendre `VillageRole` avec `'avatar'` (`lib/village/types.ts` — 1 ligne)
- T1.2 — Étendre `VILLAGE_GRID` avec 6 avatar slots + 1 portal slot (`lib/village/grid.ts` — 7 entrées)
- T1.3 — Créer `components/village/VillageAvatar.tsx` (pattern exemple 1)
- T1.4 — Créer `components/village/AvatarTooltip.tsx` (pattern exemple 2)

**Wave 2 :**
- T2.1 — Ajouter dans `village.tsx` : `weeklyContribs` memo, `sortedActiveProfiles` memo, `avatarSlots` memo, `tooltip` state, `dismissTimerRef`, `handleAvatarPress` callback
- T2.2 — Ajouter l'overlay avatars + tooltip dans le JSX `mapContainer`
- T2.3 — TSC check + run iOS device pour ajuster coordonnées slots (CD-02)

**Requirements couverts:** VILL-01, VILL-02, VILL-03

### Plan 02 — Portail retour + transition fade
**Wave 1 :**
- T1.1 — Créer `components/village/PortalSprite.tsx` par extraction (pattern exemple 3)
- T1.2 — Modifier `tree.tsx` : importer `PortalSprite` depuis `components/village`, supprimer la fonction locale (lignes 303-361), supprimer styles `portalContainer/portalGlow/portalEmoji`. Le consommateur ligne 2129-2130 est inchangé dans l'API.
- T1.3 — Vérifier build iOS ferme sans régression (portail ferme fonctionne identique avec sprite pixel art)

**Wave 2 :**
- T2.1 — Dans `village.tsx` : ajouter `screenOpacity`, `fadeStyle`, `handleReturnPortalPress`, `useFocusEffect` reset
- T2.2 — Supprimer `styles.backBtn`, `styles.backArrow`, `styles.headerSpacer` + le `<TouchableOpacity styles.backBtn>` JSX lignes 407-418 (garder uniquement le titre)
- T2.3 — Ajouter `<PortalSprite />` dans le `mapContainer` overlay
- T2.4 — Wrapper le root avec `<Animated.View style={fadeStyle}>`
- T2.5 — TSC check + run iOS ping-pong ferme→village→ferme pour valider fade 400ms symétrique

**Requirements couverts:** VILL-11, VILL-12

**Dépendance:** Plan 02 peut techniquement démarrer avant Plan 01 (pas de couplage). Mais commencer par Plan 01 (avatars) apporte la valeur UX principale en premier.

**Rationale découpage :** Deux plans séparés car (a) les avatars et le portail touchent des zones distinctes de `village.tsx`, (b) le remplacement emoji→sprite de `tree.tsx:357` est un risque de régression isolé qui mérite d'être validé indépendamment, (c) 4 waves totales restent gérables en une session dev.

**Alternative 1 plan :** Possible si le user préfère un mega-plan, mais perd la granularité commit/rollback.

---

## Sources

### Primary (HIGH confidence) — fichiers vérifiés en lecture directe

- `.planning/phases/29-avatars-vivants-portail-retour/29-CONTEXT.md` — Décisions utilisateur locked
- `.planning/phases/29-avatars-vivants-portail-retour/29-UI-SPEC.md` — Contrat visuel locked
- `.planning/phases/29-avatars-vivants-portail-retour/29-DISCUSSION-LOG.md` — Historique Q&A
- `.planning/REQUIREMENTS.md` — Définition VILL-01..12
- `.planning/ROADMAP.md` — Goal + Success Criteria Phase 29
- `.planning/STATE.md` — Décisions accumulées projet
- `CLAUDE.md` — Conventions projet (stack, animations, tokens, FR)
- `app/(tabs)/village.tsx` — 833 lignes, état actuel écran village (Phase 27)
- `app/(tabs)/tree.tsx:280-440` — Composant `PortalSprite` existant + handler fade Phase 28
- `app/(tabs)/tree.tsx:3018-3034` — Styles portalContainer/portalGlow/portalEmoji
- `lib/village/types.ts` — Type `VillageRole`, `VillageCell`, `VillageContribution`, `VillageData`
- `lib/village/grid.ts` — `VILLAGE_GRID` actuel (4 entrées)
- `lib/mascot/farm-map.ts:145-200` — `buildVillageMap()` hardcodé (ne consomme PAS VILLAGE_GRID)
- `lib/mascot/companion-engine.ts:22-29` — `getCompanionStage(level)`
- `lib/mascot/companion-types.ts:1-53` — Types CompanionSpecies, Stage, Data
- `components/mascot/CompanionSlot.tsx:85-120` — Mapping `COMPANION_SPRITES`
- `components/mascot/CompanionSlot.tsx:700-748` — Pattern alternance idle_1/idle_2 + overlay absolute
- `components/ui/ReactiveAvatar.tsx:1-50` — Confirmation signature `emoji: string` (emoji-only)
- `components/mascot/TileMapRenderer.tsx:1-80, 535-540` — Mode village + `buildVillageMap` consommé
- `hooks/useGarden.ts:1-80` — API (`gardenData`, `currentWeekStart`, etc.)
- `lib/types.ts:68-110` — `Profile` interface avec `id`, `name`, `statut`, `level`, `companion`
- `assets/items/` — Listing direct : `portail.png` (178.9K) confirmé présent
- `assets/garden/animals/` — 5 espèces compagnons confirmées (chat, chien, lapin, renard, herisson)
- `.planning/config.json` — Config workflow (nyquist_validation: false → pas de section Validation Architecture)

### Secondary (MEDIUM confidence)

- `components/mascot/CompanionSlot.tsx:750-820` — Pattern bulle clamping au bord (référence pour `AvatarTooltip` overflow handling) — code lu mais non exhaustivement testé

### Tertiary (LOW confidence)

- Aucune source LOW dans cette recherche. Tout a été vérifié en lecture directe du code. Les seules assomptions restantes sont des valeurs visuelles (tailles sprites, opacités exactes) qui sont **intentionnellement** Claude's Discretion et peuvent être tunées après test device.

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — toutes les dépendances vérifiées dans `CLAUDE.md` + lecture directe des imports village.tsx / tree.tsx
- Architecture: **HIGH** — pattern overlay absolute vérifié dans `CompanionSlot.tsx` et `village.tsx` existants ; pattern fade transition vérifié dans `tree.tsx:407-425`
- Pitfalls: **HIGH** — identifiés par lecture directe du code (Pitfall 1 TileMapRenderer pointerEvents none, Pitfall 7 styles `portalEmoji` fontSize incompatible Image, Pitfall 5 week-start semantics)
- Plan breakdown: **HIGH** — basé sur la granularité réelle des modifications fichier par fichier

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (30 jours — projet stable, aucun changement de stack prévu avant Phase 30+)

**What might I have missed?**
- Le comportement de `<Animated.Image>` sur iOS avec pixel art et DPR scaling — non vérifié à la compilation mais `CompanionSlot.tsx` utilise déjà `<Image>` natif avec succès, donc le risque est faible.
- Le cas où un nouveau profil est ajouté pendant que le tooltip est ouvert (le state tooltip référence un `profileId` qui n'est plus à la même position après re-tri). Impact minime : le tooltip finit sa dismiss animation, se démonte. Acceptable.
- Si un profil est supprimé, son avatar disparaît — mais s'il a des contributions dans `gardenData.contributions` avec son `profileId`, ces contributions restent comptées dans le total global mais pas affichées sur un avatar. Non-breaking.
