/**
 * useVaultHealth.ts — Hook dédié au domaine Carnet de santé
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultHealth(vaultRef).
 */

import { useState, useCallback, useRef } from 'react';
import type React from 'react';
import type { HealthRecord, GrowthEntry, VaccineEntry } from '../lib/types';
import { serializeHealthRecord } from '../lib/parser';
import type { VaultManager } from '../lib/vault';

// ─── Constantes ──────────────────────────────────────────────────────────────

const HEALTH_DIR = '01 - Enfants';

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultHealthResult {
  healthRecords: HealthRecord[];
  setHealthRecords: (records: HealthRecord[]) => void;
  saveHealthRecord: (record: HealthRecord) => Promise<void>;
  addGrowthEntry: (enfant: string, entry: GrowthEntry) => Promise<void>;
  updateGrowthEntry: (enfant: string, oldDate: string, newEntry: GrowthEntry) => Promise<void>;
  deleteGrowthEntry: (enfant: string, date: string) => Promise<void>;
  addVaccineEntry: (enfant: string, entry: VaccineEntry) => Promise<void>;
  resetHealth: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultHealth(
  vaultRef: React.MutableRefObject<VaultManager | null>,
): UseVaultHealthResult {
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const healthRecordsRef = useRef(healthRecords);
  healthRecordsRef.current = healthRecords;

  const resetHealth = useCallback(() => {
    setHealthRecords([]);
  }, []);

  const saveHealthRecord = useCallback(async (record: HealthRecord) => {
    if (!vaultRef.current) return;
    const healthPath = `${HEALTH_DIR}/${record.enfant}/Carnet de santé.md`;
    await vaultRef.current.ensureDir(`${HEALTH_DIR}/${record.enfant}`);
    await vaultRef.current.writeFile(healthPath, serializeHealthRecord(record));
    setHealthRecords(prev => {
      const without = prev.filter(r => r.enfantId !== record.enfantId);
      return [...without, record];
    });
  }, []);

  const addHealthEntry = useCallback(async (
    enfant: string,
    field: 'croissance' | 'vaccins',
    entry: GrowthEntry | VaccineEntry,
  ) => {
    const existing = healthRecordsRef.current.find(r => r.enfant === enfant);
    const record: HealthRecord = existing || {
      enfant,
      enfantId: enfant.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-'),
      allergies: [], antecedents: [], medicamentsEnCours: [],
      croissance: [], vaccins: [],
    };
    const updated: HealthRecord = {
      ...record,
      [field]: [...record[field], entry].sort((a: any, b: any) => a.date.localeCompare(b.date)),
    };
    await saveHealthRecord(updated);
  }, [saveHealthRecord]);

  const addGrowthEntry = useCallback(async (enfant: string, entry: GrowthEntry) => {
    await addHealthEntry(enfant, 'croissance', entry);
  }, [addHealthEntry]);

  const updateGrowthEntry = useCallback(async (enfant: string, oldDate: string, newEntry: GrowthEntry) => {
    const existing = healthRecordsRef.current.find(r => r.enfant === enfant);
    if (!existing) return;
    const updated: HealthRecord = {
      ...existing,
      croissance: existing.croissance
        .map(e => e.date === oldDate ? newEntry : e)
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
    await saveHealthRecord(updated);
  }, [saveHealthRecord]);

  const deleteGrowthEntry = useCallback(async (enfant: string, date: string) => {
    const existing = healthRecordsRef.current.find(r => r.enfant === enfant);
    if (!existing) return;
    const updated: HealthRecord = {
      ...existing,
      croissance: existing.croissance.filter(e => e.date !== date),
    };
    await saveHealthRecord(updated);
  }, [saveHealthRecord]);

  const addVaccineEntry = useCallback(async (enfant: string, entry: VaccineEntry) => {
    await addHealthEntry(enfant, 'vaccins', entry);
  }, [addHealthEntry]);

  return {
    healthRecords,
    setHealthRecords,
    saveHealthRecord,
    addGrowthEntry,
    updateGrowthEntry,
    deleteGrowthEntry,
    addVaccineEntry,
    resetHealth,
  };
}
