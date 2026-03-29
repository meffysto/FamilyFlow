# Phase 8: Progression Ferme - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning
**Source:** Auto-mode (recommended defaults)

<domain>
## Phase Boundary

Un arbre de technologies ferme permet de debloquer des ameliorations permanentes (vitesse de pousse, rendement, nouvelles cultures) et de nouvelles zones/parcelles. L'utilisateur depense des feuilles pour acheter des noeuds tech. La progression est persistee dans le vault et visible sur l'ecran arbre.

Pas de cadeaux entre membres (Phase 9) — uniquement le systeme de progression ferme avec tech tree, ameliorations, et deblocage de zones.

</domain>

<decisions>
## Implementation Decisions

### Structure du tech tree (PRO-01)
- **D-01:** Arbre lineaire avec branches — 3 branches thematiques : Culture (vitesse pousse, rendement), Elevage (production batiments), Expansion (nouvelles parcelles). Chaque branche a 3-4 noeuds.
- **D-02:** Noeuds debloquables sequentiellement dans chaque branche — il faut debloquer le noeud N pour acceder au N+1. Les branches sont independantes entre elles.
- **D-03:** Cout en feuilles croissant par noeud (100, 250, 500, 1000). Pas de cout en ressources — les feuilles sont la monnaie universelle.
- **D-04:** Effets concrets par branche :
  - Culture : tasksPerStage -1 (min 1), harvestReward +25%, nouvelle culture debloquee (sunflower)
  - Elevage : production interval -25%, capacite stockage x2, nouvelle ressource (miel)
  - Expansion : +3 parcelles crop, +1 parcelle building, parcelle geante (size large pour crops)

### Deblocage de zones (PRO-02)
- **D-05:** Les nouvelles parcelles s'ajoutent au WORLD_GRID existant (extension). Rangee 4 de crops + 4eme slot building. Visibles mais verrouillees (cadenas) tant que le noeud tech n'est pas debloque.
- **D-06:** Animation de deblocage : cadenas qui s'ouvre avec spring + haptic feedback. La parcelle apparait avec un effet de reveal.

### Interface tech tree (PRO-03)
- **D-07:** Nouvel onglet dans le bottom sheet existant (a cote de Boutique, Atelier, Decorer) OU ecran dedie accessible depuis un bouton sur la ferme. Pattern coherent avec les bottom sheets existants.
- **D-08:** Affichage en arbre vertical avec les 3 branches cote a cote. Noeuds : cercle avec icone, couleur plein si debloque, grise si verrouille, avec cout affiche. Connexions par lignes entre noeuds.
- **D-09:** Tap sur un noeud debloquable → confirmation avec cout et description de l'effet. Tap sur un noeud verrouille → message "Debloque X d'abord".

### Persistance (PRO-03)
- **D-10:** Progression stockee dans famille.md comme champ profil : `farm_tech: "culture-1,culture-2,elevage-1"` (CSV des noeuds debloques). Pattern identique a farm_harvest_inventory et farm_crafted_items.
- **D-11:** Les effets des noeuds debloques sont appliques dynamiquement : farm-engine lit la liste tech du profil et ajuste les valeurs (tasksPerStage, harvestReward, intervals batiments, nombre de parcelles).

### Claude's Discretion
- Noms et icones exacts de chaque noeud tech
- Calibration precise des couts par noeud
- Design visuel de l'arbre (layout SVG ou composants RN)
- Nouvelles cultures et ressources ajoutees (sunflower, miel = suggestions, Claude peut ajuster)
- Placement exact des nouvelles parcelles dans le WORLD_GRID

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Ferme existante
- `lib/mascot/types.ts` — CropDefinition, PlantedCrop, CROP_CATALOG, PLOTS_BY_TREE_STAGE, TreeStage
- `lib/mascot/farm-engine.ts` — harvestCrop, advanceFarmCrops, plantCrop, tasksPerStage logic
- `lib/mascot/building-engine.ts` — BUILDING_CATALOG, collectBuilding, upgradeBuilding, production intervals
- `lib/mascot/world-grid.ts` — WORLD_GRID, WorldCell, getUnlockedCropCells, CROP_CELLS, BUILDING_CELLS
- `lib/mascot/craft-engine.ts` — CRAFT_RECIPES, BUILDING_RESOURCE_VALUE (affected by tech bonuses)

### Persistance et parsing
- `lib/parser.ts` — parseFamille/serializeFamille, profil fields pattern
- `hooks/useFarm.ts` — farm actions hook, writeProfileField/writeProfileFields pattern

### UI existante
- `components/mascot/WorldGridView.tsx` — rendu grille ferme, CropCell, BuildingCell
- `app/(tabs)/tree.tsx` — ecran arbre principal, boutons action (Boutique, Atelier, Decorer)
- `components/mascot/CraftSheet.tsx` — pattern bottom sheet recent (reference pour TechTreeSheet)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorldGridView.tsx` CropCell/BuildingCell : pattern de cellule avec animation, peut ajouter cadenas
- `CraftSheet.tsx` / `TreeShop` : pattern bottom sheet pageSheet pour le tech tree UI
- `useThemeColors()` : couleurs semantiques obligatoires
- `Spacing`, `Radius`, `FontSize` : tokens design existants
- `serializeHarvestInventory`/`parseCraftedItems` : pattern CSV pour persistance

### Established Patterns
- Profil fields dans famille.md : `farm_*` prefix pour les donnees ferme
- Bottom sheet avec Modal presentationStyle pageSheet + drag-to-dismiss
- Actions ferme centralisees dans `useFarm.ts` hook
- Animations reanimated (useSharedValue, withSpring)

### Integration Points
- `farm-engine.ts` : les fonctions pures doivent lire la tech list pour appliquer les bonus
- `world-grid.ts` : ajouter les nouvelles cellules conditionnelles
- `tree.tsx` : ajouter le bouton Tech / Progression
- `parser.ts` : ajouter le champ farm_tech au profil
- `useFarm.ts` : ajouter unlockTech action

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-progression-ferme*
*Context gathered: 2026-03-29 via auto-mode*
