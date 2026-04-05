/**
 * useVaultMemories.ts — Hook dédié au domaine Mémoires / Jalons
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultMemories(vaultRef).
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import type { Memory } from '../lib/types';
import { insertJalonInContent, updateJalonInContent } from '../lib/parser';
import type { VaultManager } from '../lib/vault';

const MEMOIRES_DIR = '06 - Mémoires';

// ─── Utilitaires locaux ──────────────────────────────────────────────────────

function isFileNotFound(e: unknown): boolean {
  const msg = String(e);
  return msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
}
function warnUnexpected(context: string, e: unknown) {
  if (!isFileNotFound(e)) console.warn(`[useVaultMemories] ${context}:`, e);
}

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultMemoriesResult {
  memories: Memory[];
  setMemories: React.Dispatch<React.SetStateAction<Memory[]>>;
  addMemory: (enfant: string, memory: Omit<Memory, 'enfant' | 'enfantId'>) => Promise<void>;
  updateMemory: (oldMemory: Memory, newMemory: Omit<Memory, 'enfant' | 'enfantId'>) => Promise<void>;
  resetMemories: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultMemories(
  vaultRef: React.MutableRefObject<VaultManager | null>
): UseVaultMemoriesResult {
  const [memories, setMemories] = useState<Memory[]>([]);

  const resetMemories = useCallback(() => {
    setMemories([]);
  }, []);

  const updateMemory = useCallback(async (oldMemory: Memory, newMemory: Omit<Memory, 'enfant' | 'enfantId'>) => {
    if (!vaultRef.current) return;
    const jalonsPath = `${MEMOIRES_DIR}/${oldMemory.enfant}/Jalons.md`;
    const content = await vaultRef.current.readFile(jalonsPath);
    const updated = updateJalonInContent(content, oldMemory, newMemory);
    await vaultRef.current.writeFile(jalonsPath, updated);

    const updatedMemory: Memory = { ...newMemory, enfant: oldMemory.enfant, enfantId: oldMemory.enfantId };
    setMemories(prev =>
      prev
        .map(m =>
          m.date === oldMemory.date && m.title === oldMemory.title && m.enfantId === oldMemory.enfantId
            ? updatedMemory
            : m
        )
        .sort((a, b) => b.date.localeCompare(a.date))
    );
  }, [vaultRef]);

  const addMemory = useCallback(async (enfant: string, memory: Omit<Memory, 'enfant' | 'enfantId'>) => {
    if (!vaultRef.current) return;
    const jalonsPath = `${MEMOIRES_DIR}/${enfant}/Jalons.md`;
    const vault = vaultRef.current;

    await vault.ensureDir(`${MEMOIRES_DIR}/${enfant}`);
    let content: string;
    try {
      content = await vault.readFile(jalonsPath);
    } catch (e) {
      warnUnexpected('addMemory-read', e);
      content = [
        '---',
        `enfant: ${enfant}`,
        'tags:',
        '  - jalons',
        '---',
        '',
        `# Jalons & Mémoires — ${enfant}`,
        '',
        '## 🌟 Premières fois',
        '',
        '## 💛 Moments forts',
        '',
      ].join('\n');
    }

    const updated = insertJalonInContent(content, memory);
    await vault.writeFile(jalonsPath, updated);

    const enfantId = enfant.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    const newMemory: Memory = { ...memory, enfant, enfantId };
    setMemories(prev => [newMemory, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
  }, [vaultRef]);

  return {
    memories,
    setMemories,
    addMemory,
    updateMemory,
    resetMemories,
  };
}
