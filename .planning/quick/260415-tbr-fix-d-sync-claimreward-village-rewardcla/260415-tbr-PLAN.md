---
phase: quick-260415-tbr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/useGarden.ts
autonomous: true
requirements: [BUG-claimReward-desync]
---

<objective>
Fix la désync entre farm-{id}.md (village_claimed_week) et jardin-familial.md (rewardClaimed).

Quand le guard anti-double-claim détecte que le claim a déjà eu lieu (village_claimed_week === currentWeekStart) mais que gardenData.rewardClaimed est false, réparer le flag gardenData au lieu de retourner false silencieusement.
</objective>

<tasks>

<task type="auto">
  <name>Réparer la désync dans le guard claimReward</name>
  <files>hooks/useGarden.ts</files>
  <action>
Dans la fonction claimReward (ligne 1067), remplacer le simple `return false` par un bloc qui :
1. Vérifie si gardenData.rewardClaimed est false (désync détectée)
2. Si oui, écrit rewardClaimed: true dans jardin-familial.md et met à jour le state local
3. Retourne false dans tous les cas (le claim original a déjà eu lieu)
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Le guard anti-double-claim répare la désync au lieu de laisser le bouton visible indéfiniment.</done>
</task>

</tasks>
