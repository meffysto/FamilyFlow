/**
 * useVaultGratitude.test.ts — Tests unitaires pour hooks/useVaultGratitude.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultGratitude } from '../useVaultGratitude';
import { serializeGratitude } from '../../lib/parser';
import type { GratitudeDay } from '../../lib/types';

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

const GRATITUDE_FILE = '06 - Mémoires/Gratitude familiale.md';

/** Mock vault avec état interne persistant */
function createStatefulMock(initial: GratitudeDay[] = []) {
  const mock = createMockVault();
  let fileContent = serializeGratitude(initial);

  mock.readFile.mockImplementation(() => Promise.resolve(fileContent));
  mock.writeFile.mockImplementation((_path: string, content: string) => {
    fileContent = content;
    return Promise.resolve();
  });

  return mock;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultGratitude', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initialise avec un tableau vide', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultGratitude(vaultRef));
    expect(result.current.gratitudeDays).toEqual([]);
  });

  it('resetGratitude remet à []', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultGratitude(vaultRef));

    await act(() => result.current.setGratitudeDays([
      { date: '2026-04-01', entries: [{ date: '2026-04-01', profileId: 'p1', profileName: 'Lucas', text: 'Merci' }] },
    ]));
    expect(result.current.gratitudeDays).toHaveLength(1);

    await act(() => result.current.resetGratitude());
    expect(result.current.gratitudeDays).toEqual([]);
  });

  it('addGratitudeEntry crée un nouveau jour', async () => {
    const mock = createStatefulMock();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultGratitude(vaultRef));

    await act(() => result.current.addGratitudeEntry('2026-04-05', 'p1', 'Lucas', 'Merci pour le vélo'));

    expect(mock.writeFile).toHaveBeenCalledWith(
      GRATITUDE_FILE,
      expect.stringContaining('Merci pour le vélo')
    );
    expect(result.current.gratitudeDays).toHaveLength(1);
    expect(result.current.gratitudeDays[0].entries[0].text).toBe('Merci pour le vélo');
  });

  it('addGratitudeEntry ajoute au jour existant', async () => {
    const existing: GratitudeDay[] = [
      { date: '2026-04-05', entries: [{ date: '2026-04-05', profileId: 'p1', profileName: 'Lucas', text: 'Premier' }] },
    ];
    const mock = createStatefulMock(existing);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultGratitude(vaultRef));

    await act(() => result.current.addGratitudeEntry('2026-04-05', 'p2', 'Emma', 'Deuxième'));

    expect(result.current.gratitudeDays).toHaveLength(1);
    expect(result.current.gratitudeDays[0].entries).toHaveLength(2);
  });

  it('addGratitudeEntry remplace l\'entrée du même profil', async () => {
    // Après round-trip serialize→parse, profileId est dérivé du profileName (lowercase, sans accents)
    const existing: GratitudeDay[] = [
      { date: '2026-04-05', entries: [{ date: '2026-04-05', profileId: 'lucas', profileName: 'Lucas', text: 'Ancien' }] },
    ];
    const mock = createStatefulMock(existing);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultGratitude(vaultRef));

    await act(() => result.current.addGratitudeEntry('2026-04-05', 'lucas', 'Lucas', 'Nouveau'));

    expect(result.current.gratitudeDays[0].entries).toHaveLength(1);
    expect(result.current.gratitudeDays[0].entries[0].text).toBe('Nouveau');
  });

  it('deleteGratitudeEntry supprime l\'entrée du profil', async () => {
    // profileId dérivé du profileName après round-trip
    const existing: GratitudeDay[] = [
      { date: '2026-04-05', entries: [
        { date: '2026-04-05', profileId: 'lucas', profileName: 'Lucas', text: 'A' },
        { date: '2026-04-05', profileId: 'emma', profileName: 'Emma', text: 'B' },
      ] },
    ];
    const mock = createStatefulMock(existing);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultGratitude(vaultRef));

    await act(() => result.current.deleteGratitudeEntry('2026-04-05', 'lucas'));

    expect(result.current.gratitudeDays).toHaveLength(1);
    expect(result.current.gratitudeDays[0].entries).toHaveLength(1);
    expect(result.current.gratitudeDays[0].entries[0].profileId).toBe('emma');
  });

  it('deleteGratitudeEntry supprime le jour si plus d\'entrées', async () => {
    const existing: GratitudeDay[] = [
      { date: '2026-04-05', entries: [
        { date: '2026-04-05', profileId: 'lucas', profileName: 'Lucas', text: 'Seul' },
      ] },
    ];
    const mock = createStatefulMock(existing);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultGratitude(vaultRef));

    await act(() => result.current.deleteGratitudeEntry('2026-04-05', 'lucas'));

    expect(result.current.gratitudeDays).toEqual([]);
  });

  it('deleteGratitudeEntry supprime le fichier si plus aucun jour', async () => {
    const existing: GratitudeDay[] = [
      { date: '2026-04-05', entries: [
        { date: '2026-04-05', profileId: 'lucas', profileName: 'Lucas', text: 'Dernier' },
      ] },
    ];
    const mock = createStatefulMock(existing);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultGratitude(vaultRef));

    await act(() => result.current.deleteGratitudeEntry('2026-04-05', 'lucas'));

    expect(mock.deleteFile).toHaveBeenCalledWith(GRATITUDE_FILE);
  });

  it('deleteGratitudeEntry no-op si date introuvable', async () => {
    const existing: GratitudeDay[] = [
      { date: '2026-04-05', entries: [{ date: '2026-04-05', profileId: 'p1', profileName: 'Lucas', text: 'X' }] },
    ];
    const mock = createStatefulMock(existing);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultGratitude(vaultRef));

    await act(() => result.current.deleteGratitudeEntry('2026-01-01', 'p1'));

    // Pas de write — jour introuvable
    expect(mock.writeFile).not.toHaveBeenCalled();
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() => useVaultGratitude(vaultRef));

    await act(() => result.current.addGratitudeEntry('2026-04-05', 'p1', 'X', 'Y'));
    await act(() => result.current.deleteGratitudeEntry('2026-04-05', 'p1'));

    expect(result.current.gratitudeDays).toEqual([]);
  });
});
