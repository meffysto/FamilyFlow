# Phase 27: Ecran Village + composants - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Rendre l'espace cooperatif visible : un ecran village navigable avec carte tilemap cobblestone, feed de contributions hebdomadaires, barre de progression de l'objectif collectif, indicateurs par membre, et panneau historique des semaines accomplies. Pas de portail anime, pas de cablage auto-contribution (Phase 28).

</domain>

<decisions>
## Implementation Decisions

### Structure ecran & navigation
- **D-01:** L'ecran village est un sous-ecran de la ferme, accessible via `router.push('/(tabs)/village')` -- pas un nouvel onglet tab visible dans la barre de navigation
- **D-02:** Layout : carte tilemap fixe en haut (~40-50% ecran), puis sections scrollables en dessous (objectif, feed, indicateurs, historique) -- pattern similaire a tree.tsx
- **D-03:** Un bouton flottant (FAB) sur l'ecran ferme permet d'acceder au village -- temporaire, sera remplace par le portail anime en Phase 28

### Feed contributions & indicateurs
- **D-04:** Feed chronologique (plus recent en haut) -- chaque ligne : avatar emoji du profil + nom + type (recolte/tache) + montant + heure relative
- **D-05:** Limiter a 5 contributions visibles par defaut + lien "Voir tout" qui deplie la liste complete
- **D-06:** Indicateurs par membre : rangee horizontale d'avatars (ReactiveAvatar existant) avec le total de contribution sous chaque avatar

### Barre progression objectif
- **D-07:** Reutiliser le composant `LiquidXPBar` existant avec couleurs village (vert communautaire au lieu de bleu XP) -- zero nouveau composant de barre
- **D-08:** Quand l'objectif est atteint : la barre passe en couleur doree/festive et un bouton "Reclamer la recompense" apparait (le claim appelle `useGarden.claimReward`)

### Panneau historique
- **D-09:** Chaque semaine passee est un `CollapsibleSection` (composant existant) -- resume visible (theme, cible, total, statut), deplier pour detail par membre
- **D-10:** Le panneau historique est directement dans le scroll de l'ecran village, en bas apres le feed -- pas d'element interactif sur la carte

### Claude's Discretion
- Style exact du FAB (icone, couleur, position) -- coherent avec le theme village
- Animations de transition vers l'ecran village (fade/slide standard)
- Detail du layout interne de chaque section (padding, espacement)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Donnees village
- `lib/village/types.ts` -- VillageData, VillageContribution, VillageCell, ObjectiveTemplate
- `lib/village/grid.ts` -- VILLAGE_GRID positions (fontaine, etals, panneau)
- `lib/village/templates.ts` -- OBJECTIVE_TEMPLATES, BASE_TARGET, computeWeekTarget
- `lib/village/parser.ts` -- parseGardenFile, serializeGardenFile, appendContributionToVault, VILLAGE_FILE

### Hook domaine
- `hooks/useGarden.ts` -- UseGardenReturn (gardenData, progress, currentTarget, isGoalReached, currentTemplate, weekHistory, addContribution, claimReward)

### Composants reutilisables
- `components/mascot/TileMapRenderer.tsx` -- Rendu tilemap existant (props: treeStage, containerWidth, containerHeight, season)
- `components/ui/LiquidXPBar.tsx` -- Barre de progression (props: current, total, label, color, height)
- `components/ui/CollapsibleSection.tsx` -- Sections pliables
- `components/ui/ReactiveAvatar.tsx` -- Avatars membres

### Ecran ferme (reference layout)
- `app/(tabs)/tree.tsx` -- Pattern de reference pour le layout carte + panels

### Requirements
- `.planning/REQUIREMENTS.md` -- MAP-01, COOP-03, COOP-04, OBJ-02, HIST-01, HIST-02

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TileMapRenderer` : rendeur tilemap existant pour terrain farm -- reutilisable pour terrain cobblestone village (besoin de props/config pour terrain village distinct)
- `LiquidXPBar` : barre de progression existante -- reutilisable avec couleur village (vert)
- `CollapsibleSection` : sections pliables -- pour l'historique par semaine
- `ReactiveAvatar` : avatars emoji membres -- pour les indicateurs par membre
- `useGarden` hook : toute la logique village deja encapsulee (gardenData, progress, currentTarget, weekHistory, addContribution, claimReward)

### Established Patterns
- `tree.tsx` : pattern carte fixe + overlays/modals pour les interactions (reference layout)
- Navigation expo-router : `router.push('/(tabs)/village')` depuis la ferme
- Styles dynamiques via `useThemeColors()` + `StyleSheet.create()` pour les statiques
- `React.memo()` sur list items, `useCallback()` sur handlers

### Integration Points
- `app/(tabs)/village.tsx` : nouvel ecran a creer (route expo-router)
- `app/(tabs)/tree.tsx` : ajouter le bouton FAB vers le village
- `hooks/useGarden.ts` : source de donnees unique pour l'ecran village
- `contexts/VaultContext.tsx` : useGarden deja cable dans VaultProvider

</code_context>

<specifics>
## Specific Ideas

- Le terrain village doit etre visuellement distinct de la ferme (cobblestone dominant vs herbe)
- Les couleurs de la barre de progression village sont vertes (communautaire) et dorees (objectif atteint) -- distinctes du bleu XP standard
- Le feed utilise l'heure relative (il y a 2h, hier, lun.) plutot que des timestamps absolus

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 27-cran-village-composants*
*Context gathered: 2026-04-10*
