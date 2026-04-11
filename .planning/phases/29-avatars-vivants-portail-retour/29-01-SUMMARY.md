---
phase: 29
plan: 01
subsystem: village
tags: [avatars, pixel-art, reanimated, tooltip, village]
requires:
  - lib/village/types.ts VillageRole
  - lib/village/grid.ts VILLAGE_GRID
  - lib/mascot/companion-engine.ts getCompanionStage
  - hooks/useGarden.ts gardenData.contributions + currentWeekStart
  - components/mascot/CompanionSlot.tsx (pattern alternance idle)
provides:
  - lib/mascot/companion-sprites.ts COMPANION_SPRITES (module partagé)
  - components/village/VillageAvatar.tsx (sprite + halo + press)
  - components/village/AvatarTooltip.tsx (bulle flottante auto-dismiss)
  - VILLAGE_GRID étendue (6 slots avatar)
  - VillageRole étendu ('avatar')
affects:
  - app/(tabs)/village.tsx (overlay avatars + tooltip state)
  - components/mascot/CompanionSlot.tsx (consomme le mapping partagé)
tech-stack:
  added: []
  patterns:
    - React.memo pour list items rendus × 6
    - cancelAnimation cleanup sur transitions actif↔inactif
    - timer ref + cleanup unmount pour auto-dismiss
    - comparaison string ISO lexicographique pour filtre weekStart
    - tri alphabétique localeCompare pour assignation déterministe slot
key-files:
  created:
    - lib/mascot/companion-sprites.ts
    - components/village/VillageAvatar.tsx
    - components/village/AvatarTooltip.tsx
  modified:
    - lib/village/types.ts
    - lib/village/grid.ts
    - components/mascot/CompanionSlot.tsx
    - app/(tabs)/village.tsx
decisions:
  - Sprites compagnon extraits dans module partagé (DRY entre CompanionSlot + VillageAvatar)
  - Comparaison weekStart par string ISO (>=) — évite parsing Date et respecte le format museum
  - Tri alphabétique sur profile.id pour slot assignment — stable, déterministe, zero persistance
  - weeklyContribs memo distinct de memberContribs (semaine vs global)
  - Overlay rendu comme siblings du TileMapRenderer (pas children — renderer est pointerEvents none)
metrics:
  duration: 7min
  tasks: 3
  files_changed: 7
  requirements_covered: [VILL-01, VILL-02, VILL-03]
  completed: 2026-04-11
---

# Phase 29 Plan 01 : Avatars vivants — Summary

Peupler la Place du Village avec 6 slots d'avatars sprite compagnon pixel art, halo glow vert pulsant pour les profils actifs cette semaine, et tooltip auto-dismiss 2.5s au tap. Infrastructure posée pour le Plan 02 (portail retour).

## Requirements couverts

- **VILL-01** — Avatar positionné fixe par profil : 6 slots `village_avatar_slot_{0..5}` dans VILLAGE_GRID, assignation déterministe par tri alphabétique `profile.id`, sprite compagnon pixel art via `COMPANION_SPRITES[species][stage]`
- **VILL-02** — Indicateur actif/inactif hebdo : halo `colors.success` pulsant (withRepeat 2s) pour profils ayant ≥1 contribution dans `gardenData.currentWeekStart`, opacité 0.55 pour inactifs
- **VILL-03** — Bulle tap auto-dismiss : tooltip flottant FR `[Prénom] — X contributions cette semaine` (ou `pas encore contribué` si 0), dismiss auto 2.5s, animations entrée/sortie Reanimated

## Files Modified/Created

### Created

- **`lib/mascot/companion-sprites.ts`** (nouveau module partagé) — `COMPANION_SPRITES` extrait de CompanionSlot.tsx pour consommation double (CompanionSlot + VillageAvatar). 5 espèces × 3 stages × 2 frames = 30 `require()`.
- **`components/village/VillageAvatar.tsx`** — React.memo sprite compagnon pixel art, halo actif pulsant via `withRepeat(withTiming(0.8, {duration:2000}), -1, true)`, `cancelAnimation` cleanup sur unmount et transitions, alternance `idle_1`/`idle_2` via setTimeout 500ms (pattern CompanionSlot), `Pressable` avec `Haptics.selectionAsync()`, hitSlop 8px, skip silencieux si `!profile.companion` (D-03).
- **`components/village/AvatarTooltip.tsx`** — Bulle `useThemeColors().colors.card` avec `Radius.lg` + shadow, animations opacity/translateY via Reanimated `withTiming`, auto-dismiss 2.5s via setTimeout, clamp horizontal `Math.max(Spacing.md, Math.min(containerWidth - MAX_WIDTH - Spacing.md, rawLeft))` (Pitfall 6), texte FR D-12.

### Modified

