---
status: awaiting_human_verify
trigger: "Réception cadeau — popup affiche 4 gazpacho mais seulement 1 ajouté en inventaire stock"
created: 2026-04-15T00:00:00Z
updated: 2026-04-15T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMÉ — addGiftToInventory ignore la quantité pour les items craftés et en ajoute toujours 1
test: Corrigé — boucle for sur quantity dans le case 'crafted'
expecting: Avec le fix, recevoir 4 items craftés ajoute bien 4 items dans craftedItems[]
next_action: Vérification humaine en environnement réel

## Symptoms

expected: Quand on reçoit un cadeau contenant 4 gazpacho, 4 gazpacho doivent être ajoutés à l'inventaire stock
actual: La popup de réception affiche bien 4 gazpacho, mais seulement 1 gazpacho est ajouté à l'inventaire stock
errors: Aucun message d'erreur visible
reproduction: Recevoir un cadeau contenant plusieurs unités de gazpacho (ou d'un autre item) → vérifier l'inventaire stock → seulement 1 ajouté au lieu de la quantité affichée dans la popup
started: Comportement observé récemment, probablement depuis l'implémentation initiale des cadeaux

## Eliminated

- hypothesis: Le parsePendingGifts ne préserve pas la quantité correctement
  evidence: JSON.stringify/JSON.parse préserve les nombres — quantity est bien 4 dans le GiftEntry reçu par la popup ET par addGiftToInventory
  timestamp: 2026-04-15

- hypothesis: parseFarmProfile ou serializeFarmProfile corrompent la quantité
  evidence: Pour harvest/rare_seed/building_resource, les fonctions traitent correctement la quantité numérique. Le bug est exclusivement dans le case 'crafted'.
  timestamp: 2026-04-15

- hypothesis: La popup affiche une donnée différente de ce qui est sauvegardé
  evidence: La popup et addGiftToInventory reçoivent le même pending.gifts — si la popup affiche 4, addGiftToInventory reçoit bien quantity:4
  timestamp: 2026-04-15

## Evidence

- timestamp: 2026-04-15
  checked: lib/mascot/gift-engine.ts — addGiftToInventory, case 'crafted'
  found: Le case 'crafted' fait toujours existingItems.push(…) une seule fois, avec le commentaire "on ajoute toujours un nouvel item". La variable quantity est ignorée.
  implication: Envoyer 4 items craftés → GiftEntry.quantity=4 correct → mais seulement 1 item ajouté à craftedItems[]

- timestamp: 2026-04-15
  checked: lib/mascot/gift-engine.ts — removeFromInventory, case 'crafted'
  found: Le case 'crafted' fait findIndex + splice(idx, 1) — retire exactement 1 item quel que soit qty. Pas de vérification qty vs available.
  implication: L'expéditeur perd 1 item (pas qty), le destinataire en reçoit 1. Double incohérence pour qty > 1.

- timestamp: 2026-04-15
  checked: components/mascot/CraftSheet.tsx — onOfferItem call
  found: onOfferItem?.('crafted', recipe.id, count, recipeName) où count = nombre d'items craftés de ce recipeId. Donc un utilisateur peut envoyer quantity > 1 items craftés.
  implication: Le bug est bien atteignable : si on a 4 soupes et qu'on en envoie 4, seulement 1 est transmise.

- timestamp: 2026-04-15
  checked: lib/__tests__/gift-engine.test.ts
  found: Les tests existants pour addGiftToInventory crafted testent uniquement quantity:1. Pas de test pour removeFromInventory crafted.
  implication: Les tests n'avaient pas capturé la régression.

## Resolution

root_cause: Dans lib/mascot/gift-engine.ts, la fonction addGiftToInventory pour item_type 'crafted' ignorait la propriété quantity et ajoutait toujours un seul CraftedItem. De même, removeFromInventory pour 'crafted' retirait toujours 1 item (findIndex + splice) sans vérifier ni utiliser qty.
fix: |
  1. addGiftToInventory case 'crafted' : remplacer le push unique par une boucle for (0 à quantity) qui pousse quantity items.
  2. removeFromInventory case 'crafted' : calculer available = items.filter(...).length, retourner failure si available < qty, puis filter en comptant les suppressions jusqu'à qty.
  3. Ajout de 4 tests couvrant ces deux scenarios (quantity > 1 add, quantity > 1 remove, failure case).
verification: 41 tests passent (npx jest gift-engine). tsc --noEmit = 0 erreurs.
files_changed: [lib/mascot/gift-engine.ts, lib/__tests__/gift-engine.test.ts]
