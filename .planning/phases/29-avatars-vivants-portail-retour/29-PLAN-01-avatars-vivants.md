---
phase: 29-avatars-vivants-portail-retour
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/village/types.ts
  - lib/village/grid.ts
  - lib/mascot/companion-sprites.ts
  - components/mascot/CompanionSlot.tsx
  - components/village/VillageAvatar.tsx
  - components/village/AvatarTooltip.tsx
  - app/(tabs)/village.tsx
autonomous: true
requirements:
  - VILL-01
  - VILL-02
  - VILL-03
must_haves:
  truths:
    - "User voit un avatar sprite compagnon pixel art par profil actif (ayant un companion) positionné à un slot fixe sur la carte village"
    - "User voit un halo vert pulsant (colors.success) derrière l'avatar d'un profil qui a au moins 1 contribution dans la semaine courante (gardenData.currentWeekStart)"
    - "User voit un avatar à opacité 0.55 sans halo pour un profil sans contribution cette semaine"
    - "User peut tap sur un avatar pour afficher une bulle '[Prénom] — X contributions cette semaine' qui se dismiss après 2.5s"
    - "L'assignation profil → slot est stable entre restarts (tri alphabétique sur profile.id)"
  artifacts:
    - path: "lib/village/types.ts"
      provides: "VillageRole étendu avec 'avatar'"
      contains: "'avatar'"
    - path: "lib/village/grid.ts"
      provides: "VILLAGE_GRID avec 6 slots avatar"
      contains: "village_avatar_slot_5"
    - path: "lib/mascot/companion-sprites.ts"
      provides: "COMPANION_SPRITES mapping partagé"
      exports: ["COMPANION_SPRITES"]
    - path: "components/village/VillageAvatar.tsx"
      provides: "Composant sprite compagnon + halo + Pressable"
      exports: ["VillageAvatar"]
    - path: "components/village/AvatarTooltip.tsx"
      provides: "Tooltip flottant animé auto-dismiss 2.5s"
      exports: ["AvatarTooltip"]
    - path: "app/(tabs)/village.tsx"
      provides: "Overlay avatars + tooltip state + handleAvatarPress"
      contains: "sortedActiveProfiles"
  key_links:
    - from: "components/village/VillageAvatar.tsx"
      to: "lib/mascot/companion-sprites.ts"
      via: "import COMPANION_SPRITES"
      pattern: "from.*companion-sprites"
    - from: "components/village/VillageAvatar.tsx"
      to: "lib/mascot/companion-engine.ts"
      via: "getCompanionStage(profile.level)"
      pattern: "getCompanionStage"
    - from: "app/(tabs)/village.tsx"
      to: "components/village/VillageAvatar.tsx"
      via: "import + render × 6 dans mapContainer"
      pattern: "<VillageAvatar"
    - from: "app/(tabs)/village.tsx"
      to: "hooks/useGarden"
      via: "gardenData.contributions + currentWeekStart filter"
      pattern: "weeklyContribs"
---

<objective>
Peupler la carte village avec 6 slots avatars pixel art (sprite compagnon par profil actif), halo glow vert pulsant pour les profils ayant contribué cette semaine, et bulle tooltip auto-dismiss 2.5s au tap. Couvre VILL-01 (avatars positionnés), VILL-02 (indicateur hebdo), VILL-03 (tooltip tap).

Purpose: Donner vie à la Place du Village avec une présence visuelle des membres famille qui reflète l'activité réelle de la semaine. Signal fort identité visuelle milestone v1.5 : sprites pixel art propriétaires plutôt qu'emojis.

Output:
- Extension type `VillageRole` + grille `VILLAGE_GRID` (6 slots)
- Extraction `COMPANION_SPRITES` dans module partagé
- 2 nouveaux composants (`VillageAvatar`, `AvatarTooltip`)
- Intégration overlay dans `app/(tabs)/village.tsx`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/29-avatars-vivants-portail-retour/29-CONTEXT.md
@.planning/phases/29-avatars-vivants-portail-retour/29-RESEARCH.md
@.planning/phases/29-avatars-vivants-portail-retour/29-UI-SPEC.md
@CLAUDE.md

<interfaces>
<!-- Types et contrats existants que l'executor doit utiliser directement -->

