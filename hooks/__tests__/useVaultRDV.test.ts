/**
 * useVaultRDV.test.ts — Tests unitaires pour hooks/useVaultRDV.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useVaultRDV } from '../useVaultRDV';
import type { RDV } from '../../lib/types';

// Mock scheduled-notifications (évite les imports natifs)
jest.mock('../../lib/scheduled-notifications', () => ({
  loadNotifConfig: jest.fn().mockResolvedValue({}),
  scheduleRDVAlerts: jest.fn().mockResolvedValue(undefined),
}));

// ─── Mock VaultManager ──────────────────────────────────────────────────────

function createMockVault() {
  return {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
    ensureDir: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  };
}

function createVaultRef(mock = createMockVault()) {
  return { current: mock as any };
}

const triggerWidgetRefresh = jest.fn();

// ─── Helpers ────────────────────────────────────────────────────────────────

const sampleRDV: Omit<RDV, 'sourceFile' | 'title'> = {
  date_rdv: '2026-04-10',
  heure: '14:00',
  type_rdv: 'pédiatre',
  enfant: 'Lucas',
  médecin: 'Dr Martin',
  lieu: 'Cabinet Dr Martin',
  statut: 'planifié',
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVaultRDV', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initialise avec un tableau vide', () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultRDV(vaultRef, triggerWidgetRefresh));
    expect(result.current.rdvs).toEqual([]);
  });

  it('resetRDV remet à []', async () => {
    const vaultRef = createVaultRef();
    const { result } = renderHook(() => useVaultRDV(vaultRef, triggerWidgetRefresh));

    await act(() => result.current.setRdvs([
      { ...sampleRDV, title: 'test', sourceFile: '04 - Rendez-vous/test.md' } as RDV,
    ]));
    expect(result.current.rdvs).toHaveLength(1);

    await act(() => result.current.resetRDV());
    expect(result.current.rdvs).toEqual([]);
  });

  it('addRDV écrit, vérifie et met à jour l\'état', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultRDV(vaultRef, triggerWidgetRefresh));

    await act(() => result.current.addRDV(sampleRDV));

    expect(mock.ensureDir).toHaveBeenCalledWith('04 - Rendez-vous');
    expect(mock.writeFile).toHaveBeenCalled();
    expect(mock.exists).toHaveBeenCalled();
    expect(result.current.rdvs).toHaveLength(1);
    expect(result.current.rdvs[0].date_rdv).toBe('2026-04-10');
  });

  it('addRDV throw si le fichier n\'existe pas après écriture', async () => {
    const mock = createMockVault();
    mock.exists.mockResolvedValue(false);
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultRDV(vaultRef, triggerWidgetRefresh));

    await expect(
      act(() => result.current.addRDV(sampleRDV))
    ).rejects.toThrow('Échec écriture RDV');
  });

  it('updateRDV écrit et met à jour l\'état', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultRDV(vaultRef, triggerWidgetRefresh));

    const sourceFile = '04 - Rendez-vous/2026-04-10 Cabinet.md';
    await act(() => result.current.setRdvs([
      { ...sampleRDV, title: 'Cabinet', sourceFile } as RDV,
    ]));

    const updated = { ...sampleRDV, lieu: 'Clinique Pasteur' };
    await act(() => result.current.updateRDV(sourceFile, updated));

    expect(mock.writeFile).toHaveBeenCalled();
    expect(result.current.rdvs[0].lieu).toBe('Clinique Pasteur');
  });

  it('deleteRDV supprime le fichier et l\'état', async () => {
    const mock = createMockVault();
    const vaultRef = createVaultRef(mock);
    const { result } = renderHook(() => useVaultRDV(vaultRef, triggerWidgetRefresh));

    const sourceFile = '04 - Rendez-vous/test.md';
    await act(() => result.current.setRdvs([
      { ...sampleRDV, title: 'test', sourceFile } as RDV,
    ]));

    await act(() => result.current.deleteRDV(sourceFile));

    expect(mock.deleteFile).toHaveBeenCalledWith(sourceFile);
    expect(result.current.rdvs).toEqual([]);
  });

  it('no-op si vaultRef.current est null', async () => {
    const vaultRef = { current: null as any };
    const { result } = renderHook(() => useVaultRDV(vaultRef, triggerWidgetRefresh));

    await act(() => result.current.addRDV(sampleRDV));
    await act(() => result.current.deleteRDV('x.md'));

    expect(result.current.rdvs).toEqual([]);
  });
});
