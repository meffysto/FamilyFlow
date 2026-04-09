// lib/semantic/derive.ts
// Fonction pure de détection sémantique — Phase 19 v1.3 Seed.
// Décisions : D-02 (ordre tag > section > filepath), D-03 (matching), D-04 (API).
// ARCH-01 : aucun import vault.ts, aucun I/O, aucun effet de bord.

import type { Task } from '../types';
import { CATEGORIES, type CategoryMatch } from './categories';

/**
 * Normalise une chaîne pour comparaison : strip accents (NFD), lowercase, trim.
 * NON exportée — c'est un détail d'implémentation interne (D-specifics).
 */
function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Détecte la catégorie sémantique d'une tâche selon l'ordre de priorité figé :
 *   1. tags (intention explicite utilisateur)
 *   2. section (contexte H2/H3)
 *   3. filepath (premier segment de sourceFile)
 *
 * Retourne `null` si aucun signal ne matche aucune des 10 catégories de
 * CATEGORIES — c'est le SEUL cas de fallback, Phase 20 traitera null comme
 * "standard XP, zéro effet" (ARCH-03 / SEMANTIC-04).
 *
 * Cette fonction est 100% pure : synchrone, sans I/O, sans lecture du flag
 * SecureStore. Le flag est vérifié par l'appelant (Phase 20), cf D-05d.
 */
export function deriveTaskCategory(task: Task): CategoryMatch | null {
  // 1. Tags — priorité maximale
  if (task.tags && task.tags.length > 0) {
    for (const tag of task.tags) {
      const normalizedTag = normalize(tag);
      for (const category of CATEGORIES) {
        if (category.tagPatterns.includes(normalizedTag)) {
          return {
            id: category.id,
            matchedBy: 'tag',
            evidence: tag, // valeur brute (D-04b)
          };
        }
      }
    }
  }

  // 2. Section — priorité moyenne, matching par includes()
  if (task.section) {
    const normalizedSection = normalize(task.section);
    for (const category of CATEGORIES) {
      for (const pattern of category.sectionPatterns) {
        if (normalizedSection.includes(pattern)) {
          return {
            id: category.id,
            matchedBy: 'section',
            evidence: task.section, // valeur brute (D-04b)
          };
        }
      }
    }
  }

  // 3. Filepath — priorité minimale, premier segment strippé du préfixe "NN - "
  if (task.sourceFile) {
    const firstSegment = task.sourceFile.split('/')[0];
    // Strip préfixe "NN - " ou "NN-" (voir D-03b et vault.ts)
    const stripped = firstSegment.replace(/^\d+\s*-\s*/, '');
    const normalizedPath = normalize(stripped);
    for (const category of CATEGORIES) {
      if (category.filepathPatterns.includes(normalizedPath)) {
        return {
          id: category.id,
          matchedBy: 'filepath',
          evidence: firstSegment, // valeur brute avec préfixe (D-04b)
        };
      }
    }
  }

  // Aucun signal reconnu : fallback standard XP (ARCH-03)
  return null;
}