From lib/village/types.ts (existant — à étendre):
```typescript
export type VillageRole = 'fountain' | 'stall' | 'board' | 'portal'; // → ajouter 'avatar'
export interface VillageCell {
  id: string;        // DOIT commencer par 'village_'
  x: number;         // fraction largeur conteneur (0-1)
  y: number;         // fraction hauteur conteneur (0-1)
  role: VillageRole;
}
```

From lib/mascot/companion-types.ts:
```typescript
export type CompanionSpecies = 'chat' | 'chien' | 'lapin' | 'renard' | 'herisson';
export type CompanionStage = 'bebe' | 'jeune' | 'adulte';
export interface CompanionData {
  activeSpecies: CompanionSpecies;
  // ...
}
export const COMPANION_UNLOCK_LEVEL = 1;
```

From lib/mascot/companion-engine.ts:
```typescript
export function getCompanionStage(level: number): CompanionStage;
// bebe 1-5, jeune 6-10, adulte 11+
```

From lib/types.ts:
```typescript
interface Profile {
  id: string;
  name: string;
  level: number;
  statut?: 'adulte' | 'enfant' | 'grossesse' | ...;
  companion?: CompanionData | null;
  // ...
}
```

From hooks/useGarden.ts:
```typescript
const { gardenData, progress, currentTarget, ... } = useGarden();
// gardenData.contributions: VillageContribution[]
// gardenData.currentWeekStart: string (YYYY-MM-DD)
interface VillageContribution {
  timestamp: string;          // ISO 8601 sans Z — ex: '2026-04-10T14:32:00'
  profileId: string;
  type: 'harvest' | 'task';
  amount: number;             // toujours 1
}
```

From components/mascot/CompanionSlot.tsx:95-121 (existant — à extraire):
```typescript
const COMPANION_SPRITES: Record<CompanionSpecies, Record<CompanionStage, { idle_1: any; idle_2: any }>> = {
  chat: { bebe: { idle_1: require('../../assets/garden/animals/chat/bebe/idle_1.png'), ... }, ... },
  // 5 espèces × 3 stages × 2 frames = 30 require()
};
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Extension data layer village — types + grille + extraction COMPANION_SPRITES</name>
  <files>
    lib/village/types.ts
    lib/village/grid.ts
    lib/mascot/companion-sprites.ts
    components/mascot/CompanionSlot.tsx
  </files>
  <read_first>
    - lib/village/types.ts (état actuel : VillageRole sans 'avatar')
    - lib/village/grid.ts (état actuel : 4 entrées fountain/stall/stall/board)
    - components/mascot/CompanionSlot.tsx lignes 1-130 (pour copier exactement le mapping COMPANION_SPRITES existant lignes 95-121)
    - lib/mascot/companion-types.ts (pour import types CompanionSpecies, CompanionStage)
  </read_first>
  <action>
Étape 1 — Étendre `lib/village/types.ts` ligne 6 :
```typescript
// AVANT
export type VillageRole = 'fountain' | 'stall' | 'board' | 'portal';
// APRÈS
export type VillageRole = 'fountain' | 'stall' | 'board' | 'portal' | 'avatar';
```
Ajouter commentaire FR au-dessus : `// Phase 29 : ajout role 'avatar' (VILL-01)`.

Étape 2 — Étendre `lib/village/grid.ts` : ajouter 6 slots avatar après l'entrée `village_board`. Garder les 4 entrées existantes intactes. Final state :
```typescript
export const VILLAGE_GRID: VillageCell[] = [
  // Phase 25 — existing
  { id: 'village_fountain', x: 0.50, y: 0.45, role: 'fountain' },
  { id: 'village_stall_0',  x: 0.22, y: 0.65, role: 'stall' },
  { id: 'village_stall_1',  x: 0.78, y: 0.65, role: 'stall' },
  { id: 'village_board',    x: 0.15, y: 0.25, role: 'board' },

  // Phase 29 — slots avatars (per D-04, D-06)
  { id: 'village_avatar_slot_0', x: 0.35, y: 0.40, role: 'avatar' },
  { id: 'village_avatar_slot_1', x: 0.65, y: 0.40, role: 'avatar' },
  { id: 'village_avatar_slot_2', x: 0.30, y: 0.55, role: 'avatar' },
  { id: 'village_avatar_slot_3', x: 0.70, y: 0.55, role: 'avatar' },
  { id: 'village_avatar_slot_4', x: 0.40, y: 0.72, role: 'avatar' },
  { id: 'village_avatar_slot_5', x: 0.60, y: 0.72, role: 'avatar' },
];
```
NE PAS ajouter le slot `village_portal_home` dans cette tâche — il est géré dans le Plan 02.

