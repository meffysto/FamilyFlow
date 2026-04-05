/**
 * useVaultMemories.test.ts — Tests unitaires pour hooks/useVaultMemories.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultMemories } from '../useVaultMemories';
import type { Memory } from '../../lib/types';

// ─── Mock VaultManager ──────────────────────────────────────────────────────

function createMockVault() {
  return {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
    ensureDir: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn(),
  };
}

function createVaultRef(mock = createMockVault()) {
  return { current: mock as any };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const sampleMemory: Omit<Memory, 'enfant' | 'enfantId'> = {
  date: '2026-04-01',
  title: 'Premier sourire',
  description: 'Grand sourire ce matin',
  type: 'premiere_fois',
};

const existingJalonsContent = `---
enfant: Lucas
tags:
  - jalons
---

# Jalons & Mémoires — Lucas

## 🌟 Premières fois

## 💛 Moments forts
`;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultMemories', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initialise avec un tableau vide', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultMemories(vaultRef));
    expect(result.current.memories).toEqual([]);
  });

  it('resetMemories remet à []', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultMemories(vaultRef));

    await act(() => result.current.setMemories([
      { ...sampleMemory, enfant: 'Lucas', enfantId: 'lucas' },
    ]));
    expect(result.current.memories).toHaveLength(1);

    await act(() => result.current.resetMemories());
    expect(result.current.memories).toEqual([]);
  });

  it('addMemory crée le fichier si absent et ajoute à l\'état', async () => {
    const mock = createMockVault();
    mock.readFile.mockRejectedValue(new Error('not exist'));
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultMemories(vaultRef));

    await act(() => result.current.addMemory('Lucas', sampleMemory));

    expect(mock.ensureDir).toHaveBeenCalledWith('06 - Mémoires/Lucas');
    expect(mock.writeFile).toHaveBeenCalledWith(
      '06 - Mémoires/Lucas/Jalons.md',
      expect.any(String)
    );
    expect(result.current.memories).toHaveLength(1);
    expect(result.current.memories[0].enfant).toBe('Lucas');
    expect(result.current.memories[0].enfantId).toBe('lucas');
  });

  it('addMemory ajoute au fichier existant', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue(existingJalonsContent);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultMemories(vaultRef));

    await act(() => result.current.addMemory('Lucas', sampleMemory));

    expect(mock.writeFile).toHaveBeenCalledWith(
      '06 - Mémoires/Lucas/Jalons.md',
      expect.stringContaining('Premier sourire')
    );
    expect(result.current.memories).toHaveLength(1);
  });

  it('addMemory trie par date desc', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue(existingJalonsContent);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultMemories(vaultRef));

    await act(() => result.current.addMemory('Lucas', { ...sampleMemory, date: '2026-01-01' }));
    await act(() => result.current.addMemory('Lucas', { ...sampleMemory, date: '2026-06-01', title: 'Plus récent' }));

    expect(result.current.memories[0].date).toBe('2026-06-01');
  });

  it('updateMemory modifie et trie', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue(existingJalonsContent);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultMemories(vaultRef));

    const existing: Memory = { ...sampleMemory, enfant: 'Lucas', enfantId: 'lucas' };
    await act(() => result.current.setMemories([existing]));

    const updated = { ...sampleMemory, description: 'Mise à jour' };
    await act(() => result.current.updateMemory(existing, updated));

    expect(mock.writeFile).toHaveBeenCalled();
    expect(result.current.memories[0].description).toBe('Mise à jour');
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() => useVaultMemories(vaultRef));

    await act(() => result.current.addMemory('Lucas', sampleMemory));
    expect(result.current.memories).toEqual([]);
  });
});
