/**
 * useVaultSecretMissions.test.ts — Tests unitaires pour hooks/useVaultSecretMissions.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultSecretMissions } from '../useVaultSecretMissions';
import type { Task, Profile } from '../../lib/types';

// ─── Mock VaultManager ──────────────────────────────────────────────────────

function createMockVault() {
  return {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
    ensureDir: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true),
  };
}

function createVaultRef(mock = createMockVault()) {
  return { current: mock as any };
}

function createProfilesRef(profiles: Profile[] = []) {
  return { current: profiles };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const sampleProfiles: Profile[] = [
  {
    id: 'lucas',
    name: 'Lucas',
    avatar: '🧒',
    role: 'enfant',
    birthdate: '2020-01-15',
    points: 0,
    coins: 0,
    level: 1,
    streak: 0,
    lootBoxesAvailable: 0,
    multiplier: 1,
    multiplierRemaining: 0,
    pityCounter: 0,
  } as Profile,
];

function creerMission(id: string, status: 'active' | 'pending' | 'validated' = 'active'): Task {
  return {
    id: `05 - Famille/Missions secrètes.md:${id}`,
    text: `Mission ${id}`,
    completed: status === 'validated',
    dueDate: '2026-04-05',
    tags: [],
    mentions: [],
    sourceFile: '05 - Famille/Missions secrètes.md',
    lineIndex: parseInt(id),
    secret: true,
    targetProfileId: 'lucas',
    secretStatus: status,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultSecretMissions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initialise avec un tableau vide', () => {
    const vaultRef = createVaultRef();
    const profilesRef = createProfilesRef();
    const { result } = renderHook(() => useVaultSecretMissions(vaultRef, profilesRef as any));
    expect(result.current.secretMissions).toEqual([]);
  });

  it('resetSecretMissions remet à []', async () => {
    const vaultRef = createVaultRef();
    const profilesRef = createProfilesRef();
    const { result } = renderHook(() => useVaultSecretMissions(vaultRef, profilesRef as any));

    await act(() => result.current.setSecretMissions([creerMission('1')]));
    expect(result.current.secretMissions).toHaveLength(1);

    await act(() => result.current.resetSecretMissions());
    expect(result.current.secretMissions).toEqual([]);
  });

  it('addSecretMission crée une nouvelle mission', async () => {
    const mock = createMockVault();
    mock.readFile.mockRejectedValue(new Error('not exist'));
    const vaultRef = createVaultRef(mock);
    const profilesRef = createProfilesRef(sampleProfiles);
    const { result } = renderHook(() => useVaultSecretMissions(vaultRef, profilesRef as any));

    await act(() => result.current.addSecretMission('Ranger ta chambre', 'lucas'));

    expect(mock.ensureDir).toHaveBeenCalledWith('05 - Famille');
    expect(mock.writeFile).toHaveBeenCalledWith(
      '05 - Famille/Missions secrètes.md',
      expect.any(String)
    );
    expect(result.current.secretMissions.length).toBeGreaterThanOrEqual(1);
  });

  it('completeSecretMission passe en pending', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const profilesRef = createProfilesRef(sampleProfiles);
    const { result } = renderHook(() => useVaultSecretMissions(vaultRef, profilesRef as any));

    const mission = creerMission('1', 'active');
    await act(() => result.current.setSecretMissions([mission]));

    await act(() => result.current.completeSecretMission(mission.id));

    expect(result.current.secretMissions[0].secretStatus).toBe('pending');
    expect(mock.writeFile).toHaveBeenCalled();
  });

  it('validateSecretMission passe en validated + completed', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const profilesRef = createProfilesRef(sampleProfiles);
    const { result } = renderHook(() => useVaultSecretMissions(vaultRef, profilesRef as any));

    const mission = creerMission('1', 'pending');
    await act(() => result.current.setSecretMissions([mission]));

    await act(() => result.current.validateSecretMission(mission.id));

    expect(result.current.secretMissions[0].secretStatus).toBe('validated');
    expect(result.current.secretMissions[0].completed).toBe(true);
    expect(result.current.secretMissions[0].completedDate).toBeTruthy();
    expect(mock.writeFile).toHaveBeenCalled();
  });

  it('ne touche pas les autres missions', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const profilesRef = createProfilesRef(sampleProfiles);
    const { result } = renderHook(() => useVaultSecretMissions(vaultRef, profilesRef as any));

    const m1 = creerMission('1', 'active');
    const m2 = creerMission('2', 'active');
    await act(() => result.current.setSecretMissions([m1, m2]));

    await act(() => result.current.completeSecretMission(m1.id));

    expect(result.current.secretMissions[0].secretStatus).toBe('pending');
    expect(result.current.secretMissions[1].secretStatus).toBe('active');
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const profilesRef = createProfilesRef();
    const { result } = renderHook(() => useVaultSecretMissions(vaultRef, profilesRef as any));

    await act(() => result.current.addSecretMission('X', 'lucas'));
    await act(() => result.current.completeSecretMission('id'));
    await act(() => result.current.validateSecretMission('id'));

    expect(result.current.secretMissions).toEqual([]);
  });
});
