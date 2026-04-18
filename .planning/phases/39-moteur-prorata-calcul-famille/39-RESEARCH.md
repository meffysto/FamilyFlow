# Phase 39 : Moteur prorata + calcul famille — Research

**Researched:** 2026-04-18
**Domain:** Pure computation engine — prorata wager, family weights, tasks domain filter, snapshot persistence
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Snapshot matinal — persistance**
- Stocké dans `jardin-familial.md` en append-only sous une section `## Snapshots` avec format CSV date-keyed : `YYYY-MM-DD:pending:activeProfileIds|…`
- Réutilise le pattern append-only Phase 25 (village) et Phase 30 (constructions)
- Rétention : garde les 14 derniers jours, purge au-delà
- Le snapshot est la source of truth pour toute réevaluation intra-journée — les recomputes 23h30 ne le modifient pas, ils lisent `snapshot[today]` et recalculent `cumulCurrent`

**D-02 — Brackets d'âge (derivedAgeCategory)**
- Bébé : 0-2 ans inclus (poids 0.0)
- Jeune enfant : 3-5 ans inclus (poids 0.15)
- Enfant : 6-12 ans inclus (poids 0.4)
- Ado : 13-17 ans inclus (poids 0.7)
- Adulte : 18 ans et + (poids 1.0)
- Dérivé depuis `profile.birthdate` via `computeAgeCategory(birthDate, today)` — pur, testable

**D-03 — Override poids dans settings profil**
- Champ vault `weight_override: 'adulte' | 'ado' | 'enfant' | 'jeune' | 'bebe'` dans le fichier profil (top-level frontmatter)
- Si absent/null → dérivation automatique via `birthdate`
- `resolveWeight(profile) → number` : override si présent, sinon `WEIGHT_BY_CATEGORY[computeAgeCategory(birthdate)]`

**D-04 — Edge cases**
- Divide-by-zero (aucun profil actif 7j hors sealeur, ou tous poids=0) : fallback → `cumulTarget = Tasks_pending` (sealeur porte la charge seul)
- Sealeur avec poids 0 (bébé) : refus à la création du pari (`canSealWager({weight}) → { ok: false, reason: 'zero_weight' }`)
- Pas de tâches pending au snapshot : `cumulTarget = 0` → pari auto-gagné à la validation
- Profil sans birthdate et sans override : traité comme adulte (1.0) par défaut — log warning dev only

**D-05 — Catchup recompute**
- Un seul recompute au boot — lecture `lastRecomputeDate` vs `today` local
- Si `lastRecomputeDate < today` ET l'heure actuelle ≥ 23h30 OU on est dans le jour suivant → recompute une fois
- Pas de replay jour par jour : si app fermée 3 jours, on prend l'état courant comme si on était au 23h30 d'hier

**D-06 — Snapshot trigger exact**
- Fenêtre recompute : déclenchement si `now >= 23:30 local` ET `lastRecomputeDate !== today`
- Fallback au boot : à chaque app open, `maybeRecompute(now, lastRecomputeDate)` vérifie la condition
- Morning snapshot : pris à la première invocation du recompute après minuit local
- Une seule fonction pure `shouldRecompute(now, lastRecomputeDate) → boolean` testable en isolation

### Claude's Discretion

- Nom exact du module (`wager-engine.ts`, `prorata-engine.ts`, `family-weights.ts` — ou éclaté en 2-3 fichiers)
- Signatures exactes des types `FamilySnapshot`, `WagerComputeResult`
- Stratégie de mock pour les tests — préférence : injection de `now` en paramètre pour pureté maximale
- Structure suite Jest (un seul fichier ou éclaté par concept)

### Deferred Ideas (OUT OF SCOPE)

