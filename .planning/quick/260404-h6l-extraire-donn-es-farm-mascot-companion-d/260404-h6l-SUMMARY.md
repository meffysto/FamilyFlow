---
phase: quick
plan: 260404-h6l
subsystem: data-split
tags: [farm, mascot, companion, icloud, split, migration]
dependency_graph:
  requires: []
  provides: [farm-profileId.md per-profil]
  affects: [famille.md, useFarm, useVault, useGamification, SettingsGamiAdmin]
tech_stack:
  added: []
  patterns: [per-profile farm file, one-shot migration, read-modify-write farmFile]
key_files:
  created: []
  modified:
    - lib/types.ts
    - lib/parser.ts
    - hooks/useFarm.ts
    - hooks/useVault.ts
    - hooks/useGamification.ts
    - components/settings/SettingsGamiAdmin.tsx
decisions:
  - "farmFile() défini localement dans chaque fichier modifié (même pattern que gamiFile) pour éviter dépendance circulaire"
  - "migrateFarmData() parse manuellement famille.md pour extraire les champs farm (parseFamille ne les lit plus)"
  - "saga_items reste dans famille.md (données identité saga), seul farm_harvest_inventory migre vers farm-{id}.md"
  - "parseFamille retourne des valeurs par défaut vides pour tous les champs farm/mascot/companion"
  - "serializeFarmProfile ne sérialise que les champs non-vides pour garder le fichier compact"
  - "setCompanion met à jour setProfiles directement (pas de refresh() appel) pour éviter re-read inutile"
metrics:
  duration: ~25min
  completed_date: "2026-04-04"
  tasks: 3
  files: 6
---

# Quick 260404-h6l: Extraire données farm/mascot/companion vers farm-{profileId}.md

Extraction complète des données ferme/mascot/compagnon de famille.md vers farm-{profileId}.md — élimine les conflits iCloud last-writer-wins sur famille.md. Suit le pattern prouvé de la Phase 08.1 (gamification.md → gami-{id}.md).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | parseFarmProfile/serializeFarmProfile + FarmProfileData | 293351f | lib/parser.ts, lib/types.ts |
| 2 | useFarm.ts — redirecter écritures farm_* vers farm-{id}.md | eb5f430 | hooks/useFarm.ts |
| 3 | useVault + useGamification + SettingsGamiAdmin — migration + writes | c146f70 | hooks/useVault.ts, hooks/useGamification.ts, components/settings/SettingsGamiAdmin.tsx |

## What Was Built

**lib/types.ts**
- Nouveau type `FarmProfileData` exporté — structure complète des données ferme/mascot/compagnon par profil

**lib/parser.ts**
- `parseFarmProfile(content)` — parse farm-{id}.md (format key: value sans section ### )
- `serializeFarmProfile(profileName, data)` — produit le Markdown du fichier farm-{id}.md (champs non-vides uniquement)
- `parseFamille()` — ne lit plus les champs farm/mascot/companion (valeurs par défaut vides)
- Imports des serializers mascot ajoutés (serializeBuildings, serializeInventory, etc.)

**hooks/useFarm.ts**
- `farmFile()` helper local
- `applyFarmField()` — mappeur fieldKey → propriété FarmProfileData
- `writeProfileField` / `writeProfileFields` — lisent/modifient/écrivent farm-{id}.md (plus famille.md)
- Toutes les fonctions (plant, harvest, sellHarvest, craft, sellCrafted, buyBuilding, upgradeBuildingAction, collectBuildingResources, collectPassiveIncome, unlockTech, checkWear, repairWear) lisent farm-{id}.md
- Supprimé : FAMILLE_FILE, enqueueWrite, patchProfileField/patchProfileFields, parseFamille

**hooks/useVault.ts**
- `farmFile()` helper local
- `migrateFarmData()` — migration one-shot depuis famille.md → farm-{id}.md (backward-compatible)
- `loadVaultData` — lit farm-{id}.md parallèlement à gami-{id}.md, merge dans les profils
- `refreshGamification` — inclut farm-{id}.md dans le merge
- `updateTreeSpecies` — écrit dans farm-{id}.md (plus famille.md, plus enqueueWrite)
- `buyMascotItem` — écrit mascot_decorations/mascot_inhabitants dans farm-{id}.md
- `placeMascotItem` / `unplaceMascotItem` — écrivent mascot_placements dans farm-{id}.md
- `setCompanion` — écrit companion dans farm-{id}.md + met à jour setProfiles directement
- `unlockCompanion` — lit farm-{id}.md pour obtenir le compagnon actuel
- `completeSagaChapter` — farm_harvest_inventory → farm-{id}.md, saga_items reste dans famille.md

**hooks/useGamification.ts**
- `farmFile()` helper local
- `completeTask` — farm_crops → farm-{id}.md (plus enqueueWrite sur famille.md)
- `openLootBox` — mascot_deco/mascot_hab/companion → farm-{id}.md
- Supprimé : FAMILLE_FILE, enqueueWrite, patchProfileField, parseFamille, serializeCompanion

**components/settings/SettingsGamiAdmin.tsx**
- handleSave() — champs ferme (farm_buildings, farm_inventory, farm_harvest_inventory, farm_rare_seeds, farm_tech) → farm-{id}.md via parseFarmProfile/serializeFarmProfile
- Supprimé : enqueueWrite, patchProfileFields

## Deviations from Plan

### Auto-fixed Issues

None — plan exécuté exactement tel que défini.

### Ajustements mineurs

**1. setCompanion simplifié**
- Plan: appeler refresh() après write
- Implémenté: setProfiles() direct (plus efficace, évite un re-read complet du vault)
- Raison: le state local est déjà connu, inutile de tout recharger

**2. saga_items reste dans famille.md**
- Plan: déplacer uniquement farm_harvest_inventory de completeSagaChapter
- Implémenté: identique au plan — saga_items (données identité profil) reste dans famille.md, seul farm_harvest_inventory migre
- Pas une déviation, juste clarification

## Known Stubs

Aucun stub — toutes les données farm sont lues/écrites correctement depuis/vers farm-{id}.md.

## Self-Check: PASSED
