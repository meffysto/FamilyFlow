/**
 * Mock SecureStore local en mémoire pour les tests Lightning Phase 53.
 *
 * Le projet a déjà un mock global mapé via `jest.config.js`
 * (`lib/__tests__/__mocks__/expo-secure-store.ts`) — ce mock local sert :
 *   - de fallback explicite pour les tests qui veulent un store isolé via
 *     `jest.mock('expo-secure-store', () => require('./__mocks__/secure-store'))`.
 *   - d'helpers `__resetMock()` / `__seedMock()` que le mock global n'expose pas.
 *
 * Convention : ce mock partage la même API qu'expo-secure-store. Les tests
 * réinitialisent le store dans `beforeEach` pour garantir l'isolation.
 */

const store: Map<string, string> = new Map();

export async function getItemAsync(key: string): Promise<string | null> {
  return store.get(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  store.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  store.delete(key);
}

/** Réinitialise le store en mémoire — à appeler dans `beforeEach`. */
export function __resetMock(): void {
  store.clear();
}

/** Pré-remplit une clé pour simuler un état existant. */
export function __seedMock(key: string, value: string): void {
  store.set(key, value);
}

/** Inspection — lecture synchrone du store complet (debug tests). */
export function __snapshot(): Record<string, string> {
  return Object.fromEntries(store);
}
