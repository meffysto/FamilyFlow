---
phase: 19-d-tection-cat-gorie-s-mantique
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/semantic/categories.ts
  - lib/semantic/derive.ts
  - lib/semantic/flag.ts
  - lib/semantic/index.ts
autonomous: true
requirements:
  - SEMANTIC-01
  - SEMANTIC-02
  - SEMANTIC-03
  - SEMANTIC-04
  - SEMANTIC-05
  - ARCH-01
  - ARCH-02
  - ARCH-03
  - ARCH-04

must_haves:
  truths:
    - "deriveTaskCategory(task) retourne un CategoryMatch pour un tag connu (ex: tags=['budget'] → budget_admin via 'tag')"
    - "deriveTaskCategory(task) retourne un CategoryMatch pour une section connue (ex: section='Ménage hebdomadaire' → menage_hebdo via 'section')"
    - "deriveTaskCategory(task) retourne un CategoryMatch pour un filepath connu (ex: sourceFile='03 - Cuisine/Recettes/...' → cuisine_repas via 'filepath')"
    - "deriveTaskCategory(task) retourne null quand aucun signal ne matche"
    - "Priorité tag > section > filepath : une tâche qui matche les trois retourne matchedBy='tag'"
    - "isSemanticCouplingEnabled() retourne false par défaut (clé SecureStore absente)"
    - "setSemanticCouplingEnabled(true) puis isSemanticCouplingEnabled() retourne true"
  artifacts:
    - path: "lib/semantic/categories.ts"
      provides: "Type CategoryId (10 valeurs), type CategoryMatch, type SemanticCategory, constante CATEGORIES readonly"
      contains: "menage_quotidien"
    - path: "lib/semantic/derive.ts"
      provides: "Fonction pure deriveTaskCategory(task: Task): CategoryMatch | null + normalize() interne"
      exports: ["deriveTaskCategory"]
    - path: "lib/semantic/flag.ts"
      provides: "isSemanticCouplingEnabled / setSemanticCouplingEnabled via expo-secure-store, key 'semantic-coupling-enabled'"
      exports: ["isSemanticCouplingEnabled", "setSemanticCouplingEnabled"]
    - path: "lib/semantic/index.ts"
      provides: "Barrel export — ne ré-exporte PAS normalize"
      exports: ["deriveTaskCategory", "isSemanticCouplingEnabled", "setSemanticCouplingEnabled"]
  key_links:
    - from: "lib/semantic/derive.ts"
      to: "lib/semantic/categories.ts"
      via: "import { CATEGORIES, CategoryMatch, CategoryId }"
      pattern: "from ['\"]\\./categories['\"]"
    - from: "lib/semantic/flag.ts"
      to: "expo-secure-store"
      via: "import * as SecureStore"
      pattern: "expo-secure-store"
    - from: "lib/semantic/index.ts"
      to: "lib/semantic/derive.ts, lib/semantic/flag.ts, lib/semantic/categories.ts"
      via: "barrel re-exports"
      pattern: "export \\{.*deriveTaskCategory.*\\}"
---

<objective>
Livrer le module pur `lib/semantic/` (4 fichiers : `categories.ts`, `derive.ts`, `flag.ts`, `index.ts`) implémentant la détection sémantique de catégorie et le feature flag family-wide, en respectant strictement les décisions D-01 à D-08 du CONTEXT.md.

Purpose: Fournir à Phase 20 une API pure `deriveTaskCategory(task) → CategoryMatch | null` + helpers SecureStore pour activer/désactiver le couplage sémantique, sans aucun effet de bord ni câblage dans l'app existante (zéro régression garantie par non-consommation).

Output: 4 fichiers TypeScript dans `lib/semantic/`, aucun test dans ce plan (les tests sont livrés par le plan 19-02 qui dépend de celui-ci). `npx tsc --noEmit` doit passer sans nouvelle erreur.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/19-d-tection-cat-gorie-s-mantique/19-CONTEXT.md
@.planning/phases/19-d-tection-cat-gorie-s-mantique/19-RESEARCH.md
@lib/types.ts
@lib/parser.ts
@CLAUDE.md

