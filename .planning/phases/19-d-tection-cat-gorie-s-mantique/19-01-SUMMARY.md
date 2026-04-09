---
phase: 19-d-tection-cat-gorie-s-mantique
plan: "01"
subsystem: lib/semantic
tags: [semantic, pure-module, feature-flag, securestore, typescript]
dependency_graph:
  requires: []
  provides: [lib/semantic/categories.ts, lib/semantic/derive.ts, lib/semantic/flag.ts, lib/semantic/index.ts]
  affects: []
tech_stack:
  added: []
  patterns: [pure-function-module, barrel-export, securestore-flag]
key_files:
  created:
    - lib/semantic/categories.ts
    - lib/semantic/derive.ts
    - lib/semantic/flag.ts
    - lib/semantic/index.ts
  modified: []
decisions:
  - "D-02 appliqué : ordre de priorité tag > section > filepath figé dans deriveTaskCategory"
  - "D-03a : normalize() interne unique réutilisé, non exportée"
  - "D-04b : evidence = valeur brute non normalisée pour Phase 21 (affichage utilisateur)"
  - "D-05a/b : clé SecureStore globale 'semantic-coupling-enabled', famille-wide pas par-profil"
  - "Ordre CATEGORIES : catégories spécifiques (courses, bebe_soins, enfants_devoirs) avant leurs fallbacks larges (menage_hebdo, enfants_routines) — évite Pitfall 3"
metrics:
  duration: "4min"
  completed: "2026-04-09"
  tasks_completed: 3
  files_created: 4
  files_modified: 0
---

# Phase 19 Plan 01: Module pur lib/semantic — types, détection, feature flag

## One-liner

Module pur `lib/semantic/` (4 fichiers) implémentant détection sémantique de catégorie via `deriveTaskCategory(task): CategoryMatch | null` + feature flag SecureStore `isSemanticCouplingEnabled/setSemanticCouplingEnabled`, sans aucun câblage app existant.

## Summary

Livraison du module dormant `lib/semantic/` qui sera consommé par Phase 20. Le module est 100% pur (synchrone, sans I/O, sans effet de bord) et expose 10 catégories sémantiques (CategoryId) détectables depuis 3 signaux sur un `Task` : tags, section H2/H3, et premier segment de filepath vault. Le feature flag SecureStore est family-wide, default OFF.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | categories.ts — types + mapping 10 catégories | afdc314 | lib/semantic/categories.ts |
| 2 | derive.ts — fonction pure deriveTaskCategory | ee60fdb | lib/semantic/derive.ts |
| 3 | flag.ts + index.ts — feature flag + barrel | b948900 | lib/semantic/flag.ts, lib/semantic/index.ts |

## What Was Built

### lib/semantic/categories.ts

- `CategoryId` : type union avec les 10 valeurs canoniques (menage_quotidien, menage_hebdo, courses, enfants_routines, enfants_devoirs, rendez_vous, gratitude_famille, budget_admin, bebe_soins, cuisine_repas)
- `CategoryMatch` : résultat de détection avec id, matchedBy ('tag'|'section'|'filepath'), evidence brute
- `SemanticCategory` : shape d'une entrée du mapping (labels FR/EN, patterns filepath/section/tag pré-normalisés)
- `CATEGORIES` : constante readonly de 10 entrées ordonnées (spécifique avant générique pour éviter les faux positifs)

### lib/semantic/derive.ts

- `deriveTaskCategory(task: Task): CategoryMatch | null` : fonction synchrone pure
- Ordre tag > section > filepath avec retour au premier match
- `normalize()` interne : strip accents NFD + lowercase + trim (non exportée)
- Evidence = valeur brute préservée pour affichage Phase 21
- Fallback null si aucun signal ne matche (ARCH-03)

### lib/semantic/flag.ts

- `SEMANTIC_COUPLING_KEY = 'semantic-coupling-enabled'` : clé SecureStore globale
- `isSemanticCouplingEnabled()` : async, default false si clé absente ou valeur inattendue
- `setSemanticCouplingEnabled(enabled)` : écrit 'true'/'false' via SecureStore
- try/catch dans isSemanticCouplingEnabled pour fallback sûr si SecureStore indisponible

### lib/semantic/index.ts

- Barrel sélectif : deriveTaskCategory + 2 helpers flag + SEMANTIC_COUPLING_KEY + 3 types
- normalize et CATEGORIES intentionnellement non exportés (détails d'implémentation)

## Deviations from Plan

None - plan exécuté exactement tel qu'écrit. Les 4 fichiers correspondent au code spécifié dans le plan.

## Verification Results

- `npx tsc --noEmit` : 0 nouvelle erreur dans lib/semantic/ (erreurs pré-existantes MemoryEditor.tsx/cooklang.ts/useVault.ts ignorées)
- Aucun import vault.ts dans le module : `grep -r "from '.*vault'" lib/semantic/` retourne 0
- Module non importé dans l'app existante : 0 consommateurs actuels (module dormant, Phase 20 sera le premier)
- package.json non modifié : expo-secure-store déjà présent, ARCH-04 respecté

## Known Stubs

Aucun stub. Le module est complet pour sa phase (types + détection + flag). Les tests comportementaux sont livrés par le plan 19-02 qui dépend de ce plan.

## Self-Check: PASSED

- lib/semantic/categories.ts : FOUND
- lib/semantic/derive.ts : FOUND
- lib/semantic/flag.ts : FOUND
- lib/semantic/index.ts : FOUND
- commit afdc314 : FOUND
- commit ee60fdb : FOUND
- commit b948900 : FOUND
