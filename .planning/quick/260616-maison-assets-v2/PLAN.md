---
phase: quick-260616
title: Assets maison compagnon v2
status: completed
---

# Objectif

Generer les 34 meubles listes dans `.planning/sketches/005-maison-interieur/maison-assets-v2.txt`.

# Scope

- Format cible : 1 PNG transparent 512x512 par id.
- Destination : `assets/companion-house/<id>.png`.
- Style : meuble RPG top-down peint, coherent avec `assets/companion-house/room-bg.png`.
- Pas de cablage catalogue/i18n dans cette passe.

# Plan

1. Generer chaque meuble via le workflow imagegen/generate2dsprite.
2. Nettoyer le fond chroma-key en alpha.
3. Verifier dimensions, alpha et liste des 34 fichiers.
4. Documenter les prompts et sorties.

# Validation

- 34 fichiers PNG finaux.
- Dimensions 512x512.
- Canal alpha present avec coins transparents.
- Aucun fichier v1 existant ecrase.