- UI settings profil override poids — Phase 40/41
- Visualisation snapshot en debug menu — Phase 41 possible
- Réconciliation snapshot si vault édité manuellement — reporté v2
- Métriques long-terme prorata — codex marathonWins Phase 41
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SPOR-03 | Cumul requis recalculé chaque soir à 23h30 (ou au boot si app fermée) selon `(poids_sealeur / poids_famille_active_7j) × Tasks_pending`, basé sur un snapshot matinal stable | `shouldRecompute` + `maybeRecompute` patterns ; snapshot en `## Snapshots` `jardin-familial.md` |
| SPOR-04 | Poids par âge appliqués automatiquement (Adulte 1.0 / Ado 0.7 / Enfant 0.4 / Jeune enfant 0.15 / Bébé 0.0) depuis `birthdate`, avec override manuel via `weight_override` frontmatter | `computeAgeCategory` + `resolveWeight` ; Profile.birthdate YYYY-MM-DD confirmed in lib/types.ts |
| SPOR-05 | Seuls les profils avec ≥1 tâche complétée sur 7 jours glissants comptés dans le diviseur famille | `isProfileActive7d(tasks, profileId, today)` — tasks passés par injection, référence `completedDate` |
| SPOR-06 | Seules les tâches du domaine Tasks comptabilisées (Courses, Repas, Routines, Anniversaires, Notes, Moods exclus) | `filterTasksForWager(tasks)` — filtre sur `sourceFile` pattern `01 - Enfants/*/Tâches récurrentes.md` + `02 - Maison/Tâches récurrentes.md` |
| SPOR-13 | Tests Jest couvrant calcul prorata, pondération famille par âge, sérialisation/désérialisation, validation cumul à la récolte | Suite Jest lib/__tests__/wager-engine.test.ts — 7 describe identifiés dans CONTEXT.md §specifics |
</phase_requirements>

---

## Summary

La Phase 39 livre un **moteur de calcul pur** sans I/O, sans état global, sans UI. Son périmètre est entièrement délimité par les décisions verrouillées dans CONTEXT.md : une formule prorata déterministe, des brackets d'âge fixes avec override vault, un filtre domaine Tasks strict basé sur les `sourceFile` existants, et un mécanisme de snapshot append-only dans `jardin-familial.md` (section `## Snapshots`).

Le pattern de référence est `lib/mascot/sporee-economy.ts` livré en Phase 38 : fonctions pures, zéro appel `Date.now()` sans paramètre, injection de `now`, types discriminés pour les résultats (`{ ok: true, ... } | { ok: false, reason: ... }`), Math.random via jest.spyOn pour les tests. Le module Phase 39 adopte exactement ce même contrat de pureté.

La principale subtilité d'implémentation est la **séparation snapshot vs recompute** : le snapshot matinal (pris une fois par jour après minuit) est la source of truth de `Tasks_pending` ; le recompute 23h30 ne change pas le snapshot mais recalcule `cumulCurrent` depuis l'état courant des tâches. Phase 40 sera responsable de lire/écrire ce snapshot via les hooks — le moteur Phase 39 ne touche pas au filesystem.

**Recommandation principale :** Un seul fichier `lib/mascot/wager-engine.ts` couvrant les 7 concepts (age/weight, active-7d, task-filter, prorata, snapshot-key, recompute-trigger, harvest-validate) avec une suite Jest unique `lib/__tests__/wager-engine.test.ts` organisée en 7 `describe` blocs. Nommage cohérent avec `sporee-economy.ts` voisin.

---

## Standard Stack

### Core (déjà installé — zéro nouvelle dépendance)

