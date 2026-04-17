# Phase 38: Fondation modifiers + économie Sporée - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning
**Source:** Consolidé depuis PROJECT.md (Sporée V4 spec), REQUIREMENTS.md v1.7, ROADMAP.md Phase 38, CLAUDE.md

<domain>
## Phase Boundary

**In scope — ce que cette phase livre :**
- Shape `FarmCrop.modifiers` (JSON optionnel, extensible) + round-trip CSV markdown backward-compatible
- Bump `CACHE_VERSION` dans `lib/vault-cache.ts:41`
- Économie Sporée complète côté data/engine : 4 sources de drop (récolte, shop, expedition, cadeau onboarding)
- Inventaire Sporée per-profil capé à 10 + toast "Inventaire Sporée plein" sur overflow
- Tests Jest fondations (round-trip CSV, drop rates déterministes seed-based, cap 10, backward-compat legacy)

**Out of scope (phases suivantes) :**
- Moteur prorata / pondération famille / filtre 7j / snapshot 23h30 → Phase 39
- Slot "Sceller" seed picker, badge plant, validation récolte multiplier, état "prêt à valider" → Phase 40
- Tooltip onboarding one-shot + codex `wager.marathonWins` + privacy check final → Phase 41
- Pollen de Chimère (`graftedWith`) → v1.8 (mais shape `modifiers` doit l'anticiper, extensible)

**Zéro UI nouvelle** — pure fondation data/engine consommée par 39-40.

</domain>

<decisions>
## Implementation Decisions

### Shape `FarmCrop.modifiers` (MOD-01)
- **Champ** : `modifiers?: FarmCropModifiers` (optionnel, absence = plant legacy intact)
- **Type extensible** : `{ wager?: WagerModifier; graftedWith?: string }` — anticiper Pollen v1.8 dès maintenant
- **WagerModifier shape** :
  ```ts
  {
    sporeeId: string;            // id Sporée consommée (trace)
    duration: 'chill' | 'engage' | 'sprint';  // dérivée de la taille plant
    multiplier: 1.3 | 1.7 | 2.5; // locked à l'application
    appliedAt: string;           // ISO date plantation
    sealerProfileId: string;     // qui a scellé (pour prorata phase 39)
    cumulTarget?: number;        // target calculé phase 39 (nullable phase 38)
    cumulCurrent?: number;       // progression (nullable phase 38)
  }
  ```
- **Sérialisation CSV** : `modifiers` JSON stringifié puis base64-encoded (ou escape safe) dans un champ CSV séparé — zéro collision avec `:` séparateur existant (`plotIndex:cropId:currentStage:tasksCompleted:plantedAt:goldenFlag`)
- **Décision séparateur** : **à trancher par le planner/researcher** entre (a) 7e champ base64 append, (b) pipe-séparateur `|` pour modifiers, (c) ligne séparée indexée par plotIndex. Contrainte : le vault Obsidian reste **lisible/éditable manuellement** par un humain
- **Backward-compat** : absence de champ modifiers = `undefined`, jamais `null` ni `{}` (évite bruit JSON dans vault)
- **Round-trip** : `serializeFarmCrops` → string → `parseFarmCrops` doit produire objet identique (deep equal) pour plants avec ET sans modifiers

### CACHE_VERSION (MOD-02)
- Bump `lib/vault-cache.ts:41` (valeur actuelle → valeur+1, incrémental)
- Pas d'invalidation silencieuse — documenter le bump dans un commentaire inline

### Inventaire Sporée (SPOR-09)
- **Storage** : per-profil (alignement pattern gamification per-profil existant — voir useVault.ts hooks Profiles/SecretMissions)
- **Cap strict** : 10 — tout drop/achat/cadeau au-delà déclenche `Alert`/toast "Inventaire Sporée plein" (français)
- **Zéro perte silencieuse** : la source du drop ne "consomme" pas sa chance (drop refusé = tentative future possible) OU la récompense est convertie en feuilles fallback → **décision à trancher par le planner** (préférence : drop refusé, pas de conversion)
- **Unit** : inventaire stocké comme `sporeeCount: number` dans le profil, pas comme tableau d'objets (Sporées fongibles, toutes identiques à ce stade)

### Économie Sporée — 4 sources (SPOR-08)

**Source 1 — Drop à la récolte :**
- Tier 1-3 (cultures de base cabbage/tomato/cucumber/corn/strawberry/pumpkin/sunflower) : **3%**
- Tier rare (orchidee/rose_doree/truffe/fruit_dragon) : **8%**
- Expedition crops (récoltes issues de missions expedition) : **15%**
- Roll au moment du `harvestFarmCrop` (ou équivalent) via seeded RNG déterministe (pattern existant farm-engine pour tests)

**Source 2 — Shop (achat) :**
- **Prix** : 400 feuilles par Sporée
- **Cap quotidien** : 2/jour (reset minuit local device)
- **Condition de déblocage** : Arbre mascotte au stade 3 minimum (voir `lib/mascot/engine.ts` — TreeStage `'arbre'` ou plus — `arbre`, `majestueux`, `legendaire`)
- **Tracking** : compteur `sporeeShopBoughtToday: number` + `sporeeShopLastResetDate: string` (ISO) dans le profil

**Source 3 — Loot expedition :**
- **5%** de drop sur missions expedition de difficulté Pousse+ (Pousse, Arbuste, Arbre, Majestueux — voir `lib/mascot/expedition-engine.ts` pour la liste exacte)
- Roll à la résolution de l'expedition, s'ajoute au loot existant

**Source 4 — Cadeau onboarding :**
- **1 Sporée gratuite** à l'atteinte du stade 3 Arbre (pas au premier lancement — à l'évolution stade 2 → stade 3)
- **Déclencheur** : détection transition stade dans la logique d'évolution arbre mascotte
- **Flag anti-rejeu** : `sporeeOnboardingGiftClaimed: boolean` device-global (SecureStore) OU per-profil — **décision à trancher par le planner** (préférence : per-profil, aligné inventaire)
- **Tooltip explicatif** : le tooltip lui-même est Phase 41 (SPOR-10), mais le cadeau est Phase 38