<interfaces>
<!-- Contrats directement utilisables par l'exécuteur — pas besoin d'explorer le codebase. -->

Task type (lib/types.ts, champs utilisés par Phase 19) :
```typescript
interface Task {
  id: string;
  text: string;
  completed: boolean;
  tags: string[];          // SANS prefixe '#' (déjà stripé par TAG_REGEX dans parser.ts)
  mentions: string[];
  sourceFile: string;      // vault-relatif, ex: "02 - Maison/Tâches récurrentes.md"
  lineIndex: number;
  section?: string;        // H2/H3 header text, ex: "Ménage hebdomadaire"
  // autres champs optionnels non utilisés ici
}
```

expo-secure-store API utilisée :
```typescript
import * as SecureStore from 'expo-secure-store';
SecureStore.getItemAsync(key: string): Promise<string | null>
SecureStore.setItemAsync(key: string, value: string): Promise<void>
```

Pattern existant (contexts/ParentalControlsContext.tsx, contexts/ThemeContext.tsx) :
- Stockage string `'true'` / `'false'`, default off (clé absente → false)

Pattern module pur (lib/gamification/engine.ts) :
- Fonctions sync, aucun import vault.ts, aucun I/O, types + constantes + fonctions exportés via barrel
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Créer categories.ts — types + mapping table des 10 catégories</name>
  <files>lib/semantic/categories.ts</files>
  <read_first>
    - .planning/phases/19-d-tection-cat-gorie-s-mantique/19-CONTEXT.md (décisions D-01, D-02, D-08)
    - .planning/phases/19-d-tection-cat-gorie-s-mantique/19-RESEARCH.md (§"Vault Filepath Taxonomy", §"Real Section Names", §"Tag Extraction")
    - lib/types.ts (Task interface)
    - lib/parser.ts lignes 62-140 (TAG_REGEX, parseTask, section extraction)
    - lib/vault.ts (_maisonTasksContent, _childTasksContent pour vérifier arborescence vault réelle)
  </read_first>
  <behavior>
    - Le module exporte le type littéral `CategoryId` avec exactement 10 valeurs dans l'ordre D-08.
    - Le module exporte le type `CategoryMatch = { id: CategoryId; matchedBy: 'tag' | 'section' | 'filepath'; evidence: string }`.
    - Le module exporte le type `SemanticCategory = { id: CategoryId; labelFr: string; labelEn: string; filepathPatterns: string[]; sectionPatterns: string[]; tagPatterns: string[] }`.
    - Le module exporte `CATEGORIES: readonly SemanticCategory[]` avec exactement 10 entrées, une par CategoryId.
    - Chaque pattern string est déjà en forme normalisée (lowercase, sans accent) pour permettre comparaison directe après normalize() runtime.
    - Aucun import runtime (types only autorisés).
  </behavior>
  <action>
Créer `lib/semantic/categories.ts` avec le contenu suivant exact. Commentaires en français (convention projet, voir CLAUDE.md).