Étape 3 — Créer `lib/mascot/companion-sprites.ts` (nouveau fichier) : copier EXACTEMENT le bloc `COMPANION_SPRITES` de `components/mascot/CompanionSlot.tsx` lignes 95-121, adapter les paths `require('../../assets/...')` en `require('../../assets/...')` (depuis `lib/mascot/` c'est toujours `../../assets/`). Exporter comme nommé :
```typescript
// lib/mascot/companion-sprites.ts
// Mapping partagé sprite compagnon par espèce × stade × frame.
// Extrait de CompanionSlot.tsx en Phase 29 pour consommation double (CompanionSlot + VillageAvatar).
import type { CompanionSpecies, CompanionStage } from './companion-types';

export const COMPANION_SPRITES: Record<CompanionSpecies, Record<CompanionStage, { idle_1: any; idle_2: any }>> = {
  chat: {
    bebe:   { idle_1: require('../../assets/garden/animals/chat/bebe/idle_1.png'),   idle_2: require('../../assets/garden/animals/chat/bebe/idle_2.png') },
    jeune:  { idle_1: require('../../assets/garden/animals/chat/jeune/idle_1.png'),  idle_2: require('../../assets/garden/animals/chat/jeune/idle_2.png') },
    adulte: { idle_1: require('../../assets/garden/animals/chat/adulte/idle_1.png'), idle_2: require('../../assets/garden/animals/chat/adulte/idle_2.png') },
  },
  chien: {
    bebe:   { idle_1: require('../../assets/garden/animals/chien/bebe/idle_1.png'),   idle_2: require('../../assets/garden/animals/chien/bebe/idle_2.png') },
    jeune:  { idle_1: require('../../assets/garden/animals/chien/jeune/idle_1.png'),  idle_2: require('../../assets/garden/animals/chien/jeune/idle_2.png') },
    adulte: { idle_1: require('../../assets/garden/animals/chien/adulte/idle_1.png'), idle_2: require('../../assets/garden/animals/chien/adulte/idle_2.png') },
  },
  lapin: {
    bebe:   { idle_1: require('../../assets/garden/animals/lapin/bebe/idle_1.png'),   idle_2: require('../../assets/garden/animals/lapin/bebe/idle_2.png') },
    jeune:  { idle_1: require('../../assets/garden/animals/lapin/jeune/idle_1.png'),  idle_2: require('../../assets/garden/animals/lapin/jeune/idle_2.png') },
    adulte: { idle_1: require('../../assets/garden/animals/lapin/adulte/idle_1.png'), idle_2: require('../../assets/garden/animals/lapin/adulte/idle_2.png') },
  },
  renard: {
    bebe:   { idle_1: require('../../assets/garden/animals/renard/bebe/idle_1.png'),   idle_2: require('../../assets/garden/animals/renard/bebe/idle_2.png') },
    jeune:  { idle_1: require('../../assets/garden/animals/renard/jeune/idle_1.png'),  idle_2: require('../../assets/garden/animals/renard/jeune/idle_2.png') },
    adulte: { idle_1: require('../../assets/garden/animals/renard/adulte/idle_1.png'), idle_2: require('../../assets/garden/animals/renard/adulte/idle_2.png') },
  },
  herisson: {
    bebe:   { idle_1: require('../../assets/garden/animals/herisson/bebe/idle_1.png'),   idle_2: require('../../assets/garden/animals/herisson/bebe/idle_2.png') },
    jeune:  { idle_1: require('../../assets/garden/animals/herisson/jeune/idle_1.png'),  idle_2: require('../../assets/garden/animals/herisson/jeune/idle_2.png') },
    adulte: { idle_1: require('../../assets/garden/animals/herisson/adulte/idle_1.png'), idle_2: require('../../assets/garden/animals/herisson/adulte/idle_2.png') },
  },
};
```

Étape 4 — Modifier `components/mascot/CompanionSlot.tsx` lignes 95-121 : SUPPRIMER la déclaration locale `const COMPANION_SPRITES = { ... };` et REMPLACER par un import en tête du fichier :
```typescript
import { COMPANION_SPRITES } from '../../lib/mascot/companion-sprites';
```
Le reste du fichier (usage `COMPANION_SPRITES[species][stage]` etc.) est inchangé. Vérifier qu'aucune autre référence locale ne casse.

Étape 5 — Type check strict : `npx tsc --noEmit`. Doit exit 0 (les erreurs pré-existantes documentées dans CLAUDE.md — MemoryEditor.tsx, cooklang.ts, useVault.ts — peuvent rester, mais aucune nouvelle erreur ne doit apparaître).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -v -E "(MemoryEditor|cooklang|useVault)" | grep -E "error TS" ; test $? -eq 1</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "'avatar'" lib/village/types.ts` retourne ≥1
    - `grep -c "village_avatar_slot_5" lib/village/grid.ts` retourne 1
    - `grep -c "village_avatar_slot_0" lib/village/grid.ts` retourne 1
    - File `lib/mascot/companion-sprites.ts` existe et contient `export const COMPANION_SPRITES`
    - `grep -c "require.*garden/animals/chat/bebe/idle_1.png" lib/mascot/companion-sprites.ts` retourne 1
    - `grep -c "require.*garden/animals/herisson/adulte/idle_2.png" lib/mascot/companion-sprites.ts` retourne 1
    - `grep -c "from '../../lib/mascot/companion-sprites'" components/mascot/CompanionSlot.tsx` retourne 1
    - `grep -c "const COMPANION_SPRITES" components/mascot/CompanionSlot.tsx` retourne 0 (déclaration locale supprimée)
    - `npx tsc --noEmit` : aucune nouvelle erreur TS2xxx hors des fichiers pré-existants
    - VILLAGE_GRID contient maintenant 10 entrées (4 existantes + 6 avatars)
  </acceptance_criteria>
  <done>
Types étendus, grille étendue, COMPANION_SPRITES extrait et consommé depuis les deux sites (CompanionSlot + prêt pour VillageAvatar), type check passe.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Créer composants VillageAvatar + AvatarTooltip</name>
  <files>
    components/village/VillageAvatar.tsx
    components/village/AvatarTooltip.tsx
  </files>
  <read_first>
    - components/mascot/CompanionSlot.tsx lignes 695-820 (pattern alternance idle_1/idle_2 + overlay absolute)
    - app/(tabs)/tree.tsx lignes 303-361 (pattern glow loop Reanimated withRepeat → adapter pour halo pulse)
    - contexts/ThemeContext.tsx (signature useThemeColors et keys disponibles dans colors)
    - constants/spacing.ts (tokens Spacing.md, Spacing['2xl'], Radius.lg)
    - constants/typography.ts (FontSize.sm, FontWeight.normal)
    - lib/mascot/companion-engine.ts (signature getCompanionStage)
    - lib/types.ts (interface Profile, typage)
    - .planning/phases/29-avatars-vivants-portail-retour/29-RESEARCH.md section "Code Examples" Exemple 1 et Exemple 2 (patterns de référence)
  </read_first>
  <action>
Créer d'abord le dossier implicitement via Write de `components/village/VillageAvatar.tsx`.

**Étape 1 — `components/village/VillageAvatar.tsx`** (nouveau) :
```typescript
// components/village/VillageAvatar.tsx
// Phase 29 — Sprite compagnon pixel art sur la carte village avec halo actif/inactif.
// Per D-01, D-02, D-10 — VILL-01 + VILL-02.

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
import { COMPANION_SPRITES } from '../../lib/mascot/companion-sprites';
import type { Profile } from '../../lib/types';

const AVATAR_SIZE = 32;
const HALO_PAD = 12; // halo diameter = AVATAR_SIZE + HALO_PAD
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
const FRAME_MS = 500;
const INACTIVE_OPACITY = 0.55;
const HALO_MIN = 0.5;
const HALO_MAX = 0.8;
const HALO_DURATION = 2000;

interface VillageAvatarProps {
  profile: Profile;
  /** Position centrée en pixels (déjà convertie depuis slot fractionnel) */
  slotX: number;
  /** Position centrée en pixels (déjà convertie depuis slot fractionnel) */
  slotY: number;
  /** true si profil a ≥1 contribution cette semaine (per D-09) */
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

  // Pulse halo si actif (per D-10)
  useEffect(() => {
    if (isActive) {
      haloOpacity.value = HALO_MIN;
      haloOpacity.value = withRepeat(
        withTiming(HALO_MAX, { duration: HALO_DURATION }),
        -1,
        true,
      );
    } else {
      cancelAnimation(haloOpacity);
      haloOpacity.value = 0;
    }
    return () => cancelAnimation(haloOpacity);
  }, [isActive, haloOpacity]);

  // Alternance respiration idle_1/idle_2 (pattern CompanionSlot.tsx)
  useEffect(() => {
    const timer = setTimeout(() => setFrameIdx(f => (f === 0 ? 1 : 0)), FRAME_MS);
    return () => clearTimeout(timer);
  }, [frameIdx]);

  const haloStyle = useAnimatedStyle(() => ({ opacity: haloOpacity.value }));

  // D-03 : skip si pas de compagnon
  if (!profile.companion) return null;

  const species = profile.companion.activeSpecies;
  const stage = getCompanionStage(profile.level);
  const sprites = COMPANION_SPRITES[species][stage];
  const currentSprite = frameIdx === 0 ? sprites.idle_1 : sprites.idle_2;

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  const containerSize = AVATAR_SIZE + HALO_PAD;

  return (
    <View
      style={[
        styles.slot,
        {
          left: slotX - containerSize / 2,
          top: slotY - containerSize / 2,
          width: containerSize,
          height: containerSize,
        },
      ]}
      pointerEvents="box-none"
    >
      {isActive && (
        <Animated.View
          style={[
            styles.halo,
            {
              backgroundColor: colors.success,
              width: containerSize,
              height: containerSize,
              borderRadius: containerSize / 2,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  sprite: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  inactive: {
    opacity: INACTIVE_OPACITY,
  },
});
```

**Étape 2 — `components/village/AvatarTooltip.tsx`** (nouveau) :
```typescript
// components/village/AvatarTooltip.tsx
// Phase 29 — Bulle tooltip flottante au tap sur un VillageAvatar.
// Per D-11, D-12, D-13, D-14 — VILL-03.

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
const TRANSLATE_Y_START = -4;
const OFFSET_ABOVE_AVATAR = 48;

interface AvatarTooltipProps {
  profileName: string;
  count: number;
  /** Position centrée px de l'avatar cible */
  x: number;
  y: number;
  /** Largeur du container map pour clamp horizontal */
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
  const translateY = useSharedValue(TRANSLATE_Y_START);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: ENTER_MS });
    translateY.value = withTiming(0, { duration: ENTER_MS });

    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: EXIT_MS });
      translateY.value = withTiming(
        TRANSLATE_Y_START,
        { duration: EXIT_MS },
        (finished) => {
          if (finished) runOnJS(onDismiss)();
        },
      );
    }, DISMISS_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Clamp horizontal pour ne pas déborder (per Pitfall 6)
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
          top: y - OFFSET_ABOVE_AVATAR,
          backgroundColor: colors.card,
        },
        animStyle,
      ]}
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLabel={`Tooltip ${profileName}`}
    >
      <Text
        style={[
          styles.text,
          { color: count > 0 ? colors.text : colors.textMuted },
        ]}
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

