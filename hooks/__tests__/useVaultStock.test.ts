/**
 * useVaultStock.test.ts — Tests unitaires pour hooks/useVaultStock.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultStock } from '../useVaultStock';

// ─── Mock VaultManager ──────────────────────────────────────────────────────

function createMockVault() {
  return {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
    ensureDir: jest.fn(),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn(),
  };
}

function createVaultRef(mock = createMockVault()) {
  return { current: mock as any };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const sampleStockContent = `# Stock & fournitures

## 👶 Bébé

| Produit | Détail | Quantité | Seuil alerte | Qté/achat |
| --- | --- | --- | --- | --- |
| Couches | Taille 4 | 12 | 5 | 1 |
| Lingettes |  | 3 | 2 | 1 |

## 🧊 Surgelés

| Produit | Détail | Quantité | Seuil alerte | Qté/achat |
| --- | --- | --- | --- | --- |
| Petits pois |  | 2 | 1 | 1 |
`;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultStock', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initialise avec des tableaux vides', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultStock(vaultRef));
    expect(result.current.stock).toEqual([]);
    expect(result.current.stockSections).toEqual([]);
  });

  it('resetStock remet à []', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultStock(vaultRef));

    await act(() => result.current.setStock([
      { produit: 'Couches', quantite: 5, seuil: 2, qteAchat: 1, lineIndex: 6, emplacement: 'bebe' } as any,
    ]));
    expect(result.current.stock).toHaveLength(1);

    await act(() => result.current.resetStock());
    expect(result.current.stock).toEqual([]);
    expect(result.current.stockSections).toEqual([]);
  });

  it('updateStockQuantity modifie la quantité', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue(sampleStockContent);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultStock(vaultRef));

    // Initialiser le state avec un item à lineIndex 6
    await act(() => result.current.setStock([
      { produit: 'Couches', detail: 'Taille 4', quantite: 12, seuil: 5, qteAchat: 1, lineIndex: 6, emplacement: 'bebe' } as any,
    ]));

    await act(() => result.current.updateStockQuantity(6, 8));

    expect(mock.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('Stock & fournitures'),
      expect.any(String)
    );
    // State local mis à jour
    expect(result.current.stock[0].quantite).toBe(8);
  });

  it('addStockItem ajoute un article', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue(sampleStockContent);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultStock(vaultRef));

    await act(() => result.current.addStockItem({
      produit: 'Lait',
      quantite: 6,
      seuil: 2,
      qteAchat: 1,
      emplacement: 'bebe',
    }));

    expect(mock.writeFile).toHaveBeenCalled();
    // Re-parse le contenu : stock devrait contenir l'article ajouté
    expect(result.current.stock.length).toBeGreaterThan(0);
  });

  it('addStockItem crée le fichier si absent', async () => {
    const mock = createMockVault();
    mock.readFile.mockRejectedValueOnce(new Error('cannot read'))
      .mockResolvedValue('# Stock & fournitures\n');
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultStock(vaultRef));

    await act(() => result.current.addStockItem({
      produit: 'Couches',
      quantite: 10,
      seuil: 5,
      qteAchat: 1,
      emplacement: 'bebe',
    }));

    // writeFile appelé 2 fois : init + ajout
    expect(mock.writeFile).toHaveBeenCalledTimes(2);
  });

  it('deleteStockItem supprime un article', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue(sampleStockContent);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultStock(vaultRef));

    await act(() => result.current.deleteStockItem(6));

    expect(mock.writeFile).toHaveBeenCalled();
    const written = mock.writeFile.mock.calls[0][1] as string;
    expect(written).not.toContain('Couches');
  });

  it('updateStockItem modifie un article in-place', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue(sampleStockContent);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultStock(vaultRef));

    await act(() => result.current.setStock([
      { produit: 'Couches', detail: 'Taille 4', quantite: 12, seuil: 5, qteAchat: 1, lineIndex: 6, emplacement: 'bebe' } as any,
    ]));

    await act(() => result.current.updateStockItem(6, { quantite: 20 }));

    expect(mock.writeFile).toHaveBeenCalled();
    expect(result.current.stock[0].quantite).toBe(20);
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() => useVaultStock(vaultRef));

    await act(() => result.current.updateStockQuantity(0, 5));
    await act(() => result.current.addStockItem({ produit: 'X', quantite: 1, seuil: 0, qteAchat: 1, emplacement: 'bebe' }));
    await act(() => result.current.deleteStockItem(0));
    await act(() => result.current.updateStockItem(0, { quantite: 1 }));

    // Pas de crash, pas de changement d'état
    expect(result.current.stock).toEqual([]);
  });
});
