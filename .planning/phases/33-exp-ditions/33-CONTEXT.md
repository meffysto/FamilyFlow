# Phase 33: Expéditions - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Système d'expéditions à risque — le joueur mise des feuilles et des récoltes pour lancer des missions à timer, reçoit un résultat aléatoire pondéré, et peut obtenir des objets exclusifs introuvables autrement. Sink récurrent infini pour l'économie de feuilles et de récoltes.

</domain>

<decisions>
## Implementation Decisions

### Catalogue & difficulté
- **D-01:** Pool rotatif de 3 missions par jour (seed basé sur la date = même pool pour toute la famille)
- **D-02:** Coût d'entrée double : feuilles + récoltes (style OGame métal+cristal+deutérium). Les deux ressources sont consommées, créant un double sink.
- **D-03:** 3 niveaux de difficulté par rotation : Facile / Moyen / Dur — les thèmes et destinations varient chaque jour

### Timer & déroulement
- **D-04:** Durées par difficulté : Facile 4h, Moyen 12h, Dur 24h
- **D-05:** Maximum 2 expéditions simultanées par profil — permet de lancer une courte + une longue en parallèle
- **D-06:** Résultat calculé au retour dans l'app (pattern `lastCollectAt` des bâtiments). Pas de notification push. Effet surprise à l'ouverture.

### Résultats & loot table
- **D-07:** Perte totale de la mise en cas d'échec — le risque est réel, OGame-style. Confirmation claire avant lancement.
- **D-08:** Probabilités pour difficulté moyenne (12h) : Réussite 40%, Partielle 30%, Échec 20%, Découverte rare 10%. Ajuster par difficulté (facile = plus de succès, dur = plus de rare).
- **D-09:** Types de récompenses exclusives : habitants exclusifs (Renard, Aigle, etc.), graines rares boostées (Fleur de lave, etc.), boosters temporaires (x2 récolte, x2 production, +chance dorée). Pas de décos exclusives expédition.
- **D-10:** Pity system : après 5 échecs consécutifs, prochaine expédition garantie réussite minimum. Même pattern que le loot box existant (gamification/rewards.ts).

### UI & point d'entrée
- **D-11:** Point d'entrée : bâtiment "Camp d'exploration" sur la grille ferme. Tap → ouvre le modal expéditions.
- **D-12:** Modal pageSheet (pattern BuildingsCatalog) pour le catalogue d'expéditions. Drag-to-dismiss, spring animations.
- **D-13:** Résultat : coffre animé à ouvrir (tap) avec animation d'ouverture + haptic + révélation du contenu
- **D-14:** Indicateur en cours : badge numérique (1/2) + mini countdown sur le bâtiment Camp d'exploration

### Claude's Discretion
- Thèmes/noms des destinations d'expédition (Forêt, Montagne, Océan, etc.)
- Coûts exacts par niveau de difficulté (scaling feuilles + quelles récoltes)
- Probabilités exactes pour Facile et Dur (ajustement depuis la baseline Moyen 40/30/20/10)
- Nombre et identité des habitants/graines exclusifs
- Durée et puissance des boosters temporaires
- Algorithme de génération du pool rotatif quotidien (seed date-based)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Économie & craft
- `lib/mascot/craft-engine.ts` — Logique craft/vente, sellCraftedItem, sellRawHarvest, canCraft, inventaire
- `lib/mascot/types.ts` — FarmInventory, HarvestInventory, CropCatalog, TREE_DECORATIONS, TREE_INHABITANTS, CraftRecipe[], BUILDING_CATALOG
- `lib/mascot/farm-engine.ts` — Planting, harvest, golden crop, rollSeedDrop, rollHarvestEvent

### Timer & production
- `lib/mascot/building-engine.ts` — Pattern lastCollectAt + elapsed time, getPendingResources, getMinutesUntilNext, MAX_PENDING

### Loot & rewards
- `lib/gamification/rewards.ts` — REWARDS record, weighted drop rates, pity system (5 box guarantee)
- `lib/gamification/engine.ts` — completeTask → coins attribution

### Persistance
- `lib/parser.ts` — parseFarmProfile / serializeFarmProfile, format CSV farm-{profileId}.md
- `lib/types.ts` — Profile interface (coins field), FarmProfileData

### UI patterns
- `components/village/BuildingsCatalog.tsx` — Modal pageSheet, spring animations, SecureStore badges, locked/unlocked states
- `components/mascot/BuildingShopSheet.tsx` — Sprite rendering, AwningStripes, glossy buttons

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **BuildingsCatalog modal** : pattern complet pageSheet + spring + haptic — réutilisable pour le catalogue d'expéditions
- **building-engine.ts timer pattern** : `lastCollectAt` ISO + elapsed time calculation — directement applicable aux timers d'expédition
- **rewards.ts loot system** : weighted probability tables + pity counter — réutilisable pour les résultats d'expédition
- **rollSeedDrop / rollHarvestEvent** : tables de probabilité multi-règles avec fallback chain
- **CSV serialization** : pattern `key:value,key:value` pour la persistance dans farm-{profileId}.md
- **SecureStore** : pattern "nouveau ✨" badge lifecycle pour les résultats non-ouverts

### Established Patterns
- Toutes les timestamps sont des strings ISO
- Les inventaires sont des CSV `key:val` pairs
- Les arrays utilisent des séparateurs `|` (buildings) ou `,` (inventory)
- Modal = `presentationStyle="pageSheet"` + drag-to-dismiss
- Haptic feedback via `expo-haptics` pour les interactions importantes
- `useThemeColors()` pour toutes les couleurs

### Integration Points
- `FarmProfileData` dans types.ts : ajouter champs expéditions (active + history)
- `parseFarmProfile` / `serializeFarmProfile` dans parser.ts : nouveau parsing expéditions
- `useVault` hooks : nouveau hook `useExpeditions` ou extension de `useFarm`
- Grille ferme : ajouter le bâtiment Camp d'exploration comme slot spécial
- `TREE_INHABITANTS` / `CROP_CATALOG` : nouveaux items marqués expedition-exclusive

</code_context>

<specifics>
## Specific Ideas

- **Inspiration OGame** : le système doit recréer la tension OGame de miser des ressources avec un risque réel de perte. Le double coût (feuilles + récoltes) mime le métal+cristal+deutérium.
- **Pool rotatif quotidien** : seed basé sur la date pour que toute la famille voie les mêmes missions. Crée un sujet de conversation ("tu as vu la mission d'aujourd'hui ?").
- **Coffre animé** : le moment de révélation du résultat est crucial — doit être excitant comme ouvrir un cadeau.
- **Sink infini** : l'objectif premier est de créer un drain récurrent pour les feuilles accumulées après 1 mois de jeu. Les coûts doivent scaler avec la difficulté pour rester pertinents à tout niveau de richesse.

</specifics>

<deferred>
## Deferred Ideas

- **Bâtiments à niveaux infinis OGame-style** : upgrade exponentiels des bâtiments existants (poulailler, grange, etc.) — sink additionnel, phase séparée
- **Expéditions familiales collectives** : toute la famille contribue vers une mission commune — extension future
- **Marché rotatif** : marchand avec items exclusifs qui changent — complémentaire aux expéditions
- **Défense de ferme** : événements aléatoires menaçant la ferme + structures de protection consommables

</deferred>

---

*Phase: 33-exp-ditions*
*Context gathered: 2026-04-14*
