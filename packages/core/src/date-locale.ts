/**
 * date-locale.ts — Helper centralisé pour les dates localisées
 *
 * Fournit la locale date-fns et le format de date selon la langue i18n.
 * Utilisé partout à la place de `import { fr } from 'date-fns/locale'`.
 */

import i18n from 'i18next';
import { fr } from 'date-fns/locale/fr';
import { enUS } from 'date-fns/locale/en-US';

/** Retourne la locale date-fns correspondant à la langue i18n courante */
export function getDateLocale() {
  return i18n.language?.startsWith('en') ? enUS : fr;
}

/**
 * Formate une date YYYY-MM-DD pour l'affichage selon la langue :
 * - FR : DD/MM/YYYY
 * - EN : MM/DD/YYYY
 */
export function formatDateLocalized(dateStr: string): string {
  if (!dateStr) return '';
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateStr;
  if (i18n.language?.startsWith('en')) {
    return `${m[2]}/${m[3]}/${m[1]}`;
  }
  return `${m[3]}/${m[2]}/${m[1]}`;
}
