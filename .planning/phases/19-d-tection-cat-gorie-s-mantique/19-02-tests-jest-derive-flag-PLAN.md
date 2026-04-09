---
phase: 19-d-tection-cat-gorie-s-mantique
plan: 02
type: tdd
wave: 2
depends_on: ["19-01"]
files_modified:
  - lib/__tests__/derive.test.ts
  - lib/__tests__/flag.test.ts
autonomous: true
requirements:
  - SEMANTIC-01
  - SEMANTIC-02
  - SEMANTIC-03
  - SEMANTIC-04
  - SEMANTIC-05
  - ARCH-02
  - ARCH-03

must_haves:
  truths:
    - "npx jest lib/__tests__/derive.test.ts passe avec ≥12 tests verts couvrant les 10 catégories et les 4 règles (tag, section, filepath, fallback null)"
    - "npx jest lib/__tests__/flag.test.ts passe avec ≥4 tests verts couvrant default-off, set-true, set-false, round-trip"
    - "Test de priorité explicite : une tâche matchant tag+section+filepath retourne matchedBy='tag'"
    - "Test fallback : une tâche sans tags, sans section, avec sourceFile='inconnu/file.md' retourne null"
    - "Test flag default : isSemanticCouplingEnabled() retourne false quand la clé est absente"
    - "Test normalize accents : section 'Ménage hebdomadaire' matche pattern 'menage'"
    - "npm test global reste vert après ajout des 2 nouveaux fichiers"
  artifacts:
    - path: "lib/__tests__/derive.test.ts"
      provides: "Tests unitaires deriveTaskCategory couvrant SEMANTIC-01/02/03/04, ARCH-03, priorité tag>section>filepath"
      min_lines: 150
    - path: "lib/__tests__/flag.test.ts"
      provides: "Tests unitaires isSemanticCouplingEnabled + setSemanticCouplingEnabled couvrant SEMANTIC-05, ARCH-02"
      min_lines: 40
  key_links:
    - from: "lib/__tests__/derive.test.ts"
      to: "lib/semantic/derive.ts"
      via: "import { deriveTaskCategory } from '../semantic/derive'"
      pattern: "from ['\"]\\.\\./semantic"
    - from: "lib/__tests__/flag.test.ts"
      to: "lib/semantic/flag.ts + expo-secure-store mock"
      via: "import helpers + SecureStore.deleteItemAsync dans beforeEach"
      pattern: "beforeEach"
---

<objective>
Livrer la couverture de tests unitaires Jest complète pour le module `lib/semantic/` créé par le plan 19-01, validant empiriquement les 9 requirements de Phase 19 via Jest 29 + ts-jest (déjà installés, zéro nouvelle dépendance).

Purpose: Valider que `deriveTaskCategory` respecte l'ordre tag > section > filepath, détecte correctement les 10 catégories via leurs 3 signaux, retombe proprement sur null en fallback, et que le feature flag `semanticCoupling` persiste correctement en SecureStore avec default-off. Ces tests sont la preuve comportementale des exigences SEMANTIC-01..05, ARCH-02, ARCH-03.

Output: 2 fichiers de test `lib/__tests__/derive.test.ts` et `lib/__tests__/flag.test.ts`, tous verts à l'exécution `npm test`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/19-d-tection-cat-gorie-s-mantique/19-CONTEXT.md
@.planning/phases/19-d-tection-cat-gorie-s-mantique/19-RESEARCH.md
@lib/semantic/categories.ts
@lib/semantic/derive.ts
@lib/semantic/flag.ts
@lib/semantic/index.ts
@lib/types.ts
@lib/__tests__/__mocks__/expo-secure-store.ts
@jest.config.js
@CLAUDE.md

<interfaces>
<!-- Contrats disponibles après plan 19-01 -->

