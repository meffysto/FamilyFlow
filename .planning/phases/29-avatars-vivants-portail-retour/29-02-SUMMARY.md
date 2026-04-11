---
phase: 29
plan: 02
subsystem: village
tags: [portail, navigation, reanimated, fade, pixel-art, symetrie]
requires:
  - lib/village/grid.ts VILLAGE_GRID (10 entrées post-Plan 01)
  - lib/village/types.ts VillageRole ('portal' existait déjà)
  - assets/items/portail.png (178 KB)
  - contexts/ThemeContext useThemeColors colors.catJeux
  - expo-router useFocusEffect, useRouter, router.replace
  - react-native-reanimated withTiming, runOnJS, Easing.out
provides:
  - components/village/PortalSprite.tsx (composant partagé glow + scale spring + sprite)
  - VILLAGE_GRID étendue avec entrée village_portal_home
affects:
  - app/(tabs)/tree.tsx (import du composant partagé, suppression déclaration locale + emoji + styles)
  - app/(tabs)/village.tsx (root Animated.View + fade + handleReturnPortalPress + portail overlay + suppression backBtn)
tech-stack:
  added: []
  patterns:
    - Composant partagé avec double mode de positionnement (village overlay vs ferme diorama)
    - Fade cross-dissolve symétrique ferme ↔ village (400ms Easing.out)
    - router.replace côté retour (évite stack infini ping-pong)
    - useFocusEffect reset screenOpacity au retour focus
    - Centrage absolute sur (x, y) via left = x - size/2, top = y - size/2
key-files:
  created:
    - components/village/PortalSprite.tsx
  modified:
    - lib/village/grid.ts
    - app/(tabs)/tree.tsx
    - app/(tabs)/village.tsx
decisions:
  - PortalSprite extrait en composant partagé avec fallback bottom/right par défaut — préserve le layout tree.tsx sans forcer le caller à gérer la position
  - Sprite portail.png pixel art des deux côtés — symétrie visuelle (D-17)
  - router.replace côté village → ferme (pas push) — stack propre ping-pong
  - screenOpacity reset via useFocusEffect — évite écran invisible après ping-pong
  - Suppression intégrale du bouton header '‹' + styles orphelins — portail seul point de sortie
metrics:
  duration: 4min
  tasks: 3
  files_changed: 4
  requirements_covered: [VILL-11, VILL-12]
  completed: 2026-04-11
---

# Phase 29 Plan 02 : Portail retour + fade cross-dissolve — Summary

Extrait `PortalSprite` dans un composant partagé, remplace l'emoji 🏛️ de la ferme par le sprite pixel art `portail.png`, ajoute un portail retour symétrique dans la Place du Village avec transition fade 400ms Reanimated, et supprime le bouton header `‹` pour faire du portail le seul point de sortie. Ferme la boucle UX navigation village ↔ ferme pour le milestone v1.5.

## Requirements couverts

- **VILL-11** — Portail retour visuel symétrique : `components/village/PortalSprite.tsx` créé comme composant partagé (glow loop + scale spring + sprite `portail.png`), consommé par `tree.tsx` (ferme → village) ET `village.tsx` (village → ferme). Slot `village_portal_home` à (0.85, 0.85) dans `VILLAGE_GRID`. Bouton header `‹` supprimé — portail seul point de sortie.
- **VILL-12** — Transition fade cross-dissolve 400ms : `screenOpacity` sharedValue + `withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) })` + callback `runOnJS(router.replace)('/(tabs)/tree')`. Symétrique à l'aller Phase 28 (D-02). `useFocusEffect` reset opacity au retour.

## Files Modified/Created

### Created

- **`components/village/PortalSprite.tsx`** (nouveau) — Composant partagé :
  - Props `{ onPress, x?, y?, accessibilityLabel? }`.
  - Mode overlay village : si `x/y` fournis, position absolue centrée via `left = x - CONTAINER_SIZE/2, top = y - CONTAINER_SIZE/2`.
  - Mode diorama ferme : si `x/y` absents, position absolue `bottom: Spacing['4xl'], right: Spacing['2xl']` (reproduction exacte de l'ancien `styles.portalContainer` de tree.tsx pour préserver le layout sans modifier l'usage).
  - Glow loop : `withRepeat(withTiming(0.8, {duration:1200}), -1, true)` sur fond `colors.catJeux`.
  - Scale spring tap : `SPRING_PORTAL = { damping: 12, stiffness: 200 }` constante module.
  - Sprite `assets/items/portail.png` via `require()` + `resizeMode="contain"`.
  - `Haptics.selectionAsync()` au tap, hitSlop 10px.
  - Zéro hex hardcodée, tous tokens `Spacing.*`, `Radius.*`.

### Modified

