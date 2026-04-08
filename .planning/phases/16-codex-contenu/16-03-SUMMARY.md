---
phase: 16-codex-contenu
plan: 03
subsystem: codex
tags: [codex, buildings, craft, tech, companions, i18n]
requires: [16-01]
provides:
  - lib/codex/buildings.ts
  - lib/codex/craft.ts
  - lib/codex/tech.ts
  - lib/codex/companions.ts
  - codex.building (FR+EN)
  - codex.craft (FR+EN)
  - codex.tech (FR+EN)
  - codex.companion (FR+EN)
affects:
  - locales/fr/codex.json
  - locales/en/codex.json
tech_stack:
  added: []
  patterns: [derive-from-engine, i18n-key-only, no-hardcoded-numbers]
key_files:
  created:
    - lib/codex/buildings.ts
    - lib/codex/craft.ts
    - lib/codex/tech.ts
    - lib/codex/companions.ts
  modified:
    - locales/fr/codex.json
    - locales/en/codex.json
decisions:
  - "Entries codex dérivées via .map() sur les constantes engine — aucune valeur numérique dupliquée (D-02)"
  - "Clés tech conservent le tiret (culture-1, elevage-2) — JSON valide et alignement direct avec TECH_TREE"
  - "Chaque edit JSON cible uniquement les sections building/craft/tech/companion pour éviter les conflits avec les plans parallèles 02 et 04"
metrics:
  duration: 8min
  tasks: 2
  files_created: 4
  files_modified: 2
  completed: "2026-04-08"
requirements_completed: [CODEX-02, CODEX-03]
---

# Phase 16 Plan 03 : Batiments, Craft, Tech, Companions Summary

Codex ferme enrichi de 43 entrées (4 bâtiments + 24 recettes craft + 10 nœuds tech + 5 compagnons) avec lore bilingue FR/EN complet, toutes dérivées des constantes engine via pattern `.map()` sans aucun nombre dupliqué.

## Objective

Créer les 4 arrays `lib/codex/{buildings,craft,tech,companions}.ts` dérivés de leurs constantes engine respectives (BUILDING_CATALOG, CRAFT_RECIPES, TECH_TREE, COMPANION_SPECIES_CATALOG) et remplir 172 textes de lore (43 entrées × 2 langues × 2 champs name+lore). Couvre 4 catégories sur les 10 requises par CODEX-02.

## What Was Built

### Task 1 — buildings.ts + craft.ts (28 entrées)
- `lib/codex/buildings.ts` : `buildingEntries` dérivé de `BUILDING_CATALOG.map()` — 4 IDs (poulailler, grange, moulin, ruche) avec emoji injecté dans `iconRef`.
- `lib/codex/craft.ts` : `craftEntries` dérivé de `CRAFT_RECIPES.map()` — 24 IDs (soupe → galette_royale) avec emoji injecté.
- `locales/fr/codex.json` + `locales/en/codex.json` : sections `building` et `craft` remplies avec name + lore 2-4 phrases par entrée, centrées sur l'usage dans la ferme, zéro valeur numérique.
- Commit : `ab525cc`

### Task 2 — tech.ts + companions.ts (15 entrées)
- `lib/codex/tech.ts` : `techEntries` dérivé de `TECH_TREE.map()` — 10 IDs répartis en 3 branches (culture-1..4, elevage-1..3, expansion-1..3).
- `lib/codex/companions.ts` : `companionEntries` dérivé de `COMPANION_SPECIES_CATALOG.map()` — 5 espèces (chat, chien, lapin, renard, herisson).
- `locales/{fr,en}/codex.json` : sections `tech` et `companion` remplies. Les clés tech conservent le tiret (`"culture-1"`, `"elevage-2"`) — valide en JSON.
- Commit : `cfa0be5`

## Key Decisions

- **Derive-from-engine pattern** : chaque array codex est un simple `.map()` sur la constante engine. Les stats (coût, cycle, upgrades, rareté) sont lues à la demande via `lib/codex/stats.ts` (`getBuildingStats`, `getCraftStats`, `getTechStats`, `getCompanionStats`) pour rester alignées avec l'engine (per D-02 anti-drift).
- **Zéro hardcoding numérique** dans les 4 nouveaux fichiers — seuls les `id`, `kind`, `sourceId`, clés i18n et `iconRef` sont présents.
- **Édition JSON ciblée** : les Write/Edit sur `locales/*/codex.json` ne touchent que les sections `building`, `craft`, `tech`, `companion` pour éviter les conflits avec les plans parallèles 16-02 (crop/animal/loot) et 16-04 (seasonal/saga/quest).

## Deviations from Plan

- **[Rule 1 - Bug] Première génération JSON avec clé dupliquée** : la première rédaction du `locales/fr/codex.json` contenait `"tarte_citrouille"` en double (une ligne partielle + l'objet complet). Corrigé immédiatement via Edit avant typecheck. Aucun impact runtime.
- **[Plan verify script] Regex buggy non-bloquant** : le script de verify du plan utilise `/BUILDING_CATALOG[\s\S]*?\];/` qui matche trop tôt sur une interface antérieure dans `lib/mascot/types.ts` et retourne 0 IDs. J'ai exécuté une variante corrigée (`/BUILDING_CATALOG:\s*BuildingDefinition\[\][\s\S]*?\n\];/`) qui matche bien le constant declaration et confirme les 4 IDs complets FR+EN. Non-bloquant : uniquement le script du plan, pas le contenu livré.
- **Auto-sync depuis `main`** : le worktree parallèle démarrait à `6fff374` (avant la phase 16) et n'avait pas accès à `lib/codex/types.ts` ni au PLAN file. Merge de `main` (commits 785eaf9..c21de8c) effectué en début de session pour récupérer les artefacts de 16-01 et le fichier de plan. Aucun conflit, fast-forward propre.

## Testing Performed

- `npx tsc --noEmit` ciblé sur `lib/codex/{buildings,craft,tech,companions}.ts` : **0 erreur**.
- Script verify Task 1 (variante corrigée) : **OK 4 buildings + 24 crafts** présents FR+EN.
- Script verify Task 2 (variante corrigée) : **OK 10 tech + 5 companions** présents FR+EN.
- Vérification structurelle JSON : `require()` des deux fichiers locales → parsing valide, pas de clé dupliquée, 43 entrées totales ajoutées.

## Follow-ups

- Plan 16-05 (aggregation-validation) agrègera `buildingEntries`, `craftEntries`, `techEntries`, `companionEntries` dans le catalogue global codex et validera l'absence de drift entre les entries et les engines source.
- Le contenu lore FR+EN est livré en prose volontairement sobre — une passe éditoriale pourra être envisagée si le ton diverge de celui des autres catégories (crop/animal/saga) une fois tous les plans de la phase 16 complétés.

## Self-Check: PASSED

- lib/codex/buildings.ts : FOUND
- lib/codex/craft.ts : FOUND
- lib/codex/tech.ts : FOUND
- lib/codex/companions.ts : FOUND
- locales/fr/codex.json : FOUND (building=4, craft=24, tech=10, companion=5)
- locales/en/codex.json : FOUND (building=4, craft=24, tech=10, companion=5)
- Commit ab525cc : FOUND
- Commit cfa0be5 : FOUND
