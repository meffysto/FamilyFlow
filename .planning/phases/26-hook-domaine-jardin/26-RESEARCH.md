# Phase 26: Hook domaine jardin - Research

**Researched:** 2026-04-10
**Domain:** React Hook architecture — domain hook pattern, weekly objective generation, anti-double-claim flags, VaultContext wiring
**Confidence:** HIGH

## Summary

Phase 26 encapsulates all village logic in `hooks/useGarden.ts` following the exact same domain hook pattern as `hooks/useFarm.ts`. The hook consumes `useVault()` directly (no new provider), reads `gardenRaw: string` exposed by `useVault.ts`, and parses locally with `parseGardenFile()` from `lib/village/`. This phase is pure logic — no UI, no screens.

The weekly objective generation triggers at mount via a `useEffect`: if `currentWeekStart < current Monday`, archive past week data into `pastWeeks` and generate a new objective. Anti-double-generation relies on `currentWeekStart` in `jardin-familial.md` frontmatter acting as an idempotency lock. Anti-double-claim uses a new `village_claimed_week` field in `gami-{id}.md`, compatible with the existing `parseFarmProfile`/`serializeFarmProfile` pattern.

**Critical dependency:** Phase 26 depends on Phase 25 having delivered `lib/village/` (types, parser, templates, grid). If Phase 25 is not yet executed, `lib/village/` does not exist and Phase 26 cannot compile.

**Primary recommendation:** Follow useFarm.ts structurally — vaultRef pattern via useVault(), useCallback for all async actions, useMemo for derived state, no new providers.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Cablage useVault.ts**
- D-01: Pattern useFarm — useGarden() consomme useVault() directement via import du context. Pas de nouveau provider dans la stack.
- D-02: useVault.ts expose `gardenRaw: string` (contenu brut du fichier) + `setGardenRaw`. useGarden.ts parse localement avec `parseGardenFile()`. Le refresh existant recharge le fichier. ~12-15 lignes ajoutees dans useVault.ts.
- D-03: useVault.ts lit `jardin-familial.md` via `vault.readFile(VILLAGE_FILE).catch(() => '')` dans la sequence de chargement existante.

**Generation objectif hebdomadaire**
- D-04: Declenchement au premier acces de la semaine — au mount de useGarden, si `currentWeekStart < lundi courant` alors archiver semaine passee + generer nouvel objectif. Pas de cron, pas de background task.
- D-05: Archivage purge + archive — contributions courantes comptabilisees dans un `VillageWeekRecord` ajoute a `pastWeeks`, puis la section Contributions est videe pour la nouvelle semaine.
- D-06: La formule `computeWeekTarget(nb_profils)` est deterministe — meme resultat quel que soit le profil qui declenche la generation.

**Anti-double-claim**
- D-07: Flag anti-double-generation : `currentWeekStart` dans le frontmatter de `jardin-familial.md` sert de lock. Si `currentWeekStart == lundi courant` alors objectif deja genere, skip. La premiere ecriture gagne (iCloud last-write-wins). Pas de champ supplementaire.
- D-08: Flag anti-double-claim recompense : nouveau champ `village_claimed_week: '2026-04-07'` dans le frontmatter de `gami-{id}.md`. Si `village_claimed_week == currentWeekStart` alors deja claime.

**API du hook useGarden (D-09)**
```typescript
gardenData: VillageData
currentTarget: number
progress: number
isGoalReached: boolean
currentTemplate: ObjectiveTemplate
addContribution(type: ContributionType, profileId: string): Promise<void>
claimReward(profileId: string): Promise<boolean>
weekHistory: VillageWeekRecord[]
isLoading: boolean
```

**Decisions heritees verrouillees**
- D-10: Module `lib/village/` isole avec types, parser, grille, templates (Phase 25 livre).
- D-11: Format append-only pour contributions (Phase 25).
- D-12: Fichier `04 - Gamification/jardin-familial.md` (Phase 25).
- D-13: Cible = `BASE_TARGET * nb_profils_actifs` (Phase 25).
- D-14: Templates thematises avec rotation aleatoire (Phase 25).

