/**
 * quota-parser.ts — Lecture/écriture du fichier vault quota (D-07).
 *
 * Le quota (compteur d'histoires + solde de crédits IA + flag grandfather) vit
 * dans un fichier frontmatter dédié du vault, pour suivre l'iCloud, survivre à la
 * réinstall et se synchroniser entre les appareils de la famille.
 *
 * Analogue : lib/parser.ts (parseRDV/serializeRDV — frontmatter construit ligne
 * par ligne, jamais via la sérialisation gray-matter). Coercions défensives contre
 * l'édition manuelle du fichier dans Obsidian (T-54-05).
 */

import { parseFrontmatter } from '../parser';
import type { QuotaData } from './types';

/** Chemin du fichier quota dans le vault. */
export const QUOTA_FILE = '09 - Entitlements/quota.md';

/** Quota par défaut (premier lancement, fichier absent/vide). */
export const DEFAULT_QUOTA: QuotaData = {
  grandfather: false,
  grandfatherDetectedAt: '',
  storyCredits: 0,
  storyUsedThisMonth: 0,
  storyResetMonth: '',
};

/**
 * Parse le contenu du fichier quota en QuotaData.
 * Coercions défensives : string "30" → 30, "true"/true → boolean.
 * Fichier vide/absent → DEFAULT_QUOTA.
 */
export function parseQuota(content: string): QuotaData {
  if (!content || content.trim() === '') {
    return { ...DEFAULT_QUOTA };
  }
  const { data } = parseFrontmatter(content);
  return {
    grandfather: data.grandfather === 'true' || (data.grandfather as unknown) === true,
    grandfatherDetectedAt: String(data.grandfather_detected_at ?? ''),
    storyCredits: Number(data.story_credits) || 0,
    storyUsedThisMonth: Number(data.story_used_this_month) || 0,
    storyResetMonth: String(data.story_reset_month ?? ''),
  };
}

/**
 * Sérialise un QuotaData en fichier markdown.
 * Frontmatter construit ligne par ligne (jamais via la sérialisation gray-matter)
 * — round-trip loss-less avec parseQuota.
 */
export function serializeQuota(q: QuotaData): string {
  const lines = [
    '---',
    `grandfather: ${q.grandfather}`,
    `grandfather_detected_at: "${q.grandfatherDetectedAt}"`,
    `story_credits: ${q.storyCredits}`,
    `story_used_this_month: ${q.storyUsedThisMonth}`,
    `story_reset_month: "${q.storyResetMonth}"`,
    'tags:',
    '  - entitlements',
    '---',
    '',
    '# Entitlements & Quota',
    '',
    '> Géré automatiquement par FamilyFlow — ne pas modifier manuellement.',
    '',
  ];
  return lines.join('\n');
}