Public API du module :
```typescript
// lib/semantic/index.ts
export function deriveTaskCategory(task: Task): CategoryMatch | null;
export async function isSemanticCouplingEnabled(): Promise<boolean>;
export async function setSemanticCouplingEnabled(enabled: boolean): Promise<void>;
export const SEMANTIC_COUPLING_KEY: string; // 'semantic-coupling-enabled'

export type CategoryId =
  | 'menage_quotidien' | 'menage_hebdo' | 'courses'
  | 'enfants_routines' | 'enfants_devoirs' | 'rendez_vous'
  | 'gratitude_famille' | 'budget_admin' | 'bebe_soins' | 'cuisine_repas';

export type CategoryMatch = {
  id: CategoryId;
  matchedBy: 'tag' | 'section' | 'filepath';
  evidence: string;
};
```

Task type minimal pour builder des objets de test :
```typescript
// lib/types.ts — champs obligatoires
interface Task {
  id: string;
  text: string;
  completed: boolean;
  tags: string[];        // sans '#'
  mentions: string[];
  sourceFile: string;
  lineIndex: number;
  section?: string;      // optionnel
  // Autres champs optionnels peuvent être omis avec cast ou factory
}
```

Mock SecureStore (déjà en place, voir jest.config.js moduleNameMapper) :
```typescript
// lib/__tests__/__mocks__/expo-secure-store.ts
// In-memory store, state persiste entre tests — nettoyer via deleteItemAsync dans beforeEach
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Créer derive.test.ts — tests deriveTaskCategory (filepath/section/tag/priorité/fallback)</name>
  <files>lib/__tests__/derive.test.ts</files>
  <read_first>
    - lib/semantic/categories.ts (voir les 10 entrées CATEGORIES avec leurs patterns exacts — choisir des fixtures qui matchent)
    - lib/semantic/derive.ts (comprendre l'ordre tag > section > filepath et la forme d'evidence)
    - lib/types.ts (champs Task — id, text, completed, tags, mentions, sourceFile, lineIndex, section?)
    - lib/__tests__/gamification.test.ts (pattern de tests existant dans le projet)
    - lib/__tests__/parser.test.ts (pattern factory de Task)
    - .planning/phases/19-d-tection-cat-gorie-s-mantique/19-RESEARCH.md §"Code Examples" et §"Validation Architecture"
  </read_first>
  <behavior>
    Couverture minimale (le planner peut élargir si pertinent) :

    **A. Happy path par catégorie (10 tests, 1 par catégorie)** — via le signal le plus naturel pour chaque :
    - `courses` via tag `#courses`
    - `bebe_soins` via section `Biberons`
    - `enfants_devoirs` via tag `#devoirs`
    - `menage_quotidien` via section `Quotidien` (tâche dans `02 - Maison`)
    - `menage_hebdo` via section `Ménage hebdomadaire`
    - `enfants_routines` via filepath `01 - Enfants/Lucas/Tâches récurrentes.md`
    - `cuisine_repas` via filepath `03 - Cuisine/Recettes/Entrées/soupe.cook`
    - `rendez_vous` via filepath `04 - Rendez-vous/medical.md`
    - `budget_admin` via filepath `05 - Budget/Factures.md`
    - `gratitude_famille` via filepath `06 - Mémoires/Gratitude familiale.md`

    **B. Un test par signal (3 tests explicites)** : tag, section, filepath — vérifier `matchedBy` et `evidence` (brute).

    **C. Normalisation accents (2 tests)** : `Ménage` et `MÉNAGE hebdomadaire` matchent le pattern `menage`. Tag `Urgent` (capitalisé) matche.

    **D. Priorité tag > section > filepath (1 test critique)** : une tâche avec tags=['devoirs'], section='Quotidien' (matcherait menage_quotidien), sourceFile='02 - Maison/...' (matcherait menage_hebdo) → doit retourner `enfants_devoirs` via `matchedBy='tag'`.

    **E. Priorité section > filepath (1 test)** : tags=[], section='Biberons', sourceFile='02 - Maison/X.md' → retourne `bebe_soins` via `matchedBy='section'`.

    **F. Fallback null (3 tests)** :
    - tags=[], section undefined, sourceFile='99 - Inconnu/random.md' → null
    - tags=['random_tag'], section='Something random', sourceFile='zzz/file.md' → null
    - Tâche à la racine vault : sourceFile='notes.md', pas de tags, pas de section → null

    **G. Evidence brute non normalisée (1 test)** : pour section='Ménage hebdomadaire', le CategoryMatch.evidence DOIT être la string `'Ménage hebdomadaire'` (avec accent et majuscule), pas `'menage hebdomadaire'`. Même principe pour tags et pour filepath (premier segment avec préfixe `NN - ` conservé).

    Total minimum : 20 tests. Tous doivent être verts.
  </behavior>
  <action>