### Claude's Discretion
- Choix du template de la semaine (random seed vs index rotatif)
- Logique exacte d'archivage (quels champs du VillageWeekRecord remplir, contributions par membre optionnel)
- Gestion du cas "objectif atteint mais pas encore claime" lors de l'archivage semaine
- Ordre d'operations dans le useEffect de mount (lire, verifier semaine, generer si besoin)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-03 | Un hook domaine isolé `useGarden.ts` gère toute la logique village (pas d'ajout dans useVault.ts) | Pattern useFarm.ts confirmé comme référence architecturale ; useVault.ts exposera gardenRaw uniquement (~12-15 lignes) ; useGarden.ts fait tout le parsing et la logique localement |
| OBJ-01 | Un objectif hebdomadaire est auto-généré chaque lundi, avec cible adaptée au nombre de profils actifs et à l'historique | computeWeekTarget(nbProfiles) de lib/village/templates.ts est deterministe ; déclenchement au mount de useGarden via useEffect comparant currentWeekStart au lundi courant |
| OBJ-05 | Un flag partagé + flag per-profil empêchent le double-claim de récompense | Flag partagé = currentWeekStart dans jardin-familial.md frontmatter (D-07) ; flag per-profil = village_claimed_week dans gami-{id}.md (D-08) compatible parseFarmProfile existant |
</phase_requirements>

---

## Standard Stack

### Core (no new dependencies — ARCH-05: zero nouvelles dépendances npm)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React hooks (useCallback, useMemo, useEffect, useState) | SDK 54 | State, derived values, side effects | Codebase pattern obligatoire |
| useVault() from contexts/VaultContext | existing | Accès au vault, gardenRaw, profiles | Pattern useFarm.ts — pas de nouveau provider |
| lib/village/ (Phase 25) | local | Types, parser, templates | Module isole construit en Phase 25 |
| lib/parser.ts parseFarmProfile/serializeFarmProfile | existing | Lire/ecrire gami-{id}.md avec village_claimed_week | Pattern etabli, backward-compatible |
| date-fns (startOfWeek, format) | existing | Calcul lundi courant, formatage ISO | Deja utilisee dans useVault.ts |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| VaultManager (lib/vault.ts) | existing | readFile/writeFile iCloud | Acces via `useVault().vault` |
| gray-matter | existing | Frontmatter YAML parsing | Utilise par parseGardenFile de Phase 25 |

**Installation:** Aucune — zero nouvelles dependances (ARCH-05 global decision).

---

## Architecture Patterns

### Recommended File Structure

```
hooks/
└── useGarden.ts        # Hook domaine village (ce que Phase 26 livre)

hooks/useVault.ts       # Modifie : +gardenRaw, +setGardenRaw, +readFile dans loadVaultData (~12-15 lignes)
lib/village/            # Fourni par Phase 25 (types, parser, templates, grid)
  ├── types.ts
  ├── parser.ts
  ├── templates.ts
  ├── grid.ts
  └── index.ts
```

### Pattern 1: Domain Hook via useVault() — reference useFarm.ts

**What:** Le hook domaine importe useVault() pour acceder au vault et aux profils. Il ne cree pas de provider. Il parse les donnees brutes localement.

**When to use:** Chaque fois qu'un nouveau domaine logique a besoin de persister dans le vault sans grossir useVault.ts de plus de quelques lignes.

**Example:**
```typescript
// hooks/useGarden.ts
import { useCallback, useMemo, useEffect, useState } from 'react';
import { useVault } from '../contexts/VaultContext';
import {
  parseGardenFile,
  serializeGardenFile,
  appendContributionToVault,
  VILLAGE_FILE,
} from '../lib/village';
import { computeWeekTarget, OBJECTIVE_TEMPLATES } from '../lib/village';
import { parseFarmProfile, serializeFarmProfile } from '../lib/parser';
import type { VillageData, VillageWeekRecord, ContributionType, ObjectiveTemplate } from '../lib/village';

export function useGarden() {
  const { vault, gardenRaw, setGardenRaw, profiles } = useVault();
  const [isLoading, setIsLoading] = useState(false);

  const gardenData = useMemo<VillageData>(() => {
    return parseGardenFile(gardenRaw);
  }, [gardenRaw]);

  // ... actions via useCallback
  // ... useEffect for weekly objective generation at mount
}
```

### Pattern 2: Wiring useVault.ts — ajout gardenRaw

