---
slug: licorne-trop-petite
status: resolved
trigger: "FAM-6 — La licorne est affichée trop petite dans la mascotte/ferme"
created: 2026-05-01
updated: 2026-05-01
---

## Symptoms
- La licorne apparaît minuscule dans la vue arbre de la mascotte
- Elle est aussi petite qu'un animal commun malgré son statut prestige

## Root Cause

Double problème :

1. **Sprite mal dimensionné** : `idle_1.png` (68×68) — la licorne n'occupe que 18×40px (26% largeur, 59% hauteur). L'espace restant est transparent. `idle_2.png` était lui aussi dans un canvas 68×68 trop grand.

2. **Mauvais chemin de rendu** : La licorne était rendue par `InhabitantOverlay` via `SvgImage` (facteur ×1.2) car absente de `ANIMAL_IDLE_FRAMES`. Résultat : effective visual = 20px, pareil qu'un oiseau commun (rareté commun, baseSize 16).

## Fix Applied

1. **Sprites recadrés** : Union bbox des 2 frames (4,11,60,52) + 2px padding → canvas 60×60 centré.
   - `idle_1.png` : 68×68 → 60×60 (licorne centrée)
   - `idle_2.png` : 68×68 → 60×60 (licorne jambes écartées, 93% fill)

2. **Ajout à `ANIMAL_IDLE_FRAMES`** dans `TreeView.tsx` : la licorne passe au rendu `AnimatedAnimal` (natif, animé, facteur ×1.5).
   - Effective visual en idle_2 : ~89px (vs 20px avant)
   - Comparable au dragon (légendaire ~81px) — approprié pour prestige

## Files Changed
- `assets/garden/animals/licorne/idle_1.png` — recadré 68×68 → 60×60
- `assets/garden/animals/licorne/idle_2.png` — recadré 68×68 → 60×60
- `components/mascot/TreeView.tsx:1828` — ajout licorne dans `ANIMAL_IDLE_FRAMES`

## Resolution
root_cause: Sprite avec 74% de transparence horizontale + rendu SVG statique au lieu d'AnimatedAnimal
fix: Recadrage sprites + migration vers ANIMAL_IDLE_FRAMES
verification: tsc --noEmit — aucune erreur
