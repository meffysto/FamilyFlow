/**
 * useVaultMeals.test.ts — Tests unitaires pour hooks/useVaultMeals.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultMeals, mealsFileForWeek } from '../useVaultMeals';
import type { MealItem } from '../../lib/types';

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

const triggerWidgetRefresh = jest.fn();

// ─── Helpers ────────────────────────────────────────────────────────────────

const sampleMealsContent = `# Repas de la semaine

## Lundi
- Petit-déj: Céréales
- Déjeuner: Pâtes bolognaise
- Dîner: Soupe

## Mardi
- Petit-déj:
- Déjeuner:
- Dîner:
`;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultMeals', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initialise avec un tableau vide', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultMeals(vaultRef, triggerWidgetRefresh));
    expect(result.current.meals).toEqual([]);
  });

  it('resetMeals remet à []', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultMeals(vaultRef, triggerWidgetRefresh));

    await act(() => result.current.setMeals([
      { day: 'Lundi', mealType: 'Déjeuner', text: 'Pâtes', sourceFile: 'test.md', lineIndex: 4 } as MealItem,
    ]));
    expect(result.current.meals).toHaveLength(1);

    await act(() => result.current.resetMeals());
    expect(result.current.meals).toEqual([]);
  });

  it('updateMeal modifie la ligne du repas', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue(sampleMealsContent);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultMeals(vaultRef, triggerWidgetRefresh));

    await act(() => result.current.updateMeal('Lundi', 'Déjeuner', 'Risotto'));

    expect(mock.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('Repas semaine du'),
      expect.stringContaining('Risotto')
    );
  });

  it('updateMeal crée le fichier si absent', async () => {
    const mock = createMockVault();
    mock.exists.mockResolvedValue(false);
    mock.readFile.mockImplementation(() => {
      // Après writeFile (template), readFile retourne le template
      return Promise.resolve(sampleMealsContent);
    });
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultMeals(vaultRef, triggerWidgetRefresh));

    await act(() => result.current.updateMeal('Lundi', 'Déjeuner', 'Pizza'));

    // writeFile appelé 2 fois : template + update
    expect(mock.writeFile).toHaveBeenCalledTimes(2);
  });

  it('loadMealsForWeek charge les repas d\'une semaine', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue(sampleMealsContent);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultMeals(vaultRef, triggerWidgetRefresh));

    let loaded: MealItem[] = [];
    await act(async () => {
      loaded = await result.current.loadMealsForWeek(new Date());
    });

    expect(loaded.length).toBeGreaterThan(0);
  });

  it('loadMealsForWeek retourne [] si fichier absent (passé)', async () => {
    const mock = createMockVault();
    mock.exists.mockResolvedValue(false);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultMeals(vaultRef, triggerWidgetRefresh));

    const pastDate = new Date('2020-01-06');
    let loaded: MealItem[] = [];
    await act(async () => {
      loaded = await result.current.loadMealsForWeek(pastDate);
    });

    expect(loaded).toEqual([]);
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() => useVaultMeals(vaultRef, triggerWidgetRefresh));

    await act(() => result.current.updateMeal('Lundi', 'Déjeuner', 'X'));

    let loaded: MealItem[] = [];
    await act(async () => {
      loaded = await result.current.loadMealsForWeek(new Date());
    });

    expect(loaded).toEqual([]);
  });
});

describe('mealsFileForWeek', () => {
  it('retourne un chemin avec la date du lundi', () => {
    // Mercredi 8 avril 2026
    const wednesday = new Date(2026, 3, 8);
    const path = mealsFileForWeek(wednesday);
    expect(path).toBe('02 - Maison/Repas semaine du 2026-04-06.md');
  });

  it('dimanche retourne le lundi précédent', () => {
    // Dimanche 12 avril 2026
    const sunday = new Date(2026, 3, 12);
    const path = mealsFileForWeek(sunday);
    expect(path).toBe('02 - Maison/Repas semaine du 2026-04-06.md');
  });

  it('lundi retourne lui-même', () => {
    const monday = new Date(2026, 3, 6);
    const path = mealsFileForWeek(monday);
    expect(path).toBe('02 - Maison/Repas semaine du 2026-04-06.md');
  });
});