**What:** Ajouter `gardenRaw: string` comme state dans useVaultInternal(), le lire dans `loadVaultData()` dans le bloc parallel loading, l'exposer dans VaultState et le return final.

**When to use:** Pattern etabli — identique pour chaque raw string expose (pas de parsing dans useVault.ts, le parsing reste dans le hook domaine).

**Example (4 endroits a modifier):**

1. Interface VaultState (ajouter 2 lignes) :
```typescript
// hooks/useVault.ts — interface VaultState
gardenRaw: string;
setGardenRaw: React.Dispatch<React.SetStateAction<string>>;
```

2. useState declaration dans useVaultInternal() (ajouter 1 ligne) :
```typescript
const [gardenRaw, setGardenRaw] = useState<string>('');
```

3. Dans loadVaultData, bloc parallel loading (ajouter 1 entree dans Promise.allSettled) :
```typescript
// [N] Village garden — fichier partage
vault.readFile(VILLAGE_FILE).catch(() => ''),
```
Puis dans le traitement des resultats :
```typescript
const gardenContent = results[N].status === 'fulfilled' ? results[N].value as string : '';
setGardenRaw(gardenContent);
```

4. Dans le return de useMemo (ajouter 2 lignes + deps array) :
```typescript
gardenRaw,
setGardenRaw,
```

**Total useVault.ts : ~12-15 lignes. Boundary respectee.**

### Pattern 3: Weekly Objective Generation — useEffect at mount

**What:** Au mount de useGarden, verifier si `currentWeekStart` dans `gardenData` est inferieur au lundi courant. Si oui, archiver la semaine passee et generer un nouvel objectif.

**When to use:** Pattern identique aux daily adventures de la ferme — pas de cron, pas de background task.

**Logic sketch:**
```typescript
useEffect(() => {
  if (!vault || !gardenRaw) return;
  
  const currentMonday = getMondayISO(new Date()); // ex: '2026-04-06'
  
  if (gardenData.currentWeekStart === currentMonday) return; // deja genere
  
  (async () => {
    setIsLoading(true);
    try {
      // 1. Archiver la semaine passee dans pastWeeks
      const weekRecord: VillageWeekRecord = {
        weekStart: gardenData.currentWeekStart,
        target: gardenData.currentTarget,
        total: gardenData.contributions.length,
        // contributions par membre optionnel (discretion Claude)
      };
      
      // 2. Choisir un template pour la nouvelle semaine
      const template = pickTemplate(gardenData.pastWeeks.length); // index rotatif ou random
      
      // 3. Calculer la cible (deterministe)
      const activeProfiles = profiles.filter(p => p.role !== 'inactif');
      const newTarget = computeWeekTarget(activeProfiles.length);
      
      // 4. Construire le nouveau VillageData et serialiser
      const newData: VillageData = {
        ...gardenData,
        currentWeekStart: currentMonday,
        currentTarget: newTarget,
        currentTemplateId: template.id,
        contributions: [], // vider les contributions courantes
        pastWeeks: [...gardenData.pastWeeks, weekRecord],
      };
      
      const newContent = serializeGardenFile(newData);
      await vault.writeFile(VILLAGE_FILE, newContent);
      setGardenRaw(newContent);
    } finally {
      setIsLoading(false);
    }
  })();
}, [vault, gardenRaw]); // gardenRaw en dep pour re-evaluer apres refresh iCloud
```

**Note sur l'idempotence (D-07):** iCloud last-write-wins. Si deux profils triggerent la generation simultanement, les deux ecrivent `currentWeekStart = lundi courant` avec la meme cible (formule deterministe). L'un ecrase l'autre. Les deux resultats sont identiques. Pas de corruption possible.

### Pattern 4: Anti-double-claim — village_claimed_week dans gami-{id}.md

**What:** Avant de distribuer la recompense, verifier `village_claimed_week` dans le fichier `gami-{profileId}.md`. Si egal a `currentWeekStart`, rejeter. Sinon, crediter XP et ecrire le flag.

**When to use:** Chaque appel a `claimReward(profileId)`.

