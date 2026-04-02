# Phase 11: Sagas Immersives - Research

**Researched:** 2026-04-03
**Domain:** React Native pixel art character animation, diorama scene integration, RPG-style dialogue systems
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Un seul personnage visiteur pixel art "voyageur mystérieux" pour toutes les sagas — généré via PixelLab MCP (create_character). Variations subtiles par saga (accessoire ou palette) gérées côté code (tint/overlay), pas des sprites séparés
- **D-02:** Le personnage est généré en pixel art style cohérent avec les sprites Mana Seed existants (16x16 ou 32x32 base, rendu agrandi) — il doit s'intégrer visuellement au diorama
- **D-03:** Le personnage a au minimum 3 directions de vue : face, gauche (walk), droite (walk miroir via scaleX) — réutilise le pattern AnimatedAnimal existant
- **D-04:** Le personnage vit dans la scène du diorama comme un élément du monde, PAS comme un overlay UI — il est au même niveau z que les inhabitants/compagnon
- **D-05:** Tap direct sur le personnage dans la scène pour ouvrir le dialogue — style Animal Crossing. Le personnage affiche un indicateur visuel "!" (bulle d'exclamation animée) au-dessus de sa tête quand un chapitre est disponible
- **D-06:** Le dialogue s'ouvre comme un bottom sheet ou une bulle narrative ancrée au personnage (réutiliser/adapter le pattern SagaWorldEvent existant) — PAS une navigation vers un autre écran
- **D-07:** Les choix narratifs sont présentés dans le dialogue (cards slide-in existantes dans SagaWorldEvent) — même mécanique de sélection, mais déclenchée par le tap sur le personnage plutôt qu'automatiquement
- **D-08:** Arrivée : le personnage marche depuis le bord droit de la scène et s'installe à un point fixe près de l'arbre (côté droit, à côté du CompanionSlot). Animation de marche via frames walk + translateX spring
- **D-09:** Idle : une fois installé, le personnage a une animation idle subtile (léger bounce ou balancement) + bulle "!" pulsante
- **D-10:** Départ : après complétion du chapitre quotidien, le personnage repart en marchant vers le bord, avec un petit wave/salut. Si c'est le dernier chapitre (saga terminée), animation spéciale plus dramatique (flash + disparition étoilée)
- **D-11:** Le personnage n'apparaît QUE quand un chapitre de saga est disponible (status 'active' + pas encore joué aujourd'hui). Sinon il est absent de la scène
- **D-12:** Supprimer entièrement la carte saga de DashboardGarden.tsx — plus de boutons, plus de carte dédiée
- **D-13:** Remplacer par un texte inline discret dans la section jardin : "🌟 Un visiteur attend près de ton arbre..." avec un tap qui navigue vers l'écran arbre. Si chapitre déjà fait aujourd'hui : "Suite de la saga demain..." Si pas de saga active : rien
- **D-14:** Le texte indicateur montre aussi la progression compacte (ex: "Chapitre 2/4 — Le Voyageur d'Argent")
- **D-15:** SagaWorldEvent.tsx est refactoré mais pas supprimé — il devient le système de dialogue/bulle narrative, déclenché par le tap sur le visiteur au lieu d'être un overlay automatique
- **D-16:** L'esprit emoji (spiritGlow) est remplacé par le sprite du personnage visiteur — le reste du système (typewriter, choix cards, trait flash, cliffhanger) est conservé

### Claude's Discretion

- Position exacte du visiteur dans le viewBox TreeView (coordonnées cx/cy)
- Timing exact des animations (durées spring, delays)
- Design exact de la bulle "!" (taille, couleur, animation)
- Adaptation responsive du positionnement
- Détails du prompt PixelLab pour la génération du personnage

### Deferred Ideas (OUT OF SCOPE)

- Personnages multiples : Un personnage différent par saga (nécessiterait 4+ générations PixelLab)
- Dialogues IA : Narratif saga généré/adapté par Claude en temps réel
- Mini-cutscene : Animation type RPG avec camera pan sur le personnage à l'arrivée
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAG-01 | Un personnage visiteur pixel (généré via PixelLab) apparaît dans la scène de l'arbre quand une saga est active, avec animation d'arrivée | VisitorSlot component, PixelLab generation, walk-in animation via translateX spring |
| SAG-02 | Taper sur le visiteur ouvre un dialogue narratif interactif avec les choix de la saga (style RPG/Animal Crossing) | SagaWorldEvent refactor: tap-triggered instead of auto, spiritGlow → visitor sprite |
| SAG-03 | Le dashboard affiche un indicateur texte compact de la saga en cours (plus de boutons/carte dédiée) | DashboardGarden cleanup + inline text indicator |
| SAG-04 | Le visiteur a des animations de réaction (joie, surprise, mystère) et un départ animé après completion de saga | Departure sequence: walk-off + flash+étoiles pour dernière saga |
</phase_requirements>

