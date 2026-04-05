/**
 * useVaultPhotos.test.ts — Tests unitaires pour hooks/useVaultPhotos.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultPhotos } from '../useVaultPhotos';

// Mock thumbnails (évite les imports natifs expo)
jest.mock('../../lib/thumbnails', () => ({
  generateThumbnail: jest.fn().mockResolvedValue(undefined),
}));

// ─── Mock VaultManager ──────────────────────────────────────────────────────

function createMockVault() {
  return {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
    ensureDir: jest.fn(),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn(),
    copyFileToVault: jest.fn().mockResolvedValue(undefined),
    getPhotoUri: jest.fn().mockReturnValue('file:///photos/lucas/2026-04-05.jpg'),
  };
}

function createVaultRef(mock = createMockVault()) {
  return { current: mock as any };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultPhotos', () => {
  let busyRef: { current: boolean };

  beforeEach(() => {
    jest.clearAllMocks();
    busyRef = { current: false };
  });

  it('initialise avec un objet vide', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultPhotos(vaultRef, busyRef));
    expect(result.current.photoDates).toEqual({});
  });

  it('resetPhotos remet à {}', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultPhotos(vaultRef, busyRef));

    await act(() => result.current.setPhotoDates({ lucas: ['2026-04-01'] }));
    expect(Object.keys(result.current.photoDates)).toHaveLength(1);

    await act(() => result.current.resetPhotos());
    expect(result.current.photoDates).toEqual({});
  });

  it('addPhoto copie et met à jour l\'état', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultPhotos(vaultRef, busyRef));

    await act(() => result.current.addPhoto('Lucas', '2026-04-05', 'file:///tmp/photo.jpg'));

    expect(mock.copyFileToVault).toHaveBeenCalledWith(
      'file:///tmp/photo.jpg',
      '07 - Photos/Lucas/2026-04-05.jpg'
    );
    expect(result.current.photoDates['lucas']).toContain('2026-04-05');
  });

  it('addPhoto ne duplique pas les dates existantes', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultPhotos(vaultRef, busyRef));

    await act(() => result.current.setPhotoDates({ lucas: ['2026-04-05'] }));
    await act(() => result.current.addPhoto('Lucas', '2026-04-05', 'file:///tmp/photo.jpg'));

    expect(result.current.photoDates['lucas']).toEqual(['2026-04-05']);
  });

  it('addPhoto gère busyRef (true pendant, false après)', async () => {
    const mock = createMockVault();
    let wasBusy = false;
    mock.copyFileToVault.mockImplementation(() => {
      wasBusy = busyRef.current;
      return Promise.resolve();
    });
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultPhotos(vaultRef, busyRef));

    await act(() => result.current.addPhoto('Lucas', '2026-04-05', 'file:///tmp/photo.jpg'));

    expect(wasBusy).toBe(true);
    expect(busyRef.current).toBe(false);
  });

  it('addPhoto throw si vault null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() => useVaultPhotos(vaultRef, busyRef));

    await expect(
      act(() => result.current.addPhoto('Lucas', '2026-04-05', 'file:///x'))
    ).rejects.toThrow('Vault non initialisé');
  });

  it('getPhotoUri délègue au VaultManager', () => {
    const mock = createMockVault();
    mock.getPhotoUri.mockReturnValue('file:///vault/07-Photos/Lucas/2026-04-05.jpg');
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultPhotos(vaultRef, busyRef));

    const uri = result.current.getPhotoUri('Lucas', '2026-04-05');

    expect(mock.getPhotoUri).toHaveBeenCalledWith('Lucas', '2026-04-05');
    expect(uri).toBe('file:///vault/07-Photos/Lucas/2026-04-05.jpg');
  });

  it('getPhotoUri retourne null si vault null', () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() => useVaultPhotos(vaultRef, busyRef));

    expect(result.current.getPhotoUri('Lucas', '2026-04-05')).toBeNull();
  });
});
