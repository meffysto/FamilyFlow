import type { CourseItem } from './types';

export interface CheckedCourseSection {
  section: string;
  checkedAt: number;
}

/**
 * Déduit l'ordre réel des rayons visités pendant le mode magasin.
 *
 * Les items cochés disparaissent de la liste courante, donc on ne peut pas
 * reconstruire le parcours final depuis `itemsBySection` seul. Le rayon doit
 * être capturé au moment du check, puis ordonné par premier check observé.
 */
export function computeObservedShoppingOrder(
  sections: string[],
  itemsBySection: Record<string, CourseItem[]>,
  checkedSections: Iterable<CheckedCourseSection>,
): string[] {
  const firstCheckedAtBySection = new Map<string, number>();

  for (const checked of checkedSections) {
    if (!checked.section) continue;
    const prev = firstCheckedAtBySection.get(checked.section);
    if (prev === undefined || checked.checkedAt < prev) {
      firstCheckedAtBySection.set(checked.section, checked.checkedAt);
    }
  }

  const observed = [...firstCheckedAtBySection.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([section]) => section);

  const observedSet = new Set(observed);
  const tail = sections.filter(section =>
    !observedSet.has(section) && (itemsBySection[section] ?? []).length > 0
  );

  return [...observed, ...tail];
}
