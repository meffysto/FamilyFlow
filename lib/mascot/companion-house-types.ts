/**
 * companion-house-types.ts — Maison du compagnon (sink de feuilles, placement libre)
 *
 * Types + catalogue mobilier. AUCUNE dépendance à Profile (évite l'import circulaire).
 * Le déblocage de la maison est porté par le bâtiment `companion_house` (farm_buildings) ;
 * ce module ne décrit QUE le meublage.
 */

/** Un meuble posé dans la pièce. Répétitions autorisées → sink infini. */
export interface PlacedFurniture {
  furnitureId: string; // ref FURNITURE_CATALOG
  x: number;           // position fractionnaire 0-1 (gauche → droite)
  y: number;           // position fractionnaire 0-1 (haut → bas)
  placedAt: string;    // ISO datetime du placement
}

/**
 * État de la maison du compagnon.
 * `unlocked` = déblocage one-shot payé (100k 🍃). Identité d'une instance de meuble
 * = son index dans `placedFurniture` (runtime).
 */
export interface CompanionHouseData {
  unlocked: boolean;
  unlockedAt?: string;          // ISO datetime du déblocage
  placedFurniture: PlacedFurniture[];
}

/** Catégories de mobilier (sections de la boutique). */
export type FurnitureCategory =
  | 'sol' | 'meuble' | 'mur' | 'lumiere' | 'compagnon'
  | 'nature' | 'lecture' | 'jeux' | 'fete' | 'prestige';

export const FURNITURE_CATEGORIES: { key: FurnitureCategory; label: string }[] = [
  { key: 'sol',       label: 'Sol' },
  { key: 'meuble',    label: 'Meubles' },
  { key: 'mur',       label: 'Mur' },
  { key: 'lumiere',   label: 'Lumière' },
  { key: 'compagnon', label: 'Compagnon' },
  { key: 'nature',    label: 'Nature' },
  { key: 'lecture',   label: 'Lecture' },
  { key: 'jeux',      label: 'Jeux' },
  { key: 'fete',      label: 'Fête & saisons' },
  { key: 'prestige',  label: 'Prestige' },
];

/** Définition d'un meuble achetable. */
export interface FurnitureDefinition {
  id: string;
  label: string;              // nom FR affiché
  category: FurnitureCategory;
  cost: number;               // prix en feuilles 🍃
}

/**
 * Catalogue mobilier (43 meubles). Prix calés sur l'économie du sink
 * (déblocage maison 100k) : de 800 à 90 000 🍃 selon le palier → sink bottomless.
 * Les sprites vivent dans components/companion-house/furniture-sprites.ts (par id).
 */
