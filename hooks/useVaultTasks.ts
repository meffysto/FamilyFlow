/**
 * useVaultTasks.ts — Hook dedié au domaine Taches
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultTasks(vaultRef, triggerWidgetRefresh, vacationTasksSetter).
 */

import { useState, useCallback, useRef, useEffect, type SetStateAction, type Dispatch } from 'react';
import type React from 'react';
import type { Task } from '../lib/types';
import type { VaultManager } from '../lib/vault';
import { parseTaskFile } from '../lib/parser';
import { nextOccurrence } from '../lib/recurrence';
import { format, addDays, parseISO } from 'date-fns';

// ─── Constantes ──────────────────────────────────────────────────────────────

const STATIC_TASK_FILES = ['02 - Maison/Tâches récurrentes.md'];

function warnUnexpected(context: string, e: unknown) {
  const msg = String(e);
  const isNotFound = msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
  if (!isNotFound && __DEV__) console.warn(`[useVaultTasks] ${context}:`, e);
}

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultTasksResult {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  tasksRef: React.MutableRefObject<Task[]>;
  toggleTask: (task: Task, completed: boolean) => Promise<void>;
  skipTask: (task: Task) => Promise<void>;
  addTask: (text: string, targetFile: string, dueDate?: string, recurrence?: string, reminderTime?: string) => Promise<void>;
  editTask: (task: Task, updates: { text?: string; dueDate?: string; recurrence?: string; reminderTime?: string; targetFile?: string }) => Promise<void>;
  deleteTask: (sourceFile: string, lineIndex: number) => Promise<void>;
  resetTasks: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultTasks(
  vaultRef: React.MutableRefObject<VaultManager | null>,
  triggerWidgetRefresh: () => void,
  vacationTasksSetter: React.Dispatch<React.SetStateAction<Task[]>>,
): UseVaultTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const resetTasks = useCallback(() => {
    setTasks([]);
  }, []);

  // ─── toggleTask ──────────────────────────────────────────────────────────

  const toggleTask = useCallback(async (task: Task, completed: boolean) => {
    if (!vaultRef.current) return;
    await vaultRef.current.toggleTask(task.sourceFile, task.lineIndex, completed);
    const updateTask = (t: Task): Task => {
      if (t.id !== task.id) return t;
      if (completed && t.recurrence && t.dueDate) {
        const newDate = nextOccurrence(t.dueDate, t.recurrence);
        return { ...t, dueDate: newDate, completed: false };
      }
      const today = format(new Date(), 'yyyy-MM-dd');
      return { ...t, completed, completedDate: completed ? today : undefined };
    };
    setTasks(prev => prev.map(updateTask));
    vacationTasksSetter(prev => prev.map(updateTask));
    setTimeout(triggerWidgetRefresh, 0);
  }, [triggerWidgetRefresh, vacationTasksSetter]);

  // ─── skipTask ────────────────────────────────────────────────────────────

  const skipTask = useCallback(async (task: Task) => {
    if (!vaultRef.current) return;
    await vaultRef.current.skipTask(task.sourceFile, task.lineIndex);
    const updateTask = (t: Task): Task => {
      if (t.id !== task.id) return t;
      if (t.recurrence && t.dueDate) {
        const newDate = nextOccurrence(t.dueDate, t.recurrence);
        return { ...t, dueDate: newDate, completed: false };
      }
      if (t.dueDate) {
        const newDate = format(addDays(parseISO(t.dueDate), 1), 'yyyy-MM-dd');
        return { ...t, dueDate: newDate, completed: false };
      }
      return t;
    };
    setTasks(prev => prev.map(updateTask));
    vacationTasksSetter(prev => prev.map(updateTask));
    setTimeout(triggerWidgetRefresh, 0);
  }, [triggerWidgetRefresh, vacationTasksSetter]);

  // ─── addTask ─────────────────────────────────────────────────────────────

  const addTask = useCallback(async (text: string, targetFile: string, dueDate?: string, recurrence?: string, reminderTime?: string) => {
    if (!vaultRef.current) return;
    let taskText = text;
    if (recurrence) taskText += ` \u{1F501} ${recurrence}`;
    if (dueDate) taskText += ` \u{1F4C5} ${dueDate}`;
    if (reminderTime) taskText += ` \u23F0 ${reminderTime}`;
    let section: string | null = null;
    if (recurrence) {
      if (/every\s+week/i.test(recurrence) && targetFile.includes('Maison')) section = 'Ménage';
      else if (/every\s+day/i.test(recurrence)) section = 'Quotidien';
      else if (/every\s+week/i.test(recurrence)) section = 'Hebdomadaire';
      else if (/every\s+month/i.test(recurrence)) section = 'Mensuel';
    }
    await vaultRef.current.appendTask(targetFile, section, taskText);
    const updatedContent = await vaultRef.current.readFile(targetFile);
    const updatedTasks = parseTaskFile(targetFile, updatedContent);
    setTasks(prev => {
      const otherTasks = prev.filter(t => t.sourceFile !== targetFile);
      return [...otherTasks, ...updatedTasks];
    });
    setTimeout(triggerWidgetRefresh, 0);
  }, [triggerWidgetRefresh]);

  // ─── editTask ────────────────────────────────────────────────────────────

  const editTask = useCallback(async (task: Task, updates: { text?: string; dueDate?: string; recurrence?: string; reminderTime?: string; targetFile?: string }) => {
    if (!vaultRef.current) return;
    const newText = updates.text ?? task.text;
    const newRecurrence = updates.recurrence !== undefined ? updates.recurrence : (task.recurrence ?? '');
    const newDueDate = updates.dueDate !== undefined ? updates.dueDate : (task.dueDate ?? '');
    const newReminderTime = updates.reminderTime !== undefined ? updates.reminderTime : (task.reminderTime ?? '');
    const newTargetFile = updates.targetFile ?? task.sourceFile;

    let newSection: string | null = null;
    if (newRecurrence) {
      if (/every\s+day/i.test(newRecurrence)) newSection = 'Quotidien';
      else if (/every\s+week/i.test(newRecurrence)) newSection = 'Hebdomadaire';
      else if (/every\s+month/i.test(newRecurrence)) newSection = 'Mensuel';
    }

    let currentSection: string | null = null;
    if (task.recurrence) {
      if (/every\s+day/i.test(task.recurrence)) currentSection = 'Quotidien';
      else if (/every\s+week/i.test(task.recurrence)) currentSection = 'Hebdomadaire';
      else if (/every\s+month/i.test(task.recurrence)) currentSection = 'Mensuel';
    }

    let taskLine = newText;
    if (newRecurrence) taskLine += ` \u{1F501} ${newRecurrence}`;
    if (newDueDate) taskLine += ` \u{1F4C5} ${newDueDate}`;
    if (newReminderTime) taskLine += ` \u23F0 ${newReminderTime}`;
    const fullLine = `- [${task.completed ? 'x' : ' '}] ${taskLine}`;

    const fileChanged = newTargetFile !== task.sourceFile;
    const sectionChanged = newSection !== currentSection;

    if (fileChanged || sectionChanged) {
      const content = await vaultRef.current.readFile(task.sourceFile);
      const lines = content.split('\n');
      if (task.lineIndex >= 0 && task.lineIndex < lines.length) {
        lines.splice(task.lineIndex, 1);
        await vaultRef.current.writeFile(task.sourceFile, lines.join('\n'));
      }
      await vaultRef.current.appendTask(newTargetFile, newSection, taskLine);

      const filesToReparse = new Set([task.sourceFile, newTargetFile]);
      const vault = vaultRef.current;
      const reparsed = await Promise.all(
        [...filesToReparse].map(async (f) => {
          try {
            const c = await vault.readFile(f);
            return parseTaskFile(f, c);
          } catch (e) { warnUnexpected('moveTask-reparse', e); return [] as Task[]; }
        })
      );
      setTasks(prev => {
        const otherTasks = prev.filter(t => !filesToReparse.has(t.sourceFile));
        return [...otherTasks, ...reparsed.flat()];
      });
    } else {
      const content = await vaultRef.current.readFile(task.sourceFile);
      const lines = content.split('\n');
      if (task.lineIndex >= 0 && task.lineIndex < lines.length) {
        lines[task.lineIndex] = fullLine;
        await vaultRef.current.writeFile(task.sourceFile, lines.join('\n'));
      }

      setTasks(prev => prev.map(t => {
        if (t.sourceFile !== task.sourceFile || t.lineIndex !== task.lineIndex) return t;
        return { ...t, text: newText, recurrence: newRecurrence || undefined, dueDate: newDueDate || undefined, reminderTime: newReminderTime || undefined };
      }));
    }
    setTimeout(triggerWidgetRefresh, 0);
  }, [triggerWidgetRefresh]);

  // ─── deleteTask ──────────────────────────────────────────────────────────

  const deleteTask = useCallback(async (sourceFile: string, lineIndex: number) => {
    if (!vaultRef.current) return;
    const content = await vaultRef.current.readFile(sourceFile);
    const lines = content.split('\n');
    if (lineIndex >= 0 && lineIndex < lines.length) {
      lines.splice(lineIndex, 1);
      const newContent = lines.join('\n');
      await vaultRef.current.writeFile(sourceFile, newContent);
      setTasks(prev => {
        const updatedTasks = parseTaskFile(sourceFile, newContent);
        const otherTasks = prev.filter(t => t.sourceFile !== sourceFile);
        return [...otherTasks, ...updatedTasks];
      });
      setTimeout(triggerWidgetRefresh, 0);
    }
  }, [triggerWidgetRefresh]);

  return {
    tasks,
    setTasks,
    tasksRef,
    toggleTask,
    skipTask,
    addTask,
    editTask,
    deleteTask,
    resetTasks,
  };
}
