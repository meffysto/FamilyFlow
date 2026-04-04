---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Ferme Enrichie
status: verifying
stopped_at: Completed quick-260405-0u3 — extraction domaine Budget de useVault.ts vers useVaultBudget.ts
last_updated: "2026-04-04T22:42:46.371Z"
last_activity: "2026-04-04 - Completed quick task 260404-qvz: Fix OOM crash TreeScreen"
progress:
  total_phases: 10
  completed_phases: 9
  total_plans: 24
  completed_plans: 22
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-28)

**Core value:** L'app doit rester fiable et stable pour un usage quotidien familial — les données ne doivent jamais être perdues ou corrompues, et les features existantes ne doivent pas régresser.
**Current focus:** Phase 09 — cadeaux-familiaux

## Current Position

Phase: 10
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-04-05 - Completed quick task 260405-0wx: Repliquer changements ferme mobile sur desktop

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
| Phase 10-compagnon-mascotte P01 | 10min | 2 tasks | 35 files |
| Phase 10-compagnon-mascotte P02 | 15min | 2 tasks | 4 files |
| Phase 10-compagnon-mascotte P03 | 20min | 2 tasks | 4 files |
| Phase 11-sagas-immersives P03 | 4min | 1 tasks | 1 files |
| Phase 11-sagas-immersives P01 | 4min | 2 tasks | 11 files |
| Phase 11-sagas-immersives P02 | 3min | 2 tasks | 2 files |
| Phase 13-evenements-saisonniers P01 | 4min | 2 tasks | 6 files |
| Phase 13-evenements-saisonniers P02 | 8min | 2 tasks | 3 files |
| Phase 09-cadeaux-familiaux P01 | 4min | 2 tasks | 7 files |
| Phase 09-cadeaux-familiaux P02 | 10min | 2 tasks | 6 files |
| Phase quick-260404-qvz P01 | 15min | 2 tasks | 2 files |
| Phase quick-260405-0u3 P01 | 8min | 2 tasks | 2 files |

## Accumulated Context

### Roadmap Evolution

