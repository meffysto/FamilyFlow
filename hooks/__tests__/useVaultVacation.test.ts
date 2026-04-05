/**
 * useVaultVacation.test.ts — Tests unitaires pour hooks/useVaultVacation.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultVacation } from '../useVaultVacation';

// Mock SecureStore
const mockStore: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn((key: string, value: string) => {
    mockStore[key] = value;
    return Promise.resolve();
  }),
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
}));

// ─── Mock VaultManager ──────────────────────────────────────────────────────

function createMockVault() {
  return {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
    ensureDir: jest.fn(),
    exists: jest.fn().mockResolvedValue(false),
    deleteFile: jest.fn(),
  };
}

function createVaultRef(mock = createMockVault()) {
  return { current: mock as any };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultVacation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStore).forEach(k => delete mockStore[k]);
  });

  it('initialise avec config null et pas de vacation active', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultVacation(vaultRef));

    expect(result.current.vacationConfig).toBeNull();
    expect(result.current.vacationTasks).toEqual([]);
    expect(result.current.isVacationActive).toBe(false);
  });

  it('resetVacation remet tout à zéro', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultVacation(vaultRef));

    await act(() => result.current.setVacationConfig({ active: true, startDate: '2026-04-01', endDate: '2026-04-15' }));
    expect(result.current.vacationConfig).not.toBeNull();

    await act(() => result.current.resetVacation());
    expect(result.current.vacationConfig).toBeNull();
    expect(result.current.vacationTasks).toEqual([]);
  });

  it('activateVacation stocke la config et crée le fichier', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue('# Checklist Vacances\n\n## Avant le départ\n- [ ] Test\n');
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultVacation(vaultRef));

    await act(() => result.current.activateVacation('2026-07-01', '2026-07-15'));

    expect(result.current.vacationConfig).toEqual({
      active: true,
      startDate: '2026-07-01',
      endDate: '2026-07-15',
    });
    // Fichier créé car exists() retourne false
    expect(mock.writeFile).toHaveBeenCalled();
    expect(mockStore['vacation_mode']).toContain('"active":true');
  });

  it('activateVacation ne recrée pas le fichier s\'il existe', async () => {
    const mock = createMockVault();
    mock.exists.mockResolvedValue(true);
    mock.readFile.mockResolvedValue('# Checklist\n- [ ] Item\n');
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultVacation(vaultRef));

    await act(() => result.current.activateVacation('2026-07-01', '2026-07-15'));

    // writeFile pas appelé pour créer le template (seul readFile est appelé)
    expect(mock.writeFile).not.toHaveBeenCalled();
  });

  it('deactivateVacation désactive la config', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultVacation(vaultRef));

    await act(() => result.current.setVacationConfig({ active: true, startDate: '2026-07-01', endDate: '2026-07-15' }));
    await act(() => result.current.deactivateVacation());

    expect(result.current.vacationConfig?.active).toBe(false);
    expect(mockStore['vacation_mode']).toContain('"active":false');
  });

  it('deactivateVacation no-op si pas de config', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultVacation(vaultRef));

    await act(() => result.current.deactivateVacation());

    expect(result.current.vacationConfig).toBeNull();
  });

  it('isVacationActive est true quand config active et endDate >= aujourd\'hui', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultVacation(vaultRef));

    const futureEnd = '2099-12-31';
    await act(() => result.current.setVacationConfig({ active: true, startDate: '2026-01-01', endDate: futureEnd }));

    expect(result.current.isVacationActive).toBe(true);
  });

  it('isVacationActive est false quand endDate dans le passé', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultVacation(vaultRef));

    await act(() => result.current.setVacationConfig({ active: true, startDate: '2020-01-01', endDate: '2020-01-15' }));

    expect(result.current.isVacationActive).toBe(false);
  });
});
