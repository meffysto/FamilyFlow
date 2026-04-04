/**
 * useVaultBudget.ts — Hook dédié au domaine Budget
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultBudget(vaultRef).
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import { format } from 'date-fns';
import type { BudgetEntry, BudgetConfig } from '../lib/types';
import {
  parseBudgetConfig,
  parseBudgetMonth,
  serializeBudgetMonth,
  serializeBudgetConfig,
  DEFAULT_BUDGET_CONFIG,
} from '../lib/budget';
import type { VaultManager } from '../lib/vault';

// ─── Utilitaires locaux ──────────────────────────────────────────────────────

function isFileNotFound(e: unknown): boolean {
  const msg = String(e);
  return msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
}
function warnUnexpected(context: string, e: unknown) {
  if (!isFileNotFound(e)) console.warn(`[useVaultBudget] ${context}:`, e);
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const BUDGET_DIR = '05 - Budget';
const BUDGET_CONFIG_FILE = '05 - Budget/config.md';

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultBudgetResult {
  budgetEntries: BudgetEntry[];
  budgetConfig: BudgetConfig;
  budgetMonth: string;
  setBudgetMonth: (month: string) => void;
  addExpense: (date: string, category: string, amount: number, label: string) => Promise<void>;
  deleteExpense: (lineIndex: number) => Promise<void>;
  updateBudgetConfig: (config: BudgetConfig) => Promise<void>;
  loadBudgetData: (month?: string) => Promise<void>;
  loadBudgetMonths: (count: number) => Promise<BudgetEntry[]>;
  resetBudget: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultBudget(
  vaultRef: React.MutableRefObject<VaultManager | null>
): UseVaultBudgetResult {
  const [budgetEntries, setBudgetEntries] = useState<BudgetEntry[]>([]);
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig>(DEFAULT_BUDGET_CONFIG);
  const [budgetMonth, setBudgetMonth] = useState(() => format(new Date(), 'yyyy-MM'));

  const resetBudget = useCallback(() => {
    setBudgetEntries([]);
    setBudgetConfig(DEFAULT_BUDGET_CONFIG);
  }, []);

  const loadBudgetData = useCallback(async (month?: string) => {
    if (!vaultRef.current) return;
    const m = month || budgetMonth;
    if (month) setBudgetMonth(m);

    try {
      // Charger la config (lecture, fallback défaut + scaffold)
      try {
        const configContent = await vaultRef.current.readFile(BUDGET_CONFIG_FILE);
        setBudgetConfig(parseBudgetConfig(configContent));
      } catch (e) {
        warnUnexpected('loadBudgetConfig', e);
        await vaultRef.current.ensureDir(BUDGET_DIR);
        await vaultRef.current.writeFile(BUDGET_CONFIG_FILE, serializeBudgetConfig(DEFAULT_BUDGET_CONFIG));
        setBudgetConfig(DEFAULT_BUDGET_CONFIG);
      }
      // Charger les entrées du mois (lecture, fallback vide)
      try {
        const content = await vaultRef.current.readFile(`${BUDGET_DIR}/${m}.md`);
        setBudgetEntries(parseBudgetMonth(content));
      } catch (e) {
        warnUnexpected(`loadBudgetMonth(${m})`, e);
        setBudgetEntries([]);
      }
    } catch (e) {
      warnUnexpected('loadBudgetData', e);
      setBudgetEntries([]);
    }
  }, [budgetMonth, vaultRef]);

  const addExpense = useCallback(async (date: string, category: string, amount: number, label: string) => {
    if (!vaultRef.current) return;
    const month = date.slice(0, 7); // YYYY-MM
    const monthFile = `${BUDGET_DIR}/${month}.md`;
    await vaultRef.current.ensureDir(BUDGET_DIR);

    let entries: BudgetEntry[] = [];
    try {
      const content = await vaultRef.current.readFile(monthFile);
      entries = parseBudgetMonth(content);
    } catch (e) {
      warnUnexpected('addExpense-read', e);
    }

    const newEntry: BudgetEntry = { date, category, amount, label, lineIndex: -1 };
    entries.push(newEntry);
    const serialized = serializeBudgetMonth(month, entries);
    await vaultRef.current.writeFile(monthFile, serialized);

    // Mettre à jour l'état depuis le contenu sérialisé (re-parse pour lineIndex exact)
    if (month === budgetMonth) {
      setBudgetEntries(parseBudgetMonth(serialized));
    }
  }, [budgetMonth, vaultRef]);

  const deleteExpense = useCallback(async (lineIndex: number) => {
    if (!vaultRef.current) return;
    const monthFile = `${BUDGET_DIR}/${budgetMonth}.md`;

    let content: string;
    try {
      content = await vaultRef.current.readFile(monthFile);
    } catch (e) {
      warnUnexpected('deleteExpense-read', e);
      return;
    }
    const lines = content.split('\n');
    if (lineIndex >= 0 && lineIndex < lines.length) {
      lines.splice(lineIndex, 1);
      const updated = lines.join('\n');
      await vaultRef.current.writeFile(monthFile, updated);
      setBudgetEntries(parseBudgetMonth(updated));
    }
  }, [budgetMonth, vaultRef]);

  const loadBudgetMonths = useCallback(async (count: number): Promise<BudgetEntry[]> => {
    if (!vaultRef.current) return [];
    const now = new Date();
    const months = Array.from({ length: count }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const results = await Promise.allSettled(
      months.map(m => vaultRef.current!.readFile(`${BUDGET_DIR}/${m}.md`))
    );
    return results.flatMap(r => r.status === 'fulfilled' ? parseBudgetMonth(r.value) : []);
  }, [vaultRef]);

  const updateBudgetConfig = useCallback(async (config: BudgetConfig) => {
    if (!vaultRef.current) return;
    await vaultRef.current.ensureDir(BUDGET_DIR);
    await vaultRef.current.writeFile(BUDGET_CONFIG_FILE, serializeBudgetConfig(config));
    setBudgetConfig(config);
  }, [vaultRef]);

  return {
    budgetEntries,
    budgetConfig,
    budgetMonth,
    setBudgetMonth,
    addExpense,
    deleteExpense,
    updateBudgetConfig,
    loadBudgetData,
    loadBudgetMonths,
    resetBudget,
  };
}