**Étape 3 — Type check strict** : `npx tsc --noEmit` doit exit 0 (hors erreurs pré-existantes).

**IMPORTANT — conformité CLAUDE.md** :
- Tous les commentaires en français
- Aucune hex hardcodée (halo via `colors.success`, fond tooltip via `colors.card`)
- Animations 100% Reanimated (`useSharedValue` + `withTiming` + `withRepeat`)
- `React.memo` sur `VillageAvatar` (rendu × 6 en liste)
- Tokens `Spacing.*`, `Radius.*`, `FontSize.*`, `FontWeight.*` utilisés
- Hit slop `Spacing.md` × 4 directions
- `cancelAnimation` cleanup sur passage isActive → inactive (Pitfall 8)
- Clamp horizontal tooltip (Pitfall 6)
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -v -E "(MemoryEditor|cooklang|useVault)" | grep -E "error TS" ; test $? -eq 1</automated>
  </verify>
  <acceptance_criteria>
    - File `components/village/VillageAvatar.tsx` existe
    - File `components/village/AvatarTooltip.tsx` existe
    - `grep -c "React.memo" components/village/VillageAvatar.tsx` retourne ≥1
    - `grep -c "withRepeat" components/village/VillageAvatar.tsx` retourne 1
    - `grep -c "cancelAnimation" components/village/VillageAvatar.tsx` retourne ≥1
    - `grep -c "Haptics.selectionAsync" components/village/VillageAvatar.tsx` retourne 1
    - `grep -c "useThemeColors" components/village/VillageAvatar.tsx` retourne 1
    - `grep -c "COMPANION_SPRITES" components/village/VillageAvatar.tsx` retourne 1
    - `grep -c "getCompanionStage" components/village/VillageAvatar.tsx` retourne 1
    - `grep -c "if (!profile.companion) return null" components/village/VillageAvatar.tsx` retourne 1
    - `grep -c "INACTIVE_OPACITY = 0.55" components/village/VillageAvatar.tsx` retourne 1
    - `grep -c "withTiming(1, { duration: 180" components/village/AvatarTooltip.tsx` retourne 1
    - `grep -c "DISMISS_MS = 2500" components/village/AvatarTooltip.tsx` retourne 1
    - `grep -c "pas encore contribué" components/village/AvatarTooltip.tsx` retourne 1
    - `grep -c "cette semaine" components/village/AvatarTooltip.tsx` retourne ≥1
    - `grep -c "Spacing\\['2xl'\\]" components/village/AvatarTooltip.tsx` retourne ≥1
    - Aucune hex hardcodée dans VillageAvatar/AvatarTooltip (sauf `shadowColor: '#000'` qui est un pattern RN standard) : `grep -E "#[0-9A-Fa-f]{3,6}" components/village/VillageAvatar.tsx` retourne 0 lignes
    - `npx tsc --noEmit` passe sans nouvelle erreur
  </acceptance_criteria>
  <done>
