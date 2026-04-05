/**
 * useVaultHealth.test.ts — Tests unitaires pour hooks/useVaultHealth.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultHealth } from '../useVaultHealth';
import type { HealthRecord, GrowthEntry, VaccineEntry } from '../../lib/types';

// ─── Mock VaultManager ───────────────────────────────────────���──────────────

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

// ─── Helpers ────────────────────────────────────────────────────────────────

function creerRecord(enfant = 'Lucas'): HealthRecord {
  return {
    enfant,
    enfantId: enfant.toLowerCase(),
    allergies: [],
    antecedents: [],
    medicamentsEnCours: [],
    croissance: [
      { date: '2025-01-15', poids: 10.5, taille: 76 },
      { date: '2025-06-01', poids: 12.0, taille: 82 },
    ],
    vaccins: [],
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultHealth', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initialise avec un tableau vide', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultHealth(vaultRef));
    expect(result.current.healthRecords).toEqual([]);
  });

  it('resetHealth remet à []', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultHealth(vaultRef));

    await act(() => result.current.setHealthRecords([creerRecord()]));
    expect(result.current.healthRecords).toHaveLength(1);

    await act(() => result.current.resetHealth());
    expect(result.current.healthRecords).toEqual([]);
  });

  it('saveHealthRecord sauvegarde et met à jour le state', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultHealth(vaultRef));

    const record = creerRecord();
    await act(() => result.current.saveHealthRecord(record));

    expect(mock.ensureDir).toHaveBeenCalledWith('01 - Enfants/Lucas');
    expect(mock.writeFile).toHaveBeenCalledWith(
      '01 - Enfants/Lucas/Carnet de santé.md',
      expect.any(String)
    );
    expect(result.current.healthRecords).toHaveLength(1);
    expect(result.current.healthRecords[0].enfant).toBe('Lucas');
  });

  it('saveHealthRecord remplace un record existant', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultHealth(vaultRef));

    const record = creerRecord();
    await act(() => result.current.setHealthRecords([record]));

    const updated = { ...record, allergies: ['Arachides'] };
    await act(() => result.current.saveHealthRecord(updated));

    expect(result.current.healthRecords).toHaveLength(1);
    expect(result.current.healthRecords[0].allergies).toEqual(['Arachides']);
  });

  it('addGrowthEntry ajoute une entrée de croissance triée', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultHealth(vaultRef));

    const record = creerRecord();
    await act(() => result.current.setHealthRecords([record]));

    const newEntry: GrowthEntry = { date: '2025-03-01', poids: 11.2, taille: 79 };
    await act(() => result.current.addGrowthEntry('Lucas', newEntry));

    expect(result.current.healthRecords[0].croissance).toHaveLength(3);
    // Vérifie l'ordre : jan, mars, juin
    expect(result.current.healthRecords[0].croissance[1].date).toBe('2025-03-01');
  });

  it('updateGrowthEntry modifie une entrée existante', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultHealth(vaultRef));

    await act(() => result.current.setHealthRecords([creerRecord()]));

    const updated: GrowthEntry = { date: '2025-01-15', poids: 11.0, taille: 77 };
    await act(() => result.current.updateGrowthEntry('Lucas', '2025-01-15', updated));

    expect(result.current.healthRecords[0].croissance[0].poids).toBe(11.0);
  });

  it('deleteGrowthEntry supprime une entrée', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultHealth(vaultRef));

    await act(() => result.current.setHealthRecords([creerRecord()]));

    await act(() => result.current.deleteGrowthEntry('Lucas', '2025-01-15'));

    expect(result.current.healthRecords[0].croissance).toHaveLength(1);
    expect(result.current.healthRecords[0].croissance[0].date).toBe('2025-06-01');
  });

  it('addVaccineEntry ajoute un vaccin', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultHealth(vaultRef));

    await act(() => result.current.setHealthRecords([creerRecord()]));

    const vaccin: VaccineEntry = { date: '2025-04-01', nom: 'ROR', dose: '1ère dose' };
    await act(() => result.current.addVaccineEntry('Lucas', vaccin));

    expect(result.current.healthRecords[0].vaccins).toHaveLength(1);
    expect(result.current.healthRecords[0].vaccins[0].nom).toBe('ROR');
  });

  it('addGrowthEntry crée un record si absent', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultHealth(vaultRef));

    const entry: GrowthEntry = { date: '2025-03-01', poids: 11.2, taille: 79 };
    await act(() => result.current.addGrowthEntry('Emma', entry));

    expect(result.current.healthRecords).toHaveLength(1);
    expect(result.current.healthRecords[0].enfant).toBe('Emma');
    expect(result.current.healthRecords[0].croissance).toHaveLength(1);
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() => useVaultHealth(vaultRef));

    await act(() => result.current.saveHealthRecord(creerRecord()));

    expect(result.current.healthRecords).toEqual([]);
  });
});
