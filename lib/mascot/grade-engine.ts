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

/** Identifiant de grade de récolte */
export type HarvestGrade = 'ordinaire' | 'beau' | 'superbe' | 'parfait';

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
