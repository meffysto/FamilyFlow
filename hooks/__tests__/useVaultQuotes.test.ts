/**
 * useVaultQuotes.test.ts — Tests unitaires pour hooks/useVaultQuotes.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultQuotes } from '../useVaultQuotes';
import { serializeQuotes, parseQuotes } from '../../lib/parser';
import type { ChildQuote } from '../../lib/types';

// ─── Mock VaultManager ──────────────────────────────────────────────────────

function createMockVault() {
  return {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    ensureDir: jest.fn(),
    exists: jest.fn(),
    deleteFile: jest.fn(),
  };
}

function createVaultRef(mock = createMockVault()) {
  return { current: mock as any };
}

const QUOTES_FILE = '06 - Mémoires/Mots d\'enfants.md';

/** Mock vault avec état interne persistant */
function createStatefulMock(initial: ChildQuote[] = []) {
  const mock = createMockVault();
  let fileContent = serializeQuotes(initial);

  mock.readFile.mockImplementation(() => Promise.resolve(fileContent));
  mock.writeFile.mockImplementation((_path: string, content: string) => {
    fileContent = content;
    return Promise.resolve();
  });

  return mock;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultQuotes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initialise avec un tableau vide', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultQuotes(vaultRef));
    expect(result.current.quotes).toEqual([]);
  });

  it('resetQuotes remet à []', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultQuotes(vaultRef));

    await act(() => result.current.setQuotes([
      { date: '2026-04-01', enfant: 'Lucas', citation: 'Maman regarde !', sourceFile: QUOTES_FILE, lineIndex: 0 },
    ]));
    expect(result.current.quotes).toHaveLength(1);

    await act(() => result.current.resetQuotes());
    expect(result.current.quotes).toEqual([]);
  });

  it('addQuote ajoute en tête et persiste', async () => {
    const mock = createStatefulMock();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultQuotes(vaultRef));

    await act(() => result.current.addQuote('Lucas', 'Les nuages sont en coton', 'Au parc'));

    expect(mock.ensureDir).toHaveBeenCalledWith('06 - Mémoires');
    expect(mock.writeFile).toHaveBeenCalledWith(
      QUOTES_FILE,
      expect.stringContaining('Les nuages sont en coton')
    );
    expect(result.current.quotes).toHaveLength(1);
    expect(result.current.quotes[0].citation).toBe('Les nuages sont en coton');
    expect(result.current.quotes[0].enfant).toBe('Lucas');
  });

  it('addQuote préserve les citations existantes', async () => {
    const existing: ChildQuote[] = [
      { date: '2026-04-01', enfant: 'Emma', citation: 'Ancienne', sourceFile: QUOTES_FILE, lineIndex: 3 },
    ];
    const mock = createStatefulMock(existing);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultQuotes(vaultRef));

    await act(() => result.current.addQuote('Lucas', 'Nouvelle'));

    expect(result.current.quotes.length).toBeGreaterThanOrEqual(2);
    const citations = result.current.quotes.map((q) => q.citation);
    expect(citations).toContain('Nouvelle');
    expect(citations).toContain('Ancienne');
  });

  it('addQuote sans contexte', async () => {
    const mock = createStatefulMock();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultQuotes(vaultRef));

    await act(() => result.current.addQuote('Emma', 'Pas de contexte'));

    expect(result.current.quotes[0].contexte).toBeUndefined();
  });

  it('deleteQuote supprime par lineIndex', async () => {
    const existing: ChildQuote[] = [
      { date: '2026-04-01', enfant: 'Lucas', citation: 'A garder', sourceFile: QUOTES_FILE, lineIndex: 3 },
      { date: '2026-04-02', enfant: 'Emma', citation: 'A supprimer', sourceFile: QUOTES_FILE, lineIndex: 7 },
    ];
    const mock = createStatefulMock(existing);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultQuotes(vaultRef));

    // Obtenir les vrais lineIndex après sérialisation
    const serialized = serializeQuotes(existing);
    const parsed = parseQuotes(serialized);
    const targetIdx = parsed.find((q) => q.citation === 'A supprimer')!.lineIndex;

    await act(() => result.current.deleteQuote(targetIdx));

    expect(mock.writeFile).toHaveBeenCalled();
    const citations = result.current.quotes.map((q) => q.citation);
    expect(citations).toContain('A garder');
    expect(citations).not.toContain('A supprimer');
  });

  it('deleteQuote no-op si fichier absent', async () => {
    const mock = createMockVault();
    mock.readFile.mockRejectedValue(new Error('not exist'));
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultQuotes(vaultRef));

    // Ne devrait pas throw
    await act(() => result.current.deleteQuote(5));
    expect(result.current.quotes).toEqual([]);
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() => useVaultQuotes(vaultRef));

    await act(() => result.current.addQuote('X', 'Y'));
    await act(() => result.current.deleteQuote(0));

    expect(result.current.quotes).toEqual([]);
  });
});