```typescript
// lib/semantic/categories.ts
// Mapping table des 10 catégories sémantiques v1.3 Seed (Phase 19).
// Décisions : D-01 (hardcoded, zéro dépendance), D-02 (priorité tag > section > filepath),
// D-08 (10 CategoryId canoniques alignés 1:1 avec EFFECTS-01..10 de Phase 20).
// ARCH-01 : aucun import vault.ts — module pur consommé uniquement par derive.ts.

/**
 * Identifiants canoniques des 10 catégories. L'ordre correspond à EFFECTS-01..10.
 * Ne JAMAIS renommer une valeur après livraison — Phase 20 dispatcher mappe dessus.
 */
export type CategoryId =
  | 'menage_quotidien'   // EFFECTS-01 — weeds removed
  | 'menage_hebdo'       // EFFECTS-02 — wear repair
  | 'courses'            // EFFECTS-03 — building turbo
  | 'enfants_routines'   // EFFECTS-04 — companion mood spike
  | 'enfants_devoirs'    // EFFECTS-05 — Growth Sprint
  | 'rendez_vous'        // EFFECTS-06 — rare seed drop
  | 'gratitude_famille'  // EFFECTS-07 — saga trait boost
  | 'budget_admin'       // EFFECTS-08 — building capacity ×2
  | 'bebe_soins'         // EFFECTS-09 — golden harvest ×3
  | 'cuisine_repas';     // EFFECTS-10 — rare craft recipe

/**
 * Résultat d'une détection réussie. `evidence` est la valeur BRUTE (non normalisée)
 * qui a matché — Phase 21 l'utilisera dans les toasts utilisateurs (D-04b).
 */
export type CategoryMatch = {
  id: CategoryId;
  matchedBy: 'tag' | 'section' | 'filepath';
  evidence: string;
};

/**
 * Une entrée de la table de mapping. Tous les patterns sont DÉJÀ normalisés
 * (lowercase + sans accent + trim) pour permettre une comparaison directe
 * après passage de l'entrée par normalize() dans derive.ts (D-03).
 */
export type SemanticCategory = {
  id: CategoryId;
  labelFr: string;
  labelEn: string;
  /** Premier segment de sourceFile après strip du préfixe "NN - ", normalisé (D-03b). */
  filepathPatterns: string[];
  /** Sous-chaînes cherchées via .includes() sur task.section normalisée (D-03c). */
  sectionPatterns: string[];
  /** Tags (sans '#') comparés via === après normalisation (D-03d). */
  tagPatterns: string[];
};

/**
 * Table des 10 catégories. Ordre important : lors d'une ambiguïté (ex : section
 * "quotidien" qui existe dans plusieurs catégories), la PREMIÈRE entrée dans
 * l'ordre ci-dessous qui matche gagne. Voir RESEARCH.md Pitfall 3.
 *
 * Stratégie de disambiguïsation filepath / section / tag :
 *  - `02 - Maison` : overlap menage_quotidien / menage_hebdo / courses → les tags
 *    `#courses` et les sections `menage` / `hebdomadaire` disambiguent ; le
 *    filepath `maison` retombe sur `menage_hebdo` (catégorie la plus commune).
 *  - `01 - Enfants` : overlap enfants_routines / enfants_devoirs / bebe_soins →
 *    les sections (`devoirs`, `biberons`, `couches`, `langer`, `tetine`)
 *    disambiguent ; le filepath `enfants` retombe sur `enfants_routines`.
 *  - Les autres dossiers (cuisine, rendez-vous, budget, memoires) sont 1:1.
 */
