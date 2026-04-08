---
phase: 18-tutoriel-ferme
verified: 2026-04-08T00:00:00Z
status: passed
score: 5/5 must-haves verified
human_verification:
  - test: "Mesurer le frame rate du tutoriel sur device TestFlight"
    expected: "58 fps minimum pendant toutes les étapes (TUTO-06 perf budget)"
    why_human: "Mesure perf runtime non vérifiable par grep/tsc — nécessite device réel"
---

# Phase 18: Tutoriel ferme — Verification Report

**Phase Goal:** Un utilisateur arrivant pour la première fois sur l'écran ferme voit un tutoriel immersif qui explique la boucle de jeu en 5 étapes, peut le passer à tout moment, et peut le rejouer depuis le codex.
**Verified:** 2026-04-08
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tutoriel se déclenche auto au premier affichage de l'écran ferme (flag SecureStore `farm_tutorial`) et ne retrigger pas ensuite | VERIFIED | `FarmTutorialOverlay.tsx:104-112` — useEffect déclencheur guarded par `!isLoaded || hasStarted.current || seen`, `setTimeout 600ms` → `setActiveFarmTutorialStep(0)`. `SCREEN_ID='farm_tutorial'` (ligne 32). `HelpContext` persiste via SecureStore (14 refs). `tree.tsx:2308` monte `<FarmTutorialOverlay profile={profile} targetRefs={farmTutorialTargetRefs} />` |
| 2 | Bouton "Passer" visible à toutes les étapes, flag "vu" positionné immédiatement au skip | VERIFIED | `FarmTutorialOverlay.tsx:171-178` `handleSkip` appelle `markScreenSeen(SCREEN_ID)` avant de reset state. Bouton i18n `help:farm_tutorial.skip` (lignes 290-293). Clés `skip` présentes en FR+EN. |
| 3 | 5 étapes ordonnées (intro, plantation, cycle, XP/loot, codex) avec overlay spotlight cutout | VERIFIED | i18n `step1..step5` en FR+EN (8/8 keys parity). `handleNext:157` termine à `currentStep >= 4` (5 étapes). Refs `plantationRef/harvestRef/hudXpRef` (tree.tsx:307-309) câblées sur étapes 2-4. `CoachMarkOverlay` étendu avec `borderRadius` (9 refs, 0 svg imports). |
| 4 | Animations WorldGridView mises en pause pendant tutoriel | VERIFIED | `tree.tsx:1733` `paused={activeFarmTutorialStep !== null}`. `WorldGridView.tsx` contient 48 refs `paused`/`cancelAnimation` → setInterval + withRepeat gatés. Frame rate 58fps = human verification. |
| 5 | Rejouable depuis codex (CODEX-10), pas de nouveau provider, HelpContext étendu | VERIFIED | `FarmCodexModal.tsx:101` `await resetScreen('farm_tutorial')`. `FarmTutorialOverlay.tsx:97-101` reset `hasStarted.current` quand `seen` devient false. `HelpContext.tsx:50-52,176,262-265` expose `activeFarmTutorialStep` + setter. Aucun nouveau provider ajouté à `_layout.tsx`. |

**Score:** 5/5 truths verified

### Required Artifacts (Level 1-3: exists, substantive, wired)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `contexts/HelpContext.tsx` | expose `activeFarmTutorialStep` + setter | VERIFIED | 9KB, 8 refs to state+setter, wired into useMemo value object |
| `components/mascot/WorldGridView.tsx` | prop `paused?: boolean` gate animations | VERIFIED | 34KB, 48 refs `paused`/`cancelAnimation`, setInterval + withRepeat gated |
| `components/help/CoachMarkOverlay.tsx` | prop `borderRadius?: number` (no SVG) | VERIFIED | 5.8KB, 9 refs `borderRadius`, 0 refs `react-native-svg` (D-05bis respecté) |
| `components/mascot/FarmTutorialOverlay.tsx` | Orchestrateur 5 étapes | VERIFIED | 12.4KB, React.memo, SCREEN_ID constant, handleNext/handleSkip/hasStarted ref reset |
| `locales/fr/help.json` | Textes FR `help.farm_tutorial.*` | VERIFIED | 8 keys (step1-5, skip, next, done) |
| `locales/en/help.json` | Textes EN parité FR | VERIFIED | 8 keys identiques — parité stricte |
| `app/(tabs)/tree.tsx` | Monte overlay + refs + pause | VERIFIED | Import ligne 55, refs 307-309, useMemo targetRefs 312, paused prop 1733, anchors 1748/1759/2089, mount 2308 |

### Key Link Verification (Level 3: wiring)