Deux nouveaux composants `VillageAvatar` et `AvatarTooltip` créés, conformes aux patterns CLAUDE.md, type check OK. Prêts à être intégrés dans `village.tsx`.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Intégration overlay avatars + tooltip dans village.tsx</name>
  <files>
    app/(tabs)/village.tsx
  </files>
  <read_first>
    - app/(tabs)/village.tsx lignes 1-50 (imports existants)
    - app/(tabs)/village.tsx lignes 289-350 (VillageScreen début + memos existants)
    - app/(tabs)/village.tsx lignes 393-445 (render root + mapContainer + TileMapRenderer)
    - lib/village/grid.ts (pour import VILLAGE_GRID après Task 1)
    - components/village/VillageAvatar.tsx (créé en Task 2)
    - components/village/AvatarTooltip.tsx (créé en Task 2)
    - .planning/phases/29-avatars-vivants-portail-retour/29-RESEARCH.md section "Exemple 6 — Intégration dans village.tsx" et Pitfall 5 (week-start semantics)
  </read_first>
  <action>
**Ne PAS toucher** au bouton header `styles.backBtn` dans cette tâche — sa suppression est gérée dans Plan 02. Ici on ne fait QUE l'overlay avatars + tooltip.

**Étape 1 — Ajouter imports en tête de `app/(tabs)/village.tsx`** (après les imports existants) :
```typescript
import { VillageAvatar } from '../../components/village/VillageAvatar';
import { AvatarTooltip } from '../../components/village/AvatarTooltip';
import { VILLAGE_GRID } from '../../lib/village/grid';
import type { Profile } from '../../lib/types';
```
Vérifier que `useMemo`, `useRef`, `useCallback`, `useEffect`, `useState` sont déjà importés depuis 'react' (normalement oui). Vérifier que `VillageCell` type n'a pas besoin d'être importé (on travaille uniquement avec les entrées filtrées).

