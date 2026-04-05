/**
 * useVaultBudget.test.ts — Tests unitaires pour hooks/useVaultBudget.ts
 * Mock du VaultManager, vérification des actions CRUD budget.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultBudget } from '../useVaultBudget';
import { DEFAULT_BUDGET_CONFIG, serializeBudgetMonth, serializeBudgetConfig } from '../../lib/budget';
import type { BudgetEntry } from '../../lib/types';

// ─── Mock VaultManager ──────────────────────────────────────────────────────

function createMockVault() {
  return {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    ensureDir: jest.fn(),
    exists: jest.fn(),
    deleteFile: jest.fn(),
    listDir: jest.fn(),
  };
}

function createVaultRef(mock = createMockVault()) {
  return { current: mock as any };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const sampleEntries: BudgetEntry[] = [
  { date: '2026-04-01', category: 'Courses', amount: 45.50, label: 'Supermarché', lineIndex: 4 },
  { date: '2026-04-02', category: 'Transport', amount: 12, label: 'Métro', lineIndex: 5 },
];

const sampleMonthContent = serializeBudgetMonth('2026-04', sampleEntries);
const sampleConfigContent = serializeBudgetConfig(DEFAULT_BUDGET_CONFIG);

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultBudget', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initialise avec un état vide et le mois courant', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultBudget(vaultRef));

    expect(result.current.budgetEntries).toEqual([]);
    expect(result.current.budgetConfig).toEqual(DEFAULT_BUDGET_CONFIG);
    expect(result.current.budgetMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it('resetBudget remet entries et config à zéro', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultBudget(vaultRef));

    await act(() => result.current.resetBudget());

    expect(result.current.budgetEntries).toEqual([]);
    expect(result.current.budgetConfig).toEqual(DEFAULT_BUDGET_CONFIG);
  });

  it('loadBudgetData charge config et entrées du mois', async () => {
    const mock = createMockVault();
    mock.readFile.mockImplementation((path: string) => {
      if (path.includes('config.md')) return Promise.resolve(sampleConfigContent);
      if (path.includes('.md')) return Promise.resolve(sampleMonthContent);
      return Promise.reject(new Error('not exist'));
    });
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultBudget(vaultRef));

    await act(() => result.current.loadBudgetData('2026-04'));

    expect(result.current.budgetEntries.length).toBe(2);
    expect(result.current.budgetEntries[0].category).toBe('Courses');
    expect(result.current.budgetMonth).toBe('2026-04');
  });

  it('loadBudgetData scaffold la config si fichier absent', async () => {
    const mock = createMockVault();
    mock.readFile.mockImplementation((path: string) => {
      if (path.includes('config.md')) return Promise.reject(new Error('not exist'));
      return Promise.resolve(sampleMonthContent);
    });
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultBudget(vaultRef));

    await act(() => result.current.loadBudgetData('2026-04'));

    expect(mock.ensureDir).toHaveBeenCalledWith('05 - Budget');
    expect(mock.writeFile).toHaveBeenCalledWith(
      '05 - Budget/config.md',
      expect.any(String)
    );
    expect(result.current.budgetConfig).toEqual(DEFAULT_BUDGET_CONFIG);
  });

  it('loadBudgetData met entries à [] si mois absent', async () => {
    const mock = createMockVault();
    mock.readFile.mockImplementation((path: string) => {
      if (path.includes('config.md')) return Promise.resolve(sampleConfigContent);
      return Promise.reject(new Error('not exist'));
    });
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultBudget(vaultRef));

    await act(() => result.current.loadBudgetData('2026-04'));

    expect(result.current.budgetEntries).toEqual([]);
  });

  it('addExpense écrit et met à jour l\'état', async () => {
    const mock = createMockVault();
    let writtenContent = '';
    mock.readFile.mockRejectedValue(new Error('not exist'));
    mock.writeFile.mockImplementation((_path: string, content: string) => {
      writtenContent = content;
      // Après écriture, readFile retourne le contenu écrit
      mock.readFile.mockResolvedValue(content);
      return Promise.resolve();
    });
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultBudget(vaultRef));

    // setBudgetMonth pour matcher la date de l'expense
    await act(() => result.current.setBudgetMonth('2026-04'));
    await act(() => result.current.addExpense('2026-04-05', 'Courses', 32.90, 'Boulangerie'));

    expect(mock.ensureDir).toHaveBeenCalledWith('05 - Budget');
    expect(mock.writeFile).toHaveBeenCalledWith(
      '05 - Budget/2026-04.md',
      expect.stringContaining('Boulangerie')
    );
    expect(writtenContent).toContain('32.90');
  });

  it('deleteExpense supprime la ligne et re-parse', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue(sampleMonthContent);
    mock.writeFile.mockResolvedValue(undefined);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultBudget(vaultRef));

    // D'abord charger les données
    await act(() => result.current.loadBudgetData('2026-04'));
    const initialCount = result.current.budgetEntries.length;

    // Supprimer la première entrée (lineIndex depuis le contenu parsé)
    const lineIdx = result.current.budgetEntries[0]?.lineIndex ?? 4;
    // Après le write, readFile retourne le nouveau contenu
    mock.writeFile.mockImplementation((_path: string, content: string) => {
      mock.readFile.mockResolvedValue(content);
      return Promise.resolve();
    });
    await act(() => result.current.deleteExpense(lineIdx));

    expect(mock.writeFile).toHaveBeenCalled();
    expect(result.current.budgetEntries.length).toBe(initialCount - 1);
  });

  it('updateBudgetConfig écrit et met à jour l\'état', async () => {
    const mock = createMockVault();
    mock.writeFile.mockResolvedValue(undefined);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultBudget(vaultRef));

    const newConfig = { ...DEFAULT_BUDGET_CONFIG, categories: [] };
    await act(() => result.current.updateBudgetConfig(newConfig));

    expect(mock.writeFile).toHaveBeenCalledWith(
      '05 - Budget/config.md',
      expect.any(String)
    );
    expect(result.current.budgetConfig).toEqual(newConfig);
  });

  it('loadBudgetMonths agrège les entrées de N mois', async () => {
    const mock = createMockVault();
    mock.readFile.mockImplementation((path: string) => {
      if (path.includes('.md')) return Promise.resolve(sampleMonthContent);
      return Promise.reject(new Error('not exist'));
    });
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultBudget(vaultRef));

    let entries: BudgetEntry[] = [];
    await act(async () => {
      entries = await result.current.loadBudgetMonths(3);
    });

    // 3 mois × 2 entrées chacun
    expect(entries.length).toBe(6);
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() => useVaultBudget(vaultRef));

    await act(() => result.current.loadBudgetData());
    await act(() => result.current.addExpense('2026-04-05', 'X', 1, 'X'));
    await act(() => result.current.deleteExpense(0));

    expect(result.current.budgetEntries).toEqual([]);
  });
});