**Example:**
```typescript
const claimReward = useCallback(async (profileId: string): Promise<boolean> => {
  if (!vault) return false;
  
  const file = `gami-${profileId}.md`;
  const content = await vault.readFile(file).catch(() => '');
  const farmData = parseFarmProfile(content);
  
  // Guard: deja claime cette semaine ?
  if (farmData.village_claimed_week === gardenData.currentWeekStart) return false;
  
  // Guard: objectif atteint ?
  if (!isGoalReached) return false;
  
  // Crediter XP + ecrire flag
  const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
  const updated = { ...farmData, village_claimed_week: gardenData.currentWeekStart };
  await vault.writeFile(file, serializeFarmProfile(profileName, updated));
  
  // Crediter les coins/XP (pattern addCoins de useFarm)
  // ...
  
  return true;
}, [vault, gardenData, profiles, isGoalReached]);
```

### Pattern 5: Template selection (Claude's Discretion — index rotatif recommande)

**What:** Choisir un template parmi OBJECTIVE_TEMPLATES de facon non-repetitive. Index rotatif (`pastWeeks.length % OBJECTIVE_TEMPLATES.length`) est deterministique et ne necessite pas de random seed persistee.

**Recommendation:** Index rotatif — plus simple, pas d'etat supplementaire, pas de risque de repetition immediate.

```typescript
function pickTemplate(weekIndex: number): ObjectiveTemplate {
  return OBJECTIVE_TEMPLATES[weekIndex % OBJECTIVE_TEMPLATES.length];
}
```

### Anti-Patterns to Avoid

- **Mettre la logique de generation dans useVault.ts** : viole le boundary god hook. useVault.ts ne doit ajouter que le raw string + setter.
- **Creer un nouveau Context pour useGarden** : inutile, pattern useFarm.ts ne l'utilise pas.
- **Utiliser SecureStore pour le claim flag** : le claim doit etre visible cross-device (iCloud sync via gami-{id}.md). SecureStore est device-local.
- **Modifier VaultContext.tsx** : aucune modification requise — VaultState est auto-propagee via useVaultInternal().

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parsing jardin-familial.md | Parser custom | parseGardenFile / serializeGardenFile (lib/village/parser.ts Phase 25) | Deja livre, bidirectionnel, gray-matter |
| Calcul cible semaine | Formule inline | computeWeekTarget() (lib/village/templates.ts) | Deterministe, teste en Phase 25 |
| Ecriture append-only contribution | Ecriture manuelle | appendContributionToVault(vault, contribution) (lib/village/parser.ts) | Evite les corruptions iCloud |
| Lecture/ecriture gami-{id}.md | Lecture directe | parseFarmProfile / serializeFarmProfile (lib/parser.ts) | Backward-compatible, gere tous les champs existants |
| Calcul lundi courant | Date arithmetic inline | startOfWeek(new Date(), { weekStartsOn: 1 }) de date-fns | Deja utilise dans useVault.ts |

**Key insight:** Toute la logique de persistence est deja fournie par Phase 25 et les patterns existants. useGarden.ts est orchestration, pas implementation.

---

## Common Pitfalls

### Pitfall 1: useVault.ts depasse 20 lignes supplementaires
**What goes wrong:** Ajouter de la logique de parsing ou de generation dans useVault.ts.
**Why it happens:** La tentation de "mettre tout dans loadVaultData".
**How to avoid:** useVault.ts ajoute uniquement : 1 useState, 1 ligne readFile dans le bloc parallel loading, 2 lignes dans le return object, 2 lignes dans le return deps array. Total : ~10-14 lignes. Toute logique domaine reste dans useGarden.ts.
**Warning signs:** Si on importe des symboles de lib/village dans useVault.ts, c'est suspect.

### Pitfall 2: Infinite loop dans le useEffect de generation
**What goes wrong:** `gardenRaw` change apres l'ecriture → re-declenche le useEffect → re-ecriture → boucle infinie.
**Why it happens:** Le useEffect a gardenRaw en dep et l'action ecrit le fichier qui met a jour gardenRaw.
**How to avoid:** La condition de guard `if (gardenData.currentWeekStart === currentMonday) return;` brise la boucle — la deuxieme execution ne fait rien car le fichier est deja a jour.
**Warning signs:** Console logs repetitifs, app qui freeze au mount.

