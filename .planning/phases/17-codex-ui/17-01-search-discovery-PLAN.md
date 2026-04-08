---
phase: 17-codex-ui
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/codex/search.ts
  - lib/codex/discovery.ts
autonomous: true
requirements:
  - CODEX-08
must_haves:
  truths:
    - "Une recherche textuelle sur 'épinard' matche 'Épinards' et 'epinards' (accents + casse)"
    - "computeDiscoveredCodexIds retourne un Set<string> des sourceId découverts du profil actif"
    - "searchCodex et computeDiscoveredCodexIds sont des fonctions pures sans dépendance React"
  artifacts:
    - path: "lib/codex/search.ts"
      provides: "normalize(), searchCodex(query, t, entries)"
      exports: ["normalize", "searchCodex"]
    - path: "lib/codex/discovery.ts"
      provides: "computeDiscoveredCodexIds(profile)"
      exports: ["computeDiscoveredCodexIds"]
  key_links:
    - from: "lib/codex/search.ts"
      to: "lib/codex/types.ts"
      via: "import type { CodexEntry }"
      pattern: "from ['\"].*codex/types"
---

<objective>
Créer les deux helpers pures qui alimentent FarmCodexModal (Plan 17-03) : recherche normalisée cross-catégories et calcul lazy des entrées découvertes. Zéro dépendance UI, testable à la main via tsc. Implémente la moitié de CODEX-08 (pattern normalisation) — le câblage UI final est dans 17-03.

Purpose: Isoler la logique métier du codex dans lib/ pour respecter la séparation UI / logique du projet, permettre la réutilisation et faciliter toute future évolution.
Output: lib/codex/search.ts + lib/codex/discovery.ts compilables avec tsc --noEmit.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/17-codex-ui/17-CONTEXT.md
@lib/codex/types.ts
@lib/codex/content.ts

<interfaces>
From lib/codex/types.ts (Phase 16):
```typescript
export type CodexKind = 'crop' | 'animal' | 'building' | 'craft' | 'tech' | 'companion' | 'loot' | 'seasonal' | 'saga' | 'quest';
export interface CodexEntryBase {
  id: string;
  kind: CodexKind;
  sourceId: string;
  nameKey: string;
  loreKey: string;
  iconRef?: string;
}
export interface AnimalEntry extends CodexEntryBase {
  kind: 'animal';
  subgroup: 'farm' | 'fantasy' | 'saga';
  dropOnly: boolean;
}
// Union discriminée CodexEntry exportée
```

From lib/codex/content.ts (Phase 16):
```typescript
export const CODEX_CONTENT: CodexEntry[]; // 110 entrées agrégées
```

From contexts/VaultContext.tsx — profil actif shape (partial):
```typescript
interface Profile {
  id: string;
  farmInventory?: { oeuf: number; lait: number; farine: number; miel: number };
  farmCrops?: Array<{ cropId: string; ... }>;
  harvestInventory?: Record<string, number>; // cropId → count
  farmAnimals?: Array<{ animalId: string; ... }>;
  farmBuildings?: Array<string | { buildingId: string }>;
  completedSagas?: string[]; // saga IDs complétées
}
```
</interfaces>
</context>

<tasks>

