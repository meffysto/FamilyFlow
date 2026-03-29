---
phase: 07-craft
verified: 2026-03-29T22:30:00Z
status: passed
score: 4/4 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "Un item crafte attribue plus d'XP qu'une recolte brute equivalente — la difference est visible dans le resume de recompense"
  gaps_remaining: []
  regressions: []
---

# Phase 7: Craft Verification Report

**Phase Goal:** Les recoltes brutes peuvent etre combinees en items speciaux via des recettes, offrant plus de valeur XP et une boucle de progression plus riche
**Verified:** 2026-03-29T22:30:00Z
**Status:** passed
**Re-verification:** Yes -- after gap closure (previous: gaps_found 3/4)

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | L'utilisateur peut combiner des recoltes pour creer un item special via une interface de craft | VERIFIED | craftItem() in craft-engine.ts deducts ingredients and produces CraftedItem; useFarm.craft() wires to vault; CraftSheet "Crafter" button calls onCraft with haptic + toast |
| 2 | Un catalogue liste toutes les recettes disponibles avec les ingredients exacts requis | VERIFIED | CraftSheet catalogue tab renders all 4 CRAFT_RECIPES with ingredient have/need quantities, color-coded |
| 3 | Un item crafte attribue plus d'XP qu'une recolte brute equivalente — la difference est visible dans le resume de recompense | VERIFIED | useFarm.craft() calls addCoins(profileId, recipe.xpBonus) after successful craft (line 292-293); CraftSheet displays "+N XP" in catalogue (line 184) and "N XP" in Mes creations tab (line 347) |
| 4 | Les items craftes sont persistes dans le vault et apparaissent dans l'inventaire du profil | VERIFIED | farm_crafted_items parsed/serialized in parser.ts, written atomically by useFarm.craft(), displayed in CraftSheet "Mes creations" tab |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/mascot/craft-engine.ts` | Craft recipes, craftItem, sellItem logic | VERIFIED | 178 lines, 4 recipes, canCraft + craftItem + CRAFT_RECIPES exported |
| `lib/mascot/types.ts` | CraftRecipe, CraftedItem, HarvestInventory types | VERIFIED | All 4 interfaces present |
| `lib/mascot/farm-engine.ts` | harvestCrop returns harvestedCropId | VERIFIED | Returns `{ crops, harvestedCropId, isGolden }` |
| `lib/parser.ts` | Parse farm_harvest_inventory + farm_crafted_items | VERIFIED | Lines 576-577: both fields parsed from famille.md frontmatter |
| `hooks/useFarm.ts` | craft, sellHarvest, sellCrafted + addCoins(xpBonus) | VERIFIED | All actions exported; craft() adds xpBonus via addCoins (lines 292-293) |
| `components/mascot/CraftSheet.tsx` | Atelier bottom sheet with 3 tabs + XP display | VERIFIED | 593+ lines, 3 tabs, xpBonus shown in catalogue and creations tabs |
| `app/(tabs)/tree.tsx` | Bouton Atelier + CraftSheet integration | VERIFIED | CraftSheet imported, showCraftSheet state, button wired |
| `locales/fr/common.json` | French craft translations | VERIFIED | craft section present |
| `locales/en/common.json` | English craft translations | VERIFIED | craft section present |
| `lib/__tests__/craft-engine.test.ts` | Unit tests for craft engine | VERIFIED | 28 tests |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| farm-engine.ts | useFarm.ts | harvestCrop return type change | WIRED | harvest() handles `{ cropId, isGolden }` return, adds to inventory |
| craft-engine.ts | useFarm.ts | craftItem and sellItem imports | WIRED | craftItemFn, sellCraftedItemFn imported and used in craft/sellCrafted actions |
| useFarm.ts | gamification | addCoins(profileId, recipe.xpBonus) | WIRED | Line 292-293: xpBonus added to gamiProfile.coins after craft |
| parser.ts | types.ts | Profile fields harvestInventory + craftedItems | WIRED | Both fields parsed from frontmatter props and included in Profile |
| CraftSheet.tsx | useFarm.ts | useFarm() craft/sell actions | WIRED | onCraft/onSellHarvest/onSellCrafted props connected to useFarm actions in tree.tsx |
| CraftSheet.tsx | craft-engine.ts | CRAFT_RECIPES, canCraft imports | WIRED | Both imported and used in catalogue rendering |
| CraftSheet.tsx | xpBonus display | recipe.xpBonus rendered in UI | WIRED | Line 184: "+N XP" in catalogue; Line 347: "N XP" in creations |
| tree.tsx | CraftSheet.tsx | Modal visible state + props | WIRED | showCraftSheet state, CraftSheet rendered with all required props |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CRA-01 | 07-01, 07-02 | L'utilisateur peut combiner des recoltes pour creer des items speciaux | SATISFIED | craftItem() + CraftSheet UI + useFarm.craft() fully wired |
| CRA-02 | 07-01, 07-02 | Les recettes de craft sont visibles dans un catalogue avec ingredients requis | SATISFIED | CraftSheet catalogue tab with 4 recipes, ingredient have/need display |
| CRA-03 | 07-01, 07-02 | Les items craftes donnent plus d'XP que les recoltes brutes | SATISFIED | xpBonus applied via addCoins() in craft(), displayed in CraftSheet UI (+N XP in catalogue, N XP in creations) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No blockers or warnings found |

### Human Verification Required

### 1. Full Craft Flow with XP on Device

**Test:** Plant and grow a crop, harvest it, open Atelier, verify inventory shows the harvest, craft an item, confirm XP bonus is awarded (check gamification coins before/after), sell a crafted item.
**Expected:** Harvest goes to inventory, Atelier opens with 3 tabs, crafting awards xpBonus coins, selling gives correct leaf amounts.
**Why human:** End-to-end data flow through vault files requires device testing.

### 2. XP Bonus Visibility

**Test:** Open Atelier catalogue, check each recipe shows "+N XP" next to the sell value. Craft an item, check "Mes creations" tab shows XP value per item.
**Expected:** Catalogue: "+20 XP" next to confiture, "+30 XP" next to gateau, etc. Creations tab: "x1 -- 80 feuilles + 20 XP" style display.
**Why human:** Visual rendering of XP text needs device confirmation.

### 3. Persistence After App Restart

**Test:** Craft an item, close and reopen the app, open Atelier.
**Expected:** Crafted items and harvest inventory persist across sessions.
**Why human:** Requires running app and restarting -- cannot verify file I/O round-trip programmatically.

### Gap Closure Summary

The single gap from the initial verification (2026-03-29T21:00:00Z) has been resolved:

- **hooks/useFarm.ts**: `craft()` now calls `addCoins(profileId, recipe.xpBonus, ...)` after successful craft (lines 292-293). The `addCoins` function adds the amount to `gamiProfile.coins` and records a history entry -- this is a real XP attribution, not a stub.
- **components/mascot/CraftSheet.tsx**: Catalogue tab displays `+N XP` next to sell value (line 184); "Mes creations" tab displays `recipe.xpBonus XP` alongside leaf value (line 347).

No regressions detected in previously-passing truths, artifacts, or key links.

---

_Verified: 2026-03-29T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
