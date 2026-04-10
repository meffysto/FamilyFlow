# Phase 28: Portail + câblage contributions - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

La boucle coopérative est complète : un portail animé dans la ferme perso permet d'accéder au village, les récoltes ferme et tâches IRL alimentent automatiquement l'objectif village, et l'atteinte de l'objectif déclenche une récompense collective (bonus in-game + suggestion d'activité IRL).

Requirements couverts : MAP-03, COOP-01, COOP-02, OBJ-03, OBJ-04.

</domain>

<decisions>
## Implementation Decisions

### Portail visuel
- **D-01:** Le portail est une arche en pierre pixel art, cohérente avec l'univers ferme. Sprite statique avec effet lumineux subtil (glow ou particules via Reanimated).
- **D-02:** La transition ferme → village est un fade cross-dissolve Reanimated (~400ms). Pas de zoom ni de slide.

### Câblage contributions
- **D-03:** 1 récolte = 1 point, 1 tâche complétée = 1 point. Pas de pondération par difficulté/rareté. L'objectif hebdo s'ajuste déjà via `computeWeekTarget()`.
- **D-04:** Feedback contribution automatique = toast discret « +1 Village 🏡 » en bas d'écran (~2s), non-bloquant. L'action principale (récolte/tâche) conserve son propre feedback existant.
- **D-05:** Point d'insertion récoltes : `useFarm.ts` après `harvestCrop()` (ligne ~287). Point d'insertion tâches : `useGamification.ts` dans `applyTaskEffect()` (ligne ~234). Les deux appellent `addContribution(type, profileId)` de `useGarden.ts`.

### Récompense collective
- **D-06:** Suggestion d'activité IRL présentée comme une carte sur l'écran village quand l'objectif est atteint. Liste curated de ~20 activités filtrées par saison. Dismiss par tap.

### Claude's Discretion
- **D-07:** Montant du bonus XP et nature de l'item cosmétique à la discrétion de Claude. Doit être équitable (même bonus pour tous les profils, pas proportionnel à la contribution — conformément au Out of Scope « leaderboard compétitif »). Réutiliser le système de loot existant si pertinent.

### Navigation
- **D-08:** Le portail remplace le FAB temporaire de `tree.tsx` (ligne 2031). Un seul point d'entrée vers le village : le portail. Depuis le village, bouton retour classique vers la ferme.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Données village
- `.planning/phases/25-fondation-donnees-village/` — Schéma jardin-familial.md, parser, grille, templates
- `lib/village/types.ts` — Types VillageData, ContributionType ('harvest' | 'task'), VillageWeekRecord
- `lib/village/` — Module complet (parser, grid, templates, barrel index.ts)

### Hook village
- `hooks/useGarden.ts` — addContribution(), claimReward(), gardenData, progress, isGoalReached
- `.planning/phases/26-hook-domaine-jardin/` — Décisions D-01 à D-10 du hook

### Écran village existant
- `app/(tabs)/village.tsx` — Carte, feed, barre progression, historique (Phase 27)
- `.planning/phases/27-cran-village-composants/` — Plans et contexte Phase 27

### Points d'insertion contributions
- `hooks/useFarm.ts` §287 — harvestCrop() : insérer addContribution('harvest', profileId)
- `hooks/useGamification.ts` §234 — applyTaskEffect() : insérer addContribution('task', profileId)

### Ferme (portail)
- `app/(tabs)/tree.tsx` §2031 — FAB temporaire village à remplacer par le portail
- `components/mascot/TileMapRenderer.tsx` — Renderer tilemap réutilisable

### Gamification existante
- `lib/gamification/` — Système XP, niveaux, loot boxes (barrel index.ts)
- `lib/semantic/effects.ts` — applyTaskEffect() dispatcher

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useGarden.addContribution(type, profileId)` — Prêt à câbler, append-only dans le vault
- `useGarden.claimReward(profileId)` — Anti-double-claim via `village_claimed_week` dans gami-{id}.md
- `TileMapRenderer` — Renderer tilemap existant, utilisé pour ferme et village
- Système toast existant (ToastProvider dans la hiérarchie providers)
- Système loot existant dans `lib/gamification/`
- `expo-haptics` pour feedback tactile

### Established Patterns
- Animations Reanimated : `useSharedValue` + `useAnimatedStyle` + `withTiming`/`withSpring`
- Spring config en constante module : `const SPRING_CONFIG = { damping: 10, stiffness: 180 }`
- Hooks domaine isolés (useGarden, useFarm, useGamification) qui consomment useVault()
- Styles dynamiques via `useThemeColors()`, statiques via `StyleSheet.create()`

### Integration Points
- `useFarm.ts` après harvestCrop() — injecter contribution 'harvest'
- `useGamification.ts` dans applyTaskEffect() — injecter contribution 'task'
- `tree.tsx` — supprimer FAB, ajouter sprite portail sur la grille ferme
- `village.tsx` — ajouter carte activité IRL quand objectif atteint

</code_context>

<specifics>
## Specific Ideas

- Le portail doit être cohérent avec l'esthétique pixel art de la ferme (arche en pierre, pas fantasy/sci-fi)
- Le village est actuellement un tableau de bord coopératif — pas d'interactions gameplay directes dans cette phase
- L'enrichissement interactif du village (avatars, ambiance dynamique, décorations) est planifié pour v1.5

</specifics>

<deferred>
## Deferred Ideas

- Enrichissement interactif du village (avatars, ambiance, arbre familial) — v1.5 (VILL-01 à VILL-05)
- Portail inverse dans le village pour retourner à la ferme (portail bidirectionnel visuel) — v1.5 potentiel

</deferred>

---

*Phase: 28-portail-câblage-contributions*
*Context gathered: 2026-04-11*
