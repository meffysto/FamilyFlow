---
status: resolved
trigger: "Village collective reward claim doesn't add XP points or loot boxes."
created: 2026-04-14T00:00:00Z
updated: 2026-04-14T00:00:00Z
---

## Current Focus

hypothesis: claimReward() reads gami-{id}.md but parses it with parseFarmProfile, destroying gamification data. village_claimed_week should live in farm-{id}.md. Also missing: rewardClaimed flag not persisted to garden file.
test: Apply two targeted fixes in hooks/useGarden.ts claimReward()
expecting: XP and loot box added correctly, reward button hidden persistently after claim
next_action: Apply fix — change gamiPath to farm-{profileId}.md + persist rewardClaimed in garden file

## Symptoms

expected: Quand on récupère la récompense collective du village, +25 XP et +1 loot box devraient être ajoutés pour chaque membre de la famille.
actual: Le bouton "Récupérer la récompense" fonctionne visuellement (toast s'affiche) mais les points XP et loot boxes ne sont pas réellement ajoutés.
errors: Aucune erreur visible — les erreurs sont avalées par try/catch silencieux dans handleClaim.
reproduction: Atteindre l'objectif collectif dans le village → cliquer "Récupérer la récompense" → vérifier les points XP et loot boxes = inchangés.
started: Probablement depuis l'implémentation initiale du village (Phase 26).

## Eliminated

- hypothesis: addVillageBonus() itself is broken (parseGamification/serializeGamification usage)
  evidence: addVillageBonus at village.tsx:92-132 correctly uses parseGamification/serializeGamification for gami-{id}.md. The bug is upstream — claimReward() returns false because gami-{id}.md is corrupted before addVillageBonus is called.
  timestamp: 2026-04-14T00:00:00Z

## Evidence

- timestamp: 2026-04-14T00:00:00Z
  checked: hooks/useGarden.ts claimReward() lines 1049-1069
  found: Reads gami-{profileId}.md but parses it with parseFarmProfile(). parseFarmProfile returns FarmProfileData (tree_species, farm_crops, etc.). Then writes back with serializeFarmProfile() — this overwrites the gami-{id}.md gamification content with farm-format frontmatter, destroying XP/profiles/history.
  implication: On next call, addVillageBonus() reads the now-corrupted gami-{id}.md, parseGamification() finds no valid profiles section, gami.profiles.find() returns undefined, and addVillageBonus() exits early with no XP added.

- timestamp: 2026-04-14T00:00:00Z
  checked: lib/types.ts + lib/parser.ts — village_claimed_week field location
  found: village_claimed_week is declared in FarmProfileData (types.ts:599) and is handled by parseFarmProfile/serializeFarmProfile (parser.ts:632, 680). The flag belongs in farm-{id}.md, not gami-{id}.md.
  implication: Fix is to change path from gami-{profileId}.md to farm-{profileId}.md in claimReward().

- timestamp: 2026-04-14T00:00:00Z
  checked: claimReward() — rewardClaimed persistence
  found: claimReward() never updates gardenData.rewardClaimed (the reward_claimed field in jardin-familial.md). Only claimedThisSession React state prevents double-claiming during a session. After app restart, the button reappears.
  implication: Second bug: need to also update garden file with rewardClaimed: true and call setGardenRaw after writing the farm flag.

## Resolution

root_cause: claimReward() in hooks/useGarden.ts uses the wrong file path (gami-{id}.md instead of farm-{id}.md) and the wrong parser/serializer pair for the village_claimed_week anti-double-claim flag. This silently corrupts gami-{id}.md with farm-format data, causing addVillageBonus() to find no valid profile and exit without awarding XP or loot boxes. Secondary: rewardClaimed is never persisted to the garden file, so the claim button reappears after app restart.
fix: 1) Change gamiPath to farmPath (farm-{profileId}.md) in claimReward(). 2) After writing the farm file, update gardenData.rewardClaimed=true in the garden file and call setGardenRaw.
verification: tsc --noEmit passes (0 errors). Fix changes 1 file (hooks/useGarden.ts). Manual end-to-end test in app required.
files_changed: [hooks/useGarden.ts]