### Pitfall 3: Race condition double-generation avec iCloud
**What goes wrong:** Deux profils ouvrent le village la meme semaine — les deux lisent `currentWeekStart < lundi courant` avant que l'un d'eux ecrive.
**Why it happens:** iCloud sync peut avoir un delai. Les deux arrivent avec l'ancienne version.
**How to avoid:** La formule deterministe (D-06) garantit que les deux ecritures produisent le meme resultat. L'un ecrase l'autre, mais le resultat final est identique. Pas de corruption. Documenter ceci dans le code.

### Pitfall 4: village_claimed_week incompatible avec parseFarmProfile
**What goes wrong:** parseFarmProfile ignore les champs inconnus, donc `village_claimed_week` n'est pas deserialisé. Ensuite, serializeFarmProfile ne le reecrit pas.
**Why it happens:** parseFarmProfile est une fonction custom ligne-par-ligne (pas gray-matter) qui parse uniquement les champs connus. serializeFarmProfile ne serialize que `data.village_claimed_week` si on l'ajoute explicitement.
**How to avoid:** Ajouter `village_claimed_week?: string` au type `FarmProfileData` (lib/types.ts ou lib/mascot/types.ts), ajouter le cas dans parseFarmProfile, et la ligne de serialisation dans serializeFarmProfile. Ces 3 points doivent etre touches.
**Warning signs:** `tsc --noEmit` passe mais le flag n'est jamais persisté — tester avec `console.warn(__DEV__)`.

### Pitfall 5: gardenRaw vide au premier mount (fichier absent)
**What goes wrong:** `vault.readFile(VILLAGE_FILE)` echoue si Phase 25 n'a pas cree `jardin-familial.md`. gardenRaw = ''. parseGardenFile('') retourne un VillageData vide. La generation tente de generer et d'ecrire un objectif dans un fichier qui n'existe pas encore.
**Why it happens:** Phase 25 cree le fichier, mais peut-etre pas encore au premier boot.
**How to avoid:** `appendContributionToVault` et `vault.writeFile` creent le fichier s'il n'existe pas (VaultManager gere cela). La generation peut creer le fichier ex-nihilo. S'assurer que `parseGardenFile('')` retourne des defaults valides.

### Pitfall 6: `profiles` count incorrect pour computeWeekTarget
**What goes wrong:** `profiles` inclut les profils en grossesse (statut='grossesse') ou profils inactifs.
**Why it happens:** useVault() expose tous les profils sans filtre.
**How to avoid:** Filtrer sur `profiles.filter(p => p.role !== 'grossesse')` ou utiliser une definition claire de "profil actif". La formule doit etre deterministe — documenter le filtre applique.

---

## Code Examples

### Squelette complet useGarden.ts

