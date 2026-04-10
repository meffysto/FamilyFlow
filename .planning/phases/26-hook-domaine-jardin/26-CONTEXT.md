# Phase 26: Hook domaine jardin - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Encapsuler toute la logique village dans `hooks/useGarden.ts` isole — generation d'objectif hebdomadaire, protection anti-double-claim (flag partage + flag per-profil), cablage VaultContext. Max +20 lignes dans useVault.ts. Pas d'UI, pas d'ecran.

</domain>

<decisions>
## Implementation Decisions

### Cablage useVault.ts
- **D-01:** Pattern useFarm — useGarden() consomme useVault() directement via import du context. Pas de nouveau provider dans la stack.
- **D-02:** useVault.ts expose `gardenRaw: string` (contenu brut du fichier) + `setGardenRaw`. useGarden.ts parse localement avec `parseGardenFile()`. Le refresh existant recharge le fichier. ~12-15 lignes ajoutees dans useVault.ts.
- **D-03:** useVault.ts lit `jardin-familial.md` via `vault.readFile(VILLAGE_FILE).catch(() => '')` dans la sequence de chargement existante.

### Generation objectif hebdomadaire
- **D-04:** Declenchement au premier acces de la semaine — au mount de useGarden, si `currentWeekStart < lundi courant` alors archiver semaine passee + generer nouvel objectif. Pattern identique aux daily adventures de la ferme. Pas de cron, pas de background task.
- **D-05:** Archivage purge + archive — les contributions courantes sont comptabilisees dans un `VillageWeekRecord` (total, par membre) ajoute a `pastWeeks`, puis la section Contributions est videe pour la nouvelle semaine. Garde le fichier compact.
- **D-06:** La formule `computeWeekTarget(nb_profils)` est deterministe — meme resultat quel que soit le profil qui declenche la generation.

### Anti-double-claim
- **D-07:** Flag anti-double-generation : `currentWeekStart` dans le frontmatter de `jardin-familial.md` sert de lock. Si `currentWeekStart == lundi courant` alors objectif deja genere, skip. La premiere ecriture gagne (iCloud last-write-wins). Resultat identique car formule deterministe. Pas de champ supplementaire.
- **D-08:** Flag anti-double-claim recompense : nouveau champ `village_claimed_week: '2026-04-07'` dans le frontmatter de `gami-{id}.md`. Si `village_claimed_week == currentWeekStart` alors deja claime. Compatible avec parseFarmProfile/serializeFarmProfile existants.

### API du hook useGarden
- **D-09:** Surface API minimale MVP :
  - `gardenData: VillageData` — donnees parsees
  - `currentTarget: number` — cible semaine calculee
  - `progress: number` — nombre de contributions (contributions.length)
  - `isGoalReached: boolean`
  - `currentTemplate: ObjectiveTemplate` — template thematise actif
  - `addContribution(type: ContributionType, profileId: string): Promise<void>`
  - `claimReward(profileId: string): Promise<boolean>`
  - `weekHistory: VillageWeekRecord[]`
  - `isLoading: boolean`

### Decisions heritees (verrouillees)
- **D-10:** Module `lib/village/` isole avec types, parser, grille, templates (Phase 25 livre).
- **D-11:** Format append-only pour contributions (Phase 25).
- **D-12:** Fichier `04 - Gamification/jardin-familial.md` (Phase 25).
- **D-13:** Cible = `BASE_TARGET * nb_profils_actifs` (Phase 25).
- **D-14:** Templates thematises avec rotation aleatoire (Phase 25).

### Claude's Discretion
- Choix du template de la semaine (random seed vs index rotatif)
- Logique exacte d'archivage (quels champs du VillageWeekRecord remplir, contributions par membre optionnel)
- Gestion du cas "objectif atteint mais pas encore claime" lors de l'archivage semaine
- Ordre d'operations dans le useEffect de mount (lire, verifier semaine, generer si besoin)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Module village (Phase 25 — livre)
- `lib/village/types.ts` — VillageData, VillageContribution, VillageWeekRecord, ContributionType, ObjectiveTemplate. Source de verite pour les types.
- `lib/village/parser.ts` — parseGardenFile, serializeGardenFile, appendContribution, appendContributionToVault, VILLAGE_FILE. Fonctions de persistence.
- `lib/village/templates.ts` — OBJECTIVE_TEMPLATES (7 templates), BASE_TARGET, computeWeekTarget(). Constantes et formule.
- `lib/village/index.ts` — barrel re-export.

### Patterns a reproduire
- `hooks/useFarm.ts` — Pattern hook domaine consommant useVault(). Reference architecturale pour useGarden.ts (import useVault, useCallback, useMemo).
- `hooks/useVault.ts` — God hook. Lire les ~12 premieres lignes de la section state (useState declarations) et la section loadProfile() pour comprendre ou inserer gardenRaw.
- `lib/parser.ts` lignes 571-699 — parseFarmProfile / serializeFarmProfile pour comprendre le format gami-{id}.md ou ajouter village_claimed_week.
- `lib/mascot/companion-storage.ts` — Pattern SecureStore fire-and-forget (reference pour le style non-bloquant).

### Architecture
- `.planning/codebase/ARCHITECTURE.md` — Data flow, VaultManager, provider hierarchy.
- `contexts/VaultContext.tsx` — VaultProvider wrapper. Le hook useGarden importe useVault() d'ici.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `parseGardenFile` / `serializeGardenFile` (lib/village/parser.ts) — parsing bidirectionnel pret a l'emploi
- `appendContributionToVault(vault, contribution)` (lib/village/parser.ts) — ecriture append-only via VaultManager
- `computeWeekTarget(nbProfiles)` (lib/village/templates.ts) — formule cible deterministe
- `OBJECTIVE_TEMPLATES` (lib/village/templates.ts) — 7 templates thematises
- `parseFarmProfile` / `serializeFarmProfile` (lib/parser.ts) — pattern pour lire/ecrire gami-{id}.md (ajouter village_claimed_week)

### Established Patterns
- Hook domaine : useFarm.ts consomme useVault(), expose des actions via useCallback + useMemo. useGarden suit le meme pattern.
- God hook boundary : useVault.ts expose un raw string + setter, le hook domaine parse localement. Pattern gardenRaw identique a d'autres champs bruts.
- Anti-abus : caps.ts utilise SecureStore per-profil, mais ici on utilise gami-{id}.md (sync iCloud) car le claim doit etre visible cross-device.

### Integration Points
- `hooks/useVault.ts` : ajouter useState gardenRaw, lire dans loadProfile(), exposer dans VaultState (~12-15 lignes)
- `lib/parser.ts` : parseFarmProfile doit accepter/ignorer le nouveau champ village_claimed_week (backward compatible si gray-matter parse le YAML generiquement)
- `contexts/VaultContext.tsx` : aucune modification (VaultState auto-propagee)

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

*Phase: 26-hook-domaine-jardin*
*Context gathered: 2026-04-10*
