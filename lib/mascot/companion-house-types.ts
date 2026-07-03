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
  flipped?: boolean;   // miroir horizontal (scaleX -1) — défaut false
  color?: string;      // clé de teinte FURNITURE_TINTS (absent = original)
}

/**
 * Palette de teintes pour la recoloration (#7). Clé = 1 lettre stockée en CSV.
 * `color: null` = original (pas de surcouche). La teinte est rendue en surcouche
 * du sprite à faible opacité → l'ombrage d'origine reste visible.
 */
export const FURNITURE_TINTS: { key: string; label: string; color: string | null }[] = [
  { key: 'O', label: 'Original', color: null },
  { key: 'R', label: 'Rouge',    color: '#C8553D' },
  { key: 'B', label: 'Bleu',     color: '#4F7DCE' },
  { key: 'G', label: 'Vert',     color: '#5B9C5A' },
  { key: 'Y', label: 'Doré',     color: '#E0B341' },
  { key: 'P', label: 'Rose',     color: '#CE7DA5' },
  { key: 'V', label: 'Violet',   color: '#8B6DC7' },
];

/** Coût d'un changement de couleur (petit prix, #7/#8). Revenir à l'original est gratuit. */
export const RECOLOR_COST = 150;

/** Teinte hex pour une clé, ou null si original/inconnue. */
export function findTint(key: string | undefined): string | null {
  if (!key) return null;
  return FURNITURE_TINTS.find(t => t.key === key)?.color ?? null;
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

/** Surface d'accroche d'un meuble. Défaut `floor`. */
export type FurnitureSurface = 'floor' | 'wall';

/** Saison de disponibilité d'un meuble (sinon dispo toute l'année). */
export type FurnitureSeason = 'noel' | 'halloween' | 'ete';

/** Style esthétique d'un meuble (#10). Défaut `classique` (le set d'origine). */
export type FurnitureStyle = 'classique' | 'moderne' | 'ferme';

/**
 * Styles proposés en boutique. L'UI n'affiche un onglet de style QUE s'il a au
 * moins un meuble dont le sprite est réellement chargé → ajouter un pack = déposer
 * les PNG + lignes de registry, sans toucher à ce fichier.
 */
export const FURNITURE_STYLES: { key: FurnitureStyle; label: string; emoji: string }[] = [
  { key: 'classique', label: 'Classique', emoji: '🛋️' },
  { key: 'moderne',   label: 'Moderne',   emoji: '🪟' },
  { key: 'ferme',     label: 'Ferme',     emoji: '🌾' },
];

/** Style effectif d'un meuble (défaut `classique`). */
export function furnitureStyle(def: { style?: FurnitureStyle } | undefined): FurnitureStyle {
  return def?.style ?? 'classique';
}

/** Définition d'un meuble achetable. */
export interface FurnitureDefinition {
  id: string;
  label: string;              // nom FR affiché
  category: FurnitureCategory;
  cost: number;               // prix en feuilles 🍃
  scale?: number;             // taille de rendu relative (défaut 1) — tapis/grands meubles > 1
  surface?: FurnitureSurface; // 'wall' = ancré au mur du fond (défaut 'floor')
  season?: FurnitureSeason;   // dispo uniquement pendant sa fenêtre saisonnière
  style?: FurnitureStyle;     // esthétique (défaut 'classique')
}

/**
 * Bande verticale (fractions de hauteur) du mur du fond, où sont contraintes les
 * déco murales. Calée sur room-bg.png (mur crème en haut, sous la corniche).
 * Réglable à l'œil sur device.
 */
export const WALL_BAND = { min: 0.03, max: 0.17 } as const;

/** Fenêtres saisonnières (mois/jour). `noel` chevauche l'année (déc → jan). */
export const SEASON_WINDOWS: Record<FurnitureSeason, { startMonth: number; startDay: number; endMonth: number; endDay: number; label: string; emoji: string }> = {
  halloween: { startMonth: 10, startDay: 1,  endMonth: 11, endDay: 2,  label: 'Halloween', emoji: '🎃' },
  noel:      { startMonth: 12, startDay: 1,  endMonth: 1,  endDay: 6,  label: 'Noël',      emoji: '🎄' },
  ete:       { startMonth: 6,  startDay: 21, endMonth: 9,  endDay: 22, label: 'Été',       emoji: '☀️' },
};

/**
 * Catalogue mobilier (43 meubles). Prix calés sur l'économie du sink
 * (déblocage maison 100k) : de 800 à 90 000 🍃 selon le palier → sink bottomless.
 * Les sprites vivent dans components/companion-house/furniture-sprites.ts (par id).
 */
export const FURNITURE_CATALOG: FurnitureDefinition[] = [
  // Sol — les tapis couvrent une grande surface au sol
  { id: 'tapis',           label: 'Tapis',             category: 'sol',       cost: 800,   scale: 2.2 },
  { id: 'coussin',         label: 'Coussin',           category: 'sol',       cost: 1200,  scale: 0.9 },
  { id: 'tapis_motif',     label: 'Tapis à motifs',    category: 'sol',       cost: 1000,  scale: 2.2 },
  { id: 'pouf',            label: 'Pouf',              category: 'sol',       cost: 1500 },
  { id: 'panier_couchage', label: 'Panier couchage',   category: 'sol',       cost: 1800,  scale: 1.3 },
  { id: 'table_basse',     label: 'Table basse',       category: 'sol',       cost: 3500,  scale: 1.2 },
  // Meubles
  { id: 'banc_bois',       label: 'Banc en bois',      category: 'meuble',    cost: 4000,  scale: 1.3 },
  { id: 'coffre',          label: 'Coffre',            category: 'meuble',    cost: 4500,  scale: 1.15 },
  { id: 'etagere',         label: 'Étagère',           category: 'meuble',    cost: 5000,  scale: 1.35 },
  { id: 'commode',         label: 'Commode',           category: 'meuble',    cost: 5500,  scale: 1.3 },
  { id: 'fauteuil',        label: 'Fauteuil',          category: 'meuble',    cost: 6000,  scale: 1.25 },
  // Mur — ancrés au mur du fond
  { id: 'cadre_photo',     label: 'Cadre photo',       category: 'mur',       cost: 2000,  scale: 0.85, surface: 'wall' },
  { id: 'tableau',         label: 'Tableau',           category: 'mur',       cost: 3000,               surface: 'wall' },
  { id: 'fanion_guirlande',label: 'Guirlande fanions', category: 'mur',       cost: 3000,  scale: 1.4,  surface: 'wall' },
  { id: 'horloge',         label: 'Horloge',           category: 'mur',       cost: 3500,  scale: 0.85, surface: 'wall' },
  { id: 'etagere_murale',  label: 'Étagère murale',    category: 'mur',       cost: 4000,  scale: 1.2,  surface: 'wall' },
  { id: 'miroir',          label: 'Miroir',            category: 'mur',       cost: 5000,  scale: 1.15, surface: 'wall' },
  // Lumière
  { id: 'lampe',           label: 'Lampe',             category: 'lumiere',   cost: 2500 },
  { id: 'bougies',         label: 'Bougies',           category: 'lumiere',   cost: 2500,  scale: 0.8 },
  { id: 'applique',        label: 'Applique',          category: 'lumiere',   cost: 4500,  scale: 0.85, surface: 'wall' },
  { id: 'lampadaire',      label: 'Lampadaire',        category: 'lumiere',   cost: 6000,  scale: 1.4 },
  { id: 'cheminee',        label: 'Cheminée',          category: 'lumiere',   cost: 22000, scale: 1.5,  surface: 'wall' },
  // Compagnon
  { id: 'jouet_balle',     label: 'Balle',             category: 'compagnon', cost: 800,   scale: 0.7 },
  { id: 'gamelle',         label: 'Gamelle',           category: 'compagnon', cost: 1000,  scale: 0.8 },
  { id: 'griffoir',        label: 'Griffoir',          category: 'compagnon', cost: 2000,  scale: 1.1 },
  { id: 'niche_mini',      label: 'Niche',             category: 'compagnon', cost: 4000,  scale: 1.2 },
  { id: 'arbre_a_chat',    label: 'Arbre à chat',      category: 'compagnon', cost: 7000,  scale: 1.45 },
  // Nature
  { id: 'plante',          label: 'Plante',            category: 'nature',    cost: 1500 },
  { id: 'bouquet',         label: 'Bouquet',           category: 'nature',    cost: 1500,  scale: 0.85 },
  { id: 'grande_plante',   label: 'Grande plante',     category: 'nature',    cost: 5000,  scale: 1.45 },
  { id: 'terrarium',       label: 'Terrarium',         category: 'nature',    cost: 8000,  scale: 1.1 },
  // Lecture
  { id: 'pile_livres',     label: 'Pile de livres',    category: 'lecture',   cost: 2500,  scale: 0.85 },
  { id: 'lampe_lecture',   label: 'Lampe de lecture',  category: 'lecture',   cost: 4000 },
  { id: 'fauteuil_lecture',label: 'Fauteuil lecture',  category: 'lecture',   cost: 9000,  scale: 1.3 },
  // Jeux
  { id: 'cubes',           label: 'Cubes',             category: 'jeux',      cost: 1500,  scale: 0.9 },
  { id: 'tapis_jeu',       label: 'Tapis de jeu',      category: 'jeux',      cost: 3000,  scale: 2.2 },
  { id: 'petite_console',  label: 'Petite console',    category: 'jeux',      cost: 6000 },
  // Fête & saisons
  { id: 'guirlande_lumineuse', label: 'Guirlande lumineuse', category: 'fete', cost: 6000, scale: 1.4, surface: 'wall' },
  { id: 'citrouille',      label: 'Citrouille',        category: 'fete',      cost: 9000,  scale: 0.9,  season: 'halloween' },
  { id: 'sapin_mini',      label: 'Sapin de Noël',     category: 'fete',      cost: 12000, scale: 1.4,  season: 'noel' },
  // Prestige
  { id: 'coussin_etoile',  label: 'Coussin étoilé',    category: 'prestige',  cost: 40000, scale: 0.95 },
  { id: 'lanterne_magique',label: 'Lanterne magique',  category: 'prestige',  cost: 55000, scale: 1.1 },
  { id: 'statue_licorne',  label: 'Statue licorne',    category: 'prestige',  cost: 90000, scale: 1.3 },

  // ─── Pack STYLE « Moderne » (#10) ───────────────────────────────────────────
  // Set transverse prêt à l'emploi : déposer assets/companion-house/<id>.png +
  // 1 ligne dans furniture-sprites.ts → l'onglet « Moderne » apparaît en boutique.
  // Tant que le sprite manque, l'item est filtré (invisible), donc zéro risque.
  { id: 'tapis_moderne',       label: 'Tapis moderne',       category: 'sol',     cost: 1100, scale: 2.2, style: 'moderne' },
  { id: 'coussin_moderne',     label: 'Coussin moderne',     category: 'sol',     cost: 1300, scale: 0.9, style: 'moderne' },
  { id: 'table_basse_moderne', label: 'Table basse moderne', category: 'sol',     cost: 3800, scale: 1.2, style: 'moderne' },
  { id: 'fauteuil_moderne',    label: 'Fauteuil moderne',    category: 'meuble',  cost: 6500, scale: 1.25, style: 'moderne' },
  { id: 'etagere_moderne',     label: 'Étagère moderne',     category: 'meuble',  cost: 5200, scale: 1.35, style: 'moderne' },
  { id: 'lampe_moderne',       label: 'Lampe moderne',       category: 'lumiere', cost: 2700, style: 'moderne' },
  { id: 'plante_moderne',      label: 'Plante moderne',      category: 'nature',  cost: 1600, style: 'moderne' },
  { id: 'cadre_moderne',       label: 'Cadre moderne',       category: 'mur',     cost: 2200, scale: 0.85, surface: 'wall', style: 'moderne' },

  // ─── Pack STYLE « Ferme » (#10) ─────────────────────────────────────────────
  { id: 'tapis_ferme',         label: 'Tapis ferme',         category: 'sol',     cost: 1100, scale: 2.2, style: 'ferme' },
  { id: 'pouf_ferme',          label: 'Pouf ferme',          category: 'sol',     cost: 1600, style: 'ferme' },
  { id: 'table_ferme',         label: 'Table de ferme',      category: 'sol',     cost: 3800, scale: 1.2, style: 'ferme' },
  { id: 'fauteuil_ferme',      label: 'Fauteuil ferme',      category: 'meuble',  cost: 6500, scale: 1.25, style: 'ferme' },
  { id: 'coffre_ferme',        label: 'Coffre ferme',        category: 'meuble',  cost: 4800, scale: 1.15, style: 'ferme' },
  { id: 'lanterne_ferme',      label: 'Lanterne ferme',      category: 'lumiere', cost: 2700, scale: 0.85, style: 'ferme' },
  { id: 'plante_ferme',        label: 'Plante en pot ferme', category: 'nature',  cost: 1600, style: 'ferme' },
  { id: 'cadre_ferme',         label: 'Cadre ferme',         category: 'mur',     cost: 2200, scale: 0.85, surface: 'wall', style: 'ferme' },
];

/** Identifiant du bâtiment-maison dans BUILDING_CATALOG (déblocage one-shot 100k). */
export const COMPANION_HOUSE_BUILDING_ID = 'companion_house';

/** Coût de déblocage de la maison (gold-sink prestige end-game). */
export const COMPANION_HOUSE_UNLOCK_COST = 100_000;

export function findFurniture(id: string): FurnitureDefinition | undefined {
  return FURNITURE_CATALOG.find(f => f.id === id);
}
