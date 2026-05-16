/**
 * Lightning credentials — persistance via expo-secure-store
 *
 * JAMAIS dans le vault Obsidian Markdown (sensible).
 * JAMAIS dans le vault-cache (lib/vault-cache.ts).
 *
 * Format stocké : JSON { baseUrl, invoiceKey } sous une clé unique.
 * Clé SecureStore : lightning_lnbits_config_v1
 *   → bump le suffixe v2/v3 si le shape change.
 */

import * as SecureStore from 'expo-secure-store';
import type { LnbitsConfig } from './types';

const STORAGE_KEY = 'lightning_lnbits_config_v1';

export async function loadLnbitsConfig(): Promise<LnbitsConfig | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LnbitsConfig>;
    if (typeof parsed.baseUrl !== 'string' || typeof parsed.invoiceKey !== 'string') {
      return null;
    }
    if (!parsed.baseUrl.trim() || !parsed.invoiceKey.trim()) {
      return null;
    }
    return { baseUrl: parsed.baseUrl, invoiceKey: parsed.invoiceKey };
  } catch (err) {
    if (__DEV__) {
      console.warn('[lightning] loadLnbitsConfig failed:', err);
    }
    return null;
  }
}

export async function saveLnbitsConfig(config: LnbitsConfig): Promise<void> {
  await SecureStore.setItemAsync(
    STORAGE_KEY,
    JSON.stringify({
      baseUrl: config.baseUrl.trim().replace(/\/+$/, ''),
      invoiceKey: config.invoiceKey.trim(),
    }),
  );
}

export async function clearLnbitsConfig(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
