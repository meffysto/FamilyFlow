// lib/pdf/book-storage.ts — Sauvegarde PDF + update manifeste (Phase 49 Plan 03).
//
// Pipeline persistance :
//   cacheUri (sortie expo-print) → 12 - Impressions/PDFs/{storyId}-{date}.pdf
//   + parseManifeste → upsert (id, date) → serializeManifeste → vault.writeFile
//
// Choix architectural : VaultManager.writeFile est UTF-8 → KO pour binaires PDF.
// On copie via FileSystem.copyAsync vers un URI vault construit localement
// (réplique de la logique privée vault.uri). Aucune modification de la classe
// VaultManager dans ce plan (audit trail simple). NSFileCoordinator intervient
// à la lecture côté Obsidian — RESEARCH.md §662.

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { VaultManager } from '../vault';
import type { BookManifestEntry } from './types';
import { MANIFESTE_FILE, parseManifeste, serializeManifeste } from './manifest-parser';

const PDFS_DIR = '12 - Impressions/PDFs';

/**
 * Copie le PDF du cache app vers le vault iCloud + met à jour le manifeste.
 * Upsert sur (id, date) pour autoriser plusieurs exports du même storyId à
 * des dates différentes (CONTEXT.md ligne 58).
 *
 * Path final : `12 - Impressions/PDFs/{storyId}-{YYYY-MM-DD}.pdf`
 */
export async function persistBookPdf(
  vault: VaultManager,
  cacheUri: string,
  entry: Omit<BookManifestEntry, 'chemin'>,
): Promise<BookManifestEntry> {
  const filename = `${entry.id}-${entry.date}.pdf`;
  const relativePath = `${PDFS_DIR}/${filename}`;

  // 1. Ensure dir cible
  await vault.ensureDir(PDFS_DIR);

  // 2. Construire URI cible (réplique logique privée vault.uri)
  const targetUri = buildVaultUri(vault.vaultPath, relativePath);

  // 3. Copier cache → vault (FileSystem.copyAsync OK pour binaires)
  await FileSystem.copyAsync({ from: cacheUri, to: targetUri });

  // 4. Lire manifeste existant (création paresseuse si absent)
  let entries: BookManifestEntry[] = [];
  try {
    const existing = await vault.readFile(MANIFESTE_FILE);
    entries = parseManifeste(existing);
  } catch {
    // Manifeste pas encore créé → première écriture
  }

  // 5. Upsert sur (id, date)
  const fullEntry: BookManifestEntry = { ...entry, chemin: relativePath };
  const idx = entries.findIndex(
    (e) => e.id === fullEntry.id && e.date === fullEntry.date,
  );
  if (idx >= 0) entries[idx] = fullEntry;
  else entries.push(fullEntry);

  // 6. Écrire manifeste mis à jour (UTF-8 via VaultManager.writeFile)
  await vault.writeFile(MANIFESTE_FILE, serializeManifeste(entries));

  return fullEntry;
}

/**
 * Réplique la logique privée `VaultManager.uri()` (vault.ts:74-92).
 * Path traversal check identique. file:// prefix sur iOS si pas déjà un URI.
 */
function buildVaultUri(vaultPath: string, relativePath: string): string {
  if (
    relativePath.includes('..') ||
    relativePath.startsWith('/') ||
    relativePath.includes('\0')
  ) {
    throw new Error(`Chemin invalide (traversal détecté) : ${relativePath}`);
  }
  const normalized = vaultPath.replace(/\/$/, '');
  const isUri =
    normalized.startsWith('file://') || normalized.startsWith('content://');
  const rel = isUri
    ? relativePath
        .split('/')
        .map((c) => encodeURIComponent(c))
        .join('/')
    : relativePath;
  const path = `${normalized}/${rel}`;
  if (isUri) return path;
  return Platform.OS === 'web' ? path : `file://${path}`;
}