---

## Summary

Cette phase transforme l'expérience saga d'un bouton de dashboard en un personnage pixel art interactif qui habite la scène du diorama. Les patterns techniques sont tous présents dans la codebase et bien maîtrisés : `AnimatedAnimal` pour l'animation de marche/idle, `CompanionSlot` pour le slot de personnage dans la scène, et `SagaWorldEvent` pour le système de dialogue. Le travail est un assemblage de ces patterns plutôt qu'une invention.

Le visiteur saga est un composant `VisitorSlot` (nouveau, calqué sur `CompanionSlot`) qui vit en couche absolute dans la scène du diorama, comme le compagnon (couche 3.5 dans `tree.tsx`). La différence clé : il a un cycle de vie — entrée depuis le bord droit avec `translateX` spring, idle avec bounce + bulle "!", puis sortie vers la droite après complétion. Le tap déclenche `SagaWorldEvent` qui est déjà un overlay sur la scène (couche 5, `zIndex: 15`).

La refonte dashboard est chirurgicale : remplacer `renderSagaCard()` dans `DashboardGarden.tsx` par un simple texte inline (3 états : visiteur attendu, suite demain, rien). Les sprites doivent être générés via PixelLab MCP avant que le composant puisse être écrit — c'est le chemin critique de la phase.

**Primary recommendation:** Générer les sprites PixelLab d'abord (Wave 0), construire `VisitorSlot` sur le patron de `CompanionSlot`, refactorer `SagaWorldEvent` en mode tap-triggered, puis nettoyer le dashboard.

---

## Standard Stack

### Core (déjà installé dans le projet)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native-reanimated | ~4.1.1 | Animations walk/idle/bounce + spring | Décision projet — OBLIGATOIRE pour toutes les animations |
| expo-haptics | ~15.0.8 | Feedback tactile sur tap visiteur | Pattern établi sur CompanionSlot et SagaWorldEvent |
| react-native (Image, Pressable, View) | 0.81.5 | Rendu sprite pixel art dans la scène | Pattern établi AnimatedAnimal/CompanionSlot |

### PixelLab MCP (génération sprite — Wave 0 critique)

| Tool | Purpose | Utilisation |
|------|---------|-------------|
| `mcp__pixellab__create_character` | Générer le sprite visiteur pixel art | 1 appel par direction (face, left, walk frames) |

**Format sprite attendu :**
- Style : Mana Seed compatible (top-down RPG)
- Base : 48×48 pixels (même format que les animaux compagnon)
- Frames nécessaires : `idle_1.png`, `idle_2.png`, `walk_left_1-6.png` (walk_right = miroir scaleX)
- Dossier cible : `assets/garden/animals/voyageur/`

### Pas de nouvelles dépendances

Aucun `npm install` requis. Tout est déjà présent dans le projet.

---

## Architecture Patterns

### Pattern 1 : VisitorSlot (nouveau composant, calqué sur CompanionSlot)

**Ce que c'est :** Composant React Native (pas SVG) qui vit en couche absolute dans le diorama — exactement comme `CompanionSlot`. Le visiteur est un `Animated.View` avec `position: 'absolute'`, `left`, `top` calculés depuis des fractions du `containerWidth`/`containerHeight`.

**Structure du composant :**

```typescript
// components/mascot/VisitorSlot.tsx
interface VisitorSlotProps {
  visible: boolean;             // true = chapitre disponible aujourd'hui
  sagaId: string;               // pour les variations de tint/couleur par saga
  containerWidth: number;
  containerHeight: number;
  onTap: () => void;            // déclenche SagaWorldEvent
}
```

**Cycle de vie (3 états internes) :**

```typescript
type VisitorState = 'entering' | 'idle' | 'departing' | 'departed';
```

- `entering` : translateX spring depuis SCREEN_W (bord droit) → position fixe
- `idle` : bounce Y + bulle "!" pulsante, Pressable actif
- `departing` : translateX spring vers SCREEN_W, puis `departed`
- `departed` : `null` retourné (le composant se rend invisible proprement)

