/**
 * useVaultStock.ts — Hook dédié au domaine Stock & fournitures
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultStock(vaultRef).
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import type { StockItem } from '../lib/types';
import { parseStock, serializeStockRow, parseStockSections } from '../lib/parser';
import type { VaultManager } from '../lib/vault';
import { buildSectionHeader, type EmplacementId } from '../constants/stock';

// ─── Constantes ──────────────────────────────────────────────────────────────

const STOCK_FILE = '01 - Enfants/Commun/Stock & fournitures.md';

function warnUnexpected(context: string, e: unknown) {
  const msg = String(e);
  const isNotFound = msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
  if (!isNotFound && __DEV__) console.warn(`[useVaultStock] ${context}:`, e);
}

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultStockResult {
  stock: StockItem[];
  setStock: (items: StockItem[]) => void;
  stockSections: string[];
  setStockSections: (sections: string[]) => void;
  updateStockQuantity: (lineIndex: number, newQuantity: number) => Promise<void>;
  addStockItem: (item: Omit<StockItem, 'lineIndex'>) => Promise<void>;
  deleteStockItem: (lineIndex: number) => Promise<void>;
  updateStockItem: (lineIndex: number, updates: Partial<StockItem>) => Promise<void>;
  resetStock: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultStock(
  vaultRef: React.MutableRefObject<VaultManager | null>,
): UseVaultStockResult {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [stockSections, setStockSections] = useState<string[]>([]);

  const resetStock = useCallback(() => {
    setStock([]);
    setStockSections([]);
  }, []);

  const updateStockQuantity = useCallback(async (lineIndex: number, newQuantity: number) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(STOCK_FILE);
      const lines = content.split('\n');
      if (lineIndex < 0 || lineIndex >= lines.length) return;

      const line = lines[lineIndex];
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (cells.length < 4) return;

      const qty = Math.max(0, newQuantity);
      const existingItem = stock.find(s => s.lineIndex === lineIndex);
      const updated: Omit<StockItem, 'lineIndex'> = {
        produit: cells[0],
        detail: cells[1] || undefined,
        quantite: qty,
        seuil: parseInt(cells[3], 10) || 0,
        qteAchat: cells[4] ? parseInt(cells[4], 10) || 1 : 1,
        emplacement: existingItem?.emplacement ?? 'bebe',
        section: existingItem?.section,
      };
      lines[lineIndex] = serializeStockRow(updated);
      await vaultRef.current.writeFile(STOCK_FILE, lines.join('\n'));

      setStock((prev) =>
        prev.map((s) => s.lineIndex === lineIndex ? { ...s, quantite: Math.max(0, newQuantity) } : s)
      );
    } catch (e) {
      throw new Error(`updateStockQuantity: ${e}`);
    }
  }, [stock]);

  const addStockItem = useCallback(async (item: Omit<StockItem, 'lineIndex'>) => {
    if (!vaultRef.current) return;
    try {
      let content: string;
      try {
        content = await vaultRef.current.readFile(STOCK_FILE);
      } catch (e) {
        warnUnexpected('addStockItem-read', e);
        content = '# Stock & fournitures\n';
        await vaultRef.current.writeFile(STOCK_FILE, content);
      }
      const lines = content.split('\n');
      const newRow = serializeStockRow(item);

      const sectionHeader = buildSectionHeader(
        (item.emplacement || 'bebe') as EmplacementId,
        item.section,
      );

      let insertIdx = -1;
      let inSection = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('## ')) {
          if (inSection) break;
          if (lines[i].slice(3).trim() === sectionHeader) inSection = true;
        }
        if (inSection && lines[i].startsWith('|') && !lines[i].includes('---')) {
          insertIdx = i;
        }
      }

      if (insertIdx === -1) {
        const tableHeader = [
          '',
          `## ${sectionHeader}`,
          '| Produit | Détail | Quantité | Seuil alerte | Qté/achat |',
          '| --- | --- | --- | --- | --- |',
          newRow,
        ];
        lines.push(...tableHeader);
      } else {
        lines.splice(insertIdx + 1, 0, newRow);
      }

      const newContent = lines.join('\n');
      await vaultRef.current.writeFile(STOCK_FILE, newContent);
      setStock(parseStock(newContent));
      setStockSections(parseStockSections(newContent));
    } catch (e) {
      throw new Error(`addStockItem: ${e}`);
    }
  }, []);

  const deleteStockItem = useCallback(async (lineIndex: number) => {
    if (!vaultRef.current) return;
    try {
      const content = await vaultRef.current.readFile(STOCK_FILE);
      const lines = content.split('\n');
      if (lineIndex >= 0 && lineIndex < lines.length) {
        lines.splice(lineIndex, 1);
        const newContent = lines.join('\n');
        await vaultRef.current.writeFile(STOCK_FILE, newContent);
        setStock(parseStock(newContent));
        setStockSections(parseStockSections(newContent));
      }
    } catch (e) {
      throw new Error(`deleteStockItem: ${e}`);
    }
  }, []);

  const updateStockItem = useCallback(async (lineIndex: number, updates: Partial<StockItem>) => {
    if (!vaultRef.current) return;
    try {
      const existingItem = stock.find(s => s.lineIndex === lineIndex);
      const oldEmplacement = existingItem?.emplacement ?? 'bebe';
      const oldSection = existingItem?.section;
      const newEmplacement = updates.emplacement ?? oldEmplacement;
      const newSection = updates.section !== undefined ? updates.section : oldSection;

      if (newEmplacement !== oldEmplacement || newSection !== oldSection) {
        const content = await vaultRef.current.readFile(STOCK_FILE);
        const lines = content.split('\n');
        if (lineIndex < 0 || lineIndex >= lines.length) return;

        const cells = lines[lineIndex].split('|').slice(1, -1).map(c => c.trim());
        if (cells.length < 4) return;

        const current: Omit<StockItem, 'lineIndex'> = {
          produit: cells[0],
          detail: cells[1] || undefined,
          quantite: parseInt(cells[2], 10) || 0,
          seuil: parseInt(cells[3], 10) || 0,
          qteAchat: cells[4] ? parseInt(cells[4], 10) || 1 : 1,
          emplacement: oldEmplacement,
          section: oldSection,
        };

        lines.splice(lineIndex, 1);
        await vaultRef.current.writeFile(STOCK_FILE, lines.join('\n'));

        const { lineIndex: _, ...updatedClean } = { ...current, ...updates };
        await addStockItem(updatedClean);
        return;
      }

      const content = await vaultRef.current.readFile(STOCK_FILE);
      const lines = content.split('\n');
      if (lineIndex < 0 || lineIndex >= lines.length) return;

      const cells = lines[lineIndex].split('|').slice(1, -1).map(c => c.trim());
      if (cells.length < 4) return;

      const current: Omit<StockItem, 'lineIndex'> = {
        produit: cells[0],
        detail: cells[1] || undefined,
        quantite: parseInt(cells[2], 10) || 0,
        seuil: parseInt(cells[3], 10) || 0,
        qteAchat: cells[4] ? parseInt(cells[4], 10) || 1 : 1,
        emplacement: oldEmplacement,
        section: oldSection,
      };

      const updated = { ...current, ...updates };
      lines[lineIndex] = serializeStockRow(updated);
      await vaultRef.current.writeFile(STOCK_FILE, lines.join('\n'));

      setStock(prev => prev.map(s =>
        s.lineIndex === lineIndex
          ? { ...s, ...updates }
          : s
      ));
    } catch (e) {
      throw new Error(`updateStockItem: ${e}`);
    }
  }, [stock, addStockItem]);

  return {
    stock,
    setStock,
    stockSections,
    setStockSections,
    updateStockQuantity,
    addStockItem,
    deleteStockItem,
    updateStockItem,
    resetStock,
  };
}
