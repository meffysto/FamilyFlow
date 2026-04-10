# Phase 25: Fondation donnees village - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Persister les donnees du village dans un fichier Obsidian partage (`jardin-familial.md`) avec un parseur bidirectionnel, definir la grille village namespacee avec les positions des elements interactifs, et preparer les templates d'objectif hebdomadaire. Phase data/infrastructure — pas d'UI, pas de hook React.

</domain>

<decisions>
## Implementation Decisions

### Grille village (village-grid.ts)
- **D-01:** Layout minimal MVP — fontaine (centre), panneau historique, 2 etals. Elements supplementaires en v1.5.
- **D-02:** Type `VillageCell` dedie avec `id`, `x`, `y`, `role` ('fountain'|'stall'|'board'|'portal') — pas de reutilisation de `WorldCell` (unlockOrder/cellType inutiles pour des elements fixes).
- **D-03:** Phase 25 definit uniquement les positions des elements interactifs. La carte terrain cobblestone (pattern farm-map.ts Wang tileset) sera ajoutee en Phase 27 pour TileMapRenderer.

### Templates d'objectif
- **D-04:** Cibles unifiees — 1 recolte = 1 point, 1 tache IRL = 1 point. Un seul compteur de contributions.
- **D-05:** Cible hebdomadaire = `BASE_TARGET * nb_profils_actifs` (ex: base=15, 3 profils = 45).
- **D-06:** Templates thematises — chaque template a un nom, une icone, une description courte. Les themes rotent aleatoirement chaque semaine. Donne du sens a l'effort collectif.

### Emplacement du parser
- **D-07:** Module isole `lib/village/` avec parser.ts, grid.ts, types.ts, templates.ts — ne grossit pas le monolithe parser.ts (2800+ lignes).
- **D-08:** Barrel `lib/village/index.ts` suivant le pattern lib/mascot/ et lib/gamification/.
- **D-09:** Fichier vault dans `04 - Gamification/jardin-familial.md` a cote des gami-{id}.md.

### Decisions heritees (verrouillees)
- **D-10:** Format append-only pour les contributions — total derive a la lecture, jamais de total mutable ecrit (STATE.md Init v1.4).
- **D-11:** IDs grille village prefixes `village_` pour eviter collisions avec la ferme perso (STATE.md Init v1.4).
- **D-12:** Fichier partage `jardin-familial.md` entre tous les profils (ROADMAP.md).

### Claude's Discretion
- Structure exacte du frontmatter YAML de jardin-familial.md (champs, types)
- Format des lignes de contribution append-only (timestamp ISO vs epoch, separateur)
- Nombre exact de templates d'objectif a livrer en MVP (5-10 raisonnable)
- Constante BASE_TARGET valeur initiale (ajustable facilement)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Patterns existants a reproduire
- `lib/mascot/world-grid.ts` — Pattern WorldCell/WORLD_GRID pour la grille. VillageCell est un type simplifie inspire de ce pattern.
- `lib/mascot/farm-map.ts` — Pattern FarmMapData Wang tileset. La carte terrain village (Phase 27) suivra ce pattern.
- `lib/parser.ts` — Patterns parse*/serialize* existants (gray-matter frontmatter, parsing ligne par ligne). Le parseur village suit les memes conventions mais dans un module isole.
- `lib/museum/engine.ts` — Pattern module isole recent (Phase 23). Exemple de module self-contained hors parser.ts.
- `lib/mascot/index.ts` — Pattern barrel re-export a suivre pour lib/village/index.ts.

### Types et interfaces
- `lib/mascot/types.ts` — FarmProfileData, CROP_CATALOG, TreeStage. Le village reutilise les types de profil pour les contributions.
- `lib/mascot/companion-storage.ts` — Pattern SecureStore pour persistence. Reference pour le double-flag anti-claim (Phase 26).

### Architecture
- `.planning/codebase/ARCHITECTURE.md` — Architecture globale, pattern VaultManager, flow read/write.
- `.planning/codebase/CONVENTIONS.md` — Conventions de nommage, design tokens, patterns de code.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorldCell` interface (world-grid.ts): Pattern pour definir des cellules positionnees — inspire VillageCell
- `gray-matter` library: Deja utilisee partout pour le frontmatter YAML — reutiliser pour jardin-familial.md
- `VaultManager` (lib/vault.ts): readFile/writeFile avec NSFileCoordinator iCloud — le village l'utilisera via useGarden.ts (Phase 26)
- Pattern parse*/serialize* dans parser.ts: ~25 paires existantes, conventions bien etablies

### Established Patterns
- Frontmatter YAML + sections Markdown: Tout le vault utilise ce format (gami-{id}.md, famille.md, etc.)
- Module isole avec barrel: lib/mascot/, lib/gamification/, lib/museum/ — le village suit ce pattern
- Constantes UPPER_SNAKE_CASE: WORLD_GRID, CROP_CATALOG, BUILDING_CATALOG — les templates d'objectif suivront

### Integration Points
- `04 - Gamification/` dans le vault Obsidian: Dossier existant contenant gami-{id}.md
- `hooks/useVault.ts`: Le hook principal devra exposer le fichier village via VaultManager (Phase 26, ~20 lignes max)
- `contexts/VaultContext.tsx`: Le VaultProvider devra inclure les donnees village (Phase 26)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following existing codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 25-fondation-donn-es-village*
*Context gathered: 2026-04-10*