**Position dans le diorama (à affiner, Claude's Discretion) :**

La scène diorama est `containerWidth × containerHeight`. Le CompanionSlot démarre à `fx: 0.42, fy: 0.55` (chemin principal). Le visiteur doit être côté droit, à côté de l'arbre, sol visible — suggestion : `fx: 0.72, fy: 0.58` (droite du chemin, proche de l'arbre). Point de départ arrivée : `fx: 1.15` (hors bord droit). Point de sortie départ : `fx: 1.20`.

**Animation arrivée :**

```typescript
// SPRING_WALK = { damping: 16, stiffness: 120 }
const walkX = useSharedValue(containerWidth * 1.15);  // hors bord
const walkY = useSharedValue(containerHeight * 0.58);
// Au montage quand visible=true :
walkX.value = withSpring(containerWidth * 0.72, SPRING_WALK);
```

Pendant la marche : frame swap walk_left (6 frames, 150ms/frame via setInterval) + `scaleX: 1` (personnage marche vers la gauche = bonne direction depuis droite).

**Animation idle :**

```typescript
const bounceY = useSharedValue(0);
bounceY.value = withRepeat(
  withSequence(
    withTiming(-3, { duration: 600, easing: Easing.inOut(Easing.sin) }),
    withTiming(0,  { duration: 600, easing: Easing.inOut(Easing.sin) }),
  ),
  -1, true,
);
```

**Bulle "!" :**

```typescript
// Séparée de l'Image — position: 'absolute', top: -18, alignSelf: 'center'
const bubbleScale = useSharedValue(1);
bubbleScale.value = withRepeat(
  withSequence(
    withSpring(1.25, { damping: 8, stiffness: 200 }),
    withSpring(1.0,  { damping: 12, stiffness: 180 }),
  ),
  -1, true,
);
```

Contenu : `Text` avec `"!"`, fond `primary + 'DD'`, `borderRadius: Radius.full`, taille ~16px.

**Animation départ (non-finale) :**

```typescript
// Après onChapterComplete — délai 600ms pour laisser SagaWorldEvent se fermer
walkX.value = withSpring(containerWidth * 1.20, SPRING_WALK, () => {
  runOnJS(setVisitorState)('departed');
});
```

Frame swap walk_right = walk_left + `scaleX: -1` sur l'Image (pattern établi depuis Phase 05-03).

**Animation départ finale (dernière saga) :**

Flash + scale-up + opacité 0 + particules étoilées. Inspiré du `spiritY` / `spiritScale` de `SagaWorldEvent` phase finale :

```typescript
// Flash blanc + scale + fadeout
const flashOpacity = useSharedValue(0);
const visitorScale = useSharedValue(1);
flashOpacity.value = withSequence(
  withTiming(1, { duration: 200 }),
  withTiming(0, { duration: 600 }),
);
visitorScale.value = withSequence(
  withSpring(1.4, { damping: 8, stiffness: 120 }),
  withTiming(0, { duration: 400 }),
);
// Après : setVisitorState('departed')
```

---

### Pattern 2 : SagaWorldEvent refactorisé (trigger par tap vs auto)

**Changements minimaux requis (D-15, D-16) :**

1. **Le spiritGlow est remplacé** par une image du sprite visiteur (face / idle_1) positionné en haut du diorama. Ce "portrait" dans l'overlay garde le contexte visuel du personnage pendant le dialogue.

   ```typescript
   // Avant : spiritGlow (cercle lumineux + emoji)
   // Après : Image source={visitorIdleFrame} style={styles.visitorPortrait}
   // Taille portrait : 72×72 (identique à spiritGlow)
   ```

2. **Le déclencheur** passe de `showSagaEvent` setté automatiquement au montage → setté par le tap sur `VisitorSlot.onTap`.

3. **Le comportement après cliffhanger/finale** appelle `onDismiss` qui, dans `tree.tsx`, déclenche la séquence de départ du visiteur.

4. **Props à ajouter** sur `SagaWorldEventProps` :

   ```typescript
   visitorIdleFrame?: ImageSourcePropType;  // pour le portrait
   ```

5. **Tout le reste est inchangé** : typewriter, choix cards, trait flash, cliffhanger, finale_reveal, animateDismiss.

---

### Pattern 3 : Intégration dans tree.tsx

**Couche 3.6 (nouvelle couche entre compagnon et particules) :**

