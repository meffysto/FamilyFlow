---
phase: quick
plan: 260404-quw
type: execute
wave: 1
depends_on: []
files_modified:
  - components/mascot/CraftSheet.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Long-press sur un item inventaire (harvest, building_resource, crafted) declenche le callback onOfferItem dans CraftSheet"
    - "Le bouton Vendre (tap) fonctionne toujours normalement"
    - "Le scroll vertical de la liste inventaire reste fluide"
  artifacts:
    - path: "components/mascot/CraftSheet.tsx"
      provides: "Pressable remplace TouchableOpacity pour les 3 types d'items inventaire"
      contains: "onLongPress"
  key_links:
    - from: "Pressable (inventory rows)"
      to: "onOfferItem callback"
      via: "onLongPress prop"
      pattern: "onLongPress.*onOfferItem"
---

<objective>
Fix long-press not working on inventory items in CraftSheet.

Purpose: TouchableOpacity inside ScrollView has a gesture conflict — the ScrollView captures the touch before the 400ms long-press timer fires. Pressable from react-native handles this correctly.

Output: CraftSheet.tsx with Pressable for inventory rows, long-press working inside ScrollView.
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
  <name>Task 1: Remplacer TouchableOpacity par Pressable sur les 3 types d'items inventaire</name>
  <files>components/mascot/CraftSheet.tsx</files>
  <action>
1. Ajouter `Pressable` a l'import react-native (ligne 15, a cote de TouchableOpacity qui reste pour les autres usages).

2. Remplacer les 3 TouchableOpacity englobants des items inventaire par Pressable :

   a) **Harvest items** (ligne ~551) : Remplacer `<TouchableOpacity` par `<Pressable` et `</TouchableOpacity>` par `</Pressable>`.
      - Garder : `style`, `onLongPress`, `delayLongPress={400}`
      - Retirer : `activeOpacity={1}` (pas supporte par Pressable)
      - Le TouchableOpacity imbriqué du bouton Vendre (ligne ~570) reste tel quel.

   b) **Building resource items** (ligne ~598) : Meme remplacement.
      - Garder : `style`, `onLongPress`, `delayLongPress={400}`
      - Retirer : `activeOpacity={1}`

   c) **Crafted items** (ligne ~686) : Meme remplacement.
      - Garder : `style`, `onLongPress`, `delayLongPress={400}`
      - Retirer : `activeOpacity={1}`
      - Le TouchableOpacity imbriqué du bouton Vendre (ligne ~705) reste tel quel.

3. NE PAS toucher aux autres TouchableOpacity du fichier (boutons navigation, tabs, close, sell buttons).

4. TouchableOpacity reste dans les imports car il est utilise partout ailleurs dans le fichier.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -i "CraftSheet" || echo "OK — no type errors in CraftSheet"</automated>
  </verify>
  <done>Les 3 types d'items inventaire utilisent Pressable avec onLongPress={400ms}. Le bouton Vendre reste TouchableOpacity. Compilation TypeScript OK.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passe sans nouvelles erreurs dans CraftSheet.tsx
- Grep confirme 3 Pressable avec onLongPress dans le fichier
</verification>

<success_criteria>
Long-press sur les items inventaire (harvest, building_resource, crafted) declenche onOfferItem. Le scroll et les boutons Vendre restent fonctionnels.
</success_criteria>

<output>
After completion, create `.planning/quick/260404-quw-fix-long-press-not-working-on-inventory-/260404-quw-SUMMARY.md`
</output>