export const CATEGORIES: readonly SemanticCategory[] = [
  // --- Ordre priorité : spécifique avant générique ---
  {
    id: 'courses',
    labelFr: 'Courses',
    labelEn: 'Shopping',
    filepathPatterns: [],                       // disambiguïsation via tag/section uniquement
    sectionPatterns: ['courses', 'liste de courses', 'frais', 'fruits & legumes'],
    tagPatterns: ['courses', 'liste', 'shopping'],
  },
  {
    id: 'bebe_soins',
    labelFr: 'Soins bébé',
    labelEn: 'Baby care',
    filepathPatterns: [],                       // overlap enfants → section/tag disambigue
    sectionPatterns: ['bebe', 'soins', 'biberons', 'couches', 'langer', 'tetine'],
    tagPatterns: ['bebe', 'baby', 'biberon'],
  },
  {
    id: 'enfants_devoirs',
    labelFr: 'Devoirs enfants',
    labelEn: 'Homework',
    filepathPatterns: [],
    sectionPatterns: ['devoirs', 'scolaire', 'ecole', 'homework'],
    tagPatterns: ['devoirs', 'ecole', 'homework', 'scolaire'],
  },
  {
    id: 'menage_quotidien',
    labelFr: 'Ménage quotidien',
    labelEn: 'Daily housework',
    filepathPatterns: [],                       // priorité section pour séparer de hebdo
    sectionPatterns: ['quotidien', 'tous les 3 jours'],
    tagPatterns: ['menage_quotidien', 'quotidien'],
  },
  {
    id: 'menage_hebdo',
    labelFr: 'Ménage hebdomadaire',
    labelEn: 'Weekly cleaning',
    filepathPatterns: ['maison'],               // fallback large pour 02 - Maison (Pitfall 3)
    sectionPatterns: ['menage', 'hebdomadaire', 'mensuel'],
    tagPatterns: ['menage', 'menage_hebdo', 'nettoyage'],
  },
  {
    id: 'enfants_routines',
    labelFr: 'Routines enfants',
    labelEn: 'Child routines',
    filepathPatterns: ['enfants'],              // fallback large pour 01 - Enfants
    sectionPatterns: ['routine'],
    tagPatterns: ['routine', 'enfants'],
  },
  {
    id: 'cuisine_repas',
    labelFr: 'Cuisine & repas',
    labelEn: 'Cooking & meals',
    filepathPatterns: ['cuisine'],              // 03 - Cuisine → cuisine_repas (1:1)
    sectionPatterns: ['repas', 'cuisine', 'recettes', 'menu'],
    tagPatterns: ['cuisine', 'repas', 'recette', 'menu'],
  },
  {
    id: 'rendez_vous',
    labelFr: 'Rendez-vous',
    labelEn: 'Appointments',
    filepathPatterns: ['rendez-vous'],          // 04 - Rendez-vous → rendez_vous (1:1)
    sectionPatterns: ['rendez-vous', 'medical', 'sante'],
    tagPatterns: ['rdv', 'medical', 'sante', 'rendez-vous'],
  },
  {
    id: 'budget_admin',
    labelFr: 'Budget & admin',
    labelEn: 'Budget & admin',
    filepathPatterns: ['budget'],               // 05 - Budget → budget_admin (1:1)
    sectionPatterns: ['budget', 'admin', 'factures', 'impots'],
    tagPatterns: ['budget', 'admin', 'factures', 'impots'],
  },
  {
    id: 'gratitude_famille',
    labelFr: 'Gratitude & famille',
    labelEn: 'Gratitude & family',
    filepathPatterns: ['memoires'],             // 06 - Mémoires → gratitude_famille
    sectionPatterns: ['gratitude', 'famille', 'anniversaire'],
    tagPatterns: ['gratitude', 'famille', 'anniversaire'],
  },
];
```

Notes clefs :
- Respecter D-01 : zéro dépendance ajoutée, types only.
- Respecter D-08 : exactement les 10 IDs dans le type union.
- Respecter D-02 : l'ordre de CATEGORIES détermine qui gagne en cas de conflit intra-signal (les catégories plus spécifiques — courses, bebe_soins, enfants_devoirs — sont placées AVANT leurs fallbacks larges menage_hebdo / enfants_routines pour éviter Pitfall 3).
- Pattern strings déjà normalisés (sans accent, lowercase) — l'entrée sera normalisée à l'exécution, donc la comparaison sera directe.
  </action>
  <acceptance_criteria>
    - Fichier `lib/semantic/categories.ts` existe
    - `grep -c "export type CategoryId" lib/semantic/categories.ts` retourne `1`
    - `grep -c "export type CategoryMatch" lib/semantic/categories.ts` retourne `1`
    - `grep -c "export type SemanticCategory" lib/semantic/categories.ts` retourne `1`
    - `grep -c "export const CATEGORIES" lib/semantic/categories.ts` retourne `1`
    - Les 10 chaînes exactes `'menage_quotidien'`, `'menage_hebdo'`, `'courses'`, `'enfants_routines'`, `'enfants_devoirs'`, `'rendez_vous'`, `'gratitude_famille'`, `'budget_admin'`, `'bebe_soins'`, `'cuisine_repas'` apparaissent toutes dans le fichier : `grep -c "'menage_quotidien'\|'menage_hebdo'\|'courses'\|'enfants_routines'\|'enfants_devoirs'\|'rendez_vous'\|'gratitude_famille'\|'budget_admin'\|'bebe_soins'\|'cuisine_repas'" lib/semantic/categories.ts` ≥ 10
    - Aucun import runtime : `grep -E "^import " lib/semantic/categories.ts` retourne 0 lignes
    - `npx tsc --noEmit` ne produit aucune nouvelle erreur vs baseline
  </acceptance_criteria>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -c "lib/semantic/categories.ts" | grep -q "^0$"</automated>
  </verify>
  <done>Le fichier categories.ts existe, compile, exporte les 4 symboles (CategoryId, CategoryMatch, SemanticCategory, CATEGORIES) avec les 10 entrées ordonnées, zéro import runtime.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Créer derive.ts — fonction pure deriveTaskCategory + normalize interne</name>
  <files>lib/semantic/derive.ts</files>
  <read_first>
    - lib/semantic/categories.ts (fichier créé à la Task 1 — import CATEGORIES, CategoryMatch, SemanticCategory)
    - lib/types.ts (interface Task)
    - .planning/phases/19-d-tection-cat-gorie-s-mantique/19-CONTEXT.md (D-03a, D-03b, D-03c, D-03d, D-04a, D-04b, D-04c)
    - .planning/phases/19-d-tection-cat-gorie-s-mantique/19-RESEARCH.md (§"Pattern 1: Pure Function Module", Pitfalls 2-4)
  </read_first>
  <behavior>
    - `deriveTaskCategory(task: Task)` est synchrone, retourne `CategoryMatch | null`.
    - Ordre des signaux : tag (1er) > section (2e) > filepath (3e). Premier match gagne, signaux suivants ignorés.
    - Retour `null` si aucun signal ne matche aucune entrée de CATEGORIES.
    - `evidence` dans CategoryMatch est la valeur BRUTE (non normalisée) qui a matché : la string du tag originale, la string de section originale, le premier segment de sourceFile (avec préfixe "NN - ").
    - `normalize(str)` = `str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()`. Fonction NON exportée (détail d'implémentation, D-specifics).
    - Zéro import `vault.ts`, zéro I/O, zéro async, zéro console.log.
    - Tâche sans section : le bloc section est sauté sans erreur.
    - Tâche sans tags : le bloc tags est sauté sans erreur.
    - Filepath sans préfixe `NN - ` : utilise le segment tel quel après normalize.
    - Filepath à la racine du vault (sourceFile='fichier.md' sans `/`) : le split retourne `['fichier.md']`, aucun match, fallback null.
  </behavior>
  <action>
Créer `lib/semantic/derive.ts` avec le contenu suivant. Commentaires en français.

```typescript
// lib/semantic/derive.ts
// Fonction pure de détection sémantique — Phase 19 v1.3 Seed.
// Décisions : D-02 (ordre tag > section > filepath), D-03 (matching), D-04 (API).
// ARCH-01 : aucun import vault.ts, aucun I/O, aucun effet de bord.

