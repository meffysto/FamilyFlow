/**
 * useVaultAnniversaires.test.ts — Tests unitaires pour hooks/useVaultAnniversaires.ts
 * Mock du VaultManager, vérification des actions CRUD anniversaires.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultAnniversaires } from '../useVaultAnniversaires';
import { serializeAnniversaries, parseAnniversaries } from '../../lib/parser';
import type { Anniversary } from '../../lib/types';

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

// ─── Helpers ────────────────────────────────────────────────────────────────

const ANNIV_FILE = '01 - Famille/Anniversaires.md';

const sampleAnniv: Omit<Anniversary, 'sourceFile'> = {
  name: 'Lucas',
  date: '04-15',
  birthYear: 2018,
  category: 'famille',
};

const sampleAnniv2: Omit<Anniversary, 'sourceFile'> = {
  name: 'Emma',
  date: '12-25',
  category: 'ami',
};

function makeFileContent(items: Anniversary[]): string {
  return serializeAnniversaries(items);
}

/** Simule un vault qui maintient un état interne (lecture après écriture) */
function createStatefulMock() {
  const mock = createMockVault();
  let fileContent = serializeAnniversaries([]);

  mock.readFile.mockImplementation(() => Promise.resolve(fileContent));
  mock.writeFile.mockImplementation((_path: string, content: string) => {
    fileContent = content;
    return Promise.resolve();
  });

  return mock;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultAnniversaires', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initialise avec un tableau vide', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultAnniversaires(vaultRef));

    expect(result.current.anniversaries).toEqual([]);
  });

  it('resetAnniversaires remet à []', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultAnniversaires(vaultRef));

    await act(() => result.current.setAnniversaries([
      { ...sampleAnniv, sourceFile: ANNIV_FILE },
    ]));
    expect(result.current.anniversaries).toHaveLength(1);

    await act(() => result.current.resetAnniversaires());
    expect(result.current.anniversaries).toEqual([]);
  });

  it('addAnniversary ajoute et persiste', async () => {
    const mock = createStatefulMock();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultAnniversaires(vaultRef));

    await act(() => result.current.addAnniversary(sampleAnniv));

    expect(mock.writeFile).toHaveBeenCalledWith(ANNIV_FILE, expect.stringContaining('Lucas'));
    expect(result.current.anniversaries).toHaveLength(1);
    expect(result.current.anniversaries[0].name).toBe('Lucas');
  });

  it('updateAnniversary modifie un item existant', async () => {
    const mock = createStatefulMock();
    // Pré-remplir avec Lucas
    const initial: Anniversary[] = [{ ...sampleAnniv, sourceFile: ANNIV_FILE }];
    const initialContent = serializeAnniversaries(initial);
    let fileContent = initialContent;
    mock.readFile.mockImplementation(() => Promise.resolve(fileContent));
    mock.writeFile.mockImplementation((_path: string, content: string) => {
      fileContent = content;
      return Promise.resolve();
    });

    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultAnniversaires(vaultRef));

    await act(() => result.current.setAnniversaries(initial));

    const updated = { ...sampleAnniv, date: '05-20' };
    await act(() => result.current.updateAnniversary('Lucas', updated));

    expect(mock.writeFile).toHaveBeenCalled();
    expect(result.current.anniversaries[0].date).toBe('05-20');
  });

  it('updateAnniversary no-op si nom introuvable', async () => {
    const mock = createStatefulMock();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultAnniversaires(vaultRef));

    await act(() => result.current.updateAnniversary('Inconnu', sampleAnniv));

    // writeFile est appelé 0 fois (pas trouvé => return early)
    // Note: reloadAnniversaries lit le fichier mais updateAnniversary retourne si idx === -1
    expect(result.current.anniversaries).toEqual([]);
  });

  it('removeAnniversary supprime par nom', async () => {
    const mock = createStatefulMock();
    const initial: Anniversary[] = [
      { ...sampleAnniv, sourceFile: ANNIV_FILE },
      { ...sampleAnniv2, sourceFile: ANNIV_FILE },
    ];
    let fileContent = serializeAnniversaries(initial);
    mock.readFile.mockImplementation(() => Promise.resolve(fileContent));
    mock.writeFile.mockImplementation((_path: string, content: string) => {
      fileContent = content;
      return Promise.resolve();
    });

    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultAnniversaires(vaultRef));
    await act(() => result.current.setAnniversaries(initial));

    await act(() => result.current.removeAnniversary('Lucas'));

    expect(result.current.anniversaries).toHaveLength(1);
    expect(result.current.anniversaries[0].name).toBe('Emma');
  });

  it('importAnniversaries déduplique par nom+date', async () => {
    const mock = createStatefulMock();
    const existing: Anniversary[] = [{ ...sampleAnniv, sourceFile: ANNIV_FILE }];
    let fileContent = serializeAnniversaries(existing);
    mock.readFile.mockImplementation(() => Promise.resolve(fileContent));
    mock.writeFile.mockImplementation((_path: string, content: string) => {
      fileContent = content;
      return Promise.resolve();
    });

    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultAnniversaires(vaultRef));

    // Import Lucas (doublon) + Emma (nouveau)
    await act(() => result.current.importAnniversaries([sampleAnniv, sampleAnniv2]));

    // Lucas est dédupliqué, Emma est ajoutée
    expect(result.current.anniversaries).toHaveLength(2);
    const names = result.current.anniversaries.map((a) => a.name);
    expect(names).toContain('Lucas');
    expect(names).toContain('Emma');
  });

  it('importAnniversaries déduplique par contactId', async () => {
    const mock = createStatefulMock();
    const existing: Anniversary[] = [
      { ...sampleAnniv, contactId: 'C001', sourceFile: ANNIV_FILE },
    ];
    let fileContent = serializeAnniversaries(existing);
    mock.readFile.mockImplementation(() => Promise.resolve(fileContent));
    mock.writeFile.mockImplementation((_path: string, content: string) => {
      fileContent = content;
      return Promise.resolve();
    });

    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultAnniversaires(vaultRef));

    await act(() => result.current.importAnniversaries([
      { ...sampleAnniv, name: 'Lucas Renamed', contactId: 'C001' }, // même contactId
      sampleAnniv2,
    ]));

    expect(result.current.anniversaries).toHaveLength(2);
    // Le doublon contactId est ignoré (pas renommé)
    expect(result.current.anniversaries.find((a) => a.name === 'Lucas Renamed')).toBeUndefined();
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() => useVaultAnniversaires(vaultRef));

    await act(() => result.current.addAnniversary(sampleAnniv));
    await act(() => result.current.removeAnniversary('Lucas'));
    await act(() => result.current.importAnniversaries([sampleAnniv]));

    expect(result.current.anniversaries).toEqual([]);
  });
});
