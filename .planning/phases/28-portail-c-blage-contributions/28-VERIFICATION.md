---
phase: 28-portail-c-blage-contributions
verified: 2026-04-11T08:00:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 28: Portail + Câblage Contributions — Verification Report

**Phase Goal:** La boucle coopérative est complète — récolter dans la ferme perso ou compléter une tâche IRL ajoute automatiquement une contribution au village, l'atteinte de l'objectif déclenche une récompense collective (XP + suggestion activité IRL), et un portail animé dans la ferme permet d'accéder au village.
**Verified:** 2026-04-11T08:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Un portail animé (glow loop) est visible sur l'écran ferme en remplacement du FAB temporaire | VERIFIED | `function PortalSprite` in tree.tsx line 309; `villageFAB` not found in tree.tsx |
| 2 | Le tap sur le portail déclenche un fade cross-dissolve 400ms puis navigue vers le village | VERIFIED | `withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) })` + `runOnJS(router.push)('/(tabs)/village')` in tree.tsx lines 413-418 |
| 3 | Chaque récolte dans la ferme perso ajoute automatiquement une contribution 'harvest' au village | VERIFIED | `onContribution('harvest', profileId)` in useFarm.ts lines 333-335 and 362-364 (2 harvest paths) |
| 4 | Chaque tâche complétée via useGamification ajoute automatiquement une contribution 'task' au village | VERIFIED | `onContribution('task', profile.id)` in useGamification.ts lines 321-323 |
| 5 | Un toast discret '+1 Village' s'affiche après chaque contribution automatique | VERIFIED | `showToast('+1 Village 🏡', 'success')` in useGamification.ts line 327, delayed 300ms via setTimeout |
| 6 | Quand l'objectif est atteint, une carte de récompense apparait avec CTA et suggestion d'activité IRL saisonnière | VERIFIED | `function RewardCard` in village.tsx line 141; rendered in `{isGoalReached && <RewardCard .../>}` at line 467 |
| 7 | Le claim applique +25 XP à TOUS les profils actifs | VERIFIED | `for (const p of activeProfiles)` + `addVillageBonus(vault, p, 25, ...)` in village.tsx lines 371-374 |
| 8 | Le claim attribue 1 loot box bonus à TOUS les profils actifs | VERIFIED | `gamiProfile.lootBoxesAvailable = (gamiProfile.lootBoxesAvailable ?? 0) + 1` in village.tsx line 83 |
| 9 | L'activité IRL suggérée change chaque semaine et est adaptée à la saison courante | VERIFIED | `pickSeasonalActivity(season, gardenData.currentWeekStart)` in village.tsx line 347; hash déterministe sur weekStart in activities.ts lines 44-48 |
| 10 | La carte se dismiss par tap avec un fade out 200ms | VERIFIED | `withTiming(0, { duration: 200 })` in RewardCard.handleDismiss village.tsx line 159 |
| 11 | La récompense déjà claimée affiche 'Récompense réclamée' sans CTA | VERIFIED | `{alreadyClaimed && <Text>Récompense réclamée</Text>}` in village.tsx line 232-240; CTA rendered only when `canClaim` is true |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/(tabs)/tree.tsx` | PortalSprite inline + câblage addContribution dans useFarm | VERIFIED | Contains `function PortalSprite`, `useGarden` import, `addContribution` passed as 2nd arg to `useFarm()` |
| `hooks/useFarm.ts` | Callback onContribution injecté après harvestCrop | VERIFIED | `onContribution?: (type: ContributionType, profileId: string) => Promise<void>` in signature at line 141; called in 2 harvest paths |
| `hooks/useGamification.ts` | Callback onContribution injecté dans completeTask | VERIFIED | Added to `UseGamificationArgs` interface at line 64; called in `completeTask` after Museum block at line 321 |
| `lib/village/activities.ts` | Liste curatée ~20 activités IRL par saison + pickSeasonalActivity() | VERIFIED | File exists with `IRL_ACTIVITIES` Record (20 activities, 5 per season) and `pickSeasonalActivity()` |
| `lib/village/index.ts` | Export activities barrel | VERIFIED | `export * from './activities'` at line 9 |
| `app/(tabs)/village.tsx` | RewardCard inline + handleClaim étendu avec bonus XP collectif + loot box | VERIFIED | `function RewardCard` at line 141; `addVillageBonus` helper at line 63; `for (const p of activeProfiles)` loop at line 371 |
| `app/(tabs)/tasks.tsx` | useGarden import + addContribution passed to useGamification | VERIFIED | `import { useGarden }` at line 31; `onContribution: addContribution` at line 200 |
| `app/(tabs)/index.tsx` | useGarden import + addContribution passed to useGamification | VERIFIED | `import { useGarden }` at line 26; `onContribution: addContribution` at line 222 |
| `app/(tabs)/routines.tsx` | useGarden import + addContribution passed to useGamification | VERIFIED | `import { useGarden }` at line 34; `onContribution: addContribution` at line 348 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `hooks/useFarm.ts` | `hooks/useGarden.ts` | callback onContribution passe en paramètre | WIRED | `onContribution('harvest', profileId)` called in 2 harvest paths; passed as `addContribution` from tree.tsx line 428 |
| `hooks/useGamification.ts` | `hooks/useGarden.ts` | callback onContribution passe en paramètre | WIRED | `onContribution('task', profile.id)` in completeTask; passed from tasks.tsx, index.tsx, routines.tsx |
| `app/(tabs)/tree.tsx` | `app/(tabs)/village.tsx` | router.push après fade withTiming 400ms | WIRED | `runOnJS(router.push)('/(tabs)/village' as any)` in withTiming callback |
| `app/(tabs)/village.tsx` | `lib/village/activities.ts` | import pickSeasonalActivity | WIRED | `import { pickSeasonalActivity } from '../../lib/village/activities'` at line 43; called at line 347 |
| `app/(tabs)/village.tsx` | `lib/gamification/engine.ts` | import addPoints pour bonus XP collectif | WIRED | `import { addPoints } from '../../lib/gamification/engine'` at line 44; called in addVillageBonus at line 78 |
| `app/(tabs)/village.tsx` | `hooks/useGarden.ts` | claimReward() + isGoalReached | WIRED | Both `claimReward` and `isGoalReached` destructured from `useGarden()` at lines 301, 304 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `app/(tabs)/village.tsx` RewardCard | `activity` | `pickSeasonalActivity(season, gardenData.currentWeekStart)` | Yes — deterministic hash on real weekStart string from gardenData | FLOWING |
| `app/(tabs)/village.tsx` handleClaim | `activeProfiles` | memo from `profiles.filter(p => p.isActive)` | Yes — real profiles from VaultContext | FLOWING |
| `app/(tabs)/village.tsx` addVillageBonus | `gamiProfile` | `vaultMgr.readFile('gami-${profile.id}.md')` then `parseGamification()` | Yes — reads real vault file | FLOWING |
| `hooks/useGamification.ts` contribution | `onContribution` callback | passed from `useGarden().addContribution` at call sites | Yes — addContribution writes to jardin-familial.md | FLOWING |

**Note on plan deviation:** `addVillageBonus` correctly uses `parseGamification`/`serializeGamification` (not `parseFarmProfile` as originally specified in the plan) — the deviation was documented in 28-02-SUMMARY.md and is the correct implementation since `gami-{id}.md` is a gamification file, not a farm file.

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable entry points without a device/simulator. React Native app requires `npx expo run:ios --device`.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MAP-03 | 28-01 | Portail interactif ferme → village avec transition visuelle | SATISFIED | PortalSprite in tree.tsx with glow loop + fade 400ms + router.push |
| COOP-01 | 28-01 | Récolte ferme perso ajoute contribution village | SATISFIED | onContribution('harvest') in useFarm.ts harvest function |
| COOP-02 | 28-01 | Tâche IRL complétée ajoute contribution village | SATISFIED | onContribution('task') in useGamification.ts completeTask |
| OBJ-03 | 28-02 | Objectif atteint → tous profils reçoivent bonus XP + item cosmétique | SATISFIED | for loop over activeProfiles with addVillageBonus (+25 XP + lootBoxesAvailable+1) |
| OBJ-04 | 28-02 | Récompense inclut suggestion activité IRL saisonnière | SATISFIED | pickSeasonalActivity() called with season + weekStart in village.tsx |

No orphaned requirements. All 5 requirement IDs from plan frontmatter are accounted for and satisfied.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/(tabs)/village.tsx` | 105 | `const GOLD = '#FFD700'` (hardcoded color) | Info | Pre-existing constant used only in history panel (line 597) for gold star, not introduced by phase 28 changes and not in RewardCard |