Créer `lib/__tests__/derive.test.ts`. Commentaires et titres de tests en français.

Structure recommandée :

```typescript
// lib/__tests__/derive.test.ts
// Tests unitaires de deriveTaskCategory — Phase 19 v1.3 Seed.
// Couvre SEMANTIC-01 (filepath), SEMANTIC-02 (section), SEMANTIC-03 (tags),
// SEMANTIC-04 (fallback null), ARCH-03 (régression zéro).

import { deriveTaskCategory } from '../semantic';
import type { Task } from '../types';

/**
 * Factory helper : construit une Task minimale pour les tests.
 * Champs optionnels non utilisés par deriveTaskCategory sont castés.
 */
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test:0',
    text: 'Tâche test',
    completed: false,
    tags: [],
    mentions: [],
    sourceFile: '',
    lineIndex: 0,
    ...overrides,
  } as Task;
}

describe('deriveTaskCategory — happy path par catégorie', () => {
  it('détecte courses via tag #courses', () => {
    const task = makeTask({ tags: ['courses'], sourceFile: '02 - Maison/Liste de courses.md' });
    const match = deriveTaskCategory(task);
    expect(match).not.toBeNull();
    expect(match!.id).toBe('courses');
    expect(match!.matchedBy).toBe('tag');
  });

  it('détecte bebe_soins via section Biberons', () => {
    const task = makeTask({
      sourceFile: '01 - Enfants/Emma/Tâches récurrentes.md',
      section: 'Biberons',
    });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('bebe_soins');
    expect(match?.matchedBy).toBe('section');
  });

  it('détecte enfants_devoirs via tag #devoirs', () => {
    const task = makeTask({
      tags: ['devoirs'],
      sourceFile: '01 - Enfants/Lucas/Tâches récurrentes.md',
    });
    expect(deriveTaskCategory(task)?.id).toBe('enfants_devoirs');
  });

  it('détecte menage_quotidien via section Quotidien dans Maison', () => {
    const task = makeTask({
      sourceFile: '02 - Maison/Tâches récurrentes.md',
      section: 'Quotidien',
    });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('menage_quotidien');
    expect(match?.matchedBy).toBe('section');
  });

  it('détecte menage_hebdo via section Ménage hebdomadaire', () => {
    const task = makeTask({
      sourceFile: '02 - Maison/Tâches récurrentes.md',
      section: 'Ménage hebdomadaire',
    });
    expect(deriveTaskCategory(task)?.id).toBe('menage_hebdo');
  });

  it('détecte enfants_routines via filepath 01 - Enfants', () => {
    const task = makeTask({ sourceFile: '01 - Enfants/Lucas/Tâches récurrentes.md' });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('enfants_routines');
    expect(match?.matchedBy).toBe('filepath');
  });

  it('détecte cuisine_repas via filepath 03 - Cuisine', () => {
    const task = makeTask({ sourceFile: '03 - Cuisine/Recettes/Entrées/soupe.cook' });
    expect(deriveTaskCategory(task)?.id).toBe('cuisine_repas');
  });

  it('détecte rendez_vous via filepath 04 - Rendez-vous', () => {
    const task = makeTask({ sourceFile: '04 - Rendez-vous/medical.md' });
    expect(deriveTaskCategory(task)?.id).toBe('rendez_vous');
  });

  it('détecte budget_admin via filepath 05 - Budget', () => {
    const task = makeTask({ sourceFile: '05 - Budget/Factures.md' });
    expect(deriveTaskCategory(task)?.id).toBe('budget_admin');
  });

  it('détecte gratitude_famille via filepath 06 - Mémoires', () => {
    const task = makeTask({ sourceFile: '06 - Mémoires/Gratitude familiale.md' });
    expect(deriveTaskCategory(task)?.id).toBe('gratitude_famille');
  });
});

describe('deriveTaskCategory — normalisation (accents + casse)', () => {
  it('normalise les accents dans la section (Ménage → menage)', () => {
    const task = makeTask({
      sourceFile: '02 - Maison/X.md',
      section: 'Ménage',
    });
    expect(deriveTaskCategory(task)?.id).toBe('menage_hebdo');
  });

  it('normalise MÉNAGE en majuscules + accents', () => {
    const task = makeTask({
      sourceFile: '02 - Maison/X.md',
      section: 'MÉNAGE HEBDOMADAIRE',
    });
    expect(deriveTaskCategory(task)?.id).toBe('menage_hebdo');
  });
});

describe('deriveTaskCategory — ordre de priorité tag > section > filepath (D-02)', () => {
  it('retourne tag quand les 3 signaux matcheraient des catégories différentes', () => {
    // tag → enfants_devoirs, section "Quotidien" → menage_quotidien, filepath → menage_hebdo
    const task = makeTask({
      tags: ['devoirs'],
      section: 'Quotidien',
      sourceFile: '02 - Maison/Tâches récurrentes.md',
    });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('enfants_devoirs');
    expect(match?.matchedBy).toBe('tag');
  });

  it('retourne section quand tag absent mais section et filepath matcheraient différent', () => {
    // section Biberons → bebe_soins, filepath → menage_hebdo
    const task = makeTask({
      section: 'Biberons',
      sourceFile: '02 - Maison/X.md',
    });
    const match = deriveTaskCategory(task);
    expect(match?.id).toBe('bebe_soins');
    expect(match?.matchedBy).toBe('section');
  });
});

describe('deriveTaskCategory — evidence est la valeur brute non normalisée (D-04b)', () => {
  it('conserve la casse et les accents de la section', () => {
    const task = makeTask({
      sourceFile: '02 - Maison/X.md',
      section: 'Ménage hebdomadaire',
    });
    expect(deriveTaskCategory(task)?.evidence).toBe('Ménage hebdomadaire');
  });

  it('conserve le tag original (sans #)', () => {
    const task = makeTask({ tags: ['Courses'], sourceFile: 'x/y.md' });
    // 'Courses' normalisé = 'courses' → matche pattern 'courses'
    expect(deriveTaskCategory(task)?.evidence).toBe('Courses');
  });

  it('conserve le premier segment filepath avec préfixe NN -', () => {
    const task = makeTask({ sourceFile: '03 - Cuisine/x.cook' });
    expect(deriveTaskCategory(task)?.evidence).toBe('03 - Cuisine');
  });
});

describe('deriveTaskCategory — fallback null (SEMANTIC-04 / ARCH-03)', () => {
  it('retourne null pour un sourceFile inconnu sans tags ni section', () => {
    const task = makeTask({ sourceFile: '99 - Inconnu/random.md' });
    expect(deriveTaskCategory(task)).toBeNull();
  });

  it('retourne null pour des signaux tous inconnus', () => {
    const task = makeTask({
      tags: ['random_tag_zzz'],
      section: 'Something random zzz',
      sourceFile: 'zzz/file.md',
    });
    expect(deriveTaskCategory(task)).toBeNull();
  });

  it('retourne null pour une tâche à la racine du vault sans tags ni section', () => {
    const task = makeTask({ sourceFile: 'notes.md' });
    expect(deriveTaskCategory(task)).toBeNull();
  });

  it('retourne null pour tags=[] et section undefined et sourceFile=""', () => {
    const task = makeTask({});
    expect(deriveTaskCategory(task)).toBeNull();
  });
});
```

