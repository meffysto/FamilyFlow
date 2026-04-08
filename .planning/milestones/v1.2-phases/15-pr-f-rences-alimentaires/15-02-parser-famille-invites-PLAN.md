---
phase: 15-pr-f-rences-alimentaires
plan: 02
type: execute
wave: 2
depends_on: [15-01]
files_modified:
  - lib/types.ts
  - lib/parser.ts
  - lib/__tests__/parser-extended.test.ts
autonomous: true
requirements: [PREF-02, PREF-05, PREF-06]

must_haves:
  truths:
    - "parseFamille lit les 4 clés food_* depuis famille.md et les retourne dans Profile"
    - "serializeFamille écrit les 4 clés food_* en CSV quand non-vide, sinon les omet"
    - "Un famille.md sans clés food_* parse sans crash (PREF-05)"
    - "Un round-trip parse → serialize → parse préserve intégralement les food_*"
    - "parseInvites lit 02 - Famille/Invités.md et retourne GuestProfile[]"
    - "serializeInvites produit un fichier valide avec sections H2 par invité"
  artifacts:
    - path: "lib/types.ts"
      provides: "Profile étendu avec foodAllergies/foodIntolerances/foodRegimes/foodAversions"
      contains: "foodAllergies"
    - path: "lib/parser.ts"
      provides: "parseFamille étendu + parseInvites + serializeInvites + constante INVITES_FILE"
      exports: ["parseFamille", "serializeFamille", "parseInvites", "serializeInvites", "INVITES_FILE"]
    - path: "lib/__tests__/parser-extended.test.ts"
      provides: "Tests round-trip food_* + tolérance absence + parseInvites"
      contains: "food_allergies"
  key_links:
    - from: "lib/parser.ts parseFamille"
      to: "lib/types.ts Profile"
      via: "champs foodAllergies/foodIntolerances/foodRegimes/foodAversions"
      pattern: "foodAllergies.*split"
---

<objective>
Étendre le modèle de données `Profile` avec les 4 clés `food_*` et créer le parser dédié pour `02 - Famille/Invités.md`. Garantir la compatibilité bidirectionnelle Obsidian (PREF-05) via tests round-trip.

Purpose: Toute la persistance des préférences alimentaires repose sur ce parser. La sécurité PREF-05 est vérifiée par test.
Output: parseFamille/serializeFamille étendus, parseInvites/serializeInvites créés, tests passants.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/15-pr-f-rences-alimentaires/15-CONTEXT.md
@.planning/phases/15-pr-f-rences-alimentaires/15-RESEARCH.md
@lib/dietary/types.ts
@lib/types.ts
@CLAUDE.md

<interfaces>
<!-- Pattern parseFamille existant à étendre -->
From lib/parser.ts ligne 672:
```typescript
export function parseFamille(content: string): Omit<Profile, 'points' | 'coins' | 'level' | 'streak' | 'lootBoxesAvailable' | 'multiplier' | 'multiplierRemaining' | 'pityCounter'>[]
```
Pattern CSV déjà utilisé : `farmCrops?: string` (ligne 83 types.ts).

<!-- GuestProfile contract (créé en Plan 01) -->
From lib/dietary/types.ts:
```typescript
export interface GuestProfile {
  id: string;
  name: string;
  foodAllergies: string[];
  foodIntolerances: string[];
  foodRegimes: string[];
  foodAversions: string[];
}
```

