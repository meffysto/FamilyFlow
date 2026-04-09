// lib/__tests__/flag.test.ts
// Tests unitaires du feature flag semantic-coupling — Phase 19 v1.3 Seed.
// Couvre SEMANTIC-05 (toggle via feature flag) et ARCH-02 (désactivation instantanée).
//
// IMPORTANT : le mock expo-secure-store (lib/__tests__/__mocks__/expo-secure-store.ts)
// est in-memory et partage son state entre tests. Le beforeEach nettoie la clé
// pour garantir l'isolation (voir RESEARCH.md Pitfall 1).

import * as SecureStore from 'expo-secure-store';
import {
  isSemanticCouplingEnabled,
  setSemanticCouplingEnabled,
  SEMANTIC_COUPLING_KEY,
} from '../semantic';

beforeEach(async () => {
  // Isolation : nettoyer la clé avant chaque test (mock in-memory persistant)
  await SecureStore.deleteItemAsync(SEMANTIC_COUPLING_KEY);
});

describe('feature flag semantic-coupling — default OFF (SEMANTIC-05)', () => {
  it('retourne false quand la clé SecureStore est absente', async () => {
    expect(await isSemanticCouplingEnabled()).toBe(false);
  });

  it('clé canonique = semantic-coupling-enabled', () => {
    expect(SEMANTIC_COUPLING_KEY).toBe('semantic-coupling-enabled');
  });
});

describe('feature flag semantic-coupling — set/get round-trip (ARCH-02)', () => {
  it('retourne true après setSemanticCouplingEnabled(true)', async () => {
    await setSemanticCouplingEnabled(true);
    expect(await isSemanticCouplingEnabled()).toBe(true);
  });

  it('retourne false après setSemanticCouplingEnabled(false)', async () => {
    await setSemanticCouplingEnabled(false);
    expect(await isSemanticCouplingEnabled()).toBe(false);
  });

  it('désactive instantanément après true → false (ARCH-02)', async () => {
    await setSemanticCouplingEnabled(true);
    expect(await isSemanticCouplingEnabled()).toBe(true);
    await setSemanticCouplingEnabled(false);
    expect(await isSemanticCouplingEnabled()).toBe(false);
  });

  it('réactive après false → true (séquence complète)', async () => {
    await setSemanticCouplingEnabled(false);
    await setSemanticCouplingEnabled(true);
    expect(await isSemanticCouplingEnabled()).toBe(true);
  });
});

describe('feature flag semantic-coupling — persistence SecureStore', () => {
  it('écrit la chaîne "true" dans SecureStore quand activé', async () => {
    await setSemanticCouplingEnabled(true);
    const raw = await SecureStore.getItemAsync(SEMANTIC_COUPLING_KEY);
    expect(raw).toBe('true');
  });

  it('écrit la chaîne "false" dans SecureStore quand désactivé', async () => {
    await setSemanticCouplingEnabled(false);
    const raw = await SecureStore.getItemAsync(SEMANTIC_COUPLING_KEY);
    expect(raw).toBe('false');
  });
});
