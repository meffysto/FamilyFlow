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

/** Définition d'un meuble achetable. */
export interface FurnitureDefinition {
  id: string;
  labelKey: string;  // clé i18n (companionHouse.furniture.*)
  cost: number;      // prix en feuilles 🍃
  sprite?: number;   // require(...) — câblé en Phase 2
}

/**
 * Catalogue mobilier. Prix calés sur l'économie du sink (déblocage maison 100k) :
 * meubles de 800 à 90 000 🍃 selon le palier, pour un sink durable. Sprites câblés
 * au fur et à mesure de leur génération.
 */
export const FURNITURE_CATALOG: FurnitureDefinition[] = [
  { id: 'tapis',   labelKey: 'companionHouse.furniture.tapis',   cost: 800 },
  { id: 'gamelle', labelKey: 'companionHouse.furniture.gamelle', cost: 1000 },
  { id: 'coussin', labelKey: 'companionHouse.furniture.coussin', cost: 1200 },
  { id: 'plante',  labelKey: 'companionHouse.furniture.plante',  cost: 1500 },
  { id: 'lampe',   labelKey: 'companionHouse.furniture.lampe',   cost: 2500 },
  { id: 'tableau', labelKey: 'companionHouse.furniture.tableau', cost: 3000 },
];

/** Identifiant du bâtiment-maison dans BUILDING_CATALOG (déblocage one-shot 100k). */
export const COMPANION_HOUSE_BUILDING_ID = 'companion_house';

/** Coût de déblocage de la maison (gold-sink prestige end-game). */
export const COMPANION_HOUSE_UNLOCK_COST = 100_000;

export function findFurniture(id: string): FurnitureDefinition | undefined {
  return FURNITURE_CATALOG.find(f => f.id === id);
}
