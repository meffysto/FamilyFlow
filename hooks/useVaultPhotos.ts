/**
 * useVaultPhotos.ts — Hook dédié au domaine Photos enfants
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultPhotos(vaultRef, busyRef).
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import { generateThumbnail } from '../lib/thumbnails';
import type { VaultManager } from '../lib/vault';

const PHOTOS_DIR = '07 - Photos';

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultPhotosResult {
  photoDates: Record<string, string[]>;
  setPhotoDates: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  addPhoto: (enfantId: string, enfantName: string, date: string, imageUri: string) => Promise<void>;
  getPhotoUri: (enfantName: string, date: string) => string | null;
  resetPhotos: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultPhotos(
  vaultRef: React.MutableRefObject<VaultManager | null>,
  busyRef: React.MutableRefObject<boolean>,
): UseVaultPhotosResult {
  const [photoDates, setPhotoDates] = useState<Record<string, string[]>>({});

  const resetPhotos = useCallback(() => {
    setPhotoDates({});
  }, []);

  const addPhoto = useCallback(async (enfantId: string, enfantName: string, date: string, imageUri: string) => {
    if (!vaultRef.current) throw new Error('Vault non initialisé');
    busyRef.current = true;
    try {
      // Dossier disque indexé par prénom (suivi via renameChild lors d'un rename)…
      const relativePath = `${PHOTOS_DIR}/${enfantName}/${date}.jpg`;
      await vaultRef.current.copyFileToVault(imageUri, relativePath);

      // L'index m\u00e9moire est cl\u00e9-\u00e9 par l'id STABLE du profil, pour rester coh\u00e9rent
      // avec la lecture UI (photoDates[profile.id]) apr\u00e8s un renommage de l'enfant.
      setPhotoDates((prev) => {
        const existing = prev[enfantId] ?? [];
        if (existing.includes(date)) return prev;
        return { ...prev, [enfantId]: [...existing, date].sort() };
      });

      const photoUri = vaultRef.current.getPhotoUri(enfantName, date);
      if (photoUri) {
        generateThumbnail(photoUri, enfantName, date).catch(() => {});
      }
    } finally {
      busyRef.current = false;
    }
  }, [vaultRef, busyRef]);

  const getPhotoUri = useCallback((enfantName: string, date: string): string | null => {
    if (!vaultRef.current) return null;
    return vaultRef.current.getPhotoUri(enfantName, date);
  }, [vaultRef]);

  return {
    photoDates,
    setPhotoDates,
    addPhoto,
    getPhotoUri,
    resetPhotos,
  };
}