- Phase 10 added: Compagnon Mascotte — compagnon interactif lié à la gamification, vit dans l'arbre, mascotte de l'app
- Phase 12 added: Templates onboarding vivants — contenu personnalisé et complet

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
- [Phase 10-compagnon-mascotte]: getCompanionMood accepte currentHour optionnel pour testabilite (evite test fragile selon heure execution)
- [Phase 10-compagnon-mascotte]: COMPANION_STAGES: bebe 1-5, jeune 6-10, adulte 11+ (meme pattern que TREE_STAGES)
- [Phase 10-compagnon-mascotte]: 5 especes compagnon: chat/chien/lapin initial, renard rare, herisson epique (per D-01 et D-03)
- [Phase 10-compagnon-mascotte]: parseCompanion retourne null (pas undefined) — les composants testent profile.companion != null pour coherence
- [Phase 10-compagnon-mascotte]: openLootBox companion: pattern identique mascot_deco (ecriture directe vault) sans passer par setCompanion pour eviter les appels imbriques
- [Phase 10-compagnon-mascotte]: CompanionSlot position cx:85 cy:205 dans viewbox 200x240 — distinct des HAB_SLOTS existants
- [Phase 10-compagnon-mascotte]: companionPickerShownRef pour gate le déclenchement du picker par session — évite annoyance répétitive
- [Phase 11-sagas-immersives]: Dashboard saga: indicateur texte inline remplace carte saga volumineuse — curiosite + redirection vers arbre
- [Phase 11-sagas-immersives]: Sprites placeholder 48x48 PNG créés (PixelLab non accessible) — TODO remplacement par vrais sprites pixel art voyageur
- [Phase 11-sagas-immersives]: shouldDepart déclenche départ uniquement si state === idle — évite interruption animation de réaction en cours (SAG-04 correctness)
- [Phase 11-sagas-immersives]: Tint couleur saga implémenté comme overlay View (opacity 0.15) plutôt que tintColor sur Image — plus fiable cross-platform
- [Phase 11-sagas-immersives]: reactionForChoice utilise trait dominant du choice.traits pour mapper joy/surprise/mystery — fallback par index si aucun trait
- [Phase 11-sagas-immersives]: VisitorSlot en couche 3.6 avec zIndex conditionnel (20 si showSagaEvent, 3 sinon) pour éviter superposition sur dialogue saga
- [Phase 13-01]: SeasonalEventProgress utilise clé composite eventId+year — évite marquage complété inter-annuel
- [Phase 13-01]: drawGuaranteedSeasonalReward descend en cascade (épique→rare→commun) — jamais null
- [Phase 13-01]: buildSeasonalEventAsSaga produit finale.variants={} pour compatibilité SagaWorldEvent sans modification
- [Phase 13-02]: handleEventComplete réutilise completeSagaChapter pour les XP — réutilise la queue d'écriture enqueueWrite existante
- [Phase 13-02]: overrideSaga prop sur SagaWorldEvent — 2 modifications minimales, bypass getSagaById pour sagas synthétiques d'événements
- [Phase 13-02]: pointerEvents mutuellement exclusifs entre visiteur saga (droite) et visiteur événement (gauche) — coexistence sans conflit
- [Phase 260404-kbd]: advanceFarmCrops hybride: boucle tous crops non-matures, plot principal vitesse pleine, autres demi-vitesse (seasonBonus*0.5)
- [Phase 09-cadeaux-familiaux]: parsePendingGifts utilise gray-matter defensive (?? []) — coherent avec parseCompanion
- [Phase 09-cadeaux-familiaux]: addGiftToInventory type=crafted ajoute toujours un nouvel item — simplifie le transfert sans ambiguité
- [Phase 09-cadeaux-familiaux]: NotifEvent etendu avec 'gift_received' pour eviter le cast 'as NotifEvent'
- [Phase 09-cadeaux-familiaux]: receiveGifts appelé dans useEffect [profile.id] dans tree.tsx — une seule detection par profil
- [Phase 09-cadeaux-familiaux]: claim-first : deleteFile pending AVANT addGiftToInventory pour eviter double-consommation
- [Phase quick-260404-qvz]: Timer global WorldGridView: sharedFrameIdx + whisperCellId au niveau parent eliminent ~40 setInterval locaux CropCell
- [Phase quick-260405-0wx]: wear-engine.ts copie directement du mobile (fichier pur, pas de dependance React) — checkWearInVault simplifie fullBuildingSince a {}

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 6 (bâtiments): La formule de progression idle (ressources/heure) doit être calibrée contre le modèle XP budget de Phase 2. Ne pas finaliser les valeurs avant planning.
- Phase 8 (tech tree): Vérifier si l'écran arbre existant (app/(tabs)/tree.tsx) peut accueillir la progression ferme ou si un onglet dédié est nécessaire.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260330-t4b | Refonte layout écran ferme Option B | 2026-03-30 | 149d6d1 | [260330-t4b-refonte-layout-cran-ferme-option-b](./quick/260330-t4b-refonte-layout-cran-ferme-option-b/) |
| 260331-jro | Créer composant PressableScale + appliquer sur DashboardCard | 2026-03-31 | 103da8c | [260331-jro-cr-er-composant-pressablescale-appliquer](./quick/260331-jro-cr-er-composant-pressablescale-appliquer/) |
| 260331-jzy | Ajouter prop tinted sur DashboardCard pour fond subtil coloré par section | 2026-03-31 | 3549bab | [260331-jzy-ajouter-prop-tinted-sur-dashboardcard-po](./quick/260331-jzy-ajouter-prop-tinted-sur-dashboardcard-po/) |
| 260402-vpb | Refonte catalogue CraftSheet en grille par stade + mini-modal | 2026-04-02 | a802822 | [260402-vpb-refonte-catalogue-recettes-craftsheet-gr](./quick/260402-vpb-refonte-catalogue-recettes-craftsheet-gr/) |
| 260402-wbr | Refonte bottom panel ecran arbre — 2 cartes Actions + Progression | 2026-04-02 | 8b503a3 | [260402-wbr-refonte-bottom-panel-cran-arbre-option-c](./quick/260402-wbr-refonte-bottom-panel-cran-arbre-option-c/) |
| 260402-wrf | Mockup C — diorama arrondi + ombre + chevauchement cartes (ecran arbre) | 2026-04-02 | bae5fd5 | [260402-wrf-impl-menter-le-mockup-c-sur-l-cran-tree-](./quick/260402-wrf-impl-menter-le-mockup-c-sur-l-cran-tree-/) |
| 260402-wum | FAB calendrier — ajout rapide RDV et tache | 2026-04-02 | d006704 | [260402-wum-fab-calendrier-ajout-rapide-rdv-et-t-che](./quick/260402-wum-fab-calendrier-ajout-rapide-rdv-et-t-che/) |
| 260402-x63 | HUD flottant option A — position absolute + fond semi-transparent (écran tree) | 2026-04-02 | e3ae5ec | [260402-x63-hud-flottant-option-a-sur-l-cran-tree-re](./quick/260402-x63-hud-flottant-option-a-sur-l-cran-tree-re/) |
| 260403-kjz | Supprimer le code debug saga dans tree.tsx | 2026-04-03 | 659a064 | [260403-kjz-supprimer-le-code-debug-saga-dans-tree-t](./quick/260403-kjz-supprimer-le-code-debug-saga-dans-tree-t/) |
| 260403-q6y | Fix race condition sur les écritures famille.md (useFarm + useVault) | 2026-04-03 | a62b191 | [260403-q6y-fix-race-condition-on-famille-md-writes-](./quick/260403-q6y-fix-race-condition-on-famille-md-writes-/) |
| 260403-qoo | Wrapper completeTask/openLootBox/completeSagaChapter famille.md via enqueueWrite | 2026-04-03 | 72db03b | [260403-qoo-wrapper-completetask-openlootbox-complet](./quick/260403-qoo-wrapper-completetask-openlootbox-complet/) |
| 260404-hfb | Ajouter deux recettes craft tournesol (huile_tournesol + brioche_tournesol) | 2026-04-04 | 039e7b5 | [260404-hfb-ajouter-deux-recettes-craft-tournesol-da](./quick/260404-hfb-ajouter-deux-recettes-craft-tournesol-da/) |
| 260404-h6l | Extraire données farm/mascot/companion de famille.md vers farm-{profileId}.md | 2026-04-04 | c146f70 | [260404-h6l-extraire-donn-es-farm-mascot-companion-d](./quick/260404-h6l-extraire-donn-es-farm-mascot-companion-d/) |
| 260404-i3r | Remplacer l'emoji animé du poulailler par sprite PNG Animated.Image | 2026-04-04 | c9bfd75 | [260404-i3r-remplacer-l-emoji-anim-du-poullailler-da](./quick/260404-i3r-remplacer-l-emoji-anim-du-poullailler-da/) |
| 260404-ips | Optimiser writes farm/gami et créer refreshFarm(profileId) | 2026-04-04 | 2411250 | [260404-ips-optimiser-writes-farm-gami-et-cr-er-refr](./quick/260404-ips-optimiser-writes-farm-gami-et-cr-er-refr/) |
| 260404-j7v | Fix complet système usure ferme — overlay orange, blocage plant, repair handlers, bouton toit | 2026-04-04 | 544e4c9 | [260404-j7v-fix-complet-syst-me-usure-ferme-overlay-](./quick/260404-j7v-fix-complet-syst-me-usure-ferme-overlay-/) |
| 260404-kbd | Système hybride ferme — plot principal vitesse pleine, autres demi-vitesse + indicateur visuel | 2026-04-04 | 22ac20e | [260404-kbd-syst-me-hybride-ferme-plot-principal-vit](./quick/260404-kbd-syst-me-hybride-ferme-plot-principal-vit/) |
| 260404-kdk | Rééquilibrer recettes ferme — 2 ingrédients + 17 prix de vente | 2026-04-04 | 6dad909 | [260404-kdk-r-quilibrer-recettes-ferme-prix-et-ingr-](./quick/260404-kdk-r-quilibrer-recettes-ferme-prix-et-ingr-/) |
| 260404-kvd | fix crop texte contexte quotes — retirer numberOfLines={2} sur le texte date/contexte dans renderItem | 2026-04-04 | e6ca0ac | [260404-kvd-fix-crop-texte-contexte-quotes-retirer-n](./quick/260404-kvd-fix-crop-texte-contexte-quotes-retirer-n/) |
| 260404-l62 | Bouton skip tâches récurrentes sans gamification | 2026-04-04 | 1ab57c1 | [260404-l62-bouton-skip-taches-recurrentes-sans-gami](./quick/260404-l62-bouton-skip-taches-recurrentes-sans-gami/) |
| 260404-quw | Fix long-press not working on inventory items (CraftSheet) | 2026-04-04 | ae62fc6 | [260404-quw-fix-long-press-not-working-on-inventory-](./quick/260404-quw-fix-long-press-not-working-on-inventory-/) |
| 260404-qvz | Fix OOM crash TreeScreen — timer global, lazy-load images saison, reduire particules | 2026-04-04 | cd8307e | [260404-qvz-fix-oom-crash-treescreen-timer-global-la](./quick/260404-qvz-fix-oom-crash-treescreen-timer-global-la/) |
| 260404-rfs | Bouton Offrir visible sur items inventaire + Mes créations (remplace long-press) | 2026-04-04 | 19f051b | [260404-rfs-remplacer-long-press-cadeau-par-bouton-o](./quick/260404-rfs-remplacer-long-press-cadeau-par-bouton-o/) |
| 260404-xbu | Permettre de changer la catégorie d'une recette depuis RecipeViewer | 2026-04-04 | 3b314e0 | [260404-xbu-permettre-de-changer-la-cat-gorie-d-une-](./quick/260404-xbu-permettre-de-changer-la-cat-gorie-d-une-/) |
| 260405-0wx | Répliquer changements ferme mobile sur desktop (wear + FIFO) | 2026-04-05 | 85ee148 | [260405-0wx-r-pliquer-changements-ferme-mobile-sur-d](./quick/260405-0wx-r-pliquer-changements-ferme-mobile-sur-d/) |

## Session Continuity

Last session: 2026-04-04T22:42:42.519Z
Stopped at: Completed quick-260405-0wx — repliquer changements ferme mobile sur desktop
Resume file: None
