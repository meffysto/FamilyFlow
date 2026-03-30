---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Ferme Enrichie
status: executing
stopped_at: Completed quick 260330-t4b refonte layout ecran ferme Option B
last_updated: "2026-03-30T19:04:52.783Z"
last_activity: 2026-03-30
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 11
  completed_plans: 11
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-28)

**Core value:** L'app doit rester fiable et stable pour un usage quotidien familial — les données ne doivent jamais être perdues ou corrompues, et les features existantes ne doivent pas régresser.
**Current focus:** Phase 06 — batiments-productifs

## Current Position

Phase: 9
Plan: Not started
Status: Executing Phase 06
Last activity: 2026-03-30 - Completed quick task 260330-t4b: Refonte layout écran ferme Option B

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (milestone v1.1)
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*
| Phase 05-visuels-ferme P01 | 2 | 1 tasks | 1 files |
| Phase 05-visuels-ferme P05-02 | 3 | 2 tasks | 103 files |
| Phase 05-visuels-ferme P03 | 15 | 3 tasks | 1 files |
| Phase 06-batiments-productifs P01 | 25 | 2 tasks | 11 files |
| Phase 06-batiments-productifs P02 | 10min | 2 tasks | 12 files |
| Phase 08.1-split-gamification-par-profil P01 | 15min | 2 tasks | 4 files |
| Phase 08.1-split-gamification-par-profil P02 | 25min | 2 tasks | 1 files |

## Accumulated Context

### Roadmap Evolution
- Phase 10 added: Compagnon Mascotte — compagnon interactif lié à la gamification, vit dans l'arbre, mascotte de l'app

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init v1.1]: La ferme est le levier de motivation, pas le produit — chaque feature doit renforcer tâches → XP/récoltes → progression ferme → envie de refaire
- [Phase 4]: AmbientParticles utilise largeur generique 390 car absoluteFill dans parent de taille connue
- [Phase 4]: Couleurs dorées (#FFD700) définies dans StyleSheet comme constantes cosmétiques, pas dans useThemeColors()
- [Phase 05-01]: Animer overlay RGBA via 4 shared values separees (pas interpolation string) pour compatibilite worklets Reanimated
- [Phase 05-01]: Toujours rendre Animated.View overlay (jamais return null quand config null) — fondu entrant/sortant fluide pour slot jour
- [Phase 05-visuels-ferme]: CROP_SPRITES restructure en tuples [frameA, frameB] — pattern frame swap 800ms via setInterval + useState dans CropCell
- [Phase 05-visuels-ferme]: Frame B generee programmatiquement (decalage 1px) depuis frame A Mana Seed — corn->cornyellow, potato->potatobrown
- [Phase 05-03]: isHorizontal = Math.abs(lastDx) > Math.abs(lastDy) pour selectionner frames walk_left vs walk_down dans AnimatedAnimal
- [Phase 05-03]: scaleX: -1 applique sur Image uniquement (pas Animated.View) pour flip directionnel sans affecter la bulle de pensee
- [Phase 06-batiments-productifs]: MAX_PENDING=3 plafond production idle — evite accumulation infinie si utilisateur absent plusieurs jours
- [Phase 06-batiments-productifs]: buildingId:cellId:level:lastCollectAt — format CSV identique au pattern farm-engine pour coherence
- [Phase 06-batiments-productifs]: Migration backward-compatible parseBuildings() : detecte ancien format string seul et nouveau CSV avec colons
- [Phase 06-02]: TreeShop garde string[] via .map(b => b.buildingId) pour retrocompat sans modifier TreeShop
- [Phase 08.1-01]: gamiFile() défini localement dans chaque fichier modifié pour éviter la dépendance circulaire lib/vault.ts <-> hooks
- [Phase 08.1-01]: gamification.md non supprimé en phase 08.1-01 — migration backward-compatible (split legacy file) dans Plan 02
- [Phase 08.1-01]: openLootBox écrit uniquement le profil actif en gami-{id}.md — family_bonus multi-profil traité dans useVault.ts Plan 02
- [Phase 08.1-02]: migrateGamification() lit gamification.md mais ne l'écrit jamais — backward-compatible pour devices existants
- [Phase 08.1-02]: Merge partiel setGamiData(prev => ...) pour mutations single-profil — ne remplace pas l'état global entier
- [Phase 08.1-02]: updateProfile : fichier gami-{profileId}.md reste au même chemin lors renommage — l'ID est stable

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 6 (bâtiments): La formule de progression idle (ressources/heure) doit être calibrée contre le modèle XP budget de Phase 2. Ne pas finaliser les valeurs avant planning.
- Phase 8 (tech tree): Vérifier si l'écran arbre existant (app/(tabs)/tree.tsx) peut accueillir la progression ferme ou si un onglet dédié est nécessaire.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260330-t4b | Refonte layout écran ferme Option B | 2026-03-30 | 149d6d1 | [260330-t4b-refonte-layout-cran-ferme-option-b](./quick/260330-t4b-refonte-layout-cran-ferme-option-b/) |

## Session Continuity

Last session: 2026-03-30T19:04:52.779Z
Stopped at: Completed quick 260330-t4b refonte layout ecran ferme Option B
Resume file: None
