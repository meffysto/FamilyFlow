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

/** État du meublage. Identité d'une instance = son index dans la liste (runtime). */
export interface CompanionHouseData {
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
 * Catalogue v1 — 6 meubles. Prix calés sur le sketch validé (≈ 1-3 jours de jeu / meuble,
 * base ~30 🍃/jour). Sprites câblés en Phase 2.
 */
export const FURNITURE_CATALOG: FurnitureDefinition[] = [
  { id: 'tapis',   labelKey: 'companionHouse.furniture.tapis',   cost: 40 },
  { id: 'coussin', labelKey: 'companionHouse.furniture.coussin', cost: 55 },
  { id: 'plante',  labelKey: 'companionHouse.furniture.plante',  cost: 60 },
  { id: 'lampe',   labelKey: 'companionHouse.furniture.lampe',   cost: 70 },
  { id: 'tableau', labelKey: 'companionHouse.furniture.tableau', cost: 85 },
  { id: 'gamelle', labelKey: 'companionHouse.furniture.gamelle', cost: 95 },
];

/** Identifiant du bâtiment-maison dans BUILDING_CATALOG (déblocage one-shot 100k). */
export const COMPANION_HOUSE_BUILDING_ID = 'companion_house';

/** Coût de déblocage de la maison (gold-sink prestige end-game). */
export const COMPANION_HOUSE_UNLOCK_COST = 100_000;

export function findFurniture(id: string): FurnitureDefinition | undefined {
  return FURNITURE_CATALOG.find(f => f.id === id);
}
