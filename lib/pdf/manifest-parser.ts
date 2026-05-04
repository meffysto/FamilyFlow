// lib/pdf/manifest-parser.ts
// Parser bidirectionnel du manifeste impressions PDF Lulu.
//
// Format : un seul fichier `12 - Impressions/manifeste.md` avec :
// - frontmatter gray-matter (tags + version pour migrations futures)
// - table markdown 5 colonnes (ID histoire | Hash | Date | Format | Chemin)
//
// Pattern hybride parseRDV (frontmatter) + parseAnniversaries (table).
//
// Contrainte : aucune valeur ne peut contenir `|` (Pitfall 5 RESEARCH.md).
// Le hash SHA-256 est hex, les chemins vault n'ont pas de pipe → satisfait.

import matter from 'gray-matter';
import type { BookManifestEntry } from './types';

/** Chemin relatif vault vers le fichier manifeste. */
export const MANIFESTE_FILE = '12 - Impressions/manifeste.md';

/**
 * Parse le contenu markdown du manifeste vers une liste d'entrées.
 * Lignes malformées (id vide, header, separator) sont ignorées silencieusement.
 * Ne throw jamais — retourne `[]` sur contenu vide ou invalide.
 */
export function parseManifeste(content: string): BookManifestEntry[] {
  if (!content || !content.trim()) return [];

  let body: string;
  try {
    ({ content: body } = matter(content));
  } catch {
    // Frontmatter invalide → traiter le contenu brut
    body = content;
  }

  const lines = body.split('\n');
  const items: BookManifestEntry[] = [];

  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 5) continue;
    // Skip header et separator
    if (cells[0] === 'ID histoire' || cells[0].startsWith('---')) continue;

    const [id, hash, date, format, chemin] = cells;
    if (!id || !hash) continue;

    items.push({ id, hash, date, format, chemin });
  }

  return items;
}

/**
 * Sérialise une liste d'entrées vers le format markdown manifeste.
 * Inclut frontmatter (version: 1 pour migrations futures) + header + table.
 * Round-trip prouvable avec parseManifeste (cf. tests).
 */
export function serializeManifeste(entries: BookManifestEntry[]): string {
  const parts: string[] = [
    '---',
    'tags:',
    '  - impressions',
    '  - manifeste',
    'version: 1',
    '---',
    '',
    '# Manifeste impressions',
    '',
    'Registre des PDFs exportés pour impression Lulu Direct.',
    '',
    '| ID histoire | Hash | Date | Format | Chemin |',
    '|-------------|------|------|--------|--------|',
  ];

  for (const e of entries) {
    parts.push(`| ${e.id} | ${e.hash} | ${e.date} | ${e.format} | ${e.chemin} |`);
  }

  parts.push('');
  return parts.join('\n');
}
