/**
 * useVaultMoods.test.ts — Tests unitaires pour hooks/useVaultMoods.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultMoods } from '../useVaultMoods';
import { serializeMoods, parseMoods } from '../../lib/parser';
import type { MoodEntry } from '../../lib/types';

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

const MOODS_FILE = '05 - Famille/Humeurs.md';

/** Mock vault avec état interne persistant */
function createStatefulMock(initial: MoodEntry[] = []) {
  const mock = createMockVault();
  let fileContent = serializeMoods(initial);

  mock.readFile.mockImplementation(() => Promise.resolve(fileContent));
  mock.writeFile.mockImplementation((_path: string, content: string) => {
    fileContent = content;
    return Promise.resolve();
  });

  return mock;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultMoods', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initialise avec un tableau vide', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultMoods(vaultRef));
    expect(result.current.moods).toEqual([]);
  });

  it('resetMoods remet à []', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultMoods(vaultRef));

    await act(() => result.current.setMoods([
      { date: '2026-04-01', profileId: 'p1', profileName: 'Lucas', level: 4, sourceFile: MOODS_FILE, lineIndex: 0 },
    ]));
    expect(result.current.moods).toHaveLength(1);

    await act(() => result.current.resetMoods());
    expect(result.current.moods).toEqual([]);
  });

  it('addMood ajoute une entrée et persiste', async () => {
    const mock = createStatefulMock();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultMoods(vaultRef));

    await act(() => result.current.addMood('p1', 'Lucas', 4, 'Bonne journée'));

    expect(mock.ensureDir).toHaveBeenCalledWith('05 - Famille');
    expect(mock.writeFile).toHaveBeenCalledWith(
      MOODS_FILE,
      expect.stringContaining('Lucas')
    );
    expect(result.current.moods).toHaveLength(1);
    expect(result.current.moods[0].level).toBe(4);
  });

  it('addMood remplace l\'entrée du même profil pour aujourd\'hui', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const existing: MoodEntry[] = [
      { date: today, profileId: 'p1', profileName: 'Lucas', level: 2, sourceFile: MOODS_FILE, lineIndex: 3 },
    ];
    const mock = createStatefulMock(existing);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultMoods(vaultRef));

    await act(() => result.current.addMood('p1', 'Lucas', 5, 'Mieux !'));

    // Une seule entrée pour p1 aujourd'hui (pas de doublon)
    const todayEntries = result.current.moods.filter(
      (m) => m.date === today && m.profileId === 'p1'
    );
    expect(todayEntries).toHaveLength(1);
    expect(todayEntries[0].level).toBe(5);
  });

  it('addMood préserve les entrées des autres profils', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const existing: MoodEntry[] = [
      { date: today, profileId: 'p2', profileName: 'Emma', level: 3, sourceFile: MOODS_FILE, lineIndex: 3 },
    ];
    const mock = createStatefulMock(existing);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultMoods(vaultRef));

    await act(() => result.current.addMood('p1', 'Lucas', 4));

    expect(result.current.moods.length).toBeGreaterThanOrEqual(2);
    const names = result.current.moods.map((m) => m.profileName);
    expect(names).toContain('Lucas');
    expect(names).toContain('Emma');
  });

  it('addMood sans note', async () => {
    const mock = createStatefulMock();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultMoods(vaultRef));

    await act(() => result.current.addMood('p1', 'Lucas', 3));

    expect(result.current.moods[0].note).toBeUndefined();
  });

  it('addMood throw si writeFile échoue', async () => {
    const mock = createMockVault();
    mock.readFile.mockRejectedValue(new Error('not exist'));
    mock.ensureDir.mockResolvedValue(undefined);
    mock.writeFile.mockRejectedValue(new Error('disk full'));
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultMoods(vaultRef));

    await expect(
      act(() => result.current.addMood('p1', 'Lucas', 4))
    ).rejects.toThrow('disk full');
  });

  it('deleteMood supprime par lineIndex', async () => {
    const existing: MoodEntry[] = [
      { date: '2026-04-01', profileId: 'p1', profileName: 'Lucas', level: 4, sourceFile: MOODS_FILE, lineIndex: 3 },
      { date: '2026-04-02', profileId: 'p2', profileName: 'Emma', level: 2, sourceFile: MOODS_FILE, lineIndex: 7 },
    ];
    const mock = createStatefulMock(existing);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultMoods(vaultRef));

    // Obtenir les vrais lineIndex après sérialisation
    const serialized = serializeMoods(existing);
    const parsed = parseMoods(serialized);
    const targetIdx = parsed.find((m) => m.profileName === 'Emma')!.lineIndex;

    await act(() => result.current.deleteMood(targetIdx));

    expect(mock.writeFile).toHaveBeenCalled();
    const names = result.current.moods.map((m) => m.profileName);
    expect(names).toContain('Lucas');
    expect(names).not.toContain('Emma');
  });

  it('deleteMood no-op si fichier absent', async () => {
    const mock = createMockVault();
    mock.readFile.mockRejectedValue(new Error('not exist'));
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultMoods(vaultRef));

    await act(() => result.current.deleteMood(5));
    expect(result.current.moods).toEqual([]);
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() => useVaultMoods(vaultRef));

    await act(() => result.current.addMood('p1', 'X', 3));
    await act(() => result.current.deleteMood(0));

    expect(result.current.moods).toEqual([]);
  });
});
