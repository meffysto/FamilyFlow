/**
 * useVaultPriceBook.ts — Hook dédié au pricebook (prix manuels).
 *
 * Charge `04 - Budget/Prix connus.md` au mount et expose une Map
 * `canonical-key → { label, price }` pour le lookup côté courses-prices.ts.
 *
 * Pattern enqueueWrite identique à useVaultCourses : queue séquentielle pour
 * éviter les races sur le même fichier vault. Le fichier est créé à la volée
 * lors du premier setPrice (lazy init).
 *
 * Hors `VaultCacheState` (chargé frais à chaque boot — pas besoin de bumper
 * CACHE_VERSION).
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type React from 'react';
import { parsePriceBook, serializePriceBook, type PriceBookEntry } from '../lib/parser';
import { parseCanonical, priceBookKey, type PriceBookMap } from '../lib/courses-prices';
import type { VaultManager } from '../lib/vault';

const PRICEBOOK_FILE = '04 - Budget/Prix connus.md';
const PRICEBOOK_DIR = '04 - Budget';

function warnUnexpected(context: string, e: unknown) {
  const msg = String(e);
  const isNotFound = msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
  if (!isNotFound && __DEV__) console.warn(`[useVaultPriceBook] ${context}:`, e);
}

const todayLocal = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export interface UseVaultPriceBookResult {
  /** Map canonical-key → { label, price } pour le lookup */
  priceBook: PriceBookMap;
  /** Toutes les entrées brutes (label + price) pour debug/UI éventuelle */
  entries: PriceBookEntry[];
  /** Définit ou remplace le prix d'un article (par label utilisateur) */
  setPrice: (label: string, price: number) => Promise<void>;
  /** Supprime une entrée du pricebook (par clé canonique) */
  removePrice: (canonicalKey: string) => Promise<void>;
  /** Recharge le fichier depuis disque */
  refresh: () => Promise<void>;
}

export function useVaultPriceBook(
  vaultRef: React.MutableRefObject<VaultManager | null>,
  vaultPath: string | null,
): UseVaultPriceBookResult {
  const [entries, setEntries] = useState<PriceBookEntry[]>([]);
  const entriesRef = useRef<PriceBookEntry[]>([]);
  useEffect(() => { entriesRef.current = entries; }, [entries]);

  const writeQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const enqueueWrite = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const next = writeQueueRef.current.then(fn, fn) as Promise<T>;
    writeQueueRef.current = next.catch(() => undefined);
    return next;
  }, []);

  const loadFromDisk = useCallback(async (): Promise<PriceBookEntry[]> => {
    const vm = vaultRef.current;
    if (!vm) return [];
    try {
      const exists = await vm.exists(PRICEBOOK_FILE);
      if (!exists) return [];
      const content = await vm.readFile(PRICEBOOK_FILE);
      const state = parsePriceBook(content);
      return state.entries;
    } catch (e) {
      warnUnexpected('loadFromDisk', e);
      return [];
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const next = await loadFromDisk();
    setEntries(next);
  }, [loadFromDisk]);

  // Mount initial
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await loadFromDisk();
      if (!cancelled) setEntries(next);
    })().catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultPath]);

  const setPrice = useCallback(async (label: string, price: number): Promise<void> => {
    const trimmed = label.trim();
    if (!trimmed) return;
    if (!Number.isFinite(price) || price < 0) return;

    return enqueueWrite(async () => {
      const vm = vaultRef.current;
      if (!vm) return;

      // Recharge depuis disque pour partir de l'état le plus frais
      let current: PriceBookEntry[] = [];
      try {
        const exists = await vm.exists(PRICEBOOK_FILE);
        if (exists) {
          const content = await vm.readFile(PRICEBOOK_FILE);
          current = parsePriceBook(content).entries;
        }
      } catch (e) {
        warnUnexpected('setPrice-read', e);
      }

      const newCanonical = parseCanonical(trimmed);
      const newKey = priceBookKey(newCanonical);

      // Replace existing entry with same canonical key, or append
      let replaced = false;
      const next: PriceBookEntry[] = current.map((entry) => {
        const key = priceBookKey(parseCanonical(entry.label));
        if (key === newKey) {
          replaced = true;
          return { label: trimmed, price };
        }
        return entry;
      });
      if (!replaced) next.push({ label: trimmed, price });

      try {
        await vm.ensureDir(PRICEBOOK_DIR);
        await vm.writeFile(PRICEBOOK_FILE, serializePriceBook({
          updatedAt: todayLocal(),
          entries: next,
        }));
        setEntries(next);
      } catch (e) {
        warnUnexpected('setPrice-write', e);
      }
    });
  }, [enqueueWrite]);

  const removePrice = useCallback(async (canonicalKey: string): Promise<void> => {
    return enqueueWrite(async () => {
      const vm = vaultRef.current;
      if (!vm) return;

      let current: PriceBookEntry[] = [];
      try {
        const exists = await vm.exists(PRICEBOOK_FILE);
        if (!exists) return;
        const content = await vm.readFile(PRICEBOOK_FILE);
        current = parsePriceBook(content).entries;
      } catch (e) {
        warnUnexpected('removePrice-read', e);
        return;
      }

      const next = current.filter((entry) => {
        const key = priceBookKey(parseCanonical(entry.label));
        return key !== canonicalKey;
      });
      if (next.length === current.length) return; // pas trouvé

      try {
        await vm.writeFile(PRICEBOOK_FILE, serializePriceBook({
          updatedAt: todayLocal(),
          entries: next,
        }));
        setEntries(next);
      } catch (e) {
        warnUnexpected('removePrice-write', e);
      }
    });
  }, [enqueueWrite]);

  // Construit la Map memoïsée pour le lookup
  const priceBook = useMemo<PriceBookMap>(() => {
    const map: PriceBookMap = new Map();
    for (const entry of entries) {
      const canonical = parseCanonical(entry.label);
      if (canonical.length === 0) continue;
      const key = priceBookKey(canonical);
      // Dernière valeur gagne en cas de doublons (cohérent avec setPrice qui replace)
      map.set(key, { label: entry.label, price: entry.price });
    }
    return map;
  }, [entries]);

  return { priceBook, entries, setPrice, removePrice, refresh };
}