| Library | Version | Purpose | Confirmé |
|---------|---------|---------|----------|
| TypeScript | ~5.x (Expo SDK 54) | Typage statique, types discriminés | Codebase entier |
| Jest (via `npx jest`) | ~29 (Expo SDK 54 default) | Suite tests pures | lib/__tests__/* existants |
| `lib/mascot/sporee-economy.ts` | Phase 38 livraison | Pattern réutilisable getLocalDateKey, fonctions pures | Vérifié Phase 38 SUMMARY |
| `lib/types.ts` Profile | existant | Champs birthdate, id, role — profil de base | lib/types.ts:67-118 |
| `lib/mascot/types.ts` WagerModifier | Phase 38 livraison | cumulTarget?, cumulCurrent? à peupler Phase 39 | lib/mascot/types.ts |

**Aucun npm install requis.** Politique zéro nouvelle dépendance reconduite (6e milestone consécutif — STATE.md).

### Patterns réutilisés

| Pattern | Source | Usage Phase 39 |
|---------|--------|----------------|
| `getLocalDateKey(d)` | `lib/mascot/sporee-economy.ts` | Clé snapshot YYYY-MM-DD (ne pas dupliquer) |
| Types discriminés ok/reason | `sporee-economy.ts BuySporeeCheck` | `canSealWager`, `validateWagerOnHarvest` |
| Injection `now` en paramètre | `applyDailyResetIfNeeded(boughtToday, lastResetDate, today)` | `shouldRecompute(now, lastRecomputeDate)` |
| Math.random via jest.spyOn | `sporee-economy.test.ts` | Pas applicable (prorata est déterministe — pas de RNG) |
| Append-only section `## Constructions` | `lib/village/parser.ts:appendBuilding` | Pattern exact pour `## Snapshots` dans jardin-familial.md |

---

## Architecture Patterns

### Structure de fichiers recommandée

```
lib/mascot/
├── wager-engine.ts          # NOUVEAU — moteur prorata Phase 39 (pures)
├── sporee-economy.ts        # Phase 38 — réutilisé (getLocalDateKey)
├── farm-engine.ts           # Phase 38 — encodeModifiers/decodeModifiers
└── types.ts                 # Phase 38 — WagerModifier (cumulTarget?, cumulCurrent?)

lib/__tests__/
└── wager-engine.test.ts     # NOUVEAU — suite Jest Phase 39

lib/village/
└── parser.ts                # À ÉTENDRE — appendSnapshot() pour ## Snapshots
```

### Pattern 1 : Fonction pure avec injection `now`

Modèle direct depuis `sporee-economy.ts` (Phase 38). Toutes les fonctions recevant une date utilisent un paramètre explicite.

```typescript
// Source : lib/mascot/sporee-economy.ts:162 (applyDailyResetIfNeeded)
export function shouldRecompute(
  now: Date,
  lastRecomputeDate: string, // YYYY-MM-DD local
): boolean {
  const todayKey = getLocalDateKey(now); // réutilise sporee-economy
  if (lastRecomputeDate === todayKey) return false;
  // 23h30 local = heures * 60 + minutes >= 23 * 60 + 30 = 1410
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
  return minutesSinceMidnight >= 23 * 60 + 30 || lastRecomputeDate < todayKey;
}
```

### Pattern 2 : Filtre domaine Tasks via sourceFile

Les Tasks du domaine Tasks ont un `sourceFile` correspondant aux fichiers chargés dans `STATIC_TASK_FILES` + les fichiers enfants (`01 - Enfants/*/Tâches récurrentes.md`, `02 - Maison/Tâches récurrentes.md`). Ce sont les SEULS fichiers parsés par `parseTaskFile()` dans useVault.ts.

**Insight critique :** les `Task` en mémoire dans VaultState incluent déjà SEULEMENT les tâches de ces fichiers. Courses vient de `Liste de courses.md`, Routines de `routines.md`, etc. — chacun chargé séparément via des fonctions `parse*` distinctes. Donc le filtre domaine Tasks en Phase 39 est simplement une vérification défensive sur `sourceFile` :

```typescript
// lib/types.ts:8 — Task.sourceFile est le chemin relatif dans le vault
export function filterTasksForWager(tasks: Task[]): Task[] {
  return tasks.filter(t =>
    t.sourceFile.includes('Tâches récurrentes') || // pattern Tasks domain
    // Exclure explicitement les domaines hors-scope (double sécurité)
    (!t.sourceFile.includes('courses') &&
     !t.sourceFile.includes('routines') &&
     !t.sourceFile.includes('repas') &&
     !t.sourceFile.includes('anniversaires') &&
     !t.sourceFile.includes('notes') &&
     !t.sourceFile.includes('moods'))
  );
}
```

Variante plus précise et testable : inclure uniquement les sourceFile commençant par `01 - Enfants/` ou `02 - Maison/Tâches récurrentes.md`.

### Pattern 3 : Calcul prorata pur

```typescript
// Source : CONTEXT.md §specifics — signature pivot suggérée
export interface FamilyWeightResult {
  cumulTarget: number;           // résultat arrondi entier (count de tâches)
  activeProfileIds: string[];    // IDs profils actifs 7j glissants
  weights: Record<string, number>; // profil.id → poids résolu
  sealerWeight: number;
  familyWeightSum: number;       // somme poids actifs (diviseur)
}

