/**
 * useVaultAnniversaires.ts — Hook dédié au domaine Anniversaires
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultAnniversaires(vaultRef).
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import {
  ANNIVERSAIRES_FILE,
  parseAnniversaries,
  serializeAnniversaries,
} from '../lib/parser';
import type { Anniversary } from '../lib/types';
import type { VaultManager } from '../lib/vault';

// ─── Utilitaires locaux ──────────────────────────────────────────────────────

function isFileNotFound(e: unknown): boolean {
  const msg = String(e);
  return msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
}
function warnUnexpected(context: string, e: unknown) {
  if (!isFileNotFound(e)) console.warn(`[useVaultAnniversaires] ${context}:`, e);
}

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultAnniversairesResult {
  anniversaries: Anniversary[];
  setAnniversaries: (items: Anniversary[]) => void;
  addAnniversary: (anniversary: Omit<Anniversary, 'sourceFile'>) => Promise<void>;
  updateAnniversary: (oldName: string, anniversary: Omit<Anniversary, 'sourceFile'>) => Promise<void>;
  removeAnniversary: (name: string) => Promise<void>;
  importAnniversaries: (anniversaries: Omit<Anniversary, 'sourceFile'>[]) => Promise<void>;
  resetAnniversaires: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultAnniversaires(
  vaultRef: React.MutableRefObject<VaultManager | null>
): UseVaultAnniversairesResult {
  const [anniversaries, setAnniversaries] = useState<Anniversary[]>([]);

  const resetAnniversaires = useCallback(() => {
    setAnniversaries([]);
  }, []);

  const reloadAnniversaries = useCallback(async (): Promise<Anniversary[]> => {
    if (!vaultRef.current) return [];
    try {
      const content = await vaultRef.current.readFile(ANNIVERSAIRES_FILE);
      return parseAnniversaries(content);
    } catch (e) {
      warnUnexpected('reloadAnniversaries', e);
      return [];
    }
  }, [vaultRef]);

  const addAnniversary = useCallback(async (anniversary: Omit<Anniversary, 'sourceFile'>) => {
    if (!vaultRef.current) return;
    const items = await reloadAnniversaries();
    items.push({ ...anniversary, sourceFile: ANNIVERSAIRES_FILE });
    await vaultRef.current.writeFile(ANNIVERSAIRES_FILE, serializeAnniversaries(items));
    setAnniversaries(parseAnniversaries(await vaultRef.current.readFile(ANNIVERSAIRES_FILE)));
  }, [reloadAnniversaries, vaultRef]);

  const updateAnniversary = useCallback(async (oldName: string, anniversary: Omit<Anniversary, 'sourceFile'>) => {
    if (!vaultRef.current) return;
    const items = await reloadAnniversaries();
    const idx = items.findIndex((a) => a.name === oldName);
    if (idx === -1) return;
    items[idx] = { ...anniversary, sourceFile: ANNIVERSAIRES_FILE };
    await vaultRef.current.writeFile(ANNIVERSAIRES_FILE, serializeAnniversaries(items));
    setAnniversaries(parseAnniversaries(await vaultRef.current.readFile(ANNIVERSAIRES_FILE)));
  }, [reloadAnniversaries, vaultRef]);

  const removeAnniversary = useCallback(async (name: string) => {
    if (!vaultRef.current) return;
    const items = await reloadAnniversaries();
    const filtered = items.filter((a) => a.name !== name);
    await vaultRef.current.writeFile(ANNIVERSAIRES_FILE, serializeAnniversaries(filtered));
    setAnniversaries(parseAnniversaries(await vaultRef.current.readFile(ANNIVERSAIRES_FILE)));
  }, [reloadAnniversaries, vaultRef]);

  const importAnniversaries = useCallback(async (newItems: Omit<Anniversary, 'sourceFile'>[]) => {
    if (!vaultRef.current) return;
    const existing = await reloadAnniversaries();
    // Merge : skip les doublons par contactId (si présent), sinon par nom+date
    const existingContactIds = new Set(existing.filter((a) => a.contactId).map((a) => a.contactId));
    const existingKeys = new Set(existing.map((a) => `${a.name}|${a.date}`));

    for (const item of newItems) {
      // Skip si contactId déjà présent
      if (item.contactId && existingContactIds.has(item.contactId)) continue;
      // Skip si même nom+date
      if (existingKeys.has(`${item.name}|${item.date}`)) continue;

      existing.push({ ...item, sourceFile: ANNIVERSAIRES_FILE });
      if (item.contactId) existingContactIds.add(item.contactId);
      existingKeys.add(`${item.name}|${item.date}`);
    }

    await vaultRef.current.writeFile(ANNIVERSAIRES_FILE, serializeAnniversaries(existing));
    setAnniversaries(parseAnniversaries(await vaultRef.current.readFile(ANNIVERSAIRES_FILE)));
  }, [reloadAnniversaries, vaultRef]);

  return {
    anniversaries,
    setAnniversaries,
    addAnniversary,
    updateAnniversary,
    removeAnniversary,
    importAnniversaries,
    resetAnniversaires,
  };
}
