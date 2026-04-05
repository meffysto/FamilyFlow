/**
 * useVaultGratitude.ts — Hook dédié au domaine Gratitude familiale
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultGratitude(vaultRef).
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import type { GratitudeDay } from '../lib/types';
import {
  GRATITUDE_FILE,
  parseGratitude,
  serializeGratitude,
} from '../lib/parser';
import type { VaultManager } from '../lib/vault';

// ─── Utilitaires locaux ──────────────────────────────────────────────────────

function isFileNotFound(e: unknown): boolean {
  const msg = String(e);
  return msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
}
function warnUnexpected(context: string, e: unknown) {
  if (!isFileNotFound(e)) console.warn(`[useVaultGratitude] ${context}:`, e);
}

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultGratitudeResult {
  gratitudeDays: GratitudeDay[];
  setGratitudeDays: (days: GratitudeDay[]) => void;
  addGratitudeEntry: (date: string, profileId: string, profileName: string, text: string) => Promise<void>;
  deleteGratitudeEntry: (date: string, profileId: string) => Promise<void>;
  resetGratitude: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultGratitude(
  vaultRef: React.MutableRefObject<VaultManager | null>
): UseVaultGratitudeResult {
  const [gratitudeDays, setGratitudeDays] = useState<GratitudeDay[]>([]);

  const resetGratitude = useCallback(() => {
    setGratitudeDays([]);
  }, []);

  const addGratitudeEntry = useCallback(async (date: string, profileId: string, profileName: string, text: string) => {
    if (!vaultRef.current) return;
    let days: GratitudeDay[];
    try {
      const content = await vaultRef.current.readFile(GRATITUDE_FILE);
      days = parseGratitude(content);
    } catch (e) {
      warnUnexpected('addGratitude-read', e);
      days = [];
    }

    // Trouver ou créer le jour
    let day = days.find((d) => d.date === date);
    if (!day) {
      day = { date, entries: [] };
      days.push(day);
    }

    // Ajouter/remplacer l'entry du profil
    day.entries = day.entries.filter((e) => e.profileId !== profileId);
    day.entries.push({ date, profileId, profileName, text });

    await vaultRef.current.writeFile(GRATITUDE_FILE, serializeGratitude(days));
    setGratitudeDays(days);
  }, [vaultRef]);

  const deleteGratitudeEntry = useCallback(async (date: string, profileId: string) => {
    if (!vaultRef.current) return;
    let days: GratitudeDay[];
    try {
      const content = await vaultRef.current.readFile(GRATITUDE_FILE);
      days = parseGratitude(content);
    } catch (e) {
      warnUnexpected('deleteGratitude-read', e);
      return;
    }

    const day = days.find((d) => d.date === date);
    if (!day) return;

    day.entries = day.entries.filter((e) => e.profileId !== profileId);
    if (day.entries.length === 0) {
      days = days.filter((d) => d.date !== date);
    }

    if (days.length > 0) {
      await vaultRef.current.writeFile(GRATITUDE_FILE, serializeGratitude(days));
    } else {
      try { await vaultRef.current.deleteFile(GRATITUDE_FILE); } catch (e) { warnUnexpected('deleteGratitude-file', e); }
    }
    setGratitudeDays(days);
  }, [vaultRef]);

  return {
    gratitudeDays,
    setGratitudeDays,
    addGratitudeEntry,
    deleteGratitudeEntry,
    resetGratitude,
  };
}