export function computeCumulTarget(opts: {
  sealerProfileId: string;
  allProfiles: Profile[];
  tasks: Task[];           // tâches filtrées domain Tasks uniquement
  today: string;           // YYYY-MM-DD local (injecté)
  pendingCount: number;    // snapshot matinal (Tasks_pending)
}): FamilyWeightResult {
  // 1. Filtrer profils actifs 7j glissants (excluant grossesse/bebe si poids=0)
  // 2. Résoudre poids par profil (override ou dérivé)
  // 3. Calculer somme famille
  // 4. Divide-by-zero guard (D-04)
  // 5. Retourner { cumulTarget: Math.ceil(ratio × pendingCount), ... }
}
```

### Pattern 4 : Brackets d'âge — calcul `differenceInYears`

Le projet n'a pas de dépendance `date-fns` directe côté pures fonctions. La solution idiomatique sans dépendance externe :

```typescript
/** Différence en années révolues (identique à differenceInYears de date-fns). */
function yearsDiff(from: Date, to: Date): number {
  let age = to.getFullYear() - from.getFullYear();
  const m = to.getMonth() - from.getMonth();
  if (m < 0 || (m === 0 && to.getDate() < from.getDate())) age--;
  return age;
}
```

Note : `date-fns` est utilisé dans `hooks/useVault.ts` (format, startOfWeek) mais n'est pas importé dans les modules purs `lib/mascot/`. Le moteur Phase 39 doit rester cohérent avec ce pattern — implémenter `yearsDiff` localement.

### Pattern 5 : Snapshot append-only dans jardin-familial.md

Inspiré de `appendBuilding` (lib/village/parser.ts:472). La section `## Snapshots` est ajoutée si absente, les nouvelles lignes sont insérées avant la section suivante.

Format ligne : `YYYY-MM-DD:pending:profileId1|profileId2|…`

La purge des >14 jours se fait à l'écriture du nouveau snapshot (Phase 40 côté hook) — le moteur Phase 39 livre `parseSnapshots(content)` et `formatSnapshotLine(date, pending, profileIds)` comme fonctions pures, la logique d'I/O restant dans le hook Phase 40.

### Anti-Patterns à éviter