**Étape 2 — Ajouter dans le corps de `VillageScreen()` après les memos existants** (autour de la ligne 341 après `activeProfiles`) :

```typescript
  /** Contributions de la SEMAINE COURANTE par profil (distinct de memberContribs global) — per D-09, Pitfall 5 */
  const weeklyContribs = useMemo(() => {
    const weekStart = gardenData?.currentWeekStart;
    if (!weekStart) return {};
    const map: Record<string, number> = {};
    for (const c of gardenData?.contributions ?? []) {
      // Comparaison string ISO — format 'YYYY-MM-DDTHH:mm:ss' vs 'YYYY-MM-DD' : un timestamp
      // de la semaine courante est toujours >= weekStart lexicographiquement.
      if (c.timestamp >= weekStart) {
        map[c.profileId] = (map[c.profileId] ?? 0) + c.amount;
      }
    }
    return map;
  }, [gardenData?.contributions, gardenData?.currentWeekStart]);

  /** Profils actifs triés alphabétique par id pour assignation déterministe slot (per D-07) */
  const sortedActiveProfiles = useMemo(
    () => [...activeProfiles].sort((a, b) => a.id.localeCompare(b.id)),
    [activeProfiles],
  );

  /** Slots avatars depuis la grille */
  const avatarSlots = useMemo(
    () => VILLAGE_GRID.filter(c => c.role === 'avatar'),
    [],
  );

  /** State tooltip + timer ref (per D-13, Pitfall 4) */
  const [tooltip, setTooltip] = useState<{
    profileName: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAvatarPress = useCallback(
    (profile: Profile, slotX: number, slotY: number) => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
      const count = weeklyContribs[profile.id] ?? 0;
      setTooltip({ profileName: profile.name, count, x: slotX, y: slotY });
      dismissTimerRef.current = setTimeout(() => {
        setTooltip(null);
        dismissTimerRef.current = null;
      }, 2500);
    },
    [weeklyContribs],
  );

  // Cleanup timer au unmount (Pitfall 4)
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);
```

