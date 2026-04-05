/**
 * useVaultRecipes.test.ts — Tests unitaires pour hooks/useVaultRecipes.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultRecipes } from '../useVaultRecipes';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/cooklang', () => ({
  parseRecipe: jest.fn((path: string, content: string) => ({
    id: path,
    sourceFile: path,
    title: path.split('/').pop()?.replace('.cook', '') ?? '',
    category: path.split('/').slice(-2, -1)[0] ?? '',
    ingredients: [],
    steps: [],
    tags: [],
    cookware: [],
    servings: 4,
    prepTime: '',
    cookTime: '',
  })),
  generateCookFile: jest.fn(() => 'mock cook content'),
}));

const { parseRecipe } = require('../../lib/cooklang');

// ─── Mock VaultManager ──────────────────────────────────────────────────────

function createMockVault() {
  return {
    readFile: jest.fn().mockResolvedValue('mock content'),
    writeFile: jest.fn().mockResolvedValue(undefined),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    ensureDir: jest.fn().mockResolvedValue(undefined),
    listFilesRecursive: jest.fn().mockResolvedValue([]),
    listDir: jest.fn().mockResolvedValue([]),
    copyFileToVault: jest.fn().mockResolvedValue(undefined),
    getRecipeImageUri: jest.fn().mockReturnValue(null),
  };
}

function createVaultRef(mock = createMockVault()) {
  return { current: mock as any };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const sampleRecipe = (overrides: Record<string, any> = {}) => ({
  id: '03 - Cuisine/Recettes/Plats/Carbonara.cook',
  sourceFile: '03 - Cuisine/Recettes/Plats/Carbonara.cook',
  title: 'Carbonara',
  category: 'Plats',
  ingredients: [],
  steps: [],
  tags: [],
  cookware: [],
  servings: 4,
  prepTime: '',
  cookTime: '',
  ...overrides,
});

const emptyProfiles: any[] = [];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultRecipes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initialise avec un tableau vide', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() =>
      useVaultRecipes(vaultRef, emptyProfiles),
    );
    expect(result.current.recipes).toEqual([]);
  });

  it('resetRecipes remet à []', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() =>
      useVaultRecipes(vaultRef, emptyProfiles),
    );

    await act(() => result.current.setRecipes([sampleRecipe() as any]));
    expect(result.current.recipes).toHaveLength(1);

    await act(() => result.current.resetRecipes());
    expect(result.current.recipes).toEqual([]);
  });

  it('loadRecipes charge les recettes du vault', async () => {
    const mock = createMockVault();
    mock.listFilesRecursive.mockResolvedValue([
      '03 - Cuisine/Recettes/Plats/Carbonara.cook',
    ]);
    mock.readFile.mockResolvedValue('mock cook content');
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() =>
      useVaultRecipes(vaultRef, emptyProfiles),
    );

    await act(() => result.current.loadRecipes(true));

    expect(mock.listFilesRecursive).toHaveBeenCalledWith(
      '03 - Cuisine/Recettes',
      '.cook',
    );
    expect(parseRecipe).toHaveBeenCalledWith(
      '03 - Cuisine/Recettes/Plats/Carbonara.cook',
      'mock cook content',
    );
    expect(result.current.recipes).toHaveLength(1);
    expect(result.current.recipes[0].title).toBe('Carbonara');
  });

  it('loadRecipes ne recharge pas sans force', async () => {
    const mock = createMockVault();
    mock.listFilesRecursive.mockResolvedValue([
      '03 - Cuisine/Recettes/Plats/Carbonara.cook',
    ]);
    mock.readFile.mockResolvedValue('mock cook content');
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() =>
      useVaultRecipes(vaultRef, emptyProfiles),
    );

    // Premier chargement
    await act(() => result.current.loadRecipes(true));
    expect(mock.listFilesRecursive).toHaveBeenCalledTimes(1);

    // Deuxième appel sans force — doit être ignoré
    await act(() => result.current.loadRecipes());
    expect(mock.listFilesRecursive).toHaveBeenCalledTimes(1);
  });

  it('addRecipe crée le fichier et recharge', async () => {
    const mock = createMockVault();
    mock.listFilesRecursive.mockResolvedValue([
      '03 - Cuisine/Recettes/Plats/Poulet rôti.cook',
    ]);
    mock.readFile.mockResolvedValue('mock cook content');
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() =>
      useVaultRecipes(vaultRef, emptyProfiles),
    );

    await act(() =>
      result.current.addRecipe('Plats', {
        title: 'Poulet rôti',
        ingredients: [{ name: 'Poulet', quantity: '1', unit: 'kg' }],
        steps: ['Préchauffer le four'],
      }),
    );

    expect(mock.ensureDir).toHaveBeenCalledWith('03 - Cuisine/Recettes/Plats');
    expect(mock.writeFile).toHaveBeenCalledWith(
      '03 - Cuisine/Recettes/Plats/Poulet rôti.cook',
      'mock cook content',
    );
    // Recharge automatique après ajout
    expect(mock.listFilesRecursive).toHaveBeenCalled();
  });

  it('deleteRecipe supprime et met à jour l\'état', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() =>
      useVaultRecipes(vaultRef, emptyProfiles),
    );

    await act(() =>
      result.current.setRecipes([
        sampleRecipe() as any,
        sampleRecipe({ id: 'other.cook', sourceFile: '03 - Cuisine/Recettes/Plats/Autre.cook', title: 'Autre' }) as any,
      ]),
    );
    expect(result.current.recipes).toHaveLength(2);

    await act(() =>
      result.current.deleteRecipe('03 - Cuisine/Recettes/Plats/Carbonara.cook'),
    );

    expect(mock.deleteFile).toHaveBeenCalledWith(
      '03 - Cuisine/Recettes/Plats/Carbonara.cook',
    );
    expect(result.current.recipes).toHaveLength(1);
    expect(result.current.recipes[0].title).toBe('Autre');
  });

  it('toggleFavorite ajoute et retire', async () => {
    const SecureStore = require('expo-secure-store');
    // Simuler SecureStore qui retient les valeurs en mémoire
    const store: Record<string, string> = {};
    SecureStore.getItemAsync.mockImplementation((key: string) => Promise.resolve(store[key] ?? null));
    SecureStore.setItemAsync.mockImplementation((key: string, val: string) => { store[key] = val; return Promise.resolve(); });

    const vaultRef = createVaultRef();
    const profiles = [{ id: 'p1', name: 'Lucas' }] as any[];
    const { result } = renderHook(() =>
      useVaultRecipes(vaultRef, profiles),
    );

    // Attendre le useEffect initial
    await act(async () => {});

    // Ajouter un favori
    await act(() =>
      result.current.toggleFavorite('p1', 'Plats/Carbonara.cook'),
    );

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'recipe_favorites_p1',
      expect.stringContaining('Plats/Carbonara.cook'),
    );
    expect(result.current.getFavorites('p1')).toContain('Plats/Carbonara.cook');

    // Retirer le favori
    await act(() =>
      result.current.toggleFavorite('p1', 'Plats/Carbonara.cook'),
    );
    expect(result.current.getFavorites('p1')).not.toContain('Plats/Carbonara.cook');
  });

  it('isFavorite et getFavorites', async () => {
    const SecureStore = require('expo-secure-store');
    const store: Record<string, string> = {};
    SecureStore.getItemAsync.mockImplementation((key: string) => Promise.resolve(store[key] ?? null));
    SecureStore.setItemAsync.mockImplementation((key: string, val: string) => { store[key] = val; return Promise.resolve(); });

    const vaultRef = createVaultRef();
    const profiles = [{ id: 'p1', name: 'Lucas' }] as any[];
    const { result } = renderHook(() =>
      useVaultRecipes(vaultRef, profiles),
    );

    // Attendre le useEffect initial
    await act(async () => {});

    // Pas de favoris initialement
    expect(result.current.getFavorites('p1')).toEqual([]);

    // Ajouter des favoris
    await act(() =>
      result.current.toggleFavorite('p1', 'Plats/Carbonara.cook'),
    );
    await act(() =>
      result.current.toggleFavorite('p1', 'Desserts/Tiramisu.cook'),
    );

    expect(result.current.getFavorites('p1')).toHaveLength(2);
    expect(result.current.getFavorites('p1')).toContain('Plats/Carbonara.cook');
    expect(result.current.getFavorites('p1')).toContain('Desserts/Tiramisu.cook');
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() =>
      useVaultRecipes(vaultRef, emptyProfiles),
    );

    await act(() => result.current.loadRecipes(true));
    await act(() =>
      result.current.addRecipe('Plats', {
        title: 'Test',
        ingredients: [],
        steps: [],
      }),
    );
    await act(() => result.current.deleteRecipe('test.cook'));

    expect(result.current.recipes).toEqual([]);
  });
});
