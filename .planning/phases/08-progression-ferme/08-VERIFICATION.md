---
phase: 08-progression-ferme
verified: 2026-03-29T21:00:00Z
status: gaps_found
score: 3/4 success criteria verified
gaps:
  - truth: "Debloquer un noeud tech produit un effet observable (vitesse de pousse augmentee, nouvelle culture disponible, rendement ameliore)"
    status: partial
    reason: "Tech bonuses engine exists but callers never pass techBonuses to advanceFarmCrops or collectBuilding, so culture/elevage bonuses have no runtime effect. Seed picker uses raw CROP_CATALOG instead of getAvailableCrops, so sunflower appears without culture-3 tech."
    artifacts:
      - path: "hooks/useGamification.ts"
        issue: "Line 90: advanceFarmCrops(currentCrops) called without techBonuses — culture-1 tasksPerStageReduction never applied"
      - path: "hooks/useFarm.ts"
        issue: "Lines 387, 445: collectBuilding called without techBonuses — elevage bonuses (production interval, capacity) never applied"
      - path: "app/(tabs)/tree.tsx"
        issue: "Line 579: Seed picker iterates CROP_CATALOG.map() instead of getAvailableCrops() — sunflower visible without culture-3 tech. getAvailableCrops imported but never called."
    missing:
      - "Pass techBonuses to advanceFarmCrops in useGamification.ts"
      - "Pass techBonuses to collectBuilding calls in useFarm.ts"
      - "Replace CROP_CATALOG.map with getAvailableCrops(stageInfo.stage, profile?.farmTech ?? []) in seed picker"
  - truth: "Hardcoded colors in TechTreeSheet violate project convention"
    status: partial
    reason: "TechTreeSheet has hardcoded #4ADE80 and #FFFFFF (lines 443, 448) instead of using colors.success and colors.textInverse from useThemeColors()"
    artifacts:
      - path: "components/mascot/TechTreeSheet.tsx"
        issue: "Lines 443, 448: Hardcoded hex colors #4ADE80 and #FFFFFF — CLAUDE.md requires useThemeColors() exclusively"
    missing:
      - "Replace #4ADE80 with colors.success and #FFFFFF with a theme color"
human_verification:
  - test: "Open tech tree sheet and verify visual layout of 3 branches"
    expected: "3 columns with nodes connected by vertical lines, proper styling for unlocked/unlockable/locked states"
    why_human: "Visual layout and styling cannot be verified programmatically"
  - test: "Unlock a tech node and verify haptic feedback and toast notification"
    expected: "Alert confirmation, haptic feedback on success, toast with node name, coins deducted"
    why_human: "Haptic feedback and modal interaction flow need device testing"
  - test: "Unlock expansion-1 and verify new crop plots appear on farm grid"
    expected: "5 new crop cells appear with animation, locked cells show padlock overlay"
    why_human: "Animation and visual rendering of expansion cells need device testing"
  - test: "Restart app and verify tech progression persists"
    expected: "Previously unlocked techs still show as unlocked"
    why_human: "Full persistence cycle requires app restart on device"
---

# Phase 8: Progression Ferme Verification Report

**Phase Goal:** Un arbre de technologies ferme debloque des ameliorations et de nouvelles zones, donnant une direction claire a la progression long terme
**Verified:** 2026-03-29T21:00:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | L'ecran arbre de technologies affiche les noeuds de progression ferme disponibles, debloques, et verrouilles avec leurs couts | VERIFIED | TechTreeSheet.tsx (489 lines) renders 3 branches with node status logic via canUnlockTech, cost display, lock overlay, and pulsating animation for unlockable nodes. Wired in tree.tsx via button and modal. |
| 2 | Debloquer un noeud tech produit un effet observable (vitesse de pousse augmentee, nouvelle culture disponible, rendement ameliore) | PARTIAL | Tech engine (getTechBonuses) correctly computes bonuses, but advanceFarmCrops and collectBuilding are called WITHOUT techBonuses by their actual callers. Seed picker bypasses getAvailableCrops, showing sunflower without tech gate. |
| 3 | L'utilisateur peut depenser des ressources pour debloquer une nouvelle zone/parcelle -- la zone apparait sur la ferme | VERIFIED | WorldGridView renders EXPANSION_CROP_CELLS with lock overlay when techBonuses.extraCropCells === 0, and as normal cells when unlocked. EXPANSION_BUILDING_CELL and EXPANSION_LARGE_CROP_CELL also handled. |
| 4 | La progression tech est persistee dans le vault -- les deblocages survivent a un redemarrage | VERIFIED | farmTech field on Profile (lib/types.ts:88), farm_tech parsed in parser.ts (lines 578-579, 601), unlockTech in useFarm.ts writes via writeProfileField. Full round-trip persistence confirmed. |

