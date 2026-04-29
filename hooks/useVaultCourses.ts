/**
 * useVaultCourses.ts — Hook dédié au domaine Liste de courses
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultCourses(vaultRef).
 *
 * IMPORTANT: L'automatisation courses↔stock (auto-courses.ts) est appelée
 * par le code UI externe, pas par ce hook. Ce hook gère uniquement le CRUD
 * du fichier Liste de courses.md.
 *
 * Phase B (260428-g5n) — Optimistic UI : tous les writes (add/toggle/remove/
 * move/merge/clear) appliquent une mutation optimiste AVANT enqueueWrite, avec
 * rollback automatique en cas d'erreur via snapshot capturé sur coursesRef.
 *
 * Phase D (260428-huh) — Multi-listes : un fichier .md par liste dans
 * `02 - Maison/Listes/{slug}.md`. Migration auto idempotente du legacy
 * `Liste de courses.md` au premier mount post-merge. Liste active persistée
 * dans SecureStore. API étendue : listes, activeListId, setActiveList,
 * createList, renameList, deleteList, duplicateList, archiveList,
 * mergeCourseIngredientsToList, totalRemainingAllLists. API existante
 * inchangée — les writes courants ciblent pathOf(activeListId).
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type React from 'react';
import * as SecureStore from 'expo-secure-store';
import type { CourseItem } from '../lib/types';
import { parseCourses } from '../lib/parser';
import {
  parseCourseList,
  serializeCourseList,
  serializeCourseListMeta,
  slugifyListName,
  type CourseListMeta,
} from '../lib/parser';
import type { VaultManager } from '../lib/vault';
import {
  COURSES_FILE_LEGACY,
  COURSES_LISTS_DIR,
  COURSES_DEFAULT_SECTION,
} from '../lib/courses-constants';

const ACTIVE_LIST_KEY = 'active_course_list_v1';

function warnUnexpected(context: string, e: unknown) {
  const msg = String(e);
  const isNotFound = msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
  if (!isNotFound && __DEV__) console.warn(`[useVaultCourses] ${context}:`, e);
}

const makeTempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const todayLocal = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const pathOf = (id: string) => `${COURSES_LISTS_DIR}/${id}.md`;

// ─── Types exportés ──────────────────────────────────────────────────────────

export interface CourseList {
  id: string; // = slug = nom de fichier sans .md
  nom: string;
  icon: string; // nom lucide kebab-case
  archive: boolean;
  createdAt: string;
  itemCount: number;
  remainingCount: number;
  /** Ordre appris des sections pour le mode magasin (parcours optimisé). */
  parcours?: string[];
}

