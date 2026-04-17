/**
 * useVaultLoveNotes.ts — Hook dedie au domaine Love Notes (Phase 34)
 *
 * Extrait de useVault.ts pour alleger le monolithe.
 * Appele uniquement par useVaultInternal() via useVaultLoveNotes(vaultRef).
 *
 * Pattern identique a useVaultNotes — 1 fichier = 1 note, classe par destinataire
 * dans `03 - Famille/LoveNotes/{to-profileId}/{YYYY-MM-DD-slug}.md`.
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import type { LoveNote, LoveNoteStatus } from '../lib/types';
import {
  LOVENOTES_DIR,
  parseLoveNote,
  serializeLoveNote,
  loveNotePath,
} from '../lib/parser';
import type { VaultManager } from '../lib/vault';

// ─── Utilitaires locaux ──────────────────────────────────────────────────────

function isFileNotFound(e: unknown): boolean {
  const msg = String(e);
  return msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
}
function warnUnexpected(context: string, e: unknown) {
  if (!isFileNotFound(e)) console.warn(`[useVaultLoveNotes] ${context}:`, e);
}

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultLoveNotesResult {
  loveNotes: LoveNote[];
  loadLoveNotes: (vault: VaultManager) => Promise<LoveNote[]>;
  setLoveNotes: React.Dispatch<React.SetStateAction<LoveNote[]>>;
  addLoveNote: (note: Omit<LoveNote, 'sourceFile'>) => Promise<void>;
  updateLoveNoteStatus: (sourceFile: string, status: LoveNoteStatus, readAt?: string) => Promise<void>;
  deleteLoveNote: (sourceFile: string) => Promise<void>;
  resetLoveNotes: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultLoveNotes(
  vaultRef: React.MutableRefObject<VaultManager | null>
): UseVaultLoveNotesResult {
  const [loveNotes, setLoveNotes] = useState<LoveNote[]>([]);

  const resetLoveNotes = useCallback(() => {
    setLoveNotes([]);
  }, []);

  const loadLoveNotes = useCallback(async (vault: VaultManager): Promise<LoveNote[]> => {
    try {
      await vault.ensureDir(LOVENOTES_DIR);
      const files = await vault.listFilesRecursive(LOVENOTES_DIR, '.md');
      const results = await Promise.all(
        files.map(async (file) => {
          try {
            const content = await vault.readFile(file);
            return parseLoveNote(file, content);
          } catch (e) { warnUnexpected(`loveNote(${file})`, e); return null; }
        })
      );
      const loaded = results.filter((n): n is LoveNote => n !== null);
      // Tri par createdAt desc (plus recentes en premier — coherent avec useVaultNotes)
      loaded.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return loaded;
    } catch {
      return [];
    }
  }, []);

  const addLoveNote = useCallback(async (note: Omit<LoveNote, 'sourceFile'>) => {
    if (!vaultRef.current) return;
    const dir = `${LOVENOTES_DIR}/${note.to}`;
    await vaultRef.current.ensureDir(dir);
    const relPath = loveNotePath(note.to, note.createdAt);
    await vaultRef.current.writeFile(relPath, serializeLoveNote(note));
    const exists = await vaultRef.current.exists(relPath);
    if (!exists) throw new Error("Echec de l'ecriture de la love note");
    setLoveNotes((prev) => [{ ...note, sourceFile: relPath }, ...prev]);
  }, [vaultRef]);

  const updateLoveNoteStatus = useCallback(async (
    sourceFile: string,
    status: LoveNoteStatus,
    readAt?: string,
  ) => {
    if (!vaultRef.current) return;
    const current = await vaultRef.current.readFile(sourceFile).catch(() => '');
    const parsed = parseLoveNote(sourceFile, current);
    if (!parsed) return;
    const updated: Omit<LoveNote, 'sourceFile'> = {
      from: parsed.from,
      to: parsed.to,
      createdAt: parsed.createdAt,
      revealAt: parsed.revealAt,
      status,
      readAt: status === 'read' ? (readAt ?? new Date().toISOString().slice(0, 19)) : parsed.readAt,
      body: parsed.body,
    };
    await vaultRef.current.writeFile(sourceFile, serializeLoveNote(updated));
    setLoveNotes((prev) => prev.map((n) =>
      n.sourceFile === sourceFile ? { ...updated, sourceFile } : n
    ));
  }, [vaultRef]);

  const deleteLoveNote = useCallback(async (sourceFile: string) => {
    if (!vaultRef.current) return;
    await vaultRef.current.deleteFile(sourceFile);
    setLoveNotes((prev) => prev.filter((n) => n.sourceFile !== sourceFile));
  }, [vaultRef]);

  return {
    loveNotes,
    loadLoveNotes,
    setLoveNotes,
    addLoveNote,
    updateLoveNoteStatus,
    deleteLoveNote,
    resetLoveNotes,
  };
}
