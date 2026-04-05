/**
 * useVaultQuotes.ts — Hook dédié au domaine Mots d'enfants
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultQuotes(vaultRef).
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import type { ChildQuote } from '../lib/types';
import {
  QUOTES_FILE,
  parseQuotes,
  serializeQuotes,
} from '../lib/parser';
import type { VaultManager } from '../lib/vault';

// ─── Utilitaires locaux ──────────────────────────────────────────────────────

function isFileNotFound(e: unknown): boolean {
  const msg = String(e);
  return msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
}
function warnUnexpected(context: string, e: unknown) {
  if (!isFileNotFound(e)) console.warn(`[useVaultQuotes] ${context}:`, e);
}

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultQuotesResult {
  quotes: ChildQuote[];
  setQuotes: (quotes: ChildQuote[]) => void;
  addQuote: (enfant: string, citation: string, contexte?: string) => Promise<void>;
  deleteQuote: (lineIndex: number) => Promise<void>;
  resetQuotes: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultQuotes(
  vaultRef: React.MutableRefObject<VaultManager | null>
): UseVaultQuotesResult {
  const [quotes, setQuotes] = useState<ChildQuote[]>([]);

  const resetQuotes = useCallback(() => {
    setQuotes([]);
  }, []);

  const addQuote = useCallback(async (enfant: string, citation: string, contexte?: string) => {
    if (!vaultRef.current) return;
    const date = new Date().toISOString().slice(0, 10);
    const newQuote: ChildQuote = { date, enfant, citation, contexte, sourceFile: QUOTES_FILE, lineIndex: -1 };
    let existing: ChildQuote[] = [];
    try {
      const content = await vaultRef.current.readFile(QUOTES_FILE);
      existing = parseQuotes(content);
    } catch (e) { warnUnexpected('addQuote-read', e); }
    const updated = [newQuote, ...existing];
    await vaultRef.current.ensureDir('06 - Mémoires');
    const serialized = serializeQuotes(updated);
    await vaultRef.current.writeFile(QUOTES_FILE, serialized);
    setQuotes(parseQuotes(serialized));
  }, [vaultRef]);

  const deleteQuote = useCallback(async (lineIndex: number) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(QUOTES_FILE);
      const existing = parseQuotes(content);
      const filtered = existing.filter(q => q.lineIndex !== lineIndex);
      const serialized = serializeQuotes(filtered);
      await vaultRef.current.writeFile(QUOTES_FILE, serialized);
      setQuotes(parseQuotes(serialized));
    } catch (e) {
      warnUnexpected('deleteQuote', e);
    }
  }, [vaultRef]);

  return {
    quotes,
    setQuotes,
    addQuote,
    deleteQuote,
    resetQuotes,
  };
}
