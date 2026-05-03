---
phase: quick-260503
status: completed
---

# Résumé

Pack asset-only généré pour trois nouveaux compagnons premium de ferme :

- `mouton`
- `chevre`
- `poney`

Chaque espèce contient 3 stades (`bebe`, `jeune`, `adulte`) et 6 poses (`idle_1`, `idle_2`, `happy`, `sleeping`, `eating`, `celebrating`), soit 54 PNG finaux en 68x68.

# Sorties

- Assets finaux : `assets/garden/animals/{mouton,chevre,poney}/...`
- Sheets brutes : `.planning/quick/260503-sprites-compagnons-ferme-premium/*-raw-sheet.png`
- Sheets traitées : `.planning/quick/260503-sprites-compagnons-ferme-premium/*-processed/`
- Planche de contrôle : `.planning/quick/260503-sprites-compagnons-ferme-premium/preview-final-assets.png`

# Intégration gameplay

Le mouton est branché comme compagnon épique :

- catalogue `COMPANION_SPECIES_CATALOG`
- sprites `COMPANION_SPRITES`
- picker compagnon verrouillé jusqu'au drop lootbox
- récompense lootbox épique `Compagnon Mouton !`
- textes FR/EN et entrée Codex
- previews avatar/carte compagnon

# Validation

- 54 fichiers PNG générés.
- Échantillons vérifiés en 68x68.
- Fond magenta nettoyé en transparence via le processeur Sprite Forge.
- Tous les PNG finaux restent sous 4 Ko après compression `pngquant` (max observé : 3274 octets).
- Tests ciblés compagnon/gamification OK.
- `npx tsc --noEmit` OK.
