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
  // Filename inclut un suffixe court du hash → unique par contenu, pas de collision
  // sur ré-export même jour si le contenu a changé. Si le contenu est identique
  // (hash identique), on overwrite explicitement via deleteAsync + copyAsync.
  const hashSuffix = entry.hash.slice(0, 8);
  const filename = `${entry.id}-${entry.date}-${hashSuffix}.pdf`;
  const relativePath = `${PDFS_DIR}/${filename}`;

  // 1. Ensure dir cible (via vault — gère NSFileCoordinator iCloud)
  await vault.ensureDir(PDFS_DIR);

  // 2. Si la cible existe (ré-export même contenu → hash identique), supprimer
  // d'abord via vault.deleteFile (NSFileCoordinator iCloud-aware).
  if (await vault.exists(relativePath)) {
    try {
      await vault.deleteFile(relativePath);
    } catch (deleteErr) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[persistBookPdf] pre-copy cleanup failed', deleteErr);
      }
    }
  }

  // 3. Copier cache → vault via vault.copyFileToVault (NSFileCoordinator iCloud).
  // Évite l'erreur "is not writable" qu'on obtient avec FileSystem.copyAsync direct
  // sur les chemins iCloud Drive (placeholders non-matérialisés / scope security).
  await vault.copyFileToVault(cacheUri, relativePath);

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
 * Reconstruit l'URI absolu file:// d'un PDF déjà persisté depuis une entrée
 * manifeste. Réutilise `buildVaultUriFromPath` (même validation path-traversal
 * que `VaultManager.uri()` — vault.ts:74-92).
 *
 * Phase 51-02 : exporté publiquement pour permettre à l'écran "Mes impressions"
 * d'ouvrir un PDF du manifeste via `Print.printAsync({ uri })` ou `Linking.openURL`.
 *
 * @throws Error si `entry.chemin` contient `..` ou tente une sortie du vault.
 */
export function buildVaultPdfUri(
  vault: VaultManager,
  entry: BookManifestEntry,
): string {
  return buildVaultUriFromPath(vault.vaultPath, entry.chemin);
}

/**
 * Réplique la logique privée `VaultManager.uri()` (vault.ts:74-92).
 * Path traversal check identique. file:// prefix sur iOS si pas déjà un URI.
 */
function buildVaultUriFromPath(vaultPath: string, relativePath: string): string {
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
