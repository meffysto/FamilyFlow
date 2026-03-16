/**
 * thumbnails.ts — Génération et cache de miniatures pour les photos
 *
 * Stratégie : générer au moment de addPhoto(), stocker dans le cache app,
 * fallback vers la photo pleine résolution si la miniature n'existe pas.
 *
 * Specs : 200x200px, JPEG qualité 0.7, cache dans cacheDirectory/thumbnails/
 */

import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const THUMB_SIZE = 200;
const THUMB_QUALITY = 0.7;

/** Répertoire racine des miniatures dans le cache app */
function getThumbDir(): string {
  return `${FileSystem.cacheDirectory}thumbnails`;
}

/** Chemin complet du fichier miniature pour un enfant + date */
export function getThumbnailUri(enfantName: string, date: string): string {
  return `${getThumbDir()}/${enfantName}/${date}.jpg`;
}

/**
 * Génère une miniature 200x200 à partir d'une image source.
 * Retourne l'URI de la miniature générée, ou null en cas d'erreur.
 */
export async function generateThumbnail(
  sourceUri: string,
  enfantName: string,
  date: string,
): Promise<string | null> {
  try {
    const thumbDir = `${getThumbDir()}/${enfantName}`;
    const thumbPath = `${thumbDir}/${date}.jpg`;

    // Créer le répertoire si nécessaire
    const dirInfo = await FileSystem.getInfoAsync(thumbDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(thumbDir, { intermediates: true });
    }

    // Redimensionner l'image (crop carré centré 200x200)
    const result = await manipulateAsync(
      sourceUri,
      [{ resize: { width: THUMB_SIZE, height: THUMB_SIZE } }],
      { format: SaveFormat.JPEG, compress: THUMB_QUALITY },
    );

    // Copier le résultat dans le cache (manipulateAsync écrit dans un tmp)
    await FileSystem.moveAsync({ from: result.uri, to: thumbPath });

    return thumbPath;
  } catch (error) {
    // En cas d'erreur, on ne bloque pas — fallback vers la photo originale
    console.warn(`[thumbnails] Erreur génération miniature ${enfantName}/${date}:`, error);
    return null;
  }
}

/**
 * Retourne l'URI de la miniature si elle existe, sinon null.
 * Permet au composant de faire un fallback vers la photo pleine résolution.
 */
export async function getThumbnailIfExists(
  enfantName: string,
  date: string,
): Promise<string | null> {
  try {
    const thumbPath = getThumbnailUri(enfantName, date);
    const info = await FileSystem.getInfoAsync(thumbPath);
    return info.exists ? thumbPath : null;
  } catch {
    return null;
  }
}

/**
 * Assure qu'une miniature existe pour une photo donnée.
 * Si elle existe déjà, retourne son URI. Sinon, la génère à partir de l'URI source.
 * En cas d'échec, retourne l'URI source comme fallback.
 */
export async function ensureThumbnail(
  sourceUri: string,
  enfantName: string,
  date: string,
): Promise<string> {
  const existing = await getThumbnailIfExists(enfantName, date);
  if (existing) return existing;

  const generated = await generateThumbnail(sourceUri, enfantName, date);
  return generated ?? sourceUri;
}

/**
 * Précharge les miniatures pour une liste de dates.
 * Retourne un map date → thumbnailUri (ou null si pas de miniature).
 * Utilisé pour peupler le state initial sans bloquer le rendu.
 */
export async function preloadThumbnails(
  enfantName: string,
  dates: string[],
): Promise<Record<string, string | null>> {
  const entries = await Promise.all(
    dates.map(async (date) => {
      const uri = await getThumbnailIfExists(enfantName, date);
      return [date, uri] as const;
    }),
  );
  return Object.fromEntries(entries);
}