**Score:** 3/4 truths verified (1 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/mascot/tech-engine.ts` | TECH_TREE, TechNode, TechBonuses, pure functions | VERIFIED | 202 lines, 10 nodes across 3 branches, 5 exported functions (getUnlockedTechs, canUnlockTech, unlockTechNode, serializeTechs, getTechBonuses). Costs correct: 100/250/500/1000 culture, 100/250/500 elevage/expansion. |
| `components/mascot/TechTreeSheet.tsx` | Bottom sheet with 3 branches, interactive nodes | VERIFIED | 489 lines, Modal pageSheet, 3 columns, node status logic, Alert.alert confirmation, Haptics, reanimated pulse animation. Uses useThemeColors except 2 hardcoded colors. |
| `components/mascot/WorldGridView.tsx` | Expansion cells with lock overlay | VERIFIED | Renders EXPANSION_CROP_CELLS/BUILDING/LARGE conditionally on techBonuses, LockedExpansionCell for locked state. |
| `app/(tabs)/tree.tsx` | Button + TechTreeSheet + techBonuses wiring | VERIFIED | Imports TechTreeSheet, has showTechTree state, renders button and modal, passes techBonuses to WorldGridView. |
| `lib/mascot/types.ts` | techRequired on CropDefinition, sunflower in CROP_CATALOG | VERIFIED | techRequired?: string at line 267, sunflower entry at line 312 with techRequired: 'culture-3'. |
| `lib/types.ts` | farmTech on Profile | VERIFIED | farmTech?: string[] at line 88. |
| `lib/parser.ts` | farm_tech parsing | VERIFIED | Lines 578-579 parse farm_tech CSV, line 601 includes farmTech in profile. |
| `hooks/useFarm.ts` | unlockTech action | VERIFIED | Lines 463-499 implement unlockTech with canUnlockTech validation, writeProfileField, deductCoins, refresh. |
| `lib/mascot/farm-engine.ts` | advanceFarmCrops with techBonuses, getAvailableCrops, getEffectiveHarvestReward | VERIFIED | advanceFarmCrops accepts optional techBonuses (line 70), getEffectiveHarvestReward (line 151), getAvailableCrops (line 158). |
| `lib/mascot/building-engine.ts` | collectBuilding with techBonuses | VERIFIED | Optional techBonuses parameter at lines 135 and 158, applies to productionRate and maxPending. |
| `lib/mascot/world-grid.ts` | EXPANSION_CROP_CELLS, getExpandedCropCells, getExpandedBuildingCells | VERIFIED | EXPANSION_CROP_CELLS at line 95, getExpandedCropCells at line 112, getExpandedBuildingCells at line 128. |
| `locales/fr/common.json` | tech section i18n | VERIFIED | "tech" section at line 3980 with title, branches, all node labels/descriptions. |
| `locales/en/common.json` | tech section i18n | VERIFIED | "tech" section at line 3980 with English translations. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| TechTreeSheet.tsx | hooks/useFarm.ts | unlockTech called on confirmation | WIRED | onUnlock prop calls unlockTech from useFarm (tree.tsx line 1013) |
| TechTreeSheet.tsx | lib/mascot/tech-engine.ts | TECH_TREE, canUnlockTech imported | WIRED | Lines 34-38 import TECH_TREE, canUnlockTech, TechNode, TechBranchId |
| app/(tabs)/tree.tsx | TechTreeSheet.tsx | visible/onClose props | WIRED | Lines 1007-1014 render TechTreeSheet with all required props |
| WorldGridView.tsx | world-grid.ts | EXPANSION_CROP_CELLS rendering | WIRED | Lines 25-27 import expansion constants, lines 284-286 use techBonuses for conditional rendering |
| farm-engine.ts | tech-engine.ts | getTechBonuses applied in advanceFarmCrops | NOT_WIRED | farm-engine accepts techBonuses param but useGamification.ts line 90 never passes it |
| building-engine.ts | tech-engine.ts | getTechBonuses adjusts production | NOT_WIRED | building-engine accepts techBonuses param but useFarm.ts lines 387/445 never pass it |
| tree.tsx seed picker | farm-engine.ts | getAvailableCrops filters by tech | NOT_WIRED | getAvailableCrops imported but never called; line 579 uses CROP_CATALOG.map directly |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| PRO-01 | 08-01, 08-02 | Un arbre de technologies ferme permet de debloquer des ameliorations (vitesse pousse, rendement, nouvelles cultures) | PARTIAL | Engine complete, UI complete, but bonuses not actually applied at runtime (callers don't pass techBonuses) |
| PRO-02 | 08-01, 08-02 | L'utilisateur peut debloquer de nouvelles zones/parcelles en depensant des ressources | SATISFIED | Expansion cells render with lock/unlock based on techBonuses, unlockTech deducts coins |
| PRO-03 | 08-01, 08-02 | La progression tech est persistee dans le vault et visible sur l'ecran arbre | SATISFIED | farm_tech field persisted in famille.md, TechTreeSheet displays unlocked/locked state |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| components/mascot/TechTreeSheet.tsx | 443 | Hardcoded `#4ADE80` | Warning | Violates CLAUDE.md rule: always use useThemeColors(). Should use colors.success. |
| components/mascot/TechTreeSheet.tsx | 448 | Hardcoded `#FFFFFF` | Warning | Violates CLAUDE.md rule. Should use a theme color token. |
| app/(tabs)/tree.tsx | 52 | `getAvailableCrops` imported but never called | Warning | Dead import; seed picker bypasses tech-gated crop filtering |
| app/(tabs)/tree.tsx | 53 | `getExpandedCropCells` imported but never called | Warning | Dead import; tree.tsx still uses getUnlockedCropCells for cell lookups |

### Human Verification Required

### 1. Visual layout of tech tree branches
**Test:** Open the tech tree sheet from the tree screen button
**Expected:** 3 columns (Culture, Elevage, Expansion) with nodes connected by vertical lines, proper colors for each state
**Why human:** Visual layout and styling quality cannot be verified programmatically

### 2. Unlock interaction flow
**Test:** Tap an unlockable node, confirm in Alert, verify haptic and toast
**Expected:** Alert with cost/effect, haptic on success, toast confirmation, coins deducted
**Why human:** Haptic feedback and Alert interaction need device testing

### 3. Expansion cells visual rendering
**Test:** Unlock expansion-1 tech and check farm grid
**Expected:** 5 new crop cells appear, locked cells show padlock before unlock
**Why human:** Animation and visual transition need device observation

### 4. Persistence across restart
**Test:** Unlock tech, force-quit app, relaunch
**Expected:** Unlocked techs preserved
**Why human:** Full persistence cycle requires app restart

### Gaps Summary

The phase delivered a comprehensive tech tree engine and UI, but there is a critical wiring gap: **tech bonuses are computed but never actually applied at runtime**. The pure functions (`advanceFarmCrops`, `collectBuilding`) accept an optional `techBonuses` parameter, but their actual callers in `useGamification.ts` and `useFarm.ts` never pass it. This means:

1. **Culture bonuses (tasksPerStageReduction, harvestRewardMultiplier)** -- unlocking culture-1 or culture-2 has no effect on crop growth or harvest rewards
2. **Elevage bonuses (productionIntervalMultiplier, buildingCapacityMultiplier)** -- unlocking elevage-1 or elevage-2 has no effect on building production
3. **Crop tech-gating** -- sunflower appears in seed picker without culture-3 tech because `getAvailableCrops` is imported but never used

The expansion branch (new parcels) works correctly because WorldGridView reads techBonuses directly for rendering.

Additionally, 2 hardcoded hex colors in TechTreeSheet.tsx violate the project's theme convention.

**Root cause:** Plan 01 correctly made the parameters optional for backward compatibility, but Plan 02 focused on UI creation and did not wire the techBonuses through to the existing callers in useGamification.ts and useFarm.ts.

---

_Verified: 2026-03-29T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
