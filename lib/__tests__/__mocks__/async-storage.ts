/**
 * Mock @react-native-async-storage/async-storage pour les tests Jest (Node).
 *
 * API alignée sur la version réelle (default export + named methods).
 * Phase 53 — utilisé par lib/lightning/audit-log.ts (Pitfall #1 — AsyncStorage
 * retenu car audit log ~160 KB en régime > limite SecureStore 2 KB).
 */
const store: Map<string, string> = new Map();

async function getItem(key: string): Promise<string | null> {
  return store.get(key) ?? null;
}

async function setItem(key: string, value: string): Promise<void> {
  store.set(key, value);
}

async function removeItem(key: string): Promise<void> {
  store.delete(key);
}

async function clear(): Promise<void> {
  store.clear();
}

async function getAllKeys(): Promise<string[]> {
  return Array.from(store.keys());
}

async function multiGet(keys: string[]): Promise<[string, string | null][]> {
  return keys.map((k) => [k, store.get(k) ?? null] as [string, string | null]);
}

async function multiSet(pairs: [string, string][]): Promise<void> {
  for (const [k, v] of pairs) store.set(k, v);
}

async function multiRemove(keys: string[]): Promise<void> {
  for (const k of keys) store.delete(k);
}

const AsyncStorage = {
  getItem,
  setItem,
  removeItem,
  clear,
  getAllKeys,
  multiGet,
  multiSet,
  multiRemove,
};

export default AsyncStorage;
export { getItem, setItem, removeItem, clear, getAllKeys, multiGet, multiSet, multiRemove };
