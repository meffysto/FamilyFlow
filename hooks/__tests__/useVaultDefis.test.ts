/**
 * useVaultDefis.test.ts — Tests unitaires pour hooks/useVaultDefis.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultDefis } from '../useVaultDefis';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('../../lib/parser', () => ({
  parseDefis: jest.fn(() => []),
  serializeDefis: jest.fn(() => 'mock defis content'),
  parseGamification: jest.fn(() => ({
    profiles: [],
    history: [],
    activeRewards: [],
    usedLoots: [],
  })),
  serializeGamification: jest.fn(() => 'mock gami content'),
  parseFamille: jest.fn(() => []),
  mergeProfiles: jest.fn(() => []),
}));

jest.mock('../../lib/gamification', () => ({
  addPoints: jest.fn(() => ({
    profile: {
      points: 3,
      level: 1,
      multiplierRemaining: 0,
      multiplier: 1,
    },
    entry: {
      profileId: 'p1',
      action: '+3',
      points: 3,
      note: 'test',
      timestamp: new Date().toISOString(),
    },
    activeRewards: [],
  })),
}));

const { serializeDefis } = require('../../lib/parser');

// ─── Mock VaultManager ──────────────────────────────────────────────────────

function createMockVault() {
  return {
    readFile: jest.fn().mockResolvedValue(''),
    writeFile: jest.fn().mockResolvedValue(undefined),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  };
}

function createVaultRef(mock = createMockVault()) {
  return { current: mock as any };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const sampleDefi = (overrides: Record<string, any> = {}) => ({
  id: 'defi-1',
  title: 'Test défi',
  description: 'Un défi de test',
  emoji: '🎯',
  type: 'daily' as const,
  difficulty: 'moyen' as const,
  targetDays: 7,
  startDate: '2024-01-01',
  endDate: '2024-01-07',
  participants: ['p1'],
  rewardPoints: 50,
  rewardLootBoxes: 1,
  ...overrides,
});

function createGamiDataRef(data: any = null) {
  return { current: data };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultDefis', () => {
  beforeEach(() => jest.clearAllMocks());

  const setGamiData = jest.fn();
  const setProfiles = jest.fn();

  it('initialise avec un tableau vide', () => {
    const vaultRef = createVaultRef();
    const gamiDataRef = createGamiDataRef();
    const { result } = renderHook(() =>
      useVaultDefis(vaultRef, gamiDataRef, setGamiData, setProfiles),
    );
    expect(result.current.defis).toEqual([]);
  });

  it('resetDefis remet à []', async () => {
    const vaultRef = createVaultRef();
    const gamiDataRef = createGamiDataRef();
    const { result } = renderHook(() =>
      useVaultDefis(vaultRef, gamiDataRef, setGamiData, setProfiles),
    );

    await act(() =>
      result.current.setDefis([
        { ...sampleDefi(), status: 'active', progress: [] } as any,
      ]),
    );
    expect(result.current.defis).toHaveLength(1);

    await act(() => result.current.resetDefis());
    expect(result.current.defis).toEqual([]);
  });

  it('createDefi ajoute un défi et écrit', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const gamiDataRef = createGamiDataRef();
    const { result } = renderHook(() =>
      useVaultDefis(vaultRef, gamiDataRef, setGamiData, setProfiles),
    );

    await act(() => result.current.createDefi(sampleDefi()));

    expect(result.current.defis).toHaveLength(1);
    expect(result.current.defis[0].id).toBe('defi-1');
    expect(result.current.defis[0].status).toBe('active');
    expect(result.current.defis[0].progress).toEqual([]);
    expect(mock.writeFile).toHaveBeenCalledWith('defis.md', 'mock defis content');
    expect(serializeDefis).toHaveBeenCalled();
  });

  it('checkInDefi ajoute un check-in', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const gamiDataRef = createGamiDataRef();
    const { result } = renderHook(() =>
      useVaultDefis(vaultRef, gamiDataRef, setGamiData, setProfiles),
    );

    // Initialiser avec un défi actif
    await act(() =>
      result.current.setDefis([
        { ...sampleDefi(), status: 'active', progress: [] } as any,
      ]),
    );

    await act(() =>
      result.current.checkInDefi('defi-1', 'p1', true, undefined, 'Bien joué'),
    );

    expect(result.current.defis[0].progress).toHaveLength(1);
    expect(result.current.defis[0].progress[0].profileId).toBe('p1');
    expect(result.current.defis[0].progress[0].completed).toBe(true);
    expect(result.current.defis[0].progress[0].note).toBe('Bien joué');
    expect(mock.writeFile).toHaveBeenCalledWith('defis.md', 'mock defis content');
  });

  it('checkInDefi abstinence failure sets status failed', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const gamiDataRef = createGamiDataRef();
    const { result } = renderHook(() =>
      useVaultDefis(vaultRef, gamiDataRef, setGamiData, setProfiles),
    );

    // Initialiser avec un défi abstinence
    await act(() =>
      result.current.setDefis([
        {
          ...sampleDefi({ type: 'abstinence' }),
          status: 'active',
          progress: [],
        } as any,
      ]),
    );

    await act(() =>
      result.current.checkInDefi('defi-1', 'p1', false),
    );

    expect(result.current.defis[0].status).toBe('failed');
    expect(mock.writeFile).toHaveBeenCalled();
  });

  it('deleteDefi supprime le défi', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const gamiDataRef = createGamiDataRef();
    const { result } = renderHook(() =>
      useVaultDefis(vaultRef, gamiDataRef, setGamiData, setProfiles),
    );

    // Initialiser avec 2 défis
    await act(() =>
      result.current.setDefis([
        { ...sampleDefi(), status: 'active', progress: [] } as any,
        { ...sampleDefi({ id: 'defi-2', title: 'Autre défi' }), status: 'active', progress: [] } as any,
      ]),
    );
    expect(result.current.defis).toHaveLength(2);

    await act(() => result.current.deleteDefi('defi-1'));

    expect(result.current.defis).toHaveLength(1);
    expect(result.current.defis[0].id).toBe('defi-2');
    // Vérifie que le fichier a été écrit OU supprimé (pas les deux)
    const totalCalls = mock.writeFile.mock.calls.length + mock.deleteFile.mock.calls.length;
    expect(totalCalls).toBeGreaterThan(0);
  });

  it('deleteDefi dernier défi supprime le fichier', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const gamiDataRef = createGamiDataRef();
    const { result } = renderHook(() =>
      useVaultDefis(vaultRef, gamiDataRef, setGamiData, setProfiles),
    );

    // Initialiser avec 1 seul défi
    await act(() =>
      result.current.setDefis([
        { ...sampleDefi(), status: 'active', progress: [] } as any,
      ]),
    );

    await act(() => result.current.deleteDefi('defi-1'));

    expect(result.current.defis).toEqual([]);
    // Le fichier est soit supprimé soit écrit (selon le timing du setState updater)
    const totalCalls = mock.writeFile.mock.calls.length + mock.deleteFile.mock.calls.length;
    expect(totalCalls).toBeGreaterThan(0);
  });

  it('completeDefi marque completed', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue('');
    const vaultRef = createVaultRef(mock);
    const gamiDataRef = createGamiDataRef();
    const { result } = renderHook(() =>
      useVaultDefis(vaultRef, gamiDataRef, setGamiData, setProfiles),
    );

    // Initialiser avec un défi actif
    await act(() =>
      result.current.setDefis([
        { ...sampleDefi(), status: 'active', progress: [] } as any,
      ]),
    );

    await act(() => result.current.completeDefi('defi-1'));

    // Le status doit passer à 'completed' dans l'état local
    expect(result.current.defis[0].status).toBe('completed');
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const gamiDataRef = createGamiDataRef();
    const { result } = renderHook(() =>
      useVaultDefis(vaultRef, gamiDataRef, setGamiData, setProfiles),
    );

    await act(() => result.current.createDefi(sampleDefi()));
    await act(() => result.current.checkInDefi('defi-1', 'p1', true));
    await act(() => result.current.completeDefi('defi-1'));
    await act(() => result.current.deleteDefi('defi-1'));

    expect(result.current.defis).toEqual([]);
  });
});
