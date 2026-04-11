---
phase: 29-avatars-vivants-portail-retour
plan: 02
type: execute
wave: 2
depends_on:
  - 29-01
files_modified:
  - components/village/PortalSprite.tsx
  - lib/village/grid.ts
  - app/(tabs)/tree.tsx
  - app/(tabs)/village.tsx
autonomous: true
requirements:
  - VILL-11
  - VILL-12
must_haves:
  truths:
    - "User voit un portail pixel art (portail.png) au coin bas-droit de la carte village (slot village_portal_home)"
    - "User voit le portail côté ferme utiliser le même sprite portail.png (plus d'emoji 🏛️)"
    - "User peut tap sur le portail village pour déclencher une transition fade 400ms puis navigation router.replace vers /(tabs)/tree"
    - "User ne voit plus le bouton header '‹' dans village.tsx — le portail est le seul point de sortie"
    - "User qui revient au village depuis la ferme voit l'écran à opacité pleine (useFocusEffect reset)"
  artifacts:
    - path: "components/village/PortalSprite.tsx"
      provides: "Composant portail partagé (glow loop + scale spring + sprite portail.png)"
      exports: ["PortalSprite"]
    - path: "lib/village/grid.ts"
      provides: "VILLAGE_GRID avec entrée village_portal_home role 'portal'"
      contains: "village_portal_home"
    - path: "app/(tabs)/tree.tsx"
      provides: "Import PortalSprite partagé, suppression déclaration locale, suppression styles emoji"
      contains: "import { PortalSprite }"
    - path: "app/(tabs)/village.tsx"
      provides: "screenOpacity fade + handleReturnPortalPress + render PortalSprite + suppression backBtn"
      contains: "handleReturnPortalPress"
  key_links:
    - from: "components/village/PortalSprite.tsx"
      to: "assets/items/portail.png"
      via: "require('../../assets/items/portail.png')"
      pattern: "portail\\.png"
    - from: "app/(tabs)/tree.tsx"
      to: "components/village/PortalSprite.tsx"
      via: "import partagé (remplace fonction locale)"
      pattern: "from '.*components/village/PortalSprite'"
    - from: "app/(tabs)/village.tsx"
      to: "components/village/PortalSprite.tsx"
      via: "import + render avec prop x/y slot village_portal_home"
      pattern: "<PortalSprite"
    - from: "app/(tabs)/village.tsx"
      to: "expo-router router.replace"
      via: "runOnJS(router.replace) dans withTiming callback"
      pattern: "runOnJS.*router.replace"
---

