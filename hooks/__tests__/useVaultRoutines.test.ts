/**
 * useVaultRoutines.test.ts — Tests unitaires pour hooks/useVaultRoutines.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultRoutines } from '../useVaultRoutines';
import type { Routine } from '../../lib/types';

// ─── Mock VaultManager ──────────────────────────────────────────────────────

function createMockVault() {
  return {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
    ensureDir: jest.fn(),
    exists: jest.fn(),
    deleteFile: jest.fn(),
  };
}

function createVaultRef(mock = createMockVault()) {
  return { current: mock as any };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

const sampleRoutines: Routine[] = [
  { id: 'matin', label: 'Matin', emoji: '☀️', steps: [{ text: 'Brossage dents' }, { text: 'Habillage' }] },
  { id: 'soir', label: 'Soir', emoji: '🌙', steps: [{ text: 'Douche' }] },
];

describe('useVaultRoutines', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initialise avec un tableau vide', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultRoutines(vaultRef));
    expect(result.current.routines).toEqual([]);
  });

  it('resetRoutines remet à []', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultRoutines(vaultRef));

    await act(() => result.current.setRoutines(sampleRoutines));
    expect(result.current.routines).toHaveLength(2);

    await act(() => result.current.resetRoutines());
    expect(result.current.routines).toEqual([]);
  });

  it('saveRoutines écrit et met à jour l\'état', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultRoutines(vaultRef));

    await act(() => result.current.saveRoutines(sampleRoutines));

    expect(mock.writeFile).toHaveBeenCalledWith(
      '02 - Maison/Routines.md',
      expect.any(String)
    );
    expect(result.current.routines).toEqual(sampleRoutines);
  });

  it('saveRoutines no-op si vault null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() => useVaultRoutines(vaultRef));

    await act(() => result.current.saveRoutines(sampleRoutines));
    expect(result.current.routines).toEqual([]);
  });
});
