/**
 * useVaultRoutines.ts — Hook dédié au domaine Routines
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultRoutines(vaultRef).
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import type { Routine } from '../lib/types';
import { serializeRoutines } from '../lib/parser';
import type { VaultManager } from '../lib/vault';

const ROUTINES_FILE = '02 - Maison/Routines.md';

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultRoutinesResult {
  routines: Routine[];
  setRoutines: (routines: Routine[]) => void;
  saveRoutines: (routines: Routine[]) => Promise<void>;
  resetRoutines: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultRoutines(
  vaultRef: React.MutableRefObject<VaultManager | null>
): UseVaultRoutinesResult {
  const [routines, setRoutines] = useState<Routine[]>([]);

  const resetRoutines = useCallback(() => {
    setRoutines([]);
  }, []);

  const saveRoutines = useCallback(async (newRoutines: Routine[]) => {
    if (!vaultRef.current) return;
    await vaultRef.current.writeFile(ROUTINES_FILE, serializeRoutines(newRoutines));
    setRoutines(newRoutines);
  }, [vaultRef]);

  return {
    routines,
    setRoutines,
    saveRoutines,
    resetRoutines,
  };
}
