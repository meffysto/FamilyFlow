---
phase: quick-260617
status: superseded
---

# Resume

Pack styles maison compagnon genere a partir de `.planning/sketches/005-maison-interieur/maison-assets-styles.txt`.

Cette premiere passe raster locale a ete remplacee par la reprise `image_gen` documentee dans `.planning/quick/260617-maison-assets-styles-redo/`.

Le generateur image integre n'a pas ecrit de nouveau PNG dans `.codex/generated_images` pendant cette passe. Pour livrer des assets propres et decoupes, les 16 PNG ont ete produits en raster local haute resolution puis reduits en 512x512 avec alpha natif.

# Sorties

- Assets finaux : `assets/companion-house/<id>.png`
- Planche de controle : `.planning/quick/260617-maison-assets-styles/preview-assets-styles.png`
- Script local : `.planning/quick/260617-maison-assets-styles/draw_style_assets.py`
- Integration : `components/companion-house/furniture-sprites.ts`

# Validation

- 16 fichiers PNG finaux.
- Dimensions : 512x512.
- Canal alpha present, coins transparents.
- `furniture-sprites.ts` reference les 16 ids des packs Moderne et Ferme.
