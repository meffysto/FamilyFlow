---
phase: quick-260415-egg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [components/mascot/NativePlacedItems.tsx]
autonomous: true
requirements: [QUICK-EGG]
must_haves:
  truths:
    - "Les animaux pixel art dans Mon jardin sont visiblement plus grands (40px au lieu de 20px)"
    - "Les items illustration sont plus grands (48px au lieu de 32px)"
    - "Les emojis sont plus grands (fontSize 26, container 32px)"
  artifacts:
    - path: "components/mascot/NativePlacedItems.tsx"
      provides: "Tailles augmentees des inhabitants"
      contains: "ANIMAL_SIZE = 40"
  key_links: []
---

<objective>
Augmenter la taille des inhabitants (animaux pixel art, items illustration, emojis) dans NativePlacedItems.tsx pour une meilleure visibilite dans Mon jardin.

Purpose: Les animaux et items sont trop petits pour etre bien visibles sur l'ecran du diorama.
Output: NativePlacedItems.tsx mis a jour avec les nouvelles tailles.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/mascot/NativePlacedItems.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Augmenter les tailles dans NativePlacedItems.tsx</name>
  <files>components/mascot/NativePlacedItems.tsx</files>
  <action>
Dans components/mascot/NativePlacedItems.tsx, modifier les 4 valeurs suivantes :

1. Constante ANIMAL_SIZE : 20 -> 40
2. Constante ITEM_SIZE : 32 -> 48
3. Style emoji fontSize : 20 -> 26
4. Style emoji width/height : 24 -> 32

Aussi ajuster le centrage emoji (left/top offset) de -12 a -16 pour correspondre au nouveau container 32px (32/2 = 16).
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | tail -5</automated>
  </verify>
  <done>ANIMAL_SIZE=40, ITEM_SIZE=48, emoji fontSize=26, emoji container=32x32, centrage emoji -16. tsc passe sans erreur.</done>
</task>

</tasks>

<verification>
npx tsc --noEmit passe sans nouvelles erreurs.
</verification>

<success_criteria>
Les constantes et styles dans NativePlacedItems.tsx refletent les nouvelles tailles demandees.
</success_criteria>

<output>
After completion, create `.planning/quick/260415-egg-augmenter-la-taille-des-inhabitants-dans/260415-egg-SUMMARY.md`
</output>
