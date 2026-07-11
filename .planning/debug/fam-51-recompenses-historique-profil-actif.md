---
status: resolved
trigger: "FAM-51 — Vue Récompenses affiche Maxence dans l'historique alors que l'action concerne le profil actif"
created: 2026-07-11
updated: 2026-07-11
---

# Debug Session: FAM-51 — Historique Récompenses mauvais profil

## Symptôme

Dans la vue Récompenses, le bloc "Historique récent" affiche des lignes au nom de Maxence alors que l'utilisatrice s'attend à voir ses propres actions.

## Hypothèse retenue

`app/(tabs)/loot.tsx` construit `recentHistory` depuis `gamiData.history` sans tenir compte du `activeProfile`. Le libellé et la position du bloc donnent l'impression d'un historique personnel, mais les entrées sont familiales/globales.

## Boucle de vérification

- Filtrer l'historique récent sur `activeProfile.id`.
- Prévoir un fallback vide si aucun profil actif n'est disponible.
- Ajouter un test ciblé si un helper pur est extrait.

## Résolution

`getRecentHistoryForProfile()` filtre maintenant l'historique par profil actif avant de prendre les 10 dernières entrées, puis `loot.tsx` l'utilise pour le bloc "Historique récent".

## Vérification

- `npx jest lib/__tests__/gamification.test.ts --no-coverage --runInBand`
- `npx tsc --noEmit`
