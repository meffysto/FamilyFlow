/**
 * useVaultCourses.ts — Hook dédié au domaine Liste de courses
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultCourses(vaultRef).
 *
 * IMPORTANT: L'automatisation courses↔stock (auto-courses.ts) est appelée
 * par le code UI externe, pas par ce hook. Ce hook gère uniquement le CRUD
 * du fichier Liste de courses.md.
 */

import { useState, useCallback, useRef } from 'react';
import type React from 'react';
import type { CourseItem } from '../lib/types';
import { parseCourses } from '../lib/parser';
import type { VaultManager } from '../lib/vault';
import { COURSES_FILE_LEGACY } from '../lib/courses-constants';

function warnUnexpected(context: string, e: unknown) {
  const msg = String(e);
  const isNotFound = msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
  if (!isNotFound && __DEV__) console.warn(`[useVaultCourses] ${context}:`, e);
}

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultCoursesResult {
  courses: CourseItem[];
  setCourses: (courses: CourseItem[]) => void;
  addCourseItem: (text: string, section?: string) => Promise<void>;
  toggleCourseItem: (item: CourseItem, completed: boolean) => Promise<void>;
  removeCourseItem: (lineIndex: number) => Promise<void>;
  moveCourseItem: (lineIndex: number, text: string, newSection: string) => Promise<void>;
  mergeCourseIngredients: (items: { text: string; name: string; quantity: number | null; section: string }[]) => Promise<{ added: number; merged: number }>;
  clearCompletedCourses: () => Promise<void>;
  resetCourses: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultCourses(
  vaultRef: React.MutableRefObject<VaultManager | null>,
): UseVaultCoursesResult {
  const [courses, setCourses] = useState<CourseItem[]>([]);

  // Queue d'écritures séquentielle — évite les races sur le même fichier vault
  // quand plusieurs handlers UI déclenchent des writes concurrents (ex : tap rapide).
  const writeQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const enqueueWrite = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    // .then(fn, fn) : la chaîne ne casse pas sur erreur (l'erreur est rejetée
    // à l'appelant via la promesse retournée, mais la queue continue).
    const next = writeQueueRef.current.then(fn, fn) as Promise<T>;
    writeQueueRef.current = next.catch(() => undefined); // swallow pour la chaîne
    return next;
  }, []);

  const resetCourses = useCallback(() => {
    setCourses([]);
  }, []);

  const addCourseItem = useCallback(async (text: string, section?: string) => {
    return enqueueWrite(async () => {
      if (!vaultRef.current) return;
      await vaultRef.current.appendTask(COURSES_FILE_LEGACY, section ?? null, text);
      const newContent = await vaultRef.current.readFile(COURSES_FILE_LEGACY);
      setCourses(parseCourses(newContent, COURSES_FILE_LEGACY));
    });
  }, [enqueueWrite]);

  const toggleCourseItem = useCallback(async (item: CourseItem, completed: boolean) => {
    return enqueueWrite(async () => {
      if (!vaultRef.current) return;
      await vaultRef.current.toggleTask(COURSES_FILE_LEGACY, item.lineIndex, completed);
      setCourses((prev) => prev.map((c) => (c.id === item.id ? { ...c, completed } : c)));
    });
  }, [enqueueWrite]);

  const removeCourseItem = useCallback(async (lineIndex: number) => {
    return enqueueWrite(async () => {
      if (!vaultRef.current) return;
      try {
        const content = await vaultRef.current.readFile(COURSES_FILE_LEGACY);
        const lines = content.split('\n');
        if (lineIndex >= 0 && lineIndex < lines.length) {
          lines.splice(lineIndex, 1);
          await vaultRef.current.writeFile(COURSES_FILE_LEGACY, lines.join('\n'));
          const updated = parseCourses(lines.join('\n'), COURSES_FILE_LEGACY);
          setCourses(updated);
        }
      } catch (e) {
        throw new Error(`removeCourseItem: ${e}`);
      }
    });
  }, [enqueueWrite]);

  const moveCourseItem = useCallback(async (lineIndex: number, text: string, newSection: string) => {
    return enqueueWrite(async () => {
      if (!vaultRef.current) return;
      const content = await vaultRef.current.readFile(COURSES_FILE_LEGACY);
      const lines = content.split('\n');
      if (lineIndex < 0 || lineIndex >= lines.length) return;

      // 1. Supprimer l'ancienne ligne
      lines.splice(lineIndex, 1);

      // 2. Trouver ou créer la section cible, insérer l'article
      const sectionHeader = `## ${newSection}`;
      let sectionIdx = lines.findIndex(l => l.trim() === sectionHeader);
      if (sectionIdx === -1) {
        lines.push('', sectionHeader, `- [ ] ${text}`);
      } else {
        let insertIdx = sectionIdx + 1;
        while (insertIdx < lines.length && lines[insertIdx].startsWith('- [')) {
          insertIdx++;
        }
        lines.splice(insertIdx, 0, `- [ ] ${text}`);
      }

      // 3. Écriture unique + mise à jour state locale
      const newContent = lines.join('\n');
      await vaultRef.current.writeFile(COURSES_FILE_LEGACY, newContent);
      setCourses(parseCourses(newContent, COURSES_FILE_LEGACY));
    });
  }, [enqueueWrite]);

  const mergeCourseIngredients = useCallback(async (items: { text: string; name: string; quantity: number | null; section: string }[]): Promise<{ added: number; merged: number }> => {
    return enqueueWrite(async () => {
      if (!vaultRef.current) return { added: 0, merged: 0 };
      let added = 0;
      let merged = 0;

      try {
        let content = '';
        try { content = await vaultRef.current.readFile(COURSES_FILE_LEGACY); } catch (e) { warnUnexpected('mergeCourses-read', e); }
        const lines = content.split('\n');

        for (const item of items) {
          const nameNorm = item.name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

          let foundIdx = -1;
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line.match(/^-\s+\[ \]/)) continue;
            const lineText = line.replace(/^-\s+\[ \]\s*/, '');
            const lineNorm = lineText.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (lineNorm.includes(nameNorm)) {
              foundIdx = i;
              break;
            }
          }

          if (foundIdx >= 0) {
            if (item.quantity === null) {
              merged++;
              continue;
            }
            const existingLine = lines[foundIdx].replace(/^-\s+\[ \]\s*/, '');
            const existingMatch = existingLine.match(/^(\d+(?:[.,]\d+)?)\s+/);
            if (existingMatch) {
              const existingQty = parseFloat(existingMatch[1].replace(',', '.'));
              const mergedQty = existingQty + item.quantity;
              const mergedText = existingLine.replace(/^\d+(?:[.,]\d+)?/, String(mergedQty));
              lines[foundIdx] = `- [ ] ${mergedText}`;
              merged++;
              continue;
            }
          }

          const sectionHeader = `## ${item.section}`;
          let sectionIdx = lines.findIndex((l) => l.trim() === sectionHeader);
          if (sectionIdx === -1) {
            lines.push('', sectionHeader);
            sectionIdx = lines.length - 1;
          }
          let insertIdx = sectionIdx + 1;
          while (insertIdx < lines.length && (lines[insertIdx].startsWith('- ') || lines[insertIdx].trim() === '')) {
            if (lines[insertIdx].trim() !== '' && !lines[insertIdx].startsWith('- ')) break;
            insertIdx++;
          }
          lines.splice(insertIdx, 0, `- [ ] ${item.text}`);
          added++;
        }

        const newContent = lines.join('\n');
        await vaultRef.current.writeFile(COURSES_FILE_LEGACY, newContent);
        setCourses(parseCourses(newContent, COURSES_FILE_LEGACY));
      } catch (e) {
        throw new Error(`mergeCourseIngredients: ${e}`);
      }

      return { added, merged };
    });
  }, [enqueueWrite]);

  const clearCompletedCourses = useCallback(async () => {
    return enqueueWrite(async () => {
      if (!vaultRef.current) return;
      try {
        const content = await vaultRef.current.readFile(COURSES_FILE_LEGACY);
        const lines = content.split('\n');
        const cleaned = lines.filter((l) => !l.match(/^-\s+\[x\]/i));
        const newContent = cleaned.join('\n');
        await vaultRef.current.writeFile(COURSES_FILE_LEGACY, newContent);
        setCourses(parseCourses(newContent, COURSES_FILE_LEGACY));
      } catch (e) {
        throw new Error(`clearCompletedCourses: ${e}`);
      }
    });
  }, [enqueueWrite]);

  return {
    courses,
    setCourses,
    addCourseItem,
    toggleCourseItem,
    removeCourseItem,
    moveCourseItem,
    mergeCourseIngredients,
    clearCompletedCourses,
    resetCourses,
  };
}