**Étape 3 — Modifier le JSX du `mapContainer`** (ligne ~429-440) : ajouter les overlays comme siblings APRÈS `<TileMapRenderer />` et DANS le même `<View style={styles.mapContainer}>`. Attention : le TileMapRenderer est pointerEvents none donc les avatars doivent être siblings, pas children. État actuel :

```typescript
<View
  style={[styles.mapContainer, { height: MAP_HEIGHT, marginHorizontal: -Spacing['2xl'] }]}
  onLayout={handleMapLayout}
>
  <TileMapRenderer
    treeStage="arbre"
    containerWidth={SCREEN_W}
    containerHeight={MAP_HEIGHT}
    season={season}
    mode="village"
  />
</View>
```

Devient :

```typescript
<View
  style={[styles.mapContainer, { height: MAP_HEIGHT, marginHorizontal: -Spacing['2xl'] }]}
  onLayout={handleMapLayout}
>
  <TileMapRenderer
    treeStage="arbre"
    containerWidth={SCREEN_W}
    containerHeight={MAP_HEIGHT}
    season={season}
    mode="village"
  />

  {/* Overlay avatars — per VILL-01, VILL-02 */}
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

  {/* Tooltip conditionnel — per VILL-03 */}
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
```

**Étape 4 — NE PAS toucher** :
- Le bloc header avec `styles.backBtn` (géré en Plan 02)
- La section "Membres actifs" plus bas dans le scroll (lignes ~524-553) qui utilise emoji — explicitement hors scope (Deferred)
- `TileMapRenderer` (stable, pointerEvents none)
- `memberContribs` memo existant (différent de `weeklyContribs`, les deux coexistent)

**Étape 5 — Type check** : `npx tsc --noEmit` doit exit 0 (hors erreurs pré-existantes).