```typescript
{/* Couche 3.6 : Visiteur saga — même niveau z que le compagnon */}
{sagaChapterAvailable && isOwnTree && (
  <View style={{ ...StyleSheet.absoluteFillObject, zIndex: visitorDialogOpen ? 20 : 3 }}
        pointerEvents="box-none">
    <VisitorSlot
      visible={sagaChapterAvailable}
      sagaId={sagaProgress!.sagaId}
      containerWidth={SCREEN_W}
      containerHeight={DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60}
      onTap={() => { hapticsTreeTap(); setShowSagaEvent(true); }}
      onDepartComplete={() => { /* optionnel */ }}
    />
  </View>
)}
```

**Le bouton "Saga en attente" existant** (lignes 1408-1431 de tree.tsx) est **supprimé** — remplacé par le tap direct sur le visiteur.

**Le bandeau saga active** (lignes 1026-1038) peut rester ou être simplifié — il n'est pas dans le scope de D-12/D-13 (qui concerne DashboardGarden).

**Déclenchement du départ :** `onDismiss` de `SagaWorldEvent` doit signaler à `VisitorSlot` de partir. Options :
- Prop `shouldDepart` (boolean) passée à `VisitorSlot`
- Callback `onDepartComplete` sur `VisitorSlot`

Recommandation : utiliser un state `visitorShouldDepart` dans `tree.tsx`, setté `true` dans `onDismiss`, passé en prop à `VisitorSlot`. `VisitorSlot` déclenche son animation de départ quand cette prop passe à `true`.

---

### Pattern 4 : DashboardGarden — indicateur texte

**Ce qui est supprimé :**
- `renderSagaCard()` entier (lignes 174-298 dans DashboardGarden.tsx) — la carte avec bouton, dots de progression, récompenses
- `renderSagaDots()` — plus de dots (la progression sera dans le texte compact)

**Ce qui est ajouté — 3 états, texte inline :**

```typescript
// Dans le rendu, là où renderSagaCard() était appelé :
{hasSaga && (
  <TouchableOpacity
    style={[styles.sagaIndicator, { borderColor: colors.borderLight }]}
    onPress={() => router.push('/(tabs)/tree')}
    activeOpacity={0.8}
  >
    {sagaChapterDone ? (
      <Text style={[styles.sagaIndicatorText, { color: colors.textMuted }]}>
        {`⏳ Suite de la saga demain...`}
      </Text>
    ) : (
      <Text style={[styles.sagaIndicatorText, { color: primary }]}>
        {`🌟 Un visiteur attend près de ton arbre`}
      </Text>
    )}
    <Text style={[styles.sagaProgress, { color: colors.textSub }]}>
      {`Chapitre ${sagaProgress!.currentChapter}/${activeSaga!.chapters.length} — ${t(activeSaga!.titleKey)}`}
    </Text>
  </TouchableOpacity>
)}
```

Styles inline : `sagaIndicator` = padding Spacing.md, borderWidth 1, borderRadius Radius.lg, marginTop Spacing.md. Pas de carte dédiée — juste un bloc texte léger.

**État de la logique saga dans DashboardGarden :**
- `loadSagaProgress` + `shouldStartSaga` restent dans DashboardGarden (la logique de démarrage saga doit rester ici pour être évaluée au chargement du dashboard)
- `completeSagaChapter` est retiré du DashboardGarden (plus de handler de complétion ici — tout passe par tree.tsx)

---

### Pattern 5 : PixelLab MCP — génération sprite visiteur

**Outils disponibles :** `mcp__pixellab__create_character` (confirmé dans les instructions MCP du système).

**Sprite folder target :** `assets/garden/animals/voyageur/`

**Frames requises :**
- `idle_1.png`, `idle_2.png` — personnage debout, léger mouvement
- `walk_left_1.png` à `walk_left_6.png` — marche vers la gauche (walk_right = scaleX: -1)

**Prompt recommandé pour PixelLab :**
```
Style: top-down RPG pixel art, Mana Seed compatible, 48x48 pixels
Character: mysterious traveler/voyager, wearing a hooded cloak,
carrying a small satchel, neutral/warm colors (grey cloak, amber details)
Expression: friendly curiosity
Animation: idle stance, slight movement
Background: transparent
```

**Note sur les variations par saga :** La décision D-01 indique des "variations subtiles par saga (accessoire ou palette) gérées côté code (tint/overlay)". Implémentation : prop `sagaTint` sur `VisitorSlot`, appliqué via `tintColor` sur l'`Image` du sprite. Les 4 sagas peuvent avoir des teintes : argenté (`#C0C8D0`), eau (`#80B4D0`), feu (`#D09060`), forêt (`#80A060`).