export interface UseVaultCoursesResult {
  courses: CourseItem[];
  setCourses: (courses: CourseItem[]) => void;
  addCourseItem: (text: string, section?: string) => Promise<void>;
  toggleCourseItem: (item: CourseItem, completed: boolean) => Promise<void>;
  removeCourseItem: (lineIndex: number) => Promise<void>;
  moveCourseItem: (lineIndex: number, text: string, newSection: string) => Promise<void>;
  updateCourseItem: (lineIndex: number, patch: { text: string; section: string }) => Promise<void>;
  mergeCourseIngredients: (items: { text: string; name: string; quantity: number | null; section: string }[]) => Promise<{ added: number; merged: number }>;
  clearCompletedCourses: () => Promise<void>;
  resetCourses: () => void;
  // Phase D multi-listes
  listes: CourseList[];
  activeListId: string | null;
  totalRemainingAllLists: number;
  setActiveList: (id: string) => Promise<void>;
  createList: (nom: string, icon: string) => Promise<string>;
  renameList: (id: string, nom: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  duplicateList: (id: string, newNom: string) => Promise<void>;
  archiveList: (id: string, archive: boolean) => Promise<void>;
  mergeCourseIngredientsToList: (
    listId: string,
    items: { text: string; name: string; quantity: number | null; section: string }[],
  ) => Promise<{ added: number; merged: number }>;
  setListParcours: (id: string, parcours: string[]) => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultCourses(
  vaultRef: React.MutableRefObject<VaultManager | null>,
  vaultPath: string | null,
): UseVaultCoursesResult {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [listes, setListes] = useState<CourseList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);

  // Snapshots synchrones pour rollback / closures stables
  const coursesRef = useRef<CourseItem[]>([]);
  const listesRef = useRef<CourseList[]>([]);
  const activeListIdRef = useRef<string | null>(null);
  useEffect(() => { coursesRef.current = courses; }, [courses]);
  useEffect(() => { listesRef.current = listes; }, [listes]);
  useEffect(() => { activeListIdRef.current = activeListId; }, [activeListId]);

  // Queue d'écritures séquentielle — évite les races sur le même fichier vault.
  const writeQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const enqueueWrite = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const next = writeQueueRef.current.then(fn, fn) as Promise<T>;
    writeQueueRef.current = next.catch(() => undefined);
    return next;
  }, []);

  // ─── Helpers internes ─────────────────────────────────────────────────────

  const loadListes = useCallback(async (): Promise<CourseList[]> => {
    const vm = vaultRef.current;
    if (!vm) return [];
    try {
      await vm.ensureDir(COURSES_LISTS_DIR);
    } catch (e) { warnUnexpected('ensureDir Listes', e); }

    let entries: string[] = [];
    try {
      entries = await vm.listDir(COURSES_LISTS_DIR);
    } catch (e) { warnUnexpected('listDir Listes', e); return []; }

    const parsed: CourseList[] = [];
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;
      if (entry.endsWith('.bak')) continue;
      const id = entry.slice(0, -3);
      const path = `${COURSES_LISTS_DIR}/${entry}`;
      try {
        const content = await vm.readFile(path);
        const { meta, items } = parseCourseList(content, path);
        parsed.push({
          id,
          nom: meta.nom,
          icon: meta.icon,
          archive: meta.archive,
          createdAt: meta.createdAt,
          itemCount: items.length,
          remainingCount: items.filter(i => !i.completed).length,
          ...(meta.parcours && meta.parcours.length > 0 ? { parcours: meta.parcours } : {}),
        });
      } catch (e) {
        warnUnexpected(`loadListes(${entry})`, e);
      }
    }

    parsed.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    setListes(parsed);
    return parsed;
  }, []);

  const migrateIfNeeded = useCallback(async (): Promise<void> => {
    const vm = vaultRef.current;
    if (!vm) return;
    try {
      const legacyExists = await vm.exists(COURSES_FILE_LEGACY);

      // Cas 1 : legacy présent → migration prioritaire (peu importe l'état de Listes/)
      if (legacyExists) {
        await vm.ensureDir(COURSES_LISTS_DIR);
        const legacyContent = await vm.readFile(COURSES_FILE_LEGACY);
        const items = parseCourses(legacyContent, COURSES_FILE_LEGACY);

        // Choisir un slug libre : "principale", sinon "principale-2", "principale-3"…
        const existingFiles = (await vm.listDir(COURSES_LISTS_DIR))
          .filter((f) => f.endsWith('.md') && !f.endsWith('.bak'));
        const existingSlugs = new Set(existingFiles.map((f) => f.replace(/\.md$/, '')));
        let slug = 'principale';
        let n = 2;
        while (existingSlugs.has(slug)) slug = `principale-${n++}`;

        const meta: CourseListMeta = {
          nom: slug === 'principale' ? 'Principale' : `Principale ${slug.split('-')[1]}`,
          icon: 'shopping-cart',
          archive: false,
          createdAt: todayLocal(),
        };
        await vm.writeFile(pathOf(slug), serializeCourseList(meta, items));

        // Backup .bak puis suppression du legacy
        try {
          await vm.writeFile(`${COURSES_FILE_LEGACY}.bak`, legacyContent);
          await vm.deleteFile(COURSES_FILE_LEGACY);
        } catch (e) {
          warnUnexpected('migration backup', e);
        }
        return;
      }

      // Cas 2 : pas de legacy. Si Listes/ a déjà au moins une liste → no-op.
      let existingFiles: string[] = [];
      try {
        existingFiles = (await vm.listDir(COURSES_LISTS_DIR))
          .filter((f) => f.endsWith('.md') && !f.endsWith('.bak'));
      } catch {
        existingFiles = [];
      }
      if (existingFiles.length > 0) return;

      // Cas 3 : vault vierge — créer une liste minimale
      await vm.ensureDir(COURSES_LISTS_DIR);
      const meta: CourseListMeta = {
        nom: 'Principale',
        icon: 'shopping-cart',
        archive: false,
        createdAt: todayLocal(),
      };
      await vm.writeFile(pathOf('principale'), serializeCourseList(meta, []));
    } catch (e) {
      warnUnexpected('migrateIfNeeded', e);
    }
  }, []);

  // ─── Mount : migration + load + restore active ─────────────────────────────

  useEffect(() => {
    const vm = vaultRef.current;
    if (!vm) return;
    let cancelled = false;

    (async () => {
      await migrateIfNeeded();
      const all = await loadListes();
      if (cancelled) return;

      let stored: string | null = null;
      try {
        stored = await SecureStore.getItemAsync(ACTIVE_LIST_KEY);
      } catch { stored = null; }

      const nonArchived = all.filter(l => !l.archive);
      const validStored = stored && all.find(l => l.id === stored && !l.archive) ? stored : null;
      const fallback = nonArchived[0]?.id ?? null;
      const initialId = validStored ?? fallback;
      setActiveListId(initialId);

      if (initialId) {
        try {
          const content = await vm.readFile(pathOf(initialId));
          const { items } = parseCourseList(content, pathOf(initialId));
          if (!cancelled) setCourses(items);
        } catch (e) {
          warnUnexpected('mount load active', e);
          if (!cancelled) setCourses([]);
        }
      } else {
        if (!cancelled) setCourses([]);
      }
    })().catch(() => {});

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultPath]);

  // ─── Helper "current path" pour writes ────────────────────────────────────

  const currentPath = useCallback((): string | null => {
    const id = activeListIdRef.current;
    return id ? pathOf(id) : null;
  }, []);

  // ─── API existante (writes ciblent pathOf(activeListId)) ──────────────────

  const resetCourses = useCallback(() => {
    setCourses([]);
  }, []);

  const addCourseItem = useCallback(async (text: string, section?: string) => {
    const tempId = makeTempId();
    const optimistic: CourseItem = {
      id: tempId,
      text,
      section: section ?? COURSES_DEFAULT_SECTION,
      completed: false,
      lineIndex: -1,
      pending: true,
    };
    setCourses((prev) => [...prev, optimistic]);

    return enqueueWrite(async () => {
      const path = currentPath();
      if (!vaultRef.current || !path) {
        setCourses((prev) => prev.filter((c) => c.id !== tempId));
        return;
      }
      try {
        await vaultRef.current.appendTask(path, section ?? null, text);
        const newContent = await vaultRef.current.readFile(path);
        const { items } = parseCourseList(newContent, path);
        setCourses(items);
        loadListes().catch(() => {});
      } catch (e) {
        setCourses((prev) => prev.filter((c) => c.id !== tempId));
        throw e;
      }
    });
  }, [enqueueWrite, currentPath, loadListes]);

  const toggleCourseItem = useCallback(async (item: CourseItem, completed: boolean) => {
    const snapshot = coursesRef.current;
    setCourses((prev) => prev.map((c) => (c.id === item.id ? { ...c, completed, pending: true } : c)));

    return enqueueWrite(async () => {
      const path = currentPath();
      if (!vaultRef.current || !path) { setCourses(snapshot); return; }
      try {
        await vaultRef.current.toggleTask(path, item.lineIndex, completed);
        setCourses((prev) => prev.map((c) => (c.id === item.id ? { ...c, completed, pending: false } : c)));
        loadListes().catch(() => {});
      } catch (e) {
        setCourses(snapshot);
        throw e;
      }
    });
  }, [enqueueWrite, currentPath, loadListes]);

  const removeCourseItem = useCallback(async (lineIndex: number) => {
    const snapshot = coursesRef.current;
    setCourses((prev) => prev.filter((c) => c.lineIndex !== lineIndex));

    return enqueueWrite(async () => {
      const path = currentPath();
      if (!vaultRef.current || !path) { setCourses(snapshot); return; }
      try {
        const content = await vaultRef.current.readFile(path);
        const lines = content.split('\n');
        if (lineIndex >= 0 && lineIndex < lines.length) {
          lines.splice(lineIndex, 1);
          const newContent = lines.join('\n');
          await vaultRef.current.writeFile(path, newContent);
          const { items } = parseCourseList(newContent, path);
          setCourses(items);
          loadListes().catch(() => {});
        }
      } catch (e) {
        setCourses(snapshot);
        throw new Error(`removeCourseItem: ${e}`);
      }
    });
  }, [enqueueWrite, currentPath, loadListes]);

  const moveCourseItem = useCallback(async (lineIndex: number, text: string, newSection: string) => {
    const snapshot = coursesRef.current;
    setCourses((prev) => prev.map((c) => (c.lineIndex === lineIndex ? { ...c, section: newSection, pending: true } : c)));

    return enqueueWrite(async () => {
      const path = currentPath();
      if (!vaultRef.current || !path) { setCourses(snapshot); return; }
      try {
        const content = await vaultRef.current.readFile(path);
        const lines = content.split('\n');
        if (lineIndex < 0 || lineIndex >= lines.length) return;

        lines.splice(lineIndex, 1);

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

        const newContent = lines.join('\n');
        await vaultRef.current.writeFile(path, newContent);
        const { items } = parseCourseList(newContent, path);
        setCourses(items);
        loadListes().catch(() => {});
      } catch (e) {
        setCourses(snapshot);
        throw e;
      }
    });
  }, [enqueueWrite, currentPath, loadListes]);

  const updateCourseItem = useCallback(async (lineIndex: number, patch: { text: string; section: string }) => {
    const snapshot = coursesRef.current;
    const current = snapshot.find((c) => c.lineIndex === lineIndex);
    if (!current) return;
    if (current.text === patch.text && current.section === patch.section) return;

    setCourses((prev) => prev.map((c) =>
      c.lineIndex === lineIndex ? { ...c, text: patch.text, section: patch.section, pending: true } : c
    ));

    return enqueueWrite(async () => {
      const path = currentPath();
      if (!vaultRef.current || !path) { setCourses(snapshot); return; }
      try {
        const content = await vaultRef.current.readFile(path);
        const lines = content.split('\n');
        if (lineIndex < 0 || lineIndex >= lines.length) return;

        const originalLine = lines[lineIndex];
        const checkedMatch = originalLine.match(/^-\s+\[(x| )\]/i);
        const mark = checkedMatch && checkedMatch[1].toLowerCase() === 'x' ? 'x' : ' ';

        if (current.section === patch.section) {
          lines[lineIndex] = `- [${mark}] ${patch.text}`;
        } else {
          lines.splice(lineIndex, 1);
          const sectionHeader = `## ${patch.section}`;
          let sectionIdx = lines.findIndex((l) => l.trim() === sectionHeader);
          if (sectionIdx === -1) {
            lines.push('', sectionHeader, `- [${mark}] ${patch.text}`);
          } else {
            let insertIdx = sectionIdx + 1;
            while (insertIdx < lines.length && lines[insertIdx].startsWith('- [')) {
              insertIdx++;
            }
            lines.splice(insertIdx, 0, `- [${mark}] ${patch.text}`);
          }
        }

        const newContent = lines.join('\n');
        await vaultRef.current.writeFile(path, newContent);
        const { items } = parseCourseList(newContent, path);
        setCourses(items);
        loadListes().catch(() => {});
      } catch (e) {
        setCourses(snapshot);
        throw e;
      }
    });
  }, [enqueueWrite, currentPath, loadListes]);

  // Helper réutilisable : merge ingredients dans le contenu (lines) d'un fichier.
  const mergeIntoLines = (
    lines: string[],
    items: { text: string; name: string; quantity: number | null; section: string }[],
  ): { added: number; merged: number } => {
    let added = 0;
    let merged = 0;

    for (const item of items) {
      const nameNorm = item.name.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');

      let foundIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.match(/^-\s+\[ \]/)) continue;
        const lineText = line.replace(/^-\s+\[ \]\s*/, '');
        const lineNorm = lineText.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
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
    return { added, merged };
  };

  const mergeCourseIngredients = useCallback(async (items: { text: string; name: string; quantity: number | null; section: string }[]): Promise<{ added: number; merged: number }> => {
    const snapshot = coursesRef.current;
    const optimistics: CourseItem[] = items.map((item) => ({
      id: makeTempId(),
      text: item.text,
      section: item.section,
      completed: false,
      lineIndex: -1,
      pending: true,
    }));
    setCourses((prev) => [...prev, ...optimistics]);

    return enqueueWrite(async () => {
      const path = currentPath();
      if (!vaultRef.current || !path) { setCourses(snapshot); return { added: 0, merged: 0 }; }

      try {
        let content = '';
        try { content = await vaultRef.current.readFile(path); } catch (e) { warnUnexpected('mergeCourses-read', e); }
        const lines = content.split('\n');

        const result = mergeIntoLines(lines, items);

        const newContent = lines.join('\n');
        await vaultRef.current.writeFile(path, newContent);
        const { items: parsedItems } = parseCourseList(newContent, path);
        setCourses(parsedItems);
        loadListes().catch(() => {});
        return result;
      } catch (e) {
        setCourses(snapshot);
        throw new Error(`mergeCourseIngredients: ${e}`);
      }
    });
  }, [enqueueWrite, currentPath, loadListes]);

  const clearCompletedCourses = useCallback(async () => {
    const snapshot = coursesRef.current;
    setCourses((prev) => prev.filter((c) => !c.completed));

    return enqueueWrite(async () => {
      const path = currentPath();
      if (!vaultRef.current || !path) { setCourses(snapshot); return; }
      try {
        const content = await vaultRef.current.readFile(path);
        const lines = content.split('\n');
        const cleaned = lines.filter((l) => !l.match(/^-\s+\[x\]/i));
        const newContent = cleaned.join('\n');
        await vaultRef.current.writeFile(path, newContent);
        const { items } = parseCourseList(newContent, path);
        setCourses(items);
        loadListes().catch(() => {});
      } catch (e) {
        setCourses(snapshot);
        throw new Error(`clearCompletedCourses: ${e}`);
      }
    });
  }, [enqueueWrite, currentPath, loadListes]);

  // ─── Multi-listes : CRUD ───────────────────────────────────────────────────

  const setActiveList = useCallback(async (id: string): Promise<void> => {
    const vm = vaultRef.current;
    if (!vm) return;
    try {
      await SecureStore.setItemAsync(ACTIVE_LIST_KEY, id);
    } catch (e) { warnUnexpected('setActiveList persist', e); }
    setActiveListId(id);
    try {
      const content = await vm.readFile(pathOf(id));
      const { items } = parseCourseList(content, pathOf(id));
      setCourses(items);
    } catch (e) {
      warnUnexpected('setActiveList read', e);
      setCourses([]);
    }
    loadListes().catch(() => {});
  }, [loadListes]);

  const uniqueSlug = (baseSlug: string, existingIds: string[]): string => {
    if (!existingIds.includes(baseSlug)) return baseSlug;
    let i = 2;
    while (existingIds.includes(`${baseSlug}-${i}`)) i++;
    return `${baseSlug}-${i}`;
  };

  const createList = useCallback(async (nom: string, icon: string): Promise<string> => {
    const vm = vaultRef.current;
    if (!vm) throw new Error('Vault non initialisé');

    const baseSlug = slugifyListName(nom);
    const existingIds = listesRef.current.map(l => l.id);
    const id = uniqueSlug(baseSlug, existingIds);

    const meta: CourseListMeta = {
      nom: nom.trim() || 'Sans nom',
      icon: icon || 'shopping-cart',
      archive: false,
      createdAt: todayLocal(),
    };

    return enqueueWrite(async () => {
      await vm.ensureDir(COURSES_LISTS_DIR);
      await vm.writeFile(pathOf(id), serializeCourseList(meta, []));
      await loadListes();
      return id;
    });
  }, [enqueueWrite, loadListes]);

  const renameList = useCallback(async (id: string, nom: string): Promise<void> => {
    const vm = vaultRef.current;
    if (!vm) return;
    return enqueueWrite(async () => {
      try {
        const content = await vm.readFile(pathOf(id));
        const { meta, items } = parseCourseList(content, pathOf(id));
        const newMeta: CourseListMeta = { ...meta, nom: nom.trim() || meta.nom };
        await vm.writeFile(pathOf(id), serializeCourseList(newMeta, items));
        await loadListes();
      } catch (e) {
        throw new Error(`renameList: ${e}`);
      }
    });
  }, [enqueueWrite, loadListes]);

  const deleteList = useCallback(async (id: string): Promise<void> => {
    const vm = vaultRef.current;
    if (!vm) return;
    return enqueueWrite(async () => {
      try {
        await vm.deleteFile(pathOf(id));
      } catch (e) {
        warnUnexpected('deleteList file', e);
      }
      const all = await loadListes();
      if (activeListIdRef.current === id) {
        const fallback = all.find(l => !l.archive)?.id ?? null;
        if (fallback) {
          await setActiveList(fallback);
        } else {
          setActiveListId(null);
          setCourses([]);
          try { await SecureStore.deleteItemAsync(ACTIVE_LIST_KEY); } catch {}
        }
      }
    });
  }, [enqueueWrite, loadListes, setActiveList]);

  const duplicateList = useCallback(async (id: string, newNom: string): Promise<void> => {
    const vm = vaultRef.current;
    if (!vm) return;
    return enqueueWrite(async () => {
      try {
        const content = await vm.readFile(pathOf(id));
        const { meta, items } = parseCourseList(content, pathOf(id));
        const baseSlug = slugifyListName(newNom);
        const existingIds = listesRef.current.map(l => l.id);
        const newId = uniqueSlug(baseSlug, existingIds);
        const newMeta: CourseListMeta = {
          nom: newNom.trim() || meta.nom,
          icon: meta.icon,
          archive: false,
          createdAt: todayLocal(),
        };
        await vm.writeFile(pathOf(newId), serializeCourseList(newMeta, items));
        await loadListes();
      } catch (e) {
        throw new Error(`duplicateList: ${e}`);
      }
    });
  }, [enqueueWrite, loadListes]);

  const archiveList = useCallback(async (id: string, archive: boolean): Promise<void> => {
    const vm = vaultRef.current;
    if (!vm) return;
    return enqueueWrite(async () => {
      try {
        const content = await vm.readFile(pathOf(id));
        const { meta, items } = parseCourseList(content, pathOf(id));
        const newMeta: CourseListMeta = { ...meta, archive };
        await vm.writeFile(pathOf(id), serializeCourseList(newMeta, items));
        const all = await loadListes();
        if (archive && activeListIdRef.current === id) {
          const fallback = all.find(l => !l.archive)?.id ?? null;
          if (fallback) {
            await setActiveList(fallback);
          } else {
            setActiveListId(null);
            setCourses([]);
          }
        }
      } catch (e) {
        throw new Error(`archiveList: ${e}`);
      }
    });
  }, [enqueueWrite, loadListes, setActiveList]);

  const mergeCourseIngredientsToList = useCallback(async (
    listId: string,
    items: { text: string; name: string; quantity: number | null; section: string }[],
  ): Promise<{ added: number; merged: number }> => {
    if (listId === activeListIdRef.current) {
      return mergeCourseIngredients(items);
    }
    const vm = vaultRef.current;
    if (!vm) return { added: 0, merged: 0 };

    return enqueueWrite(async () => {
      const path = pathOf(listId);
      try {
        let content = '';
        try { content = await vm.readFile(path); } catch (e) { warnUnexpected('mergeToList-read', e); return { added: 0, merged: 0 }; }

        // Préserver le frontmatter via parse + reserialize
        const { meta, items: existingItems } = parseCourseList(content, path);
        // Reconstruire un body brut depuis les items pour appliquer mergeIntoLines
        // Stratégie : reserialize sans frontmatter, manipuler lines, puis prepend frontmatter
        const bodyOnly = serializeCourseList(meta, existingItems).replace(serializeCourseListMeta(meta), '');
        const lines = bodyOnly.split('\n');
        const result = mergeIntoLines(lines, items);
        const newContent = serializeCourseListMeta(meta) + lines.join('\n');
        await vm.writeFile(path, newContent);
        loadListes().catch(() => {});
        return result;
      } catch (e) {
        warnUnexpected('mergeCourseIngredientsToList', e);
        return { added: 0, merged: 0 };
      }
    });
  }, [mergeCourseIngredients, enqueueWrite, loadListes]);

  // ─── Parcours (mode magasin) ──────────────────────────────────────────────

  const setListParcours = useCallback(async (id: string, parcours: string[]): Promise<void> => {
    const vm = vaultRef.current;
    if (!vm) return;
    return enqueueWrite(async () => {
      try {
        const path = pathOf(id);
        const content = await vm.readFile(path);
        const { meta, items } = parseCourseList(content, path);
        const cleaned = parcours.filter(s => typeof s === 'string' && s.length > 0);
        const newMeta: CourseListMeta = {
          ...meta,
          ...(cleaned.length > 0 ? { parcours: cleaned } : { parcours: undefined }),
        };
        await vm.writeFile(path, serializeCourseList(newMeta, items));
        loadListes().catch(() => {});
      } catch (e) {
        warnUnexpected('setListParcours', e);
      }
    });
  }, [enqueueWrite, loadListes]);

  // ─── totalRemainingAllLists ───────────────────────────────────────────────

  const totalRemainingAllLists = useMemo(() => {
    const activeId = activeListId;
    let total = 0;
    for (const l of listes) {
      if (l.archive) continue;
      if (activeId && l.id === activeId) {
        total += courses.filter(c => !c.completed).length;
      } else {
        total += l.remainingCount;
      }
    }
    return total;
  }, [listes, activeListId, courses]);

  return {
    courses,
    setCourses,
    addCourseItem,
    toggleCourseItem,
    removeCourseItem,
    moveCourseItem,
    updateCourseItem,
    mergeCourseIngredients,
    clearCompletedCourses,
    resetCourses,
    listes,
    activeListId,
    totalRemainingAllLists,
    setActiveList,
    createList,
    renameList,
    deleteList,
    duplicateList,
    archiveList,
    mergeCourseIngredientsToList,
    setListParcours,
  };
}