```typescript
// hooks/useGarden.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useVault } from '../contexts/VaultContext';
import {
  parseGardenFile,
  serializeGardenFile,
  appendContributionToVault,
  VILLAGE_FILE,
} from '../lib/village';
import {
  computeWeekTarget,
  OBJECTIVE_TEMPLATES,
} from '../lib/village';
import { parseFarmProfile, serializeFarmProfile } from '../lib/parser';
import type {
  VillageData,
  VillageWeekRecord,
  ContributionType,
  ObjectiveTemplate,
} from '../lib/village';
import { startOfWeek, format } from 'date-fns';

function getMondayISO(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

function pickTemplate(weekIndex: number): ObjectiveTemplate {
  return OBJECTIVE_TEMPLATES[weekIndex % OBJECTIVE_TEMPLATES.length];
}

export function useGarden() {
  const { vault, gardenRaw, setGardenRaw, profiles } = useVault();
  const [isLoading, setIsLoading] = useState(false);

  const gardenData = useMemo<VillageData>(
    () => parseGardenFile(gardenRaw),
    [gardenRaw]
  );

  const currentTarget = useMemo(
    () => computeWeekTarget(profiles.filter(p => p.role !== 'grossesse').length),
    [profiles]
  );

  const progress = useMemo(
    () => gardenData.contributions?.length ?? 0,
    [gardenData]
  );

  const isGoalReached = useMemo(
    () => progress >= currentTarget,
    [progress, currentTarget]
  );

  const currentTemplate = useMemo<ObjectiveTemplate>(
    () => pickTemplate(gardenData.pastWeeks?.length ?? 0),
    [gardenData]
  );

  const weekHistory = useMemo<VillageWeekRecord[]>(
    () => gardenData.pastWeeks ?? [],
    [gardenData]
  );

  // Generation objectif hebdomadaire au mount
  useEffect(() => {
    if (!vault || !gardenRaw && gardenRaw !== '') return; // attend que gardenRaw soit initialise
    const currentMonday = getMondayISO(new Date());
    if (gardenData.currentWeekStart === currentMonday) return; // deja genere

    (async () => {
      setIsLoading(true);
      try {
        const activeProfileCount = profiles.filter(p => p.role !== 'grossesse').length;
        const newTarget = computeWeekTarget(activeProfileCount);
        const template = pickTemplate(gardenData.pastWeeks?.length ?? 0);

        // Archiver la semaine passee si elle avait un objectif
        const updatedPastWeeks = [...(gardenData.pastWeeks ?? [])];
        if (gardenData.currentWeekStart) {
          const weekRecord: VillageWeekRecord = {
            weekStart: gardenData.currentWeekStart,
            target: gardenData.currentTarget ?? 0,
            total: gardenData.contributions?.length ?? 0,
          };
          updatedPastWeeks.push(weekRecord);
        }

        const newData: VillageData = {
          ...gardenData,
          currentWeekStart: currentMonday,
          currentTarget: newTarget,
          currentTemplateId: template.id,
          contributions: [],
          pastWeeks: updatedPastWeeks,
        };

        const newContent = serializeGardenFile(newData);
        await vault.writeFile(VILLAGE_FILE, newContent);
        setGardenRaw(newContent);
      } catch (e) {
        if (__DEV__) console.warn('useGarden — generation objectif:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [vault, gardenRaw, profiles]); // gardenRaw en dep pour re-evaluer apres refresh iCloud

  const addContribution = useCallback(
    async (type: ContributionType, profileId: string): Promise<void> => {
      if (!vault) return;
      const contribution = {
        timestamp: new Date().toISOString(),
        profileId,
        type,
        amount: 1,
      };
      const newContent = await appendContributionToVault(vault, contribution);
      setGardenRaw(newContent);
    },
    [vault, setGardenRaw]
  );

  const claimReward = useCallback(
    async (profileId: string): Promise<boolean> => {
      if (!vault || !isGoalReached) return false;
      const file = `gami-${profileId}.md`;
      const content = await vault.readFile(file).catch(() => '');
      const farmData = parseFarmProfile(content);

      if (farmData.village_claimed_week === gardenData.currentWeekStart) return false;

      const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
      const updated = { ...farmData, village_claimed_week: gardenData.currentWeekStart };
      await vault.writeFile(file, serializeFarmProfile(profileName, updated));
      return true;
    },
    [vault, isGoalReached, gardenData, profiles]
  );

  return {
    gardenData,
    currentTarget,
    progress,
    isGoalReached,
    currentTemplate,
    addContribution,
    claimReward,
    weekHistory,
    isLoading,
  };
}
```

### Modifications useVault.ts (les 4 endroits exacts)

```typescript
// 1. Interface VaultState — ajouter apres les autres champs (ex: apres `dietary`)
gardenRaw: string;
setGardenRaw: React.Dispatch<React.SetStateAction<string>>;

// 2. useState dans useVaultInternal() — ajouter pres des autres useState simples
const [gardenRaw, setGardenRaw] = useState<string>('');

// 3. Dans loadVaultData, ajouter au bloc Promise.allSettled existant
// (apres le dernier element, ex: apres [10] defis ou [N] dernier element actuel)
vault.readFile(VILLAGE_FILE).catch(() => ''),

// Puis dans le destructuring des resultats :
const gardenContent = results[N].status === 'fulfilled' ? results[N].value as string : '';
setGardenRaw(gardenContent);

// 4. Dans le return de useMemo :
gardenRaw,
setGardenRaw,
// + ajouter gardenRaw dans le deps array du useMemo
```

### Modification FarmProfileData pour village_claimed_week

