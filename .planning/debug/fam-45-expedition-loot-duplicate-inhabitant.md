# FAM-45 — Expédition: habitant déjà possédé redonné

## Symptôme

Une expédition peut redonner un habitant déjà gagné, par exemple `dragon_glace`, puis `collectExpedition()` l'ajoute une seconde fois dans `farm.mascotInhabitants`.

## Boucle de vérification

Test ciblé dans `lib/__tests__/expedition-engine.test.ts` sur le moteur pur: un loot d'expédition de type `inhabitant` déjà possédé ne doit pas être retourné par le tirage.

## Hypothèse retenue

`rollExpeditionLoot()` tire directement dans `EXPEDITION_LOOT_TABLE[difficulty]` sans connaître l'inventaire. Le hook persiste ensuite l'habitant sans garde de déduplication.

## Résolution

- `rollExpeditionLoot()` reçoit maintenant les habitants déjà possédés et exclut les loots `inhabitant` correspondants.
- `collectExpedition()` passe `farm.mascotInhabitants` au moteur.
- Garde de persistance côté hook: si un habitant déjà présent arrive malgré tout, l'inventaire reste inchangé.

## Vérification

- Rouge avant fix: `npx jest lib/__tests__/expedition-engine.test.ts --runInBand --no-coverage`
- Vert après fix: `npx jest lib/__tests__/expedition-engine.test.ts --runInBand --no-coverage`
- Typecheck filtré: `npx tsc --noEmit`