| From | To | Via | Status |
|------|-----|-----|--------|
| `HelpContext` | useHelp consumers | `HelpContextValue.activeFarmTutorialStep` | WIRED |
| `FarmTutorialOverlay` | `HelpContext` | `useHelp() { setActiveFarmTutorialStep, markScreenSeen, hasSeenScreen, isLoaded }` | WIRED |
| `FarmTutorialOverlay` | `CoachMarkOverlay` | import via components/help + `borderRadius` prop | WIRED |
| `tree.tsx` | `WorldGridView` | `paused={activeFarmTutorialStep !== null}` | WIRED |
| `tree.tsx` | `FarmTutorialOverlay` | mount avec profile + targetRefs useMemo | WIRED |
| `FarmCodexModal` | `HelpContext` | `resetScreen('farm_tutorial')` → déclenche reset `hasStarted.current` | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `FarmTutorialOverlay` | `currentStep` | local useState, driven by useEffect(isLoaded,seen) → setTimeout → setCurrentStep(0) | Yes (real state transitions 0→4) | FLOWING |
| `FarmTutorialOverlay` | `measuredRect` | `ref.current.measureInWindow()` on plantation/harvest/hudXp refs | Yes (real DOM measurements from tree.tsx anchors) | FLOWING |
| `WorldGridView` | `paused` prop | `activeFarmTutorialStep !== null` from HelpContext | Yes (live session state) | FLOWING |
| `tree.tsx` | `profile` (passed to overlay) | VaultContext profile (real data) | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Type safety | `npx tsc --noEmit` | Completed successfully | PASS |
| File existence (7 files) | `ls` | All 7 files present | PASS |
| i18n parity FR/EN | `node -e ... Object.keys` | 8 keys identical in both | PASS |
| No svg import in CoachMarkOverlay (D-05bis) | `grep react-native-svg` | 0 occurrences | PASS |
| HelpContext extension (not new provider) | `grep activeFarmTutorialStep contexts/HelpContext.tsx` | 8 occurrences, integrated in useMemo value | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| TUTO-01 | 18-04 | Déclenchement auto au 1er affichage de tree.tsx | SATISFIED | FarmTutorialOverlay mounted in tree.tsx:2308, auto-trigger useEffect with 600ms delay |
| TUTO-02 | 18-04 | Flag persisté globalement par appareil dans SecureStore via `markScreenSeen('farm_tutorial')` | SATISFIED | HelpContext uses SecureStore (14 refs), SCREEN_ID='farm_tutorial' consumed by markScreenSeen on done/skip |
| TUTO-03 | 18-03 | 5 étapes (intro, plantation, cycle, XP, codex) | SATISFIED | i18n step1-5 FR+EN, handleNext terminates at currentStep>=4 |
| TUTO-04 | 18-02, 18-03 | Overlay spotlight cutout rond/rectangle arrondi | SATISFIED | CoachMarkOverlay borderRadius prop added, 0 svg imports, consumed by FarmTutorialOverlay |
| TUTO-05 | 18-03 | Bouton "Passer" skippable à tout moment → flag vu | SATISFIED | handleSkip:171 calls markScreenSeen immediately, skip label rendered ligne 290-293 |
| TUTO-06 | 18-01, 18-04 | WorldGridView paused pendant tutoriel (60fps) | SATISFIED (perf needs human) | 48 paused refs in WorldGridView, paused={activeFarmTutorialStep !== null} in tree.tsx:1733. Frame rate measurement → human verif |
| TUTO-07 | 18-03, 18-04 | Rejouable depuis codex (CODEX-10) | SATISFIED | FarmCodexModal.tsx:101 calls resetScreen('farm_tutorial'), FarmTutorialOverlay reset hasStarted.current when !seen |
| TUTO-08 | 18-01 | HelpContext étendu, pas de nouveau provider | SATISFIED | HelpContext.tsx:50-265 extension only, no new provider in app/_layout.tsx |

**Coverage:** 8/8 requirements satisfied. No orphaned requirements — all 8 IDs declared in plan frontmatter match REQUIREMENTS.md phase-18 mapping.

### Anti-Patterns Scan

Scanned modified files from SUMMARY key-files:
- `contexts/HelpContext.tsx`
- `components/mascot/WorldGridView.tsx`
- `components/help/CoachMarkOverlay.tsx`
- `components/mascot/FarmTutorialOverlay.tsx`
- `app/(tabs)/tree.tsx`
- `locales/fr/help.json` / `locales/en/help.json`

No blocker anti-patterns:
- No TODO/FIXME/PLACEHOLDER strings in tutorial logic
- No empty return stubs (`return null` branches are legit — tutorial hidden when `currentStep === -1` or `seen`)
- No `console.log`-only handlers (handleNext/handleSkip have real state mutations)
- No hardcoded colors (useThemeColors via `colors.*`)
- No `react-native-svg` import in CoachMarkOverlay (respects D-05bis)
- No new provider added to `app/_layout.tsx` (respects TUTO-08)

### Human Verification Required

#### 1. Frame Rate Measurement on TestFlight

**Test:** Déclencher le tutoriel ferme sur device iOS TestFlight, utiliser un profiler (Xcode Instruments → Core Animation) ou le FPS monitor dev-client pendant les 5 étapes.
**Expected:** Frame rate reste à 58 fps minimum pendant tout le tutoriel (TUTO-06 perf budget).
**Why human:** Les mesures de frame rate ne sont pas vérifiables par grep/tsc — elles nécessitent l'exécution sur device réel avec profiling.

**Note:** Le plan 18-04 a déjà été validé visuellement par l'utilisateur sur device après 10 itérations UAT. Cette étape reste ouverte uniquement pour la mesure quantitative du 58fps si l'utilisateur souhaite l'objectiver.

## Summary

La phase 18 livre un tutoriel ferme complet et fonctionnel :
- **Infrastructure (18-01)** : HelpContext étendu + WorldGridView pause — pas de nouveau provider
- **UI primitive (18-02)** : CoachMarkOverlay + borderRadius sans SVG
- **Orchestrateur (18-03)** : FarmTutorialOverlay 5 étapes + i18n FR/EN parité stricte
- **Intégration (18-04)** : tree.tsx câble tout end-to-end avec refs précises sur CROP_CELLS

Les 5 success criteria de la ROADMAP sont toutes vérifiées par évidence code. Les 8 requirements TUTO-01..08 sont toutes satisfaites. Type check passe. L'UAT humain sur device a déjà validé visuellement la boucle complète (confirmé par 10 itérations documentées dans 18-04-SUMMARY.md). Seule la mesure quantitative du 58fps reste optionnellement à objectiver.

**Verdict: passed** — Phase goal atteint. Ready to proceed.

---

_Verified: 2026-04-08_
_Verifier: Claude (gsd-verifier)_
