# Phase 7: Craft - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Les recoltes brutes (cultures + ressources batiments) peuvent etre combinees en items speciaux via des recettes de craft. 3-4 recettes au lancement, interface Atelier dans un bottom sheet, items stockes en inventaire et vendables pour XP+feuilles x2. Changement majeur : harvestCrop stocke l'item au lieu de donner des feuilles directement.

Pas de tech tree (Phase 8), pas de cadeaux entre membres (Phase 9) — uniquement le systeme de craft, catalogue, et inventaire etendu.

</domain>

<decisions>
## Implementation Decisions

### Recettes & ingredients (CRA-01, CRA-02)
- **D-01:** 3-4 recettes au lancement : Confiture (fraise + fraise), Gateau (farine + oeuf + fraise), Omelette (oeuf + tomate), Bouquet (tulipe + tournesol). Set classique varie en difficulte.
- **D-02:** Les ingredients sont un mix de recoltes cultures (CROP_CATALOG) + ressources batiments (FarmInventory : oeuf, lait, farine). Les deux systemes sont connectes.
- **D-03:** Inventaire recoltes — harvestCrop() ne donne plus de feuilles directement. La recolte stocke l'item dans un inventaire par profil. Le joueur choisit ensuite : vendre pour feuilles OU garder pour craft. Changement breaking sur le flux actuel.

### Interface craft
- **D-04:** Bouton "Atelier" sur l'ecran ferme (tree.tsx) qui ouvre un bottom sheet craft. Coherent avec TreeShop et BuildingShop (pattern bottom sheet pageSheet + drag-to-dismiss).
- **D-05:** Flow catalogue + tap : liste des recettes avec ingredients requis et stock actuel. Recette disponible = bouton "Crafter" actif. Une seule etape.
- **D-06:** Animation burst (style HarvestBurst existant) + haptic impact + item apparait avec spring quand un item est crafte.
- **D-07:** Section "Mes creations" dans le craft sheet pour voir les items craftes en inventaire. Tout centralise au meme endroit.

### Destin des items craftes
- **D-08:** Les items craftes restent en inventaire. Le joueur peut les vendre pour XP bonus + feuilles. Prepare Phase 9 (cadeaux) sans l'implementer maintenant.
- **D-09:** La vente se fait depuis la section "Mes creations" du craft sheet.

### Bonus XP (CRA-03)
- **D-10:** Multiplicateur x2 : un item crafte vaut 2x la valeur de la somme des ingredients vendus separement. Motive le craft sans rendre la vente directe inutile.
- **D-11:** Le bonus x2 s'applique a l'XP et aux feuilles (coins). Recompense unifiee, simple a comprendre.

### Claude's Discretion
- Structure exacte de l'inventaire recoltes dans le vault (extension de FarmInventory ou nouveau type)
- Calibration precise des valeurs de vente par item crafte (basee sur harvestReward des ingredients x2)
- Sprites des items craftes (style Mana Seed pixel 32x32 ou icones generees)
- Transition UX pour le changement harvestCrop (message explicatif, tutoriel in-app)
- Organisation du code craft (nouveau fichier craft-engine.ts ou extension farm-engine.ts)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Systeme ferme existant
- `lib/mascot/farm-engine.ts` — harvestCrop() actuel (retourne reward en feuilles — a modifier pour inventaire), plantCrop(), CROP_CATALOG
- `lib/mascot/building-engine.ts` — collectBuilding(), serializeInventory/parseInventory, FarmInventory (oeuf/lait/farine)
- `lib/mascot/types.ts` — PlantedCrop, CropDefinition, FarmInventory, ResourceType, BuildingDefinition, CROP_CATALOG, BUILDING_CATALOG
- `hooks/useFarm.ts` — handleHarvest (donne coins via addCoins — a refactorer pour inventaire), handlePlant, handleCollectBuilding

### Grille et rendu
- `lib/mascot/world-grid.ts` — WORLD_GRID, placement des cellules
- `components/mascot/WorldGridView.tsx` — Rendu cellules ferme
- `components/mascot/TreeView.tsx` — Diorama principal, integration bouton Atelier

### UI patterns existants
- `components/mascot/TreeShop.tsx` — Pattern bottom sheet achat (a reproduire pour Atelier craft)
- `components/mascot/HarvestBurst.tsx` — Animation burst reutilisable pour feedback craft
- `components/mascot/FarmPlots.tsx` — Pattern tap parcelle

### Persistance
- `lib/parser.ts` — Parse/serialize markdown vault (pattern pour inventaire recoltes + items craftes)
- `hooks/useVault.ts` — Source unique d'etat, actions vault

### Economie
- `lib/gamification/engine.ts` — Systeme XP et niveaux
- `lib/mascot/types.ts:CROP_CATALOG` — harvestReward par culture (base pour calcul valeur craft x2)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FarmInventory` interface + `serializeInventory`/`parseInventory` : base pour etendre avec recoltes cultures
- `TreeShop.tsx` : pattern bottom sheet reutilisable pour l'Atelier craft
- `HarvestBurst.tsx` : animation burst reutilisable pour le feedback craft
- `CROP_CATALOG` : 10 cultures avec harvestReward (base pour calcul valeur craft)
- `ITEM_ILLUSTRATIONS` : mapping require() pour les sprites items existants

### Established Patterns
- Bottom sheet : presentation pageSheet + drag-to-dismiss (TreeShop, BuildingShop)
- Persistance vault : markdown + frontmatter via gray-matter (parser.ts)
- Sprites : require() mapping dans des constantes
- Animations : react-native-reanimated withSpring/withTiming
- Haptics : expo-haptics sur les interactions importantes
- Inventaire ressources : CSV serialise dans famille.md (farm_inventory)

### Integration Points
- `farm-engine.ts` — Modifier harvestCrop() pour stocker au lieu de reward feuilles
- `types.ts` — Ajouter CraftRecipe, CraftedItem, etendre inventaire
- `useFarm.ts` — Ajouter actions craft, vendre, inventaire recoltes
- `tree.tsx` — Ajouter bouton Atelier
- `parser.ts` — Serialiser/parser inventaire recoltes + items craftes dans famille.md

</code_context>

<specifics>
## Specific Ideas

- Le moulin produit de la farine explicitement comme ingredient craft (decision Phase 6 D-02)
- Les bulles de collecte batiments restent — le craft est un usage supplementaire des ressources, pas un remplacement
- Le changement harvestCrop (inventaire au lieu de feuilles directes) est le point le plus critique — impacte le flux quotidien existant
- Le set classique (confiture, gateau, omelette, bouquet) couvre des ingredients varies pour motiver la diversite de culture

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-craft*
*Context gathered: 2026-03-29*