**Important** :
- Le planner doit ajuster les fixtures pour qu'elles matchent VRAIMENT les patterns définis dans categories.ts au plan 19-01 (lire ce fichier AVANT d'écrire les tests).
- Si une catégorie n'a pas de pattern matchable pour le signal visé, adapter le test (ex : utiliser un tag en fallback).
- Total minimum attendu : ≥20 tests verts. Le planner peut enrichir.
- Aucune dépendance externe autre que `../semantic` et `../types`.
- Commentaires et titres de test en français (convention CLAUDE.md).
  </action>
  <acceptance_criteria>
    - Fichier `lib/__tests__/derive.test.ts` existe
    - `grep -c "import { deriveTaskCategory }" lib/__tests__/derive.test.ts` retourne `1`
    - `grep -c "describe(" lib/__tests__/derive.test.ts` ≥ `5` (happy path, normalisation, priorité, evidence, fallback)
    - `grep -c "it(" lib/__tests__/derive.test.ts` ≥ `20`
    - Les 10 CategoryId apparaissent dans le fichier : chaque valeur parmi `menage_quotidien`, `menage_hebdo`, `courses`, `enfants_routines`, `enfants_devoirs`, `rendez_vous`, `gratitude_famille`, `budget_admin`, `bebe_soins`, `cuisine_repas` trouvée via grep
    - Au moins un test vérifie `matchedBy).toBe('tag')`, un vérifie `matchedBy).toBe('section')`, un vérifie `matchedBy).toBe('filepath')` — `grep -c "matchedBy" lib/__tests__/derive.test.ts` ≥ `6`
    - Au moins un test vérifie `toBeNull()` : `grep -c "toBeNull()" lib/__tests__/derive.test.ts` ≥ `3`
    - Un test d'evidence brute existe : `grep -c "Ménage hebdomadaire" lib/__tests__/derive.test.ts` ≥ `1`
    - **Commande de test verte** : `npx jest lib/__tests__/derive.test.ts --no-coverage` exit code 0
    - `npx tsc --noEmit` ne produit aucune erreur imputable à derive.test.ts
  </acceptance_criteria>
  <verify>
    <automated>npx jest lib/__tests__/derive.test.ts --no-coverage</automated>
  </verify>
  <done>derive.test.ts existe, ≥20 tests verts, couvre les 10 catégories × 3 signaux, priorité tag>section>filepath, fallback null, evidence brute.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Créer flag.test.ts — tests feature flag SecureStore (default off, round-trip)</name>
  <files>lib/__tests__/flag.test.ts</files>
  <read_first>
    - lib/semantic/flag.ts (comprendre SEMANTIC_COUPLING_KEY + helpers async)
    - lib/__tests__/__mocks__/expo-secure-store.ts (comprendre comment le mock stocke l'état en mémoire)
    - .planning/phases/19-d-tection-cat-gorie-s-mantique/19-RESEARCH.md §"Pitfall 1: SecureStore mock state bleed"
    - lib/__tests__/gamification.test.ts ou autre test existant utilisant SecureStore (pattern beforeEach)
    - jest.config.js (vérifier moduleNameMapper pour expo-secure-store)
  </read_first>
  <behavior>
    **Tests minimum (4 tests, le planner peut enrichir)** :

    1. **Default OFF** : `isSemanticCouplingEnabled()` retourne `false` quand la clé n'a jamais été set (après `beforeEach` de nettoyage).
    2. **Set true → true** : après `setSemanticCouplingEnabled(true)`, `isSemanticCouplingEnabled()` retourne `true`.
    3. **Set false → false** : après `setSemanticCouplingEnabled(false)`, `isSemanticCouplingEnabled()` retourne `false`.
    4. **Round-trip true → false → true** : séquence d'écritures successives, lecture cohérente à chaque étape (vérifie ARCH-02 = désactivation instantanée).

    **Isolation** : `beforeEach` DOIT appeler `SecureStore.deleteItemAsync(SEMANTIC_COUPLING_KEY)` pour neutraliser le state bleed du mock in-memory (Pitfall 1 de RESEARCH.md).
  </behavior>
  <action>
Créer `lib/__tests__/flag.test.ts`. Commentaires et titres de tests en français.

```typescript
// lib/__tests__/flag.test.ts
// Tests unitaires du feature flag semantic-coupling — Phase 19 v1.3 Seed.
// Couvre SEMANTIC-05 (toggle via feature flag) et ARCH-02 (désactivation instantanée).
//
// IMPORTANT : le mock expo-secure-store (lib/__tests__/__mocks__/expo-secure-store.ts)
// est in-memory et partage son state entre tests. Le beforeEach nettoie la clé
// pour garantir l'isolation (voir RESEARCH.md Pitfall 1).

import * as SecureStore from 'expo-secure-store';
import {
  isSemanticCouplingEnabled,
  setSemanticCouplingEnabled,
  SEMANTIC_COUPLING_KEY,
} from '../semantic';

beforeEach(async () => {
  // Isolation : nettoyer la clé avant chaque test (mock in-memory persistant)
  await SecureStore.deleteItemAsync(SEMANTIC_COUPLING_KEY);
});

describe('feature flag semantic-coupling — default OFF (SEMANTIC-05)', () => {
  it('retourne false quand la clé SecureStore est absente', async () => {
    expect(await isSemanticCouplingEnabled()).toBe(false);
  });

  it('clé canonique = semantic-coupling-enabled', () => {
    expect(SEMANTIC_COUPLING_KEY).toBe('semantic-coupling-enabled');
  });
});

describe('feature flag semantic-coupling — set/get round-trip (ARCH-02)', () => {
  it('retourne true après setSemanticCouplingEnabled(true)', async () => {
    await setSemanticCouplingEnabled(true);
    expect(await isSemanticCouplingEnabled()).toBe(true);
  });

  it('retourne false après setSemanticCouplingEnabled(false)', async () => {
    await setSemanticCouplingEnabled(false);
    expect(await isSemanticCouplingEnabled()).toBe(false);
  });

  it('désactive instantanément après true → false (ARCH-02)', async () => {
    await setSemanticCouplingEnabled(true);
    expect(await isSemanticCouplingEnabled()).toBe(true);
    await setSemanticCouplingEnabled(false);
    expect(await isSemanticCouplingEnabled()).toBe(false);
  });

  it('réactive après false → true (séquence complète)', async () => {
    await setSemanticCouplingEnabled(false);
    await setSemanticCouplingEnabled(true);
    expect(await isSemanticCouplingEnabled()).toBe(true);
  });
});

describe('feature flag semantic-coupling — persistence SecureStore', () => {
  it('écrit la chaîne "true" dans SecureStore quand activé', async () => {
    await setSemanticCouplingEnabled(true);
    const raw = await SecureStore.getItemAsync(SEMANTIC_COUPLING_KEY);
    expect(raw).toBe('true');
  });

  it('écrit la chaîne "false" dans SecureStore quand désactivé', async () => {
    await setSemanticCouplingEnabled(false);
    const raw = await SecureStore.getItemAsync(SEMANTIC_COUPLING_KEY);
    expect(raw).toBe('false');
  });
});
```

Notes :
- `import * as SecureStore from 'expo-secure-store'` utilise automatiquement le mock via moduleNameMapper (voir jest.config.js).
- Le `beforeEach` garantit isolation — sans ça, l'ordre d'exécution des tests casserait les résultats.
- 7 tests minimum, organisés en 3 describe blocks.
- Titres et commentaires en français (convention projet).
  </action>
  <acceptance_criteria>
    - Fichier `lib/__tests__/flag.test.ts` existe
    - `grep -c "import \* as SecureStore from 'expo-secure-store'" lib/__tests__/flag.test.ts` retourne `1`
    - `grep -c "isSemanticCouplingEnabled\|setSemanticCouplingEnabled" lib/__tests__/flag.test.ts` ≥ `4`
    - `grep -c "beforeEach" lib/__tests__/flag.test.ts` ≥ `1`
    - `grep -c "deleteItemAsync" lib/__tests__/flag.test.ts` ≥ `1`
    - `grep -c "SEMANTIC_COUPLING_KEY" lib/__tests__/flag.test.ts` ≥ `2`
    - `grep -c "it(" lib/__tests__/flag.test.ts` ≥ `4`
    - `grep -c "toBe(false)" lib/__tests__/flag.test.ts` ≥ `2`
    - `grep -c "toBe(true)" lib/__tests__/flag.test.ts` ≥ `2`
    - **Commande de test verte** : `npx jest lib/__tests__/flag.test.ts --no-coverage` exit code 0
    - **Suite globale verte** : `npm test -- --no-coverage` exit code 0 (aucune régression des tests existants)
  </acceptance_criteria>
  <verify>
    <automated>npx jest lib/__tests__/flag.test.ts --no-coverage && npm test -- --no-coverage</automated>
  </verify>
  <done>flag.test.ts existe, ≥4 tests verts couvrant default off, set true, set false, round-trip ARCH-02 ; beforeEach isole le state mock ; npm test global reste vert.</done>
</task>

</tasks>

<verification>
- `npx jest lib/__tests__/derive.test.ts --no-coverage` → exit code 0, ≥20 tests verts.
- `npx jest lib/__tests__/flag.test.ts --no-coverage` → exit code 0, ≥4 tests verts.
- `npm test -- --no-coverage` → exit code 0 (aucune régression des tests existants).
- `npx tsc --noEmit` → aucune nouvelle erreur.
- Les 9 requirements SEMANTIC-01..05 + ARCH-02, ARCH-03 ont au moins 1 test démontrant le comportement attendu.
- SEMANTIC-01 couvert par tests filepath (rendez_vous, budget_admin, gratitude_famille, cuisine_repas, enfants_routines).
- SEMANTIC-02 couvert par tests section (bebe_soins, menage_quotidien, menage_hebdo) + normalisation accents.
- SEMANTIC-03 couvert par tests tag (courses, enfants_devoirs) + test de priorité.
- SEMANTIC-04 couvert par les 4 tests fallback null.
- SEMANTIC-05 + ARCH-02 couverts par flag.test.ts (default off, set/get, round-trip true↔false).
- ARCH-03 couvert implicitement par les tests fallback null : `deriveTaskCategory` retourne null sans lancer d'exception.
</verification>

<success_criteria>
- 2 fichiers de test créés : derive.test.ts (≥20 tests), flag.test.ts (≥4 tests).
- `npm test` global vert après l'ajout.
- Les 9 requirements ont une preuve comportementale par au moins 1 test unitaire.
- Aucune modification de `jest.config.js`, `package.json`, ou du code dans `lib/semantic/*` (si les tests échouent, corriger les tests ou signaler — ne pas modifier le module créé en 19-01 sans déclencher une révision).
- Le mock `expo-secure-store` existant est réutilisé sans modification.
</success_criteria>

<output>
After completion, create `.planning/phases/19-d-tection-cat-gorie-s-mantique/19-02-SUMMARY.md`
</output>
