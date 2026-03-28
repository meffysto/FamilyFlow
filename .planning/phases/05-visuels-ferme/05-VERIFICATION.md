---
phase: 05-visuels-ferme
verified: 2026-03-28T22:30:00Z
status: human_needed
score: 8/8 automated must-haves verified
re_verification: false
human_verification:
  - test: "Verifier visuellement que le tint overlay change lors du passage d'un slot horaire a un autre (ex: changer l'heure du device sur 21h00)"
    expected: "Teinte bleu/violet subtile (~12% opacite) apparait progressivement sur le diorama en 2 secondes"
    why_human: "Le re-polling setInterval(60s) et la transition withTiming(2000) sont dans le code, mais seul un test sur device avec changement d'heure confirme le comportement temps reel"
  - test: "Observer les cultures plantees sur l'ecran ferme — verifier l'animation de balancement"
    expected: "Deux frames alternent toutes les ~800ms, produisant un leger balancement visible a l'oeil nu pour chaque culture a tous les stades"
    why_human: "Le frame swap useState + setInterval est code, mais l'effet visuel (balancement perceptible entre frames identiques decalees 1px) doit etre confirme sur device"
  - test: "Observer les animaux et attendre 3-6 secondes pour un deplacement — verifier la direction de marche"
    expected: "Mouvement horizontal utilise les frames walk_left; mouvement vers la droite flippe le sprite (pas de marche a reculons); idle visible sur les animaux au repos"
    why_human: "ANIMAL_WALK_LEFT_FRAMES et scaleX: -1 sont dans le code, mais la coherence visuelle direction/animation necessite une observation directe sur device physique"
  - test: "Verifier que les bulles de pensee des animaux fonctionnent toujours (regression)"
    expected: "Les bulles de pensee apparaissent au-dessus des animaux comme avant, non affectees par le flip scaleX: -1 sur l'Image (pas sur l'Animated.View parent)"
    why_human: "La modification ciblait l'Image seule, mais seul un test visuel confirme l'absence de regression sur les bulles"
---

# Phase 05 : Visuels Ferme — Rapport de Verification

**Phase Goal:** La ferme est visuellement vivante — cycle jour/nuit coherent avec l'heure reelle et sprites ameliores pour les cultures et animaux
**Verified:** 2026-03-28T22:30:00Z
**Status:** human_needed
**Re-verification:** Non — verification initiale

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Le diorama adapte sa teinte selon l'heure reelle sans action manuelle | VERIFIED | `AmbientParticles.tsx` L180: `useState(() => getTimeSlot())` + L189-194: `setInterval(60_000)` reactif |
| 2  | La transition entre slots horaires est progressive (fondu ~2s), pas brusque | VERIFIED | L215-218: `withTiming(target.r/g/b/a, { duration: 2000 })` sur les 4 shared values RGBA |
| 3  | Pendant le slot 'jour', aucun overlay n'est visible | VERIFIED | Config `jour = null` → target `{ r:0, g:0, b:0, a:0 }` — l'Animated.View reste rendu mais transparent |
| 4  | La nuit, l'overlay est subtil (~12% opacite) | VERIFIED | `ambiance.ts` config nuit: `rgba(20, 10, 60, 0.12)` — appliquee via `overlayA.value = withTiming(0.12, ...)` |
| 5  | `useReducedMotion` desactive les animations de transition | VERIFIED | L208-213: branche `reducedMotion` applique les valeurs directement sans `withTiming` |
| 6  | Chaque culture affiche 2 frames distinctes alternees (~800ms) | VERIFIED | `WorldGridView.tsx` L60-64: `useState(frameIdx)` + `setInterval(() => setFrameIdx(i => 1 - i), 800)` |
| 7  | L'animation 2-frames est visible a tous les stades de croissance (0-4) | VERIFIED | `CROP_SPRITES` couvre stades 0-4 avec tuples `[frameA, frameB]` pour les 10 cultures |
| 8  | `useReducedMotion` desactive l'alternance de frames (cultures) | VERIFIED | `WorldGridView.tsx` L62-65: `if (reducedMotion || !crop) return;` gate le timer |
| 9  | Les animaux ont une animation idle visible (alternance 2 frames) | VERIFIED | `TreeView.tsx`: `ANIMAL_IDLE_FRAMES` avec 2 frames pour les 5 animaux, logique idle inchangee |
| 10 | Les animaux se deplacent avec une animation de marche differenciee (direction) | VERIFIED | `TreeView.tsx` L2139-2147: `activeWalkFrames` selectionne `walk_left` si `isHorizontal`, `walk_down` sinon |
| 11 | La direction de marche est visible — flip scaleX pour la droite | VERIFIED | L2159+2167: `const flipX = isWalking && isHorizontal && lastDx > 0;` → `scaleX: -1` sur l'Image |
| 12 | Les sprites sont de vrais pixel art Mana Seed | VERIFIED (visuel) | poussin/idle_1.png (401B) et carrot/stage_0_a.png (271B) affiches visuellement — sprites pixel art confirmes |