import type { Task } from '../types';
import { CATEGORIES, type CategoryMatch } from './categories';

/**
 * Normalise une chaîne pour comparaison : strip accents (NFD), lowercase, trim.
 * NON exportée — c'est un détail d'implémentation interne (D-specifics).
 */
function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Détecte la catégorie sémantique d'une tâche selon l'ordre de priorité figé :
 *   1. tags (intention explicite utilisateur)
 *   2. section (contexte H2/H3)
 *   3. filepath (premier segment de sourceFile)
 *
 * Retourne `null` si aucun signal ne matche aucune des 10 catégories de
 * CATEGORIES — c'est le SEUL cas de fallback, Phase 20 traitera null comme
 * "standard XP, zéro effet" (ARCH-03 / SEMANTIC-04).
 *
 * Cette fonction est 100% pure : synchrone, sans I/O, sans lecture du flag
 * SecureStore. Le flag est vérifié par l'appelant (Phase 20), cf D-05d.
 */
export function deriveTaskCategory(task: Task): CategoryMatch | null {
  // 1. Tags — priorité maximale
  if (task.tags && task.tags.length > 0) {
    for (const tag of task.tags) {
      const normalizedTag = normalize(tag);
      for (const category of CATEGORIES) {
        if (category.tagPatterns.includes(normalizedTag)) {
          return {
            id: category.id,
            matchedBy: 'tag',
            evidence: tag, // valeur brute (D-04b)
          };
        }
      }
    }
  }

  // 2. Section — priorité moyenne, matching par includes()
  if (task.section) {
    const normalizedSection = normalize(task.section);
    for (const category of CATEGORIES) {
      for (const pattern of category.sectionPatterns) {
        if (normalizedSection.includes(pattern)) {
          return {
            id: category.id,
            matchedBy: 'section',
            evidence: task.section, // valeur brute (D-04b)
          };
        }
      }
    }
  }

  // 3. Filepath — priorité minimale, premier segment strippé du préfixe "NN - "
  if (task.sourceFile) {
    const firstSegment = task.sourceFile.split('/')[0];
    // Strip préfixe "NN - " ou "NN-" (voir D-03b et vault.ts)
    const stripped = firstSegment.replace(/^\d+\s*-\s*/, '');
    const normalizedPath = normalize(stripped);
    for (const category of CATEGORIES) {
      if (category.filepathPatterns.includes(normalizedPath)) {
        return {
          id: category.id,
          matchedBy: 'filepath',
          evidence: firstSegment, // valeur brute avec préfixe (D-04b)
        };
      }
    }
  }

  // Aucun signal reconnu : fallback standard XP (ARCH-03)
  return null;
}
```

Notes :
- Respect strict D-04a : signature synchrone pure `(task: Task) => CategoryMatch | null`.
- Respect strict D-04b : `evidence` = valeur brute (tag original, section originale, firstSegment avec préfixe `NN - `).
- normalize() non exportée — détail d'implémentation.
- Les garde-boucles sur `task.tags && task.tags.length > 0` et `task.section` gèrent les Task sans tags/section.
- Aucune dépendance externe hors `./categories` et `../types`.
  </action>
  <acceptance_criteria>
    - Fichier `lib/semantic/derive.ts` existe
    - `grep -c "export function deriveTaskCategory" lib/semantic/derive.ts` retourne `1`
    - `grep -c "function normalize" lib/semantic/derive.ts` retourne `1`
    - `grep -c "export function normalize\|export.*normalize" lib/semantic/derive.ts` retourne `0` (normalize NON exporté)
    - `grep -c "async" lib/semantic/derive.ts` retourne `0` (100% synchrone)
    - `grep -c "from '\\.\\./vault'\|from '\\.\\./parser'\|SecureStore\|expo-secure-store" lib/semantic/derive.ts` retourne `0` (pas d'I/O, pas de vault)
    - `grep -c "matchedBy: 'tag'" lib/semantic/derive.ts` retourne `1`
    - `grep -c "matchedBy: 'section'" lib/semantic/derive.ts` retourne `1`
    - `grep -c "matchedBy: 'filepath'" lib/semantic/derive.ts` retourne `1`
    - `grep -c "return null" lib/semantic/derive.ts` ≥ `1`
    - `grep -c "NFD" lib/semantic/derive.ts` retourne `1`
    - `grep -E "\\\\u0300-\\\\u036f" lib/semantic/derive.ts` trouve au moins 1 match (regex strip accents)
    - `npx tsc --noEmit` ne produit aucune nouvelle erreur imputable à `lib/semantic/derive.ts`
  </acceptance_criteria>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -c "lib/semantic/derive.ts" | grep -q "^0$"</automated>
  </verify>
  <done>derive.ts compile, exporte deriveTaskCategory (sync pure), normalize est interne, zéro import vault/SecureStore, ordre tag > section > filepath implémenté, evidence = valeur brute.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Créer flag.ts + index.ts (barrel) — feature flag SecureStore + exports publics</name>
  <files>lib/semantic/flag.ts, lib/semantic/index.ts</files>
  <read_first>
    - .planning/phases/19-d-tection-cat-gorie-s-mantique/19-CONTEXT.md (D-05a, D-05b, D-05c, D-05d)
    - .planning/phases/19-d-tection-cat-gorie-s-mantique/19-RESEARCH.md (§"Pattern 2: SecureStore Flag Helper")
    - contexts/ParentalControlsContext.tsx (pattern existant SecureStore.getItemAsync/setItemAsync)
    - lib/gamification/index.ts (pattern barrel file existant)
    - lib/semantic/derive.ts (créé à la Task 2)
    - lib/semantic/categories.ts (créé à la Task 1)
  </read_first>
  <behavior>
    - `flag.ts` : constante `SEMANTIC_COUPLING_KEY = 'semantic-coupling-enabled'`.
    - `isSemanticCouplingEnabled(): Promise<boolean>` → lit SecureStore, retourne `val === 'true'`. Clé absente OU valeur `'false'` OU valeur inattendue → retourne `false` (default off).
    - `setSemanticCouplingEnabled(enabled: boolean): Promise<void>` → écrit la chaîne `'true'` ou `'false'` via SecureStore.setItemAsync.
    - `flag.ts` n'importe PAS `derive.ts` ni `categories.ts` (séparation isolation I/O).
    - `index.ts` barrel : exporte `deriveTaskCategory`, `isSemanticCouplingEnabled`, `setSemanticCouplingEnabled` + types `CategoryId`, `CategoryMatch`, `SemanticCategory`. NE PAS exporter `normalize` ni `CATEGORIES` (détails d'implémentation).
  </behavior>
  <action>
**Créer `lib/semantic/flag.ts`** :

```typescript
// lib/semantic/flag.ts
// Feature flag family-wide du couplage sémantique (SEMANTIC-05 / ARCH-02).
// Décisions : D-05a (clé SecureStore globale), D-05b (pas par-profil),
// D-05c (helpers async), D-05d (vérifié par l'appelant, pas dans deriveTaskCategory).
//
// Default OFF : si la clé est absente, isSemanticCouplingEnabled() retourne false.
// Stockage string 'true'/'false' pour simplicité (cohérent ParentalControls).

