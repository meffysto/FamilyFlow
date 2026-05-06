/**
 * lib/eval/rubric-helpers.ts — Phase 52-01
 *
 * Fonctions pures réutilisables par le rubric déterministe.
 * Zéro I/O, zéro réseau, zéro dépendance runtime nouvelle.
 */

import type { Profile } from '../types';

/**
 * Type-token ratio = tokens uniques / total après lowercase + filter ponctuation.
 * Retourne 0 sur entrée vide (pas de division par zéro).
 */
export function typeTokenRatio(text: string): number {
  const tokens = text
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => /[a-zà-ÿ]/i.test(t));
  if (tokens.length === 0) return 0;
  const unique = new Set(tokens);
  return unique.size / tokens.length;
}

/**
 * Compte occurrences d'un pattern. La regex DOIT être globale (`/g`).
 * Lance une erreur sinon — sécurise les call sites.
 */
export function countOccurrences(text: string, pattern: RegExp): number {
  if (!pattern.global) {
    throw new Error('countOccurrences requires global regex (/g flag)');
  }
  return (text.match(pattern) ?? []).length;
}

/**
 * Échappe les caractères spéciaux d'une string pour usage dans un RegExp.
 * Évite que les prénoms contenant `.` `*` etc. cassent le RegExp.
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Overlap de n-grams (mots) entre deux textes après normalisation FR.
 * Retourne |intersection| / |n-grams de A| ∈ [0, 1].
 *
 * Normalisation : lowercase + remplace les prénoms enfants connus par "enfant"
 * (sinon un prénom commun fausse le ratio en faveur d'un faux clone).
 *
 * Cas particuliers :
 *   - A vide ⇒ 0 (rien à comparer)
 *   - n > tokens.length ⇒ 0 grams ⇒ 0
 */
export function ngramOverlap(
  a: string,
  b: string,
  n: number,
  knownNames: string[] = [],
): number {
  if (n <= 0) return 0;

  const norm = (s: string): string[] => {
    let out = s.toLowerCase();
    for (const name of knownNames) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      out = out.replace(new RegExp(`\\b${escapeRegExp(trimmed.toLowerCase())}\\b`, 'g'), 'enfant');
    }
    return out.split(/\s+/).filter(Boolean);
  };

  const grams = (tokens: string[]): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i <= tokens.length - n; i++) {
      set.add(tokens.slice(i, i + n).join(' '));
    }
    return set;
  };

  const A = grams(norm(a));
  const B = grams(norm(b));
  if (A.size === 0) return 0;

  let common = 0;
  for (const g of A) if (B.has(g)) common++;
  return common / A.size;
}

/**
 * Anonymise le texte d'une story avant envoi au LLM-judge (Plan 52-03).
 * Remplace le prénom de l'enfant par "Enfant" (case-insensitive, mots entiers).
 *
 * Le projet expose `Profile.name` (pas `prenom`/`nom`) — cf. lib/types.ts:74.
 */
export function anonymizeStoryText(text: string, child: Profile): string {
  const name = (child?.name ?? '').trim();
  if (!name) return text;
  return text.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi'), 'Enfant');
}
