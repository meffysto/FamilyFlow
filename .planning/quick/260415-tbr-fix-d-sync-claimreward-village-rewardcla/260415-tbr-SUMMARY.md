---
phase: quick-260415-tbr
plan: 01
status: completed
---

# Quick Task 260415-tbr — Summary

## Résultat
Fix de la désynchronisation dans `claimReward` (useGarden.ts) qui laissait le bouton "Récupérer la récompense" visible alors que le claim avait déjà eu lieu.

## Cause racine
`claimReward` écrit séquentiellement dans 2 fichiers :
1. `farm-{id}.md` → `village_claimed_week` (guard anti-double)
2. `jardin-familial.md` → `rewardClaimed: true` (cacher le bouton)

Si l'écriture 2 est écrasée par une opération concurrente (addContribution, etc.), le farm file dit "déjà réclamé" mais le garden file dit "pas réclamé" → le bouton reste visible mais ne fait rien.

## Fix
Dans le guard anti-double-claim (ligne 1067), quand la désync est détectée (`village_claimed_week` match mais `rewardClaimed` est false), on répare le flag garden avant de retourner false. Le bouton disparaît au prochain tap.

## Fichiers modifiés
- `hooks/useGarden.ts` — fonction `claimReward`, guard anti-double-claim
