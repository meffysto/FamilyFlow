---
phase: quick-260617
title: Assets maison packs styles
status: completed
---

# Objectif

Generer les 16 meubles du brief `.planning/sketches/005-maison-interieur/maison-assets-styles.txt`.

# Scope

- Format cible : PNG transparent 512x512 par id.
- Destination : `assets/companion-house/<id>.png`.
- Style : coherent avec `assets/companion-house/room-bg.png` et le pack v2.
- Integration : decommenter les lignes correspondantes dans `components/companion-house/furniture-sprites.ts`.

# Plan

1. Generer les 8 meubles Moderne et 8 meubles Ferme.
2. Decouper/nettoyer le fond chroma-key en alpha.
3. Valider dimensions, alpha, et planche de controle.
4. Decommenter les `require()` du pack styles.

# Validation

- 16 fichiers PNG finaux.
- Dimensions 512x512.
- Canal alpha present, coins transparents.
- `furniture-sprites.ts` reference les 16 ids.
