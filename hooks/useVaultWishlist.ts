/**
 * useVaultWishlist.ts — Hook dédié au domaine Wishlist
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultWishlist(vaultRef).
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import type { WishlistItem, WishBudget, WishOccasion } from '../lib/types';
import {
  WISHLIST_FILE,
  parseWishlist,
  serializeWishlist,
} from '../lib/parser';
import type { VaultManager } from '../lib/vault';

// ─── Utilitaires locaux ──────────────────────────────────────────────────────

function isFileNotFound(e: unknown): boolean {
  const msg = String(e);
  return msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
}
function warnUnexpected(context: string, e: unknown) {
  if (!isFileNotFound(e)) console.warn(`[useVaultWishlist] ${context}:`, e);
}

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultWishlistResult {
  wishlistItems: WishlistItem[];
  setWishlistItems: (items: WishlistItem[]) => void;
  addWishItem: (text: string, profileName: string, budget?: WishBudget, occasion?: WishOccasion, notes?: string, url?: string) => Promise<void>;
  updateWishItem: (item: WishlistItem, updates: Partial<WishlistItem>) => Promise<void>;
  deleteWishItem: (item: WishlistItem) => Promise<void>;
  toggleWishBought: (item: WishlistItem, boughtBy: string) => Promise<void>;
  resetWishlist: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultWishlist(
  vaultRef: React.MutableRefObject<VaultManager | null>
): UseVaultWishlistResult {
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);

  const resetWishlist = useCallback(() => {
    setWishlistItems([]);
  }, []);

  const reloadWishlist = useCallback(async (): Promise<WishlistItem[]> => {
    if (!vaultRef.current) return [];
    try {
      const content = await vaultRef.current.readFile(WISHLIST_FILE);
      return parseWishlist(content);
    } catch (e) {
      warnUnexpected('reloadWishlist', e);
      return [];
    }
  }, [vaultRef]);

  const addWishItem = useCallback(async (text: string, profileName: string, budget?: WishBudget, occasion?: WishOccasion, notes?: string, url?: string) => {
    if (!vaultRef.current) return;
    const items = await reloadWishlist();
    const newItem: WishlistItem = {
      id: `wish_${Date.now()}`,
      text,
      budget: budget || '',
      occasion: occasion || '',
      notes: notes || '',
      url: url || '',
      bought: false,
      boughtBy: '',
      profileName,
      sourceFile: WISHLIST_FILE,
      lineIndex: -1,
    };
    items.push(newItem);
    await vaultRef.current.writeFile(WISHLIST_FILE, serializeWishlist(items));
    setWishlistItems(parseWishlist(await vaultRef.current.readFile(WISHLIST_FILE)));
  }, [reloadWishlist, vaultRef]);

  const updateWishItem = useCallback(async (item: WishlistItem, updates: Partial<WishlistItem>) => {
    if (!vaultRef.current) return;
    const items = await reloadWishlist();
    const idx = items.findIndex((w) => w.lineIndex === item.lineIndex && w.profileName === item.profileName);
    if (idx === -1) return;
    items[idx] = { ...items[idx], ...updates };
    await vaultRef.current.writeFile(WISHLIST_FILE, serializeWishlist(items));
    setWishlistItems(parseWishlist(await vaultRef.current.readFile(WISHLIST_FILE)));
  }, [reloadWishlist, vaultRef]);

  const deleteWishItem = useCallback(async (item: WishlistItem) => {
    if (!vaultRef.current) return;
    const items = await reloadWishlist();
    const filtered = items.filter((w) => !(w.lineIndex === item.lineIndex && w.profileName === item.profileName));
    await vaultRef.current.writeFile(WISHLIST_FILE, serializeWishlist(filtered));
    setWishlistItems(parseWishlist(await vaultRef.current.readFile(WISHLIST_FILE)));
  }, [reloadWishlist, vaultRef]);

  const toggleWishBought = useCallback(async (item: WishlistItem, boughtBy: string) => {
    if (!vaultRef.current) return;
    const items = await reloadWishlist();
    const idx = items.findIndex((w) => w.lineIndex === item.lineIndex && w.profileName === item.profileName);
    if (idx === -1) return;
    if (items[idx].bought) {
      items[idx].bought = false;
      items[idx].boughtBy = '';
    } else {
      items[idx].bought = true;
      items[idx].boughtBy = boughtBy;
    }
    await vaultRef.current.writeFile(WISHLIST_FILE, serializeWishlist(items));
    setWishlistItems(parseWishlist(await vaultRef.current.readFile(WISHLIST_FILE)));
  }, [reloadWishlist, vaultRef]);

  return {
    wishlistItems,
    setWishlistItems,
    addWishItem,
    updateWishItem,
    deleteWishItem,
    toggleWishBought,
    resetWishlist,
  };
}
