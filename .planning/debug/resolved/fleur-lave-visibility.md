---
status: resolved
trigger: "fleur-lave-visibility — La fleur de lave n'est pas visible car le sprite sort de la zone de la parcelle ET est masqué par le badge de sporée (25/48)"
created: 2026-05-01T10:00:00Z
updated: 2026-05-01T10:25:00Z
resolved: 2026-05-01T10:25:00Z
---

## Current Focus

hypothesis: FIX APPLIQUÉ — overflow:hidden retiré + cropSprite ajusté à 32x64
test: Rebuild app + vérifier affichage fleur_lave avec badge sporée
expecting: Le sprite fleur_lave visible intégralement, déborde au-dessus de la cellule. Badge sporée toujours visible mais ne masque plus le sprite.
next_action: Demander vérification humaine du rendu visuel en conditions réelles

## Symptoms

expected: Le sprite de la fleur de lave devrait "sortir" en hauteur de sa parcelle s'il est trop grand (comme les autres sprites de culture)
actual: Le sprite est coupé/invisible ET masqué par le badge de sporée en position top-right
errors: Aucune erreur console, problème purement visuel/layout
reproduction: Planter une fleur de lave avec une sporée de régularité → le compteur 25/48 masque le sprite
timeline: Dès la première plantation de fleur de lave, jamais fonctionné correctement
scope: Uniquement la fleur de lave, les autres cultures s'affichent correctement

## Eliminated

## Evidence

- timestamp: 2026-05-01T10:00:00Z
  checked: Code existant WorldGridView.tsx, PlantWagerBadge.tsx, crop-sprites.ts
  found: CropCell a overflow:hidden (L983), sprite 36x44 (L1002), badge zIndex:12 position top-right (PlantWagerBadge L100-111)
  implication: Si fleur_lave fait >44px hauteur, sera clippé. Badge sporée peut masquer même avec bon overflow.

- timestamp: 2026-05-01T10:05:00Z
  checked: Dimensions réelles des assets PNG dans assets/garden/crops/
  found: TOUS les crops (fleur_lave, tomato, carrot, sunflower) sont 32x64px
  implication: TOUS les sprites de cultures sont clippés par le style 36x44 + overflow:hidden. 20px de hauteur perdus sur chaque sprite.

- timestamp: 2026-05-01T10:10:00Z
  checked: CELL_SIZES dans world-grid.ts + styles cropSprite vs buildingSprite
  found: Cellules small=52px, large=64px. Buildings 64x64 (OK), Crops 32x64 mais style=36x44 (clippé)
  implication: Les crops sont CONÇUS pour dépasser (64px > 52px cell) mais overflow:hidden les coupe. Le style cropSprite 36x44 aggrave le problème.

- timestamp: 2026-05-01T10:15:00Z
  checked: Fix appliqué dans WorldGridView.tsx
  found: overflow:hidden retiré de styles.cell, cropSprite 36x44 → 32x64
  implication: Types OK (npx tsc --noEmit), changement uniquement visuel

- timestamp: 2026-05-01T10:20:00Z
  checked: Type checking final
  found: Aucune nouvelle erreur TypeScript
  implication: Fix structurellement sain, prêt pour vérification visuelle

## Resolution

root_cause: Les sprites de cultures (32x64px) sont contraints à 36x44px dans une cellule de 52x52px avec overflow:hidden. Les 20px de hauteur supérieure sont clippés. Le badge sporée (zIndex:12, top-right) masque ensuite le peu de sprite qui reste visible.

fix:
1. Retiré overflow:hidden de styles.cell (L983) pour permettre débordement vertical
2. Ajusté cropSprite de 36x44 → 32x64 (L1002) pour respecter dimensions réelles des assets
3. Commentaires ajoutés pour expliquer la logique

verification: ✅ Confirmé par utilisateur — sprite fleur de lave visible, tous les crops s'affichent correctement, badge sporée reste visible. Committé 038eac6, pushé origin/main, closes FAM-5.

files_changed:
  - components/mascot/WorldGridView.tsx
