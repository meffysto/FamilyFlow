/**
 * presets.ts — Régimes qui s'accompagnent automatiquement d'autres restrictions
 *
 * Quand un utilisateur ajoute un régime "à effets de bord" (ex: femme enceinte),
 * on pré-remplit automatiquement les restrictions associées dans la même
 * catégorie Régimes alimentaires — pour éviter qu'il les saisisse une à une.
 */

/**
 * Restrictions à appliquer automatiquement pour le régime "femme enceinte".
 * Source : recommandations Santé publique France (listériose, toxoplasmose, alcool fœtal).
 * Texte libre — apparaît tel quel dans les chips Régimes alimentaires.
 */
export const PREGNANCY_RESTRICTIONS: string[] = [
  'Lait ou fromages au lait cru',
  'Charcuterie crue',
  'Poisson cru / sushi / fumé',
  'Viande crue ou peu cuite',
  'Œufs crus',
  'Foie et abats',
  'Coquillages crus',
  'Alcool',
  'Café (modération)',
];

/**
 * Map régime → restrictions associées à pré-remplir dans la même catégorie.
 * Évolutif : ajouter d'autres régimes à effets de bord ici.
 */
export const REGIME_PRESET_ITEMS: Record<string, string[]> = {
  femme_enceinte: PREGNANCY_RESTRICTIONS,
};

/**
 * Retourne les nouveaux items à fusionner dans la catégorie Régimes
 * quand un régime à preset est ajouté. Filtre les doublons.
 */
export function getPresetItemsToAdd(
  regimeId: string,
  currentItems: string[],
): string[] {
  const preset = REGIME_PRESET_ITEMS[regimeId];
  if (!preset) return [];
  return preset.filter(item => !currentItems.includes(item));
}
