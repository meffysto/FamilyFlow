/**
 * useVaultWishlist.test.ts — Tests unitaires pour hooks/useVaultWishlist.ts
 * Mock du VaultManager, vérification des actions CRUD wishlist.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultWishlist } from '../useVaultWishlist';
import { serializeWishlist, parseWishlist } from '../../lib/parser';
import type { WishlistItem } from '../../lib/types';

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

const WISHLIST_FILE = '05 - Famille/Souhaits.md';

const sampleItem: WishlistItem = {
  id: 'wish_001',
  text: 'Vélo rouge',
  budget: '💰',
  occasion: '🎂',
  notes: 'Taille 16 pouces',
  url: '',
  bought: false,
  boughtBy: '',
  profileName: 'Lucas',
  sourceFile: WISHLIST_FILE,
  lineIndex: 3,
};

const sampleItem2: WishlistItem = {
  id: 'wish_002',
  text: 'Livre dinosaures',
  budget: '',
  occasion: '',
  notes: '',
  url: 'https://example.com',
  bought: false,
  boughtBy: '',
  profileName: 'Emma',
  sourceFile: WISHLIST_FILE,
  lineIndex: 5,
};

/** Mock vault avec état interne persistant */
function createStatefulMock(initial: WishlistItem[] = []) {
  const mock = createMockVault();
  let fileContent = serializeWishlist(initial);

  mock.readFile.mockImplementation(() => Promise.resolve(fileContent));
  mock.writeFile.mockImplementation((_path: string, content: string) => {
    fileContent = content;
    return Promise.resolve();
  });

  return mock;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultWishlist', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initialise avec un tableau vide', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultWishlist(vaultRef));

    expect(result.current.wishlistItems).toEqual([]);
  });

  it('resetWishlist remet à []', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultWishlist(vaultRef));

    await act(() => result.current.setWishlistItems([sampleItem]));
    expect(result.current.wishlistItems).toHaveLength(1);

    await act(() => result.current.resetWishlist());
    expect(result.current.wishlistItems).toEqual([]);
  });

  it('addWishItem ajoute un souhait', async () => {
    const mock = createStatefulMock();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultWishlist(vaultRef));

    await act(() => result.current.addWishItem('Trottinette', 'Lucas', '💰', '🎄', 'Bleue'));

    expect(mock.writeFile).toHaveBeenCalledWith(
      WISHLIST_FILE,
      expect.stringContaining('Trottinette')
    );
    expect(result.current.wishlistItems.length).toBeGreaterThanOrEqual(1);
    const added = result.current.wishlistItems.find((w) => w.text === 'Trottinette');
    expect(added).toBeDefined();
    expect(added!.profileName).toBe('Lucas');
  });

  it('addWishItem avec url optionnelle', async () => {
    const mock = createStatefulMock();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultWishlist(vaultRef));

    await act(() => result.current.addWishItem('Jeu vidéo', 'Emma', undefined, undefined, undefined, 'https://shop.com/game'));

    const added = result.current.wishlistItems.find((w) => w.text === 'Jeu vidéo');
    expect(added).toBeDefined();
  });

  it('updateWishItem modifie un item existant', async () => {
    const mock = createStatefulMock([sampleItem]);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultWishlist(vaultRef));

    // Utiliser les lineIndex réels du fichier sérialisé (pas ceux du setState)
    // reloadWishlist re-parse le fichier, les lineIndex correspondent au fichier
    const reloaded = parseWishlist(serializeWishlist([sampleItem]));
    const realItem = reloaded[0];

    await act(() => result.current.updateWishItem(realItem, { text: 'Vélo bleu' }));

    expect(mock.writeFile).toHaveBeenCalled();
    const updated = result.current.wishlistItems.find(
      (w) => w.profileName === 'Lucas'
    );
    expect(updated?.text).toBe('Vélo bleu');
  });

  it('updateWishItem no-op si item introuvable', async () => {
    const mock = createStatefulMock([]);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultWishlist(vaultRef));

    const fakeItem = { ...sampleItem, lineIndex: 999 };
    await act(() => result.current.updateWishItem(fakeItem, { text: 'X' }));

    expect(result.current.wishlistItems).toEqual([]);
  });

  it('deleteWishItem supprime par lineIndex+profileName', async () => {
    const mock = createStatefulMock([sampleItem, sampleItem2]);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultWishlist(vaultRef));

    // Obtenir les lineIndex réels après sérialisation
    const reloaded = parseWishlist(serializeWishlist([sampleItem, sampleItem2]));
    const realItem = reloaded.find((w) => w.profileName === 'Lucas')!;

    await act(() => result.current.deleteWishItem(realItem));

    expect(mock.writeFile).toHaveBeenCalled();
    const names = result.current.wishlistItems.map((w) => w.profileName);
    expect(names).not.toContain('Lucas');
  });

  it('toggleWishBought passe bought à true avec boughtBy', async () => {
    const mock = createStatefulMock([sampleItem]);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultWishlist(vaultRef));

    // Obtenir le lineIndex réel depuis le fichier sérialisé
    const reloaded = parseWishlist(serializeWishlist([sampleItem]));
    const realItem = reloaded[0];

    await act(() => result.current.toggleWishBought(realItem, 'Papa'));

    const toggled = result.current.wishlistItems.find(
      (w) => w.profileName === 'Lucas'
    );
    expect(toggled?.bought).toBe(true);
    expect(toggled?.boughtBy).toBe('Papa');
  });

  it('toggleWishBought repasse bought à false', async () => {
    const boughtItem = { ...sampleItem, bought: true, boughtBy: 'Papa' };
    const mock = createStatefulMock([boughtItem]);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultWishlist(vaultRef));

    const reloaded = parseWishlist(serializeWishlist([boughtItem]));
    const realItem = reloaded[0];

    await act(() => result.current.toggleWishBought(realItem, 'Papa'));

    const toggled = result.current.wishlistItems.find(
      (w) => w.profileName === sampleItem.profileName
    );
    expect(toggled?.bought).toBe(false);
    expect(toggled?.boughtBy).toBe('');
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() => useVaultWishlist(vaultRef));

    await act(() => result.current.addWishItem('X', 'Y'));
    await act(() => result.current.deleteWishItem(sampleItem));
    await act(() => result.current.toggleWishBought(sampleItem, 'Z'));

    expect(result.current.wishlistItems).toEqual([]);
  });
});