### Seed déterministe pour tests (SPOR-13)
- Tous les rolls (drops récolte, shop cap, expedition, cadeau) doivent être testables avec seed reproductible
- Pattern existant farm-engine (voir drops rares `DROP_RULES`) — réutiliser mulberry32 ou équivalent déjà en place si présent, sinon introduire

### Tests Jest fondations (SPOR-13 part 1)
- `lib/__tests__/` nouveau fichier (ou extension existant farm-engine.test.ts / parser-farm.test.ts) couvrant :
  1. Round-trip CSV `modifiers` — plant avec/sans `wager`, deep equal après parse(serialize(x))
  2. Backward-compat — plants legacy (pré-v1.7) sans champ modifiers parsent sans erreur, retournent `modifiers: undefined`
  3. Drop rates déterministes — seed fixe → résultat reproductible pour les 4 sources
  4. Cap inventaire 10 — tentatives d'ajout au-dessus de 10 refusées + flag/callback overflow
  5. Shop cap 2/jour — 3e achat dans la même journée refusé, reset à minuit testable

### Claude's Discretion
- Emplacement exact du type `FarmCropModifiers` (types.ts vs farm-engine.ts vs nouveau fichier `lib/mascot/modifiers.ts`)
- Stratégie précise de sérialisation CSV (base64 vs pipe-escape vs ligne séparée) — contrainte : lisibilité vault + backward-compat
- Nom exact du champ inventaire (`sporeeCount` vs `sporeeInventory` vs `wagerInventory` — existe-t-il déjà `wagerInventory` dans les profils ? À vérifier)
- Stratégie overflow drop (refusé pur vs conversion feuilles fallback — préférence : refusé pur)
- Organisation des fichiers de test (nouveau fichier dédié `sporee-economy.test.ts` vs extension existants)
- Pattern RNG (mulberry32 existant vs nouveau utility)
- Intégration du drop dans `harvestFarmCrop` (wrapper vs modification signature vs post-hook)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Specs & décisions v1.7
- `.planning/PROJECT.md` — Sporée V4 spec complète (lignes 79-97 Current Milestone v1.7)
- `.planning/REQUIREMENTS.md` — 16 REQ-IDs v1.7, mapping phases, out-of-scope, scope constraint
- `.planning/ROADMAP.md` — Phase 38 goal + success criteria (lignes 246-256), phases 39-41 pour contexte dépendances aval

