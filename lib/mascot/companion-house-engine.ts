/**
 * companion-house-engine.ts — (dé)sérialisation du meublage de la maison du compagnon.
 *
 * Format CSV pipe/colon aligné sur building-engine.ts :
 *   "furnitureId:x:y:placedAtISO|furnitureId:x:y:placedAtISO|..."
 * Coords fractionnaires strictement clampées/validées [0,1]. Duplicatas autorisés.
 * placedAt est sérialisé en dernier car un ISO contient des `:` (cf. parseBuildings).
 */

import type { CompanionHouseData, PlacedFurniture } from './companion-house-types';

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Sérialise les meubles posés en CSV. x/y arrondis à 4 décimales. */
export function serializePlacedFurniture(items: PlacedFurniture[]): string {
  return items
    .map(f => `${f.furnitureId}:${clamp01(f.x).toFixed(4)}:${clamp01(f.y).toFixed(4)}:${f.placedAt}`)
    .join('|');
}

/**
 * Parse le CSV des meubles. Rejette les entrées invalides (id manquant,
 * coords NaN ou hors [0,1]). placedAt = tout ce qui suit x,y (un ISO contient des `:`).
 */
export function parsePlacedFurniture(csv: string | undefined): PlacedFurniture[] {
  if (!csv || !csv.trim()) return [];
  return csv
    .split('|')
    .map(entry => {
      const parts = entry.trim().split(':');
      if (parts.length < 3) return null;
      const [furnitureId, xStr, yStr, ...rest] = parts;
      const x = parseFloat(xStr);
      const y = parseFloat(yStr);
      if (!furnitureId || isNaN(x) || isNaN(y) || x < 0 || x > 1 || y < 0 || y > 1) return null;
      return { furnitureId, x, y, placedAt: rest.join(':') } as PlacedFurniture;
    })
    .filter((f): f is PlacedFurniture => f !== null);
}

/**
 * Parse le bloc maison depuis le frontmatter (champ `companion_house`).
 * Renvoie null si vide ET aucun meuble (l'état "débloquée" vit dans farm_buildings,
 * pas ici — une pièce débloquée mais vide = companionHouse null = pièce vide à l'écran).
 */
export function parseCompanionHouse(raw: string | undefined): CompanionHouseData | null {
  const placedFurniture = parsePlacedFurniture(raw);
  if (placedFurniture.length === 0) return null;
  return { placedFurniture };
}

/** Sérialise le meublage. Chaîne vide si aucun meuble. */
export function serializeCompanionHouse(data: CompanionHouseData): string {
  return serializePlacedFurniture(data.placedFurniture);
}