- **`lib/village/grid.ts`** — `VILLAGE_GRID` étendue de **10 à 11 entrées** : ajout `{ id: 'village_portal_home', x: 0.85, y: 0.85, role: 'portal' }` (le role `'portal'` existait déjà dans le type `VillageRole` mais n'était pas utilisé — Phase 29 le consomme enfin per D-05).
- **`app/(tabs)/tree.tsx`** :
  - Ajout `import { PortalSprite } from '../../components/village/PortalSprite'`.
  - Suppression intégrale : commentaire section + `const SPRING_PORTAL` local + `function PortalSprite({ onPress }) { ... }` (lignes 302-361 d'origine).
  - Suppression des 3 styles orphelins : `portalContainer`, `portalGlow`, `portalEmoji` (lignes 3018-3034 d'origine).
  - Suppression des imports reanimated devenus orphelins : `withRepeat`, `withSpring` (aucune autre utilisation dans tree.tsx).
  - Usage `<PortalSprite onPress={handlePortalPress} />` inchangé (API stable grâce au mode fallback bottom/right).
  - Handler `handlePortalPress` + `useFocusEffect` reset opacity conservés tels quels.
- **`app/(tabs)/village.tsx`** :
  - Imports ajoutés : `useFocusEffect` depuis `expo-router`, `Easing` depuis `react-native-reanimated`, `PortalSprite` depuis `components/village`.
  - Nouveaux memos/state dans `VillageScreen()` : `portalSlot` (find `village_portal_home`), `screenOpacity` sharedValue, `fadeStyle` animated style.
  - Handler `handleReturnPortalPress` : `withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) })` + `runOnJS(router.replace)('/(tabs)/tree' as any)` dans la callback `finished`.
  - `useFocusEffect` wrap `useCallback(() => { screenOpacity.value = 1 }, [screenOpacity])` — reset au retour depuis la ferme (Pitfall P3).
  - Root `<View>` remplacé par `<Animated.View>` avec `fadeStyle` ajouté au style array, `</View>` final remplacé par `</Animated.View>`.
  - Header nettoyé : suppression du `<TouchableOpacity styles.backBtn>` + `<Text>‹</Text>` + `<View styles.headerSpacer />`. Le `<Text styles.headerTitle>Place du Village</Text>` devient seul enfant du header.
  - Nouveau JSX overlay dans `mapContainer` (sibling après tooltip) : `{portalSlot && <PortalSprite onPress={handleReturnPortalPress} x={portalSlot.x * mapSize.width} y={portalSlot.y * mapSize.height} accessibilityLabel="Retour à la ferme" />}`.
  - Suppression des 3 styles orphelins dans `StyleSheet.create` : `backBtn`, `backArrow`, `headerSpacer`.

## Key Decisions Applied

| Décision | Application |
|---|---|
| D-16 | Sprite `portail.png` des deux côtés (178 KB confirmé, require fonctionnel) |
| D-17 | Remplacement emoji 🏛️ côté ferme — via l'extraction du composant partagé, l'emoji disparaît automatiquement |
| D-18 | Entrée `village_portal_home` à (0.85, 0.85) role `'portal'` dans `VILLAGE_GRID` |
| D-19 | Bouton header `‹` supprimé — portail seul point de sortie, symétrie Phase 28 D-08 |
| D-20 + CD-04 | `PortalSprite` mutualisé dans `components/village/PortalSprite.tsx` — **extraction recommandée appliquée**, un seul point de vérité pour le glow animé + pixel art sprite |
| D-21 | `withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) })` avec callback `runOnJS(router.replace)` |
| D-22 | `useFocusEffect(useCallback(() => { screenOpacity.value = 1 }, [screenOpacity]))` reset au focus |
| D-23 | `router.replace` (pas `push`) côté retour — évite stack infini ping-pong |

## Pitfalls mitigés (RESEARCH.md)

- **Pitfall 3 (useFocusEffect reset screenOpacity)** — `useFocusEffect` ajouté dans `village.tsx` symétrique à `tree.tsx:422-425`. Au retour depuis la ferme via le portail aller, l'écran village regagne le focus avec opacity = 1 (évite le bug "écran invisible après ping-pong").
- **Pitfall 7 (styles portalEmoji cleanup)** — Les 3 styles `portalContainer`, `portalGlow`, `portalEmoji` sont intégralement supprimés de `tree.tsx`, plus d'incompatibilité `fontSize` vs `<Image>`. Le composant partagé gère ses propres dimensions (`width: 48, height: 48` explicite) avec `resizeMode="contain"`.

## Composant partagé — Design note

**Problème** : l'usage original `<PortalSprite onPress={handlePortalPress} />` dans `tree.tsx:2130` comptait sur les styles internes du composant (`position: 'absolute', bottom, right`). Extraire naïvement en ignorant ces valeurs aurait cassé le layout de la ferme.

**Solution appliquée** : le composant partagé a deux modes de positionnement exclusifs :
- **Mode village overlay** (props `x, y` fournies) — position calculée `left = x - CONTAINER_SIZE/2, top = y - CONTAINER_SIZE/2` pour centrer le sprite sur les coordonnées slot.
- **Mode diorama ferme** (props `x, y` absentes) — fallback `bottom: Spacing['4xl'], right: Spacing['2xl']` reproduisant exactement l'ancien `styles.portalContainer`.

Dans les deux modes, `position: 'absolute'` est déjà dans `styles.container`, donc l'ajout conditionnel de `bottom/right` ou `left/top` complète le positionnement. Résultat : l'usage `tree.tsx` reste API-compatible sans modification, et `village.tsx` passe simplement `x/y` du slot.

## TSC Result

`npx tsc --noEmit` passe sans nouvelle erreur. Seules les erreurs pré-existantes documentées dans `CLAUDE.md` (MemoryEditor.tsx, cooklang.ts, useVault.ts) subsistent — exclues du grep de vérification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Composant partagé avec fallback bottom/right pour préserver le layout tree.tsx**
- **Found during:** Task 1 (analyse pré-écriture)
- **Issue:** Le plan décrit le composant partagé avec position `left/top` uniquement quand `x/y` fournis, et "pas de style de position" sinon. Mais l'usage `tree.tsx:2130` (`<PortalSprite onPress={handlePortalPress} />`) s'attendait à un positionnement `position: absolute, bottom: Spacing['4xl'], right: Spacing['2xl']` fourni par l'ancien `styles.portalContainer`. Sans ce fallback dans le composant partagé, la ferme aurait perdu son portail flottant en coin bas-droit (régression visuelle directe).
- **Fix:** Ajouté un `positionStyle` conditionnel dans le composant partagé : si `x/y` fournis → mode overlay (`left: x - size/2, top: y - size/2`), sinon → mode diorama (`bottom: Spacing['4xl'], right: Spacing['2xl']`). `position: 'absolute'` reste dans `styles.container` commun aux deux modes. Documenté dans le JSDoc de la prop `x/y` et dans la section "Composant partagé — Design note" ci-dessus.
- **Files modified:** components/village/PortalSprite.tsx
- **Commit:** b3affa8

**2. [Rule 3 - Blocking] Suppression imports reanimated orphelins dans tree.tsx**
- **Found during:** Task 2 (post-suppression fonction locale)
- **Issue:** Après extraction de la fonction `PortalSprite` locale, les imports `withRepeat` et `withSpring` de `react-native-reanimated` dans `tree.tsx` sont devenus orphelins (0 occurrence dans le fichier). Sans fix, génère un warning potentiel et pollue l'historique d'imports.
- **Fix:** Supprimé `withSpring` et `withRepeat` de l'import `react-native-reanimated`. Vérifié par grep que les deux symboles ont zéro occurrence ailleurs dans le fichier avant suppression.
- **Files modified:** app/(tabs)/tree.tsx
- **Commit:** 798b709

Aucune autre déviation — plan exécuté comme écrit pour le reste.

## Confirmation non-régression ferme

Le portail ferme → village continue à fonctionner avec :
- **Même glow loop** (pattern `withRepeat(withTiming, -1, true)`, durée 1200ms, opacity 0.4→0.8) — identique au comportement Phase 28.
- **Même scale spring** (`SPRING_PORTAL = { damping: 12, stiffness: 200 }`, `withSpring(0.92)` → `withSpring(1)`).
- **Même positionnement** (bottom-right du diorama via fallback du composant partagé).
- **Même Haptics** (`selectionAsync()`) et même handler `handlePortalPress` avec fade 400ms + `runOnJS(router.push)`.
- **Différence visuelle unique** : sprite `portail.png` pixel art au lieu de l'emoji 🏛️ (objectif de la tâche).

Le code de `tree.tsx` compile sans erreur TypeScript — aucun symbole supprimé n'était encore référencé ailleurs.

## Commits

| Task | Description | Commit |
|---|---|---|
| 1 | Composant partagé PortalSprite + slot village_portal_home | `b3affa8` |
| 2 | tree.tsx refactor: import PortalSprite, suppression locale + emoji + styles | `798b709` |
| 3 | village.tsx: fade + handleReturnPortalPress + PortalSprite overlay + suppression backBtn | `2ed270e` |

## Next Step

`/ship` : validation finale Phase 29 — type-check complet + privacy check + commit FR + push. Après quoi, test device physique (`npx expo run:ios --device`) pour valider :
- Portail côté ferme : sprite pixel art visible, glow animé, scale spring au tap, fade 400ms à l'aller.
- Portail côté village : position coin bas-droit (0.85, 0.85), glow/spring/haptics identiques, fade 400ms au retour.
- Aucun bouton `‹` dans le header village.
- Ping-pong ferme ↔ village fluide sans écran invisible (validation Pitfall P3).
- Avatars compagnon (Plan 01) co-habitent avec le portail sans collision visuelle.

## Self-Check: PASSED

- Files: components/village/PortalSprite.tsx FOUND
- Commits: b3affa8 FOUND, 798b709 FOUND, 2ed270e FOUND