### Code existant à lire avant de toucher
- `lib/mascot/farm-engine.ts` — **source de vérité FarmCrop** : `serializeFarmCrops` ligne 227, `parseFarmCrops` ligne 235, shape implicite (plotIndex/cropId/currentStage/tasksCompleted/plantedAt/isGolden), `DROP_RULES` drops rares (pattern RNG seeded)
- `lib/mascot/expedition-engine.ts` — loot model + difficulté missions (Pousse+ pour drop Sporée 5%)
- `lib/mascot/engine.ts` — TreeStage evolution (détection transition stade 3 pour cadeau onboarding) + stade conditions shop
- `lib/mascot/types.ts` — types mascot/farm partagés
- `lib/vault-cache.ts:41` — `CACHE_VERSION` à bumper
- `contexts/VaultContext.tsx` + `hooks/useVault.ts` — accès état profils pour inventaire Sporée per-profil
- `lib/__tests__/farm-engine.test.ts` — pattern existant tests ferme (seed-based rolls)

### Conventions projet (CLAUDE.md)
- `CLAUDE.md` — conventions framework (tests `npx jest --no-coverage`, type check `npx tsc --noEmit`, zéro nouvelle dépendance npm, français partout, cache section)

### Hiérarchie VaultCache (CLAUDE.md section Cache)
- Ferme/mascotte sont **exclusions volontaires** du cache (toujours frais depuis vault). `FarmCrop` change de shape mais n'est **pas** dans VaultCacheState — CACHE_VERSION bump reste obligatoire par sécurité (évite plant corrompu dans domaines cachés qui référenceraient indirectement la ferme via Profile.farm si présent)

</canonical_refs>

<specifics>
## Specific Ideas

- **Nommage inventaire** : chercher `sporee`, `wager`, `Sporée` dans les types Profile existants — peut-être déjà un champ stub à étendre, sinon ajouter `sporeeCount: number` au Profile
- **Migration data** : aucune migration active nécessaire — tous les plants existants restent valides (champ `modifiers` absent = `undefined`). Le bump CACHE_VERSION force un re-parse from vault au premier boot, ce qui suffit
- **Drop refusé = tentative future** : ne pas "brûler" le roll — si overflow, le comportement préféré est que la prochaine récolte re-roll normalement (pas de pity timer, pas de conversion). Simple et transparent
- **Seed per-context** : pour les drops, utiliser un seed dérivé du `plantedAt + plotIndex + cropId` ou équivalent (déterministe mais varié) — pattern à valider vs existing drops rares dans farm-engine.ts
- **Lisibilité vault** : si base64 complique l'édition manuelle, préférer `pipe-escape` ou une ligne markdown séparée. Exemple `| wager | plotIndex=2 duration=engage multiplier=1.7 sealer=parent1 |` plus lisible qu'une blob base64

</specifics>

<deferred>
## Deferred Ideas

- **SPOR-03 à SPOR-06 — moteur prorata + pondération famille + filtre 7j + filtre Tasks** : Phase 39
- **MOD-03, SPOR-01, SPOR-02, SPOR-07, SPOR-11 — UI seed picker / badge / validation / prêt à valider** : Phase 40
- **SPOR-10, SPOR-12 — tooltip one-shot + compteur codex + non-régression finale** : Phase 41
- **Pollen de Chimère (`graftedWith`)** : v1.8 — shape `modifiers` doit rester extensible mais aucune implémentation Pollen phase 38
- **Pari coopératif famille (SPOR-F01), streaks (SPOR-F02), mode vacances (SPOR-F03)** : v1.8+

</deferred>

---

*Phase: 38-fondation-modifiers-conomie-spor-e*
*Context gathered: 2026-04-18 — consolidé depuis canonical docs v1.7*