<!--
  Convention acceptance_criteria grep :
  - `retourne 0` = match trouvé (OK si la présence est attendue)
  - `retourne 1` = pas de match (OK si l'absence est attendue)
-->

<task type="auto">
  <name>Task 1: Créer lib/codex/search.ts avec normalize + searchCodex</name>
  <files>lib/codex/search.ts</files>
  <read_first>
    - lib/codex/types.ts (pour importer CodexEntry)
    - lib/codex/content.ts (pour comprendre la shape du dataset)
    - lib/search.ts lignes 45-70 (pattern normalize existant à DUPLIQUER, NE PAS exporter depuis lib/search.ts — D-09)
    - .planning/phases/17-codex-ui/17-CONTEXT.md décisions D-08, D-09, D-10
  </read_first>
  <action>
    Créer un nouveau fichier `lib/codex/search.ts`. Ne PAS modifier lib/search.ts (décision D-09).

    Contenu exact attendu :

    ```typescript
    // lib/codex/search.ts — Recherche normalisée pour le codex ferme (Phase 17, per D-08/D-09/D-10)
    //
    // Helper isolé : normalize() est volontairement dupliqué de lib/search.ts:52 pour éviter
    // d'exporter un symbole hors-scope (D-09). Logique identique : NFD + lowercase + trim.

    import type { CodexEntry } from './types';

    /**
     * Normalise une chaîne pour comparaison insensible aux accents et à la casse.
     * Duplication volontaire de lib/search.ts (per D-09) — ne pas factoriser.
     */
    export function normalize(input: string): string {
      return input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    }

    /**
     * Filtre CODEX_CONTENT par query texte libre.
     * Match sur t(nameKey) + t(loreKey) de la langue active (D-10).
     * Retourne toutes les entrées si query vide/whitespace.
     *
     * @param query - texte utilisateur brut
     * @param t - fonction i18next (passée par l'appelant pour éviter de coupler lib/ à React)
     * @param entries - dataset à filtrer (généralement CODEX_CONTENT)
     */
    export function searchCodex(
      query: string,
      t: (key: string) => string,
      entries: CodexEntry[],
    ): CodexEntry[] {
      const normalized = normalize(query);
      if (normalized.length === 0) return entries;

      return entries.filter((entry) => {
        const name = normalize(t(entry.nameKey));
        const lore = normalize(t(entry.loreKey));
        return name.includes(normalized) || lore.includes(normalized);
      });
    }

    /**
     * Filtre des entrées par kind (catégorie active dans les tabs).
     * Utile quand query vide et tab active sélectionnée.
     */
    export function filterByKind(
      entries: CodexEntry[],
      kind: CodexEntry['kind'],
    ): CodexEntry[] {
      return entries.filter((entry) => entry.kind === kind);
    }
    ```

    Contraintes :
    - Pas d'import React, pas d'import i18next directement — `t` est injecté par l'appelant
    - Fonction `normalize` exportée (consommée par 17-03 pour normaliser le placeholder/empty state si besoin)
    - Pas d'import de lib/search.ts (D-09)
    - Commentaires en français (convention CLAUDE.md)
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "lib/codex/search\.ts" ; test -f lib/codex/search.ts</automated>
  </verify>
  <acceptance_criteria>
    - Fichier `lib/codex/search.ts` existe
    - `grep -q "export function normalize" lib/codex/search.ts` retourne 0
    - `grep -q "export function searchCodex" lib/codex/search.ts` retourne 0
    - `grep -q "export function filterByKind" lib/codex/search.ts` retourne 0
    - `grep -q "from '\.\./search'" lib/codex/search.ts` retourne 1 (PAS d'import depuis lib/search.ts)
    - `grep -q "NFD" lib/codex/search.ts` retourne 0 (pattern présent)
    - `npx tsc --noEmit` ne produit AUCUNE nouvelle erreur dans lib/codex/search.ts
  </acceptance_criteria>
  <done>
    Fichier créé, 3 fonctions exportées, tsc --noEmit clean sur ce fichier, zero import de lib/search.ts.
  </done>
</task>

<task type="auto">
  <name>Task 2: Créer lib/codex/discovery.ts avec computeDiscoveredCodexIds</name>
  <files>lib/codex/discovery.ts</files>
  <read_first>
    - lib/codex/types.ts (pour CodexEntry discriminated union)
    - lib/codex/content.ts (pour voir exactes shapes de CODEX_CONTENT)
    - contexts/VaultContext.tsx (pour type Profile / shape farmInventory, farmCrops, harvestInventory, completedSagas — lire lignes 1-100 pour imports et type)
    - .planning/phases/17-codex-ui/17-CONTEXT.md décision D-06 (calcul lazy, PAS de nouveau champ persisté)
  </read_first>
  <action>
    Créer un nouveau fichier `lib/codex/discovery.ts`. Fonction pure qui construit un `Set<string>` des sourceId découverts par le profil actif.

    Contenu exact attendu :

    ```typescript
    // lib/codex/discovery.ts — Calcul lazy des entrées codex découvertes (Phase 17, per D-06)
    //
    // Appelé à l'ouverture de FarmCodexModal pour déterminer quelles entrées dropOnly
    // doivent s'afficher en silhouette. AUCUN nouveau champ persisté dans farm-{profileId}.md
    // (D-06) : on dérive l'état à la volée depuis farmInventory / harvestInventory / farmAnimals
    // / farmCrops / completedSagas. Trade-off accepté (D-07) : consommer une orchidée peut
    // la re-silhouetter tant que le cache local n'est pas recomputé.

    /**
     * Shape minimale du profil dont on a besoin pour calculer la découverte codex.
     * On ne prend pas `Profile` complet pour garder cette fonction pure et testable.
     */
    export interface DiscoverySource {
      farmInventory?: Record<string, number> | null;
      harvestInventory?: Record<string, number> | null;
      farmCrops?: Array<{ cropId?: string } | string> | null;
      farmAnimals?: Array<{ animalId?: string } | string> | null;
      farmBuildings?: Array<{ buildingId?: string } | string> | null;
      completedSagas?: string[] | null;
    }

    /**
     * Retourne l'ensemble des sourceId découverts par le profil.
     * Compare contre `entry.sourceId` dans FarmCodexModal :
     *   const isDiscovered = !entry.dropOnly || discoveredIds.has(entry.sourceId);
     */
    export function computeDiscoveredCodexIds(source: DiscoverySource | null | undefined): Set<string> {
      const ids = new Set<string>();
      if (!source) return ids;

      // 1. farmInventory (resources : oeuf, lait, farine, miel)
      if (source.farmInventory) {
        for (const [key, value] of Object.entries(source.farmInventory)) {
          if (typeof value === 'number' && value > 0) ids.add(key);
        }
      }

      // 2. harvestInventory (crops récoltés : cropId → count)
      if (source.harvestInventory) {
        for (const [cropId, count] of Object.entries(source.harvestInventory)) {
          if (typeof count === 'number' && count > 0) ids.add(cropId);
        }
      }

      // 3. farmCrops (crops actuellement plantés)
      if (Array.isArray(source.farmCrops)) {
        for (const crop of source.farmCrops) {
          if (typeof crop === 'string') ids.add(crop);
          else if (crop && typeof crop.cropId === 'string') ids.add(crop.cropId);
        }
      }

      // 4. farmAnimals (animaux possédés)
      if (Array.isArray(source.farmAnimals)) {
        for (const animal of source.farmAnimals) {
          if (typeof animal === 'string') ids.add(animal);
          else if (animal && typeof animal.animalId === 'string') ids.add(animal.animalId);
        }
      }

      // 5. farmBuildings (bâtiments construits)
      if (Array.isArray(source.farmBuildings)) {
        for (const building of source.farmBuildings) {
          if (typeof building === 'string') ids.add(building);
          else if (building && typeof building.buildingId === 'string') ids.add(building.buildingId);
        }
      }

      // 6. completedSagas (sagas terminées → débloquent sagaExclusive animals)
      if (Array.isArray(source.completedSagas)) {
        for (const sagaId of source.completedSagas) {
          if (typeof sagaId === 'string') ids.add(sagaId);
        }
      }

      return ids;
    }
    ```

    Contraintes :
    - Pas d'import React, pas d'import contexts/*
    - Accepter `null` / `undefined` gracieusement (le profil peut être absent au premier render)
    - Type `DiscoverySource` local avec champs optionnels — pas d'import du type Profile pour éviter le couplage
    - Commentaires FR
    - PAS de hook React, PAS de side-effect
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "lib/codex/discovery\.ts" ; test -f lib/codex/discovery.ts</automated>
  </verify>
  <acceptance_criteria>
    - Fichier `lib/codex/discovery.ts` existe
    - `grep -q "export function computeDiscoveredCodexIds" lib/codex/discovery.ts` retourne 0
    - `grep -q "export interface DiscoverySource" lib/codex/discovery.ts` retourne 0
    - `grep -q "from 'react'" lib/codex/discovery.ts` retourne 1 (zero import React)
    - `grep -q "from '.*contexts" lib/codex/discovery.ts` retourne 1 (zero import contexts)
    - `grep -q "Set<string>" lib/codex/discovery.ts` retourne 0
    - `npx tsc --noEmit` ne produit AUCUNE nouvelle erreur dans lib/codex/discovery.ts
  </acceptance_criteria>
  <done>
    Fichier créé, fonction pure testable, tsc --noEmit clean, zero couplage React/contexts.
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` : zéro nouvelle erreur dans lib/codex/search.ts et lib/codex/discovery.ts
- Les deux fichiers sont des modules ES purs, sans import React ni contexts/
- searchCodex ne dépend PAS de lib/search.ts (D-09 respecté)
</verification>

<success_criteria>
- lib/codex/search.ts exporte normalize, searchCodex, filterByKind
- lib/codex/discovery.ts exporte computeDiscoveredCodexIds et DiscoverySource
- Aucun import depuis lib/search.ts
- Aucun import depuis react ou contexts/
- tsc clean
</success_criteria>

<output>
Après complétion, créer `.planning/phases/17-codex-ui/17-01-SUMMARY.md` avec :
- Fonctions exportées et leur signature
- Pattern normalize utilisé
- Interface DiscoverySource documentée
- Comment 17-03 va consommer ces helpers
</output>