No blocker anti-patterns introduced by phase 28. The `GOLD` constant is pre-existing and out of scope.

Toast in `useGamification.ts` correctly uses `setTimeout(() => { try { showToast(...) } catch {} }, 300)` — fire-and-forget non-critical per established pattern.

---

### Human Verification Required

#### 1. Portail glow loop visible à l'écran

**Test:** Ouvrir l'écran ferme (tree.tsx) sur device/simulator
**Expected:** Le portail (icone 🏛️) s'affiche avec un glow pulsant (opacity 0.4 → 0.8 → 0.4 en boucle 1200ms) dans le coin inférieur droit
**Why human:** Animation visuelle Reanimated, non testable programmatiquement

#### 2. Fade navigation ferme → village

**Test:** Taper sur le portail depuis l'écran ferme
**Expected:** L'écran fait un fade-out vers le noir en 400ms puis l'écran village apparaît. Au retour (back), l'écran ferme est pleinement visible (opacity reset)
**Why human:** Transition visuelle inter-écran, non testable sans device

#### 3. Toast '+1 Village' après récolte

**Test:** Récolter une plante dans la ferme avec un profil actif
**Expected:** Un toast '+1 Village 🏡' apparaît avec un délai d'environ 300ms après le toast sémantique habituel
**Why human:** Toast timing et séquence visuelle

#### 4. RewardCard avec activité IRL

**Test:** Simuler un état `isGoalReached: true` ou atteindre l'objectif en contribuant suffisamment
**Expected:** La RewardCard apparaît via FadeInDown.delay(150).duration(350), affiche l'activité saisonnière correcte, le bouton CTA distribue +25 XP + 1 loot box à tous les profils, puis le tap "Fermer la carte" fait un fade out 200ms
**Why human:** Comportement UI interactif complet, vérification XP dans les profils

---

### Gaps Summary

None. All 11 truths are verified, all artifacts are substantive and wired, data flows from real sources, and all 5 requirements (MAP-03, COOP-01, COOP-02, OBJ-03, OBJ-04) are satisfied.

---

_Verified: 2026-04-11T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