import * as SecureStore from 'expo-secure-store';

/** Clé SecureStore globale (famille-wide, pas par-profil — D-05b). */
export const SEMANTIC_COUPLING_KEY = 'semantic-coupling-enabled';

/**
 * Retourne l'état actuel du flag. Default `false` si la clé est absente,
 * si la valeur lue est `'false'`, ou si la valeur est inattendue.
 * SEMANTIC-05 / ARCH-02 : garantit qu'un reset à `false` désactive
 * instantanément tout le couplage (Phase 20 appelle cette fonction à
 * chaque task completion).
 */
export async function isSemanticCouplingEnabled(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(SEMANTIC_COUPLING_KEY);
    return val === 'true';
  } catch {
    // SecureStore indisponible → fallback sûr : off (ARCH-03)
    return false;
  }
}

/**
 * Persiste l'état du flag. Écrit la chaîne 'true' ou 'false'.
 * Sera appelé par l'écran Réglages Couplage sémantique (Phase 22).
 */
export async function setSemanticCouplingEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(
    SEMANTIC_COUPLING_KEY,
    enabled ? 'true' : 'false',
  );
}
```

**Créer `lib/semantic/index.ts`** (barrel — convention projet `lib/gamification/index.ts`) :

```typescript
// lib/semantic/index.ts
// Barrel public du module de détection sémantique — Phase 19 v1.3 Seed.
// Consommé (plus tard) par Phase 20 dispatcher applyTaskEffect() uniquement.
//
// IMPORTANT : ne PAS ré-exporter `normalize` (détail d'implémentation dans
// derive.ts) ni `CATEGORIES` (mapping interne). Les consommateurs n'ont besoin
// que de la fonction publique et des helpers flag.

