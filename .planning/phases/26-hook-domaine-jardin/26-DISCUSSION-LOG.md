# Phase 26: Hook domaine jardin - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 26-hook-domaine-jardin
**Areas discussed:** Cablage useVault.ts, Generation objectif hebdo, Anti-double-claim, API hook useGarden

---

## Cablage useVault.ts

### Acces aux donnees vault

| Option | Description | Selected |
|--------|-------------|----------|
| Pattern useFarm | useGarden() consomme useVault() directement. ~15 lignes dans useVault.ts. | ✓ |
| Context dedie GardenProvider | Nouveau provider dans la stack. Plus isole mais 9eme provider. | |

**User's choice:** Pattern useFarm
**Notes:** Coherent avec l'existant. Pas de nouveau provider.

### Format expose par useVault.ts

| Option | Description | Selected |
|--------|-------------|----------|
| gardenRaw: string + refresh | useVault.ts lit le fichier brut, useGarden.ts parse. ~12 lignes. | ✓ |
| gardenData: VillageData parse | useVault.ts parse directement. Plus pratique mais plus de lignes. | |

**User's choice:** gardenRaw: string + refresh
**Notes:** Parsing dans useGarden.ts pour minimiser les lignes ajoutees au god hook.

---

## Generation objectif hebdomadaire

### Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Premier acces de la semaine | Au mount de useGarden, si semaine depassee. Pattern daily adventures. | ✓ |
| Trigger explicite | Bouton 'Nouveau objectif'. Plus de controle mais etape manuelle. | |

**User's choice:** Premier acces de la semaine
**Notes:** Pas de cron, pas de background task. Identique aux daily adventures.

### Archivage semaine passee

| Option | Description | Selected |
|--------|-------------|----------|
| Purge + archive | Contributions comptabilisees dans VillageWeekRecord, section videe. | ✓ |
| Accumulation totale | Jamais supprimees, filtre par date. Fichier grossit. | |
| Tu decides | Claude choisit. | |

**User's choice:** Purge + archive
**Notes:** Garde le fichier compact.

---

## Anti-double-claim

### Flag anti-double-generation

| Option | Description | Selected |
|--------|-------------|----------|
| currentWeekStart comme lock | Si == lundi courant, skip. Formule deterministe. | ✓ |
| Champ generating_lock | Timestamp lock/unlock. Plus robuste mais complexe. | |

**User's choice:** currentWeekStart comme lock
**Notes:** Simple, deterministe, pas de champ supplementaire.

### Flag anti-double-claim recompense

| Option | Description | Selected |
|--------|-------------|----------|
| village_claimed_week dans gami-{id}.md | Nouveau champ frontmatter. Compatible parseFarmProfile. | ✓ |
| SecureStore per-profil | Device-local, pas synce iCloud. | |

**User's choice:** village_claimed_week dans gami-{id}.md
**Notes:** Sync iCloud pour visibilite cross-device.

---

## API du hook useGarden

### Surface API

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal MVP | gardenData, currentTarget, progress, isGoalReached, currentTemplate, addContribution, claimReward, weekHistory, isLoading | ✓ |
| Riche | Ajoute contributionsByMember, memberProgress, canClaim. Plus pratique Phase 27. | |

**User's choice:** Minimal MVP
**Notes:** Suffisant pour Phase 27-28. Helpers calcules cote ecran si besoin.

---

## Claude's Discretion

- Choix du template de la semaine
- Logique exacte d'archivage
- Gestion objectif atteint non-claime lors de l'archivage
- Ordre d'operations dans le useEffect de mount

## Deferred Ideas

None — discussion stayed within phase scope.
