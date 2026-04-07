# Milestones

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