- **`lib/village/types.ts`** — `VillageRole` étendu avec `'avatar'`.
- **`lib/village/grid.ts`** — `VILLAGE_GRID` étendue de 4 à **10 entrées** (4 existantes + 6 slots avatars aux coordonnées `0.35/0.40`, `0.65/0.40`, `0.30/0.55`, `0.70/0.55`, `0.40/0.72`, `0.60/0.72`).
- **`components/mascot/CompanionSlot.tsx`** — déclaration locale `const COMPANION_SPRITES` supprimée, remplacée par `import { COMPANION_SPRITES } from '../../lib/mascot/companion-sprites'`.
- **`app/(tabs)/village.tsx`** — nouveaux imports (`VillageAvatar`, `AvatarTooltip`, `VILLAGE_GRID`), nouveaux memos (`weeklyContribs`, `sortedActiveProfiles`, `avatarSlots`), state `tooltip` + `dismissTimerRef`, `handleAvatarPress` memoized, cleanup timer au unmount, overlay JSX `{sortedActiveProfiles.slice(0, 6).map(...)}` + tooltip conditionnel dans `mapContainer` comme siblings du `TileMapRenderer`. `useEffect` + `useRef` ajoutés aux imports React.

## Key Decisions Applied

| Décision | Application |
|---|---|
| D-01 | Sprites pixel art compagnon, pas d'emojis — `<Animated.Image>` + `COMPANION_SPRITES` |
| D-02 | Composant dédié `VillageAvatar.tsx`, pas de réutilisation de `ReactiveAvatar` |
| D-03 | Skip silencieux des profils sans `companion` (early return null) |
| D-04 | 6 slots fixes `village_avatar_slot_0..5` dans `VILLAGE_GRID` |
| D-06 | Coordonnées proposées utilisées telles quelles (ajustables sur device) |
| D-07 | Tri alphabétique `profile.id.localeCompare` dans `sortedActiveProfiles` |
| D-09 | "Actif cette semaine" = `contribution.timestamp >= currentWeekStart` (au moins 1) |
| D-10 | Halo `colors.success` pulse 2s opacity 0.5↔0.8, inactif opacity 0.55 |
| D-11 | Tooltip comme overlay local dans `mapContainer`, state `setTooltip` dans VillageScreen |
| D-12 | Copy FR conditionnelle (`X contributions cette semaine` / `pas encore contribué`) |
| D-13 | Auto-dismiss 2.5s via `setTimeout` stocké dans `dismissTimerRef` |
| D-14 | Animations Reanimated `withTiming` 180ms entrée / 150ms sortie + translateY -4→0 |
| D-15 | `Pressable` + `Haptics.selectionAsync()` + hitSlop 8px |

## Pitfalls mitigés (RESEARCH.md)

- **Pitfall 1 (overlay sibling)** — Les avatars et le tooltip sont rendus comme siblings du `TileMapRenderer` dans `styles.mapContainer`, PAS comme children (le renderer est `pointerEvents="none"`).
- **Pitfall 4 (timer ref cleanup)** — `dismissTimerRef` via `useRef`, cleanup dans `useEffect` unmount et à chaque nouveau tap.
- **Pitfall 5 (weekStart ISO comparison)** — Comparaison lexicographique string ISO `c.timestamp >= weekStart` (valide car `'YYYY-MM-DDTHH:mm:ss' >= 'YYYY-MM-DD'`), zéro parsing Date.
- **Pitfall 6 (tooltip clamp horizontal)** — `Math.max(Spacing.md, Math.min(containerWidth - MAX_WIDTH - Spacing.md, rawLeft))` dans AvatarTooltip.
- **Pitfall 8 (cancelAnimation)** — `cancelAnimation(haloOpacity)` au cleanup `useEffect` et sur transition actif→inactif pour éviter les fuites d'animation.

## TSC Result

`npx tsc --noEmit` passe sans nouvelle erreur (TypeScript compilation completed). Aucune régression détectée hors des erreurs pré-existantes documentées dans CLAUDE.md.

## Deviations from Plan

**None** — plan exécuté exactement comme écrit. Aucun bug rencontré, aucune fonctionnalité critique manquante, aucun blocage. Les 3 tasks ont appliqué leurs étapes à la lettre.

## Commits

| Task | Description | Commit |
|---|---|---|
| 1 | Extension data layer village (types + grid + sprites extraction) | `7d67b51` |
| 2 | Composants VillageAvatar + AvatarTooltip | `5f554a5` |
| 3 | Intégration overlay dans village.tsx | `fcd0669` |

## Next Step

**Plan 02** : portail retour village → ferme — VILL-11 (portail symétrique + remplacement emoji `🏛️` par sprite `portail.png` des deux côtés) + VILL-12 (fade cross-dissolve 400ms `runOnJS(router.replace)` symétrique à l'aller + `useFocusEffect` reset opacity) + suppression du `backBtn` header `‹`.

## Self-Check: PASSED

- Files: lib/mascot/companion-sprites.ts FOUND, components/village/VillageAvatar.tsx FOUND, components/village/AvatarTooltip.tsx FOUND
- Commits: 7d67b51 FOUND, 5f554a5 FOUND, fcd0669 FOUND
