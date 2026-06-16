// furniture-sprites.ts — map id → sprite require() pour la maison du compagnon.
// require() doit rester des littéraux statiques (résolution Metro).

export const FURNITURE_SPRITES: Record<string, any> = {
  // Sol
  tapis: require('../../assets/companion-house/tapis.png'),
  tapis_motif: require('../../assets/companion-house/tapis_motif.png'),
  coussin: require('../../assets/companion-house/coussin.png'),
  pouf: require('../../assets/companion-house/pouf.png'),
  panier_couchage: require('../../assets/companion-house/panier_couchage.png'),
  table_basse: require('../../assets/companion-house/table_basse.png'),
  // Meubles
  banc_bois: require('../../assets/companion-house/banc_bois.png'),
  coffre: require('../../assets/companion-house/coffre.png'),
  etagere: require('../../assets/companion-house/etagere.png'),
  commode: require('../../assets/companion-house/commode.png'),
  fauteuil: require('../../assets/companion-house/fauteuil.png'),
  // Mur
  cadre_photo: require('../../assets/companion-house/cadre_photo.png'),
  tableau: require('../../assets/companion-house/tableau.png'),
  horloge: require('../../assets/companion-house/horloge.png'),
  etagere_murale: require('../../assets/companion-house/etagere_murale.png'),
  miroir: require('../../assets/companion-house/miroir.png'),
  fanion_guirlande: require('../../assets/companion-house/fanion_guirlande.png'),
  // Lumière
  lampe: require('../../assets/companion-house/lampe.png'),
  bougies: require('../../assets/companion-house/bougies.png'),
  applique: require('../../assets/companion-house/applique.png'),
  lampadaire: require('../../assets/companion-house/lampadaire.png'),
  cheminee: require('../../assets/companion-house/cheminee.png'),
  // Compagnon
  gamelle: require('../../assets/companion-house/gamelle.png'),
  jouet_balle: require('../../assets/companion-house/jouet_balle.png'),
  griffoir: require('../../assets/companion-house/griffoir.png'),
  niche_mini: require('../../assets/companion-house/niche_mini.png'),
  arbre_a_chat: require('../../assets/companion-house/arbre_a_chat.png'),
  // Nature
  plante: require('../../assets/companion-house/plante.png'),
  bouquet: require('../../assets/companion-house/bouquet.png'),
  grande_plante: require('../../assets/companion-house/grande_plante.png'),
  terrarium: require('../../assets/companion-house/terrarium.png'),
  // Lecture
  pile_livres: require('../../assets/companion-house/pile_livres.png'),
  lampe_lecture: require('../../assets/companion-house/lampe_lecture.png'),
  fauteuil_lecture: require('../../assets/companion-house/fauteuil_lecture.png'),
  // Jeux
  cubes: require('../../assets/companion-house/cubes.png'),
  tapis_jeu: require('../../assets/companion-house/tapis_jeu.png'),
  petite_console: require('../../assets/companion-house/petite_console.png'),
  // Fête & saisons
  guirlande_lumineuse: require('../../assets/companion-house/guirlande_lumineuse.png'),
  citrouille: require('../../assets/companion-house/citrouille.png'),
  sapin_mini: require('../../assets/companion-house/sapin_mini.png'),
  // Prestige
  coussin_etoile: require('../../assets/companion-house/coussin_etoile.png'),
  lanterne_magique: require('../../assets/companion-house/lanterne_magique.png'),
  statue_licorne: require('../../assets/companion-house/statue_licorne.png'),
};

export const PET_FALLBACK = undefined;