export const FURNITURE_CATALOG: FurnitureDefinition[] = [
  // Sol
  { id: 'tapis',           label: 'Tapis',             category: 'sol',       cost: 800 },
  { id: 'coussin',         label: 'Coussin',           category: 'sol',       cost: 1200 },
  { id: 'tapis_motif',     label: 'Tapis à motifs',    category: 'sol',       cost: 1000 },
  { id: 'pouf',            label: 'Pouf',              category: 'sol',       cost: 1500 },
  { id: 'panier_couchage', label: 'Panier couchage',   category: 'sol',       cost: 1800 },
  { id: 'table_basse',     label: 'Table basse',       category: 'sol',       cost: 3500 },
  // Meubles
  { id: 'banc_bois',       label: 'Banc en bois',      category: 'meuble',    cost: 4000 },
  { id: 'coffre',          label: 'Coffre',            category: 'meuble',    cost: 4500 },
  { id: 'etagere',         label: 'Étagère',           category: 'meuble',    cost: 5000 },
  { id: 'commode',         label: 'Commode',           category: 'meuble',    cost: 5500 },
  { id: 'fauteuil',        label: 'Fauteuil',          category: 'meuble',    cost: 6000 },
  // Mur
  { id: 'cadre_photo',     label: 'Cadre photo',       category: 'mur',       cost: 2000 },
  { id: 'tableau',         label: 'Tableau',           category: 'mur',       cost: 3000 },
  { id: 'fanion_guirlande',label: 'Guirlande fanions', category: 'mur',       cost: 3000 },
  { id: 'horloge',         label: 'Horloge',           category: 'mur',       cost: 3500 },
  { id: 'etagere_murale',  label: 'Étagère murale',    category: 'mur',       cost: 4000 },
  { id: 'miroir',          label: 'Miroir',            category: 'mur',       cost: 5000 },
  // Lumière
  { id: 'lampe',           label: 'Lampe',             category: 'lumiere',   cost: 2500 },
  { id: 'bougies',         label: 'Bougies',           category: 'lumiere',   cost: 2500 },
  { id: 'applique',        label: 'Applique',          category: 'lumiere',   cost: 4500 },
  { id: 'lampadaire',      label: 'Lampadaire',        category: 'lumiere',   cost: 6000 },
  { id: 'cheminee',        label: 'Cheminée',          category: 'lumiere',   cost: 22000 },
  // Compagnon
  { id: 'jouet_balle',     label: 'Balle',             category: 'compagnon', cost: 800 },
  { id: 'gamelle',         label: 'Gamelle',           category: 'compagnon', cost: 1000 },
  { id: 'griffoir',        label: 'Griffoir',          category: 'compagnon', cost: 2000 },
  { id: 'niche_mini',      label: 'Niche',             category: 'compagnon', cost: 4000 },
  { id: 'arbre_a_chat',    label: 'Arbre à chat',      category: 'compagnon', cost: 7000 },
  // Nature
  { id: 'plante',          label: 'Plante',            category: 'nature',    cost: 1500 },
  { id: 'bouquet',         label: 'Bouquet',           category: 'nature',    cost: 1500 },
  { id: 'grande_plante',   label: 'Grande plante',     category: 'nature',    cost: 5000 },
  { id: 'terrarium',       label: 'Terrarium',         category: 'nature',    cost: 8000 },
  // Lecture
  { id: 'pile_livres',     label: 'Pile de livres',    category: 'lecture',   cost: 2500 },
  { id: 'lampe_lecture',   label: 'Lampe de lecture',  category: 'lecture',   cost: 4000 },
  { id: 'fauteuil_lecture',label: 'Fauteuil lecture',  category: 'lecture',   cost: 9000 },
  // Jeux
  { id: 'cubes',           label: 'Cubes',             category: 'jeux',      cost: 1500 },
  { id: 'tapis_jeu',       label: 'Tapis de jeu',      category: 'jeux',      cost: 3000 },
  { id: 'petite_console',  label: 'Petite console',    category: 'jeux',      cost: 6000 },
  // Fête & saisons
  { id: 'guirlande_lumineuse', label: 'Guirlande lumineuse', category: 'fete', cost: 6000 },
  { id: 'citrouille',      label: 'Citrouille',        category: 'fete',      cost: 9000 },
  { id: 'sapin_mini',      label: 'Sapin de Noël',     category: 'fete',      cost: 12000 },
  // Prestige
  { id: 'coussin_etoile',  label: 'Coussin étoilé',    category: 'prestige',  cost: 40000 },
  { id: 'lanterne_magique',label: 'Lanterne magique',  category: 'prestige',  cost: 55000 },
  { id: 'statue_licorne',  label: 'Statue licorne',    category: 'prestige',  cost: 90000 },
];

/** Identifiant du bâtiment-maison dans BUILDING_CATALOG (déblocage one-shot 100k). */
export const COMPANION_HOUSE_BUILDING_ID = 'companion_house';

/** Coût de déblocage de la maison (gold-sink prestige end-game). */
export const COMPANION_HOUSE_UNLOCK_COST = 100_000;

export function findFurniture(id: string): FurnitureDefinition | undefined {
  return FURNITURE_CATALOG.find(f => f.id === id);
}
