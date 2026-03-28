# Phase 6: Batiments Productifs - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

L'utilisateur peut construire des batiments sur la ferme qui generent des ressources specifiques passivement. 3 batiments (poulailler, grange, moulin), 3 niveaux chacun, production calculee au lancement, collecte via tap. Pas de craft ni de tech tree — uniquement la construction, production, et amelioration des batiments.

</domain>

<decisions>
## Implementation Decisions

### Types de batiments (BAT-01)
- **D-01:** 3 batiments au total : poulailler (existant), grange (existant), moulin (nouveau). Garder les 2 existants du BUILDING_CATALOG + ajouter 1.
- **D-02:** Le moulin transforme le ble en farine — prepare le terrain pour Phase 7 (Craft). Necessite un 3eme slot building dans world-grid.ts.
- **D-03:** Chaque batiment a un `minTreeStage` requis pour le debloquer (poulailler = arbuste, grange = arbre, moulin = arbre ou majestueux)

### Production passive (BAT-02)
- **D-04:** Check au lancement — quand l'app s'ouvre, calculer le temps ecoule depuis la derniere collecte et generer les ressources accumulees. Pas de timer en background.
- **D-05:** Ressources specifiques par batiment — poulailler → oeufs, grange → lait, moulin → farine. Nouveau systeme d'inventaire de ressources.
- **D-06:** Bulle/badge sur le batiment quand des ressources sont pretes a collecter. Tap pour collecter (style Stardew Valley / Hay Day).
- **D-07:** Frequence de production : 4-8 heures par unite. 1-2 collectes par jour, rythme adapte au quotidien familial.
- **D-08:** Les ressources produites sont persistees dans le vault (gamification.md ou fichier dedie) et survivent a un redemarrage.

### Ameliorations batiments (BAT-03)
- **D-09:** 3 niveaux par batiment : Niveau 1 (base), Niveau 2 (+50% production, ou frequence reduite), Niveau 3 (+100% production)
- **D-10:** Cout en feuilles (monnaie existante) croissant par niveau. Pas de cout en ressources.
- **D-11:** Sprite different par niveau — 3 sprites par batiment (petit → moyen → grand/orne). Changement visuel immediat apres upgrade.
- **D-12:** 3 batiments x 3 niveaux = 9 sprites de batiment au total

### Interface construction
- **D-13:** Tap cellule building vide → bottom sheet avec liste des batiments constructibles, cout, et bouton construire. Pattern similaire au tap parcelle crop.
- **D-14:** Tap batiment place → bottom sheet detail : production actuelle, ressources accumulees (bouton collecter), et bouton ameliorer avec cout du prochain niveau.
- **D-15:** Sprites de batiments generes par IA dans le style Mana Seed pixel 32x32 (pas de pack Mana Seed batiments disponible).

### Claude's Discretion
- Structure exacte de la persistance inventaire dans le vault (nouveau fichier ou extension gamification.md)
- Calibration precise des couts de construction/amelioration contre le modele XP budget
- Frequence exacte de production par batiment (4h, 6h, ou 8h)
- Animation de collecte (burst particules, son, haptics)
- Ajout du 3eme slot building dans world-grid.ts (position exacte)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Batiments existants
- `lib/mascot/types.ts` — BuildingDefinition, BUILDING_CATALOG (poulailler + grange deja definis)
- `lib/mascot/world-grid.ts` — WORLD_GRID, BUILDING_CELLS (2 slots b0/b1, a etendre avec b2)

### Systeme ferme
- `lib/mascot/farm-engine.ts` — Logique planter/pousser/recolter, pattern a suivre pour la production passive
- `lib/mascot/crop-sprites.ts` — Pattern de mapping require() pour les sprites (a reproduire pour buildings)
- `components/mascot/WorldGridView.tsx` — Rendu des cellules (CropCell existant, BuildingCell a creer)
- `components/mascot/TreeView.tsx` — Diorama principal, integration des batiments

### Modele economique
- `constants/rewards.ts` — Modele XP budget, calibration des recompenses (couts batiments a aligner)
- `lib/mascot/types.ts:316-331` — BuildingDefinition actuelle (cost, dailyIncome, minTreeStage)

### Persistance
- `hooks/useVault.ts` — Pattern de lecture/ecriture vault (source unique d'etat)
- `lib/parser.ts` — Parse/serialize markdown vault files (pattern pour le nouvel inventaire)

### UI patterns
- `components/mascot/TreeShop.tsx` — Boutique existante (pattern bottom sheet pour achat)
- `components/mascot/FarmPlots.tsx` — Tap parcelle existant (pattern pour tap cellule building)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BuildingDefinition` interface + `BUILDING_CATALOG` : base pour etendre avec moulin + niveaux
- `BUILDING_CELLS` dans world-grid : 2 emplacements pre-definis (b0, b1)
- `TreeShop.tsx` : pattern bottom sheet d'achat reutilisable pour la construction
- `FarmPlots.tsx` : pattern tap → action sur cellule
- `HarvestBurst.tsx` : animation burst reutilisable pour la collecte

### Established Patterns
- Persistance vault : markdown + frontmatter via gray-matter (parser.ts)
- Sprites : require() mapping dans des constantes (CROP_SPRITES, ITEM_ILLUSTRATIONS)
- Bottom sheet : presentation pageSheet + drag-to-dismiss
- Animations : react-native-reanimated withSpring/withTiming
- Haptics : expo-haptics sur les interactions importantes

### Integration Points
- `world-grid.ts` — Ajouter 3eme slot building (b2)
- `types.ts` — Etendre BuildingDefinition avec levels, resourceType, etc.
- `useVault.ts` — Ajouter actions pour construire, ameliorer, collecter
- `WorldGridView.tsx` — Ajouter rendu BuildingCell
- `gamification.md` ou nouveau fichier — Persister l'etat des batiments et inventaire

</code_context>

<specifics>
## Specific Ideas

- Le moulin prepare le terrain pour Phase 7 (Craft) : sa production (farine) sera un ingredient de recettes
- Les bulles de collecte doivent etre visibles sans etre intrusives — l'utilisateur doit avoir envie de taper mais pas se sentir oblige
- 3 sprites par batiment x 3 batiments = 9 sprites generes par IA dans le style Mana Seed pixel

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-batiments-productifs*
*Context gathered: 2026-03-28*
