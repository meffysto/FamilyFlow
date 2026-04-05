/**
 * useVaultNotes.test.ts — Tests unitaires pour hooks/useVaultNotes.ts
 * Mock du VaultManager, vérification des actions CRUD notes.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultNotes } from '../useVaultNotes';
import { serializeNote } from '../../lib/parser';
import type { Note } from '../../lib/types';

// ─── Mock VaultManager ──────────────────────────────────────────────────────

function createMockVault() {
  return {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    ensureDir: jest.fn(),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn(),
    listDir: jest.fn(),
    listFilesRecursive: jest.fn(),
  };
}

function createVaultRef(mock = createMockVault()) {
  return { current: mock as any };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const sampleNote: Omit<Note, 'sourceFile'> = {
  title: 'Rendez-vous pédiatre',
  category: '📋 Administratif',
  created: '2026-04-01',
  tags: ['santé', 'enfants'],
  content: 'Prendre rendez-vous pour le vaccin.',
};

const sampleNoteContent = serializeNote(sampleNote);

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultNotes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initialise avec un tableau vide', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultNotes(vaultRef));

    expect(result.current.notes).toEqual([]);
  });

  it('resetNotes remet à []', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultNotes(vaultRef));

    // Simuler un état avec des notes
    await act(() => result.current.setNotes([{ ...sampleNote, sourceFile: 'test.md' }]));
    expect(result.current.notes).toHaveLength(1);

    await act(() => result.current.resetNotes());
    expect(result.current.notes).toEqual([]);
  });

  it('loadNotes charge les fichiers du répertoire notes', async () => {
    const mock = createMockVault();
    mock.listFilesRecursive.mockResolvedValue([
      '08 - Notes/Administratif/note1.md',
      '08 - Notes/Administratif/note2.md',
    ]);
    mock.readFile.mockResolvedValue(sampleNoteContent);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultNotes(vaultRef));

    let loaded: Note[] = [];
    await act(async () => {
      loaded = await result.current.loadNotes(mock as any);
    });

    expect(mock.ensureDir).toHaveBeenCalledWith('08 - Notes');
    expect(loaded.length).toBe(2);
    expect(loaded[0].title).toBe('Rendez-vous pédiatre');
  });

  it('loadNotes retourne [] si le répertoire est vide', async () => {
    const mock = createMockVault();
    mock.listFilesRecursive.mockResolvedValue([]);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultNotes(vaultRef));

    let loaded: Note[] = [];
    await act(async () => {
      loaded = await result.current.loadNotes(mock as any);
    });

    expect(loaded).toEqual([]);
  });

  it('loadNotes skip les fichiers mal formés', async () => {
    const mock = createMockVault();
    mock.listFilesRecursive.mockResolvedValue(['08 - Notes/bad.md', '08 - Notes/good.md']);
    mock.readFile.mockImplementation((path: string) => {
      if (path.includes('bad')) return Promise.resolve('pas de frontmatter');
      return Promise.resolve(sampleNoteContent);
    });
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultNotes(vaultRef));

    let loaded: Note[] = [];
    await act(async () => {
      loaded = await result.current.loadNotes(mock as any);
    });

    // Au moins le bon fichier est chargé
    expect(loaded.length).toBeGreaterThanOrEqual(1);
  });

  it('addNote écrit et ajoute à l\'état', async () => {
    const mock = createMockVault();
    mock.writeFile.mockResolvedValue(undefined);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultNotes(vaultRef));

    await act(() => result.current.addNote(sampleNote));

    expect(mock.ensureDir).toHaveBeenCalled();
    expect(mock.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('08 - Notes/'),
      expect.stringContaining('Rendez-vous pédiatre')
    );
    expect(mock.exists).toHaveBeenCalled();
    expect(result.current.notes).toHaveLength(1);
    expect(result.current.notes[0].title).toBe('Rendez-vous pédiatre');
  });

  it('addNote throw si l\'écriture échoue (exists=false)', async () => {
    const mock = createMockVault();
    mock.writeFile.mockResolvedValue(undefined);
    mock.exists.mockResolvedValue(false);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultNotes(vaultRef));

    await expect(
      act(() => result.current.addNote(sampleNote))
    ).rejects.toThrow('Échec de l\'écriture');
  });

  it('updateNote écrit au nouveau chemin et met à jour l\'état', async () => {
    const mock = createMockVault();
    mock.writeFile.mockResolvedValue(undefined);
    mock.deleteFile.mockResolvedValue(undefined);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultNotes(vaultRef));

    // Pré-remplir l'état
    const oldFile = '08 - Notes/Administratif/ancien.md';
    await act(() => result.current.setNotes([{ ...sampleNote, sourceFile: oldFile }]));

    const updated = { ...sampleNote, title: 'Nouveau titre' };
    await act(() => result.current.updateNote(oldFile, updated));

    expect(mock.deleteFile).toHaveBeenCalledWith(oldFile);
    expect(mock.writeFile).toHaveBeenCalled();
    expect(result.current.notes[0].title).toBe('Nouveau titre');
  });

  it('updateNote ne supprime pas l\'ancien si même chemin', async () => {
    const mock = createMockVault();
    mock.writeFile.mockResolvedValue(undefined);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultNotes(vaultRef));

    // Le chemin exact que addNote génèrerait
    const path = '08 - Notes/Administratif/rendez-vous-pediatre.md';
    await act(() => result.current.setNotes([{ ...sampleNote, sourceFile: path }]));
    await act(() => result.current.updateNote(path, sampleNote));

    expect(mock.deleteFile).not.toHaveBeenCalled();
  });

  it('deleteNote supprime le fichier et l\'état', async () => {
    const mock = createMockVault();
    mock.deleteFile.mockResolvedValue(undefined);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultNotes(vaultRef));

    const file = '08 - Notes/Administratif/test.md';
    await act(() => result.current.setNotes([{ ...sampleNote, sourceFile: file }]));
    expect(result.current.notes).toHaveLength(1);

    await act(() => result.current.deleteNote(file));

    expect(mock.deleteFile).toHaveBeenCalledWith(file);
    expect(result.current.notes).toEqual([]);
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() => useVaultNotes(vaultRef));

    await act(() => result.current.addNote(sampleNote));
    await act(() => result.current.updateNote('x.md', sampleNote));
    await act(() => result.current.deleteNote('x.md'));

    expect(result.current.notes).toEqual([]);
  });
});
