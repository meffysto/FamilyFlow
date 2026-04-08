// lib/codex/search.ts — Recherche normalisée pour le codex ferme (Phase 17, per D-08/D-09/D-10)
//
// Helper isolé : normalize() est volontairement dupliqué de lib/search.ts:52 pour éviter
// d'exporter un symbole hors-scope (D-09). Logique identique : NFD + lowercase + trim.

import type { CodexEntry } from './types';

/**
 * Normalise une chaîne pour comparaison insensible aux accents et à la casse.
 * Duplication volontaire de lib/search.ts (per D-09) — ne pas factoriser.
 */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Filtre CODEX_CONTENT par query texte libre.
 * Match sur t(nameKey) + t(loreKey) de la langue active (D-10).
 * Retourne toutes les entrées si query vide/whitespace.
 *
 * @param query - texte utilisateur brut
 * @param t - fonction i18next (passée par l'appelant pour éviter de coupler lib/ à React)
 * @param entries - dataset à filtrer (généralement CODEX_CONTENT)
 */
export function searchCodex(
  query: string,
  t: (key: string) => string,
  entries: CodexEntry[],
): CodexEntry[] {
  const normalized = normalize(query);
  if (normalized.length === 0) return entries;

  return entries.filter((entry) => {
    const name = normalize(t(entry.nameKey));
    const lore = normalize(t(entry.loreKey));
    return name.includes(normalized) || lore.includes(normalized);
  });
}

/**
 * Filtre des entrées par kind (catégorie active dans les tabs).
 * Utile quand query vide et tab active sélectionnée.
 */
export function filterByKind(
  entries: CodexEntry[],
  kind: CodexEntry['kind'],
): CodexEntry[] {
  return entries.filter((entry) => entry.kind === kind);
}