<!-- Pattern wishlist à imiter pour parseInvites -->
Pattern : sections H2 (## Nom) avec props key: value sous chaque section.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Tâche 1: Étendre Profile + parseFamille + serializeFamille avec food_*</name>
  <files>lib/types.ts, lib/parser.ts, lib/__tests__/parser-extended.test.ts</files>
  <read_first>
    - lib/types.ts lignes 67-120 (interface Profile existante)
    - lib/parser.ts lignes 670-920 (parseFamille + serializeFamille actuels)
    - lib/__tests__/parser-extended.test.ts (pattern des tests existants)
    - .planning/phases/15-pr-f-rences-alimentaires/15-RESEARCH.md Pattern 1
  </read_first>
  <behavior>
    - Test 1 (RED): `parseFamille` d'un fichier contenant `food_allergies: gluten,arachides` retourne profile avec `foodAllergies: ['gluten', 'arachides']`
    - Test 2 (RED): `parseFamille` d'un fichier SANS aucune clé food_* ne crash pas et retourne `foodAllergies: []`, `foodIntolerances: []`, `foodRegimes: []`, `foodAversions: []`
    - Test 3 (RED): Round-trip `parseFamille → serializeFamille → parseFamille` préserve les 4 tableaux food_* à l'identique
    - Test 4 (RED): `serializeFamille` OMET la clé `food_allergies` si `foodAllergies` est `[]` (lisibilité Obsidian)
    - Test 5 (RED): `parseFamille` tolère le format YAML liste (`food_allergies:\n  - gluten\n  - lait`) en plus du CSV — retourne le même résultat
  </behavior>
  <action>
    1. Dans `lib/types.ts`, ajouter 4 champs optionnels à `interface Profile` juste après `giftsSentToday?: string;` :
    ```typescript
    foodAllergies?: string[];      // PREF-02 : IDs canoniques EU_ALLERGENS ou texte libre
    foodIntolerances?: string[];   // PREF-02 : IDs COMMON_INTOLERANCES ou texte libre
    foodRegimes?: string[];        // PREF-02 : IDs COMMON_REGIMES ou texte libre
    foodAversions?: string[];      // PREF-02 : texte libre uniquement (pas de catalogue)
    ```

    2. Dans `lib/parser.ts > parseFamille` (ligne ~672), au moment du flush vers `profiles.push({...})`, ajouter :
    ```typescript
    foodAllergies: parseFoodCsv(currentProps.food_allergies),
    foodIntolerances: parseFoodCsv(currentProps.food_intolerances),
    foodRegimes: parseFoodCsv(currentProps.food_regimes),
    foodAversions: parseFoodCsv(currentProps.food_aversions),
    ```
    Et créer un helper local `parseFoodCsv` (en haut du fichier parser.ts ou juste avant parseFamille) :
    ```typescript
    function parseFoodCsv(raw: unknown): string[] {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.map(v => String(v).trim()).filter(Boolean);
      if (typeof raw === 'string') return raw.split(',').map(s => s.trim()).filter(Boolean);
      return [];
    }
    ```
    Cela gère le format CSV ET le format YAML liste (pitfall 6 du RESEARCH.md).

    3. Dans `serializeFamille` (ligne ~852), pour chaque profil, écrire les 4 clés UNIQUEMENT si non-vides :
    ```typescript
    if (profile.foodAllergies && profile.foodAllergies.length > 0) {
      lines.push(`food_allergies: ${profile.foodAllergies.join(',')}`);
    }
    // répéter pour foodIntolerances / foodRegimes / foodAversions
    ```
    Respecter l'ordre d'insertion existant dans serializeFamille (cohérence avec les autres clés plates).

    4. Dans `lib/__tests__/parser-extended.test.ts`, ajouter un bloc `describe('parseFamille food_* preferences', ...)` avec les 5 tests du <behavior>.

    Commentaires en français. Pas de hardcoded colors (hors scope ici). Ne toucher aucun autre champ de Profile.
  </action>
  <verify>
    <automated>npx jest lib/__tests__/parser-extended.test.ts -t "food_" &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "foodAllergies?: string\[\]" lib/types.ts`
    - `grep -q "foodIntolerances?: string\[\]" lib/types.ts`
    - `grep -q "foodRegimes?: string\[\]" lib/types.ts`
    - `grep -q "foodAversions?: string\[\]" lib/types.ts`
    - `grep -q "function parseFoodCsv" lib/parser.ts`
    - `grep -q "food_allergies:" lib/parser.ts` (dans serializeFamille)
    - `grep -q "food_allergies" lib/__tests__/parser-extended.test.ts`
    - `npx jest lib/__tests__/parser-extended.test.ts -t "food_"` passe (5 nouveaux tests)
    - `npx tsc --noEmit` passe
  </acceptance_criteria>
  <done>Profile étendu, parser tolérant CSV+YAML, 5 tests round-trip passent, tsc passe</done>
</task>

<task type="auto" tdd="true">
  <name>Tâche 2: Créer parseInvites + serializeInvites + INVITES_FILE</name>
  <files>lib/parser.ts, lib/__tests__/parser-extended.test.ts</files>
  <read_first>
    - lib/parser.ts (chercher pattern wishlist : `WISHLIST_FILE`, `parseWishlist`, `serializeWishlist`)
    - lib/dietary/types.ts (GuestProfile)
    - .planning/phases/15-pr-f-rences-alimentaires/15-RESEARCH.md Pattern 2
  </read_first>
  <behavior>
    - Test 1: `parseInvites` d'un fichier vide retourne `[]`
    - Test 2: `parseInvites` d'un fichier avec 2 sections H2 retourne 2 GuestProfile avec leur name et leurs food_*
    - Test 3: Round-trip `parseInvites → serializeInvites → parseInvites` préserve les données
    - Test 4: `serializeInvites` produit un fichier avec `## {name}` par invité et omet les clés food_* vides
  </behavior>
  <action>
    Dans `lib/parser.ts`, ajouter :

    1. Constante : `export const INVITES_FILE = '02 - Famille/Invités.md';`

    2. Fonction `export function parseInvites(content: string): GuestProfile[]` (import type depuis `./dietary/types`) :
       - Parcourir le contenu ligne par ligne
       - Une section H2 `## Nom` démarre un nouvel invité
       - Les lignes `key: value` sous chaque section alimentent les champs
       - Les clés reconnues : `name` (optionnel, fallback = titre H2), `food_allergies`, `food_intolerances`, `food_regimes`, `food_aversions`
       - L'ID est généré depuis le nom (slugify : lowercase, remplacer espaces et accents par `_`). Si collision, suffixer par `_2`, `_3`...
       - Utiliser le helper `parseFoodCsv` créé en tâche 1 pour les 4 clés food_*

    3. Fonction `export function serializeInvites(guests: GuestProfile[]): string` :
       - Header : `# Invités récurrents\n\n`
       - Pour chaque invité : `## {name}\n` puis les clés food_* non-vides en `key: value`, CSV join
       - Séparer chaque invité par une ligne vide

    4. Dans `lib/__tests__/parser-extended.test.ts`, ajouter `describe('parseInvites / serializeInvites', ...)` avec les 4 tests du <behavior>.

    Commentaires en français. Noms génériques dans les tests (Lucas, Emma, Dupont — per CLAUDE.md).
  </action>
  <verify>
    <automated>npx jest lib/__tests__/parser-extended.test.ts -t "parseInvites" &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export const INVITES_FILE = '02 - Famille/Invités.md'" lib/parser.ts`
    - `grep -q "export function parseInvites" lib/parser.ts`
    - `grep -q "export function serializeInvites" lib/parser.ts`
    - `grep -q "parseInvites" lib/__tests__/parser-extended.test.ts`
    - `npx jest lib/__tests__/parser-extended.test.ts -t "parseInvites"` : 4 tests passent
    - `npx tsc --noEmit` passe
  </acceptance_criteria>
  <done>Parser/serializer invités créés et testés (round-trip), constante exportée, tsc passe</done>
</task>

</tasks>

<verification>
- Tests `npx jest lib/__tests__/parser-extended.test.ts -t "food_"` passent (5 tests)
- Tests `npx jest lib/__tests__/parser-extended.test.ts -t "parseInvites"` passent (4 tests)
- Un `famille.md` sans aucune clé food_* ne crash pas le parser (PREF-05 validé)
- `npx tsc --noEmit` passe
</verification>

<success_criteria>
Le modèle Profile et le parser peuvent persister et relire les 4 clés food_* dans famille.md ET un fichier Invités.md dédié. La compatibilité Obsidian bidirectionnelle est garantie par tests round-trip (CSV + YAML liste).
</success_criteria>

<output>
`.planning/phases/15-pr-f-rences-alimentaires/15-02-SUMMARY.md`
</output>
