---
phase: quick-260617
status: completed
---

# Resume

Reprise du pack styles maison compagnon avec une vraie generation `image_gen`, pour remplacer la premiere passe raster locale.

La planche brute `image_gen` a ete generee en 4x4 sur fond magenta, dans un style pixel art cosy proche des assets de ferme. Comme le hook de sauvegarde automatique n'a pas materialise de fichier dans `$CODEX_HOME/generated_images`, la planche PNG a ete extraite depuis la sortie de session, puis traitee localement uniquement pour la decoupe et la transparence.

# Sorties

- Planche brute : `.planning/quick/260617-maison-assets-styles-redo/raw/styles_4x4-imagegen.png`
- Script de decoupe : `.planning/quick/260617-maison-assets-styles-redo/process_imagegen_sheet.py`
- Preview de controle : `.planning/quick/260617-maison-assets-styles-redo/preview-assets-styles-imagegen.png`
- Assets finaux : `assets/companion-house/{tapis_moderne,coussin_moderne,table_basse_moderne,fauteuil_moderne,etagere_moderne,lampe_moderne,plante_moderne,cadre_moderne,tapis_ferme,pouf_ferme,table_ferme,fauteuil_ferme,coffre_ferme,lanterne_ferme,plante_ferme,cadre_ferme}.png`

# Validation

- 16 fichiers PNG finaux.
- Dimensions : 512x512.
- Canal alpha present, coins transparents.
- Decoupe par chroma-key depuis fond magenta, puis nettoyage de bord.
- `components/companion-house/furniture-sprites.ts` reference les 16 sprites.

# Correction tapis

Les deux tapis ont ete retraites depuis la planche Imagen brute avec une logique specifique :

- pas d'inset de cellule pour eviter de rogner les bords ;
- recadrage sur la silhouette alpha ;
- remise au centre dans un canvas 512x512 avec marge transparente reguliere.

Preview : `.planning/quick/260617-maison-assets-styles-redo/preview-tapis-fixed.png`