<objective>
Fermer la boucle de navigation du village : extraire `PortalSprite` dans un composant partagé, remplacer l'emoji 🏛️ côté ferme par le sprite pixel art `portail.png`, ajouter un portail retour dans `village.tsx` avec transition fade cross-dissolve Reanimated 400ms symétrique à l'aller Phase 28, et supprimer le bouton header `‹` pour que le portail soit le seul point de sortie. Couvre VILL-11 (portail retour visuel symétrique) et VILL-12 (transition fade 400ms cohérente avec l'aller).

Purpose: Symétrie narrative "même passage magique, deux directions". Complète la boucle UX du milestone v1.5 en rendant la navigation village ↔ ferme pleinement bidirectionnelle avec une identité visuelle cohérente.

Output:
- Nouveau composant partagé `components/village/PortalSprite.tsx` (extraction de `tree.tsx`)
- `tree.tsx` refactoré pour importer le composant partagé + sprite au lieu de l'emoji
- `village.tsx` avec portail retour + fade + suppression backBtn
- `VILLAGE_GRID` étendu avec entrée `village_portal_home`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/29-avatars-vivants-portail-retour/29-CONTEXT.md
@.planning/phases/29-avatars-vivants-portail-retour/29-RESEARCH.md
@.planning/phases/29-avatars-vivants-portail-retour/29-UI-SPEC.md
@.planning/phases/29-avatars-vivants-portail-retour/29-PLAN-01-avatars-vivants.md
@CLAUDE.md

<interfaces>
<!-- Composant PortalSprite existant dans tree.tsx:303-361 à extraire -->

From app/(tabs)/tree.tsx:303-361 (à SUPPRIMER après extraction):
```typescript
const SPRING_PORTAL = { damping: 12, stiffness: 200 } as const;

function PortalSprite({ onPress }: { onPress: () => void }) {
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

  return (
    <Animated.View
      style={[styles.portalContainer, containerStyle]}
      accessibilityLabel="Portail vers le village"
      accessibilityRole="button"
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          styles.portalGlow,
          { backgroundColor: colors.catJeux },
          glowStyle,
        ]}
        pointerEvents="none"
      />
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={1}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Portail vers le village"
      >
        <Text style={styles.portalEmoji}>{'🏛️'}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
```

Styles locaux associés dans tree.tsx (~lignes 3018-3034) à supprimer :
```typescript
portalContainer: { /* ... */ },  // ~56×56
portalGlow: { /* ... */ },
portalEmoji: { fontSize: 28 },
```

From tree.tsx:407-425 (fade pattern à DUPLIQUER symétriquement dans village.tsx avec router.replace au lieu de push) :
```typescript
const screenOpacity = useSharedValue(1);
const fadeStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));

const handlePortalPress = useCallback(() => {
  screenOpacity.value = withTiming(
    0,
    { duration: 400, easing: Easing.out(Easing.ease) },
    (finished) => {
      if (finished) runOnJS(router.push)('/(tabs)/village' as any);
    },
  );
}, [screenOpacity, router]);

useFocusEffect(useCallback(() => {
  screenOpacity.value = 1;
}, [screenOpacity]));
```

Usage actuel tree.tsx:~2129-2130 à maintenir (API inchangée) :
```typescript
<PortalSprite onPress={handlePortalPress} />
```

Asset confirmé : `assets/items/portail.png` (178 KB, spirale magique pixel art).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Créer composant partagé PortalSprite + étendre VILLAGE_GRID avec slot portal</name>
  <files>
    components/village/PortalSprite.tsx
    lib/village/grid.ts
  </files>
  <read_first>
    - app/(tabs)/tree.tsx lignes 300-361 (composant PortalSprite actuel à extraire)
    - app/(tabs)/tree.tsx (rechercher `styles.portalContainer`, `styles.portalGlow`, `styles.portalEmoji` pour voir leur définition exacte)
    - lib/village/grid.ts (état après Plan 01 — doit contenir 10 entrées, on en ajoute une 11e)
    - contexts/ThemeContext.tsx (pour vérifier que `colors.catJeux` existe)
    - constants/spacing.ts (tokens Radius)
  </read_first>
  <action>
**Étape 1 — Créer `components/village/PortalSprite.tsx`** (nouveau) : extraction du composant `tree.tsx:303-361` + ajout de props optionnelles `x, y, accessibilityLabel` pour permettre un positionnement absolu au village (tout en restant compatible avec l'usage ferme qui se base sur les styles locaux du diorama).

```typescript
// components/village/PortalSprite.tsx
// Phase 29 — Composant partagé : portail pixel art animé.
// Extraction de app/(tabs)/tree.tsx:303-361 pour consommation double (ferme → village + village → ferme).
// Per CD-04, D-16, D-17, D-20. Couvre VILL-11.

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
const CONTAINER_PAD = 8;
const GLOW_MIN = 0.4;
const GLOW_MAX = 0.8;
const GLOW_DURATION = 1200;
const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;

interface PortalSpriteProps {
  onPress: () => void;
  /** Si fourni, positionné en absolute centré sur (x, y). Sinon styles par défaut (diorama ferme). */
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
  const glowOpacity = useSharedValue(GLOW_MIN);
  const scaleAnim = useSharedValue(1);

  // Démarrer le glow loop au montage (pattern identique tree.tsx:315-317)
  useEffect(() => {
    glowOpacity.value = withRepeat(
      withTiming(GLOW_MAX, { duration: GLOW_DURATION }),
      -1,
      true,
    );
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

  // Si x/y fournis, on se positionne en absolute centré (mode village overlay).
  // Sinon pas de style de position — le parent contrôle via ses propres styles (mode ferme diorama).
  const positionStyle =
    x !== undefined && y !== undefined
      ? {
          position: 'absolute' as const,
          left: x - (PORTAL_SIZE + CONTAINER_PAD) / 2,
          top: y - (PORTAL_SIZE + CONTAINER_PAD) / 2,
        }
      : null;

  return (
    <Animated.View
      style={[styles.container, positionStyle, containerStyle]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      {/* Glow overlay — pattern tree.tsx:342-350 */}
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
        hitSlop={HIT_SLOP}
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
    width: PORTAL_SIZE + CONTAINER_PAD,
    height: PORTAL_SIZE + CONTAINER_PAD,
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

**Étape 2 — Étendre `lib/village/grid.ts`** : ajouter l'entrée `village_portal_home` à la fin, après les 6 slots avatars (qui ont été ajoutés en Plan 01). État final attendu : 11 entrées.

```typescript
// lib/village/grid.ts — ajout Phase 29 Plan 02 à la fin du tableau
// (juste avant le `];` fermant)

  // Phase 29 — portail retour vers la ferme (per D-18, VILL-11)
  { id: 'village_portal_home', x: 0.85, y: 0.85, role: 'portal' },
```

Le type `VillageRole` contient déjà `'portal'` (c'est pourquoi Plan 01 n'a ajouté que `'avatar'`).

**Étape 3 — Type check** : `npx tsc --noEmit` doit passer sans nouvelle erreur.

**Contraintes CLAUDE.md** :
- Commentaires FR
- Pas de hex hardcodée (glow via `colors.catJeux`)
- Animations Reanimated uniquement
- Spring config constante module en tête (`SPRING_PORTAL`)
- Tokens `Radius.xl` utilisé
- `require()` direct vers `portail.png` (confirmé présent, 178 KB)
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -v -E "(MemoryEditor|cooklang|useVault)" | grep -E "error TS" ; test $? -eq 1</automated>
  </verify>
  <acceptance_criteria>
    - File `components/village/PortalSprite.tsx` existe
    - `grep -c "export function PortalSprite" components/village/PortalSprite.tsx` retourne 1
    - `grep -c "require.*assets/items/portail.png" components/village/PortalSprite.tsx` retourne 1
    - `grep -c "SPRING_PORTAL" components/village/PortalSprite.tsx` retourne ≥2 (const + usage)
    - `grep -c "withRepeat" components/village/PortalSprite.tsx` retourne 1
    - `grep -c "withSpring" components/village/PortalSprite.tsx` retourne ≥2
    - `grep -c "Haptics.selectionAsync" components/village/PortalSprite.tsx` retourne 1
    - `grep -c "colors.catJeux" components/village/PortalSprite.tsx` retourne 1
    - `grep -c "village_portal_home" lib/village/grid.ts` retourne 1
    - `grep -c "role: 'portal'" lib/village/grid.ts` retourne 1
    - `grep -cE "x: 0\\.85, y: 0\\.85" lib/village/grid.ts` retourne 1
    - `grep -E "#[0-9A-Fa-f]{3,6}" components/village/PortalSprite.tsx` retourne 0 lignes (aucune hex hardcodée)
    - `npx tsc --noEmit` passe sans nouvelle erreur
  </acceptance_criteria>
  <done>
Composant partagé `PortalSprite` créé avec prop `x/y` optionnel (compat ferme diorama sans coordonnées + village overlay avec coordonnées), sprite `portail.png` embarqué via `require`, slot `village_portal_home` ajouté à la grille.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Refactorer tree.tsx pour importer PortalSprite partagé et supprimer emoji + déclaration locale</name>
  <files>
    app/(tabs)/tree.tsx
  </files>
  <read_first>
    - app/(tabs)/tree.tsx lignes 1-60 (imports existants pour vérifier qu'on peut ajouter l'import sans conflit)
    - app/(tabs)/tree.tsx lignes 300-361 (fonction PortalSprite locale à supprimer intégralement avec SPRING_PORTAL const)
    - app/(tabs)/tree.tsx rechercher `styles.portalContainer`, `styles.portalGlow`, `styles.portalEmoji` (styles locaux à supprimer)
    - app/(tabs)/tree.tsx lignes 2125-2135 (usage `<PortalSprite onPress={handlePortalPress} />` à maintenir)
    - components/village/PortalSprite.tsx (créé en Task 1 — pour confirmer signature API)
  </read_first>
  <action>
**Étape 1 — Ajouter l'import** en tête de `app/(tabs)/tree.tsx` (avec les autres imports composants) :
```typescript
import { PortalSprite } from '../../components/village/PortalSprite';
```

**Étape 2 — Supprimer la déclaration locale de `PortalSprite`** (lignes ~302-361) : supprimer intégralement le bloc commentaire + constante `SPRING_PORTAL` + fonction `function PortalSprite(...)`. En supprimant :
- Le commentaire `// --- PortalSprite — Portail animé vers le village (Phase 28, MAP-03)`
- `const SPRING_PORTAL = { damping: 12, stiffness: 200 } as const;`
- Toute la fonction `function PortalSprite({ onPress }: { onPress: () => void }) { ... }`

Le `handlePortalPress` handler (lignes 412-420) et son `useFocusEffect` (422-425) doivent rester intacts — ils sont utilisés par l'usage `<PortalSprite onPress={handlePortalPress} />` plus bas.

**Étape 3 — Supprimer les 3 styles locaux** dans le `StyleSheet.create` en bas de fichier (~lignes 3018-3034) :
- `portalContainer: { ... }`
- `portalGlow: { ... }`
- `portalEmoji: { fontSize: 28 }`

Ces styles étaient consommés UNIQUEMENT par la fonction locale supprimée en Étape 2. L'extraction dans `components/village/PortalSprite.tsx` contient ses propres styles internes.

**Étape 4 — Vérifier que l'usage `<PortalSprite onPress={handlePortalPress} />` (~ligne 2129-2130) reste inchangé** : l'API publique du composant partagé est identique quand on n'utilise pas les props `x/y` optionnelles, donc l'usage ferme continue à fonctionner tel quel.

**Étape 5 — Vérifier qu'aucun import devenu inutile ne reste** dans tree.tsx :
- Si `withRepeat` n'est plus utilisé ailleurs dans tree.tsx après suppression de la fonction locale, le laisser dans l'import (peut être utilisé par d'autres animations) — vérifier avec grep : `grep -c "withRepeat" "app/(tabs)/tree.tsx"`. S'il est à 0 et qu'il est dans l'import reanimated, on peut le retirer. Sinon laisser.
- Idem pour `withSpring`, `Image` (utilisé probablement par d'autres éléments comme sprites ferme).
- **Ne rien supprimer qui puisse être encore utilisé** — la règle : supprimer uniquement ce qui est certainement orphelin.

**Étape 6 — Type check + recherche de références cassées** :
```
npx tsc --noEmit 2>&1 | grep -v -E "(MemoryEditor|cooklang|useVault)" | grep -E "error TS"
```
Doit être vide. Si la suppression des styles `portalContainer/portalGlow/portalEmoji` laisse un usage orphelin, corriger.

**Risque à vérifier manuellement** : le sprite portail côté ferme doit rester visible et animé (glow + scale) identiquement à avant. Le remplacement visuel emoji → pixel art doit juste fonctionner au premier run `npx expo run:ios` (non requis dans cette tâche — test device est hors scope exécution, mais le code doit compiler).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -v -E "(MemoryEditor|cooklang|useVault)" | grep -E "error TS" ; test $? -eq 1</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "import { PortalSprite } from '../../components/village/PortalSprite'" "app/(tabs)/tree.tsx"` retourne 1
    - `grep -c "function PortalSprite" "app/(tabs)/tree.tsx"` retourne 0 (déclaration locale supprimée)
    - `grep -c "const SPRING_PORTAL" "app/(tabs)/tree.tsx"` retourne 0 (constante locale supprimée)
    - `grep -c "styles.portalEmoji" "app/(tabs)/tree.tsx"` retourne 0
    - `grep -c "styles.portalContainer" "app/(tabs)/tree.tsx"` retourne 0
    - `grep -c "styles.portalGlow" "app/(tabs)/tree.tsx"` retourne 0
    - `grep -c "portalEmoji:" "app/(tabs)/tree.tsx"` retourne 0 (style key supprimée)
    - `grep -c "portalContainer:" "app/(tabs)/tree.tsx"` retourne 0
    - `grep -c "portalGlow:" "app/(tabs)/tree.tsx"` retourne 0
    - `grep -c "🏛️" "app/(tabs)/tree.tsx"` retourne 0 (plus d'emoji portail)
    - `grep -c "<PortalSprite onPress={handlePortalPress}" "app/(tabs)/tree.tsx"` retourne 1 (usage maintenu)
    - `grep -c "handlePortalPress" "app/(tabs)/tree.tsx"` retourne ≥2 (handler + usage)
    - `grep -c "useFocusEffect" "app/(tabs)/tree.tsx"` retourne ≥1 (reset opacity reste)
    - `npx tsc --noEmit` passe sans nouvelle erreur
  </acceptance_criteria>
  <done>
`tree.tsx` importe `PortalSprite` depuis le composant partagé, plus de déclaration locale ni de styles orphelins ni d'emoji. Le portail ferme → village continue à fonctionner avec le sprite pixel art `portail.png` (symétrie visuelle D-17). Ferme non-régressée.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Ajouter fade screen + handleReturnPortalPress + render PortalSprite + suppression backBtn dans village.tsx</name>
  <files>
    app/(tabs)/village.tsx
  </files>
  <read_first>
    - app/(tabs)/village.tsx (état actuel APRÈS Plan 01 — doit déjà contenir avatars overlay, weeklyContribs, sortedActiveProfiles, tooltip state)
    - app/(tabs)/village.tsx lignes 1-60 (imports — vérifier que useFocusEffect, Easing, withTiming, runOnJS, Animated sont disponibles ou à ajouter)
    - app/(tabs)/village.tsx lignes 395-445 (root View + header avec backBtn + mapContainer + TileMapRenderer + overlays avatars ajoutés par Plan 01)
    - app/(tabs)/village.tsx rechercher `styles.backBtn`, `styles.backArrow`, `styles.headerSpacer` (styles à supprimer en bas du fichier)
    - app/(tabs)/tree.tsx lignes 407-425 (pattern fade aller à dupliquer en symétrie avec router.replace)
    - components/village/PortalSprite.tsx (signature props créée en Task 1)
    - lib/village/grid.ts (pour confirmer `village_portal_home` ajouté en Task 1)
    - .planning/phases/29-avatars-vivants-portail-retour/29-RESEARCH.md Pitfall 3 (useFocusEffect reset) et Pitfall 7 (styles cleanup)
  </read_first>
  <action>
**Étape 1 — Ajouter/compléter les imports en tête de `app/(tabs)/village.tsx`** :

Vérifier/ajouter (certains peuvent déjà être présents depuis Plan 01 ou d'origine) :
```typescript
import { useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { PortalSprite } from '../../components/village/PortalSprite';
```

Si `Animated` était déjà importé depuis `react-native-reanimated` pour d'autres usages, ajuster. Si `useFocusEffect` est déjà importé, l'utiliser tel quel. Vérifier l'idempotence de chaque import.

**Étape 2 — Ajouter après les hooks/memos existants dans `VillageScreen()`** :

```typescript
  // ── Fade cross-dissolve pour retour village → ferme (per VILL-12, D-21/D-22/D-23) ──
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

  // Reset opacity quand l'écran regagne le focus (retour depuis la ferme — per Pitfall 3)
  useFocusEffect(
    useCallback(() => {
      screenOpacity.value = 1;
    }, [screenOpacity]),
  );

  /** Slot du portail retour depuis la grille (per D-18) */
  const portalSlot = useMemo(
    () => VILLAGE_GRID.find(c => c.id === 'village_portal_home'),
    [],
  );
```

**Étape 3 — Wrapper le root return avec `<Animated.View style={fadeStyle}>`** :

État actuel (extrait) :
```typescript
return (
  <View style={[styles.root, { backgroundColor: colors.bg }]}>
    <View style={[styles.header, ...]}>
      <TouchableOpacity style={styles.backBtn} onPress={...}>
        <Text style={[styles.backArrow, ...]}>‹</Text>
      </TouchableOpacity>
      <Text style={[styles.headerTitle, ...]}>Place du Village</Text>
      <View style={styles.headerSpacer} />
    </View>
    ...
  </View>
);
```

Transformation :
```typescript
return (
  <Animated.View style={[styles.root, { backgroundColor: colors.bg }, fadeStyle]}>
    {/* Header sans backBtn — le portail est le seul point de sortie (per D-19) */}
    <View style={[styles.header, ...]}>
      <Text style={[styles.headerTitle, { color: colors.text }]}>Place du Village</Text>
    </View>
    ...
  </Animated.View>
);
```

Important :
- Remplacer le `<View>` racine par `<Animated.View>` avec `fadeStyle` ajouté au style array.
- **Supprimer** le bloc `<TouchableOpacity style={styles.backBtn}>` avec son enfant `<Text style={styles.backArrow}>‹</Text>` (lignes ~407-415).
- **Supprimer** aussi le `<View style={styles.headerSpacer} />` qui servait à équilibrer horizontalement le header (~ligne 417).
- Le `<Text style={styles.headerTitle}>Place du Village</Text>` reste et devient le seul enfant du header.

**Étape 4 — Ajouter le rendu du PortalSprite dans le `mapContainer`** comme dernier sibling APRÈS les avatars overlay et APRÈS le tooltip conditionnel (ou avant, peu importe — le portail est en absolute à (0.85, 0.85), pas de collision avec les avatars hauts) :

```typescript
<View
  style={[styles.mapContainer, { height: MAP_HEIGHT, marginHorizontal: -Spacing['2xl'] }]}
  onLayout={handleMapLayout}
>
  <TileMapRenderer ... />

  {/* Overlay avatars (Plan 01) */}
  {sortedActiveProfiles.slice(0, 6).map(...)}

  {/* Portail retour vers la ferme — per VILL-11 */}
  {portalSlot && (
    <PortalSprite
      onPress={handleReturnPortalPress}
      x={portalSlot.x * mapSize.width}
      y={portalSlot.y * mapSize.height}
      accessibilityLabel="Retour à la ferme"
    />
  )}

  {/* Tooltip conditionnel (Plan 01) */}
  {tooltip && (
    <AvatarTooltip ... />
  )}
</View>
```

**Étape 5 — Supprimer les styles orphelins** dans le `StyleSheet.create` en bas de `village.tsx` :
- `backBtn: { ... }`
- `backArrow: { ... }`
- `headerSpacer: { ... }`

Ces 3 styles ne sont plus référencés après Étape 3. Vérifier via grep qu'aucun autre fichier ne les utilise (ils sont locaux donc non).

**Étape 6 — Type check** : `npx tsc --noEmit` doit passer sans nouvelle erreur. Si erreur "Property 'x' is missing on type 'VillageCell'" ou autre → vérifier que la grille est bien à jour post-Task 1.

**Contraintes CLAUDE.md** :
- FR dans commentaires (`per VILL-11`, `per D-19`, etc.)
- `useCallback` sur `handleReturnPortalPress`
- Animation 100% Reanimated (`withTiming`, `Easing.out`, `runOnJS`)
- Aucune hex hardcodée
- Durée fade 400ms exacte (symétrie Phase 28 D-02)
- `router.replace` (pas `push`) pour éviter stack infini ping-pong
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -v -E "(MemoryEditor|cooklang|useVault)" | grep -E "error TS" ; test $? -eq 1</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "import { PortalSprite }" "app/(tabs)/village.tsx"` retourne 1
    - `grep -c "useFocusEffect" "app/(tabs)/village.tsx"` retourne ≥1
    - `grep -c "screenOpacity" "app/(tabs)/village.tsx"` retourne ≥3
    - `grep -c "fadeStyle" "app/(tabs)/village.tsx"` retourne ≥2
    - `grep -c "handleReturnPortalPress" "app/(tabs)/village.tsx"` retourne ≥2
    - `grep -c "duration: 400" "app/(tabs)/village.tsx"` retourne 1
    - `grep -c "Easing.out(Easing.ease)" "app/(tabs)/village.tsx"` retourne 1
    - `grep -c "runOnJS(router.replace)" "app/(tabs)/village.tsx"` retourne 1
    - `grep -c "'/(tabs)/tree'" "app/(tabs)/village.tsx"` retourne ≥1
    - `grep -c "portalSlot" "app/(tabs)/village.tsx"` retourne ≥2
    - `grep -c "village_portal_home" "app/(tabs)/village.tsx"` retourne 1
    - `grep -c "<PortalSprite" "app/(tabs)/village.tsx"` retourne 1
    - `grep -c "Retour à la ferme" "app/(tabs)/village.tsx"` retourne 1
    - `grep -c "styles.backBtn" "app/(tabs)/village.tsx"` retourne 0 (bouton ET style supprimés)
    - `grep -c "styles.backArrow" "app/(tabs)/village.tsx"` retourne 0
    - `grep -c "styles.headerSpacer" "app/(tabs)/village.tsx"` retourne 0
    - `grep -c "backBtn:" "app/(tabs)/village.tsx"` retourne 0
    - `grep -c "backArrow:" "app/(tabs)/village.tsx"` retourne 0
    - `grep -c "headerSpacer:" "app/(tabs)/village.tsx"` retourne 0
    - `grep -cE "<Text.*>‹</Text>" "app/(tabs)/village.tsx"` retourne 0 (plus de flèche retour)
    - `grep -c "Animated.View" "app/(tabs)/village.tsx"` retourne ≥1 (root wrapped)
    - `npx tsc --noEmit` passe sans nouvelle erreur
  </acceptance_criteria>
  <done>
`village.tsx` a son root wrappé dans `<Animated.View>` avec fadeStyle, handler `handleReturnPortalPress` déclenche `withTiming(0, 400ms)` + `runOnJS(router.replace)('/(tabs)/tree')`, `useFocusEffect` reset l'opacité au retour, `<PortalSprite>` rendu en overlay à la position du slot `village_portal_home`, bouton header `‹` + styles associés complètement supprimés. VILL-11 + VILL-12 couverts. Fade 400ms symétrique à l'aller Phase 28.
  </done>
</task>

</tasks>

<verification>
## Vérifications post-plan
- `npx tsc --noEmit` passe sans nouvelle erreur
- `tree.tsx` : plus de déclaration locale `PortalSprite`, plus de `SPRING_PORTAL` local, plus d'emoji 🏛️, plus des 3 styles orphelins, usage `<PortalSprite onPress={handlePortalPress} />` maintenu
- `village.tsx` : root en `Animated.View` avec fadeStyle, `handleReturnPortalPress` utilise `withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) })` + `runOnJS(router.replace)('/(tabs)/tree')`, `useFocusEffect` reset opacity, `<PortalSprite />` rendu à `portalSlot.x/y * mapSize`, `backBtn` + `backArrow` + `headerSpacer` intégralement supprimés du JSX ET du StyleSheet
- `components/village/PortalSprite.tsx` existe, signature `{ onPress, x?, y?, accessibilityLabel? }`, `require('../../assets/items/portail.png')` embarqué, glow `colors.catJeux`, spring config `SPRING_PORTAL` constante module, `Haptics.selectionAsync()`
- `lib/village/grid.ts` contient 11 entrées (4 originales + 6 avatars Plan 01 + 1 portal home Plan 02)
- Aucune hex hardcodée introduite
- Durée fade 400ms exacte, cohérente avec Phase 28 D-02
- `router.replace` (pas `push`) côté retour village → ferme
- Aucune dépendance npm ajoutée (ARCH-05 respecté)
</verification>

<success_criteria>
VILL-11 : portail pixel art symétrique des deux côtés (`portail.png` dans ferme ET village), extracted en composant partagé `components/village/PortalSprite.tsx`, rendu dans `village.tsx` au slot `village_portal_home` (0.85, 0.85), seul point de sortie (bouton header supprimé).
VILL-12 : fade cross-dissolve Reanimated 400ms au tap portail retour (`withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) })` + `runOnJS(router.replace)`), symétrique à l'aller Phase 28, `useFocusEffect` reset opacity au retour depuis la ferme.
</success_criteria>

<output>
After completion, create `.planning/phases/29-avatars-vivants-portail-retour/29-02-SUMMARY.md` documenting:
- Files modified/created
- Key decisions applied (D-16, D-17, D-18, D-19, D-20, D-21, D-22, D-23, CD-04)
- Pitfalls mitigated (Pitfall 3 useFocusEffect reset, Pitfall 7 styles portal cleanup)
- Confirmation que ferme non-régressée (portail ferme fonctionne avec sprite pixel art identique au comportement Phase 28)
- TSC result
- Next step : ship + device test (`/ship` pour validation finale Phase 29)
</output>