- **`new Date()` sans paramètre dans le moteur pur** : toute date doit être injectée. La contrainte est identique à `sporee-economy.ts` (vérifiée CONTEXT.md §code_context).
- **Importer depuis `hooks/`** : le moteur ne doit jamais dépendre des hooks. Sens inverse uniquement (Phase 40 importe wager-engine.ts).
- **Arrondir cumulTarget à l'excès** : utiliser `Math.ceil()` pour que même une fraction de tâche exige une tâche entière (conforme à la sémantique "tasks pending").
- **Modifier le snapshot au recompute 23h30** : le recompute lit `snapshot[today].pending` et le snapshot reste intact. Écrire un nouveau snapshot uniquement après minuit (premier recompute du jour).
- **Importer `date-fns` dans lib/mascot/** : la règle de pureté de module interdit les dépendances externes non triviales. Implémenter `yearsDiff` inline.

---

## Don't Hand-Roll

| Problème | Ne pas construire | Utiliser à la place | Pourquoi |
|----------|-------------------|---------------------|----------|
| Clé date locale YYYY-MM-DD | `new Date().toISOString().slice(0,10)` | `getLocalDateKey(d)` (sporee-economy.ts) | Évite décalage UTC — pattern Phase 38 vérifié |
| Différence en années | bibliothèque externe | `yearsDiff(from, to)` inline (8 lignes) | Pas de dépendance externe, cas edge anniversaire géré |
| Sérialisation snapshot | nouveau format custom | Pattern ligne CSV `YYYY-MM-DD:pending:ids\|…` + `appendBuilding` pattern | Obsidian-lisible, cohérent avec Phase 25/30 |
| Types résultat | exceptions / throw | Types discriminés `{ ok: false, reason }` | Pattern établi `sporee-economy.ts`, testable, pas de try/catch côté consommateur |

---

## Common Pitfalls

### Pitfall 1 : Confusion `birthdate` vs `birthDate` (casse)

**Problème :** Le type `Profile` dans `lib/types.ts:72` utilise `birthdate` (tout minuscule), pas `birthDate` (camelCase). Les plans et le CONTEXT.md utilisent parfois `birthDate`.

**Prévention :** Utiliser `profile.birthdate` partout dans wager-engine.ts. Vérifier avec `grep "birthdate" lib/types.ts` — confirmé ligne 72.

**Format :** Le champ est `YYYY-MM-DD` ou `YYYY` seulement (pas de datetime). Gérer les deux formats dans `computeAgeCategory`.

### Pitfall 2 : Profils avec `statut: 'grossesse'`

**Problème :** Un profil en mode grossesse (phase de suivi bébé à naître) a `statut: 'grossesse'` et ne devrait pas être compté dans le diviseur famille actif.

**Prévention :** Exclure les profils avec `statut === 'grossesse'` dans `filterActiveProfiles`. Pattern confirmé dans `useVault.ts:272` (Phase 26 décision) : `statut !== 'grossesse'` pour filtrer les profils actifs.

### Pitfall 3 : `isProfileActive7d` — définition de "tâche complétée"

**Problème :** Une tâche est "complétée" quand `task.completed === true` ET `task.completedDate` est dans les 7 derniers jours. Mais `completedDate` peut être absent même sur une tâche complétée (ancienne tâche sans timestamp ✅).

**Prévention :** Pour Phase 39, le filtre 7j glissants requiert `task.completedDate` explicite. Une tâche `completed: true` sans `completedDate` est ignorée pour le comptage d'activité 7j (conservative, pas d'approximation de date). Tester explicitement ce cas dans Jest.

### Pitfall 4 : Append `## Snapshots` en fin de fichier

**Problème :** Les parsers append-only du projet (Phase 25/30) ont une règle stricte : ne jamais appender en fin de fichier si une section suivante existe — risque de désync lors des edits manuels Obsidian.

**Prévention :** Reproduire exactement `appendBuilding` (lib/village/parser.ts:472) — trouver `## Snapshots`, insérer avant la prochaine section `##`, créer la section si absente mais avant `## Historique` ou autre section terminale.

### Pitfall 5 : Snapshot mal parsé — séparateur `|` dans profileIds

**Problème :** Le format `YYYY-MM-DD:pending:profileId1|profileId2` utilise `|` comme séparateur de profileIds mais aussi potentiellement dans les IDs (si un profil avait un `id` contenant `|`).

**Prévention :** Les `profile.id` sont snake_case (ex. `lucas_enfant`, `emma_adulte`) — pas de `|` possible. Mais ajouter un test de round-trip dans la suite Jest pour détecter toute corruption. Le séparateur `:` (entre date/pending/ids) ne peut pas apparaître dans pending (nombre entier) ni dans profileIds (snake_case).

### Pitfall 6 : `pendingCount` au snapshot vs tâches pending en temps réel

**Problème :** Le snapshot matinal capture `Tasks_pending` au moment de la prise du snapshot. Les tâches peuvent être complétées entre le snapshot et le recompute 23h30. C'est volontaire (source of truth stable).

**Prévention :** La signature `computeCumulTarget` reçoit `pendingCount: number` (lu depuis le snapshot), pas `tasks: Task[]` pour recompter. Distinguer clairement `pendingCount` (snapshot) de `tasks` (utilisés seulement pour `isProfileActive7d`).

### Pitfall 7 : Edge case sealeur absent des `allProfiles`

**Problème :** Si `sealerProfileId` ne correspond à aucun profil dans `allProfiles` (profil supprimé, données corrompues), le calcul plante.

**Prévention :** `canSealWager` doit vérifier que le sealeur existe et a un poids > 0 avant de créer un pari. `computeCumulTarget` peut retourner un fallback `cumulTarget = pendingCount` si le sealeur est introuvable (defensive coding, log warning dev).

---

## Code Examples

### computeAgeCategory — bornes inclusives

```typescript
// Source : CONTEXT.md D-02 (bornes vérifiées)
export type WagerAgeCategory = 'adulte' | 'ado' | 'enfant' | 'jeune' | 'bebe';

export const WEIGHT_BY_CATEGORY: Record<WagerAgeCategory, number> = {
  adulte: 1.0,
  ado:    0.7,
  enfant: 0.4,
  jeune:  0.15,
  bebe:   0.0,
};

export function computeAgeCategory(birthdate: string, today: string): WagerAgeCategory {
  // Gère YYYY et YYYY-MM-DD
  const birth = new Date(birthdate.length === 4 ? `${birthdate}-01-01` : birthdate);
  const now   = new Date(today);
  const age   = yearsDiff(birth, now);
  if (age <= 2)  return 'bebe';
  if (age <= 5)  return 'jeune';
  if (age <= 12) return 'enfant';
  if (age <= 17) return 'ado';
  return 'adulte';
}
```

### resolveWeight — override vs dérivation

```typescript
// Source : CONTEXT.md D-03
export function resolveWeight(profile: Profile, today: string): number {
  if (profile.weight_override) {
    return WEIGHT_BY_CATEGORY[profile.weight_override] ?? 1.0;
  }
  if (!profile.birthdate) {
    if (__DEV__) console.warn(`[wager-engine] profil ${profile.id} sans birthdate — poids adulte par défaut`);
    return 1.0; // D-04 fallback
  }
  return WEIGHT_BY_CATEGORY[computeAgeCategory(profile.birthdate, today)];
}
```

### isProfileActive7d — fenêtre 7j glissants

```typescript
// Source : CONTEXT.md SPOR-05 + Pitfall 3 ci-dessus
export function isProfileActive7d(tasks: Task[], profileId: string, today: string): boolean {
  const todayMs = new Date(today + 'T00:00:00').getTime();
  const sevenDaysAgo = todayMs - 7 * 24 * 60 * 60 * 1000;
  return tasks.some(t => {
    if (!t.completed || !t.completedDate) return false;
    // Appartient à ce profil : mentions ou sourceFile du profil
    const byProfile = t.mentions.includes(profileId) ||
      t.sourceFile.toLowerCase().includes(profileId.toLowerCase());
    if (!byProfile) return false;
    const tMs = new Date(t.completedDate + 'T00:00:00').getTime();
    return tMs >= sevenDaysAgo && tMs <= todayMs;
  });
}
```

Note : la logique d'appartenance profil/tâche devra être précisée au plan — le CONTEXT.md ne précise pas si on filtre par `mentions`, par `sourceFile`, ou les deux. La suite Jest couvrira ce cas.

### shouldRecompute — fenêtre 23h30

```typescript
// Source : CONTEXT.md D-06
export function shouldRecompute(now: Date, lastRecomputeDate: string): boolean {
  const todayKey = getLocalDateKey(now);
  if (lastRecomputeDate === todayKey) return false; // déjà recompute aujourd'hui
  // Heure >= 23h30 OU on est déjà le lendemain (catchup boot — D-05)
  const minFromMidnight = now.getHours() * 60 + now.getMinutes();
  return minFromMidnight >= 23 * 60 + 30 || lastRecomputeDate < todayKey;
}
```

### validateWagerOnHarvest — résultat pari

```typescript
// Source : CONTEXT.md §integration points
export interface WagerHarvestResult {
  won: boolean;
  cumulCurrent: number;
  cumulTarget: number;
}

export function validateWagerOnHarvest(
  cumulCurrent: number,
  cumulTarget: number,
): WagerHarvestResult {
  return {
    won: cumulTarget === 0 || cumulCurrent >= cumulTarget, // D-04 cumulTarget=0 → gagné
    cumulCurrent,
    cumulTarget,
  };
}
```

---

## State of the Art

| Approche ancienne | Approche Phase 39 | Impact |
|-------------------|-------------------|--------|
| Calcul inline dans hooks (couplé à I/O) | Moteur pur zéro I/O, injecté dans hooks Phase 40 | Testable en isolation, Phase 40 consomme sans re-implémenter |
| Date.now() direct | Injection de `now: Date` en paramètre | Pattern établi Phase 38, testabilité maximale |
| Exception throw sur edge case | Types discriminés `{ ok: false, reason: 'zero_weight' }` | Pas de try/catch côté consommateur, matrice de test claire |

---

## Open Questions

1. **Attribution tâches → profil dans `isProfileActive7d`**
   - Ce qu'on sait : `Task.mentions` contient les `@user` extraits du texte ; `Task.sourceFile` contient le chemin
   - Ce qui est flou : les fichiers tasks sont par enfant (`01 - Enfants/{name}/Tâches récurrentes.md`) mais le lien `sourceFile → profileId` passe par le nom (name), pas l'id. Un profil `emma_adulte` avec name `Emma` a ses tasks dans `01 - Enfants/Emma/Tâches récurrentes.md`.
   - Recommandation : `isProfileActive7d` reçoit en paramètre la liste des tasks déjà filtrées pour ce profil (le hook Phase 40 sait mapper `profile.name → fichier`), OU la fonction accepte une closure `belongsToProfile(task, profileId) → boolean` injectée. La version la plus pure : passer les tasks déjà pré-filtrées par profil.

2. **`weight_override` dans Profile — champ à ajouter**
   - Ce qu'on sait : le champ n'existe pas encore dans `lib/types.ts` (non trouvé dans les fichiers)
   - Ce qui est flou : où l'ajouter (lib/types.ts + lib/parser.ts parseFamilleFile ou parseFarmProfile ?)
   - Recommandation : ajouter dans `lib/types.ts:Profile` comme `weight_override?: WagerAgeCategory` + dans le parser `parseFamilleFile` (famille.md fournit les profils). Le plan doit inclure cette extension.

3. **Format `yearsDiff` pour `birthdate: YYYY` seulement**
   - Ce qu'on sait : `Profile.birthdate` peut être `YYYY` seulement (lib/types.ts:72)
   - Ce qui est flou : si birthdate est `1990` seulement, `new Date('1990')` donne `1990-01-01` (UTC), ce qui peut décaler selon timezone
   - Recommandation : normaliser `'1990'` → `'1990-01-01'` avant parsing, identique au pattern `isProfileActive7d` pour les dates locales.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 39 est un module pur TypeScript sans dépendances externes (zéro CLI, zéro service, zéro base de données). Les seuls outils requis sont `npx tsc --noEmit` et `npx jest --no-coverage`, déjà vérifiés fonctionnels en Phase 38.

---

## Validation Architecture

> `nyquist_validation: false` dans `.planning/config.json` — section omise conformément aux instructions.

---

## Project Constraints (from CLAUDE.md)

Directives applicables à cette phase :

| Directive | Impact Phase 39 |
|-----------|----------------|
| Zéro nouvelle dépendance npm | Confirmé — wager-engine.ts n'importe que du codebase existant |
| UI/commits/commentaires en français | Tous les noms de variables, commentaires, messages de commit en FR |
| `npx tsc --noEmit` obligatoire avant chaque commit | Critère d'acceptance chaque tâche |
| `npx jest --no-coverage` — tests unitaires | Suite Jest obligatoire (SPOR-13) |
| Erreurs pré-existantes MemoryEditor.tsx, cooklang.ts, useVault.ts — ignorer | Ne pas corriger ces erreurs dans cette phase |
| `if (__DEV__)` pour console.warn/error | Utiliser dans `resolveWeight` fallback adulte |
| Erreurs non-critiques silencieuses : `catch { /* non-critical */ }` | Pas applicable au moteur pur (pas de try/catch I/O) |
| Backward compat Obsidian vault obligatoire | Format snapshot lisible manuellement dans jardin-familial.md |
| Farm engine reste 100% synchrone et pur | wager-engine.ts zéro async, zéro I/O |
| Fichiers publics : jamais de noms personnels réels | Tests avec Lucas/Emma/parent1 uniquement |

---

## Sources

### Primary (HIGH confidence)

- `lib/mascot/sporee-economy.ts` — pattern fonction pure, injection `now`, types discriminés, getLocalDateKey
- `lib/mascot/farm-engine.ts:228,233` — encodeModifiers/decodeModifiers — pattern module pur
- `lib/village/parser.ts:472` — appendBuilding — pattern append-only section `## Xxxx`
- `lib/types.ts:67-118` — Profile interface, `birthdate?: string` (YYYY-MM-DD ou YYYY), `statut?: 'grossesse'`
- `.planning/phases/38-fondation-modifiers-conomie-spor-e/38-VERIFICATION.md` — contrats Phase 38 vérifiés
- `.planning/phases/39-moteur-prorata-calcul-famille/39-CONTEXT.md` — toutes les décisions verrouillées

