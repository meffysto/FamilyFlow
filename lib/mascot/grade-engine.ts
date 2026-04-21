// ─────────────────────────────────────────────
// Ferme — Moteur de grades de récolte (Phase A)
// ─────────────────────────────────────────────
//
// Activé uniquement si la tech culture-5 « Agriculture de précision » est
// débloquée. Roll per-récolte avec la distribution 70/20/8/2 et un
// multiplicateur de coins bonus ×1 / ×1.5 / ×2.5 / ×4 appliqué en bonus
// additif (delta pur, pas un total — voir useFarm.harvest).
//
// Module pur sans dépendance — RNG injectable pour tests déterministes.

import type { HarvestInventory } from './types';

/** Identifiant de grade de récolte */
export type HarvestGrade = 'ordinaire' | 'beau' | 'superbe' | 'parfait';

/** Ordre croissant des grades — source de vérité unique pour comparaisons */
export const GRADE_ORDER: HarvestGrade[] = ['ordinaire', 'beau', 'superbe', 'parfait'];

/**
 * Seuils cumulatifs (borne haute exclusive). Un roll `r` appartient au
 * premier grade dont `r < upper`.
 *
 *   [0.00, 0.70) → ordinaire (70%)
 *   [0.70, 0.90) → beau      (20%)
 *   [0.90, 0.98) → superbe   (8%)
 *   [0.98, 1.00] → parfait   (2%)
 */
export const GRADE_THRESHOLDS: Array<[HarvestGrade, number]> = [
  ['ordinaire', 0.70],
  ['beau',     0.90],
  ['superbe',  0.98],
  ['parfait',  1.00],
];

/** Multiplicateurs appliqués au coût de vente (harvestReward × qty) */
export const GRADE_MULTIPLIERS: Record<HarvestGrade, number> = {
  ordinaire: 1,
  beau:      1.5,
  superbe:   2.5,
  parfait:   4,
};

/** Emojis visuels — utilisés dans le toast de récolte */
export const GRADE_EMOJIS: Record<HarvestGrade, string> = {
  ordinaire: '⚪',
  beau:      '🟢',
  superbe:   '🟡',
  parfait:   '🟣',
};

/**
 * Roll un grade de récolte.
 * RNG injectable pour tests déterministes (Math.random par défaut).
 */
export function rollHarvestGrade(rng: () => number = Math.random): HarvestGrade {
  const r = rng();
  for (const [grade, upper] of GRADE_THRESHOLDS) {
    if (r < upper) return grade;
  }
  // Fallback rng=1.0 (borne haute atteinte) — parfait.
  return 'parfait';
}

/** Retourne le multiplicateur de coins bonus pour un grade donné */
export function getGradeMultiplier(grade: HarvestGrade): number {
  return GRADE_MULTIPLIERS[grade];
}

/** Retourne la clé i18n pour l'étiquette d'un grade */
export function getGradeLabelKey(grade: HarvestGrade): string {
  return `farm.grade.${grade}`;
}

/** Retourne l'emoji associé à un grade */
export function getGradeEmoji(grade: HarvestGrade): string {
  return GRADE_EMOJIS[grade];
}

// ─────────────────────────────────────────────
// Phase B — Inventaire par grade (maillon faible)
// ─────────────────────────────────────────────

/** Compare deux grades. Négatif si a < b, positif si a > b, 0 si égaux. */
export function compareGrades(a: HarvestGrade, b: HarvestGrade): number {
  return GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b);
}

/**
 * Retourne le grade le plus faible d'une liste (règle du maillon faible).
 * Fallback 'ordinaire' si la liste est vide (résilience).
 */
export function getWeakestGrade(grades: HarvestGrade[]): HarvestGrade {
  if (grades.length === 0) return 'ordinaire';
  return grades.reduce<HarvestGrade>(
    (min, g) => (compareGrades(g, min) < 0 ? g : min),
    grades[0],
  );
}

/**
 * Alias sémantique — multiplicateur appliqué au prix de vente marché.
 * Identique à getGradeMultiplier (×1 / ×1.5 / ×2.5 / ×4).
 */
export const gradeSellMultiplier = getGradeMultiplier;

/** Retourne le record grade→qty pour un itemId, en supportant le legacy (number). */
function readGradedEntry(
  inv: HarvestInventory,
  itemId: string,
): Partial<Record<HarvestGrade, number>> {
  const entry = inv[itemId];
  if (entry == null) return {};
  if (typeof entry === 'number') {
    // Legacy inline : traiter comme ordinaire (ne devrait pas arriver après migration)
    return { ordinaire: entry };
  }
  return entry;
}

/**
 * Ajoute qty à inv[itemId][grade] (mutation in-place).
 * No-op si qty <= 0. Upgrade silencieux legacy number → { ordinaire: n }.
 */
export function addToGradedInventory(
  inv: HarvestInventory,
  itemId: string,
  grade: HarvestGrade,
  qty: number,
): HarvestInventory {
  if (qty <= 0) return inv;
  const entry = readGradedEntry(inv, itemId);
  entry[grade] = (entry[grade] ?? 0) + qty;
  inv[itemId] = entry;
  return inv;
}

/**
 * Retire qty de inv[itemId][grade] (floor 0, pas négatif).
 * No-op si qty <= 0 ou itemId absent.
 */
export function removeFromGradedInventory(
  inv: HarvestInventory,
  itemId: string,
  grade: HarvestGrade,
  qty: number,
): HarvestInventory {
  if (qty <= 0 || inv[itemId] == null) return inv;
  const entry = readGradedEntry(inv, itemId);
  const current = entry[grade] ?? 0;
  entry[grade] = Math.max(0, current - qty);
  inv[itemId] = entry;
  return inv;
}

/** Lit la qty d'un itemId pour un grade donné (0 si absent). */
export function countItemByGrade(
  inv: HarvestInventory,
  itemId: string,
  grade: HarvestGrade,
): number {
  const entry = inv[itemId];
  if (entry == null) return 0;
  if (typeof entry === 'number') {
    // Legacy : toute la qty est considérée ordinaire
    return grade === 'ordinaire' ? entry : 0;
  }
  return entry[grade] ?? 0;
}

/**
 * Totalise la qty d'un itemId tous grades confondus.
 * Utilitaire pour les call sites qui raisonnent en total (affichages agrégés,
 * expeditions, gifts, codex discovery) et n'ont pas besoin du détail grade.
 */
export function countItemTotal(
  inv: HarvestInventory,
  itemId: string,
): number {
  const entry = inv[itemId];
  if (entry == null) return 0;
  if (typeof entry === 'number') return entry;
  let sum = 0;
  for (const g of GRADE_ORDER) sum += entry[g] ?? 0;
  return sum;
}

