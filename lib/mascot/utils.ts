// ─────────────────────────────────────────────
// Mascotte — Utilitaires partagés
// ─────────────────────────────────────────────

import { Platform } from 'react-native';

/**
 * Hash déterministe (djb2) pour la sélection d'aventures/sagas.
 * Même entrée → même sortie, toujours positif.
 */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/** Formate une date en YYYY-MM-DD */
export function formatDateStr(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** SecureStore avec polyfill web (partagé entre composants et storage) */
export const SecureStoreCompat = Platform.OS === 'web'
  ? {
      getItemAsync: async (_k: string) => null as string | null,
      setItemAsync: async (_k: string, _v: string) => {},
      deleteItemAsync: async (_k: string) => {},
    }
  : require('expo-secure-store') as {
      getItemAsync: (key: string) => Promise<string | null>;
      setItemAsync: (key: string, value: string) => Promise<void>;
      deleteItemAsync: (key: string) => Promise<void>;
    };