```typescript
// lib/types.ts ou lib/mascot/types.ts — interface FarmProfileData
village_claimed_week?: string; // ISO date 'YYYY-MM-DD' — semaine la plus recente claimee

// lib/parser.ts — parseFarmProfile, dans le switch/case ou apres les props connus :
village_claimed_week: props.village_claimed_week || undefined,

// lib/parser.ts — serializeFarmProfile, ajouter avant le return :
if (data.village_claimed_week) lines.push(`village_claimed_week: ${data.village_claimed_week}`);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Logique domaine dans useVault.ts monolithique | Hooks domaine deleguees (useFarm, useGarden) | Phase 08.1 split, continue Phase 26 | useVault.ts plafonne, chaque domaine est independant |
| Gamification per-app (gamification.md) | Per-profil (gami-{id}.md) | Phase 08.1 | Village claimed week per-profil naturel dans gami-{id}.md |
| Persistence simple field | Append-only log pour contributions | Init v1.4 | Evite corruptions iCloud, total derive a la lecture |

---

## Open Questions

1. **lib/village/ existe-t-il au moment de planifier Phase 26 ?**
   - What we know: Phase 25 n'est pas encore executee (`lib/village/` absent au 2026-04-10).
   - What's unclear: Les types exacts (VillageData, VillageContribution, VillageWeekRecord, ContributionType) et les signatures exactes de parseGardenFile, serializeGardenFile, appendContributionToVault.
   - Recommendation: Le plan de Phase 26 doit inclure en Wave 0 la verification que Phase 25 est complete, OU etre prevu pour s'executer sequentiellement apres Phase 25. Ne pas planner Phase 26 avant que lib/village/ soit livre.

2. **Format exact du retour de appendContributionToVault**
   - What we know: La fonction est declaree dans lib/village/parser.ts (Phase 25). D'apres le contexte, elle ecrit via VaultManager et retourne probablement le nouveau contenu ou void.
   - What's unclear: Si elle retourne le nouveau contenu (string) ou void. Si void, setGardenRaw doit relire le fichier.
   - Recommendation: Le implementeur doit lire lib/village/parser.ts livree par Phase 25 avant de coder addContribution.

3. **Definition exacte de "profil actif" pour computeWeekTarget**
   - What we know: `profiles` inclut tous les profils (enfants, adultes, grossesse).
   - What's unclear: Est-ce que les profils en statut grossesse comptent ? Les profils sans historique de contribution ?
   - Recommendation: Filtrer `p.role !== 'grossesse'` par defaut. Documenter dans le code.

---

## Environment Availability

Step 2.6: SKIPPED (phase purement code/config — zero dependances externes au-dela du projet existant).

---

## Validation Architecture

> nyquist_validation est false dans .planning/config.json — section omise.

---

## Sources

### Primary (HIGH confidence)
- Source codebase directe — hooks/useVault.ts (lu) : patterns useState, loadVaultData parallel loading, VaultState interface, return useMemo structure
- Source codebase directe — hooks/useFarm.ts (lu) : pattern hook domaine de reference, useVault() consumption, useCallback pattern
- Source codebase directe — hooks/useVaultProfiles.ts (lu) : refreshGamification/refreshFarm patterns
- Source codebase directe — lib/parser.ts lignes 571-699 (lu) : parseFarmProfile/serializeFarmProfile — structure exacte, champs connus
- Source codebase directe — contexts/VaultContext.tsx (lu) : structure simplifiee, re-export de VaultState
- .planning/phases/26-hook-domaine-jardin/26-CONTEXT.md (lu) : decisions verouillees D-01 a D-14

### Secondary (MEDIUM confidence)
- .planning/phases/25-fondation-donn-es-village/25-CONTEXT.md (lu) : contenu prevu de lib/village/ (types, fonctions, constantes) — MEDIUM car Phase 25 pas encore executee
- .planning/codebase/ARCHITECTURE.md et CONVENTIONS.md (lu) : patterns confirmes

### Tertiary (LOW confidence)
- Signatures exactes de parseGardenFile, serializeGardenFile, appendContributionToVault : LOW — lib/village/ absent, signatures inferred from Phase 25 CONTEXT.md

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero nouvelles dependances, tout dans le codebase existant
- Architecture: HIGH — useFarm.ts est la reference directe, code lu et analyse
- Pitfalls: HIGH — identifies depuis les patterns existants et les decisions de conception
- Signatures lib/village: MEDIUM-LOW — Phase 25 non executee, signatures inferees du CONTEXT.md

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable — aucune dependance externe mouvante)