export { deriveTaskCategory } from './derive';
export {
  isSemanticCouplingEnabled,
  setSemanticCouplingEnabled,
  SEMANTIC_COUPLING_KEY,
} from './flag';
export type {
  CategoryId,
  CategoryMatch,
  SemanticCategory,
} from './categories';
```

Notes :
- Respect strict D-05a : clé exactement `'semantic-coupling-enabled'`.
- Respect strict D-05b : une seule clé globale, pas de suffixe profileId.
- Respect strict D-05c : deux helpers async, signature exacte.
- Respect strict D-05d : flag.ts et derive.ts sont indépendants — derive.ts n'importe PAS flag.ts.
- try/catch dans `isSemanticCouplingEnabled` → fallback sûr off si SecureStore plante (defensive + ARCH-03).
- `SEMANTIC_COUPLING_KEY` exportée pour permettre aux tests (plan 19-02) de nettoyer la clé via `SecureStore.deleteItemAsync(SEMANTIC_COUPLING_KEY)`.
  </action>
  <acceptance_criteria>
    - Fichier `lib/semantic/flag.ts` existe
    - Fichier `lib/semantic/index.ts` existe
    - `grep -c "SEMANTIC_COUPLING_KEY = 'semantic-coupling-enabled'" lib/semantic/flag.ts` retourne `1`
    - `grep -c "export async function isSemanticCouplingEnabled" lib/semantic/flag.ts` retourne `1`
    - `grep -c "export async function setSemanticCouplingEnabled" lib/semantic/flag.ts` retourne `1`
    - `grep -c "val === 'true'" lib/semantic/flag.ts` retourne `1`
    - `grep -c "from 'expo-secure-store'" lib/semantic/flag.ts` retourne `1`
    - `grep -c "./derive\|./categories" lib/semantic/flag.ts` retourne `0` (flag isolé)
    - `grep -c "deriveTaskCategory" lib/semantic/index.ts` retourne `1`
    - `grep -c "isSemanticCouplingEnabled" lib/semantic/index.ts` retourne `1`
    - `grep -c "setSemanticCouplingEnabled" lib/semantic/index.ts` retourne `1`
    - `grep -c "normalize" lib/semantic/index.ts` retourne `0` (normalize non exporté)
    - `grep -c "CATEGORIES" lib/semantic/index.ts` retourne `0` (mapping non exporté)
    - `grep -c "CategoryMatch\|CategoryId\|SemanticCategory" lib/semantic/index.ts` ≥ `3`
    - `npx tsc --noEmit` ne produit aucune nouvelle erreur imputable à lib/semantic/flag.ts ou lib/semantic/index.ts
  </acceptance_criteria>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "lib/semantic/(flag|index)\.ts" | grep -v "^$" | wc -l | tr -d ' ' | grep -q "^0$"</automated>
  </verify>
  <done>flag.ts + index.ts compilent, le barrel expose exactement deriveTaskCategory + 2 helpers flag + 3 types, normalize/CATEGORIES restent internes, flag.ts n'importe ni derive.ts ni categories.ts.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` : aucune nouvelle erreur TypeScript vs baseline (erreurs pré-existantes dans MemoryEditor.tsx, cooklang.ts, useVault.ts à ignorer per CLAUDE.md).