**Contraintes CLAUDE.md à vérifier** :
- Commentaires FR
- `useCallback` sur handlers passés en props
- `useMemo` pour dérivations
- Pas de nouvelle hex hardcodée
- Pas d'animations RN `Animated` (ici uniquement Reanimated via les composants importés)
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -v -E "(MemoryEditor|cooklang|useVault)" | grep -E "error TS" ; test $? -eq 1</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "import { VillageAvatar }" "app/(tabs)/village.tsx"` retourne 1
    - `grep -c "import { AvatarTooltip }" "app/(tabs)/village.tsx"` retourne 1
    - `grep -c "import { VILLAGE_GRID }" "app/(tabs)/village.tsx"` retourne 1
    - `grep -c "const weeklyContribs" "app/(tabs)/village.tsx"` retourne 1
    - `grep -c "c.timestamp >= weekStart" "app/(tabs)/village.tsx"` retourne 1
    - `grep -c "sortedActiveProfiles" "app/(tabs)/village.tsx"` retourne ≥2 (définition + usage render)
    - `grep -c "localeCompare" "app/(tabs)/village.tsx"` retourne 1
    - `grep -c "avatarSlots" "app/(tabs)/village.tsx"` retourne ≥2
    - `grep -c "dismissTimerRef" "app/(tabs)/village.tsx"` retourne ≥3
    - `grep -c "handleAvatarPress" "app/(tabs)/village.tsx"` retourne ≥2
    - `grep -c "<VillageAvatar" "app/(tabs)/village.tsx"` retourne 1
    - `grep -c "<AvatarTooltip" "app/(tabs)/village.tsx"` retourne 1
    - `grep -c "setTimeout" "app/(tabs)/village.tsx"` retourne ≥1 (le 2500 dismiss)
    - `grep -c "2500" "app/(tabs)/village.tsx"` retourne ≥1
    - `grep -c ".slice(0, 6)" "app/(tabs)/village.tsx"` retourne 1
    - `grep -c "styles.backBtn" "app/(tabs)/village.tsx"` retourne ≥1 (PAS encore supprimé — Plan 02)
    - `grep -c "weeklyContribs\\[profile.id\\]" "app/(tabs)/village.tsx"` retourne ≥1
    - `npx tsc --noEmit` passe sans nouvelle erreur
  </acceptance_criteria>
  <done>
`village.tsx` rend 6 avatars pixel art en overlay au-dessus du TileMapRenderer, halo vert actif si contribution cette semaine, tooltip auto-dismiss au tap. VILL-01, VILL-02, VILL-03 couverts. Le portail retour (VILL-11, VILL-12) reste au Plan 02.
  </done>
</task>

</tasks>

<verification>
## Vérifications post-plan
- `npx tsc --noEmit` passe sans nouvelle erreur (hors pré-existantes CLAUDE.md-documentées)
- `VILLAGE_GRID` contient 10 entrées (4 + 6 avatars)
- `VillageRole` contient `'avatar'`
- `COMPANION_SPRITES` déclaré une seule fois dans le repo (dans `lib/mascot/companion-sprites.ts`)
- `CompanionSlot.tsx` et `VillageAvatar.tsx` importent `COMPANION_SPRITES` depuis le module partagé
- `village.tsx` rend overlay 6 avatars avec key `profile.id`, halo conditionnel, tooltip auto-dismiss 2.5s
- Aucune nouvelle hex hardcodée, toutes couleurs via `useThemeColors()`
- Aucune dépendance npm ajoutée
- FR partout (commentaires, labels accessibilité, copy tooltip)
</verification>

<success_criteria>
VILL-01 : 6 slots avatar définis dans VILLAGE_GRID, assignation déterministe par tri alphabétique profile.id, rendu sprite compagnon pixel art par profil ayant un companion.
VILL-02 : halo `colors.success` pulse withRepeat 2s pour profils actifs cette semaine, opacité 0.55 pour profils inactifs, calcul basé sur `gardenData.currentWeekStart`.
VILL-03 : tap avatar → `Haptics.selectionAsync()` + tooltip `[Prénom] — X contributions cette semaine` (ou `pas encore contribué` si 0), auto-dismiss 2.5s, animation entrée/sortie Reanimated.
</success_criteria>

<output>
After completion, create `.planning/phases/29-avatars-vivants-portail-retour/29-01-SUMMARY.md` documenting:
- Files modified/created
- Key decisions applied (D-01, D-02, D-03, D-04, D-06, D-07, D-09, D-10, D-11, D-12, D-13, D-14, D-15)
- Pitfalls mitigated (Pitfall 1 overlay sibling, Pitfall 4 timer ref cleanup, Pitfall 5 weekStart ISO comparison, Pitfall 8 cancelAnimation)
- TSC result
- Next step : execute Plan 02 (portail retour + fade)
</output>
