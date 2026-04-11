# Milestones

## v1.4 Jardin Familial (Shipped: 2026-04-11)

**Phases completed:** 4 phases, 8 plans, 6 tasks

**Key accomplishments:**

- 1. [Rule 1 - Bug] Fix gray-matter dates YAML parsees comme objets Date
- gardenRaw/setGardenRaw exposés dans VaultState + village_claimed_week dans FarmProfileData avec parseur/sérialiseur backward-compatible
- useGarden() — hook domaine village complet avec génération hebdomadaire, anti-double-claim et contributions, isolé de useVault via pattern D-01
- One-liner:
- Écran Place du Village complet — carte cobblestone TileMapRenderer mode='village', barre LiquidXPBar collective, feed contributions avec heure relative, indicateurs ReactiveAvatar par membre, historique CollapsibleSection — câblé sur useGarden() et useVault()
- PortalSprite Reanimated (glow loop 1200ms + spring tap) remplace le FAB dans tree.tsx, avec câblage auto-contribution village dans useFarm (récoltes) et useGamification (tâches) via callback onContribution + toast '+1 Village 🏡' décalé 300ms
- 1. [Rule 1 - Bug] Mauvaise fonction de parse pour gami-{id}.md

---

## v1.2 Confort & Découverte (Shipped: 2026-04-08)

**Phases completed:** 4 phases (15-18), 19 plans, 14 tasks
**Timeline:** 2026-04-07 → 2026-04-08 (2 jours)
**Stats:** 107 commits, 125 fichiers modifiés, +19 678 / -1 643 lignes
**Delivered:** L'app retient les contraintes alimentaires de la famille et explique enfin la ferme — confort quotidien (préférences + détection conflits recettes) et découvrabilité du jeu (codex 111 entrées + tutoriel 5 étapes).

**Key accomplishments:**

- Types + 3 catalogues canoniques (14 allergènes UE, 8 intolérances, 8 régimes) avec aliases FR exhaustifs et IDs snake_case stables pour matching ingrédients
- Parser bidirectionnel `famille.md` étendu (food_allergies/intolerances/regimes/aversions) + nouveau fichier `02 - Famille/Invités.md` pour invités récurrents — compatibilité Obsidian préservée (PREF-05)
- Fonction pure `checkAllergens` TDD (5 tests ARCH-03) + AllergenBanner P0 SAFETY non-dismissible (PREF-11) avec enforcement statique TypeScript
- RecipeViewer enrichi (bandeau + badges inline par sévérité + ConvivesPickerModal) et MealConflictRecap dans le planificateur hebdomadaire
- Saisie vocale PREF-13 : extractDietaryConstraints via ai-service.ts + VoicePreviewModal câblé sur DictaphoneRecorder existant
- Codex contenu : `lib/codex/content.ts` agrège 111 entrées sur 10 catégories (Cultures/Animaux/Bâtiments/Craft/Tech/Compagnons/Loot/Saisonnier/Sagas/Quêtes) importées des constantes engine — 220 tests Jest anti-drift garantissent zéro duplication de stats
- FarmCodexModal livré (11 catégories dont onglet Aventures ajouté in-phase) avec recherche normalisée NFD, sprites pixel art natifs, FlatList virtualisée, mini-modal détail stats kid-friendly, parité FR+EN
- Tutoriel ferme : FarmTutorialOverlay 5 étapes (format mixte cartes narratives + coach marks spotlight) basé sur HelpContext étendu, pause WorldGridView pour 60fps, rejouabilité depuis codex (CODEX-10)
- CoachMarkOverlay étendu avec borderRadius (technique borderWidth géant, zéro SVG supplémentaire) — réutilisable pour futurs tutoriels
- ARCH-05 tenu : zéro nouvelle dépendance npm sur l'ensemble du milestone (preuve que les primitives existantes suffisent)

### Known gaps

- ARCH-05 marqué "Pending" dans la trace requirements car vérifié par inspection humaine — aucune nouvelle dépendance npm ajoutée, constraint respectée en pratique

---

## v1.1 Ferme Enrichie (Shipped: 2026-04-07)

**Phases completed:** 9 phases, 22 plans, 36 tasks

**Key accomplishments:**

- Overlay couleur du diorama anime en fondu 2s via 4 shared values RGBA avec re-polling du slot horaire toutes les 60 secondes
- 100 sprites Mana Seed extractes et animations 2-frames (balancement 800ms) implementees sur les 10 cultures via CROP_SPRITES restructure et CropCell mis a jour
- ANIMAL_WALK_LEFT_FRAMES ajouté dans AnimatedAnimal avec detection direction (lastDx/lastDy) et flip scaleX: -1 pour mouvement droite
- Systeme de batiments productifs idle (PlacedBuilding tiered, building-engine.ts, parser migre) fournissant la couche donnees complete pour le Plan 02 UI
- BuildingCell interactif avec badge pulsant, BuildingShopSheet et BuildingDetailSheet complets, migration backward-compatible PlacedBuilding[], 3 actions (construire/collecter/ameliorer) integrees dans tree.tsx
- Moteur de craft avec 4 recettes (confiture/gateau/omelette/bouquet), harvestCrop refactore vers inventaire, et actions craft/sell dans useFarm
- CraftSheet bottom sheet avec catalogue 4 recettes, inventaire recoltes, section mes creations avec vente x2, integre via bouton Atelier dans tree.tsx
- Moteur pur tech tree ferme avec 3 branches (Culture/Elevage/Expansion), bonus integres dans farm-engine et building-engine, parcelles d'extension dans world-grid, persistence farm_tech dans profil
- Migration gamification.md → gami-{id}.md per-profil dans vault.ts, useFarm.ts, useGamification.ts et SettingsGamification.tsx pour éliminer les conflits d'écriture iCloud multi-device
- Migration complète de hooks/useVault.ts : gamiFile() + migrateGamification() + 27 sites de lecture/écriture scopés par profil via Promise.allSettled + merge en mémoire pour éliminer les conflits iCloud
- 1. [Rule 2 - Missing critical functionality] Ajout de 'gift_received' au type NotifEvent
- 1. [Rule 2 - Missing critical functionality] applyFarmField manquait gift_history et gifts_sent_today
- One-liner:
- Parsing bidirectionnel companion dans famille.md, hooks setCompanion/unlockCompanion, bonus XP +5%, et 5 entrees compagnon dans les pools lootbox rare/epique
- CompanionSlot animé (idle+tap+haptic+bulle) + CompanionPicker (choix 5 espèces + nommage) intégrés dans la scène arbre pixel art
- One-liner:
- Portrait sprite voyageur dans SagaWorldEvent (remplace spiritGlow emoji) + VisitorSlot intégré dans le diorama avec séquence tap→dialogue→réaction joy/surprise/mystery→départ
- One-liner:
- Moteur d'événements saisonniers complet : types SeasonalEventProgress/SeasonalEventContent, détection calendaire, tirage garanti avec fallback cascade, persistance SecureStore clé composite, et contenu narratif i18n pour les 8 événements via SEASONAL_EVENT_DIALOGUES
- Visiteur pixel événementiel côté gauche du diorama + dialogue SagaWorldEvent avec overrideSaga + complétion XP/persistance SecureStore via VisitorSlot étendu (targetFX/targetFY)

---
