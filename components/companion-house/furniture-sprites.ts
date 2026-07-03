// furniture-sprites.ts — map id → sprite require() pour la maison du compagnon.
// require() doit rester des littéraux statiques (résolution Metro).

export const FURNITURE_SPRITES: Record<string, any> = {
  // Sol
  tapis: require('../../assets/companion-house-pixel/tapis.png'),
  tapis_motif: require('../../assets/companion-house-pixel/tapis_motif.png'),
  coussin: require('../../assets/companion-house-pixel/coussin.png'),
  pouf: require('../../assets/companion-house-pixel/pouf.png'),
  panier_couchage: require('../../assets/companion-house-pixel/panier_couchage.png'),
  table_basse: require('../../assets/companion-house-pixel/table_basse.png'),
  // Meubles
  banc_bois: require('../../assets/companion-house-pixel/banc_bois.png'),
  coffre: require('../../assets/companion-house-pixel/coffre.png'),
  etagere: require('../../assets/companion-house-pixel/etagere.png'),
  commode: require('../../assets/companion-house-pixel/commode.png'),
  fauteuil: require('../../assets/companion-house-pixel/fauteuil.png'),
  // Mur
  cadre_photo: require('../../assets/companion-house-pixel/cadre_photo.png'),
  tableau: require('../../assets/companion-house-pixel/tableau.png'),
  horloge: require('../../assets/companion-house-pixel/horloge.png'),
  etagere_murale: require('../../assets/companion-house-pixel/etagere_murale.png'),
  miroir: require('../../assets/companion-house-pixel/miroir.png'),
  fanion_guirlande: require('../../assets/companion-house-pixel/fanion_guirlande.png'),
  // Lumière
  lampe: require('../../assets/companion-house-pixel/lampe.png'),
  bougies: require('../../assets/companion-house-pixel/bougies.png'),
  applique: require('../../assets/companion-house-pixel/applique.png'),
  lampadaire: require('../../assets/companion-house-pixel/lampadaire.png'),
  cheminee: require('../../assets/companion-house-pixel/cheminee.png'),
  // Compagnon
  gamelle: require('../../assets/companion-house-pixel/gamelle.png'),
  jouet_balle: require('../../assets/companion-house-pixel/jouet_balle.png'),
  griffoir: require('../../assets/companion-house-pixel/griffoir.png'),
  niche_mini: require('../../assets/companion-house-pixel/niche_mini.png'),
  arbre_a_chat: require('../../assets/companion-house-pixel/arbre_a_chat.png'),
  // Nature
  plante: require('../../assets/companion-house-pixel/plante.png'),
  bouquet: require('../../assets/companion-house-pixel/bouquet.png'),
  grande_plante: require('../../assets/companion-house-pixel/grande_plante.png'),
  terrarium: require('../../assets/companion-house-pixel/terrarium.png'),
  // Lecture
  pile_livres: require('../../assets/companion-house-pixel/pile_livres.png'),
  lampe_lecture: require('../../assets/companion-house-pixel/lampe_lecture.png'),
  fauteuil_lecture: require('../../assets/companion-house-pixel/fauteuil_lecture.png'),
  // Jeux
  cubes: require('../../assets/companion-house-pixel/cubes.png'),
  tapis_jeu: require('../../assets/companion-house-pixel/tapis_jeu.png'),
  petite_console: require('../../assets/companion-house-pixel/petite_console.png'),
  // Fête & saisons
  guirlande_lumineuse: require('../../assets/companion-house-pixel/guirlande_lumineuse.png'),
  citrouille: require('../../assets/companion-house-pixel/citrouille.png'),
  sapin_mini: require('../../assets/companion-house-pixel/sapin_mini.png'),
  // Prestige
  coussin_etoile: require('../../assets/companion-house-pixel/coussin_etoile.png'),
  lanterne_magique: require('../../assets/companion-house-pixel/lanterne_magique.png'),
  statue_licorne: require('../../assets/companion-house-pixel/statue_licorne.png'),

  // ─── Packs STYLE (#10) ──────
  // Les entrées catalogue (companion-house-types.ts) sont prêtes ; les sprites
  // enregistrés ici rendent les items visibles en boutique.
  // Style « Moderne » :
  tapis_moderne: require('../../assets/companion-house-pixel/tapis_moderne.png'),
  coussin_moderne: require('../../assets/companion-house-pixel/coussin_moderne.png'),
  table_basse_moderne: require('../../assets/companion-house-pixel/table_basse_moderne.png'),
  fauteuil_moderne: require('../../assets/companion-house-pixel/fauteuil_moderne.png'),
  etagere_moderne: require('../../assets/companion-house-pixel/etagere_moderne.png'),
  lampe_moderne: require('../../assets/companion-house-pixel/lampe_moderne.png'),
  plante_moderne: require('../../assets/companion-house-pixel/plante_moderne.png'),
  cadre_moderne: require('../../assets/companion-house-pixel/cadre_moderne.png'),
  // Style « Ferme » :
  tapis_ferme: require('../../assets/companion-house-pixel/tapis_ferme.png'),
  pouf_ferme: require('../../assets/companion-house-pixel/pouf_ferme.png'),
  table_ferme: require('../../assets/companion-house-pixel/table_ferme.png'),
  fauteuil_ferme: require('../../assets/companion-house-pixel/fauteuil_ferme.png'),
  coffre_ferme: require('../../assets/companion-house-pixel/coffre_ferme.png'),
  lanterne_ferme: require('../../assets/companion-house-pixel/lanterne_ferme.png'),
  plante_ferme: require('../../assets/companion-house-pixel/plante_ferme.png'),
  cadre_ferme: require('../../assets/companion-house-pixel/cadre_ferme.png'),
};

export const PET_FALLBACK = undefined;
