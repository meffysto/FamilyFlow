/**
 * useVaultNotes.ts — Hook dédié au domaine Notes & Articles
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultNotes(vaultRef).
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import type { Note } from '../lib/types';
import {
  NOTES_DIR,
  parseNote,
  serializeNote,
  noteFileName,
  noteCategoryLabel,
} from '../lib/parser';
import type { VaultManager } from '../lib/vault';

// ─── Utilitaires locaux ──────────────────────────────────────────────────────

function isFileNotFound(e: unknown): boolean {
  const msg = String(e);
  return msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
}
function warnUnexpected(context: string, e: unknown) {
  if (!isFileNotFound(e)) console.warn(`[useVaultNotes] ${context}:`, e);
}

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultNotesResult {
  notes: Note[];
  loadNotes: (vault: VaultManager) => Promise<Note[]>;
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  addNote: (note: Omit<Note, 'sourceFile'>) => Promise<void>;
  updateNote: (sourceFile: string, note: Omit<Note, 'sourceFile'>) => Promise<void>;
  deleteNote: (sourceFile: string) => Promise<void>;
  resetNotes: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultNotes(
  vaultRef: React.MutableRefObject<VaultManager | null>
): UseVaultNotesResult {
  const [notes, setNotes] = useState<Note[]>([]);

  const resetNotes = useCallback(() => {
    setNotes([]);
  }, []);

  const loadNotes = useCallback(async (vault: VaultManager): Promise<Note[]> => {
    try {
      await vault.ensureDir(NOTES_DIR);
      const files = await vault.listFilesRecursive(NOTES_DIR, '.md');
      const noteResults = await Promise.all(
        files.map(async (file) => {
          try {
            const content = await vault.readFile(file);
            return parseNote(file, content);
          } catch (e) { warnUnexpected(`note(${file})`, e); return null; }
        })
      );
      const loaded = noteResults.filter((n): n is Note => n !== null);
      loaded.sort((a, b) => b.created.localeCompare(a.created));
      return loaded;
    } catch {
      return [];
    }
  }, []);

  const addNote = useCallback(async (note: Omit<Note, 'sourceFile'>) => {
    if (!vaultRef.current) return;
    const categoryDir = noteCategoryLabel(note.category);
    const dir = `${NOTES_DIR}/${categoryDir}`;
    await vaultRef.current.ensureDir(dir);
    const relPath = `${dir}/${noteFileName(note.title)}`;
    await vaultRef.current.writeFile(relPath, serializeNote(note));
    const exists = await vaultRef.current.exists(relPath);
    if (!exists) throw new Error('Échec de l\'écriture');
    setNotes((prev) => [{ ...note, sourceFile: relPath }, ...prev]);
  }, [vaultRef]);

  const updateNote = useCallback(async (sourceFile: string, note: Omit<Note, 'sourceFile'>) => {
    if (!vaultRef.current) return;
    const categoryDir = noteCategoryLabel(note.category);
    const newDir = `${NOTES_DIR}/${categoryDir}`;
    const newPath = `${newDir}/${noteFileName(note.title)}`;
    // Si le chemin a changé (catégorie ou titre modifié), supprimer l'ancien
    if (newPath !== sourceFile) {
      try { await vaultRef.current.deleteFile(sourceFile); } catch (e) { warnUnexpected('updateNote-deleteOld', e); }
    }
    await vaultRef.current.ensureDir(newDir);
    await vaultRef.current.writeFile(newPath, serializeNote(note));
    setNotes((prev) => prev.map((n) =>
      n.sourceFile === sourceFile ? { ...note, sourceFile: newPath } : n
    ));
  }, [vaultRef]);

  const deleteNote = useCallback(async (sourceFile: string) => {
    if (!vaultRef.current) return;
    await vaultRef.current.deleteFile(sourceFile);
    setNotes((prev) => prev.filter((n) => n.sourceFile !== sourceFile));
  }, [vaultRef]);

  return {
    notes,
    loadNotes,
    setNotes,
    addNote,
    updateNote,
    deleteNote,
    resetNotes,
  };
}