- Les 4 fichiers `lib/semantic/{categories,derive,flag,index}.ts` existent et compilent.
- Aucun import depuis `lib/vault.ts` dans le module entier : `grep -r "from '.*vault'" lib/semantic/ | wc -l` retourne 0.
- Aucun import cyclique (derive → categories OK, flag isolé, index re-exporte uniquement).
- Aucune nouvelle dépendance npm : `git diff package.json` ne montre aucune modification (ARCH-04).
- Le module n'est importé NULLE PART dans l'app existante (Phase 19 livre un module dormant consommé par Phase 20) : `grep -r "from '.*lib/semantic'" app hooks components contexts lib --exclude-dir=semantic` retourne 0.
</verification>

<success_criteria>
- 4 fichiers créés : categories.ts (types + CATEGORIES readonly × 10), derive.ts (deriveTaskCategory pur + normalize interne), flag.ts (2 helpers SecureStore + clé globale), index.ts (barrel sélectif).
- tsc --noEmit passe sans nouvelle erreur.
- Aucune modification de package.json, de jest.config.js, ni d'aucun fichier hors `lib/semantic/`.
- Module prêt à être testé par le plan 19-02 (qui dépend de ce plan).
- Les 9 requirements (SEMANTIC-01..05, ARCH-01..04) sont IMPLÉMENTÉS par le code (validation comportementale = plan 19-02 via Jest).
</success_criteria>

<output>
After completion, create `.planning/phases/19-d-tection-cat-gorie-s-mantique/19-01-SUMMARY.md`
</output>
