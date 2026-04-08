---
phase: 18-tutoriel-ferme
plan: 04
subsystem: ui
tags: [tutorial, coach-mark, reanimated, farm, onboarding, i18n]

# Dependency graph
requires:
  - phase: 18-tutoriel-ferme
    provides: HelpContext.activeFarmTutorialStep + WorldGridView.paused (Plan 01), CoachMarkOverlay borderRadius (Plan 02), FarmTutorialOverlay composant 5 étapes + i18n (Plan 03)
provides:
  - Intégration end-to-end de FarmTutorialOverlay dans app/(tabs)/tree.tsx (mount + refs cibles + pause WorldGridView)
  - Déclenchement automatique du tutoriel ferme au premier affichage (TUTO-01)
  - Persistance device via SecureStore — pas de retrigger (TUTO-02)
  - Rejouabilité end-to-end depuis FarmCodexModal (TUTO-07)
  - Ancrage précis des coach marks sur les cellules CROP_CELLS (plantation c2, récolte c7)
  - Unification du gameplay graine+pousse (3 crops + lac visibles dès le stage graine)
  - Correction de CoachMarkOverlay borderWidth-giant (border-box RN) + ring d'illumination jaune
affects: [futures phases tutoriels / onboarding, futures modifications gameplay graine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tutoriel overlay dans Modal transparent statusBarTranslucent pour aligner les coords mesurées sur la fenêtre (et non sur le tab navigator)"
    - "Anchors compactes 80×80 calquées sur les coords exactes des cellules CROP_CELLS pour coach marks précis"
    - "Guard temporel 350ms sur handleNext/handleSkip pour éviter tap-through du bouton Suivant vers la cible spotlight"
    - "useMemo sur targetRefs dans le parent pour stabiliser l'object literal passé en prop"
    - "borderWidth géant compensé par décalage -borderThickness + width/height +2*borderThickness (React Native border-box sizing)"

key-files:
  created:
    - .planning/phases/18-tutoriel-ferme/18-04-tree-integration-SUMMARY.md
  modified:
    - app/(tabs)/tree.tsx
    - components/mascot/FarmTutorialOverlay.tsx
    - components/help/CoachMarkOverlay.tsx
    - lib/mascot/types.ts
    - lib/mascot/farm-map.ts
    - packages/core/src/mascot/types.ts
    - packages/core/src/mascot/farm-map.ts
    - locales/fr/help.json
    - locales/en/help.json

key-decisions:
  - "Anchors compactes calquées sur CROP_CELLS (c2 plantation, c7 récolte) plutôt que sur le wrapper diorama géant — précision visuelle"
  - "FarmTutorialOverlay wrappé dans Modal transparent statusBarTranslucent pour que measureInWindow retourne des coords fenêtre exploitables (hors tab navigator)"
  - "Guard temporel 350ms anti tap-through sur handleNext/handleSkip — alternative simple à pointerEvents toggle"
  - "Unification gameplay graine+pousse (PLOTS_BY_TREE_STAGE.graine = 3) — supprime les guards farm-map.ts et rend le lac visible dès le départ, garantit que les coach marks plantation/harvest ont toujours une cible réelle"
  - "borderWidth géant corrigé par offset négatif + dimensions augmentées pour compenser le border-box sizing React Native"
  - 'Étape 4 i18n: "XP" → "feuilles" (FR+EN) pour cohérence avec la terminologie in-game'

patterns-established:
  - "Modal transparent statusBarTranslucent comme hôte pour overlays full-screen qui doivent mesurer des coords fenêtre"
  - "Anchors tutoriel = Views invisibles 80×80 positionnées en absolute sur les coords CROP_CELLS, attachées aux refs targetRefs"
  - "Guard temporel sur boutons overlay pour éviter propagation tactile vers cibles spotlight"
  - "Fallback NarrativeCard graceful dans FarmTutorialOverlay quand refMissing (défense en profondeur)"

requirements-completed: [TUTO-01, TUTO-02, TUTO-06, TUTO-07]

# Metrics
duration: ~2h (intégration initiale + boucle UAT avec 10 fixes itératifs)
completed: 2026-04-08
---

# Phase 18 Plan 04: Tree Integration Summary

**FarmTutorialOverlay intégré dans tree.tsx avec anchors CROP_CELLS précis, pause WorldGridView, rejouabilité codex — validé visuellement par UAT après 10 fixes itératifs**

## Performance

- **Duration:** ~2h (incluant la longue boucle UAT)
- **Completed:** 2026-04-08
- **Tasks:** 2/2 (Task 1 auto + Task 2 checkpoint human-verify)
- **Files modified:** 9

## Accomplishments

- Intégration complète de FarmTutorialOverlay dans app/(tabs)/tree.tsx (import, hook useHelp, refs, mount)
- `paused={activeFarmTutorialStep !== null}` propagé à WorldGridView — animations figées pendant le tutoriel
- Coach marks précis sur les cellules plantation (c2) et récolte (c7) via anchors compactes 80×80
- Tutoriel fonctionnel end-to-end : déclenchement auto → 5 étapes → skip/done → rejouabilité codex
- Unification du gameplay graine+pousse : 3 crops + lac dès le stage graine (garantit des cibles tutoriel réelles)
- Correction structurelle de CoachMarkOverlay borderWidth-giant (border-box RN) + ring d'illumination jaune-chaud
- Validation humaine TUTO-01 à TUTO-08 passée sur device (anti-régression ScreenGuide confirmée)

## Task Commits

### Task 1: Intégration FarmTutorialOverlay + pause WorldGridView

1. **Intégration initiale** — `c8c6a57` (feat): `feat(18-04): intègre FarmTutorialOverlay dans tree.tsx`

### Boucle UAT — fixes itératifs post-intégration (déviations Rules 1-3)

2. **Fix anchors compactes** — `db5f17a` (fix): `fix(18-04): ancrer plantation/harvest refs sur zones compactes diorama`
3. **Fix guard tap-through + repositionner** — `dc8d640` (fix): `fix(18-04): guard anti tap-through + repositionner anchors sur crops`
4. **Fix supprimer fallback double-tooltip** — `b7e9b5b` (fix): `fix(18-04): supprimer fallback NarrativeCard + anchors sur crops en haut`
5. **Fix Modal coords fenêtre** — `0aa2328` (fix): `fix(18-04): wrap FarmTutorialOverlay dans Modal pour aligner coords fenêtre`
6. **Fix coords exactes CROP_CELLS** — `3c393af` (fix): `fix(18-04): aligner anchors sur coords exactes des cellules CROP_CELLS`
7. **Fix borderWidth-giant + ring illumination** — `2643984` (fix): `fix(18-04): corriger borderWidth-giant + ring illumination cutout`
8. **Fallback NarrativeCard graine (défense)** — `8ca8554` (feat): `feat(18-04): fallback NarrativeCard pour stage graine (pas de crops)`
9. **Unifier gameplay graine+pousse** — `1c23271` (feat): `feat(18-04): unifier graine et pousse (3 crops + lac dès le départ)`
10. **Fix i18n étape 4 XP → feuilles** — `85e9780` (fix): `fix(18-04): étape 4 tutoriel — XP → feuilles (FR+EN)`

### Task 2: Validation humaine end-to-end

- Checkpoint human-verify — aucun commit (validation visuelle sur device)
- Critères UAT TUTO-01 à TUTO-08 + anti-régression ScreenGuide : **APPROVED** par l'utilisateur

## Files Created/Modified

- `app/(tabs)/tree.tsx` — intégration FarmTutorialOverlay + refs anchors CROP_CELLS + paused WorldGridView + useMemo targetRefs
- `components/mascot/FarmTutorialOverlay.tsx` — wrap dans Modal statusBarTranslucent, guard temporel 350ms, fallback refMissing, suppression fallback double-tooltip
- `components/help/CoachMarkOverlay.tsx` — correction borderWidth-giant (offset -borderThickness, dimensions +2*borderThickness), ring d'illumination jaune-chaud
- `lib/mascot/types.ts` — PLOTS_BY_TREE_STAGE.graine passé de 0 à 3
- `lib/mascot/farm-map.ts` — suppression guards qui cachaient le lac au stage graine
- `packages/core/src/mascot/types.ts` — miroir de lib/mascot/types.ts
- `packages/core/src/mascot/farm-map.ts` — miroir de lib/mascot/farm-map.ts
- `locales/fr/help.json` — étape 4: "XP" → "feuilles"
- `locales/en/help.json` — étape 4: "XP" → "leaves" (parité FR+EN)

## Decisions Made

Voir key-decisions en frontmatter. Décisions majeures :

1. **Modal transparent comme hôte** : seule solution fiable pour que `measureInWindow` retourne des coords exploitables dans un overlay hébergé par un composant profondément imbriqué dans le tab navigator.
2. **Unification graine+pousse** : au lieu de patcher le tutoriel pour gérer le cas "graine = 0 crops", unifier le gameplay pour que les cibles soient toujours présentes — simplifie le tutoriel ET améliore l'expérience première run.
3. **Anchors découplées des cellules rendues** : des Views invisibles en position absolue calquées sur CROP_CELLS plutôt que d'injecter des refs dans les sous-composants de WorldGridView — évite la pollution de l'architecture de rendering de la ferme.

## Deviations from Plan

Le plan initial prévoyait 2 tâches simples (intégration + validation humaine). La validation humaine a révélé 10 bugs distincts qui ont nécessité autant de fixes itératifs avant l'approbation finale. Toutes ces déviations rentrent dans les Rules 1-3 (bugs, critical, blocking).

### Auto-fixed Issues

**1. [Rule 1 - Bug] Refs plantation/harvest pointaient sur wrapper diorama géant**
- **Found during:** Task 2 (UAT première itération)
- **Issue:** Les refs plantationRef/harvestRef étaient attachées au conteneur WorldGridView entier, résultant en un spotlight couvrant toute la ferme — illisible pour l'utilisateur.
- **Fix:** Création d'anchors View compactes 80×80 en position absolue, calquées sur les coords exactes des cellules CROP_CELLS (c2 plantation, c7 harvest).
- **Files modified:** app/(tabs)/tree.tsx
- **Commits:** db5f17a, dc8d640, b7e9b5b, 3c393af

**2. [Rule 1 - Bug] targetRefs object literal instable causant re-renders**
- **Found during:** Task 2 (UAT)
- **Issue:** L'objet `{ plantation, harvest, hudXp }` passé à FarmTutorialOverlay était recréé à chaque render, invalidant inutilement les mesures internes.
- **Fix:** `useMemo` autour de l'object literal dans tree.tsx.
- **Files modified:** app/(tabs)/tree.tsx
- **Commits:** db5f17a

**3. [Rule 1 - Bug] Tap-through du bouton Suivant vers la cible spotlight**
- **Found during:** Task 2 (UAT)
- **Issue:** Le tap sur "Suivant" se propageait immédiatement à la cellule plantation/récolte en dessous, déclenchant une action de gameplay pendant le tutoriel.
- **Fix:** Guard temporel 350ms dans handleNext/handleSkip de FarmTutorialOverlay — bloque toute propagation durant la transition d'étape.
- **Files modified:** components/mascot/FarmTutorialOverlay.tsx
- **Commits:** dc8d640

**4. [Rule 1 - Bug] Double-tooltip "2/5" flash au changement d'étape**
- **Found during:** Task 2 (UAT)
- **Issue:** Quand `measuredRect` était null (premier frame), un fallback NarrativeCard s'affichait brièvement avant le coach mark — flash visuel dérangeant.
- **Fix:** Suppression du fallback NarrativeCard dans le cas mesure pending — on attend simplement la mesure.
- **Files modified:** components/mascot/FarmTutorialOverlay.tsx
- **Commits:** b7e9b5b

**5. [Rule 1 - Bug] CoachMarkOverlay mesurait dans le tab navigator, pas dans la fenêtre**
- **Found during:** Task 2 (UAT — le spotlight était décalé verticalement)
- **Issue:** FarmTutorialOverlay mounté dans tree.tsx héritait du coordinate space du tab navigator — `measureInWindow` retournait des coords correctes mais le rendu était dans un conteneur offset.
- **Fix:** Wrap FarmTutorialOverlay dans `<Modal transparent statusBarTranslucent>` — le Modal RN est rendu au niveau fenêtre, alignant le rendu avec les coords mesurées.
- **Files modified:** components/mascot/FarmTutorialOverlay.tsx
- **Commits:** 0aa2328

**6. [Rule 1 - Bug] borderWidth-giant cassé par border-box sizing RN**
- **Found during:** Task 2 (UAT — le cutout ne matchait pas la cible)
- **Issue:** React Native utilise border-box sizing, donc un `borderWidth` géant réduit la zone intérieure au lieu de s'étendre vers l'extérieur — le cutout rectangulaire ne correspondait pas visuellement à la cible.
- **Fix:** Décaler la View de `-borderThickness` et augmenter width/height de `+2*borderThickness` pour compenser le border-box et obtenir un cutout qui déborde correctement vers l'extérieur.
- **Files modified:** components/help/CoachMarkOverlay.tsx
- **Commits:** 2643984

**7. [Rule 2 - Missing Critical] Absence de ring d'illumination sur le cutout**
- **Found during:** Task 2 (UAT — le cutout paraissait plat)
- **Issue:** Sans accentuation visuelle, le cutout se fondait dans l'arrière-plan sombre (rgba 0.6) — difficile de comprendre où regarder.
- **Fix:** Ajout d'un ring jaune-chaud autour du cutout pour attirer l'œil vers la cible.
- **Files modified:** components/help/CoachMarkOverlay.tsx
- **Commits:** 2643984

**8. [Rule 3 - Blocking] Stage graine sans crops → tutoriel sans cible**
- **Found during:** Task 2 (UAT — test fresh install)
- **Issue:** À un fresh install (stage graine), PLOTS_BY_TREE_STAGE.graine = 0 → aucune crop plantée → les anchors plantation/harvest pointaient dans le vide → coach marks étape 2/3 inutilisables.
- **Fix:** Unification du gameplay graine+pousse — PLOTS_BY_TREE_STAGE.graine passé à 3, guards farm-map.ts supprimés (lac visible dès graine). Résultat : le premier run affiche immédiatement 3 cellules crops + lac, et le tutoriel a des cibles réelles.
- **Files modified:** lib/mascot/types.ts, lib/mascot/farm-map.ts, packages/core/src/mascot/types.ts, packages/core/src/mascot/farm-map.ts
- **Commits:** 1c23271

**9. [Rule 2 - Missing Critical] Fallback NarrativeCard refMissing (défense en profondeur)**
- **Found during:** Task 2 (UAT)
- **Issue:** Pour les cas edge où les refs seraient absentes (conditions de course, changements futurs), le tutoriel devait dégrader gracieusement au lieu de skip l'étape silencieusement.
- **Fix:** Ajout d'un fallback NarrativeCard dans FarmTutorialOverlay quand `ref?.current` est absent — garantit que l'utilisateur voit le texte de l'étape même si la cible n'est pas mesurable.
- **Files modified:** components/mascot/FarmTutorialOverlay.tsx
- **Commits:** 8ca8554

**10. [Rule 1 - Bug] Étape 4 tutoriel parle de "XP" au lieu de "feuilles"**
- **Found during:** Task 2 (UAT — incohérence terminologique)
- **Issue:** L'étape 4 mentionnait "XP" alors que l'in-game utilise "feuilles" comme devise d'expérience depuis plusieurs phases — incohérence troublante pour le nouvel utilisateur.
- **Fix:** Remplacement "XP" → "feuilles" (FR) et "XP" → "leaves" (EN) dans `locales/{fr,en}/help.json` — parité FR+EN maintenue (D-16).
- **Files modified:** locales/fr/help.json, locales/en/help.json
- **Commits:** 85e9780

---

**Total deviations:** 10 auto-fixed (6 bugs Rule 1, 2 critical Rule 2, 1 blocking Rule 3, 1 architectural-leaning unification confirmé inline)
**Impact on plan:** Aucune régression. Tous les fixes étaient nécessaires à la correction UAT. La déviation #8 (unification graine+pousse) touche le gameplay mais reste locale et améliore l'expérience première run sans casser la progression existante (stages suivants inchangés).

## Issues Encountered

La principale difficulté a été l'interaction complexe entre plusieurs couches :
- Tab navigator + coordinate spaces (fix #5 via Modal)
- border-box sizing RN vs attentes CSS classiques (fix #6)
- Refs attachées à des conteneurs trop larges vs coords cellules précises (fix #1)

Chaque fix a révélé le suivant, d'où la boucle de 10 itérations. À l'avenir, les tutoriels avec spotlight devraient prototyper la mesure via Modal dès le départ.

## User Setup Required

None — aucune configuration externe requise.

## Next Phase Readiness

- Phase 18 complète : 4/4 plans livrés (01 HelpContext + paused, 02 CoachMarkOverlay borderRadius, 03 FarmTutorialOverlay + i18n, 04 tree.tsx integration)
- Prête pour phase-verify : tous les critères UAT TUTO-01 à TUTO-08 validés par l'utilisateur
- Pattern réutilisable : Modal transparent + anchors compactes + guard temporel pour futurs tutoriels contextuels

## Self-Check: PASSED

- app/(tabs)/tree.tsx : FOUND
- components/mascot/FarmTutorialOverlay.tsx : FOUND
- components/help/CoachMarkOverlay.tsx : FOUND
- lib/mascot/types.ts : FOUND
- lib/mascot/farm-map.ts : FOUND
- packages/core/src/mascot/types.ts : FOUND
- packages/core/src/mascot/farm-map.ts : FOUND
- locales/fr/help.json : FOUND
- locales/en/help.json : FOUND
- Commits c8c6a57, db5f17a, dc8d640, b7e9b5b, 0aa2328, 3c393af, 2643984, 8ca8554, 1c23271, 85e9780 : all present in git log

---
*Phase: 18-tutoriel-ferme*
*Completed: 2026-04-08*