**Attention React Native tintColor :** Sur iOS, `tintColor` sur `<Image>` applique un filtre de couleur sur les pixels non-transparents. Cela fonctionne sur les sprites PNG avec fond transparent. L'effet est subtil sur des sprites colorés — tester sur device.

---

### Anti-Patterns à Éviter

- **Ne pas mettre le visiteur dans le SVG** (composant `<G>` dans TreeView) — il doit être un composant React Native natif en couche absolute, comme le compagnon. Les animations Reanimated ne fonctionnent pas correctement à l'intérieur du SVG.
- **Ne pas utiliser `perspective` dans les transforms** (règle projet CLAUDE.md) — utiliser `scaleX: -1` pour le flip du walk_right.
- **Ne pas créer un écran dédié** pour le dialogue saga (D-06) — le dialogue reste un overlay sur la scène.
- **Ne pas appeler `completeSagaChapter` depuis deux endroits** — DashboardGarden ne doit plus avoir de handler de complétion saga après cette phase.
- **Ne pas bloquer le compagnon** — le `VisitorSlot` et le `CompanionSlot` coexistent dans la scène. Le visiteur est positionné côté droit (fx ~0.72), le compagnon se balade (PATROL_ROUTE, départ à fx: 0.42). Il y a un risque visuel de superposition — vérifier que les positions sont compatibles.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animation walk + idle frame swap | Custom animation loop | Pattern AnimatedAnimal (setInterval frame swap + shared value translateX) | Exactement ce pattern dans TreeView.tsx — copier/adapter |
| Dialogue saga avec typewriter | Nouveau composant dialogue | SagaWorldEvent.tsx refactoré | 550 lignes déjà fonctionnelles — refactorer, pas réécrire |
| Persistence saga state | Custom storage | loadSagaProgress / saveSagaProgress (sagas-storage.ts) | Existant, fonctionnel, SecureStore |
| Navigation vers l'arbre depuis le dashboard | Custom deep link | `router.push('/(tabs)/tree')` | Pattern déjà dans DashboardGarden (ligne 208) |
| Sprite pixel art visiteur | Dessin manuel | PixelLab MCP `mcp__pixellab__create_character` | C'est exactement son rôle |

---

## Common Pitfalls

### Pitfall 1 : Timing entre départ visiteur et dismiss SagaWorldEvent

**What goes wrong :** `SagaWorldEvent.onDismiss` est appelé après l'animation de dismiss (600ms delay ligne 179 du composant). Si `VisitorSlot` commence son animation de départ immédiatement au tap sur un choix, les deux animations se jouent en parallèle et le visiteur disparaît pendant que le cliffhanger est encore visible.

**How to avoid :** Le départ du visiteur ne doit être déclenché QUE après `onDismiss` (pas après `onChapterComplete`). Séquence correcte :
1. Tap choix → `SagaWorldEvent` joue cliffhanger/finale (1-3s)
2. `SagaWorldEvent.animateDismiss()` → 600ms → `onDismiss()` appelé dans tree.tsx
3. `onDismiss` dans tree.tsx : `setShowSagaEvent(false)` + `setVisitorShouldDepart(true)`
4. `VisitorSlot` voit `shouldDepart=true` → joue animation départ

### Pitfall 2 : Double-trigger du chargement saga dans DashboardGarden et tree.tsx

**What goes wrong :** `DashboardGarden` charge `sagaProgress` via `loadSagaProgress`. `tree.tsx` charge aussi `sagaProgress` au montage. Si `DashboardGarden` démarre une nouvelle saga (via `shouldStartSaga`), `tree.tsx` doit recharger son état — sinon le visiteur n'apparaît pas malgré la saga active.

**How to avoid :** `tree.tsx` utilise `useFocusEffect` (via `expo-router`) pour recharger `sagaProgress` à chaque fois que l'écran devient actif. Vérifier que `loadSagaProgress` est appelé dans `useFocusEffect` (ou dans l'`useEffect` existant avec `profile?.id` en dépendance — ce qui se re-déclenchera si on navigue hors puis vers tree.tsx).

### Pitfall 3 : Bulle "!" qui cloche avec le fond du diorama