### Secondary (MEDIUM confidence)

- `hooks/useVault.ts:299-303` — STATIC_TASK_FILES, nomenclature fichiers tasks (`01 - Enfants/*/Tâches récurrentes.md`, `02 - Maison/Tâches récurrentes.md`) — identifie le domaine Tasks par sourceFile pattern
- `hooks/useVault.ts:272` — décision Phase 26 : `statut !== 'grossesse'` pour filtre profils actifs
- `lib/__tests__/sporee-economy.test.ts` — structure describe-par-concept, privacy convention Lucas/Emma

### Tertiary (vérification recommandée au plan)

- Attribution task → profileId via sourceFile name (Open Question 1) — à résoudre en Plan 01 en lisant parseFamilleFile

---

## Metadata

**Confidence breakdown :**
- Standard stack : HIGH — zéro nouvelle lib, tout codebase existant vérifié
- Architecture : HIGH — patterns Phase 38/25/30 vérifiés et reproductibles
- Pitfalls : HIGH — identifiés depuis lib/types.ts, useVault.ts, et décisions STATE.md
- Open Questions : MEDIUM — 3 zones grises à clarifier dans le plan, non bloquantes

**Research date :** 2026-04-18
**Valid until :** 2026-05-18 (stack stable, zéro dépendance externe)
