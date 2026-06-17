# Packs de style — Maison du compagnon (#10)

Le **code est prêt** : la dimension `style` existe dans le catalogue, la boutique
affiche des onglets de style, et chaque item est filtré tant que son sprite n'est
pas chargé. Pour activer un style, il suffit de **fournir les PNG** et de
**décommenter** la ligne de registry correspondante.

## Étapes pour activer un pack

1. Génère les PNG (ton outil habituel — nano-banana / MidJourney, **pas** le
   pixel-art) et nomme-les exactement comme les `id` ci-dessous, en `.png`.
2. Dépose-les dans `assets/companion-house/`.
3. Dans `components/companion-house/furniture-sprites.ts`, **décommente** la ligne
   `require()` de chaque id ajouté.
4. C'est tout. L'onglet de style apparaît automatiquement en boutique dès qu'au
   moins 2 styles ont des assets (sinon il reste masqué).

Les prix / labels / catégories / `surface`/`scale` sont déjà définis dans
`lib/mascot/companion-house-types.ts` (sections « Pack STYLE »). Tu peux les ajuster.

## ids attendus

**Moderne** : `tapis_moderne`, `coussin_moderne`, `table_basse_moderne`,
`fauteuil_moderne`, `etagere_moderne`, `lampe_moderne`, `plante_moderne`,
`cadre_moderne` (mur).

**Ferme** : `tapis_ferme`, `pouf_ferme`, `table_ferme`, `fauteuil_ferme`,
`coffre_ferme`, `lanterne_ferme`, `plante_ferme`, `cadre_ferme` (mur).

(Tu peux en ajouter d'autres : 1 entrée catalogue + 1 PNG + 1 ligne registry.)

## Spéc visuelle (pour matcher le set existant)

- **Style** : illustration peinte douce, ombrage lisse, type « Stardew Valley HD »
  (cf. `.planning/sketches/005-maison-interieur/maison-assets-v2.txt`). **Pas** de
  pixel-art.
- **Vue** : top-down ~30° (3/4 du dessus), cohérente avec `room-bg.png`.
- **Fond** : transparent (PNG alpha).
- **Cadrage** : objet centré, canvas carré (~512×512), marge faible.
- **Lumière** : douce, venant du haut-gauche (comme les sprites actuels).
- **Cohérence pack** : un même style doit couvrir plusieurs catégories (sol,
  meuble, mur, lumière, nature…) pour que l'ensemble s'assortisse — pas juste un
  tapis isolé.