**What goes wrong :** La bulle "!" est un `View` React Native en position absolute par rapport au parent `Animated.View` du sprite. Si le sprite est petit (48px) et la bulle est positionnée `top: -18`, elle peut être clippée par le parent si celui-ci n'a pas `overflow: 'visible'`.

**How to avoid :** S'assurer que l'`Animated.View` container du visiteur a `overflow: 'visible'` (comportement par défaut React Native sur iOS — vérifier que rien ne force `overflow: 'hidden'`). Tester visuellement que la bulle dépasse bien au-dessus du sprite.

### Pitfall 4 : tintColor non supporté sur certains formats d'image

**What goes wrong :** Le `tintColor` sur `<Image>` React Native fonctionne sur iOS avec des PNG transparents, mais peut se comporter différemment selon le format de sortie de PixelLab. Sur Android, `tintColor` est parfois ignoré.

**How to avoid :** Tester `tintColor` sur device iOS et Android après génération sprite. Si le résultat est insatisfaisant, les variations de saga peuvent être implémentées via un `<View>` overlay avec `opacity: 0.15` et `backgroundColor` de la couleur de saga (moins précis mais plus compatible).

### Pitfall 5 : Conflit de gestes entre Pressable visiteur et WorldGridView

**What goes wrong :** `WorldGridView` et `NativePlacedItems` gèrent des touches sur la scène. Le `Pressable` du visiteur est en position absolute par-dessus. Sur Android, la propagation des événements touch peut causer des conflicts.

**How to avoid :** Le `Pressable` du visiteur doit avoir `hitSlop` minimal (pas de `hitSlop` élargi) et être dans un `View` avec `pointerEvents="box-none"` au niveau du container, pour que les touches en dehors du sprite passent à travers. Le `Pressable` lui-même intercepte uniquement les touches sur sa surface.

---

## Code Examples

### Frame swap + walk animation (pattern AnimatedAnimal adapté)

```typescript
// Source: components/mascot/TreeView.tsx, function AnimatedAnimal (lignes 2088-2197)
// Adapté pour VisitorSlot

const VISITOR_SIZE = 48;
const SPRING_WALK = { damping: 16, stiffness: 120 };

function VisitorSlot({ visible, containerWidth, containerHeight, onTap, shouldDepart, isLastChapter }) {
  const [frameIdx, setFrameIdx] = useState(0);
  const [state, setState] = useState<VisitorState>('entering');
  const posX = useSharedValue(containerWidth * 1.15);  // commence hors écran droite
  const bounceY = useSharedValue(0);
  const bubbleScale = useSharedValue(1);
  const opacity = useSharedValue(0);

  const TARGET_X = containerWidth * 0.72;
  const TARGET_Y = containerHeight * 0.58;

  // Animation d'arrivée
  useEffect(() => {
    if (!visible || state !== 'entering') return;
    opacity.value = withTiming(1, { duration: 200 });
    posX.value = withSpring(TARGET_X, SPRING_WALK, () => {
      runOnJS(setState)('idle');
    });
  }, [visible, state]);

  // Départ
  useEffect(() => {
    if (!shouldDepart || state !== 'idle') return;
    setState('departing');
    posX.value = withSpring(containerWidth * 1.20, SPRING_WALK, () => {
      runOnJS(setState)('departed');
    });
  }, [shouldDepart, state]);

  const moveStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: posX.value - TARGET_X },
      { translateY: bounceY.value },
    ],
    opacity: opacity.value,
  }));

  if (state === 'departed') return null;

  return (
    <Animated.View style={[{
      position: 'absolute',
      left: TARGET_X,
      top: TARGET_Y,
      width: VISITOR_SIZE,
      height: VISITOR_SIZE,
      overflow: 'visible',
    }, moveStyle]}>
      <Pressable onPress={state === 'idle' ? onTap : undefined}>
        <Image
          source={getVisitorFrame(state, frameIdx)}
          style={[{ width: VISITOR_SIZE, height: VISITOR_SIZE },
            state === 'departing' ? { transform: [{ scaleX: -1 }] } : {}
          ] as any}
        />
      </Pressable>
      {/* Bulle "!" */}
      {state === 'idle' && (
        <Animated.View style={[styles.exclamationBubble, { transform: [{ scale: bubbleScale.value }] }]}>
          <Text style={styles.exclamationText}>!</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}
```

### Refactoring SagaWorldEvent — trigger tap vs auto (pattern clé)

