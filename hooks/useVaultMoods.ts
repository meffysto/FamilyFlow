/**
 * useVaultMoods.ts — Hook dédié au domaine Météo des humeurs
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultMoods(vaultRef).
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import type { MoodEntry, MoodLevel } from '../lib/types';
import {
  MOODS_FILE,
  parseMoods,
  serializeMoods,
} from '../lib/parser';
import type { VaultManager } from '../lib/vault';

// ─── Utilitaires locaux ──────────────────────────────────────────────────────

function isFileNotFound(e: unknown): boolean {
  const msg = String(e);
  return msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
}
function warnUnexpected(context: string, e: unknown) {
  if (!isFileNotFound(e)) console.warn(`[useVaultMoods] ${context}:`, e);
}

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultMoodsResult {
  moods: MoodEntry[];
  setMoods: (moods: MoodEntry[]) => void;
  addMood: (profileId: string, profileName: string, level: MoodLevel, note?: string) => Promise<void>;
  deleteMood: (lineIndex: number) => Promise<void>;
  resetMoods: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultMoods(
  vaultRef: React.MutableRefObject<VaultManager | null>
): UseVaultMoodsResult {
  const [moods, setMoods] = useState<MoodEntry[]>([]);

  const resetMoods = useCallback(() => {
    setMoods([]);
  }, []);

  const addMood = useCallback(async (profileId: string, profileName: string, level: MoodLevel, note?: string) => {
    if (!vaultRef.current) return;
    const date = new Date().toISOString().slice(0, 10);
    let existing: MoodEntry[] = [];
    try {
      const content = await vaultRef.current.readFile(MOODS_FILE);
      existing = parseMoods(content);
    } catch (e) { warnUnexpected('addMood-read', e); }
    // Remplacer l'entrée du même profil pour aujourd'hui si elle existe
    const filtered = existing.filter(m => !(m.date === date && m.profileId === profileId));
    const newEntry: MoodEntry = { date, profileId, profileName, level, note, sourceFile: MOODS_FILE, lineIndex: -1 };
    const updated = [newEntry, ...filtered];
    try {
      await vaultRef.current.ensureDir('05 - Famille');
      const serialized = serializeMoods(updated);
      await vaultRef.current.writeFile(MOODS_FILE, serialized);
      setMoods(parseMoods(serialized));
    } catch (e) {
      warnUnexpected('addMood-write', e);
      throw e;
    }
  }, [vaultRef]);

  const deleteMood = useCallback(async (lineIndex: number) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(MOODS_FILE);
      const existing = parseMoods(content);
      const filtered = existing.filter(m => m.lineIndex !== lineIndex);
      const serialized = serializeMoods(filtered);
      await vaultRef.current.writeFile(MOODS_FILE, serialized);
      setMoods(parseMoods(serialized));
    } catch (e) {
      warnUnexpected('deleteMood', e);
    }
  }, [vaultRef]);

  return {
    moods,
    setMoods,
    addMood,
    deleteMood,
    resetMoods,
  };
}