**Score automatise:** 12/12 truths verifiees

---

## Required Artifacts

| Artifact | Statut | Details |
|----------|--------|---------|
| `components/mascot/AmbientParticles.tsx` | VERIFIED | Existe, substantif (244 lignes), wired dans `app/(tabs)/tree.tsx` L591 |
| `lib/mascot/crop-sprites.ts` | VERIFIED | Existe, `Record<string, Record<number, [any, any]>>` confirmé, 10 cultures x 5 stades |
| `components/mascot/WorldGridView.tsx` | VERIFIED | Existe, contient `frameIdx`, `setInterval 800`, `useReducedMotion`, `frames[frameIdx]` |
| `components/mascot/FarmPlots.tsx` | VERIFIED | Mis a jour: `CROP_SPRITES[...][...][0]` — compile sans erreur TS |
| `assets/garden/crops/carrot/stage_0_a.png` | VERIFIED | 271B, vrai pixel art confirme visuellement |
| `assets/garden/crops/` (50 frames A) | VERIFIED | 50 fichiers `stage_*_a.png` + 50 `stage_*_b.png` pour 10 cultures x 5 stades |
| `components/mascot/TreeView.tsx` | VERIFIED | Contient `ANIMAL_WALK_LEFT_FRAMES`, `lastDx`/`lastDy`, `activeWalkFrames`, `scaleX: -1` |
| `assets/garden/animals/poussin/idle_1.png` | VERIFIED | 401B, vrai sprite pixel art Mana Seed confirme visuellement |
| `assets/garden/animals/canard/` | VERIFIED | 14 fichiers (idle x2, walk_down x6, walk_left x6) — cas special canard 6 frames gere correctement |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AmbientParticles.tsx` | `lib/mascot/ambiance.ts` | `getTimeSlot()` polling every 60s | WIRED | L29 import + L180 `useState(() => getTimeSlot())` + L190 `getTimeSlot()` dans setInterval |
| `WorldGridView.tsx` | `lib/mascot/crop-sprites.ts` | `CROP_SPRITES[cropId][stage][frameIdx]` | WIRED | L29 import + L127-128: `frames = CROP_SPRITES[...]?.[...]` puis `frames[frameIdx]` |
| `TreeView.tsx` | `assets/garden/animals/` | `require()` dans `ANIMAL_WALK_LEFT_FRAMES` | WIRED | L2023-2073: 5 animaux avec frames `walk_left_1..8.png` requirees + modulo sur `activeWalkFrames.length` |
| `app/(tabs)/tree.tsx` | `AmbientParticles` | import + rendu dans diorama | WIRED | L51 import + L591 `<AmbientParticles containerHeight={...} />` |

---

## Requirements Coverage

| Requirement | Plan source | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VIS-01 | Plan 01 | La ferme affiche un cycle jour/nuit avec luminosite et teinte adaptees a l'heure reelle | SATISFIED | `AmbientParticles.tsx`: `useState(getTimeSlot)` + `setInterval(60s)` + `withTiming(2000)` sur 4 RGBA shared values |
| VIS-02 | Plan 02 | Les cultures ont des sprites pixel ameliores avec au moins 2 frames d'animation par stade de croissance | SATISFIED | `CROP_SPRITES` restructure en `[any, any]` tuples, 100 PNGs Mana Seed, `CropCell` alterne `frameIdx` a 800ms |
| VIS-03 | Plan 03 | Les animaux ont des sprites pixel ameliores avec animations idle et marche plus fluides | SATISFIED | `ANIMAL_WALK_LEFT_FRAMES` ajoute, `lastDx`/`lastDy` tracking, `activeWalkFrames` selection, `scaleX: -1` flip |

Tous les requirement IDs declares dans les plans (VIS-01, VIS-02, VIS-03) sont couverts. Aucun requirement Phase 5 orphan dans REQUIREMENTS.md (la traceability table confirme VIS-01/02/03 = Phase 5).

---

## Anti-Patterns Found

| Fichier | Ligne | Pattern | Severite | Impact |
|---------|-------|---------|----------|--------|
| `assets/garden/animals/poussin/` | — | Sprites poussin (401-424B) < 500B (critere du plan) | Info | Les sprites sont de vrais pixel art confirmes visuellement — le seuil 500B etait un heuristique, pas une garantie de qualite. Aucun impact fonctionnel. |
| `assets/garden/crops/carrot/stage_0_a.png` | — | Frame carrot stade 0 (271B) sous seuil 500B | Info | Meme situation — sprite pixel art compresse valide, cible early-stage = peu de pixels opaques |

Aucun anti-pattern bloquant. Aucun `console.log` de production, aucun `return null` inopportun, aucun `perspective` dans les transforms.

---

## Human Verification Required

### 1. Cycle Jour/Nuit en Temps Reel (VIS-01)

**Test:** Aller sur l'ecran ferme. Modifier l'heure du device iOS sur 21h00 (Reglages > General > Date et heure > desactiver "Regler automatiquement"). Attendre jusqu'a 60 secondes pour le re-polling.
**Expected:** Un tint bleu/violet subtil (~12% opacite) apparait progressivement sur le diorama en 2 secondes. Remettre l'heure en automatique doit faire disparaitre le tint.
**Why human:** Le re-polling toutes les 60 secondes et la transition `withTiming(2000)` sont dans le code, mais seul un test sur device physique confirme le comportement en conditions reelles (AppState, timer accuracy, rendering).

### 2. Animation Balancement des Cultures (VIS-02)

**Test:** Naviguer sur l'ecran ferme avec des cultures plantees. Observer les sprites des cultures pendant ~2 secondes.
**Expected:** Chaque culture presente un leger mouvement de balancement visible (alternance frame A/B toutes les 800ms). L'effet doit etre perceptible a l'oeil nu a tous les stades (stade 0 = graine, stade 4 = mature).
**Why human:** Les frames B sont generees par decalage 1px vertical depuis le frame A. L'effet visuel "balancement" depend de la lisibilite du decalage sur l'ecran device — a verifier que le decalage 1px est perceptible (pas trop subtil).

### 3. Direction de Marche des Animaux (VIS-03)

**Test:** Observer les animaux sur l'ecran ferme. Attendre 3-6 secondes pour qu'un animal commence a marcher. Verifier la direction et le sprite utilise.
**Expected:** Mouvement horizontal utilise des frames `walk_left` differentes des frames `walk_down`. Mouvement vers la droite flippe le sprite (scaleX: -1). Les bulles de pensee des animaux restent au-dessus du sprite sans etre flippees.
**Why human:** La logique directionnelle est codee, mais la perceptibilite des deux types de frames (walk_left vs walk_down), le flip propre, et l'absence de regression sur les bulles de pensee necessitent observation directe.

### 4. Accessibilite Reduced Motion

**Test:** Activer "Reduire le mouvement" dans Reglages iOS > Accessibilite. Naviguer sur l'ecran ferme.
**Expected:** L'overlay de tint change instantanement sans fondu. Les cultures ne s'animent pas (pas d'alternance de frames). Les animaux restent en idle.
**Why human:** Les guards `useReducedMotion` sont en place, mais le comportement exact sur device avec Reduce Motion actif doit etre confirme.

---

## Gaps Summary

Aucun gap bloque l'objectif de la phase. Tous les must-haves automatises sont satisfaits:
- VIS-01: AmbientParticles reactif avec cycle jour/nuit anime
- VIS-02: CROP_SPRITES 2-frames + CropCell anime + 100 sprites Mana Seed
- VIS-03: ANIMAL_WALK_LEFT_FRAMES + detection direction + scaleX flip

Le statut `human_needed` reflete uniquement que la validation visuelle finale sur device physique n'a pas encore ete effectuee par le developpeur (Task 3 du Plan 03 marquee "auto-approuvee" dans le SUMMARY, mais la verification manuelle sur device reste recommandee pour confirmer la qualite perceptuelle des animations).

---

_Verified: 2026-03-28T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