```typescript
// Source: components/mascot/SagaWorldEvent.tsx (lignes 65-70 + 202-223)
// AVANT : s'ouvre automatiquement (showSagaEvent=true déclenche rendering)
// APRÈS : s'ouvre suite au tap → pas de changement dans SagaWorldEvent lui-même
// tree.tsx contrôle showSagaEvent via le callback onTap du VisitorSlot

// Dans tree.tsx — AVANT :
{sagaChapterAvailable && !showSagaEvent && isOwnTree && activeSaga && (
  <TouchableOpacity onPress={() => setShowSagaEvent(true)}>...</TouchableOpacity>
)}

// Dans tree.tsx — APRÈS :
// Le bouton est supprimé. Le tap sur VisitorSlot appelle setShowSagaEvent(true).
// VisitorSlot reçoit onTap={() => { hapticsTreeTap(); setShowSagaEvent(true); }}
```

### Indicateur dashboard — texte inline

```typescript
// Source: components/dashboard/DashboardGarden.tsx — remplace renderSagaCard()
// Utilise les variables existantes : hasSaga, sagaChapterDone, activeSaga, sagaProgress

{hasSaga && !sagaProgress?.status === 'completed' && (
  <TouchableOpacity
    style={[styles.sagaIndicator, { borderColor: colors.borderLight }]}
    onPress={() => router.push('/(tabs)/tree' as any)}
    activeOpacity={0.8}
  >
    <Text style={[styles.sagaIndicatorText, {
      color: sagaChapterDone ? colors.textMuted : primary
    }]}>
      {sagaChapterDone
        ? t('mascot.saga.indicator.done', '⏳ Suite de la saga demain...')
        : t('mascot.saga.indicator.waiting', '🌟 Un visiteur attend près de ton arbre')}
    </Text>
    {activeSaga && sagaProgress && (
      <Text style={[styles.sagaIndicatorProgress, { color: colors.textSub }]}>
        {`Chapitre ${sagaProgress.currentChapter}/${activeSaga.chapters.length} — ${t(activeSaga.titleKey)}`}
      </Text>
    )}
  </TouchableOpacity>
)}
```

### Clé i18n à ajouter dans locales/fr/gamification.json

