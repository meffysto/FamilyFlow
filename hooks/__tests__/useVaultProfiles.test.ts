/**
 * useVaultProfiles.test.ts — Tests unitaires pour hooks/useVaultProfiles.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultProfiles } from '../useVaultProfiles';

// ─── Mocks externes ────────────────────────────────────────────────────────

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/parser', () => ({
  parseFamille: jest.fn(() => []),
  parseGamification: jest.fn(() => ({ profiles: [], history: [], activeRewards: [], usedLoots: [] })),
  serializeGamification: jest.fn(() => 'mock gami'),
  mergeProfiles: jest.fn(() => []),
  parseFarmProfile: jest.fn(() => ({ mascotDecorations: [], mascotInhabitants: [], mascotPlacements: {} })),
  serializeFarmProfile: jest.fn(() => 'mock farm'),
  parseTaskFile: jest.fn(() => []),
}));

jest.mock('../../lib/gamification', () => ({
  calculateLevel: jest.fn(() => 5),
}));

jest.mock('../../lib/mascot/types', () => ({
  DECORATIONS: [{ id: 'deco-1', cost: 10, minStage: 'seedling' }],
  INHABITANTS: [{ id: 'hab-1', cost: 20, minStage: 'seedling' }],
  TREE_STAGES: [{ stage: 'seedling' }, { stage: 'sprout' }, { stage: 'sapling' }],
}));

jest.mock('../../lib/mascot/engine', () => ({
  getStageIndex: jest.fn(() => 2),
}));

jest.mock('../../lib/famille-queue', () => ({
  enqueueWrite: jest.fn((fn: () => Promise<void>) => fn()),
}));

jest.mock('date-fns', () => ({
  format: jest.fn(() => '2024-01-01'),
}));

// ─── Mock VaultManager ──────────────────────────────────────────────────────

function createMockVault() {
  return {
    readFile: jest.fn().mockResolvedValue(''),
    writeFile: jest.fn().mockResolvedValue(undefined),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    ensureDir: jest.fn().mockResolvedValue(undefined),
    addChild: jest.fn().mockResolvedValue(undefined),
    convertToBorn: jest.fn().mockResolvedValue(undefined),
  };
}

function createVaultRef(mock = createMockVault()) {
  return { current: mock as any };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SecureStore = require('expo-secure-store');
const parser = require('../../lib/parser');

const famContent2Profiles = `# Famille

### p1
name: Alice
role: parent
avatar: :woman:

### p2
name: Lucas
role: enfant
avatar: :boy:`;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultProfiles', () => {
  beforeEach(() => jest.clearAllMocks());

  const mockSetGamiData = jest.fn();
  const mockSetTasks = jest.fn();

  it('initialise avec des tableaux vides', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() =>
      useVaultProfiles(vaultRef, mockSetGamiData, mockSetTasks),
    );

    expect(result.current.profiles).toEqual([]);
    expect(result.current.activeProfileId).toBeNull();
    expect(result.current.ageUpgrades).toEqual([]);
  });

  it('resetProfiles remet tout a zero', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() =>
      useVaultProfiles(vaultRef, mockSetGamiData, mockSetTasks),
    );

    // Mettre des valeurs dans le state
    await act(() => {
      result.current.setProfiles([{ id: 'p1', name: 'Test', role: 'parent' } as any]);
      result.current.setActiveProfileId('p1');
      result.current.setAgeUpgrades([{ profileId: 'p1', childName: 'Test', from: 'bebe', to: 'petit' } as any]);
    });

    expect(result.current.profiles).toHaveLength(1);
    expect(result.current.activeProfileId).toBe('p1');
    expect(result.current.ageUpgrades).toHaveLength(1);

    await act(() => result.current.resetProfiles());

    expect(result.current.profiles).toEqual([]);
    expect(result.current.activeProfileId).toBeNull();
    expect(result.current.ageUpgrades).toEqual([]);
  });

  it('setActiveProfile persiste et met a jour l etat', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() =>
      useVaultProfiles(vaultRef, mockSetGamiData, mockSetTasks),
    );

    await act(() => result.current.setActiveProfile('p1'));

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('active_profile_id', 'p1');
    expect(result.current.activeProfileId).toBe('p1');
  });

  it('activeProfile derive de profiles + activeProfileId', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() =>
      useVaultProfiles(vaultRef, mockSetGamiData, mockSetTasks),
    );

    await act(() => {
      result.current.setProfiles([
        { id: 'p1', name: 'Test', role: 'parent' } as any,
        { id: 'p2', name: 'Autre', role: 'enfant' } as any,
      ]);
      result.current.setActiveProfileId('p1');
    });

    expect(result.current.activeProfile?.id).toBe('p1');
    expect(result.current.activeProfile?.name).toBe('Test');
  });

  it('updateProfileTheme ecrit dans famille.md', async () => {
    const mock = createMockVault();
    const famContent = `# Famille\n\n### p1\nname: Test\nrole: parent`;
    mock.readFile.mockResolvedValue(famContent);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() =>
      useVaultProfiles(vaultRef, mockSetGamiData, mockSetTasks),
    );

    // Initialiser le state avec un profil
    await act(() => {
      result.current.setProfiles([{ id: 'p1', name: 'Test', role: 'parent', theme: undefined } as any]);
    });

    await act(() => result.current.updateProfileTheme('p1', 'pokemon' as any));

    expect(mock.writeFile).toHaveBeenCalledWith(
      'famille.md',
      expect.stringContaining('theme: pokemon'),
    );
    // State local mis a jour
    expect(result.current.profiles[0].theme).toBe('pokemon');
  });

  it('updateProfile met a jour le nom', async () => {
    const mock = createMockVault();
    const famContent = `# Famille\n\n### p1\nname: Test\nrole: parent\navatar: :man:`;
    mock.readFile.mockResolvedValue(famContent);

    // parseFamille doit retourner le profil mis a jour apres ecriture
    parser.parseFamille.mockReturnValue([
      { id: 'p1', name: 'Nouveau Nom', role: 'parent', avatar: ':man:' },
    ]);

    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() =>
      useVaultProfiles(vaultRef, mockSetGamiData, mockSetTasks),
    );

    await act(() => {
      result.current.setProfiles([
        { id: 'p1', name: 'Test', role: 'parent', avatar: ':man:', points: 100, coins: 50, level: 3, streak: 0, lootBoxesAvailable: 0, multiplier: 1, multiplierRemaining: 0, pityCounter: 0 } as any,
      ]);
    });

    await act(() => result.current.updateProfile('p1', { name: 'Nouveau Nom' }));

    expect(mock.writeFile).toHaveBeenCalledWith(
      'famille.md',
      expect.stringContaining('name: Nouveau Nom'),
    );
  });

  it('deleteProfile supprime la section', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue(famContent2Profiles);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() =>
      useVaultProfiles(vaultRef, mockSetGamiData, mockSetTasks),
    );

    await act(() => {
      result.current.setProfiles([
        { id: 'p1', name: 'Alice', role: 'parent' } as any,
        { id: 'p2', name: 'Lucas', role: 'enfant' } as any,
      ]);
    });

    await act(() => result.current.deleteProfile('p1'));

    expect(mock.writeFile).toHaveBeenCalled();
    const written = mock.writeFile.mock.calls[0][1] as string;
    expect(written).not.toContain('### p1');
    expect(written).toContain('### p2');
    // State local filtre
    expect(result.current.profiles).toHaveLength(1);
    expect(result.current.profiles[0].id).toBe('p2');
  });

  it('refreshGamification recharge profils et gami', async () => {
    const mock = createMockVault();
    const famContent = `# Famille\n\n### p1\nname: Test\nrole: parent`;
    mock.readFile.mockImplementation((file: string) => {
      if (file === 'famille.md') return Promise.resolve(famContent);
      if (file.startsWith('gami-')) return Promise.resolve('mock gami content');
      if (file.startsWith('farm-')) return Promise.resolve('mock farm content');
      return Promise.resolve('');
    });

    parser.parseFamille.mockReturnValue([{ id: 'p1', name: 'Test', role: 'parent' }]);
    parser.parseGamification.mockReturnValue({
      profiles: [{ id: 'p1', name: 'Test', points: 200, coins: 150 }],
      history: [],
      activeRewards: [],
      usedLoots: [],
    });
    parser.mergeProfiles.mockReturnValue([
      { id: 'p1', name: 'Test', role: 'parent', points: 200, coins: 150 },
    ]);
    parser.parseFarmProfile.mockReturnValue({
      mascotDecorations: ['deco-1'],
      mascotInhabitants: [],
      mascotPlacements: {},
    });

    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() =>
      useVaultProfiles(vaultRef, mockSetGamiData, mockSetTasks),
    );

    await act(() => result.current.refreshGamification());

    // Profils mis a jour avec donnees farm fusionnees
    expect(result.current.profiles).toHaveLength(1);
    expect(result.current.profiles[0].id).toBe('p1');
    expect(result.current.profiles[0].mascotDecorations).toEqual(['deco-1']);
    // setGamiData appele
    expect(mockSetGamiData).toHaveBeenCalled();
  });

  it('refreshFarm met a jour les donnees ferme', async () => {
    const mock = createMockVault();
    mock.readFile.mockResolvedValue('mock farm content');
    parser.parseFarmProfile.mockReturnValue({
      mascotDecorations: ['deco-1', 'deco-2'],
      mascotInhabitants: ['hab-1'],
      mascotPlacements: { slot1: 'deco-1' },
    });

    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() =>
      useVaultProfiles(vaultRef, mockSetGamiData, mockSetTasks),
    );

    // Initialiser avec un profil
    await act(() => {
      result.current.setProfiles([
        { id: 'p1', name: 'Test', role: 'parent', mascotDecorations: [], mascotInhabitants: [], mascotPlacements: {} } as any,
      ]);
    });

    await act(() => result.current.refreshFarm('p1'));

    expect(mock.readFile).toHaveBeenCalledWith('farm-p1.md');
    expect(result.current.profiles[0].mascotDecorations).toEqual(['deco-1', 'deco-2']);
    expect(result.current.profiles[0].mascotInhabitants).toEqual(['hab-1']);
    expect(result.current.profiles[0].mascotPlacements).toEqual({ slot1: 'deco-1' });
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() =>
      useVaultProfiles(vaultRef, mockSetGamiData, mockSetTasks),
    );

    await act(() => result.current.updateProfile('p1', { name: 'X' }));
    await act(() => result.current.deleteProfile('p1'));
    await act(() => result.current.updateProfileTheme('p1', 'pokemon' as any));
    await act(() => result.current.refreshGamification());
    await act(() => result.current.refreshFarm('p1'));

    // Pas de crash, pas de changement d'etat
    expect(result.current.profiles).toEqual([]);
    expect(mockSetGamiData).not.toHaveBeenCalled();
  });
});
