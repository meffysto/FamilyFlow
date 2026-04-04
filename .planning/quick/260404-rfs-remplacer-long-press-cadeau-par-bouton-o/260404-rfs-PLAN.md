---
phase: quick-260404-rfs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/mascot/CraftSheet.tsx
autonomous: true
requirements: [quick-rfs]
must_haves:
  truths:
    - "Chaque item inventaire (harvest, resource, crafted) affiche un bouton cadeau visible"
    - "Appuyer sur le bouton cadeau declenche onOfferItem avec les bons parametres"
    - "Le long-press est supprime sur les 3 types de lignes inventaire"
  artifacts:
    - path: "components/mascot/CraftSheet.tsx"
      provides: "Bouton offrir visible sur chaque ligne inventaire"
      contains: "onOfferItem"
  key_links:
    - from: "components/mascot/CraftSheet.tsx"
      to: "onOfferItem prop"
      via: "TouchableOpacity onPress"
      pattern: "onOfferItem.*harvest|building_resource|crafted"
---

<objective>
Remplacer le long-press cadeau par un bouton "🎁" visible sur chaque item d'inventaire dans CraftSheet.

Purpose: Le long-press est invisible pour l'utilisateur — un bouton explicite rend la fonctionnalite cadeau decouvrable.
Output: Bouton offrir visible sur les 3 types de lignes inventaire (harvest, building_resource, crafted).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/mascot/CraftSheet.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remplacer long-press par bouton offrir sur les 3 types de lignes inventaire</name>
  <files>components/mascot/CraftSheet.tsx</files>
  <action>
Modifier 3 endroits dans CraftSheet.tsx :

1. **Harvest rows (~ligne 552-584):**
   - Remplacer `Pressable` par `View` (supprimer onLongPress et delayLongPress)
   - Ajouter un `TouchableOpacity` bouton "🎁" AVANT le bouton Vendre existant
   - onPress: `() => onOfferItem?.('harvest', cropId, qty, cropName)`
   - Style: meme pattern que sellBtn mais sans bordure, juste le emoji compact
   - Style inline: `{ paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md }`

2. **Resource rows (~ligne 598-616):**
   - Remplacer `Pressable` par `View` (supprimer onLongPress et delayLongPress)
   - Ajouter un `TouchableOpacity` bouton "🎁" a la fin de la ligne (apres inventoryInfo)
   - onPress: `() => onOfferItem?.('building_resource', resourceId, qty, resName)`
   - Meme style compact que ci-dessus

3. **Crafted rows dans renderCreations (~ligne 685-717):**
   - Remplacer `Pressable` par `View` (supprimer onLongPress et delayLongPress)
   - Ajouter un `TouchableOpacity` bouton "🎁" AVANT le bouton Vendre existant
   - onPress: `() => onOfferItem?.('crafted', recipe.id, count, recipeName)`
   - Meme style compact

Le bouton cadeau est un simple emoji "🎁" dans un TouchableOpacity compact. Pas de texte "Offrir" pour ne pas surcharger la ligne qui a deja un bouton Vendre. Le fontSize du emoji: FontSize.body pour bonne lisibilite.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
    - Les 3 types de lignes inventaire affichent un bouton "🎁" visible
    - Le long-press est supprime partout (aucun onLongPress dans renderInventaire ni renderCreations)
    - Le bouton cadeau appelle onOfferItem avec le bon type/id/qty/name
    - TypeScript compile sans nouvelles erreurs
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` compile sans nouvelles erreurs
- Grep: aucun `onLongPress` dans les sections renderInventaire/renderCreations
- Grep: 3 occurrences de `onOfferItem` dans les TouchableOpacity (une par type)
</verification>

<success_criteria>
Les boutons "🎁" sont visibles et fonctionnels sur chaque ligne inventaire. Le long-press est entierement supprime.
</success_criteria>

<output>
After completion, create `.planning/quick/260404-rfs-remplacer-long-press-cadeau-par-bouton-o/260404-rfs-SUMMARY.md`
</output>
