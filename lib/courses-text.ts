/**
 * courses-text.ts — Helpers split/join texte d'un item de courses
 *
 * Utilisés par CourseItemEditor pour pré-remplir/reconstituer le texte d'un
 * CourseItem à partir de deux champs UI : nom + qté.
 *
 * Le round-trip n'est pas strict pour les unités comptables (sachet, paquet…)
 * : on remet l'unité dans le nom pour ne pas perdre l'info, et l'utilisateur
 * voit "sachet de levure" comme nom et "3" comme qté.
 */

import { COURSE_TEXT_RE } from './auto-courses';

export interface SplitCourseText {
  quantity: string;
  name: string;
}

/** Sépare le texte d'un item en { quantity, name } pour édition. */
export function splitCourseText(text: string): SplitCourseText {
  const trimmed = text.trim();
  const m = trimmed.match(COURSE_TEXT_RE);
  if (!m) return { quantity: '', name: trimmed };

  const num = m[1];
  const unit = (m[2] || '').trim();
  const name = (m[3] || '').trim();

  // Unité poids/volume → on garde dans la qté ("120g", "1.5kg")
  const isWeight = /^(g|kg|ml|cl|dl|l|cs|cc|càs|càc|tasse|pincée|tbsp|tsp)$/i.test(unit);

  if (!unit) return { quantity: num, name };
  if (isWeight) return { quantity: `${num}${unit}`, name };
  // Comptable (sachet, paquet, boîte…) : on garde la qté numérique pure
  // et on remet l'unité dans le nom pour ne pas perdre l'info.
  return { quantity: num, name: `${unit} de ${name}` };
}

/** Reconstitue le texte d'un item à partir de { quantity, name }. */
export function joinCourseText(quantity: string, name: string): string {
  const q = quantity.trim();
  const n = name.trim();
  if (!q) return n;
  // Qté contient des lettres ("120g") → "120g de pecorino"
  if (/[a-zA-Z]/.test(q)) return `${q} de ${n}`;
  // Qté numérique pure ("3") → "3 oeufs"
  return `${q} ${n}`;
}
