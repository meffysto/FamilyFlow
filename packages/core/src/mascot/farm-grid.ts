// ─────────────────────────────────────────────
// Ferme — Grille des parcelles (positions top-down)
// ─────────────────────────────────────────────

/** Position d'une parcelle sur le diorama */
export interface GridPosition {
  index: number;
  x: number;  // fraction de la largeur du conteneur (0-1)
  y: number;  // fraction de la hauteur du conteneur (0-1)
}

/**
 * 10 parcelles disposees autour de l'arbre (centre ~ 0.5, 0.4).
 * Les parcelles proches (index bas) sont deblocees en premier.
 * Positionnees sur les cotes pour ne pas masquer l'arbre.
 */
export const FARM_GRID: GridPosition[] = [
  // Premieres parcelles (proches, faciles d'acces)
  { index: 0, x: 0.22, y: 0.62 },
  { index: 1, x: 0.78, y: 0.62 },
  // Deuxieme rang
  { index: 2, x: 0.12, y: 0.48 },
  { index: 3, x: 0.88, y: 0.48 },
  // Troisieme rang (plus loin)
  { index: 4, x: 0.20, y: 0.78 },
  { index: 5, x: 0.80, y: 0.78 },
  // Quatrieme rang
  { index: 6, x: 0.10, y: 0.68 },
  { index: 7, x: 0.90, y: 0.68 },
  // Cinquieme rang (loin, haut niveau)
  { index: 8, x: 0.30, y: 0.88 },
  { index: 9, x: 0.70, y: 0.88 },
];

/** Taille d'une parcelle en px (cote du carre) */
export const PLOT_SIZE = 52;