```json
{
  "mascot": {
    "saga": {
      "indicator": {
        "waiting": "🌟 Un visiteur attend près de ton arbre",
        "done": "⏳ Suite de la saga demain..."
      }
    }
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Saga déclenche un overlay automatique au montage de tree.tsx | Saga déclenche un PNJ interactif dans la scène, overlay via tap | Phase 11 | UX plus immersive, moins intrusive |
| Bouton saga dans DashboardGarden (carte complète) | Indicateur texte discret dans DashboardGarden | Phase 11 | Dashboard plus épuré, expérience dans l'arbre |
| spiritGlow (cercle emoji) comme représentation narrative | Sprite pixel art personnage voyageur | Phase 11 | Cohérence visuelle avec le diorama |
| showSagaEvent setté automatiquement | showSagaEvent setté par tap sur le visiteur | Phase 11 | Contrôle utilisateur, no surprise |

---

## Open Questions

1. **Coexistence compagnon + visiteur dans la scène**
   - Ce qu'on sait : CompanionSlot se balade sur un PATROL_ROUTE. Le visiteur est positionné côté droit (fx ~0.72). Le compagnon peut passer par cette zone (ex: `building-entry` à fx: 0.90, fy: 0.45).
   - Ce qui est flou : est-ce qu'il y aura des collisions visuelles désagréables ?
   - Recommandation : Positionner le visiteur légèrement plus bas (fy: 0.62-0.65) pour l'éloigner du chemin principal que suit le compagnon. Ajustable après test visuel.

2. **Rendu VisitorSlot pendant le dialogue SagaWorldEvent**
   - Ce qu'on sait : `SagaWorldEvent` est à `zIndex: 15` en overlay sur toute la scène (absolute, `height: containerHeight`). La vignette sombre couvre toute la scène.
   - Ce qui est flou : est-ce qu'on veut que le sprite visiteur soit visible sous la vignette pendant le dialogue (comme contexte) ou caché ?
   - Recommandation : Cacher le `VisitorSlot` pendant `showSagaEvent=true` (ou laisser la vignette le couvrir naturellement). Le "portrait" du visiteur dans l'overlay SagaWorldEvent (remplaçant spiritGlow) est suffisant pour l'identité.

3. **Compatibilité tintColor iOS/Android pour les variations saga**
   - Ce qu'on sait : `tintColor` fonctionne sur iOS avec des PNG transparents. Comportement Android variable.
   - Recommandation : Implémenter via overlay `<View>` semi-transparent en fallback si tintColor ne rend pas bien sur Android. Décision après test device.

4. **Démarrage saga : DashboardGarden vs tree.tsx — source de vérité**
   - Ce qu'on sait : `DashboardGarden` évalue `shouldStartSaga` et crée un nouveau `SagaProgress`. `tree.tsx` charge `sagaProgress` au montage depuis `loadSagaProgress`. Si le dashboard démarre une saga et que l'utilisateur va directement sur l'arbre sans repasser par le dashboard, le visiteur apparaîtra.
   - Ce qui est flou : L'évaluation `shouldStartSaga` dans DashboardGarden est-elle suffisante, ou doit-on aussi l'évaluer dans tree.tsx ?
   - Recommandation : Laisser DashboardGarden comme déclencheur de saga (c'est son rôle actuel). tree.tsx charge simplement l'état persisté. Si l'utilisateur va directement sur l'arbre sans passer par le dashboard, la saga n'aura pas encore été créée. C'est un comportement acceptable pour l'instant (pas dans le scope).

---

## Environment Availability

Step 2.6: SKIPPED partiellement — aucune nouvelle dépendance npm. Seule dépendance externe : PixelLab MCP.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PixelLab MCP (`mcp__pixellab__create_character`) | SAG-01, SAG-04 (sprite visiteur) | Confirmé dans init context | — | Utiliser un emoji SVG temporaire (cercle avec personnage) puis remplacer par le sprite |
| react-native-reanimated | Toutes les animations | Installé | ~4.1.1 | — |
| expo-haptics | Feedback tap visiteur | Installé | ~15.0.8 | — |

**Missing dependencies with no fallback :** Aucune.

**Note PixelLab :** Le MCP PixelLab est disponible. La génération de sprite doit être faite en Wave 0 (avant le code) car les `require()` de sprites sont statiques dans le bundle React Native — impossible d'avoir des images générées dynamiquement au runtime sans aller sur internet.

---

## Validation Architecture

Nyquist validation désactivée (`workflow.nyquist_validation: false`). Validation via `npx tsc --noEmit`.

**Critères de succès de la phase (success criteria du CONTEXT) :**
1. Visiteur apparaît dans la scène quand saga active → vérification visuelle sur device
2. Tap visiteur ouvre SagaWorldEvent → vérification manuelle
3. Dashboard sans carte saga (juste indicateur texte) → vérification visuelle
4. Animations réaction + départ après complétion → vérification manuelle
5. `npx tsc --noEmit` passe sans nouvelles erreurs → automatisable

---

## Sources

### Primary (HIGH confidence)

- Code source `components/mascot/TreeView.tsx` (AnimatedAnimal, HAB_SLOTS, NativePlacedItems, CompanionSlot pattern) — lu directement
- Code source `components/mascot/SagaWorldEvent.tsx` — lu directement (550 lignes, système complet)
- Code source `app/(tabs)/tree.tsx` — lu directement (orchestration saga, couches diorama)
- Code source `components/mascot/CompanionSlot.tsx` — lu directement (PATROL_ROUTE, sprite walk, bulle message)
- Code source `lib/mascot/sagas-types.ts` — lu directement (SagaProgress, SagaChapter, SagaTrait)
- Code source `.planning/phases/11-sagas-immersives/11-CONTEXT.md` — source des décisions locked
- `CLAUDE.md` (projet) — conventions: scaleX pour flip, pas de perspective, useThemeColors, etc.
- `.planning/STATE.md` — decisions accumulées (Phase 05-03: scaleX: -1 sur Image uniquement)

### Secondary (MEDIUM confidence)

- Instructions MCP PixelLab (système) — confirme disponibilité `mcp__pixellab__create_character`
- React Native documentation sur `tintColor` sur `Image` — comportement iOS vs Android variable (connu)

---

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH — tout est déjà dans le projet, aucune dépendance nouvelle
- Architecture : HIGH — basée sur code existant lu directement, patterns déjà utilisés dans la codebase
- Pitfalls : HIGH pour timing/z-index (basé sur code existant), MEDIUM pour tintColor (comportement variable Android)
- PixelLab sprite generation : MEDIUM — le MCP est disponible mais les détails du prompt et du résultat visuel ne peuvent être confirmés qu'à l'exécution

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stack stable, code source local — toujours valide)
