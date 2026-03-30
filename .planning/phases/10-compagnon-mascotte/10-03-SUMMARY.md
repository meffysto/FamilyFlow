---
phase: 10-compagnon-mascotte
plan: "03"
subsystem: ui
tags: [react-native, reanimated, expo-haptics, pixel-art, modal, mascot, companion]

# Dependency graph
requires:
  - phase: 10-compagnon-mascotte/10-01
    provides: Types CompanionSpecies/CompanionStage/CompanionMood + COMPANION_SPECIES_CATALOG + COMPANION_UNLOCK_LEVEL
  - phase: 10-compagnon-mascotte/10-02
    provides: companion-engine.ts (getCompanionStage, getCompanionMood, pickCompanionMessage) + setCompanion dans useVault/VaultContext
provides:
  - CompanionSlot.tsx : composant animé du compagnon avec idle frame swap, tap+saut+haptic, bulle message
  - CompanionPicker.tsx : modal pageSheet choix initial/switch compagnon (5 espèces, champ nom)
  - TreeView.tsx modifié : props companion/* + rendu CompanionSlot en overlay (z-15, après inhabitants)
  - tree.tsx modifié : orchestration complète companion (state, useFocusEffect greeting, handleCompanionTap, picker)
affects: [10-04, components/mascot/TreeView, app/(tabs)/tree]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CompanionSlot: position absolute calculée depuis viewbox SVG (cx/200)*containerWidth"
    - "CompanionSlot: idle frame swap via setInterval 800ms + useState(0) — même pattern AnimatedAnimal"
    - "CompanionSlot: tap spring sequence withSequence(withSpring(-20), withSpring(0)) pour effet saut"
    - "CompanionPicker: modal pageSheet + ModalHeader + ScrollView keyboardShouldPersistTaps"
    - "tree.tsx: companionPickerShownRef.current pour éviter double déclenchement du picker par session"
    - "tree.tsx: useFocusEffect pour message bienvenue au retour sur l'écran"

key-files:
  created:
    - components/mascot/CompanionSlot.tsx
    - components/mascot/CompanionPicker.tsx
  modified:
    - components/mascot/TreeView.tsx
    - app/(tabs)/tree.tsx

key-decisions:
  - "CompanionSlot position cx:85, cy:205 dans viewbox 200x240 — distinct des HAB_SLOTS existants (per D-04)"
  - "CompanionSlot zIndex:15 dans l'overlay — après les inhabitants (zIndex:10) pour apparaître au premier plan"
  - "companionPickerShownRef pour gate le déclenchement du picker par session — évite l'annoyance répétitive"
  - "tree.tsx utilise useFocusEffect pour le message de bienvenue — pattern expo-router natif"
  - "Bouton switch compagnon dans la toolbar existante (pattern cohérent avec shop/craft/badges)"

patterns-established:
  - "Companion sprites: COMPANION_SPRITES[species][stage][idle_1|idle_2] — structure identique aux ANIMAL_IDLE_FRAMES"
  - "Message bubble: Animated.View avec bubbleAnim useSharedValue, withTiming fade in/out 200/500ms"
  - "Mood emoji: affiché quand pas de message actif — MOOD_EMOJI Record<CompanionMood, string>"

requirements-completed: [COMP-01, COMP-02, COMP-03, COMP-08]

# Metrics
duration: 20min
completed: 2026-03-30
---

# Phase 10 Plan 03: Composants Visuels Compagnon Summary

**CompanionSlot animé (idle+tap+haptic+bulle) + CompanionPicker (choix 5 espèces + nommage) intégrés dans la scène arbre pixel art**

## Performance

- **Duration:** 20 min
- **Started:** 2026-03-30T20:52:33Z
- **Completed:** 2026-03-30T21:12:00Z
- **Tasks:** 2/2 auto (+ 1 checkpoint human-verify)
- **Files modified:** 4

## Accomplishments

- CompanionSlot.tsx : sprite pixel art animé (idle frame swap 800ms), animation saut spring au tap + haptic Medium, bulle de message avec fade animé, emoji humeur quand pas de message, position absolue calculée depuis viewbox SVG
- CompanionPicker.tsx : modal pageSheet avec grille 5 espèces (sprites bebe idle_1), badges rareté rare/épique, espèces locked grisées avec cadenas, champ nom obligatoire max 20 chars, bouton confirmer désactivé si vide
- TreeView.tsx : 5 nouvelles props companion (optional), CompanionSlot rendu en overlay zIndex 15 après inhabitants (zIndex 10)
- tree.tsx : orchestration complète — déclenchement picker au niveau 5 sans compagnon, useFocusEffect greeting, handleCompanionTap, bouton switch dans toolbar

## Task Commits

1. **Task 1: CompanionSlot + CompanionPicker composants** - `fa556f5` (feat)
2. **Task 2: Intégration TreeView + tree.tsx** - `74df523` (feat)

## Files Created/Modified

- `components/mascot/CompanionSlot.tsx` — Composant animé du compagnon dans la scène (idle, tap, bulles)
- `components/mascot/CompanionPicker.tsx` — Modal pageSheet choix initial/switch compagnon
- `components/mascot/TreeView.tsx` — Nouvelles props companion + rendu CompanionSlot en overlay
- `app/(tabs)/tree.tsx` — Orchestration companion (state, handlers, picker, useFocusEffect)

## Decisions Made

- CompanionSlot position cx:85, cy:205 dans viewbox 200x240 — hors des HAB_SLOTS existants (D-04)
- CompanionSlot zIndex:15 — priorité visuelle après inhabitants (zIndex:10)
- `companionPickerShownRef` (useRef) pour gate le déclenchement du picker une seule fois par session
- useFocusEffect (expo-router natif) pour le message de bienvenue au retour sur l'écran
- Bouton switch compagnon ajouté dans la toolbar existante de tree.tsx — cohérent avec shop/craft/badges

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Couleurs `surface` et `background` inexistantes dans useThemeColors()**
- **Found during:** Task 1 (CompanionSlot + CompanionPicker)
- **Issue:** Le plan spécifiait `colors.surface` et `colors.background` mais ces tokens n'existent pas — les tokens réels sont `colors.card` et `colors.bg`
- **Fix:** Remplacé `colors.surface` → `colors.card`, `colors.background` → `colors.bg` dans les deux composants
- **Files modified:** components/mascot/CompanionSlot.tsx, components/mascot/CompanionPicker.tsx
- **Verification:** `npx tsc --noEmit` sans nouvelles erreurs
- **Committed in:** fa556f5 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix nécessaire pour la conformité au design system — aucun impact fonctionnel.

## Issues Encountered

None — plan exécuté normalement, seule déviation mineure sur les tokens de couleur.

## Next Phase Readiness

- CompanionSlot et CompanionPicker disponibles pour vérification visuelle sur device physique
- Task 3 (checkpoint human-verify) en attente de validation : vérifier que le compagnon apparaît correctement, les animations fonctionnent, le picker s'ouvre au niveau 5
- Plan 10-04 (messages événements + intégration gamification) peut démarrer après validation visuelle

## Known Stubs

Aucun stub bloquant l'objectif du plan. Le compagnon s'affiche uniquement si `activeProfile.companion != null` — les profils sans compagnon (niveau < 5) afficheront simplement l'arbre sans compagnon, ce qui est le comportement attendu.

## Self-Check: PASSED

- components/mascot/CompanionSlot.tsx — FOUND
- components/mascot/CompanionPicker.tsx — FOUND
- .planning/phases/10-compagnon-mascotte/10-03-SUMMARY.md — FOUND
- Commit fa556f5 (Task 1) — FOUND
- Commit 74df523 (Task 2) — FOUND

---
*Phase: 10-compagnon-mascotte*
*Completed: 2026-03-30*
